// invoice.js - Invoice Builder & Logic

const InvoiceManager = {
    currentItems: [],
    invoices: [],
    
    async init() {
        this.bindEvents();
        await this.loadHistory();
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
            tr.querySelector('.item-price').value = data.price;
            tr.querySelector('.item-gst').value = data.gstPercent;
            tr.querySelector('.item-discount').value = data.discount;
            this.calculateRowTotal(tr);
        }
    },

    removeLineItem(rowId) {
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
                        div.addEventListener('click', () => {
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

        // When user clears the search field, also clear auto-filled fields
        searchInput.addEventListener('change', () => {
            if (!searchInput.value.trim()) {
                row.querySelector('.item-product-id').value = '';
                row.querySelector('.item-company').value = '';
                row.querySelector('.item-variant').value = '';
                priceInput.value = 0;
                gstInput.value = 0;
                discountInput.value = 0;
                this.calculateRowTotal(row);
                this.calculateTotals();
            }
        });

        // Recalculate on qty change
        qtyInput.addEventListener('input', () => {
            this.calculateRowTotal(row);
            this.calculateTotals();
        });
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
            // Save Invoice
            await window.appDB.put('invoices', invoiceRecord);
            
            // Deduct Stock for linked products
            for (const item of items) {
                if (item.productId) {
                    const product = await window.appDB.get('products', item.productId);
                    if (product) {
                        product.stockQty -= item.qty;
                        await window.appDB.put('products', product);
                    }
                }
            }

            Utils.showToast("Invoice Saved & Stock Updated!", "success");
            
            // Re-render inventory if it's cached/loaded
            if (window.InventoryManager) {
                window.InventoryManager.loadInventory();
            }

            // Go back to history
            document.getElementById('invoice-editor').style.display = 'none';
            document.getElementById('invoice-history').style.display = 'block';
            document.getElementById('btn-new-invoice').style.display = 'inline-flex';
            await this.loadHistory();

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
                discount: item.discount
            };
            this.addLineItem(rowData);
        });
        
        this.calculateTotals();
        
        // Hide save button, show print and cancel
        document.getElementById('btn-save-invoice').style.display = 'none';
        
        // UI Toggle
        document.getElementById('invoice-editor').style.display = 'block';
        document.getElementById('invoice-history').style.display = 'none';
        document.getElementById('btn-new-invoice').style.display = 'none';
    },

    async deleteInvoice(id) {
        if(confirm("Delete this invoice? This will NOT restore inventory stock.")) {
            try {
                await window.appDB.delete('invoices', id);
                Utils.showToast("Invoice deleted");
                await this.loadHistory();
            } catch(e) {
                Utils.showToast("Failed to delete invoice", "error");
            }
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
