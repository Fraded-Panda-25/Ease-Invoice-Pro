# Changelog

All notable changes to **Ease Invoice** are documented in this file.

The project follows a practical changelog format based on completed features, improvements, fixes, and documentation changes.

---

## [Unreleased]

### Planned

* Continued improvements to invoicing and inventory workflows
* Additional usability and accessibility refinements
* Further performance and UI improvements

---

## [2026-09-12]

### ✨ Added

* Added a descriptive SEO meta description to the application shell.
* Improved search-engine snippets and social-sharing previews.

### 📝 Changed

* Updated the browser page title to better represent Ease Invoice and its GST invoicing and inventory-management functionality.

---

## [2026-09-11]

### 🎨 Changed

* Added a dedicated application favicon.
* Removed the previous SVG icon asset.
* Cleaned up and reformatted the main HTML structure for better readability and consistency.
* Improved organization of sidebar, inventory, customer, settings, and modal markup.

### 🛠️ Developer Experience

* Added a project SVG icon.
* Updated VS Code workspace settings for improved editor appearance.

---

## [2026-08-26]

### 📝 Documentation

* Added `CONTRIBUTING.md` with contribution guidelines.
* Simplified the contribution documentation by removing outdated build-process and project-origin details.

---

## [2026-08-23]

### ⚖️ Licensing

* Updated the project license to **Apache License 2.0**.
* Updated copyright information to reflect the current project ownership and year.

---

## [2026-08-18]

### 📚 Documentation

* Updated the README with clearer installation and usage instructions.
* Improved README terminology by changing "Use case" headings to "Option".
* Updated repository clone instructions.
* Updated the hosted application link.

### 🧹 Maintenance

* Removed the obsolete `CNAME` configuration.
* Removed the `.agentkanban` directory from the project.
* Improved the VS Code spell-check dictionary with project-specific terminology.

### 🧩 Developer Tooling

* Added and refined AI-agent instructions and development documentation.
* Added project-specific `.github` prompt/instruction files.
* Established `AGENTS.md` as the canonical AI-agent context and development guide.

---

## [2026-08-17]

### 👥 Customer Management

* Added interactive customer statistics cards.
* Added actions for:

  * Viewing all customers
  * Viewing active buyers
  * Viewing the top buyer
* Added customer purchase-history navigation from the top-buyer statistic.
* Added appropriate empty-state feedback through toast notifications.

### 📤 Customer Exports

* Added a customer download dropdown.
* Added customer export formats:

  * CSV
  * XLSX
  * SVG
  * PDF
* Added keyboard/accessibility handling for the download menu, including `Escape` support and `aria-expanded`.

### 📦 Inventory & Stock History

* Unified Stock History download controls with the Inventory and Customer interfaces.
* Added multi-format Stock History exports:

  * CSV
  * XLSX
  * SVG
  * PDF
* Fixed the product-type filter when opening **All Products** so exports include the complete dataset.

### 📊 Stock Activity Chart

* Improved Stock History chart layout and readability.
* Added clearer value and date labels.
* Added visual distinction between sold and restocked quantities.
* Improved product-name positioning.
* Increased chart height and adjusted spacing.

### 💬 UX Improvements

* Added custom interactive tooltips to the stock activity chart.
* Tooltips now provide additional product information when available, including company and size/variant.
* Removed native SVG browser tooltips in favor of the custom tooltip system.
* Improved tooltip positioning and viewport handling.

### 🧹 Maintenance

* Removed obsolete AgentKanban task files and related project clutter.
* Improved graph visualization tooling and relation filtering.

---

## [2026-08-12]

### 👥 Customer Management

* Connected customer statistics cards to functional actions.
* Added customer filtering and search resets when switching between customer-stat views.
* Added direct access to top-buyer purchase history.
* Added feedback when no top-buyer history is available.

### 🎨 UI

* Adjusted main navigation spacing for a more consistent layout across the application.

---


## Versioning

### Version 2.0 (Latest)

## What's Changed
* Items auto-suggestion by @Fraded-Panda-25 in https://github.com/Fraded-Panda-25/Ease-Invoice-Pro/pull/1
* Column autofit by @Fraded-Panda-25 in https://github.com/Fraded-Panda-25/Ease-Invoice-Pro/pull/2
* Low stock notification fix by @Fraded-Panda-25 in https://github.com/Fraded-Panda-25/Ease-Invoice-Pro/pull/3
* Merge my project. by @Fraded-Panda-25 in https://github.com/Fraded-Panda-25/Ease-Invoice-Pro/pull/4
* Customer option by @Fraded-Panda-25 in https://github.com/Fraded-Panda-25/Ease-Invoice-Pro/pull/6
* Update editor spellcheck dictionary by @Fraded-Panda-25 in https://github.com/Fraded-Panda-25/Ease-Invoice-Pro/pull/7

## New Contributors
* @Fraded-Panda-25 made their first contribution in https://github.com/Fraded-Panda-25/Ease-Invoice-Pro/pull/1

**Full Changelog**: https://github.com/Fraded-Panda-25/Ease-Invoice-Pro/commits/2.0


---


### Version 3.0 (Pre-release)

Formal semantic versions have not yet been assigned to the project.

Future releases may adopt a versioning scheme and auto-save features.

---
