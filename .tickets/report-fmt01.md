---
id: report-fmt01
status: open
type: task
priority: 1
created: 2026-03-12T00:00:00Z
deps: [parse-fmt01]
links: [report-cmd01]
parent: epic-bot01
tags: [reports, format, documentation]
---
# Document Report Output Format

Define exactly what each report should look like when posted to Discord.

## To Document

- How many distinct report types are needed
- For each report type:
  - What data it shows (which fields from the aggregated data)
  - How it's sorted/ranked (e.g., top 10 by score, chronological)
  - Time window (all-time, last 7 days, since last reset, etc.)
  - Formatting: plain text, Discord markdown (bold, code blocks), or Discord embeds
  - Any groupings or sections within the report

## Example Section (fill in)

```
Report: <report name>

Example output:
--- paste what you'd want the bot to post ---

Notes:
- Sorted by:
- Time window:
- Reset behavior:
```

## Discord Formatting Options

- Plain text in a message (2000 char limit)
- Code block (``` ``` ```) for monospace alignment
- Bold/italic markdown
- Discord embed (title, fields, footer — via `EmbedBuilder`)
- Multiple messages if output exceeds 2000 chars

## Acceptance Criteria

- [ ] All desired report types documented with examples
- [ ] Discord character limits considered
- [ ] Sorting and time-window rules specified per report type
