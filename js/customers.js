// customers.js - Customers Directory & Buyer Management

const CustomersManager = {
    customers: [],
    selectedCustomerIds: new Set(),
    activeFilter: 'all', // 'all', 'part-time', 'email', 'phone'
    searchQuery: '',

    async init() {
        this.bindEvents();
        await this.loadCustomers();
    },

    async loadCustomers() {
        try {
            // Fetch raw customer records from IndexedDB
            let dbCustomers = await window.appDB.getAll('customers');
            
            // Sync customers from invoices if DB customers is empty or to catch invoice buyers
            const invoices = await window.appDB.getAll('invoices');
            await this.syncFromInvoices(dbCustomers, invoices);

            // Re-fetch after sync
            dbCustomers = await window.appDB.getAll('customers');
            
            // Compute aggregated statistics per customer from invoices
            this.customers = dbCustomers.map(cust => {
                const custInvoices = invoices.filter(inv => {
                    if (inv.customer && inv.customer.name) {
                        return inv.customer.name.trim().toLowerCase() === cust.name.trim().toLowerCase() ||
                               (cust.phone && inv.customer.phone && inv.customer.phone.trim() === cust.phone.trim());
                    }
                    return false;
                });

                const totalSpent = custInvoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);
                const totalInvoices = custInvoices.length;
                let lastOrderDate = null;
                if (custInvoices.length > 0) {
                    const sortedDates = custInvoices.map(i => i.date).sort((a, b) => new Date(b) - new Date(a));
                    lastOrderDate = sortedDates[0];
                }

                return {
                    ...cust,
                    totalInvoices,
                    totalSpent,
                    lastOrderDate
                };
            });

            // Sort customers default by totalSpent desc, then name asc
            this.customers.sort((a, b) => (b.totalSpent - a.totalSpent) || a.name.localeCompare(b.name));

            this.renderSummaryStats();
            this.renderCustomers();
        } catch (e) {
            console.error('Failed to load customers:', e);
            Utils.showToast('Failed to load customer directory.', 'error');
        }
    },

    async syncFromInvoices(existingCustomers, invoices) {
        if (!invoices || invoices.length === 0) return;

        // Match by name OR phone (consistent with loadCustomers aggregation)
        const isMatch = (cust, name, phone) => {
            const nameMatch = cust.name && name && cust.name.trim().toLowerCase() === name.trim().toLowerCase();
            const phoneMatch = cust.phone && phone && cust.phone.trim() === phone.trim();
            return nameMatch || phoneMatch;
        };

        let addedCount = 0;
        let enrichedCount = 0;

        for (const inv of invoices) {
            const c = inv.customer;
            if (!c || !c.name || !c.name.trim()) continue;

            const name = c.name.trim();
            const phone = c.phone ? c.phone.trim() : '';
            const email = c.email ? c.email.trim() : '';
            const address = c.address ? c.address.trim() : '';

            const match = existingCustomers.find(cust => isMatch(cust, name, phone));

            if (match) {
                // Enrich existing record with missing contact details from the invoice
                let changed = false;
                if (phone && !match.phone) { match.phone = phone; changed = true; }
                if (email && !match.email) { match.email = email; changed = true; }
                if (address && !match.address) { match.address = address; changed = true; }
                if (changed) {
                    match.updatedAt = new Date().toISOString();
                    await window.appDB.put('customers', match);
                    enrichedCount++;
                }
            } else {
                const newCust = {
                    id: Utils.generateUUID(),
                    name,
                    phone,
                    email,
                    address,
                    createdAt: inv.date || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await window.appDB.put('customers', newCust);
                existingCustomers.push(newCust);
                addedCount++;
            }
        }

        if (addedCount > 0 || enrichedCount > 0) {
            console.log(`Auto-synced ${addedCount} new customers, enriched ${enrichedCount} existing from saved invoices.`);
        }
    },

    renderSummaryStats() {
        const totalCountEl = document.getElementById('stat-total-customers');
        const activeBuyersEl = document.getElementById('stat-active-buyers');
        const topBuyerEl = document.getElementById('stat-top-buyer');

        if (totalCountEl) totalCountEl.textContent = this.customers.length;

        // Active buyers: totalInvoices > 0
        const activeBuyers = this.customers.filter(c => c.totalInvoices > 0);
        if (activeBuyersEl) activeBuyersEl.textContent = activeBuyers.length;

        // Top buyer name
        if (topBuyerEl) {
            if (this.customers.length > 0 && this.customers[0].totalSpent > 0) {
                topBuyerEl.textContent = `${this.customers[0].name} (${Utils.formatCurrency(this.customers[0].totalSpent)})`;
            } else {
                topBuyerEl.textContent = 'None';
            }
        }
    },

    getFilteredCustomers() {
        let list = [...this.customers];

        // Apply filter tab
        if (this.activeFilter === 'part-time') {
            // Part time customer view: Filter & rank buyers who buy products the most (order count > 0 or highest spending)
            list = list.filter(c => c.totalInvoices > 0);
            list.sort((a, b) => (b.totalInvoices - a.totalInvoices) || (b.totalSpent - a.totalSpent));
        } else if (this.activeFilter === 'email') {
            list = list.filter(c => c.email && c.email.trim() !== '');
        } else if (this.activeFilter === 'phone') {
            list = list.filter(c => c.phone && c.phone.trim() !== '');
        }

        // Apply search query
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase().trim();
            list = list.filter(c => 
                (c.name && c.name.toLowerCase().includes(q)) ||
                (c.phone && c.phone.toLowerCase().includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q)) ||
                (c.address && c.address.toLowerCase().includes(q))
            );
        }

        return list;
    },

    showAllCustomers() {
        // Reset to the "All Customers" filter and clear any active search
        this.activeFilter = 'all';
        this.searchQuery = '';
        const searchInput = document.getElementById('customer-search-input');
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('.customer-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
        });
        this.renderCustomers();
    },

    showActiveBuyers() {
        // Same semantics as the "Part time customer" filter: buyers with at least one invoice
        this.activeFilter = 'part-time';
        this.searchQuery = '';
        const searchInput = document.getElementById('customer-search-input');
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('.customer-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === 'part-time');
        });
        this.renderCustomers();
    },

    showTopBuyer() {
        // Top buyer = highest total spend (customers list is pre-sorted by totalSpent desc)
        const topBuyer = this.customers.find(c => c.totalSpent > 0);
        if (!topBuyer) {
            Utils.showToast('No buyers yet — top buyer unavailable.', 'warning');
            return;
        }
        this.openPurchaseHistory(topBuyer.id);
    },

    renderCustomers() {
        const tbody = document.getElementById('customers-table-body');
        if (!tbody) return;

        const filtered = this.getFilteredCustomers();
        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                No customers found matching the criteria.
            </td></tr>`;
            this.updateBulkActionBar();
            return;
        }

        // Identify max orders/spending for top buyer badge
        const maxOrders = Math.max(...this.customers.map(c => c.totalInvoices || 0), 0);

        filtered.forEach(cust => {
            const tr = document.createElement('tr');
            tr.classList.add('customer-row-clickable');
            tr.dataset.customerId = cust.id;
            const isSelected = this.selectedCustomerIds.has(cust.id);
            if (isSelected) tr.classList.add('row-selected');

            // Badge check for top buyers
            let buyerBadge = '';
            if (cust.totalInvoices > 0 && cust.totalInvoices === maxOrders && maxOrders > 0) {
                buyerBadge = `<span class="badge badge-success" title="Top Buyer (Most Purchases)">⭐ Top Buyer</span>`;
            } else if (cust.totalInvoices >= 3) {
                buyerBadge = `<span class="badge badge-info" title="Frequent Buyer">Frequent</span>`;
            } else if (cust.totalInvoices > 0) {
                buyerBadge = `<span class="badge badge-secondary">Buyer (${cust.totalInvoices})</span>`;
            } else {
                buyerBadge = `<span class="badge badge-outline" style="opacity: 0.6;">Prospect</span>`;
            }

            tr.innerHTML = `
                <td style="text-align: center;">
                    <input type="checkbox" class="customer-checkbox" data-id="${cust.id}" ${isSelected ? 'checked' : ''} />
                </td>
                <td>
                    <div class="customer-name-wrapper">
                        <strong>${Utils.escapeHTML(cust.name)}</strong>
                        ${buyerBadge}
                    </div>
                </td>
                <td>
                    ${cust.email ? `<a href="mailto:${Utils.escapeHTML(cust.email)}" class="link-contact">${Utils.escapeHTML(cust.email)}</a>` : '<span class="text-muted">—</span>'}
                </td>
                <td>
                    ${cust.phone ? `<a href="tel:${Utils.escapeHTML(cust.phone)}" class="link-contact">${Utils.escapeHTML(cust.phone)}</a>` : '<span class="text-muted">—</span>'}
                </td>
                <td>
                    <span class="cell-address" title="${Utils.escapeHTML(cust.address || '')}">${cust.address ? Utils.escapeHTML(cust.address) : '<span class="text-muted">—</span>'}</span>
                </td>
                <td>
                    <div class="customer-stats-cell">
                        <strong>${Utils.formatCurrency(cust.totalSpent || 0)}</strong>
                        <span class="subtext">${cust.totalInvoices} invoice${cust.totalInvoices !== 1 ? 's' : ''}${cust.lastOrderDate ? ` · Last order ${Utils.formatDate(cust.lastOrderDate)}` : ''}</span>
                    </div>
                </td>
                <td class="no-print" style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-sm btn-outline btn-customer-history" data-id="${cust.id}" title="View Purchase History">📋</button>
                    <button class="btn btn-sm btn-outline btn-edit-customer" data-id="${cust.id}" title="Edit Customer">✏️ Edit</button>
                    <button class="btn btn-sm btn-outline btn-delete-customer text-danger" data-id="${cust.id}" title="Delete Customer">🗑️</button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        this.updateBulkActionBar();
        this.syncSelectAllCheckbox(filtered);
    },

    syncSelectAllCheckbox(filtered) {
        const selectAllCb = document.getElementById('select-all-customers');
        if (!selectAllCb) return;

        if (filtered.length === 0) {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = false;
            return;
        }

        const selectedFiltered = filtered.filter(c => this.selectedCustomerIds.has(c.id));
        if (selectedFiltered.length === filtered.length) {
            selectAllCb.checked = true;
            selectAllCb.indeterminate = false;
        } else if (selectedFiltered.length > 0) {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = true;
        } else {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = false;
        }
    },

    updateBulkActionBar() {
        const bulkBar = document.getElementById('bulk-action-bar');
        const selectedCountEl = document.getElementById('selected-customers-count');
        
        if (!bulkBar || !selectedCountEl) return;

        const count = this.selectedCustomerIds.size;
        selectedCountEl.textContent = count;

        if (count > 0) {
            bulkBar.style.display = 'flex';
            bulkBar.classList.add('visible');
        } else {
            bulkBar.style.display = 'none';
            bulkBar.classList.remove('visible');
        }
    },

    bindEvents() {
        // Total Customers stat card → reset to the "All Customers" view
        const totalCustomersCard = document.querySelector('.stat-card[data-action="show-all-customers"]');
        if (totalCustomersCard) {
            totalCustomersCard.addEventListener('click', () => this.showAllCustomers());
        }

        // Active Buyers stat card → show only customers who have bought
        const activeBuyersCard = document.querySelector('.stat-card[data-action="show-active-buyers"]');
        if (activeBuyersCard) {
            activeBuyersCard.addEventListener('click', () => this.showActiveBuyers());
        }

        // Top Buyer stat card → open the top buyer's purchase history
        const topBuyerCard = document.querySelector('.stat-card[data-action="show-top-buyer"]');
        if (topBuyerCard) {
            topBuyerCard.addEventListener('click', () => this.showTopBuyer());
        }

        // Search Input
        const searchInput = document.getElementById('customer-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderCustomers();
            });
        }

        // Filter Tabs / Buttons
        const filterBtns = document.querySelectorAll('.customer-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilter = btn.getAttribute('data-filter') || 'all';
                this.renderCustomers();
            });
        });

        // Table Checkbox Delegate
        const tbody = document.getElementById('customers-table-body');
        if (tbody) {
            tbody.addEventListener('change', (e) => {
                if (e.target.classList.contains('customer-checkbox')) {
                    const id = e.target.getAttribute('data-id');
                    if (e.target.checked) {
                        this.selectedCustomerIds.add(id);
                    } else {
                        this.selectedCustomerIds.delete(id);
                    }
                    // Toggle row highlight in place (preserves checkbox focus instead of full re-render)
                    const row = e.target.closest('tr');
                    if (row) row.classList.toggle('row-selected', e.target.checked);
                    this.updateBulkActionBar();
                    this.syncSelectAllCheckbox(this.getFilteredCustomers());
                }
            });

            // Action Buttons inside table (History / Edit / Delete) + row click → purchase history
            tbody.addEventListener('click', (e) => {
                const historyBtn = e.target.closest('.btn-customer-history');
                const editBtn = e.target.closest('.btn-edit-customer');
                const deleteBtn = e.target.closest('.btn-delete-customer');

                if (historyBtn) {
                    const id = historyBtn.getAttribute('data-id');
                    this.openPurchaseHistory(id);
                } else if (editBtn) {
                    const id = editBtn.getAttribute('data-id');
                    this.openEditModal(id);
                } else if (deleteBtn) {
                    const id = deleteBtn.getAttribute('data-id');
                    this.deleteCustomer(id);
                } else if (e.target.closest('a, input, button') || e.target.closest('td:first-child')) {
                    // Clicked a link/checkbox/button or the checkbox-column padding — leave it alone
                    return;
                } else {
                    // Plain row click → show this customer's purchase history
                    const row = e.target.closest('tr[data-customer-id]');
                    if (row) this.openPurchaseHistory(row.getAttribute('data-customer-id'));
                }
            });
        }

        // Select All Checkbox
        const selectAllCb = document.getElementById('select-all-customers');
        if (selectAllCb) {
            selectAllCb.addEventListener('change', (e) => {
                const filtered = this.getFilteredCustomers();
                if (e.target.checked) {
                    filtered.forEach(c => this.selectedCustomerIds.add(c.id));
                } else {
                    filtered.forEach(c => this.selectedCustomerIds.delete(c.id));
                }
                this.renderCustomers();
            });
        }

        // Bulk Copy Emails Button
        const btnCopyEmails = document.getElementById('btn-bulk-copy-emails');
        if (btnCopyEmails) {
            btnCopyEmails.addEventListener('click', () => this.handleBulkCopy('email'));
        }

        // Bulk Copy Phones Button
        const btnCopyPhones = document.getElementById('btn-bulk-copy-phones');
        if (btnCopyPhones) {
            btnCopyPhones.addEventListener('click', () => this.handleBulkCopy('phone'));
        }

        // Bulk Copy Addresses Button
        const btnCopyAddresses = document.getElementById('btn-bulk-copy-addresses');
        if (btnCopyAddresses) {
            btnCopyAddresses.addEventListener('click', () => this.handleBulkCopy('address'));
        }

        // Bulk Delete Button
        const btnBulkDelete = document.getElementById('btn-bulk-delete');
        if (btnBulkDelete) {
            btnBulkDelete.addEventListener('click', () => this.handleBulkDelete());
        }

        // Download Dropdown Toggle and Items
        const downloadToggle = document.getElementById('btn-customer-download-toggle');
        const downloadMenu = document.getElementById('customer-download-menu');
        if (downloadToggle && downloadMenu) {
            downloadToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = downloadMenu.style.display === 'flex';
                downloadMenu.style.display = isOpen ? 'none' : 'flex';
                downloadToggle.setAttribute('aria-expanded', !isOpen);
            });

            downloadMenu.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const format = item.getAttribute('data-format');
                    downloadMenu.style.display = 'none';
                    downloadToggle.setAttribute('aria-expanded', 'false');
                    this.handleDownload(format);
                });
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('#customer-download-dropdown')) {
                    downloadMenu.style.display = 'none';
                    downloadToggle.setAttribute('aria-expanded', 'false');
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && downloadMenu.style.display === 'flex') {
                    downloadMenu.style.display = 'none';
                    downloadToggle.setAttribute('aria-expanded', 'false');
                }
            });
        }

        // Add Customer Modal open button
        const btnAddCustomer = document.getElementById('btn-add-customer');
        if (btnAddCustomer) {
            btnAddCustomer.addEventListener('click', () => this.openAddModal());
        }

        // Save Customer Form submit
        const formCustomer = document.getElementById('form-customer');
        if (formCustomer) {
            formCustomer.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCustomerFromModal();
            });
        }

        // Close Modal buttons
        const modal = document.getElementById('modal-customer');
        if (modal) {
            const closeBtns = modal.querySelectorAll('.modal-close, .btn-cancel-modal');
            closeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            });
        }

        // Close Purchase History Modal buttons
        const historyModal = document.getElementById('modal-customer-history');
        if (historyModal) {
            historyModal.querySelectorAll('.modal-history-close').forEach(btn => {
                btn.addEventListener('click', () => {
                    historyModal.style.display = 'none';
                });
            });
        }

        // View invoice buttons inside the purchase history modal
        const historyBody = document.getElementById('customer-history-body');
        if (historyBody) {
            historyBody.addEventListener('click', (e) => {
                const viewBtn = e.target.closest('.btn-view-history-invoice');
                if (viewBtn) {
                    this.viewCustomerInvoice(viewBtn.getAttribute('data-id'));
                }
            });
        }
    },

    async handleBulkCopy(type) {
        if (this.selectedCustomerIds.size === 0) {
            Utils.showToast('No customers selected.', 'warning');
            return;
        }

        const selectedCustomers = this.customers.filter(c => this.selectedCustomerIds.has(c.id));
        let values = [];
        let label = '';

        if (type === 'email') {
            label = 'Emails';
            values = selectedCustomers.map(c => c.email ? c.email.trim() : '').filter(v => v !== '');
        } else if (type === 'phone') {
            label = 'Phone numbers';
            values = selectedCustomers.map(c => c.phone ? c.phone.trim() : '').filter(v => v !== '');
        } else if (type === 'address') {
            label = 'Addresses';
            values = selectedCustomers.map(c => c.address ? `${c.name}: ${c.address.trim()}` : '').filter(v => v !== '');
        }

        if (values.length === 0) {
            Utils.showToast(`No valid ${label.toLowerCase()} found in selected customers.`, 'warning');
            return;
        }

        const textToCopy = values.join('\n');
        try {
            await navigator.clipboard.writeText(textToCopy);
            Utils.showToast(`Copied ${values.length} ${label.toLowerCase()} to clipboard!`, 'success');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Utils.showToast(`Copied ${values.length} ${label.toLowerCase()} to clipboard!`, 'success');
        }
    },

    async handleBulkDelete() {
        const count = this.selectedCustomerIds.size;
        if (count === 0) return;

        if (!confirm(`Are you sure you want to delete ${count} selected customer(s)?`)) {
            return;
        }

        try {
            for (const id of this.selectedCustomerIds) {
                await window.appDB.delete('customers', id);
            }
            this.selectedCustomerIds.clear();
            Utils.showToast(`Deleted ${count} customer(s).`, 'success');
            await this.loadCustomers();
        } catch (e) {
            console.error('Bulk delete failed:', e);
            Utils.showToast('Failed to delete selected customers.', 'error');
        }
    },

    handleDownload(format) {
        switch (format) {
            case 'csv':
                this.exportCSV();
                break;
            case 'xlsx':
                this.exportXLSX();
                break;
            case 'svg':
                this.exportSVG();
                break;
            case 'pdf':
                this.exportPDF();
                break;
            default:
                this.exportCSV();
                break;
        }
    },

    exportCSV() {
        // Export the currently visible list (respects active filter + search query)
        const list = this.getFilteredCustomers();
        if (list.length === 0) {
            Utils.showToast('No customers to export with the current filter.', 'warning');
            return;
        }

        const escapeCell = (value) => {
            const s = value === null || value === undefined ? '' : String(value);
            return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const headers = ['Name', 'Phone', 'Email', 'Address', 'Total Invoices', 'Total Spent (INR)', 'Last Order Date'];
        const rows = list.map(c => [
            c.name || '',
            c.phone || '',
            c.email || '',
            c.address || '',
            c.totalInvoices || 0,
            (c.totalSpent || 0).toFixed(2),
            c.lastOrderDate ? Utils.formatDate(c.lastOrderDate) : ''
        ].map(escapeCell).join(','));

        // BOM prefix so Excel opens UTF-8 (₹, names) correctly
        const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast(`Exported ${list.length} customer(s) to CSV.`, 'success');
    },

    exportXLSX() {
        // Export currently visible list as Excel-compatible Workbook XML (.xlsx)
        const list = this.getFilteredCustomers();
        if (list.length === 0) {
            Utils.showToast('No customers to export with the current filter.', 'warning');
            return;
        }

        const escapeXml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        let xmlRows = '';
        list.forEach(c => {
            xmlRows += `
    <Row ss:Height="20">
      <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(c.name || '')}</Data></Cell>
      <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(c.phone || '')}</Data></Cell>
      <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(c.email || '')}</Data></Cell>
      <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(c.address || '')}</Data></Cell>
      <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${c.totalInvoices || 0}</Data></Cell>
      <Cell ss:StyleID="DataNumber"><Data ss:Type="Number">${(c.totalSpent || 0).toFixed(2)}</Data></Cell>
      <Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(c.lastOrderDate ? Utils.formatDate(c.lastOrderDate) : '')}</Data></Cell>
    </Row>`;
        });

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Customers Directory</Title>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Segoe UI" ss:Size="11"/>
   <Interior ss:Color="#0EA5E9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0284C7"/>
   </Borders>
  </Style>
  <Style ss:ID="Data">
   <Font ss:Color="#1E293B" ss:FontName="Segoe UI" ss:Size="10"/>
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="DataNumber">
   <Font ss:Color="#1E293B" ss:FontName="Segoe UI" ss:Size="10"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Customers">
  <Table>
   <Column ss:Width="160"/>
   <Column ss:Width="120"/>
   <Column ss:Width="180"/>
   <Column ss:Width="240"/>
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Column ss:Width="120"/>
   <Row ss:StyleID="Header" ss:Height="24">
    <Cell><Data ss:Type="String">Customer Name</Data></Cell>
    <Cell><Data ss:Type="String">Phone Number</Data></Cell>
    <Cell><Data ss:Type="String">Email Address</Data></Cell>
    <Cell><Data ss:Type="String">Address</Data></Cell>
    <Cell><Data ss:Type="String">Total Invoices</Data></Cell>
    <Cell><Data ss:Type="String">Total Spent (INR)</Data></Cell>
    <Cell><Data ss:Type="String">Last Order Date</Data></Cell>
   </Row>
   ${xmlRows}
  </Table>
 </Worksheet>
</Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast(`Exported ${list.length} customer(s) to Excel (.xlsx).`, 'success');
    },

    exportSVG() {
        // Export currently visible list as a vector graphic card (.svg)
        const list = this.getFilteredCustomers();
        if (list.length === 0) {
            Utils.showToast('No customers to export with the current filter.', 'warning');
            return;
        }

        const escapeXml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        const rowHeight = 44;
        const headerHeight = 140;
        const tableHeaderHeight = 40;
        const footerHeight = 40;
        const totalHeight = headerHeight + tableHeaderHeight + (list.length * rowHeight) + footerHeight;
        const width = 1100;

        let rowsSvg = '';
        list.forEach((c, idx) => {
            const y = headerHeight + tableHeaderHeight + (idx * rowHeight);
            const bg = idx % 2 === 0 ? '#1e293b' : '#0f172a';
            const isTop = idx === 0 && (c.totalInvoices || 0) > 0;
            
            rowsSvg += `
        <rect x="20" y="${y}" width="${width - 40}" height="${rowHeight}" fill="${bg}" rx="4"/>
        <text x="40" y="${y + 26}" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="${isTop ? '700' : '600'}" fill="${isTop ? '#38bdf8' : '#f8fafc'}">${escapeXml(c.name || '—')}${isTop ? ' ⭐' : ''}</text>
        <text x="260" y="${y + 26}" font-family="Inter, -apple-system, sans-serif" font-size="12" fill="#94a3b8">${escapeXml(c.phone || '—')}</text>
        <text x="420" y="${y + 26}" font-family="Inter, -apple-system, sans-serif" font-size="12" fill="#38bdf8">${escapeXml(c.email || '—')}</text>
        <text x="640" y="${y + 26}" font-family="Inter, -apple-system, sans-serif" font-size="12" fill="#94a3b8">${escapeXml((c.address || '—').substring(0, 32) + ((c.address && c.address.length > 32) ? '...' : ''))}</text>
        <text x="880" y="${y + 26}" font-family="Inter, -apple-system, sans-serif" font-size="12" fill="#f8fafc" text-anchor="middle">${c.totalInvoices || 0}</text>
        <text x="1040" y="${y + 26}" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#34d399" text-anchor="end">${escapeXml(Utils.formatCurrency(c.totalSpent || 0))}</text>`;
        });

        const totalRevenue = list.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
        const activeBuyers = list.filter(c => (c.totalInvoices || 0) > 0).length;

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="${width}" height="${totalHeight}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${totalHeight}" fill="#0b1120"/>

  <!-- Header Banner -->
  <rect x="20" y="20" width="${width - 40}" height="100" rx="12" fill="url(#headerGrad)"/>
  <text x="50" y="60" font-family="Inter, -apple-system, sans-serif" font-size="24" font-weight="800" fill="#ffffff">👥 Ease Invoice — Customer Directory</text>
  <text x="50" y="90" font-family="Inter, -apple-system, sans-serif" font-size="13" fill="#cbd5e1">Generated on ${Utils.formatDate(new Date().toISOString())} • ${list.length} Customers • ${activeBuyers} Active Buyers • Total Volume: ${escapeXml(Utils.formatCurrency(totalRevenue))}</text>

  <!-- Table Header -->
  <rect x="20" y="${headerHeight}" width="${width - 40}" height="${tableHeaderHeight}" fill="#1e293b" rx="6"/>
  <text x="40" y="${headerHeight + 25}" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="1">CUSTOMER NAME</text>
  <text x="260" y="${headerHeight + 25}" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="1">PHONE</text>
  <text x="420" y="${headerHeight + 25}" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="1">EMAIL</text>
  <text x="640" y="${headerHeight + 25}" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="1">ADDRESS</text>
  <text x="880" y="${headerHeight + 25}" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="1" text-anchor="middle">ORDERS</text>
  <text x="1040" y="${headerHeight + 25}" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="1" text-anchor="end">TOTAL SPENT</text>

  <!-- Data Rows -->
  ${rowsSvg}

  <!-- Footer -->
  <text x="${width / 2}" y="${totalHeight - 15}" font-family="Inter, -apple-system, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Ease Invoice Pro • Vector Graphic Report</text>
</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_${new Date().toISOString().split('T')[0]}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast(`Exported ${list.length} customer(s) to SVG.`, 'success');
    },

    exportPDF() {
        // Export currently visible list as a printable PDF report
        const list = this.getFilteredCustomers();
        if (list.length === 0) {
            Utils.showToast('No customers to export with the current filter.', 'warning');
            return;
        }

        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) {
            Utils.showToast('Popup blocked. Please allow popups to download PDF.', 'warning');
            return;
        }

        const totalRevenue = list.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
        const activeBuyers = list.filter(c => (c.totalInvoices || 0) > 0).length;

        let rowsHtml = '';
        list.forEach((c, idx) => {
            const isTop = idx === 0 && (c.totalInvoices || 0) > 0;
            rowsHtml += `
        <tr>
            <td><strong>${Utils.escapeHTML(c.name || '—')}</strong>${isTop ? ' <span class="badge">⭐ Top Buyer</span>' : ''}</td>
            <td>${Utils.escapeHTML(c.phone || '—')}</td>
            <td>${Utils.escapeHTML(c.email || '—')}</td>
            <td>${Utils.escapeHTML(c.address || '—')}</td>
            <td style="text-align:center;">${c.totalInvoices || 0}</td>
            <td style="text-align:right;"><strong>${Utils.formatCurrency(c.totalSpent || 0)}</strong></td>
            <td>${c.lastOrderDate ? Utils.formatDate(c.lastOrderDate) : '—'}</td>
        </tr>`;
        });

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Customer Directory - Ease Invoice</title>
    <style>
        @page { size: A4 portrait; margin: 1.2cm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 12px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0ea5e9; padding-bottom: 12px; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0; }
        .subtitle { font-size: 11px; color: #64748b; margin: 0; }
        .stats { display: flex; gap: 20px; margin-bottom: 16px; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .stat-item { display: flex; flex-direction: column; }
        .stat-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; }
        .stat-val { font-size: 13px; font-weight: bold; color: #0ea5e9; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
        th { background: #0ea5e9; color: white; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .badge { background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
        .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="title">Ease Invoice — Customer Directory</h1>
            <p class="subtitle">Exported on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
    </div>
    <div class="stats">
        <div class="stat-item"><span class="stat-label">Total Customers</span><span class="stat-val">${list.length}</span></div>
        <div class="stat-item"><span class="stat-label">Active Buyers</span><span class="stat-val">${activeBuyers}</span></div>
        <div class="stat-item"><span class="stat-label">Total Volume</span><span class="stat-val">${Utils.formatCurrency(totalRevenue)}</span></div>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width: 20%;">Customer Name</th>
                <th style="width: 14%;">Phone</th>
                <th style="width: 18%;">Email</th>
                <th style="width: 22%;">Address</th>
                <th style="width: 8%; text-align:center;">Orders</th>
                <th style="width: 10%; text-align:right;">Total Spent</th>
                <th style="width: 8%;">Last Order</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>
    <div class="footer">
        Generated by Ease Invoice Pro • Free &amp; Client-side Invoicing
    </div>
    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>`;

        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();

        Utils.showToast(`Prepared PDF document with ${list.length} customer(s).`, 'success');
    },

    openAddModal() {
        const modal = document.getElementById('modal-customer');
        const modalTitle = document.getElementById('modal-customer-title');
        const form = document.getElementById('form-customer');

        if (!modal || !form) return;

        form.reset();
        document.getElementById('cust-modal-id').value = '';
        if (modalTitle) modalTitle.textContent = 'Add New Customer';
        modal.style.display = 'flex';
    },

    openEditModal(id) {
        const cust = this.customers.find(c => c.id === id);
        if (!cust) return;

        const modal = document.getElementById('modal-customer');
        const modalTitle = document.getElementById('modal-customer-title');
        
        if (!modal) return;

        document.getElementById('cust-modal-id').value = cust.id;
        document.getElementById('cust-modal-name').value = cust.name || '';
        document.getElementById('cust-modal-phone').value = cust.phone || '';
        document.getElementById('cust-modal-email').value = cust.email || '';
        document.getElementById('cust-modal-address').value = cust.address || '';

        if (modalTitle) modalTitle.textContent = 'Edit Customer';
        modal.style.display = 'flex';
    },

    async saveCustomerFromModal() {
        const id = document.getElementById('cust-modal-id').value || Utils.generateUUID();
        const name = document.getElementById('cust-modal-name').value.trim();
        const phone = document.getElementById('cust-modal-phone').value.trim();
        const email = document.getElementById('cust-modal-email').value.trim();
        const address = document.getElementById('cust-modal-address').value.trim();

        if (!name) {
            Utils.showToast('Customer name is required.', 'warning');
            return;
        }

        const customerData = {
            id,
            name,
            phone,
            email,
            address,
            updatedAt: new Date().toISOString()
        };

        const existing = this.customers.find(c => c.id === id);
        if (existing) {
            customerData.createdAt = existing.createdAt || new Date().toISOString();
        } else {
            customerData.createdAt = new Date().toISOString();
        }

        try {
            await window.appDB.put('customers', customerData);
            document.getElementById('modal-customer').style.display = 'none';
            Utils.showToast('Customer saved successfully!', 'success');
            await this.loadCustomers();
        } catch (e) {
            console.error('Failed to save customer:', e);
            Utils.showToast('Failed to save customer.', 'error');
        }
    },

    async deleteCustomer(id) {
        const cust = this.customers.find(c => c.id === id);
        if (!cust) return;

        if (!confirm(`Are you sure you want to delete customer "${cust.name}"?`)) {
            return;
        }

        try {
            await window.appDB.delete('customers', id);
            this.selectedCustomerIds.delete(id);
            Utils.showToast('Customer deleted successfully.', 'success');
            await this.loadCustomers();
        } catch (e) {
            console.error('Failed to delete customer:', e);
            Utils.showToast('Failed to delete customer.', 'error');
        }
    },

    async openPurchaseHistory(customerId) {
        const cust = this.customers.find(c => c.id === customerId);
        if (!cust) return;

        const modal = document.getElementById('modal-customer-history');
        const titleEl = document.getElementById('customer-history-title');
        const summaryEl = document.getElementById('customer-history-summary');
        const tbody = document.getElementById('customer-history-body');
        if (!modal || !summaryEl || !tbody) return;

        // Fetch invoices and match by name OR phone (same logic as loadCustomers aggregation)
        const invoices = await window.appDB.getAll('invoices');
        const custInvoices = invoices
            .filter(inv => {
                if (!inv.customer || !inv.customer.name) return false;
                return inv.customer.name.trim().toLowerCase() === cust.name.trim().toLowerCase() ||
                       (cust.phone && inv.customer.phone && inv.customer.phone.trim() === cust.phone.trim());
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalSpent = custInvoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);

        if (titleEl) titleEl.textContent = `🧾 Purchase History — ${cust.name}`;
        summaryEl.innerHTML = `
            <div class="customer-history-stat">
                <span class="stat-label">Total Invoices</span>
                <strong>${custInvoices.length}</strong>
            </div>
            <div class="customer-history-stat">
                <span class="stat-label">Total Spent</span>
                <strong>${Utils.formatCurrency(totalSpent)}</strong>
            </div>
            <div class="customer-history-stat">
                <span class="stat-label">Contact</span>
                <strong>${[cust.phone, cust.email].filter(Boolean).map(v => Utils.escapeHTML(v)).join(' · ') || '—'}</strong>
            </div>
        `;

        tbody.innerHTML = '';
        if (custInvoices.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                No invoices found for this customer yet.
            </td></tr>`;
        } else {
            custInvoices.forEach(inv => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${Utils.formatDate(inv.date)}</td>
                    <td><strong>${Utils.escapeHTML(inv.number)}</strong></td>
                    <td>${inv.items ? inv.items.length : 0} item${(inv.items ? inv.items.length : 0) !== 1 ? 's' : ''}</td>
                    <td><strong>${Utils.formatCurrency(inv.grandTotal)}</strong></td>
                    <td class="no-print" style="text-align: right;">
                        <button class="btn btn-sm btn-outline btn-view-history-invoice" data-id="${inv.id}" title="View Invoice Details">👁️ View</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        modal.style.display = 'flex';
    },

    async viewCustomerInvoice(invoiceId) {
        // Ensure the invoice still exists (guard against stale in-memory lists)
        const fresh = await window.appDB.get('invoices', invoiceId);
        if (!fresh) {
            Utils.showToast('Invoice not found.', 'error');
            return;
        }
        if (window.InvoiceManager && Array.isArray(window.InvoiceManager.invoices) &&
            !window.InvoiceManager.invoices.some(i => i.id === invoiceId)) {
            window.InvoiceManager.invoices.unshift(fresh);
        }

        // Switch to the dashboard view first (the invoice editor lives there), then load the invoice
        const navLink = document.querySelector('.nav-link[data-target="view-dashboard"]');
        if (navLink) navLink.click();
        const modal = document.getElementById('modal-customer-history');
        if (modal) modal.style.display = 'none';
        if (window.InvoiceManager) {
            window.InvoiceManager.viewInvoice(invoiceId);
        }
    }
};

window.CustomersManager = CustomersManager;
