---
id: report-fmt02
status: open
type: feature
priority: 2
created: 2026-03-13T00:00:00Z
deps: [report-cmd01]
links: [report-fmt01]
parent: epic-bot01
tags: [reports, formatting, discord, forum]
---
# Dual Output Formats: Discord Table View and Forum Export

Add a second output format to `/dragon-stats` optimized for pasting into a WYSIWYG forum. The default output remains the Discord-native table view. Passing `forum` as a command option switches to the forum format.

## Command Usage

- `/dragon-stats` — default, Discord-native table view
- `/dragon-stats format:forum` — plain text formatted for pasting into a WYSIWYG forum

## Format 1: Discord Table View (default)

Use Discord's native formatting to present the data as a readable table without needing copy/paste. Options to explore:

- **Embeds** (`EmbedBuilder`) with fields for each section — renders with visual structure, titles, and footers
- **Slash command ephemeral reply** (visible only to the user who ran the command) so it doesn't clutter the channel

To document:
- [ ] Preferred Discord presentation (embed vs. code block vs. other)
- [ ] Which fields to show in each section
- [ ] Whether the reply should be ephemeral (private) or visible to the whole channel

## Format 2: Forum Export

Plain text output designed to be copied and pasted into a WYSIWYG forum editor and render correctly. Options depend on the target forum software.

**Forum:** Utopia Game (utopia-game.com) kingdom forum, using `jquery.wysiwyg`.

**Constraints identified from page source:**
- `insertTable` is disabled — no table support
- Bold, italic, underline, and h1 are available but content will be pasted as plain text
- Output should be plain text with consistent spacing/alignment that reads cleanly when pasted

**Format:** Plain text columns using spaces for alignment, same structure as the current code block output but without the code block wrapper. Dashes for section separators.

**Note:** Desktop only. Mobile forum strips newlines from pasted plain text. A separate HTML format for mobile is tracked in report-fmt03.

To document:
- [ ] Confirm plain text with space-aligned columns is acceptable, or if any other formatting is preferred

## Implementation Notes

- Add a `format` string option to the `/dragon-stats` slash command with choices `discord` (default) and `forum`
- Route to the appropriate formatter in `dragonReport.js` based on the option value
- Discord table view and forum export can live as separate functions in `dragonReport.js`

## Acceptance Criteria

- [ ] `/dragon-stats` produces Discord-native table view
- [ ] `/dragon-stats format:forum` produces forum-ready plain text
- [ ] Both formats cover the same data (donations + attacks sections)
- [ ] Discord table view fits within message limits without needing copy/paste
- [ ] Forum format is verified to paste and render correctly in the target forum
