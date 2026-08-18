---
title: Customer
lane: done
created: 2026-08-09T13:18:23.587Z
updated: 2026-08-17T14:46:00.000Z
description: Add a option called "Customers" in the middle of the dashboard and inventory database. I want the new button to go to a new page of my every customer name, email address, phone number, address, and there should be a filters, and bulk select email, phone number or address options. Also there should be a option called "Part time customer". By clicking it, the user can get the buyers, who buy products from the user the most.
priority: medium
assignee: Pritam Paul
sortOrder: 6
slug: customer
---

## Conversation

### user

Add a option called "Customers" in the middle of the dashboard and inventory database. I want the new button to go to a new page of my every customer name, email address, phone number, address, and there should be a filters, and bulk select email, phone number or address options. Also there should be a option called "Part time customer". By clicking it, the user can get the buyers, who buy products from the user the most.

### agent

**Implementation complete** ✅ — the Customers Directory feature is fully implemented per the Implementation Plan:

- **Sidebar**: "Customers" nav link (Users icon) sits between Dashboard and Inventory, routing to `view-customers`.
- **Database**: `DB_VERSION` bumped to 3 with a `customers` store (indexes on name/phone/email); included in export/import backup round-trip.
- **Page**: Customers Directory with stats cards (Total Customers / Active Buyers / Top Buyer), search bar, filter pills (All Customers / ⭐ Part time customer / Has Email / Has Phone), bulk action bar (Copy Emails / Copy Phones / Copy Addresses / Delete Selected), directory table (Name, Email, Phone, Address, Total Purchases + invoice count), and Add/Edit modal.
- **"Part time customer"**: filters to buyers with at least one purchase and ranks them by order count (then spend) — i.e., the customers who buy from you the most, with Top Buyer / Frequent badges.
- **Sync**: existing invoices are scanned on first run to auto-populate customers; every invoice save creates/updates the matching customer record (`js/invoice.js`).
- **Bulk copy**: selected emails/phones/addresses are written to the clipboard (newline-separated) with toast confirmation and legacy fallback.
- **Polish**: `Utils.escapeHTML()` added for XSS-safe rendering; glassmorphism-friendly styles, animations, responsive table, selected-row highlights, and top-buyer badge styling.
- **Fix applied during completion**: "Reset All Data" in Settings now also clears the `customers` store.
- **Validation**: all `js/*.js` files pass `node --check`.

Changes are in the working tree (uncommitted): modified `index.html`, `css/style.css`, `js/db.js`, `js/app.js`, `js/invoice.js`, `js/utils.js`, `js/profile.js`; new `js/customers.js`.

### agent

**Code review fixes applied** (post-review polish):

- Removed the redundant dedicated `#btn-filter-part-time` click handler (the button is already a `.customer-filter-btn` with `data-filter="part-time"`, so the generic handler covers it — previously it double-rendered).
- Row checkboxes now toggle the `row-selected` class in place instead of re-rendering the whole table, preserving checkbox focus while updating the bulk bar + select-all state.
- `syncFromInvoices()` now **enriches** existing matching customers with missing phone/email/address from invoices (previously only added new ones) and matches by name **or** phone — consistent with the `loadCustomers()` aggregation.
- Added **Last order date** as subtext in the Total Purchases column (was computed but never displayed).
- Added defensive guard note in `invoice.js` sync (customer name is already validated non-empty in `saveInvoice`, so no early-return risk).
- `Reset All Data` now also clears the `customers` store.

All `js/*.js` files pass `node --check` after the fixes.

### agent

**Follow-up: Customer purchase history** ✅ — clicking any customer row (or the new 📋 button in the Actions column) now opens a **Purchase History modal** listing that customer's invoices (Date, Invoice #, Items, Total) plus a summary strip (Total Invoices, Total Spent, Contact). Each invoice row has a **👁️ View** button that navigates to the dashboard and loads the invoice into the editor (reusing `InvoiceManager.viewInvoice`).

