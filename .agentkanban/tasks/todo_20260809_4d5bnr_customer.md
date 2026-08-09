---
title: Customer
lane: todo
created: 2026-08-09T13:18:23.587Z
updated: 2026-08-09T13:18:23.587Z
description: Add a option called "Customers" in the middle of the dashboard and inventory database. I want the new button to go to a new page of my every customer name, email address, phone number, address, and there should be a filters, and bulk select email, phone number or address options. Also there should be a option called "Part time customer". By clicking it, the user can get the buyers, who buy products from the user the most.
priority: medium
assignee: Pritam Paul
sortOrder: 6
slug: customer
---

# Iteration 1

- [x] Add "Customers" nav link with Users icon between Dashboard and Inventory in the sidebar (`index.html`)
- [x] Add `customers` IndexedDB object store (DB_VERSION 2 → 3) with indexes on name, phone, email (`js/db.js`)
- [x] Include `customers` store in export/import backup (`js/db.js`)
- [x] Add Customers Directory view: stats cards, search + filter pills (All / ⭐ Part time customer / Has Email / Has Phone), bulk action bar, directory table, add/edit modal (`index.html`)
- [x] Implement `window.CustomersManager` module: load/sync from invoices, aggregation (total spent, invoice count, last order), filters, part-time (top buyers) ranking, bulk copy (emails/phones/addresses), bulk delete, add/edit/delete CRUD (`js/customers.js`)
- [x] Bootstrap `CustomersManager.init()` and refresh customers on navigation to `view-customers` (`js/app.js`)
- [x] Auto-sync/update customer record when an invoice is saved (`js/invoice.js`)
- [x] Add `Utils.escapeHTML()` for XSS-safe rendering (`js/utils.js`)
- [x] Add customer styles: filter pills, part-time highlight, bulk action bar, selected rows, badges, address clamp (`css/style.css`)
- [x] Clear `customers` store on "Reset All Data" (`js/profile.js`)
- [x] Syntax-check all JS files (`node --check`) — all pass
- [x] Append agent summary to task file and update frontmatter timestamp

# Iteration 2

- [x] Add Purchase History modal (`#modal-customer-history`) with summary strip + invoices table (`index.html`)
- [x] Open history on customer row click or 📋 button; ignore links/checkboxes/buttons/checkbox-column (`js/customers.js`)
- [x] `openPurchaseHistory()` — match invoices by name OR phone, sort desc, render summary + rows (`js/customers.js`)
- [x] `viewCustomerInvoice()` — verify invoice exists, navigate to dashboard, reuse `InvoiceManager.viewInvoice` (`js/customers.js`)
- [x] Style summary strip + clickable rows (`css/style.css`)
- [x] Syntax-check all JS files (`node --check`) — all pass
- [x] Append agent summary to task file and update frontmatter timestamp

# Iteration 3

- [x] Add Export CSV button (`#btn-export-customers-csv`) to the Customers toolbar (`index.html`)
- [x] `exportCSV()` — export current filtered list with CSV escaping + UTF-8 BOM + Blob download + toast (`js/customers.js`)
- [x] Bind export button in `bindEvents()` (`js/customers.js`)
- [x] Syntax-check (`node --check`) and verify code state
- [x] Append agent summary to task file and update frontmatter timestamp
