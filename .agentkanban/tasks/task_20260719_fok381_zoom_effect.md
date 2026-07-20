---
title: Zoom effect
lane: done
created: 2026-07-19T11:10:52.031Z
updated: 2026-07-20T10:00:00.000Z
description: Add 3D zoom effect while hovering on items (macOS dock-style magnification)
priority: low
assignee: Pritam Paul
sortOrder: 1
slug: "zoom_effect\r"
---


## Conversation

### user

Add 3D zoom effect while hovering on sidebar buttons; invoice builder page product, sold this month, restocked this month, low stock items, and hovering recent invoices and inventory products like hovering on Apple macOS dock. Use SKILL.md.

### Implementation Summary

**CSS Changes (css/style.css):**
- Added cubic-bezier transitions for smooth 3D transforms on `.nav-link`, `.stat-card`, and `.data-table tbody tr`
- Hover states now handled exclusively by JavaScript to avoid CSS/JS conflicts

**JavaScript Changes (js/app.js):**
- Added `setupDockEffect()` function implementing macOS dock-style magnification
- Adjacent elements scale up proportionally based on mouse proximity (150px range)
- Elements closer to cursor get: `translateY(-X) scale(X) rotateX(Xdeg)` transforms + dynamic box-shadow
- Respects `prefers-reduced-motion` media query for accessibility
- Applies to:
  - Sidebar navigation buttons
  - Dashboard stat cards (Products, Sold This Month, Restocked This Month, Low Stock Items)
  - Invoice builder line items table rows
  - Recent invoices table rows
  - Inventory products table rows

**Files Modified:**
- `css/style.css`
- `js/app.js`

**Accessibility:** Dock effect disabled when user prefers reduced motion.
