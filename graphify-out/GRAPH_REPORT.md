# Graph Report - .  (2026-07-19)

## Corpus Check
- Corpus is ~7,595 words - fits in a single context window. You may not need a graph.

## Summary
- 24 nodes · 21 edges · 7 communities (2 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Database Core
- Inventory Manager
- Invoice Builder
- Profile Manager
- Utility Library

## God Nodes (most connected - your core abstractions)
1. `Database` - 10 edges
2. `InventoryManager` - 1 edges
3. `InvoiceManager` - 1 edges
4. `ProfileManager` - 1 edges
5. `Utils` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (7 total, 5 thin omitted)

## Knowledge Gaps
- **4 isolated node(s):** `InventoryManager`, `InvoiceManager`, `ProfileManager`, `Utils`
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Database` connect `Database Core` to `Database Utils`?**
  _High betweenness centrality (0.164) - this node is a cross-community bridge._
- **What connects `InventoryManager`, `InvoiceManager`, `ProfileManager` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._