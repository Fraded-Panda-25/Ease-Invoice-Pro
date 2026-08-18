# Copilot Instructions — Ease Invoice

You are a coding assistant for **Ease Invoice**, a zero-dependency vanilla JS single-page app. All data is stored client-side in IndexedDB.

---

## Tech Stack

- Vanilla JavaScript (ES2020+), no TypeScript, no framework
- IndexedDB via `window.appDB` (custom wrapper in `js/db.js`)
- CSS with custom properties (`var(--primary)`, etc.)
- Currency is INR — always use `Utils.formatCurrency()`
- No npm, no bundler, no external dependencies

---

## Architecture

Each feature module is a singleton on `window`:

```javascript
const FooManager = {
    data: [],
    async init() {
        this.bindEvents();
        await this.loadData();
    },
    async loadData() {
        this.data = await window.appDB.getAll('storeName');
    },
    bindEvents() {
        document.getElementById('x').addEventListener('click', () => { /* ... */ });
    },
};
window.FooManager = FooManager;
```

**Existing managers:** `InvoiceManager`, `InventoryManager`, `CustomersManager`, `ProfileManager`, `StockHistoryManager`

**Initialization order:** `appDB.init()` → `ProfileManager.init()` → `InventoryManager.init()` → `InvoiceManager.init()` → `CustomersManager.init()`

---

## Rules

### Always

- Use `const` / `let`, never `var`
- Use `async/await` for DB operations, never `.then()`
- Use `Utils.escapeHTML()` for all dynamic DOM content (XSS prevention)
- Use `Utils.formatCurrency()` for money display
- Use `Utils.generateUUID()` for record IDs
- Use `Utils.showToast(msg, type)` for user feedback
- Use CSS custom properties for colors, never hardcode hex/rgb
- Use `data-*` attributes for DOM ↔ JS metadata
- Add `.no-print` to elements hidden during printing
- Test responsiveness at 375px width

### Never

- Use `innerHTML` with raw user input without escaping
- Bump `DB_VERSION` in `js/db.js` without a migration plan
- Add npm packages or external libraries
- Use `eval()` or `Function()` constructor
- Create new HTML files — all views live in `index.html`
- Hardcode colors — always use theme variables

---

## IndexedDB Schema (v3)

| Store | Key | Indexes |
|---|---|---|
| `profile` | `id` | — |
| `products` | `id` | `name`, `company` |
| `invoices` | `id` | `date`, `number` (unique) |
| `stockHistory` | `id` | `productId`, `date` |
| `customers` | `id` | `name`, `phone`, `email` |

---

## Key Files

- `index.html` — Single-page shell, all views
- `css/style.css` — Theme system (dark/light), layout, print styles
- `js/app.js` — Bootstrap, navigation, sidebar, tooltips, dock effect
- `js/db.js` — IndexedDB wrapper (`window.appDB`)
- `js/utils.js` — Shared helpers (`window.Utils`)
- `js/invoice.js` — Invoice builder, line items, history, print
- `js/inventory.js` — Product CRUD, stock tracking, restock
- `js/customers.js` — Customer directory, bulk actions, purchase history
- `js/profile.js` — Business profile, logo, data export/import
- `js/stockHistory.js` — Stock change logging
