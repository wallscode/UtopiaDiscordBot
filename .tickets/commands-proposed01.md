---
id: commands-proposed01
status: closed
type: task
priority: 1
created: 2026-03-14T00:00:00Z
deps: []
links: []
parent: epic-bot01
tags: [commands, planning, reporting]
---
# Proposed New Commands

Based on analysis of all channel data (aid, attackers, ritual, dragons, tms), the following commands are proposed. Mark each with [ ] to skip or [x] to implement.

## Data Sources Available

| Channel | What it captures |
|---------|-----------------|
| `dragons` | Dragon fund donations (gold, bushels) and dragon attacks (troops, points) |
| `aid` | Resource transfers between provinces (gold, bushels, soldiers, runes) |
| `attackers` | Military attacks — attacker, target, losses, kills, prisoners, loot, return time |
| `ritual` | Ritual casts per province with cumulative cast counter |
| `tms` | Espionage/thievery — mission type, target, success/fail, thieves lost, gold stolen |

---

## Proposed Commands

---

### `/activity` — Last Seen Tracker
**User's idea.** Shows the most recent timestamp of any action initiated by each province across all channels. Useful for identifying provinces that haven't logged in recently.

**Options:**
- `/activity` — list all provinces sorted by most recently active (newest first)
- `/activity province:<name>` — show only one province and their last action
- `/activity hours:<n>` — only show provinces with no activity in the last N hours (inactive filter)

**Output example:**
```
Province Activity (last seen)
----------------------------------------
Fun times          2026-03-13 14:22 UTC  [attack] 1 hour ago
Ill be there...    2026-03-13 12:10 UTC  [aid sent] 3 hours ago
Age of time        2026-03-01 08:44 UTC  [ritual]  240 hours ago
```

**Notes:**
- Only counts actions the province *initiated* (not receiving aid, not being attacked, not spells expiring)
- Channels counted: dragons, aid (sender only), attackers, ritual, tms, and general
- In the general channel only count lines that contain :star2: with either :green_heart: (indicating the successful cast of a self-spell) or :broken_heart: (indicating the failed cast of a self-spell)
- Only count actions posted by Utopiabot

---

### `/province-report` — Province Activity Summary
**User's idea.** Shows all actions taken by a specific province within a time window, with optional filtering by action type.

**Options:**
- `/province-report province:<name>` — all activity, all time
- `/province-report province:<name> period:<hours>` — filter by time window
- `/province-report province:<name> type:<attacks|aid|rituals|espionage|dragon|all>` — filter by action type

**Output example:**
```
Province Report: Fun times  (last 7 days)
----------------------------------------
DRAGON  2026-03-13  donated 134,906 gc
DRAGON  2026-03-13  donated 26,981 bushels
ATTACK  2026-03-12  attacked The apple itself — killed 359, lost 419 Goblins
AID     2026-03-11  sent 75 soldiers to Sushi Sampo Time
TMS     2026-03-10  rob the vaults vs Yoyoyoyo — SUCCESS, 17,208 gc stolen
RITUAL  2026-03-09  cast ritual (13 total)
```

**Notes:**
- Most detailed command — cross-channel view of one province's actions
- Could produce multiple Discord messages if the time window is large

---

### `/attack-stats` — Military Attack Summary
Shows combat statistics across the kingdom, ranked by activity.

**Options:**
- `/attack-stats` — kingdom-wide summary, all time
- `/attack-stats province:<name> period:<hours>` — stats for one province for the last X hours
- `/attack-stats period:<hours>` — all provinces filtered by time window

**Data shown per province:**
- Total attacks made
- Total kills (+ prisoners)
- Total troop losses (by unit type if desired)
- Total learning points earned
- Total specialist credits earned

**Output example:**
```
Attack Summary
----------------------------------------
Fun times        12 attacks  |  kills: 3,241  |  loss: 891 troops
Pee Time          9 attacks  |  kills: 2,180  |  loss: 460 troops
ticking time      8 attacks  |  kills: 2,100  |  loss: 332 troops
```

