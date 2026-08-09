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

        // Export CSV Button
        const btnExportCsv = document.getElementById('btn-export-customers-csv');
        if (btnExportCsv) {
            btnExportCsv.addEventListener('click', () => this.exportCSV());
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
