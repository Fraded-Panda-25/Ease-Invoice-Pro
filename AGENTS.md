# 🤖 Ease Invoice — Agents Guide

> **Supercharge your development workflow with AI agents.**  
> From automated code reviews to knowledge-graph-powered codebase queries — this guide shows you how to configure, use, and extend agents for the Ease Invoice project.

---

## 📌 Why Agents for This Repo?

Ease Invoice is a pure vanilla JavaScript (no framework) single-page application. While simple in structure, it has **multiple interconnected modules** (inventory, invoicing, profile, database, UI) that benefit enormously from agent-driven tooling:

| Benefit | How Agents Help |
|---|---|
| ⚡ **Automation** | Auto-generate invoices, validate inventory rules, run sanity checks on save |
| 🧠 **Queryable Knowledge Graphs** | Map out module relationships, data flow, and DOM ↔ JS bindings without reading every file |
| 🛠️ **Coding Assistance** | AI-powered code completion (Cursor, Copilot) tuned to this repo's vanilla JS patterns |
| ✅ **Consistency** | Enforce coding conventions (`window.*Manager` globals, `Utils.*` helpers, `async/await` DB calls) |
| 🔍 **Debugging** | Quickly trace data flow from a `click` event through `db.js` to IndexedDB |

---

## ⚙️ Setup Section

### 🔹 Claude Code (Recommended)

Create a `.claude.md` file in the project root:

```markdown
# Ease Invoice — Agent Instructions

You are an AI assistant for the Ease Invoice project.

## Project Overview
- Vanilla HTML/CSS/JS single-page app (no framework)
- Data stored in IndexedDB via `js/db.js`
- Global module pattern: `window.*Manager` (InvoiceManager, InventoryManager, ProfileManager)
- Utility library: `window.Utils`
- Currency: Indian Rupee (INR) — use `Utils.formatCurrency()`

## Conventions
- UUID v4 for all record IDs via `Utils.generateUUID()`
- Async/await for DB operations
- Toast notifications via `Utils.showToast(msg, type)`
- Escape HTML output with `Manager.escapeHTML()` to prevent XSS
- Import/export uses JSON blobs via `appDB.exportData()` / `appDB.importData()`

## Key Files
- `index.html` — Single-page shell with all views
- `css/style.css` — Theme system (dark/light) + print styles
- `js/app.js` — Bootstrap, navigation routing, theme toggle
- `js/db.js` — IndexedDB wrapper (profile, products, invoices stores)
- `js/invoice.js` — Invoice builder, line items, print, history
- `js/inventory.js` — Product CRUD, stock tracking, search
- `js/profile.js` — Business profile, logo upload, data export/import
- `js/utils.js` — Shared utilities

## Agent Behavior
- Prefer `read_files` to understand DOM structure before suggesting changes
- When generating new features, maintain the `window.*Manager` global pattern
- Always validate HTML IDs exist before referencing them in JS
- Suggest print-friendly styling for any new invoice-related features
```

### 🔹 GitHub Copilot

Add a `.github/copilot-instructions.md` file:

````markdown
## Ease Invoice — Copilot Instructions

### Code Style
- Use `const` / `let` (no `var`)
- Prefer `async/await` over `.then()`
- Use `Utils.formatCurrency()` for all monetary display
- Use single quotes for strings

### Architecture
- Each module is a singleton object in a `window.*Manager` global
- Database calls go through `window.appDB` (IndexedDB wrapper)
- UI event bindings happen in `bindEvents()` methods

### Common Patterns
```javascript
// New manager module (example)
const MyManager = {
    async init() {
        this.bindEvents();
        await this.loadData();
    },
    async loadData() {
        this.data = await window.appDB.getAll('storeName');
    },
    bindEvents() {
        document.getElementById('my-btn').addEventListener('click', () => { ... });
    }
};
window.MyManager = MyManager;
```
````

### 🔹 Cursor

Add `.cursorrules` to the project root:

```
You are a Cursor AI agent for the Ease Invoice project.
This is a vanilla JS SPA using IndexedDB for storage.
All money values use INR formatting via Utils.formatCurrency().
HTML element IDs are the source of truth for DOM references.
Use the global `window.appDB` object for all database operations.
Each feature module is a singleton exported as `window.FeatureManager`.
```

