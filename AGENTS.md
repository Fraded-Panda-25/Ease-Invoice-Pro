# AGENTS.md — Ease Invoice

> **Purpose:** Universal context file for AI coding agents working on this repository.
> Any AI tool (Claude Code, Copilot, Cursor, Codebuff, etc.) should read this before making changes.

---

## Project Overview & Goal

**Ease Invoice** is a free, client-side invoicing and inventory management single-page application. All data lives in the user's browser via IndexedDB — there is no backend, no server, and no cloud sync. The app targets small Indian businesses who need quick GST-compliant invoicing with inventory tracking.

**Core workflows:**
1. Build and save invoices with line items, GST, and discounts
2. Manage a product inventory with stock tracking and low-stock alerts
3. Maintain a customer directory that auto-syncs from saved invoices
4. Export/import all data as JSON backups
5. Print invoices in A4 format with business branding

---

## Core Tech Stack & Dependencies

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES2020+, no TypeScript) |
| Framework | None — no React, Vue, Angular, or jQuery |
| Storage | IndexedDB via a custom wrapper (`js/db.js`) |
| Styling | Plain CSS with CSS custom properties for theming |
| Fonts | Google Fonts — Inter (400–700) |
| Build tools | None — no bundler, no transpiler, no `package.json` |
| Hosting | Static files — open `index.html` in a browser, or deploy to any static host |
| External libs | None — the app is fully self-contained |

**Never introduce npm packages, bundlers, or frameworks** unless the user explicitly requests it.

---

## Architecture & Directory Structure

```
.
├── index.html              # Single-page shell — all views live here
├── css/
│   └── style.css           # Full theme system (dark/light), layout, print styles
├── js/
│   ├── app.js              # Bootstrap, navigation routing, theme toggle, sidebar, tooltips, dock effect
│   ├── db.js               # IndexedDB wrapper — Database class with put/get/getAll/delete/clear/export/import
│   ├── utils.js            # Shared helpers — UUID, currency formatting, date, HTML escaping, toast
│   ├── invoice.js          # InvoiceManager — invoice builder, line items, history, print, downloads
│   ├── inventory.js        # InventoryManager — product CRUD, stock tracking, restock, search, downloads
│   ├── customers.js        # CustomersManager — customer directory, bulk actions, purchase history
│   ├── profile.js          # ProfileManager — business profile, logo upload, data export/import
│   └── stockHistory.js     # StockHistoryManager — logs every stock change (sale/restock/adjustment)
└── AGENTS.md               # This file
```

### Module Pattern

Every feature module is a **singleton object** exported as a `window.*Manager` global:

```javascript
const MyManager = {
    data: [],
    async init() {
        this.bindEvents();
        await this.loadData();
    },
    async loadData() {
        this.data = await window.appDB.getAll('storeName');
    },
    bindEvents() {
        document.getElementById('my-btn').addEventListener('click', () => { /* ... */ });
    },
};
window.MyManager = MyManager;
```

**Initialization order** (in `js/app.js`):
1. `window.appDB.init()` — open IndexedDB
2. `ProfileManager.init()` — load business profile
3. `InventoryManager.init()` — load products
4. `InvoiceManager.init()` — load invoices
5. `CustomersManager.init()` — load customers

### IndexedDB Schema (current version: 3)

| Store | Key | Indexes |
|---|---|---|
| `profile` | `id` | — |
| `products` | `id` | `name`, `company` |
| `invoices` | `id` | `date`, `number` (unique) |
| `stockHistory` | `id` | `productId`, `date` |
| `customers` | `id` | `name`, `phone`, `email` |

### Navigation & Views

The app uses a hash-based SPA router. Navigation links have a `data-target` attribute pointing to a `<section id="view-*">` element. Clicking a nav link hides all views and shows the target. Hash changes are handled via `hashchange` event.

**Views:** `view-dashboard`, `view-inventory`, `view-customers`, `view-settings`

---

## Code Style & Development Rules

### Dos

- **Use `const` / `let`** — never `var`
- **Use `async/await`** — never raw `.then()` chains for DB operations
- **Use `Utils.formatCurrency()`** for all monetary display (INR)
- **Use `Utils.generateUUID()`** for all record IDs
- **Use `Utils.escapeHTML()`** for all dynamic content rendered to the DOM — this is the **XSS prevention rule**
- **Use `Utils.showToast(message, type)`** for user feedback notifications
- **Keep the `window.*Manager` singleton pattern** when adding new modules
- **Call `bindEvents()`** during `init()` for any new interactive elements
- **Use CSS custom properties** (`var(--primary)`, `var(--danger)`, etc.) for all colors
- **Add `.no-print`** to any element that should not appear on printed invoices
- **Test at 375px width** — all new features must be responsive
- **Use single quotes** for JavaScript strings
- **Use `data-*` attributes** for passing metadata between DOM and JS (e.g., `data-product-id`, `data-format`)

