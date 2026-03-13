---
id: province-inv04
status: open
type: feature
priority: 2
created: 2026-03-13T00:00:00Z
deps: [province-inv02, province-inv03]
links: []
parent: province-inv01
tags: [provinces, backfill, general-channel]
---
# Backfill General Channel on Refresh (48-Hour Lookback)

On a refresh event, fetch the last 48 hours of messages from the general channel, extract all province names, and rebuild the inventory.

## Design Notes

- Use same paging approach as the dragon channel backfill (fetch 100 messages at a time, page until 48-hour boundary is reached)
- Deduplicate province names (a province may appear in many messages)
- Rebuild the full inventory from scratch — do not merge with existing data
- Log how many unique provinces were found

## Acceptance Criteria

- [ ] Fetches all messages from the last 48 hours in the general channel
- [ ] Stops paging once messages are older than 48 hours
- [ ] Deduplicates province names
- [ ] Calls `rebuild()` on the province store with the resulting list
- [ ] Logs count of unique provinces found
