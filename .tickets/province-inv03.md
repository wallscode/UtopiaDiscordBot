---
id: province-inv03
status: open
type: feature
priority: 2
created: 2026-03-13T00:00:00Z
deps: [province-inv02]
links: []
parent: province-inv01
tags: [provinces, storage, persistence]
---
# Province Inventory Store

Implement local persistent storage for the province inventory.

## Design Notes

- Store as a JSON file at `data/provinces.json`
- Each entry represents one known province
- Inventory is rebuilt from scratch on refresh — not incrementally updated
- The store should expose a simple API: `load()`, `save()`, `getAll()`, `rebuild(provinces[])`

## Data Model

```json
{
  "updatedAt": "2026-03-13T00:00:00Z",
  "provinces": [
    "Province Name One",
    "Province Name Two"
  ]
}
```

## Acceptance Criteria

- [ ] Province list persists across bot restarts
- [ ] `rebuild()` replaces the full list atomically
- [ ] `updatedAt` timestamp recorded on each rebuild
