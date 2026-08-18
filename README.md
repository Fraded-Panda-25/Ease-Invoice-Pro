# Ease Invoice

A free, client-side invoicing and inventory management single-page application. All data lives in your browser — no server, no cloud sync, no account required.

## Features

- **Invoice Builder** — Create GST-compliant invoices with line items, per-item discounts, and invoice-level discounts
- **Inventory Management** — Track products with stock levels, low-stock alerts, and restock history
- **Customer Directory** — Auto-syncs from saved invoices, with bulk actions and purchase history
- **Multi-Format Export** — Download as CSV, Excel (.xlsx), SVG, or PDF
- **Data Backup** — Full JSON export/import for backup and restore
- **Dark/Light Theme** — Toggle between themes with a single click
- **Print-Ready** — A4-optimized print styles for invoices
- **Responsive** — Works on desktop, tablet, and mobile (tested at 375px)

## Quick Start

No build step required. Open `index.html` in a browser, or run a local server:

```bash
# Clone the repo
git clone https://github.com/Fraded-Panda-25/Ease-Invoice-Pro.git
cd Ease-Invoice-Pro

# Start a local server
npx serve .
# or
python -m http.server
```

Then open `http://localhost:3000` (or `localhost:8000` for Python).

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES2020+) |
| Framework | None |
| Storage | IndexedDB |
| Styling | Plain CSS with custom properties |
| Dependencies | Zero — fully self-contained |

## Project Structure

```
.
├── index.html              # Single-page shell — all views
├── css/
│   └── style.css           # Theme system (dark/light), layout, print styles
├── js/
│   ├── app.js              # Bootstrap, navigation, sidebar, tooltips
│   ├── db.js               # IndexedDB wrapper
│   ├── utils.js            # Shared helpers (UUID, currency, toast)
│   ├── invoice.js          # Invoice builder and history
│   ├── inventory.js        # Product CRUD and stock tracking
│   ├── customers.js        # Customer directory and bulk actions
│   ├── profile.js          # Business profile and data export/import
│   └── stockHistory.js     # Stock change logging
└── AGENTS.md               # AI coding agent context file
```

## Development

See [AGENTS.md](AGENTS.md) for the full development guide, coding rules, and architecture details.

### Running Locally

1. Open `index.html` in a browser, or start a local server
2. All data is stored in IndexedDB (browser storage)
3. No build, transpile, or compile step needed

### Code Style

- `const` / `let` only, never `var`
- `async/await` for all database operations
- `Utils.escapeHTML()` for all dynamic DOM content (XSS prevention)
- `Utils.formatCurrency()` for all money display (INR)
- `window.*Manager` singleton pattern for feature modules

## Browser Support

Works in all modern browsers with IndexedDB support:
- Chrome 24+
- Firefox 16+
- Safari 10+
- Edge 12+

## License

Apache 2.0