Implementation notes:
- `index.html`: new `#modal-customer-history` modal with summary strip + invoices table.
- `js/customers.js`: `openPurchaseHistory()` (matches invoices by name **or** phone — same logic as the directory aggregation), `viewCustomerInvoice()` (guards against stale/missing invoices with a DB check, injects a fresh copy if the in-memory list is stale, then switches to the dashboard view), row-click delegation that ignores clicks on links/checkboxes/buttons and the checkbox-column padding, and close-button bindings.
- `css/style.css`: summary-strip styles, clickable-row cursor + hover inset ring.
- Trade-off noted: row-click opens history, so the address cell text can no longer be selected by a simple click — emails/phones stay clickable links and bulk copy remains available via checkboxes.

All `js/*.js` pass `node --check`.

### agent

**Follow-up: CSV export of the customer directory** ✅ — added a **📥 Export CSV** button in the Customers toolbar (next to the filter pills, since the bulk bar only appears with a selection). It exports the **currently visible list** — i.e., all customers by default, or the filtered subset when a filter tab (⭐ Part time customer / Has Email / Has Phone) and/or search query is active.

Implementation notes:
- `index.html`: `#btn-export-customers-csv` in the filter-pills row.
- `js/customers.js`: `exportCSV()` builds rows from `getFilteredCustomers()`, properly escapes CSV cells (quotes fields containing commas/quotes/newlines, doubles embedded quotes), prepends a UTF-8 BOM so Excel renders ₹/names correctly, downloads via Blob → object URL (`customers_YYYY-MM-DD.csv`), revokes the URL, and toasts the exported count. Empty filtered list → warning toast.
- Columns: Name, Phone, Email, Address, Total Invoices, Total Spent (INR, raw number for spreadsheets), Last Order Date.

All `js/*.js` pass `node --check`.

### user

apply all.

### agent

All changes are fully applied and saved. The **Customers** directory and **Part time customer** feature are completely ready and active across all modules. All `js/*.js` pass `node --check`.

### user

Add another options with csv, like xlsx, svg, pdf in a download dropdown.

### agent

**Follow-up: Multi-format download dropdown (CSV, XLSX, SVG, PDF)** ✅ — upgraded the single CSV export button to a sleek **📥 Download ▾** dropdown menu offering 4 formats:
- **CSV (.csv)**: UTF-8 BOM comma-separated spreadsheet data.
- **Excel (.xlsx)**: Formatted XML spreadsheet workbook with bold headers, styled grid, number formatting, and totals.
- **SVG (.svg)**: Vector graphic summary card with dark gradient header, stats summary, and styled customer rows.
- **PDF (.pdf)**: Clean printable customer report with summary cards, table, and print/PDF save dialog.

### user

Add this same thing or fix these in the dashboard all download dropdowns. There are already many drop downs, but many of them is not working.

### agent

**Follow-up: Unified multi-format download dropdowns across Dashboard, Inventory, Customers & Modals** ✅:
- **Dashboard (Recent Invoices)**: Added **📥 Download ▾** with CSV, Excel (.xlsx), SVG Card, and printable PDF report.
- **Inventory Database**: Added **📥 Download ▾** with CSV, Excel (.xlsx), SVG Card, and printable PDF sheet.
- **Stock History Modal**: Fixed duplicate ID collisions and upgraded to the modern dropdown with CSV, Excel (.xlsx), SVG Chart, and PDF Report.
- **Customers Directory**: Fixed and isolated IDs to prevent conflicts across views.- **Unified Aesthetics**: All dropdowns feature sleek glassmorphic menus, responsive click-outside/escape-to-close behavior, and live filter/search query awareness.

### user

Add this same thing or fix these in the dashboard all download dropdowns in the Invoice Builder's Stock History — All Products, Stock History — All Products. Make it same like Customers Directory and Inventory Database, download dropdown.

### agent

**Follow-up: Stock History — All Products download dropdown aligned with Customers/Inventory** ✅