### 🔹 Gemini CLI (Google)

Add a `.gemini.yml` in the project root:

```yaml
project: Ease Invoice
description: "Free, client-side invoicing and inventory management SPA"
language: javascript
framework: vanilla
conventions:
  - "window.*Manager global pattern for modules"
  - "Utils.* for shared helpers"
  - "async/await for IndexedDB operations"
  - "INR currency formatting"
instructions_file: .claude.md
```

> 💡 **Tip:** You only need **one** of these config files — `.claude.md` is the most complete. The others are listed so you can pick whichever editor/CLI you prefer.

---

## 🧩 Agent Roles Table

| Agent Name | Role | Description | File Focus |
|---|---|---|---|
| **GraphAgent** 🕸️ | Knowledge Graph Builder | Builds a queryable graph of module dependencies, DOM ↔ JS bindings, and data flow | All `.js`, `index.html` |
| **SchemaAgent** 🗃️ | Schema Validator | Validates IndexedDB object stores, ensures `put()` data matches expected shapes | `js/db.js`, `js/invoice.js`, `js/inventory.js` |
| **DocAgent** 📖 | Documentation Helper | Reads source code and generates/updates Markdown docs, JSDoc comments, READMEs | All files |
| **MediaAgent** 🎨 | Multimedia Assistant | Optimizes logo uploads, generates placeholder images, handles base64 encoding | `js/profile.js`, `css/style.css` |
| **PrintAgent** 🖨️ | Print Layout Tester | Validates print CSS rules, tests A4 formatting for invoices | `css/style.css`, `index.html` |
| **ThemeAgent** 🌗 | Theme System Guardian | Ensures dark/light theme consistency, checks CSS custom property usage | `css/style.css`, `js/app.js` |
| **DataAgent** 💾 | Backup & Restore Validator | Tests export/import JSON round-trips, validates data integrity | `js/db.js`, `js/profile.js` |
| **StockAgent** 📦 | Inventory Rule Enforcer | Validates stock deduction on invoice save, low-stock alert logic | `js/inventory.js`, `js/invoice.js` |
| **DataAgent** 💾 | Backup & Restore Validator | Tests export/import JSON round-trips, validates data integrity | `js/db.js`, `js/profile.js` |

### Agent Configuration Example (JSON)

For tools that accept JSON-based agent configs (e.g., custom VS Code tasks, GitHub Actions):

```json
{
  "agents": {
    "graph-agent": {
      "name": "GraphAgent",
      "description": "Build knowledge graphs of the Ease Invoice codebase",
      "prompt": "Analyze the full codebase and produce a dependency graph showing how the HTML views, JS modules, and IndexedDB stores connect."
    },
    "schema-agent": {
      "name": "SchemaAgent",
      "description": "Validate IndexedDB record shapes",
      "prompt": "Check that all put() calls to the 'invoices' and 'products' stores include the correct fields matching the defined schema."
    },
    "doc-agent": {
      "name": "DocAgent",
      "description": "Generate and update documentation",
      "prompt": "Read the source files and update the corresponding documentation files."
    },
    "media-agent": {
      "name": "MediaAgent",
      "description": "Handle image and multimedia assets",
      "prompt": "Optimize images, generate placeholders, or validate base64 encoding."
    }
  }
}
```

---

## 🔗 Integration Tips

### 🖥️ VS Code

