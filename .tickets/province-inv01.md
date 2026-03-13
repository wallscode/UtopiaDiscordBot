---
id: province-inv01
status: open
type: epic
priority: 1
created: 2026-03-13T00:00:00Z
deps: []
links: [parse-agg01, report-cmd01]
parent: epic-bot01
tags: [provinces, inventory, general-channel]
---
# Province Inventory

Build and maintain a local inventory of all provinces in the kingdom by parsing messages from the general channel. The inventory is used to ensure the dragon summary report lists all known provinces, even those with no recent dragon activity.

## Child Tickets

- province-inv02: Document general channel message format and province name extraction rules
- province-inv03: Province inventory store (local persistence)
- province-inv04: Backfill general channel on refresh (48-hour lookback)
- province-inv05: `/provinces` command with optional `refresh` parameter
- province-inv06: Integrate province inventory into dragon summary report

## Acceptance Criteria

- [ ] Province inventory is built from general channel messages
- [ ] `/provinces` displays the current inventory
- [ ] `/provinces refresh` rebuilds the inventory from the last 48 hours (admin only)
- [ ] Dragon summary report uses the inventory to include all known provinces