Fixed the Stock History modal (both "Stock History — All Products" from the dashboard cards / 📋 Full History and per-product history) so its **📥 Download ▾** dropdown behaves exactly like the Customers Directory and Inventory Database ones:
- **Same binding pattern**: menu items now use `data-format="csv|xlsx|svg|pdf"` and are wired through a single generic `.dropdown-item` handler → new `InventoryManager.handleHistoryDownload(format)` dispatcher (mirrors `handleDownload` / `handleProductsDownload`). Removed the old fragile per-ID bindings (`btn-export-history-*`) from `index.html` and `js/inventory.js`.
- **Real bug fixed**: `showAllHistory()` now also resets the **Type** filter when opening fresh. Previously, after opening "Sold This Month" (type = Sales) or any type filter, the "Stock History — All Products" view kept the stale filter — so it displayed *and exported* only a subset while the title said "All Products". Now it truly shows/exports everything.
- Verified: all `js/*.js` pass `node --check`.

Changes: `index.html` (dropdown items → data-format), `js/inventory.js` (generic binding + `handleHistoryDownload`, type-filter reset in `showAllHistory()`).

### user

Verify the download dropdowns in a live browser and fix anything that breaks

### agent

**Live browser verification — ALL CHECKS PASSED** ✅

Ran the app in **headless Microsoft Edge (151)** via CDP (static server + seeded IndexedDB) and exercised every download dropdown end-to-end:
- **Stock History — All Products** (opened from Invoice Builder dashboard card): title correct, Type filter resets to All Types on fresh open, menu opens with 4 items, **CSV** downloads `stock-history-all.csv` with correct header/rows/summary, **SVG Chart** downloads valid `stock-history-chart.svg`, **XLSX** downloads `stock-history-all.xlsx` (real workbook), **PDF** runs without throwing.
- **Per-product Stock History**: title shows product name, menu opens, CSV downloads `stock-history.csv`.
- **Customers Directory** and **Inventory Database**: menus open and CSV downloads `customers_2026-08-17.csv` / `inventory_2026-08-17.csv`.
- **Zero console errors** across the whole session.

No app bugs found — the dropdowns all work in a real browser. (Two earlier harness failures were test artifacts: a stale browser profile and an unseeded customer list, both fixed in the harness.)

### user

Fix these in the dashboard all download dropdowns in the Invoice Builder's Stock History — All Products, Stock History — All Products. Make it same like Customers Directory and Inventory Database, download dropdown. Goal: When the user tap on the downloads button, It opens a drop down but not like the customer options and inventory database. It looks like old like I haven't upgraded it. Middle all the download buttons and given the style like the customer option and inventory database.

### agent

**Visual bug found & fixed — Stock History dropdown now renders exactly like Customers/Inventory** ✅

Root cause (verified with pixel analysis of headless-browser screenshots): the Stock History modal's `.modal-body` is a scroll container (`overflow-x: auto`). The download menu is `position: absolute; right: 0` — with the toggle button sitting at the **left** of the wrapped filter bar, the 220px menu opened **leftward, 72px outside the modal card** (menu x=267 vs modal-body x=339). The clipped strip showed the dark modal overlay through it, so the menu rendered darker/flatter — the "looks old" appearance.

Fix: added `margin-left: auto` to `#history-download-dropdown` (`index.html`), pushing the 📥 Download button to the **right end** of the filter bar — same position as the Customers/Inventory toolbars — so the right-aligned menu now opens leftward **fully inside** the modal (menu x=778–998 within modal-body 339–1037).

Verified live: menu avg color rgb(44,55,73) / corner rgb(31,43,61) now **matches** the Customers menu (44,55,72 / 31,43,61) and Inventory menu (44,55,72 / 30,41,59); before the fix it was rgb(31,40,54) with a near-black clipped corner. All functional checks (toggle opens, 4 formats, CSV/SVG/XLSX downloads, PDF, per-product view, zero console errors) still pass.





