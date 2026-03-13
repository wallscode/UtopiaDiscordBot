---
id: report-fmt03
status: open
type: feature
priority: 3
created: 2026-03-13T00:00:00Z
deps: [report-fmt02]
links: [report-fmt02]
parent: epic-bot01
tags: [reports, formatting, mobile, html, forum]
---
# Mobile Forum Export Format (HTML)

Add a `/dragon-stats format:mobile-forum` output mode that produces raw HTML. This is needed because the Utopia Game mobile forum WYSIWYG editor strips newlines from pasted plain text, but does accept pasted raw HTML and renders it correctly.

## Command Usage

- `/dragon-stats format:mobile-forum` — HTML output for pasting into the mobile forum editor

## Context

- Desktop forum: plain text with space-aligned columns pastes and renders correctly (spaces preserved)
- Mobile forum: strips all newlines from pasted plain text, making the desktop format unusable
- Mobile forum WYSIWYG does accept raw HTML paste and retains formatting

## Format Requirements

The HTML output should produce the same visual structure as the desktop forum format:
- Section headers
- Space-aligned or table-based columns for province name + stats
- Separator lines between sections
- Total row at the bottom of the donations section

## Implementation Notes

- Since the mobile editor accepts HTML, we can use `<table>` tags for proper column alignment — no need to fake it with spaces
- Output should be a raw HTML string the user can copy from Discord and paste into the mobile editor
- Discord message should wrap the HTML in a code block so it displays as copyable text rather than being interpreted as markdown
- Consider whether `<br>` tags or `<p>` tags work better for line breaks in that editor

## To Document

- [ ] Confirm `<table>` HTML pastes and renders correctly in the mobile editor
- [ ] Confirm which HTML tags render correctly (table, br, p, b, etc.)
- [ ] Desired visual structure for the HTML version

## Acceptance Criteria

- [ ] `/dragon-stats format:mobile-forum` posts raw HTML wrapped in a Discord code block
- [ ] Pasting the HTML into the mobile forum editor renders the full report with correct structure
- [ ] Column alignment is maintained in the rendered forum post
