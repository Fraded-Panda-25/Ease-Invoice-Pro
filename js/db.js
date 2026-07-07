// db.js - IndexedDB Wrapper for Ease Invoice

const DB_NAME = 'EaseInvoiceDB';
const DB_VERSION = 1;

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Database error: ", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create Profile Store (Single record store)
                if (!db.objectStoreNames.contains('profile')) {
                    db.createObjectStore('profile', { keyPath: 'id' });
                }

                // Create Products Store
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id' });
                    productStore.createIndex('name', 'name', { unique: false });
                    productStore.createIndex('company', 'company', { unique: false });
                }

                // Create Invoices Store
                if (!db.objectStoreNames.contains('invoices')) {
                    const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id' });
                    invoiceStore.createIndex('date', 'date', { unique: false });
                    invoiceStore.createIndex('number', 'number', { unique: true });
                }
            };
        });
    }

    // Generic Add/Update
    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic Get by ID
    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic Get All
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic Delete
    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Clear Store
    async clear(storeName) {
         return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Export all data
    async exportData() {
        const data = {
            profile: await this.getAll('profile'),
            products: await this.getAll('products'),
            invoices: await this.getAll('invoices')
        };
        return JSON.stringify(data);
    }

    // Import data
    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.profile) {
                await this.clear('profile');
                for (let item of data.profile) await this.put('profile', item);
            }
            if (data.products) {
                await this.clear('products');
                for (let item of data.products) await this.put('products', item);
            }
            if (data.invoices) {
                await this.clear('invoices');
                for (let item of data.invoices) await this.put('invoices', item);
            }
            return true;
        } catch (e) {
            console.error("Import failed:", e);
            throw e;
        }
    }
}

// Global instance
window.appDB = new Database();
