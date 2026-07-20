// inventory.js - Inventory Management

const InventoryManager = {
    products: [],
    _historyPage: 1,
    _historyPageSize: 20,

    async init() {
        this.bindEvents();
        // Close stock history modal when clicking outside the card
        document.getElementById('stock-history-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                e.currentTarget.style.display = 'none';
                document.getElementById('btn-download-dropdown-menu').style.display = 'none';
            }
        });
        // Close low stock modal when clicking outside the card
        document.getElementById('low-stock-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                e.currentTarget.style.display = 'none';
                this._resetBulkSelection();
                document.getElementById('bulk-restock-panel').style.display = 'none';
            }
        });
        // Close modals, dropdowns on Escape key (single consolidated handler)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('stock-history-modal').style.display = 'none';
        document.getElementById('low-stock-modal').style.display = 'none';
        document.getElementById('btn-download-dropdown-menu').style.display = 'none';
        // Clean up restock state
        document.getElementById('inline-restock-panel').style.display = 'none';
        document.getElementById('inventory-restock-panel').style.display = 'none';
        this._restockProductId = null;
        // Clean up bulk restock state
                document.getElementById('bulk-restock-panel').style.display = 'none';
                this._resetBulkSelection();
            }
        });
        await this.loadInventory();
    },

    async loadInventory() {
        try {
            this.products = await window.appDB.getAll('products');
            this.renderTable(this.products);
            // Hide inventory restock panel when reloading
            document.getElementById('inventory-restock-panel').style.display = 'none';
        } catch (e) {
            console.error(e);
            Utils.showToast("Failed to load inventory", "error");
        }
    },

    renderTable(dataList) {
        const tbody = document.getElementById('inventory-body');
        tbody.innerHTML = '';

        if (dataList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No products found.</td></tr>';
            return;
        }

        dataList.forEach(prod => {
            const tr = document.createElement('tr');
            
            // Stock logic
            const isLowStock = prod.stockQty <= prod.lowStockThreshold;
            const stockBadgeClass = isLowStock ? 'badge badge-danger' : 'badge badge-success';
            
            // Add data attributes for tooltip
            tr.dataset.productName = this.escapeHTML(prod.name);
            tr.dataset.productCompany = this.escapeHTML(prod.company || '-');
            tr.dataset.productVariant = this.escapeHTML(prod.sizeUnit || '-');
            tr.dataset.productPrice = Utils.formatCurrency(prod.unitPrice);
            tr.dataset.productStock = prod.stockQty;
            tr.dataset.productGst = prod.gstPercent || 0;
            tr.dataset.productDiscount = Utils.formatCurrency(prod.defaultDiscount || 0);
            tr.dataset.productThreshold = prod.lowStockThreshold;
            tr.classList.add('inventory-row');
            
            tr.innerHTML = `
                <td>
                    <strong>${this.escapeHTML(prod.name)}</strong>
                    ${isLowStock ? '<span style="color:var(--danger); font-size:0.75rem; display:block;">Low Stock</span>' : ''}
                </td>
                <td>${this.escapeHTML(prod.company || '-')}</td>
                <td>${this.escapeHTML(prod.sizeUnit || '-')}</td>
                <td>${Utils.formatCurrency(prod.unitPrice)}</td>
                <td><span class="${stockBadgeClass}">${prod.stockQty}</span></td>
                <td>${prod.lastSoldDate ? Utils.formatDate(prod.lastSoldDate) : '<span class="text-muted">Never</span>'}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="InventoryManager.editProduct('${prod.id}')">Edit</button>
                    <button class="btn btn-outline btn-sm" onclick="InventoryManager.showHistory('${prod.id}')">📋</button>
                    <button class="btn btn-secondary btn-sm" onclick="InventoryManager.showInventoryRestock('${prod.id}')">+ Restock</button>
                    <button class="btn btn-danger btn-sm" onclick="InventoryManager.deleteProduct('${prod.id}')">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    bindEvents() {
        // Toggle Form
        document.getElementById('btn-add-product').addEventListener('click', () => {
            document.getElementById('form-product').reset();
            document.getElementById('prod-id').value = '';
            document.getElementById('product-form-title').textContent = 'Add New Product';
            document.getElementById('product-editor').style.display = 'block';
        });

        document.getElementById('btn-cancel-product').addEventListener('click', () => {
            document.getElementById('product-editor').style.display = 'none';
        });

        // Search functionality
        document.getElementById('search-inventory').addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = this.products.filter(p => 
                p.name.toLowerCase().includes(term) ||
                (p.company && p.company.toLowerCase().includes(term)) ||
                (p.sizeUnit && p.sizeUnit.toLowerCase().includes(term))
            );
            this.renderTable(filtered);
        });

        // Form Submit
        document.getElementById('form-product').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProduct();
        });

        // Stock history filters
        document.getElementById('filter-history-from').addEventListener('change', () => {
            this._applyHistoryFilter();
        });
        document.getElementById('filter-history-to').addEventListener('change', () => {
            this._applyHistoryFilter();
        });
        document.getElementById('filter-history-type').addEventListener('change', () => {
            this._applyHistoryFilter();
        });
        document.getElementById('btn-clear-history-filter').addEventListener('click', () => {
            document.getElementById('filter-history-from').value = '';
            document.getElementById('filter-history-to').value = '';
            document.getElementById('filter-history-type').value = '';
            this._applyHistoryFilter();
        });
        // Download dropdown toggle
        document.getElementById('btn-download-dropdown-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('btn-download-dropdown-menu');
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#download-dropdown')) {
                document.getElementById('btn-download-dropdown-menu').style.display = 'none';
            }
        });

        // Export buttons
        document.getElementById('btn-export-history-csv').addEventListener('click', () => {
            document.getElementById('btn-download-dropdown-menu').style.display = 'none';
            this._exportHistoryCSV();
        });
        document.getElementById('btn-export-history-xlsx').addEventListener('click', () => {
            document.getElementById('btn-download-dropdown-menu').style.display = 'none';
            this._exportHistoryXLSX();
        });
        document.getElementById('btn-export-history-pdf').addEventListener('click', () => {
            document.getElementById('btn-download-dropdown-menu').style.display = 'none';
            this._exportHistoryPDF();
        });
        document.getElementById('btn-export-history-svg').addEventListener('click', () => {
            document.getElementById('btn-download-dropdown-menu').style.display = 'none';
            this._exportHistorySVG();
        });
    },

    async saveProduct() {
        const idInput = document.getElementById('prod-id').value;
        const isNew = !idInput;
        
        const product = {
            id: isNew ? Utils.generateUUID() : idInput,
            name: document.getElementById('prod-name').value,
            company: document.getElementById('prod-company').value,
            sizeUnit: document.getElementById('prod-variant').value,
            unitPrice: parseFloat(document.getElementById('prod-price').value) || 0,
            gstPercent: parseFloat(document.getElementById('prod-gst').value) || 0,
            defaultDiscount: parseFloat(document.getElementById('prod-discount').value) || 0,
            stockQty: parseInt(document.getElementById('prod-stock').value) || 0,
            lowStockThreshold: parseInt(document.getElementById('prod-threshold').value) || 0
        };

        try {
            await window.appDB.put('products', product);
            Utils.showToast(isNew ? "Product added" : "Product updated");
            document.getElementById('product-editor').style.display = 'none';
            document.getElementById('form-product').reset();
            await this.loadInventory();
        } catch (e) {
            console.error(e);
            Utils.showToast("Failed to save product", "error");
        }
    },

    async editProduct(id) {
        try {
            const prod = await window.appDB.get('products', id);
            if (prod) {
                document.getElementById('prod-id').value = prod.id;
                document.getElementById('prod-name').value = prod.name;
                document.getElementById('prod-company').value = prod.company;
                document.getElementById('prod-variant').value = prod.sizeUnit;
                document.getElementById('prod-price').value = prod.unitPrice;
                document.getElementById('prod-gst').value = prod.gstPercent || 0;
                document.getElementById('prod-discount').value = prod.defaultDiscount || 0;
                document.getElementById('prod-stock').value = prod.stockQty;
                document.getElementById('prod-threshold').value = prod.lowStockThreshold;

                document.getElementById('product-form-title').textContent = 'Edit Product';
                document.getElementById('product-editor').style.display = 'block';
                // Scroll to top
                document.getElementById('view-inventory').scrollIntoView({ behavior: 'smooth' });
            }
        } catch (e) {
            Utils.showToast("Failed to load product details", "error");
        }
    },

    async deleteProduct(id) {
        if (confirm("Are you sure you want to delete this product?")) {
            try {
                await window.appDB.delete('products', id);
                Utils.showToast("Product deleted");
                await this.loadInventory();
            } catch (e) {
                Utils.showToast("Failed to delete product", "error");
            }
        }
    },

    showInventoryRestock(productId) {
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        this._restockProductId = productId;

        document.getElementById('inv-restock-product-name').textContent = prod.name;
        document.getElementById('inv-restock-current-stock').textContent = prod.stockQty;

        const qtyInput = document.getElementById('inv-restock-qty-input');
        qtyInput.value = 10;
        qtyInput.focus();
        qtyInput.select();

        this._updateRestockPreview(prod.stockQty, 10);

        document.getElementById('inventory-restock-panel').style.display = 'block';

        // Bind events (only once)
        if (!this._invRestockEventsBound) {
            document.getElementById('btn-cancel-inv-restock').addEventListener('click', () => {
                document.getElementById('inventory-restock-panel').style.display = 'none';
                this._restockProductId = null;
            });

            document.getElementById('btn-confirm-inv-restock').addEventListener('click', () => this._confirmInventoryRestock());

            const qtyInputEl = document.getElementById('inv-restock-qty-input');
            qtyInputEl.addEventListener('input', () => {
                const p = this.products.find(x => x.id === this._restockProductId);
                if (p) {
                    const qty = parseInt(qtyInputEl.value, 10);
                    if (!isNaN(qty) && qty > 0) {
                        this._updateRestockPreview(p.stockQty, qty);
                    }
                }
            });
            qtyInputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._confirmInventoryRestock();
                }
            });

            // Preset buttons for inventory restock
            document.querySelectorAll('#inventory-restock-panel .restock-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const qty = parseInt(btn.dataset.qty, 10);
                    if (!isNaN(qty) && qty > 0) {
                        qtyInputEl.value = qty;
                        qtyInputEl.dispatchEvent(new Event('input'));
                    }
                });
            });

            this._invRestockEventsBound = true;
        }
    },

    async _confirmInventoryRestock() {
        const productId = this._restockProductId;
        if (!productId) return;

        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        const qtyInput = document.getElementById('inv-restock-qty-input');
        const qty = parseInt(qtyInput.value, 10);
        if (isNaN(qty) || qty <= 0) {
            Utils.showToast('Enter a valid positive number.', 'error');
            return;
        }

        try {
            prod.stockQty += qty;
            await window.appDB.put('products', prod);

            if (window.StockHistoryManager) {
                window.StockHistoryManager.addEntry({
                    productId: prod.id,
                    productName: prod.name,
                    change: qty,
                    remaining: prod.stockQty,
                    date: new Date().toISOString().split('T')[0],
                    invoiceNumber: '',
                    type: 'restock'
                });
            }

            Utils.showToast(`Restocked +${qty} of "${prod.name}". Now ${prod.stockQty} in stock.`, 'success');

            document.getElementById('inventory-restock-panel').style.display = 'none';
            this._restockProductId = null;
            await this.loadInventory();
        } catch (e) {
            console.error('Failed to restock:', e);
            Utils.showToast('Failed to restock product.', 'error');
        }
    },

    async showHistory(productId) {
        try {
            const prod = this.products.find(p => p.id === productId);
            if (!prod) return;

            const entries = await window.StockHistoryManager.getHistoryForProduct(productId);
            const modal = document.getElementById('stock-history-modal');
            const title = modal.querySelector('.modal-title');

            title.textContent = `Stock History — ${this.escapeHTML(prod.name)}`;

            // Store all entries for filtering and render them (single product mode)
            this._historyShowProduct = false;
            this._historyEntries = entries;

            // Only reset filters when opening the modal fresh, not when switching products
            if (modal.style.display === 'none' || !modal.style.display) {
                document.getElementById('filter-history-from').value = '';
                document.getElementById('filter-history-to').value = '';
                document.getElementById('filter-history-type').value = '';
            }

            // Apply the current filter (or show all if filters are empty)
            this._applyHistoryFilter();

            modal.style.display = 'flex';
        } catch (e) {
            console.error('Failed to load stock history:', e);
            Utils.showToast('Failed to load stock history', 'error');
        }
    },

    async showLowStockItems() {
        try {
            // Ensure inventory data is fresh
            await this.loadInventory();
            const lowStockProducts = this.products.filter(p => p.stockQty <= p.lowStockThreshold);
            
            const modal = document.getElementById('low-stock-modal');
            const tbody = document.getElementById('low-stock-body');
            const countEl = document.getElementById('low-stock-count');
            
            countEl.textContent = lowStockProducts.length;
            tbody.innerHTML = '';
            
            // Reset bulk selection
            this._bulkSelectedIds = [];
            document.getElementById('bulk-restock-panel').style.display = 'none';
            const selectAllCb = document.getElementById('bulk-select-all');
            if (selectAllCb) selectAllCb.checked = false;
            
            if (lowStockProducts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">🎉 No low stock items! All products are well stocked.</td></tr>';
            } else {
                lowStockProducts.forEach(prod => {
                    const tr = document.createElement('tr');
                    tr.classList.add('low-stock-row');
                    tr.dataset.productId = prod.id;
                    
                    const isOut = prod.stockQty <= 0;
                    const badgeClass = isOut ? 'badge badge-danger' : 'badge badge-warning';
                    const statusText = isOut ? 'Out of Stock' : `${prod.stockQty} / ${prod.lowStockThreshold}`;
                    
                    tr.innerHTML = `
                        <td><input type="checkbox" class="low-stock-checkbox" data-id="${prod.id}" title="Select for bulk restock"></td>
                        <td><strong>${this.escapeHTML(prod.name)}</strong></td>
                        <td>${this.escapeHTML(prod.company || '-')}</td>
                        <td>${Utils.formatCurrency(prod.unitPrice)}</td>
                        <td><span class="${badgeClass}">${statusText}</span></td>
                        <td>
                            <div class="low-stock-actions">
                                <button class="btn btn-secondary btn-sm" onclick="InventoryManager.restockFromLowStock('${prod.id}')">+ Restock</button>
                                <button class="btn btn-outline btn-sm" onclick="InventoryManager.editFromLowStock('${prod.id}')">Edit</button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
                
                // Bind checkbox events
                this._bindBulkCheckboxes();
            }
            
            modal.style.display = 'flex';
        } catch (e) {
            console.error('Failed to load low stock items:', e);
            Utils.showToast('Failed to load low stock items', 'error');
        }
    },

    _bindBulkCheckboxes() {
        // Initialize selection array
        this._bulkSelectedIds = this._bulkSelectedIds || [];

        // Use event delegation on tbody for individual checkboxes (no duplicate listeners)
        const tbody = document.getElementById('low-stock-body');
        if (!this._bulkTbodyDelegated) {
            tbody.addEventListener('change', (e) => {
                if (e.target.classList.contains('low-stock-checkbox')) {
                    const id = e.target.dataset.id;
                    if (e.target.checked) {
                        if (!this._bulkSelectedIds.includes(id)) {
                            this._bulkSelectedIds.push(id);
                        }
                        e.target.closest('tr').classList.add('selected');
                    } else {
                        this._bulkSelectedIds = this._bulkSelectedIds.filter(x => x !== id);
                        e.target.closest('tr').classList.remove('selected');
                    }
                    this._syncSelectAllState();
                    this._updateBulkPanel();
                }
            });
            this._bulkTbodyDelegated = true;
        }

        // Select all checkbox
        const selectAllCb = document.getElementById('bulk-select-all');
        if (selectAllCb && !this._bulkSelectAllBound) {
            selectAllCb.addEventListener('change', (e) => {
                const checked = e.target.checked;
                document.querySelectorAll('.low-stock-checkbox').forEach(cb => {
                    cb.checked = checked;
                    const id = cb.dataset.id;
                    const row = cb.closest('tr');
                    if (checked) {
                        if (!this._bulkSelectedIds.includes(id)) this._bulkSelectedIds.push(id);
                        if (row) row.classList.add('selected');
                    } else {
                        this._bulkSelectedIds = [];
                        if (row) row.classList.remove('selected');
                    }
                });
                this._updateBulkPanel();
            });
            this._bulkSelectAllBound = true;
        }            // Bulk restock panel event bindings (only once)
            if (!this._bulkRestockEventsBound) {
                document.getElementById('btn-cancel-bulk-restock').addEventListener('click', () => {
                    this._resetBulkSelection();
                    document.getElementById('bulk-restock-panel').style.display = 'none';
                });

                document.getElementById('btn-confirm-bulk-restock').addEventListener('click', () => {
                    this._confirmBulkRestock();
                });

                document.getElementById('bulk-restock-qty-input').addEventListener('input', () => {
                    this._updateBulkPreview();
                });

                document.getElementById('bulk-restock-qty-input').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this._confirmBulkRestock();
                    }
                });

                // Bind preset buttons for bulk restock panel
                document.querySelectorAll('#bulk-restock-panel .restock-preset-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const qty = parseInt(btn.dataset.qty, 10);
                        if (!isNaN(qty) && qty > 0) {
                            document.getElementById('bulk-restock-qty-input').value = qty;
                            document.getElementById('bulk-restock-qty-input').dispatchEvent(new Event('input'));
                        }
                    });
                });

                this._bulkRestockEventsBound = true;
            }
    },

    _resetBulkSelection() {
        this._bulkSelectedIds = [];
        document.querySelectorAll('.low-stock-checkbox').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('.low-stock-row.selected').forEach(r => r.classList.remove('selected'));
        const selectAllCb = document.getElementById('bulk-select-all');
        if (selectAllCb) selectAllCb.checked = false;
    },

    _syncSelectAllState() {
        const allCbs = document.querySelectorAll('.low-stock-checkbox');
        const selectAllCb = document.getElementById('bulk-select-all');
        if (!selectAllCb || allCbs.length === 0) return;
        const allChecked = [...allCbs].every(cb => cb.checked);
        selectAllCb.checked = allChecked;
    },

    _updateBulkPanel() {
        const panel = document.getElementById('bulk-restock-panel');
        const countEl = document.getElementById('bulk-selected-count');
        const count = this._bulkSelectedIds ? this._bulkSelectedIds.length : 0;
        countEl.textContent = count;

        if (count > 0) {
            panel.style.display = 'block';
            this._updateBulkPreview();
            this._renderBulkItemsList();
        } else {
            panel.style.display = 'none';
        }
    },

    _updateBulkPreview() {
        const qtyInput = document.getElementById('bulk-restock-qty-input');
        const qty = parseInt(qtyInput.value, 10);
        const previewEl = document.getElementById('bulk-restock-preview');
        const count = this._bulkSelectedIds ? this._bulkSelectedIds.length : 0;

        if (isNaN(qty) || qty <= 0 || count === 0) {
            previewEl.textContent = '';
            return;
        }

        const totalUnits = qty * count;
        previewEl.textContent = `Adding ${qty} × ${count} items = ${totalUnits} total units across ${count} products`;
    },

    _renderBulkItemsList() {
        const container = document.getElementById('bulk-restock-items');
        container.innerHTML = '';

        if (!this._bulkSelectedIds) return;

        this._bulkSelectedIds.forEach(id => {
            const prod = this.products.find(p => p.id === id);
            if (prod) {
                const chip = document.createElement('span');
                chip.className = 'bulk-restock-item-chip';
                chip.textContent = prod.name;
                container.appendChild(chip);
            }
        });
    },

    async _confirmBulkRestock() {
        const ids = this._bulkSelectedIds;
        if (!ids || ids.length === 0) {
            Utils.showToast('No items selected for bulk restock.', 'error');
            return;
        }

        const qtyInput = document.getElementById('bulk-restock-qty-input');
        const qty = parseInt(qtyInput.value, 10);
        if (isNaN(qty) || qty <= 0) {
            Utils.showToast('Enter a valid positive number.', 'error');
            return;
        }

        let restockedCount = 0;
        const errors = [];

        for (const id of ids) {
            const prod = this.products.find(p => p.id === id);
            if (!prod) {
                errors.push(id);
                continue;
            }

            try {
                prod.stockQty += qty;
                await window.appDB.put('products', prod);

                if (window.StockHistoryManager) {
                    window.StockHistoryManager.addEntry({
                        productId: prod.id,
                        productName: prod.name,
                        change: qty,
                        remaining: prod.stockQty,
                        date: new Date().toISOString().split('T')[0],
                        invoiceNumber: '',
                        type: 'restock'
                    });
                }

                restockedCount++;
            } catch (e) {
                console.error('Failed to restock:', prod.name, e);
                errors.push(prod.name);
            }
        }

        // Hide bulk panel and reset
        document.getElementById('bulk-restock-panel').style.display = 'none';
        this._bulkSelectedIds = [];
        document.querySelectorAll('.low-stock-checkbox').forEach(cb => { cb.checked = false; });
        document.querySelectorAll('.low-stock-row.selected').forEach(r => r.classList.remove('selected'));
        const selectAllCb = document.getElementById('bulk-select-all');
        if (selectAllCb) selectAllCb.checked = false;

        if (errors.length > 0) {
            Utils.showToast(`Restocked ${restockedCount} items. ${errors.length} failed.`, 'warning');
        } else {
            Utils.showToast(`Successfully restocked ${restockedCount} items with +${qty} each!`, 'success');
        }

        await this.loadInventory();
        this.showLowStockItems();
    },

    restockFromLowStock(productId) {
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        // Store the product being restocked
        this._restockProductId = productId;

        // Populate the inline restock panel
        document.getElementById('restock-product-name').textContent = prod.name;
        document.getElementById('restock-current-stock').textContent = prod.stockQty;
        document.getElementById('restock-threshold').textContent = prod.lowStockThreshold;
        
        const qtyInput = document.getElementById('restock-qty-input');
        qtyInput.value = 10;
        qtyInput.focus();
        qtyInput.select();

        // Show preview
        this._updateRestockPreview(prod.stockQty, 10);

        // Show the inline panel
        document.getElementById('inline-restock-panel').style.display = 'block';            // Bind events (only once using a flag)
            if (!this._restockEventsBound) {
                document.getElementById('btn-cancel-restock').addEventListener('click', () => {
                    document.getElementById('inline-restock-panel').style.display = 'none';
                    this._restockProductId = null;
                });

                document.getElementById('btn-confirm-restock').addEventListener('click', () => this._confirmInlineRestock());

                qtyInput.addEventListener('input', () => {
                    const prod = this.products.find(p => p.id === this._restockProductId);
                    if (prod) {
                        const qty = parseInt(qtyInput.value, 10);
                        if (!isNaN(qty) && qty > 0) {
                            this._updateRestockPreview(prod.stockQty, qty);
                        }
                    }
                });
                qtyInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this._confirmInlineRestock();
                    }
                });
                this._restockEventsBound = true;
            }

            // Bind preset buttons for inline restock (low stock modal)
            if (!this._restockPresetsBound) {
                document.querySelectorAll('#inline-restock-panel .restock-preset-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const qty = parseInt(btn.dataset.qty, 10);
                        if (!isNaN(qty) && qty > 0) {
                            qtyInput.value = qty;
                            qtyInput.dispatchEvent(new Event('input'));
                        }
                    });
                });
                this._restockPresetsBound = true;
            }
    },

    _updateRestockPreview(currentStock, qty) {
        const previewEl = document.getElementById('restock-preview');
        if (isNaN(qty) || qty <= 0) {
            previewEl.textContent = '';
            return;
        }
        const newTotal = currentStock + qty;
        previewEl.textContent = `New stock will be: ${currentStock} + ${qty} = ${newTotal}`;
    },

    async _confirmInlineRestock() {
        const productId = this._restockProductId;
        if (!productId) return;

        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        const qtyInput = document.getElementById('restock-qty-input');
        const qty = parseInt(qtyInput.value, 10);
        if (isNaN(qty) || qty <= 0) {
            Utils.showToast('Enter a valid positive number.', 'error');
            return;
        }

        try {
            prod.stockQty += qty;
            await window.appDB.put('products', prod);

            if (window.StockHistoryManager) {
                window.StockHistoryManager.addEntry({
                    productId: prod.id,
                    productName: prod.name,
                    change: qty,
                    remaining: prod.stockQty,
                    date: new Date().toISOString().split('T')[0],
                    invoiceNumber: '',
                    type: 'restock'
                });
            }

            Utils.showToast(`Restocked +${qty} of "${prod.name}". Now ${prod.stockQty} in stock.`, 'success');

            // Hide inline panel and refresh low stock list
            document.getElementById('inline-restock-panel').style.display = 'none';
            this._restockProductId = null;
            await this.loadInventory();
            this.showLowStockItems();
        } catch (e) {
            console.error('Failed to restock:', e);
            Utils.showToast('Failed to restock product.', 'error');
        }
    },

    async editFromLowStock(productId) {
        document.getElementById('low-stock-modal').style.display = 'none';
        // Navigate to inventory page
        const inventoryLink = document.querySelector('.nav-link[data-target="view-inventory"]');
        if (inventoryLink) {
            inventoryLink.click();
        }
        // Wait for inventory view to be visible, then open edit form
        const waitForView = () => {
            const inventoryView = document.getElementById('view-inventory');
            if (inventoryView && inventoryView.classList.contains('active')) {
                this.editProduct(productId);
            } else {
                requestAnimationFrame(waitForView);
            }
        };
        requestAnimationFrame(waitForView);
    },

    async showAllHistory() {
        try {
            const entries = await window.StockHistoryManager.getAllHistory();
            const modal = document.getElementById('stock-history-modal');
            const title = modal.querySelector('.modal-title');

            title.textContent = `Stock History — All Products`;

            // Store all entries for filtering (all products mode)
            this._historyShowProduct = true;
            this._historyEntries = entries;

            // Only reset filters when opening the modal fresh, not when switching views
            if (modal.style.display === 'none' || !modal.style.display) {
                document.getElementById('filter-history-from').value = '';
                document.getElementById('filter-history-to').value = '';
            }

            // Apply the current filter (or show all if filters are empty)
            this._applyHistoryFilter();

            modal.style.display = 'flex';
        } catch (e) {
            console.error('Failed to load stock history:', e);
            Utils.showToast('Failed to load stock history', 'error');
        }
    },

    _renderHistoryTable(entries, showProduct) {
        const container = document.getElementById('stock-history-content');
        const totalPages = Math.ceil(entries.length / this._historyPageSize) || 1;

        // Clamp page to valid range
        if (this._historyPage > totalPages) this._historyPage = totalPages;

        // Slice entries for current page
        const start = (this._historyPage - 1) * this._historyPageSize;
        const pageEntries = entries.slice(start, start + this._historyPageSize);

        if (entries.length === 0) {
            container.innerHTML = '<p class="text-muted" style="text-align:center; padding:2rem;">No stock changes recorded yet.</p>';
            return;
        }

        // Render chart above the table
        let html = this._renderStockChart(entries, showProduct);
        html += `<table class="data-table">
            <thead>
                <tr>
                    ${showProduct ? '<th>Product</th>' : ''}
                    <th>Date</th>
                    <th>Change</th>
                    <th>Remaining</th>
                    <th>Invoice</th>
                </tr>
            </thead>
            <tbody>`;
        pageEntries.forEach(e => {
            const changeClass = e.change < 0 ? 'text-error' : 'text-success';
            const changeSign = e.change > 0 ? '+' : '';
            html += `<tr>
                ${showProduct ? `<td><strong>${this.escapeHTML(e.productName || '—')}</strong></td>` : ''}
                <td>${Utils.formatDate(e.date)}</td>
                <td class="${changeClass}"><strong>${changeSign}${e.change}</strong></td>
                <td>${e.remaining}</td>
                <td>${this.escapeHTML(e.invoiceNumber || '—')}</td>
            </tr>`;
        });
        // Compute summary totals from the full (filtered) entries
        let totalSold = 0;
        let totalRestocked = 0;
        entries.forEach(e => {
            if (e.change < 0) totalSold += Math.abs(e.change);
            else totalRestocked += e.change;
        });

        // Compute starting and final stock (single product view only)
        let startStock = null;
        let endStock = null;
        if (!showProduct && entries.length > 0) {
            // Sort chronologically to find first and last entries
            const chronological = [...entries].sort((a, b) => a.date.localeCompare(b.date));
            const first = chronological[0];
            const last = chronological[chronological.length - 1];
            startStock = first.remaining - first.change; // stock before first change
            endStock = last.remaining;                     // stock after last change
        }

        // Determine net change for summary row color coding
        const netChange = totalRestocked - totalSold;
        const summaryClass = netChange > 0
            ? 'history-summary history-summary--positive'
            : netChange < 0
                ? 'history-summary history-summary--negative'
                : 'history-summary';

        // Summary row showing sold vs restocked
        html += `</tbody>
            <tfoot class="${summaryClass}">
                <tr>
                    ${showProduct ? '<td></td>' : ''}
                    <td colspan="4">
                        ${!showProduct && startStock != null
                            ? `<span class="summary-stock-range">${startStock} → ${endStock}</span><span class="summary-divider">|</span>`
                            : ''}
                        <span class="summary-sold">Sold: <strong>${totalSold}</strong></span>
                        <span class="summary-divider">|</span>
                        <span class="summary-restocked">Restocked: <strong>${totalRestocked}</strong></span>
                        <span class="summary-divider">|</span>
                        <span class="summary-net">Net: <strong class="${netChange > 0 ? 'text-success' : netChange < 0 ? 'text-error' : ''}">${netChange > 0 ? '+' : ''}${netChange}</strong></span>
                    </td>
                </tr>
            </tfoot>
        </table>`;

        // Pagination controls
        if (totalPages > 1) {
            html += `<div class="history-pagination">
                <span class="pagination-info">${start + 1}–${Math.min(start + this._historyPageSize, entries.length)} of ${entries.length}</span>
                <div class="pagination-controls">
                    <button class="btn btn-outline btn-sm" onclick="InventoryManager._goToPage(${this._historyPage - 1})" ${this._historyPage <= 1 ? 'disabled' : ''}>
                        ‹ Prev
                    </button>
                    <span class="pagination-page">Page ${this._historyPage} of ${totalPages}</span>
                    <button class="btn btn-outline btn-sm" onclick="InventoryManager._goToPage(${this._historyPage + 1})" ${this._historyPage >= totalPages ? 'disabled' : ''}>
                        Next ›
                    </button>
                </div>
            </div>`;
        }

        container.innerHTML = html;
    },

    _renderStockChart(entries, showProduct) {
        if (entries.length < 2) return ''; // Need at least 2 data points

        // Sort chronologically for charting
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

        if (!showProduct) {
            // --- Single product: Line chart of remaining stock over time ---
            const points = sorted.map(e => ({ date: e.date, value: e.remaining }));
            return this._buildLineChartSVG(points, 'Stock Level');
        } else {
            // --- All products: Grouped bar chart — daily sold vs restocked ---
            const daily = {};
            sorted.forEach(e => {
                if (!daily[e.date]) daily[e.date] = { sold: 0, restocked: 0 };
                if (e.change < 0) daily[e.date].sold += Math.abs(e.change);
                else daily[e.date].restocked += e.change;
            });
            const dates = Object.keys(daily);
            const soldData = dates.map(d => daily[d].sold);
            const restockedData = dates.map(d => daily[d].restocked);
            return this._buildBarChartSVG(dates, soldData, restockedData);
        }
    },

    _buildLineChartSVG(points, label) {
        const W = 560, H = 140;
        const PAD = { top: 12, right: 12, bottom: 28, left: 44 };
        const cw = W - PAD.left - PAD.right; // chart width
        const ch = H - PAD.top - PAD.bottom;  // chart height

        const values = points.map(p => p.value);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const range = maxVal - minVal || 1;

        // Map data point to SVG coordinates
        const xScale = (i) => PAD.left + (i / (points.length - 1)) * cw;
        const yScale = (v) => PAD.top + ch - ((v - minVal) / range) * ch;

        // Build polyline points string
        const linePoints = points.map((p, i) => `${xScale(i)},${yScale(p.value)}`).join(' ');
        // Build area fill points (polygon closing at bottom)
        const areaPoints = points.map((p, i) => `${xScale(i)},${yScale(p.value)}`).join(' ')
            + ` ${xScale(points.length - 1)},${PAD.top + ch} ${xScale(0)},${PAD.top + ch}`;

        // Y-axis ticks (3 ticks)
        const ticks = [
            { v: minVal, y: yScale(minVal) },
            { v: Math.round((minVal + maxVal) / 2), y: yScale((minVal + maxVal) / 2) },
            { v: maxVal, y: yScale(maxVal) }
        ];

        // X-axis labels (first, middle, last date shown as short date)
        const dateLabels = [
            { text: Utils.formatDate(points[0].date), x: xScale(0) },
            { text: Utils.formatDate(points[Math.floor(points.length / 2)].date), x: xScale(Math.floor(points.length / 2)) },
            { text: Utils.formatDate(points[points.length - 1].date), x: xScale(points.length - 1) }
        ];

        return `<div class="stock-chart-container">
            <div class="stock-chart-title">${label} Over Time</div>
            <svg viewBox="0 0 ${W} ${H}" class="stock-chart-svg">
                <!-- Grid lines -->
                ${ticks.map(t => `<line x1="${PAD.left}" y1="${t.y}" x2="${W - PAD.right}" y2="${t.y}" class="chart-gridline"/>`).join('')}
                <!-- Area fill -->
                <polygon points="${areaPoints}" class="chart-area"/>
                <!-- Line -->
                <polyline points="${linePoints}" class="chart-line"/>
                <!-- Data dots -->
                ${points.map((p, i) => `<circle cx="${xScale(i)}" cy="${yScale(p.value)}" r="3" class="chart-dot"/>`).join('')}
                <!-- Y-axis labels -->
                ${ticks.map(t => `<text x="${PAD.left - 6}" y="${t.y + 4}" class="chart-y-label">${t.v}</text>`).join('')}
                <!-- X-axis labels -->
                ${dateLabels.map(dl => `<text x="${dl.x}" y="${H - 4}" class="chart-x-label">${dl.text}</text>`).join('')}
            </svg>
        </div>`;
    },

    _buildBarChartSVG(dates, soldData, restockedData) {
        const W = 560, H = 140;
        const PAD = { top: 12, right: 12, bottom: 28, left: 44 };
        const cw = W - PAD.left - PAD.right;
        const ch = H - PAD.top - PAD.bottom;

        // Find max value for scaling (max of either sold or restocked)
        const allValues = [...soldData, ...restockedData];
        const maxVal = Math.max(...allValues, 1);
        const barCount = dates.length;
        const barWidth = Math.min(20, (cw / barCount) * 0.3);
        const groupWidth = cw / barCount;

        // Y-axis ticks (3 ticks)
        const ticks = [0, Math.round(maxVal / 2), maxVal];

        const yScale = (v) => PAD.top + ch - (v / maxVal) * ch;

        let barsHtml = '';
        dates.forEach((d, i) => {
            const x = PAD.left + i * groupWidth + (groupWidth - barWidth * 2) / 2;
            // Sold bar (red)
            if (soldData[i] > 0) {
                const barH = ch - yScale(soldData[i]) + PAD.top;
                barsHtml += `<rect x="${x}" y="${yScale(soldData[i])}" width="${barWidth}" height="${barH}" class="chart-bar-sold"/>`;
            }
            // Restocked bar (green)
            if (restockedData[i] > 0) {
                const bx = x + barWidth;
                const barH = ch - yScale(restockedData[i]) + PAD.top;
                barsHtml += `<rect x="${bx}" y="${yScale(restockedData[i])}" width="${barWidth}" height="${barH}" class="chart-bar-restocked"/>`;
            }
        });

        // X-axis labels (show at most 5 labels evenly spaced)
        const labelStep = Math.max(1, Math.floor(barCount / 5));
        const dateLabelsHtml = dates
            .filter((_, i) => i % labelStep === 0 || i === barCount - 1)
            .map((d, i, arr) => {
                // Find the original index for positioning
                const idx = dates.indexOf(d);
                const x = PAD.left + idx * groupWidth + groupWidth / 2;
                return `<text x="${x}" y="${H - 4}" class="chart-x-label">${Utils.formatDate(d).slice(0, 6)}</text>`;
            }).join('');

        return `<div class="stock-chart-container">
            <div class="stock-chart-title">Daily Activity</div>
            <svg viewBox="0 0 ${W} ${H}" class="stock-chart-svg">
                <!-- Grid lines -->
                ${ticks.map(v => `<line x1="${PAD.left}" y1="${yScale(v)}" x2="${W - PAD.right}" y2="${yScale(v)}" class="chart-gridline"/>`).join('')}
                <!-- Bars -->
                ${barsHtml}
                <!-- Legend (inside SVG) -->
                <rect x="${W - 100}" y="4" width="10" height="10" class="chart-bar-sold"/>
                <text x="${W - 86}" y="12" class="chart-legend-text">Sold</text>
                <rect x="${W - 52}" y="4" width="10" height="10" class="chart-bar-restocked"/>
                <text x="${W - 38}" y="12" class="chart-legend-text">Restocked</text>
                <!-- Y-axis labels -->
                ${ticks.map(v => `<text x="${PAD.left - 6}" y="${yScale(v) + 4}" class="chart-y-label">${v}</text>`).join('')}
                <!-- X-axis labels -->
                ${dateLabelsHtml}
            </svg>
        </div>`;
    },

    _goToPage(page) {
        if (page < 1) return;
        this._historyPage = page;
        this._applyHistoryFilter(false); // re-render without resetting page
    },

    _applyHistoryFilter(resetPage = true) {
        const fromVal = document.getElementById('filter-history-from').value;
        const toVal = document.getElementById('filter-history-to').value;
        const typeVal = document.getElementById('filter-history-type').value;

        if (!this._historyEntries) return;

        // Reset to page 1 when filter changes (skip for pagination navigation)
        if (resetPage) this._historyPage = 1;

        let filtered = this._historyEntries;

        if (fromVal) {
            filtered = filtered.filter(e => e.date >= fromVal);
        }
        if (toVal) {
            filtered = filtered.filter(e => e.date <= toVal);
        }
        if (typeVal) {
            filtered = filtered.filter(e => e.type === typeVal);
        }

        // Store filtered entries for CSV export
        this._historyFilteredEntries = filtered;
        this._renderHistoryTable(filtered, this._historyShowProduct);
    },

    _exportHistoryCSV() {
        const entries = this._historyFilteredEntries || this._historyEntries;
        if (!entries || entries.length === 0) {
            Utils.showToast('No data to export.', 'error');
            return;
        }

        const showProduct = this._historyShowProduct;

        // Build CSV header
        const headers = [];
        if (showProduct) headers.push('Product');
        headers.push('Date', 'Change', 'Remaining', 'Invoice');

        // Build CSV rows
        const rows = [headers.join(',')];
        entries.forEach(e => {
            const change = e.change > 0 ? `+${e.change}` : `${e.change}`;
            const fields = [];
            if (showProduct) fields.push(this._csvEscape(e.productName || ''));
            fields.push(e.date, change, e.remaining, this._csvEscape(e.invoiceNumber || ''));
            rows.push(fields.join(','));
        });

        // Add summary row
        let totalSold = 0;
        let totalRestocked = 0;
        entries.forEach(e => {
            if (e.change < 0) totalSold += Math.abs(e.change);
            else totalRestocked += e.change;
        });
        const netChange = totalRestocked - totalSold;
        const netSign = netChange > 0 ? '+' : '';
        const summaryLabel = `Sold: ${totalSold} | Restocked: ${totalRestocked} | Net: ${netSign}${netChange}`;
        if (showProduct) {
            rows.push(`,${summaryLabel}`);
        } else {
            rows.push(`${summaryLabel}`);
        }

        // Trigger download
        const csv = rows.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const filename = showProduct ? 'stock-history-all.csv' : 'stock-history.csv';
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        Utils.showToast(`Exported ${entries.length} entries to ${filename}`, 'success');
    },

    _exportHistoryXLSX() {
        const entries = this._historyFilteredEntries || this._historyEntries;
        if (!entries || entries.length === 0) {
            Utils.showToast('No data to export.', 'error');
            return;
        }

        const showProduct = this._historyShowProduct;

        // Build header
        const headers = [];
        if (showProduct) headers.push('Product');
        headers.push('Date', 'Change', 'Remaining', 'Invoice');

        // Build rows
        const rows = entries.map(e => {
            const row = [];
            if (showProduct) row.push(e.productName || '—');
            row.push(e.date, e.change, e.remaining, e.invoiceNumber || '—');
            return row;
        });

        // Compute summary
        let totalSold = 0, totalRestocked = 0;
        entries.forEach(e => {
            if (e.change < 0) totalSold += Math.abs(e.change);
            else totalRestocked += e.change;
        });
        const netChange = totalRestocked - totalSold;

        // Generate XLSX using SheetJS (CDN loaded)
        if (typeof XLSX === 'undefined') {
            Utils.showToast('XLSX library loading... Please try again.', 'warning');
            this._loadSheetJS(() => this._exportHistoryXLSX());
            return;
        }

        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stock History');

        const filename = showProduct ? 'stock-history-all.xlsx' : 'stock-history.xlsx';
        XLSX.writeFile(wb, filename);
        Utils.showToast(`Exported ${entries.length} entries to ${filename}`, 'success');
    },

    _loadSheetJS(callback) {
        if (document.getElementById('sheetjs-cdn')) {
            setTimeout(callback, 500);
            return;
        }
        const script = document.createElement('script');
        script.id = 'sheetjs-cdn';
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        script.onload = () => setTimeout(callback, 200);
        script.onerror = () => Utils.showToast('Failed to load XLSX library.', 'error');
        document.head.appendChild(script);
    },

    async _exportHistoryPDF() {
        const entries = this._historyFilteredEntries || this._historyEntries;
        if (!entries || entries.length === 0) {
            Utils.showToast('No data to export.', 'error');
            return;
        }

        const showProduct = this._historyShowProduct;

        // Build a printable HTML string
        let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
            body { font-family: 'Inter', Arial, sans-serif; margin: 20px; color: #1e293b; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #64748b; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 8px 6px; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
            td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
            .positive { color: #10b981; font-weight: 600; }
            .negative { color: #ef4444; font-weight: 600; }
            .summary { margin-top: 16px; font-size: 12px; color: #64748b; }
            .summary strong { color: #1e293b; }
        </style></head><body>
        <h1>Stock History${showProduct ? ' — All Products' : ''}</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <table><thead><tr>`;

        if (showProduct) html += '<th>Product</th>';
        html += '<th>Date</th><th>Change</th><th>Remaining</th><th>Invoice</th></tr></thead><tbody>';

        entries.forEach(e => {
            const cls = e.change < 0 ? 'negative' : 'positive';
            const sign = e.change > 0 ? '+' : '';
            html += '<tr>';
            if (showProduct) html += `<td><strong>${this.escapeHTML(e.productName || '—')}</strong></td>`;
            html += `<td>${e.date}</td><td class="${cls}">${sign}${e.change}</td><td>${e.remaining}</td><td>${this.escapeHTML(e.invoiceNumber || '—')}</td></tr>`;
        });

        let totalSold = 0, totalRestocked = 0;
        entries.forEach(e => {
            if (e.change < 0) totalSold += Math.abs(e.change);
            else totalRestocked += e.change;
        });
        const netChange = totalRestocked - totalSold;
        const netSign = netChange > 0 ? '+' : '';

        html += `</tbody></table>
        <div class="summary"><strong>Sold:</strong> ${totalSold} &nbsp;|&nbsp; <strong>Restocked:</strong> ${totalRestocked} &nbsp;|&nbsp; <strong>Net:</strong> ${netSign}${netChange}</div>
        </body></html>`;

        // Use hidden iframe to avoid popup blockers
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;height:600px;';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 300);
        };
        Utils.showToast('PDF preview opened — use Print > Save as PDF', 'success');
    },

    _exportHistorySVG() {
        const chartContainer = document.querySelector('#stock-history-content .stock-chart-container');
        if (!chartContainer) {
            Utils.showToast('No chart available to export. Need at least 2 data points.', 'warning');
            return;
        }

        const svg = chartContainer.querySelector('svg.stock-chart-svg');
        if (!svg) {
            Utils.showToast('Chart SVG not found.', 'error');
            return;
        }

        // Clone SVG and add inline styles for standalone rendering
        const clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Read current theme CSS variables for accurate export
        const cs = getComputedStyle(document.documentElement);
        const colorBorder = cs.getPropertyValue('--border-color').trim() || '#e2e8f0';
        const colorPrimary = cs.getPropertyValue('--primary').trim() || '#38bdf8';
        const colorDanger = cs.getPropertyValue('--danger').trim() || '#f87171';
        const colorSecondary = cs.getPropertyValue('--secondary').trim() || '#34d399';
        const colorMuted = cs.getPropertyValue('--text-muted').trim() || '#94a3b8';
        const colorSurface = cs.getPropertyValue('--surface').trim() || '#ffffff';

        // Add inline styles matching current theme
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `
            text { font-family: Inter, Arial, sans-serif; }
            .chart-gridline { stroke: ${colorBorder}; stroke-width: 0.5; stroke-dasharray: 3,3; }
            .chart-line { fill: none; stroke: ${colorPrimary}; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
            .chart-area { fill: ${colorPrimary}; opacity: 0.1; }
            .chart-dot { fill: ${colorPrimary}; stroke: ${colorSurface}; stroke-width: 1.5; }
            .chart-bar-sold { fill: ${colorDanger}; opacity: 0.8; }
            .chart-bar-restocked { fill: ${colorSecondary}; opacity: 0.8; }
            .chart-y-label, .chart-x-label { fill: ${colorMuted}; font-size: 9px; }
            .chart-legend-text { fill: ${colorMuted}; font-size: 9px; }
        `;
        clone.insertBefore(style, clone.firstChild);

        const svgString = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'stock-history-chart.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        Utils.showToast('Chart exported as SVG', 'success');
    },

    _csvEscape(str) {
        if (!str) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    },

    escapeHTML(str) {
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

window.InventoryManager = InventoryManager;
