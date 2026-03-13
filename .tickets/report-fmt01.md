---
id: report-fmt01
status: closed
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
Report: Dragon Summary

Example output:
Dragon Summary

Gold Coins & Food Donated:
----------------------------------------
Ill be there in a tick         442,125 gc & 50,000 bushels
Tea time                       400,000 gc & 40,000 bushels
Stewies Time Machine           390,000 gc & 39,000 bushels
About time dude                384,000 gc & 38,400 bushels
your time is up Give in        271,566 gc & 27,156 bushels
Father time                    251,000 gc & 25,100 bushels
Slack Time                     248,000
Fun times                      242,000
Misstress Of Time              240,001
ticking time                   239,547
Time                           221,000
RazorclawTime                  220,000
Sushi Sampo Time               161,380
Time to Shine                  154,114
Pee Time                       150,000
Time to play                   122,502
No Better Time                 88,155
Timeless Rock Band             75,000
Slow Attack times              67,498
Waste of Time                  58,925
Time Manipulator               40,000
Its 5 OClock Somewhere         22,900
Age of time                    0

Total                          4,489,713

Troops Sent and Points Weakened:
----------------------------------------
Fun times                      Points: 12,899   Troops: 1,477
Ill be there in a tick         Points: 9,581   Troops: 871
Stewies Time Machine           Points: 7,004   Troops: 844
RazorclawTime                  Points: 6,931   Troops: 500
ticking time                   Points: 6,689   Troops: 500
Time                           Points: 6,490   Troops: 929
Time to play                   Points: 6,400   Troops: 400
Tea time                       Points: 6,190   Troops: 300
Pee Time                       Points: 6,072   Troops: 485
No Better Time                 Points: 5,917   Troops: 614
your time is up Give in        Points: 5,508   Troops: 468
Sushi Sampo Time               Points: 5,118   Troops: 363
Slack Time                     Points: 5,065   Troops: 393
Father time                    Points: 4,857   Troops: 467
Misstress Of Time              Points: 3,841   Troops: 400
Timeless Rock Band             Points: 2,333   Troops: 182
Time Manipulator               Points: 2,174   Troops: 108
Time to Shine                  Points: 2,120   Troops: 102
Waste of Time                  Points: 0   Troops: 0
Slow Attack times              Points: 0   Troops: 0
About time dude                Points: 0   Troops: 0
Its 5 OClock Somewhere         Points: 0   Troops: 0
Age of time                    Points: 0   Troops: 0

Notes:
- Sorted by: Gold Donated (highest first) then by bushels donated (highest first) then by province name alphabetically for the Gold Coins and Food donated section.  Sort the Troops Sent and Points Weakened by Points (highest first) then by province name alphabetically.
- Time window: All time unless specified otherwise
- Reset behavior: Not specified
```

## Discord Formatting Options

- Plain text in a message (2000 char limit)
- Code block (``` ``` ```) for monospace alignment
- Bold/italic markdown
- Discord embed (title, fields, footer — via `EmbedBuilder`)
- Multiple messages if output exceeds 2000 chars

## Acceptance Criteria

- [x] All desired report types documented with examples
- [x] Discord character limits considered (two messages: donation section + attack section)
- [x] Sorting and time-window rules specified per report type
