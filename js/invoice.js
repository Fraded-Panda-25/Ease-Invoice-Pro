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
            const lowStockEl = document.getElementById('stat-low-stock');
            lowStockEl.textContent = lowStockCount;
            lowStockEl.style.color = lowStockCount > 0 ? 'var(--danger)' : 'var(--secondary)';

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
            tr.innerHTML = `
                <td>${Utils.formatDate(inv.date)}</td>
                <td>${inv.number}</td>
                <td>${this.escapeHTML(inv.customer.name)}</td>
                <td><strong>${Utils.formatCurrency(inv.grandTotal)}</strong></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="InvoiceManager.viewInvoice('${inv.id}')">View</button>
                    <button class="btn btn-danger btn-sm" onclick="InvoiceManager.deleteInvoice('${inv.id}')">Del</button>
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

        // Print Invoice
        document.getElementById('btn-print-invoice').addEventListener('click', () => {
            this.preparePrint();
            window.print();
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
            <td data-label="Stock at Billing" class="item-stock-billing">—</td>
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

    preparePrint() {
        // Populate the print-only header with profile details
        const header = document.getElementById('print-header');
        const p = window.ProfileManager.profileData;
        const shape = p.logoShape || 'banner';
        
        header.innerHTML = `
            ${p.logo ? `<img src="${p.logo}" class="logo-shape-${shape}" alt="Logo">` : ''}
            <h1>${this.escapeHTML(p.name)}</h1>
            <p>${this.escapeHTML(p.address).replace(/\n/g, '<br>')}</p>
            ${p.phone ? `<p>Phone: ${this.escapeHTML(p.phone)}</p>` : ''}
            ${p.gstin ? `<p>GSTIN: ${this.escapeHTML(p.gstin)}</p>` : ''}
        `;
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