### Don'ts

- **Never use `innerHTML` with raw user input** — always escape first via `Utils.escapeHTML()`
- **Never bump `DB_VERSION` in `js/db.js` without a migration plan** — existing users will lose data if `onupgradeneeded` doesn't handle the upgrade correctly
- **Never add npm dependencies** — this is a zero-dependency project
- **Never use `var`** — use `const` for constants, `let` for reassignable variables
- **Never hardcode colors** — always use CSS custom properties or theme variables
- **Never create new HTML files** — the entire UI lives in `index.html`
- **Never skip the `async` on DB wrapper methods** — all `appDB.*` calls return Promises
- **Never use `eval()` or `Function()` constructor**
- **Never modify `db.js` schema** without documenting the change and bumping `DB_VERSION`
- **Never leave console.log statements** in production code (debugging logs are fine during development)

---

## Run, Test, & Build Commands

### Running Locally

There is no build step. Open `index.html` directly in a browser:

```bash
# Option 1: Direct file open
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows

# Option 2: Local HTTP server (recommended for IndexedDB)
npx serve .              # or python -m http.server
```

> **Note:** IndexedDB works fine with `file://` protocol in most browsers, but a local server is more reliable and avoids CORS issues with Google Fonts.

### Testing

**There is currently no automated test suite.** Testing is done manually:

1. Open `index.html` in a local server
2. Test invoice creation, saving, and printing
3. Test inventory CRUD, stock deduction on sale, restocking
4. Test customer directory sync and bulk actions
5. Test data export/import round-trip
6. Test dark/light theme toggle
7. Test responsive layout at 375px, 768px, and 1200px widths

When making changes, verify by:
- Creating an invoice with multiple line items and printing it
- Adding a product, selling it, and confirming stock decreases
- Exporting data and re-importing it to verify integrity
- Checking the browser console for errors

### Build

**No build step exists.** Files are served as-is. For deployment, copy the entire project directory to any static host.

---

## Git & Commit Guidelines

### Branch Naming

- `main` — production-ready code
- `feature/description` — new features
- `fix/description` — bug fixes
- `dev` — development/experimental branch

### Commit Messages

Use clear, descriptive commit messages:

```
Add restock preset buttons and inline panel
Fix stock deduction on invoice save
Update customer directory with bulk actions
```

### What to Commit

- All HTML, CSS, and JS changes
- Documentation updates
- Do **not** commit IDE config files (`.idea/`, `.vscode/` except `settings.json`)

### Pull Request Conventions

- Describe what changed and why
- Note any IndexedDB schema changes
- Mention which views were tested
- Include screenshots for UI changes

---

## Key Patterns & Reference

### Adding a New Feature Module

1. Create `js/newFeature.js` with a `window.NewFeatureManager` singleton
2. Add a `<script>` tag in `index.html` before `app.js`
3. Call `NewFeatureManager.init()` in `app.js` during bootstrap
4. Add a new `<section id="view-*">` in `index.html` if it needs its own view
5. Add a nav link in the sidebar with `data-target="view-*"`

### Adding a New IndexedDB Store

1. Bump `DB_VERSION` in `js/db.js`
2. Add the new store in the `onupgradeneeded` handler with its indexes
3. Handle migration from the previous version — copy or transform existing data if needed
4. Add `exportData` and `importData` support for the new store

### Multi-Format Download Pattern

The app supports CSV, XLSX, SVG, and PDF exports for inventory, invoices, customers, and stock history. Each uses a dropdown menu with `data-format` attributes. The download handler dispatches to format-specific export methods (e.g., `exportCSV()`, `exportXLSX()`, `exportSVG()`, `exportPDF()`).

---

<!-- BEGIN AGENT KANBAN — DO NOT EDIT THIS SECTION -->
## Agent Kanban

Read `.agentkanban/INSTRUCTION.md` for task workflow rules.
Read `.agentkanban/memory.md` for project context.

If a task file (`.agentkanban/tasks/**/*.md`) was referenced earlier in this conversation, re-read it before responding and always respond in and at the end the task file.
<!-- END AGENT KANBAN -->
