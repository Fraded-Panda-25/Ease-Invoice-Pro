// stockHistory.js - Stock Change History Logger

const StockHistoryManager = {
    // Add a stock change entry
    async addEntry({ productId, productName, change, remaining, date, invoiceNumber, type = 'sale' }) {
        const entry = {
            id: Utils.generateUUID(),
            productId,
            productName,
            date,
            invoiceNumber: invoiceNumber || '',
            change,         // negative = sold, positive = restocked
            remaining,      // stock after the change
            type            // 'sale', 'restock', 'adjustment'
        };
        try {
            await window.appDB.put('stockHistory', entry);
        } catch (e) {
            console.error('Failed to save stock history entry:', e);
        }
    },

    // Get all history entries for a specific product, sorted by date descending
    async getHistoryForProduct(productId) {
        try {
            const all = await window.appDB.getAll('stockHistory');
            return all
                .filter(e => e.productId === productId)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {
            console.error('Failed to load stock history:', e);
            return [];
        }
    },

    // Get all history entries across all products, sorted by date descending
    async getAllHistory() {
        try {
            const all = await window.appDB.getAll('stockHistory');
            return all.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {
            console.error('Failed to load stock history:', e);
            return [];
        }
    }
};

window.StockHistoryManager = StockHistoryManager;