1. **Install [Continue](https://marketplace.visualstudio.com/items?itemName=Continue.continue)** — an open-source AI code assistant
   - Point it at `.claude.md` for project context
   - Use `@docs` to reference `MDN` or `IndexedDB` docs in chat

2. **Install [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)** with `copilot-instructions.md`
   - Copilot will automatically reference your custom instructions file

3. **Use Tasks** (`.vscode/tasks.json`) to trigger custom agent scripts:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "GraphAgent: Build Knowledge Graph",
      "type": "shell",
      "command": "npx graphify init && npx graphify build --dir .",
      "problemMatcher": []
    },
    {
      "label": "DocAgent: Update Docs",
      "type": "shell",
      "command": "npx agent-doc --source js/ --output docs/",
      "problemMatcher": []
    }
  ]
}
```

### 🤖 GitHub Actions

Trigger automated agent workflows on push or schedule:

```yaml
# .github/workflows/codebase-graph.yml
name: 🕸️ Build Knowledge Graph
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  graph:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build codebase graph
        run: npx graphify init && npx graphify build --dir .
      - name: Upload graph artifact
        uses: actions/upload-artifact@v4
        with:
          name: knowledge-graph
          path: graphify-out/
```

```yaml
# .github/workflows/agent-review.yml
name: 🤖 AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run SchemaAgent validation
        run: npx agent-schema --store products,invoices --dir js/
```

### ⌨️ CLI Usage

Run agents directly from the terminal using Node.js-based agent runners:

```bash
# Build a knowledge graph of the entire codebase
npx graphify init && npx graphify build --dir .

# Query the graph (example)
npx graphify query "What modules touch the 'invoices' IndexedDB store?"

# Run a documentation agent
npx agent-doc --source js/ --output docs/ --format markdown

# Validate data schemas (conceptual example — adapt to your preferred validator)
npx ajv validate -s schema.json -d data.json
# Or with a custom script:
node scripts/validate-schema.js --store products
```

#### Agent-Specific Quick Examples

```bash
# StockAgent — Check low-stock products in the database
node -e "
  const request = indexedDB.open('EaseInvoiceDB', 1);
  request.onsuccess = (e) => {
    const tx = e.target.result.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    store.getAll().onsuccess = (ev) => {
      const lowStock = ev.target.result.filter(p => p.stockQty <= p.lowStockThreshold);
      console.log('Low stock items:', lowStock.map(p => p.name));
    };
  };
"

# DataAgent — Verify export/import round-trip integrity
node scripts/verify-backup.js EaseInvoice_Backup_*.json
```

---

## 🚀 Future Expansion

| Feature | Description | Why It Matters |
|---|---|---|
| 🧠 **AI-Driven Schema Linking** | Agents automatically detect relationships between IndexedDB stores (e.g., `invoices.items[].productId` ↔ `products.id`) and generate relationship diagrams | Eliminates manual documentation — always up-to-date |
| 🎥 **Multimedia Graph Queries** | Query the knowledge graph using images or voice: *"Show me where the invoice logo upload flows through the codebase"* | Makes the codebase explorable by non-devs (domain experts, testers) |
| 🔁 **Auto-Migration Agent** | When you change a data schema, an agent auto-generates IndexedDB version upgrade scripts | Prevents data loss during development |
| 📊 **Agent Dashboard** | A local web dashboard showing agent activity logs, graph visualizations, and schema validation reports | Centralized observability for all agent operations |
| 🧪 **Test Generation Agent** | Reads `bindEvents()` and `save*()` methods, then auto-generates Playwright test scripts for critical user flows | Drastically reduces manual QA effort |
| 🌐 **Multi-Language Agent** | Translates the UI text (invoice labels, form fields) using an agent that reads `index.html` and generates locale JSON files | Makes internationalization a one-command task |

---

## 💡 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/your-username/ease-invoice.git
cd ease-invoice

# 2. (Optional) Initialize the knowledge graph
npx graphify init && npx graphify build --dir .

# 3. Open with your agent-ready editor
code .   # VS Code + Continue / Copilot
```

> **Pro Tip:** Drop the `.claude.md` file into your project root before opening it with any AI-powered editor — it instantly gives your agents full context about Ease Invoice's architecture, conventions, and data model.

---

## 📚 Related Resources

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code) — Anthropic's official guide
- [GitHub Copilot Custom Instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot) — Official docs
- [Continue.dev](https://docs.continue.dev/) — Open-source AI code assistant
- [IndexedDB API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — Reference for the underlying storage

---

<p align="center">
  <sub>Built with ❤️ for developers who love AI-assisted workflows</sub>
  <br>
  <sub>Ease Invoice · MIT License</sub>
</p>
