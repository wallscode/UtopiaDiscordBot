---
id: parse-agg01
status: closed
type: feature
priority: 2
created: 2026-03-12T00:00:00Z
deps: [parse-fmt01, setup-env01]
links: []
parent: epic-bot01
tags: [parsing, aggregation, storage]
---
# Data Aggregation and Storage Layer

Implement the logic to parse incoming messages and accumulate player data for report generation.

## Design Notes

- The bot listens to the `messageCreate` event on discord.js
- Filter to only process messages from the source bot in the monitored channels
- Parse each matching message using regex or string patterns defined in parse-fmt01
- Store aggregated data in-memory (simplest start) or persist to a local file/SQLite DB (needed to survive restarts)
- Data model should map player names to their aggregated stats

## Storage Options (decide based on parse-fmt01 output)

| Option | Pros | Cons |
|--------|------|------|
| In-memory (plain object) | Zero setup | Lost on restart |
| JSON file | Simple persistence, human-readable | Not great for frequent writes |
| SQLite (better-sqlite3) | Durable, queryable | More setup |

## Acceptance Criteria

- [ ] Bot correctly identifies messages from the source bot
- [ ] Bot ignores messages from other users/bots
- [ ] Parsed data matches examples in parse-fmt01
- [ ] Aggregated stats survive bot restarts (if persistence chosen)
- [ ] Unit test with example messages from parse-fmt01
