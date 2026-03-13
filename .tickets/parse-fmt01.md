---
id: parse-fmt01
status: open
type: task
priority: 1
created: 2026-03-12T00:00:00Z
deps: []
links: [parse-agg01]
parent: epic-bot01
tags: [parsing, format, documentation]
---
# Document Message Format and Parsing Rules

Define the exact format of messages posted by the source bot that this bot needs to parse, and specify the parsing rules and data model.

## To Document

- Which channels will be monitored (exact channel names)
- The bot user ID or username of the source bot (so we filter only its messages)
- Example raw message strings showing all possible formats
- Which fields to extract from each message (e.g., player name, action type, value, timestamp)
- Edge cases: multi-line messages, embeds vs plain text, variations in format

## Example Section (fill in)

```
Channel: #channel-name-here

Example message 1:
<paste raw message>

Fields extracted:
- player:
- action:
- value:

Example message 2:
...
```

## Acceptance Criteria

- [ ] At least 3 representative example messages documented
- [ ] All fields to extract are named and typed
- [ ] Channel list finalized
- [ ] Source bot identified for filtering
