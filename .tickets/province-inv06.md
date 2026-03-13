---
id: province-inv06
status: open
type: feature
priority: 3
created: 2026-03-13T00:00:00Z
deps: [province-inv03, parse-agg01]
links: []
parent: province-inv01
tags: [provinces, dragon-summary, reporting]
---
# Integrate Province Inventory into Dragon Summary Report

Use the province inventory as the authoritative list of provinces when generating the dragon summary report, so that provinces with no recent dragon activity still appear in the report with zero values.

## Design Notes

- When generating the dragon summary, take the union of:
  - Provinces in the dragon store (have activity)
  - Provinces in the province inventory (all known provinces)
- Provinces in the inventory but not the dragon store should appear with all zeros
- Provinces in the dragon store but not the inventory should still appear (inventory may be stale)

## Acceptance Criteria

- [ ] Dragon summary includes all provinces from the inventory
- [ ] Provinces with no dragon activity show zeros in both sections
- [ ] Report still works correctly if inventory is empty (falls back to dragon store only)
