// invoice.js - Invoice Builder & Logic

const InvoiceManager = {
    currentItems: [],
    invoices: [],
    _stockToastTimers: {}, // per-row debounce timers for stock warning toasts
    
    async init() {
        this.bindEvents();
        await this.loadHistory();
        await this.renderDashboardStats();
    },

    async renderDashboardStats() {
        try {
            // Products count & low stock count
            const products = await window.appDB.getAll('products');
            document.getElementById('stat-products').textContent = products.length;
            const lowStockCount = products.filter(p => p.stockQty <= p.lowStockThreshold).length;
            const outOfStockCount = products.filter(p => p.stockQty <= 0).length;
            const lowStockCard = document.getElementById('stat-low-stock').closest('.stat-card');
            const lowStockEl = document.getElementById('stat-low-stock');
            
            // Approaching low stock count (above threshold but within 5 units)
            const approachingLowCount = products.filter(p => {
                const isLow = p.stockQty <= p.lowStockThreshold;
                return !isLow && p.lowStockThreshold > 0 && p.stockQty <= p.lowStockThreshold + 5;
            }).length;
            const approachingLowCard = document.getElementById('stat-approaching-low')?.closest('.stat-card');
            const approachingLowEl = document.getElementById('stat-approaching-low');
            
            if (approachingLowEl) {
                if (approachingLowCount > 0) {
                    approachingLowEl.innerHTML = `<span class="low-stock-badge badge-warning">${approachingLowCount}</span>`;
                    if (approachingLowCard) approachingLowCard.classList.add('stat-approaching-low-stock');
                } else {
                    approachingLowEl.innerHTML = `<span class="low-stock-badge badge-success">0</span>`;
                    if (approachingLowCard) approachingLowCard.classList.remove('stat-approaching-low-stock');
                }
            }
            
            // Apply animated badge and card class
            // Sidebar nav low-stock indicator dot
            const navDot = document.querySelector('.nav-low-stock-dot');
            
            if (lowStockCount > 0) {
                lowStockCard.classList.add('stat-low-stock');
                lowStockEl.innerHTML = `<span class="low-stock-badge badge-danger">${lowStockCount}</span>${outOfStockCount > 0 ? '<span class="low-stock-dot" title="' + outOfStockCount + ' out of stock"></span>' : ''}`;
                if (navDot) { navDot.style.display = 'inline-block'; navDot.title = lowStockCount + ' low stock product' + (lowStockCount !== 1 ? 's' : ''); }
            } else {
                lowStockCard.classList.remove('stat-low-stock');
                lowStockEl.innerHTML = `<span class="low-stock-badge badge-success">0</span>`;
                if (navDot) { navDot.style.display = 'none'; }
            }

            // Monthly stock changes from history
            if (window.StockHistoryManager) {
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const history = await window.StockHistoryManager.getAllHistory();
                const thisMonth = history.filter(e => e.date >= monthStart);

                let totalSold = 0;
                let totalRestocked = 0;
                thisMonth.forEach(e => {
                    if (e.change < 0) totalSold += Math.abs(e.change);
                    else if (e.change > 0) totalRestocked += e.change;
                });

                document.getElementById('stat-sold').textContent = totalSold;
                document.getElementById('stat-restocked').textContent = totalRestocked;
            }
        } catch (e) {
            console.error('Failed to render dashboard stats:', e);
        }
    },

    async loadHistory() {
        try {
            this.invoices = await window.appDB.getAll('invoices');
            // Sort by date descending
            this.invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.renderHistory();
        } catch (e) {
            console.error(e);
        }
    },

    renderHistory(invoicesList = null) {
        const list = invoicesList || this.invoices;
        const tbody = document.getElementById('history-body');
        tbody.innerHTML = '';
        
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No saved invoices.</td></tr>';
            return;
        }

        list.forEach(inv => {
            const tr = document.createElement('tr');
            
            // Add class and data attributes for tooltip
            tr.classList.add('invoice-history-row');
            tr.dataset.invoiceDate = Utils.formatDate(inv.date);
            tr.dataset.invoiceNumber = inv.number;
            tr.dataset.invoiceCustomer = this.escapeHTML(inv.customer.name);
            tr.dataset.invoiceTotal = Utils.formatCurrency(inv.grandTotal);
            tr.dataset.invoiceItems = inv.items.length + ' item' + (inv.items.length !== 1 ? 's' : '');
            
            tr.innerHTML = `
                <td>${Utils.formatDate(inv.date)}</td>
                <td>${inv.number}</td>
                <td>${this.escapeHTML(inv.customer.name)}</td>
                <td><strong>${Utils.formatCurrency(inv.grandTotal)}</strong></td>
                <td>
                    <button class="btn btn-outline btn-sm view-invoice-btn" onclick="InvoiceManager.viewInvoice('${inv.id}')">View</button>
                    <button class="btn btn-outline btn-sm print-invoice-btn" onclick="InvoiceManager.printSavedInvoice('${inv.id}')">Print</button>
                    <button class="btn btn-danger btn-sm delete-invoice-btn" onclick="InvoiceManager.deleteInvoice('${inv.id}')">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    bindEvents() {
        // Toggle new invoice form
        document.getElementById('btn-new-invoice').addEventListener('click', () => {
            this.startNewInvoice();
        });

        document.getElementById('btn-cancel-invoice').addEventListener('click', () => {
            document.getElementById('invoice-editor').style.display = 'none';
            document.getElementById('invoice-history').style.display = 'block';
            document.getElementById('dashboard-stats').style.display = '';
            document.getElementById('btn-new-invoice').style.display = 'inline-flex';
        });

        // Add Item row
        document.getElementById('btn-add-item').addEventListener('click', () => {
            this.addLineItem();
        });

        // Invoice Discount change
        document.getElementById('inv-discount-total').addEventListener('input', () => {
            this.calculateTotals();
        });

        // Save Invoice
        document.getElementById('btn-save-invoice').addEventListener('click', () => {
            this.saveInvoice();
        });

        // Print Invoice in a new tab
        document.getElementById('btn-print-invoice').addEventListener('click', () => {
            this.printInvoiceInNewTab();
        });

        // Autocomplete click outside to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-dropdown') && !e.target.closest('.product-search-input')) {
                document.getElementById('autocomplete-dropdown').style.display = 'none';
            }
        });

        // History search
        const searchHistory = document.getElementById('search-history');
        if (searchHistory) {
            searchHistory.addEventListener('input', (e) => {
                const val = e.target.value.toLowerCase();
                const filtered = this.invoices.filter(inv => 
                    inv.number.toLowerCase().includes(val) || 
                    inv.customer.name.toLowerCase().includes(val)
                );
                this.renderHistory(filtered);
            });
        }
    },

    startNewInvoice() {
        this.currentItems = [];
        
        // Reset fields
        document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('inv-number').value = '';
        
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-phone').value = '';
        document.getElementById('cust-email').value = '';
        document.getElementById('cust-address').value = '';
        
        document.getElementById('inv-discount-total').value = 0;
        
        document.getElementById('invoice-items-body').innerHTML = '';
        
        // Add one empty row to start
        this.addLineItem();
        this.calculateTotals();

        // UI Toggle
        document.getElementById('invoice-editor').style.display = 'block';
        document.getElementById('invoice-history').style.display = 'none';
        document.getElementById('dashboard-stats').style.display = 'none';
        document.getElementById('btn-new-invoice').style.display = 'none';
    },

    addLineItem(data = null) {
        const tbody = document.getElementById('invoice-items-body');
        const rowId = 'row-' + Date.now() + Math.random().toString(36).substr(2, 5);
        
        const tr = document.createElement('tr');
        tr.id = rowId;
        
        tr.innerHTML = `
            <td data-label="Item" style="position:relative;">
                <input type="text" class="form-control product-search-input" placeholder="Type product name..." autocomplete="off">
                <input type="hidden" class="item-product-id">
            </td>
            <td data-label="Company"><input type="text" class="form-control item-company" placeholder="—" readonly tabindex="-1"></td>
            <td data-label="Variant"><input type="text" class="form-control item-variant" placeholder="—" readonly tabindex="-1"></td>
            <td data-label="Qty"><input type="number" class="form-control item-qty" value="1" min="1"></td>
            <td data-label="Stock at Billing" class="item-stock-billing">
                <span class="stock-value">—</span>
                <div class="row-low-stock-warning" style="display:none;"></div>
            </td>
            <td data-label="Price (₹)"><input type="number" class="form-control item-price" value="0" step="0.01" readonly tabindex="-1"></td>
            <td data-label="GST %"><input type="number" class="form-control item-gst" value="0" step="0.1" readonly tabindex="-1"></td>
            <td data-label="Discount (₹)"><input type="number" class="form-control item-discount" value="0" step="0.01" readonly tabindex="-1"></td>
            <td data-label="Total" class="item-total">₹0.00</td>
            <td class="no-print">
                <button class="btn btn-danger btn-sm" onclick="InvoiceManager.removeLineItem('${rowId}')">✕</button>
            </td>
        `;
        
        tbody.appendChild(tr);
        
        // Bind row events
        this.bindRowEvents(tr);

        if (data) {
            // Populate if viewing existing invoice
            tr.querySelector('.product-search-input').value = data.name || '';
            tr.querySelector('.item-product-id').value = data.productId || '';
            tr.querySelector('.item-company').value = data.company || '';
            tr.querySelector('.item-variant').value = data.variant || '';
            tr.querySelector('.item-qty').value = data.qty;
            tr.querySelector('.item-stock-billing').textContent = data.stockAtBilling != null ? data.stockAtBilling : '—';
            tr.querySelector('.item-price').value = data.price;
            tr.querySelector('.item-gst').value = data.gstPercent;
            tr.querySelector('.item-discount').value = data.discount;
            this.calculateRowTotal(tr);
        }
    },

    removeLineItem(rowId) {
        // Cancel any pending debounced stock toast for this row
        if (this._stockToastTimers[rowId]) {
            clearTimeout(this._stockToastTimers[rowId]);
            delete this._stockToastTimers[rowId];
        }
        const row = document.getElementById(rowId);
        if (row) {
            row.remove();
            this.calculateTotals();
        }
    },

    bindRowEvents(row) {
        const searchInput = row.querySelector('.product-search-input');
        const qtyInput = row.querySelector('.item-qty');
        const priceInput = row.querySelector('.item-price');
        const gstInput = row.querySelector('.item-gst');
        const discountInput = row.querySelector('.item-discount');

        // Autocomplete - grouped by product name, showing company/variant options
        searchInput.addEventListener('input', async (e) => {
            const val = e.target.value.toLowerCase().trim();
            const dropdown = document.getElementById('autocomplete-dropdown');
            
            if (val.length < 1) {
                dropdown.style.display = 'none';
                return;
            }

            // Get all products and filter (case-insensitive)
            const products = await window.appDB.getAll('products');
            const matches = products.filter(p => 
                p.name.toLowerCase().includes(val) || 
                (p.company && p.company.toLowerCase().includes(val)) ||
                (p.sizeUnit && p.sizeUnit.toLowerCase().includes(val))
            ).slice(0, 15);

            if (matches.length > 0) {
                dropdown.innerHTML = '';

                // Group by product name for clarity
                const grouped = {};
                matches.forEach(p => {
                    const key = p.name.toLowerCase();
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(p);
                });

                Object.keys(grouped).forEach(nameKey => {
                    const group = grouped[nameKey];
                    
                    // Product name header
                    const header = document.createElement('div');
                    header.className = 'autocomplete-group-header';
                    header.textContent = group[0].name;
                    dropdown.appendChild(header);

                    // Each company/variant combo under this product
                    group.forEach(p => {
                        const div = document.createElement('div');
                        div.className = 'autocomplete-item';
                        const stockLabel = p.stockQty <= 0
                            ? '<span class="text-error">Out of Stock</span>'
                            : p.stockQty <= p.lowStockThreshold
                                ? `<span class="text-warning">⚠ Low Stock: ${p.stockQty}</span>`
                                : `<span class="text-success">Stock: ${p.stockQty}</span>`;
                        
                        div.innerHTML = `
                            <div class="ac-row">
                                <span class="ac-company">${this.escapeHTML(p.company || 'No Company')}</span>
                                <span class="ac-variant">${this.escapeHTML(p.sizeUnit || 'No Variant')}</span>
                            </div>
                            <div class="ac-row-sub">
                                <span>₹${p.unitPrice}</span>
                                <span>GST ${p.gstPercent || 0}%</span>
                                <span>Disc ₹${p.defaultDiscount || 0}</span>
                                ${stockLabel}
                            </div>
                        `;
                        div.addEventListener('click', async () => {
                            // Auto-fill ALL fields from inventory
                            searchInput.value = p.name;
                            row.querySelector('.item-product-id').value = p.id;
                            row.querySelector('.item-company').value = p.company || '';
                            row.querySelector('.item-variant').value = p.sizeUnit || '';
                            priceInput.value = p.unitPrice;
                            gstInput.value = p.gstPercent || 0;
                            discountInput.value = p.defaultDiscount || 0;
                            dropdown.style.display = 'none';
                            this.calculateRowTotal(row);
                            this.calculateTotals();
                            // Check stock warning immediately with the default qty of 1
                            await this.checkRowStock(row);
                            // Also check low stock status
                            await this._updateRowLowStockIndicator(row);
                            // Move focus to qty so user can set quantity next
                            qtyInput.focus();
                            qtyInput.select();
                        });
                        dropdown.appendChild(div);
                    });
                });
                
                // Position dropdown near the search input
                const rect = searchInput.getBoundingClientRect();
                dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
                dropdown.style.left = (rect.left + window.scrollX) + 'px';
                dropdown.style.width = Math.max(rect.width, 350) + 'px';
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        });

        // When user clears the search field, also clear auto-filled fields and stock warnings
        searchInput.addEventListener('change', async () => {
            if (!searchInput.value.trim()) {
                const oldProductId = row.querySelector('.item-product-id').value;

                row.querySelector('.item-product-id').value = '';
                row.querySelector('.item-company').value = '';
                row.querySelector('.item-variant').value = '';
                priceInput.value = 0;
                gstInput.value = 0;
                discountInput.value = 0;
                this.calculateRowTotal(row);
                this.calculateTotals();

                // Clear stock warnings from this row
                this._clearRowWarnings(row);

                // If other rows still reference the old product, recalculate their warnings
                if (oldProductId) {
                    let otherRow = null;
                    document.querySelectorAll('#invoice-items-body tr').forEach(r => {
                        if (r.id !== row.id && r.querySelector('.item-product-id').value === oldProductId) {
                            otherRow = r;
                        }
                    });
                    if (otherRow) {
                        await this.checkRowStock(otherRow);
                    }
                }
            }
        });

        // Recalculate on qty change & check stock
        qtyInput.addEventListener('input', async () => {
            this.calculateRowTotal(row);
            this.calculateTotals();
            await this.checkRowStock(row);
        });
    },

    async checkRowStock(row) {
        const productId = row.querySelector('.item-product-id').value;
        if (!productId) return;

        const product = await window.appDB.get('products', productId);
        if (!product) return;

        // Compute total requested quantity for this product across ALL rows,
        // and collect all matching rows so we can update them together
        let totalRequested = 0;
        let rowCount = 0;
        const matchingRows = [];
        document.querySelectorAll('#invoice-items-body tr').forEach(r => {
            if (r.querySelector('.item-product-id').value === productId) {
                totalRequested += parseFloat(r.querySelector('.item-qty').value) || 0;
                rowCount++;
                matchingRows.push(r);
            }
        });

        // Clear any pending debounced toast for the triggering row only
        const triggerRowId = row.id;
        if (this._stockToastTimers[triggerRowId]) {
            clearTimeout(this._stockToastTimers[triggerRowId]);
            delete this._stockToastTimers[triggerRowId];
        }

        const isLow = totalRequested > product.stockQty;

        // Update ALL matching rows (red border + warning text + row highlight, or cleared)
        matchingRows.forEach(r => {
            // Remove any existing stock warning from this row
            const existingWarning = r.querySelector('.stock-warning');
            if (existingWarning) existingWarning.remove();

            if (isLow) {
                r.classList.add('row-stock-warning');
                r.querySelector('.item-qty').style.borderColor = 'var(--danger)';
                const warning = document.createElement('div');
                warning.className = 'stock-warning';
                warning.style.cssText = 'color: var(--danger); font-size: 0.75rem; margin-top: 4px;';
                if (rowCount > 1) {
                    warning.textContent = `Only ${product.stockQty} in stock! Total ${totalRequested} requested across ${rowCount} rows.`;
                } else {
                    warning.textContent = `Only ${product.stockQty} in stock!`;
                }
                r.querySelector('.item-qty').parentNode.appendChild(warning);
            } else {
                r.classList.remove('row-stock-warning');
                r.querySelector('.item-qty').style.borderColor = '';
            }
        });            // Debounce the toast — only fire after user stops typing for 800ms
        if (isLow) {
            this._stockToastTimers[triggerRowId] = setTimeout(() => {
                const msg = rowCount > 1
                    ? `That amount of "${product.name}" is not available. We have only ${product.stockQty} in stock and ${totalRequested} requested across ${rowCount} rows.`
                    : `That amount of "${product.name}" is not available. We have only ${product.stockQty} in stock.`;
                Utils.showToast(msg, "error");
                delete this._stockToastTimers[triggerRowId];
            }, 800);
        }
    },

    async _updateRowLowStockIndicator(row) {
        const productId = row.querySelector('.item-product-id').value;
        const warningEl = row.querySelector('.row-low-stock-warning');
        if (!productId || !warningEl) {
            if (warningEl) { warningEl.style.display = 'none'; warningEl.innerHTML = ''; }
            return;
        }

        const product = await window.appDB.get('products', productId);
        if (!product) {
            warningEl.style.display = 'none';
            warningEl.innerHTML = '';
            return;
        }

        const isLow = product.stockQty <= product.lowStockThreshold;
        
        // Add/remove low-stock / enough-stock classes on the row itself
        row.classList.toggle('invoice-row--low-stock', isLow);
        row.classList.toggle('invoice-row--enough-stock', !isLow && product.stockQty > product.lowStockThreshold);

        if (isLow) {
            const qtyInput = row.querySelector('.item-qty');
            const requestedQty = parseFloat(qtyInput?.value) || 1;
            const isInsufficient = requestedQty > product.stockQty;
            const status = product.stockQty <= 0 ? 'Out of Stock' : 'Low Stock';
            const statusClass = product.stockQty <= 0 ? 'text-error' : 'text-warning';

            warningEl.innerHTML = `
                <div class="low-stock-indicator">
                    <span class="low-stock-icon ${statusClass}">⚠️</span>
                    <span class="low-stock-msg ${statusClass}">
                        <strong>${status}:</strong> ${product.stockQty} remaining (threshold: ${product.lowStockThreshold})
                    </span>
                    <button class="btn-restock-inline btn btn-outline btn-sm">+ Restock</button>
                    <div class="quick-restock-panel" style="display:none;">
                        <div class="quick-restock-row">
                            <input type="number" class="quick-restock-qty form-control" value="10" min="1" style="width:60px;padding:0.3rem;">
                            <div class="restock-presets" style="display:inline-flex;gap:0.25rem;">
                                <button class="restock-preset-btn" data-qty="5">+5</button>
                                <button class="restock-preset-btn" data-qty="10">+10</button>
                                <button class="restock-preset-btn" data-qty="25">+25</button>
                            </div>
                            <button class="btn btn-secondary btn-sm btn-confirm-quick-restock" title="Confirm Restock">✓</button>
                            <button class="btn btn-outline btn-sm btn-cancel-quick-restock" title="Cancel">✕</button>
                        </div>
                        <div class="quick-restock-preview" style="font-size:0.75rem;color:var(--secondary);margin-top:0.25rem;"></div>
                    </div>
                </div>
            `;
            warningEl.style.display = 'block';

            // Bind events on the newly created elements
            this._bindQuickRestockEvents(row, warningEl, product);
        } else {
            warningEl.style.display = 'none';
            warningEl.innerHTML = '';
        }
    },

    _bindQuickRestockEvents(row, warningEl, product) {
        const restockBtn = warningEl.querySelector('.btn-restock-inline');
        const panel = warningEl.querySelector('.quick-restock-panel');
        const qtyInput = warningEl.querySelector('.quick-restock-qty');
        const confirmBtn = warningEl.querySelector('.btn-confirm-quick-restock');
        const cancelBtn = warningEl.querySelector('.btn-cancel-quick-restock');
        const previewEl = warningEl.querySelector('.quick-restock-preview');

        if (!restockBtn || !panel) return;

        // Toggle the restock panel
        const showPanel = (show) => {
            panel.style.display = show ? 'block' : 'none';
            if (show) {
                qtyInput.focus();
                qtyInput.select();
                this._updateQuickRestockPreview(qtyInput, previewEl);
            }
        };

        // Elements are brand new from innerHTML, so addEventListener is safe
        restockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showPanel(true);
        });

        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showPanel(false);
        });

        // Preset buttons
        panel.querySelectorAll('.restock-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const qty = parseInt(btn.dataset.qty, 10);
                if (!isNaN(qty) && qty > 0) {
                    qtyInput.value = qty;
                    this._updateQuickRestockPreview(qtyInput, previewEl);
                }
            });
        });

        // Manual input preview
        qtyInput.addEventListener('input', () => {
            this._updateQuickRestockPreview(qtyInput, previewEl);
        });

        // Enter key to confirm
        qtyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._confirmQuickRestock(row, product, qtyInput, panel, previewEl);
            }
        });

        // Confirm button
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._confirmQuickRestock(row, product, qtyInput, panel, previewEl);
        });
    },

    _updateQuickRestockPreview(qtyInput, previewEl) {
        const qty = parseInt(qtyInput.value, 10);
        if (isNaN(qty) || qty <= 0) {
            previewEl.textContent = '';
            return;
        }
        previewEl.textContent = `Will add +${qty} units`;
    },

    async _confirmQuickRestock(row, product, qtyInput, panel, previewEl) {
        const qty = parseInt(qtyInput.value, 10);
        if (isNaN(qty) || qty <= 0) {
            Utils.showToast('Enter a valid positive number.', 'error');
            return;
        }

        // Call the shared InventoryManager helper
        const result = await window.InventoryManager._applySingleRestock(product.id, null, qty);
        
        if (result.success) {
            panel.style.display = 'none';
            // Refresh the row's stock cell — product.stockQty is stale, so compute new value
            const stockCell = row.querySelector('.item-stock-billing .stock-value');
            const newStock = result.prod ? result.prod.stockQty : (product.stockQty + qty);
            if (stockCell) {
                stockCell.textContent = newStock;
            }
            // Update the passed-in product object for subsequent indicator calls
            product.stockQty = newStock;
            // Re-check indicators (checkRowStock handles display, then low stock check)
            await this.checkRowStock(row);
            await this._updateRowLowStockIndicator(row);
            // Refresh dashboard stats & inventory
            await this.renderDashboardStats();
            if (window.InventoryManager) {
                window.InventoryManager.loadInventory();
            }
            Utils.showToast(`Restocked +${qty} of "${product.name}"`, 'success');
        }
    },

    _clearRowWarnings(row) {
        // Cancel any pending debounced toast for this row
        if (this._stockToastTimers[row.id]) {
            clearTimeout(this._stockToastTimers[row.id]);
            delete this._stockToastTimers[row.id];
        }
        // Remove warning text element
        const existingWarning = row.querySelector('.stock-warning');
        if (existingWarning) existingWarning.remove();
        // Reset qty border
        const qtyInput = row.querySelector('.item-qty');
        if (qtyInput) qtyInput.style.borderColor = '';
        // Remove row highlight
        row.classList.remove('row-stock-warning');
        // Clear low stock indicator and remove class for hover glow
        const lowStockEl = row.querySelector('.row-low-stock-warning');
        if (lowStockEl) { lowStockEl.style.display = 'none'; lowStockEl.innerHTML = ''; }
        row.classList.remove('invoice-row--low-stock');
        row.classList.remove('invoice-row--enough-stock');
    },

    calculateRowTotal(row) {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const gstPercent = parseFloat(row.querySelector('.item-gst').value) || 0;
        const discount = parseFloat(row.querySelector('.item-discount').value) || 0;

        const baseTotal = qty * price;
        const afterDiscount = Math.max(0, baseTotal - discount);
        const gstAmount = afterDiscount * (gstPercent / 100);
        const finalTotal = afterDiscount + gstAmount;

        row.querySelector('.item-total').textContent = Utils.formatCurrency(finalTotal);
        
        // Store raw values in dataset for easy aggregation
        row.dataset.baseTotal = baseTotal;
        row.dataset.gstAmount = gstAmount;
        row.dataset.itemDiscount = discount;
        row.dataset.finalTotal = finalTotal;
    },

    calculateTotals() {
        let subtotal = 0;
        let totalGst = 0;
        let itemDiscount = 0;

        const rows = document.querySelectorAll('#invoice-items-body tr');
        rows.forEach(row => {
            if (row.dataset.baseTotal) {
                subtotal += parseFloat(row.dataset.baseTotal);
                totalGst += parseFloat(row.dataset.gstAmount);
                itemDiscount += parseFloat(row.dataset.itemDiscount);
            }
        });

        const invDiscount = parseFloat(document.getElementById('inv-discount-total').value) || 0;
        
        // Subtotal is sum of (qty*price)
        // Grand Total = Subtotal - itemDiscounts - invDiscount + totalGst
        const grandTotal = Math.max(0, subtotal - itemDiscount - invDiscount + totalGst);

        document.getElementById('summ-subtotal').textContent = Utils.formatCurrency(subtotal);
        document.getElementById('summ-gst').textContent = Utils.formatCurrency(totalGst);
        document.getElementById('summ-item-discount').textContent = '-' + Utils.formatCurrency(itemDiscount);
        document.getElementById('summ-inv-discount').textContent = '-' + Utils.formatCurrency(invDiscount);
        document.getElementById('summ-total').textContent = Utils.formatCurrency(grandTotal);
    },

    async saveInvoice() {
        const custName = document.getElementById('cust-name').value.trim();
        if (!custName) {
            Utils.showToast("Customer Name is required", "error");
            return;
        }

        // Validate items
        const rows = document.querySelectorAll('#invoice-items-body tr');
        const items = [];
        let valid = true;
        
        rows.forEach(row => {
            const nameInput = row.querySelector('.product-search-input').value.trim();
            const productId = row.querySelector('.item-product-id').value;
            const company = row.querySelector('.item-company').value.trim();
            const variant = row.querySelector('.item-variant').value.trim();
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            
            if (nameInput && qty > 0) {
                items.push({
                    name: nameInput,
                    productId: productId, // could be empty if free-text item
                    company: company,
                    variant: variant,
                    qty: qty,
                    price: price,
                    gstPercent: parseFloat(row.querySelector('.item-gst').value) || 0,
                    discount: parseFloat(row.querySelector('.item-discount').value) || 0,
                    total: parseFloat(row.dataset.finalTotal) || 0
                });
            }
        });

        if (items.length === 0) {
            Utils.showToast("Add at least one valid line item", "error");
            return;
        }

        // Generate Invoice Number if empty
        let invNumber = document.getElementById('inv-number').value.trim();
        if (!invNumber) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            const prefix = `NPHP-${dateStr}-`;
            const todays = this.invoices.filter(i => i.number.startsWith(prefix)).length;
            invNumber = prefix + String(todays + 1).padStart(3, '0');
        }

        // Collect Totals
        const grandTotalStr = document.getElementById('summ-total').textContent.replace(/[^\d.-]/g, '');

        const invoiceRecord = {
            id: Utils.generateUUID(),
            date: document.getElementById('inv-date').value,
            number: invNumber,
            customer: {
                name: custName,
                phone: document.getElementById('cust-phone').value,
                email: document.getElementById('cust-email').value,
                address: document.getElementById('cust-address').value
            },
            items: items,
            invDiscount: parseFloat(document.getElementById('inv-discount-total').value) || 0,
            grandTotal: parseFloat(grandTotalStr)
        };

        try {
            // --- Step 1: Aggregate quantities per productId (handles duplicate products across rows) ---
            const productQtys = {};
            const productNames = {};
            for (const item of items) {
                if (item.productId) {
                    productQtys[item.productId] = (productQtys[item.productId] || 0) + item.qty;
                    productNames[item.productId] = item.name;
                }
            }

            // --- Step 2: Validate total stock availability for each product & capture stock ---
            const productStock = {};
            for (const [productId, totalQty] of Object.entries(productQtys)) {
                const product = await window.appDB.get('products', productId);
                if (product) {
                    productStock[productId] = product.stockQty;
                    if (totalQty > product.stockQty) {
                        Utils.showToast(`That amount of "${productNames[productId]}" is not available. We have only ${product.stockQty} in stock.`, "error");
                        return;
                    }
                }
            }

            // Attach stockAtBilling to each item before saving
            for (const item of items) {
                if (item.productId && productStock[item.productId] !== undefined) {
                    item.stockAtBilling = productStock[item.productId];
                }
            }

            // Save Invoice
            await window.appDB.put('invoices', invoiceRecord);
            
            // --- Step 3: Deduct Stock for linked products, update last sold date & check low stock ---
            const lowStockItems = [];
            for (const [productId, totalQty] of Object.entries(productQtys)) {
                const product = await window.appDB.get('products', productId);
                if (product) {
                    product.stockQty -= totalQty;
                    product.lastSoldDate = invoiceRecord.date;
                    await window.appDB.put('products', product);
                    
                    // Record stock history entry
                    if (window.StockHistoryManager) {
                        window.StockHistoryManager.addEntry({
                            productId: product.id,
                            productName: product.name,
                            change: -totalQty,
                            remaining: product.stockQty,
                            date: invoiceRecord.date,
                            invoiceNumber: invoiceRecord.number,
                            type: 'sale'
                        });
                    }
                    
                    // Check if stock is now at or below threshold
                    if (product.stockQty <= product.lowStockThreshold) {
                        lowStockItems.push({ name: product.name, qty: product.stockQty });
                    }
                }
            }

            Utils.showToast("Invoice Saved & Stock Updated!", "success");

            // Show low stock warnings after the success toast
            if (lowStockItems.length > 0) {
                setTimeout(() => {
                    lowStockItems.forEach(item => {
                        const msg = item.qty <= 0
                            ? `Low Stock: "${item.name}" is now out of stock!`
                            : `Low Stock: Only ${item.qty} of "${item.name}" remaining!`;
                        Utils.showToast(msg, "warning");
                    });
                }, 500);
            }
            
            // Re-render inventory if it's cached/loaded
            if (window.InventoryManager) {
                window.InventoryManager.loadInventory();
            }

            // Go back to history
            document.getElementById('invoice-editor').style.display = 'none';
            document.getElementById('invoice-history').style.display = 'block';
            document.getElementById('dashboard-stats').style.display = '';
            document.getElementById('btn-new-invoice').style.display = 'inline-flex';
            await this.loadHistory();
            await this.renderDashboardStats();

        } catch (e) {
            console.error(e);
            Utils.showToast("Failed to save invoice", "error");
        }
    },
    
    async viewInvoice(id) {
        const inv = this.invoices.find(i => i.id === id);
        if (!inv) return;
        
        // This is a basic view - populate the editor but disable saving
        document.getElementById('inv-date').value = inv.date;
        document.getElementById('inv-number').value = inv.number;
        
        document.getElementById('cust-name').value = inv.customer.name;
        document.getElementById('cust-phone').value = inv.customer.phone;
        document.getElementById('cust-email').value = inv.customer.email;
        document.getElementById('cust-address').value = inv.customer.address;
        
        document.getElementById('inv-discount-total').value = inv.invDiscount || 0;
        
        const tbody = document.getElementById('invoice-items-body');
        tbody.innerHTML = '';
        
        inv.items.forEach(item => {
            // Format for addLineItem
            const rowData = {
                name: item.name,
                productId: item.productId,
                company: item.company || '',
                variant: item.variant || '',
                qty: item.qty,
                price: item.price,
                gstPercent: item.gstPercent,
                discount: item.discount,
                stockAtBilling: item.stockAtBilling
            };
            this.addLineItem(rowData);
        });
        
        this.calculateTotals();
        
        // Hide save button, show print and cancel
        document.getElementById('btn-save-invoice').style.display = 'none';
        
        // UI Toggle
        document.getElementById('invoice-editor').style.display = 'block';
        document.getElementById('invoice-history').style.display = 'none';
        document.getElementById('dashboard-stats').style.display = 'none';
        document.getElementById('btn-new-invoice').style.display = 'none';
    },

    async deleteInvoice(id) {
        if(!confirm("Delete this invoice? Stock will be restored.")) {
            return;
        }
        try {
            // Find the invoice first to get its items
            const inv = this.invoices.find(i => i.id === id);
            if (!inv) {
                Utils.showToast("Invoice not found", "error");
                return;
            }

            // Restore stock for each item that has a linked product
            for (const item of inv.items) {
                if (!item.productId) continue;

                const product = await window.appDB.get('products', item.productId);
                if (product) {
                    product.stockQty += item.qty;
                    await window.appDB.put('products', product);

                    // Record a restock history entry
                    if (window.StockHistoryManager) {
                        window.StockHistoryManager.addEntry({
                            productId: product.id,
                            productName: product.name,
                            change: +item.qty,  // positive = restocked
                            remaining: product.stockQty,
                            date: new Date().toISOString().split('T')[0],
                            invoiceNumber: inv.number,
                            type: 'restore'
                        });
                    }
                }
            }

            // Delete the invoice
            await window.appDB.delete('invoices', id);
            Utils.showToast("Invoice deleted — stock restored", "success");

            // Refresh views
            await this.loadHistory();
            await this.renderDashboardStats();
            if (window.InventoryManager) {
                window.InventoryManager.loadInventory();
            }
        } catch(e) {
            console.error(e);
            Utils.showToast("Failed to delete invoice", "error");
        }
    },

    printSavedInvoice(id) {
        const inv = this.invoices.find(i => i.id === id);
        if (!inv) {
            Utils.showToast("Invoice not found", "error");
            return;
        }
        this.printInvoiceInNewTab(inv);
    },

    printInvoiceInNewTab(invData = null) {
        let inv = invData;
        if (!inv) {
            // Read current invoice from billing form
            const custName = document.getElementById('cust-name').value.trim() || 'Valued Customer';
            const custPhone = document.getElementById('cust-phone').value.trim();
            const custEmail = document.getElementById('cust-email').value.trim();
            const custAddress = document.getElementById('cust-address').value.trim();
            const invDate = document.getElementById('inv-date').value || new Date().toISOString().split('T')[0];
            let invNumber = document.getElementById('inv-number').value.trim() || 'DRAFT';

            const rows = document.querySelectorAll('#invoice-items-body tr');
            const items = [];
            rows.forEach(row => {
                const nameInput = row.querySelector('.product-search-input').value.trim();
                if (nameInput) {
                    items.push({
                        name: nameInput,
                        company: row.querySelector('.item-company').value.trim(),
                        variant: row.querySelector('.item-variant').value.trim(),
                        qty: parseFloat(row.querySelector('.item-qty').value) || 0,
                        price: parseFloat(row.querySelector('.item-price').value) || 0,
                        gstPercent: parseFloat(row.querySelector('.item-gst').value) || 0,
                        discount: parseFloat(row.querySelector('.item-discount').value) || 0,
                        total: parseFloat(row.dataset.finalTotal) || 0
                    });
                }
            });

            if (items.length === 0) {
                Utils.showToast("Cannot print an empty invoice. Please add at least one line item.", "warning");
                return;
            }

            inv = {
                date: invDate,
                number: invNumber,
                customer: {
                    name: custName,
                    phone: custPhone,
                    email: custEmail,
                    address: custAddress
                },
                items: items,
                subtotal: document.getElementById('summ-subtotal').textContent,
                gst: document.getElementById('summ-gst').textContent,
                itemDiscount: document.getElementById('summ-item-discount').textContent,
                invDiscount: document.getElementById('summ-inv-discount').textContent,
                grandTotal: document.getElementById('summ-total').textContent
            };
        }

        const p = (window.ProfileManager && window.ProfileManager.profileData) || {};
        const shape = p.logoShape || 'banner';
        const showLogo = p.printLogo !== false && p.logo;

        // Build item rows HTML
        let itemsHtml = '';
        inv.items.forEach((item, index) => {
            const itemTotalStr = item.total !== undefined ? Utils.formatCurrency(item.total) : Utils.formatCurrency(item.qty * item.price);
            itemsHtml += `
                <tr>
                    <td style="text-align:center; color:#000;">${index + 1}</td>
                    <td style="color:#000;"><strong>${this.escapeHTML(item.name)}</strong></td>
                    <td style="color:#000;">${this.escapeHTML(item.company || '-')}</td>
                    <td style="color:#000;">${this.escapeHTML(item.variant || '-')}</td>
                    <td style="text-align:center; color:#000;">${item.qty}</td>
                    <td style="text-align:right; color:#000;">${Utils.formatCurrency(item.price)}</td>
                    <td style="text-align:center; color:#000;">${item.gstPercent || 0}%</td>
                    <td style="text-align:right; color:#000;">${item.discount ? Utils.formatCurrency(item.discount) : '-'}</td>
                    <td style="text-align:right; font-weight:600; color:#000;">${itemTotalStr}</td>
                </tr>
            `;
        });

        // Resolve summary totals
        const subtotal = inv.subtotal || Utils.formatCurrency(inv.items.reduce((s, i) => s + (i.qty * i.price), 0));
        const gst = inv.gst || Utils.formatCurrency(inv.items.reduce((s, i) => s + ((i.qty * i.price - (i.discount || 0)) * ((i.gstPercent || 0)/100)), 0));
        const itemDiscount = inv.itemDiscount || Utils.formatCurrency(inv.items.reduce((s, i) => s + (i.discount || 0), 0));
        const invDiscount = inv.invDiscount !== undefined ? (typeof inv.invDiscount === 'number' ? Utils.formatCurrency(inv.invDiscount) : inv.invDiscount) : '-₹0.00';
        const grandTotal = inv.grandTotal !== undefined ? (typeof inv.grandTotal === 'number' ? Utils.formatCurrency(inv.grandTotal) : inv.grandTotal) : subtotal;

        const logoHtml = showLogo ? `<img src="${p.logo}" class="logo-shape-${shape}" alt="Logo" style="max-height: 70px; width: auto; object-fit: contain; margin-bottom: 8px;">` : '';

        const printableHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice #${this.escapeHTML(inv.number)}</title>
    <style>
        @page {
            size: A4;
            margin: 5mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Inter', Arial, Helvetica, sans-serif;
            color: #000000 !important;
            background: #ffffff !important;
            padding: 16px;
            font-size: 12px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .invoice-card {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            color: #000000;
        }
        .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000000;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }
        .biz-info {
            max-width: 60%;
        }
        .biz-name {
            font-size: 22px;
            font-weight: 700;
            color: #000000 !important;
            margin-bottom: 4px;
        }
        .biz-sub {
            font-size: 11px;
            color: #111111 !important;
            line-height: 1.4;
        }
        .inv-title-block {
            text-align: right;
        }
        .inv-badge {
            font-size: 24px;
            font-weight: 800;
            color: #000000 !important;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .inv-meta-text {
            font-size: 12px;
            color: #111111 !important;
            margin-top: 4px;
        }
        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 16px;
        }
        .detail-box {
            border: 1px solid #bbbbbb;
            padding: 10px 12px;
            border-radius: 4px;
            background: #fafafa;
        }
        .detail-title {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #333333 !important;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
        }
        .detail-content {
            font-size: 12px;
            color: #000000 !important;
            line-height: 1.4;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        .items-table th {
            background-color: #f1f5f9;
            color: #000000 !important;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
            padding: 8px 6px;
            border: 1px solid #94a3b8;
        }
        .items-table td {
            padding: 8px 6px;
            border: 1px solid #cbd5e1;
            font-size: 11px;
            color: #000000 !important;
        }
        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 24px;
        }
        .totals-table {
            width: 300px;
            border-collapse: collapse;
        }
        .totals-table td {
            padding: 5px 8px;
            font-size: 12px;
            color: #000000 !important;
        }
        .totals-table tr.grand-row {
            font-weight: 700;
            font-size: 14px;
            border-top: 2px solid #000000;
            border-bottom: 2px solid #000000;
            background-color: #f8fafc;
        }
        .totals-table tr.grand-row td {
            padding: 8px;
            color: #000000 !important;
        }
        .invoice-footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #444444 !important;
            border-top: 1px solid #dddddd;
            padding-top: 12px;
        }
        .logo-shape-banner { max-width: 220px; max-height: 70px; object-fit: contain; }
        .logo-shape-circle { width: 70px; height: 70px; border-radius: 50%; object-fit: cover; }
        .logo-shape-square { width: 70px; height: 70px; border-radius: 6px; object-fit: cover; }

        @media print {
            body { padding: 0; }
            .invoice-card { max-width: 100%; border: none; }
        }
    </style>
</head>
<body>
    <div class="invoice-card">
        <div class="header-row">
            <div class="biz-info">
                ${logoHtml}
                <div class="biz-name">${this.escapeHTML(p.name || 'Ease Invoice')}</div>
                <div class="biz-sub">
                    ${p.address ? this.escapeHTML(p.address).replace(/\n/g, '<br>') : ''}<br>
                    ${p.phone ? 'Phone: ' + this.escapeHTML(p.phone) + '<br>' : ''}
                    ${p.gstin ? 'GSTIN: ' + this.escapeHTML(p.gstin) : ''}
                </div>
            </div>
            <div class="inv-title-block">
                <div class="inv-badge">TAX INVOICE</div>
                <div class="inv-meta-text"><strong>Invoice #:</strong> ${this.escapeHTML(inv.number)}</div>
                <div class="inv-meta-text"><strong>Date:</strong> ${Utils.formatDate(inv.date)}</div>
            </div>
        </div>

        <div class="details-grid">
            <div class="detail-box">
                <div class="detail-title">Billed To</div>
                <div class="detail-content">
                    <strong>${this.escapeHTML(inv.customer.name)}</strong><br>
                    ${inv.customer.phone ? 'Phone: ' + this.escapeHTML(inv.customer.phone) + '<br>' : ''}
                    ${inv.customer.email ? 'Email: ' + this.escapeHTML(inv.customer.email) + '<br>' : ''}
                    ${inv.customer.address ? this.escapeHTML(inv.customer.address) : ''}
                </div>
            </div>
            <div class="detail-box">
                <div class="detail-title">Invoice Details</div>
                <div class="detail-content">
                    <strong>Invoice #:</strong> ${this.escapeHTML(inv.number)}<br>
                    <strong>Invoice Date:</strong> ${Utils.formatDate(inv.date)}<br>
                    <strong>Status:</strong> Finalized
                </div>
            </div>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 35px;">#</th>
                    <th>Item Description</th>
                    <th style="width: 15%;">Company</th>
                    <th style="width: 12%;">Variant</th>
                    <th style="width: 50px; text-align: center;">Qty</th>
                    <th style="width: 80px; text-align: right;">Price</th>
                    <th style="width: 50px; text-align: center;">GST</th>
                    <th style="width: 70px; text-align: right;">Disc.</th>
                    <th style="width: 90px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div class="totals-section">
            <table class="totals-table">
                <tr>
                    <td>Subtotal:</td>
                    <td style="text-align: right;">${subtotal}</td>
                </tr>
                <tr>
                    <td>GST Amount:</td>
                    <td style="text-align: right;">${gst}</td>
                </tr>
                <tr>
                    <td>Item Discounts:</td>
                    <td style="text-align: right;">${itemDiscount}</td>
                </tr>
                <tr>
                    <td>Invoice Discount:</td>
                    <td style="text-align: right;">${invDiscount}</td>
                </tr>
                <tr class="grand-row">
                    <td>Grand Total:</td>
                    <td style="text-align: right;">${grandTotal}</td>
                </tr>
            </table>
        </div>

        <div class="invoice-footer">
            Thank you for your business!
        </div>
    </div>

    <script>
        window.addEventListener('load', function() {
            setTimeout(function() {
                window.print();
            }, 300);
        });
    </script>
</body>
</html>`;

        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.open();
            printWin.document.write(printableHTML);
            printWin.document.close();
            printWin.focus();
        } else {
            Utils.showToast("Pop-up blocked! Please allow pop-ups for this site to open the print tab.", "warning");
        }
    },

    preparePrint() {
        // Legacy fallback
    },

    escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
};

window.InvoiceManager = InvoiceManager;