---

### `/aid-summary` — Resource Aid Summary
Shows who sent and received aid across the kingdom.

**Options:**
- `/aid-summary` — all aid sent/received, all provinces, all time
- `/aid-summary province:<name> period:<hours>` — aid sent and received by one province for the last X hours
- `/aid-summary period:<hours>` — all provinces filtered by time window
- `/aid-summary type:<gold|bushels|soldiers|runes>` — filter by resource type

**Data shown:**
- Total resources sent (by type) per province
- Total resources received (by type) per province
- Top senders and top receivers

**Output example:**
```
Aid Summary — Sent
----------------------------------------
Ill be there in a tick   600,000 gc  |  0 bushels  |  0 soldiers
Misstress Of Time        200,000 gc  |  0 bushels  |  0 soldiers

Aid Summary — Received
----------------------------------------
No Better Time           300,000 gc
Fun times                300,000 gc
```

---

### `/espionage-stats` — Thievery & Espionage Summary
Shows spy/thievery operation stats across the kingdom. The `tms` channel is the richest data source with success/failure tracking.

**Options:**
- `/espionage-stats` — kingdom-wide summary
- `/espionage-stats province:<name> period:<hours>` — one province's espionage record
- `/espionage-stats period:<hours>` — filter by time window
- `/espionage-stats type:<spy|rob|survey|arson|all>` — filter by operation type

**Data shown per province:**
- Total operations attempted
- Success count and failure count
- Success rate %
- Thieves lost on failures
- Total gold stolen (rob the vaults operations)

**Output example:**
```
Espionage Summary
----------------------------------------
No Better Time    42 ops  |  38 success  |  4 fail  |  90.5%  |  lost: 8 thieves
Pee Time          38 ops  |  36 success  |  2 fail  |  94.7%  |  lost: 0 thieves
ticking time      31 ops  |  28 success  |  3 fail  |  90.3%  |  gold stolen: 52,810
```

---

### `/ritual-stats` — Ritual Casting Summary
Shows ritual cast counts per province, ranked by activity.

**Options:**
- `/ritual-stats` — all provinces, total casts, sorted by count
- `/ritual-stats province:<name> period:<hours>` — one province's cast history for the last X hours
- `/ritual-stats period:<hours>` — all provinces filtered by time window

**Data shown:**
- Total rituals cast per province
- First cast date and most recent cast date

**Output example:**
```
Ritual Summary
----------------------------------------
Fun times              16 casts
RazorclawTime          14 casts
About time dude        12 casts
Misstress Of Time       1 cast
```

---

### `/kingdom-report` — Full Cross-Channel Province Report
A comprehensive single report for one province combining all data sources. The most detailed command.

**Options:**
- `/kingdom-report province:<name>` — full report, all time
- `/kingdom-report province:<name> period:<hours>` — filter by time

**Sections included:**
- Last seen timestamp
- Dragon contributions
- Aid sent and received
- Attack summary
- Espionage summary
- Ritual casts

**Notes:**
- Will likely require multiple Discord messages due to length
- Could support `format:forum` and `format:mobile-forum` like `/dragon-stats`

---

## Implementation Notes

- All commands that scan historical data should read from channel data stored in memory or local JSON (not re-fetch from Discord each time)
- This implies a new startup backfill that loads and parses all channels (aid, attackers, ritual, tms) similar to how dragons are handled today
- Each channel needs its own parser module and in-memory store
- The `period` option across all commands should accept a number of hours (e.g., 24, 48, 72)
- Province name matching should be case-insensitive

## Review Checklist

Mark each command with your decision:

- [x] `/activity` — last seen tracker
- [x] `/province-report` — per-province activity summary
- [x] `/attack-stats` — military attack summary
- [x] `/aid-summary` — resource aid summary
- [x] `/espionage-stats` — thievery/espionage summary
- [x] `/ritual-stats` — ritual casting summary
- [x] `/kingdom-report` — full cross-channel province report
