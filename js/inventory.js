// inventory.js - Inventory Management

const InventoryManager = {
    products: [],

    async init() {
        this.bindEvents();
        await this.loadInventory();
    },

    async loadInventory() {
        try {
            this.products = await window.appDB.getAll('products');
            this.renderTable(this.products);
        } catch (e) {
            console.error(e);
            Utils.showToast("Failed to load inventory", "error");
        }
    },

    renderTable(dataList) {
        const tbody = document.getElementById('inventory-body');
        tbody.innerHTML = '';

        if (dataList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No products found.</td></tr>';
            return;
        }

        dataList.forEach(prod => {
            const tr = document.createElement('tr');
            
            // Stock logic
            const isLowStock = prod.stockQty <= prod.lowStockThreshold;
            const stockBadgeClass = isLowStock ? 'badge badge-danger' : 'badge badge-success';
            
            tr.innerHTML = `
                <td>
                    <strong>${this.escapeHTML(prod.name)}</strong>
                    ${isLowStock ? '<span style="color:var(--danger); font-size:0.75rem; display:block;">Low Stock</span>' : ''}
                </td>
                <td>${this.escapeHTML(prod.company || '-')}</td>
                <td>${this.escapeHTML(prod.sizeUnit || '-')}</td>
                <td>${Utils.formatCurrency(prod.unitPrice)}</td>
                <td><span class="${stockBadgeClass}">${prod.stockQty}</span></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="InventoryManager.editProduct('${prod.id}')">Edit</button>
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
