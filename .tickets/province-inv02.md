---
id: province-inv02
status: open
type: task
priority: 1
created: 2026-03-13T00:00:00Z
deps: []
links: [province-inv03]
parent: province-inv01
tags: [provinces, format, documentation, general-channel]
---
# Document General Channel Message Format and Province Name Extraction

Define which messages in the general channel contain province names and how to extract them.

## To Document

- Exact name of the general channel
- Source bot username (same utopiabot, or different?)
- Example raw messages that contain province names
- Which part of the message is the province name
- Whether province names can appear in multiple message types
- Any edge cases (e.g., province names with special characters, URL encoding like in the dragon channel)

## Example Section (fill in)

```
Channel: #general

Example message 1:
:star2::green_heart: About time dude about time dud#  <<fertile lands>> 21 | 12.1% guilds (60% BE (m.7.3))

Province name extracted:
-About time dude
Note that the province name is in the format <<province name>> and if it contains a repeat of the same text with the last character replaced with # then that indicates that the repeat text can be ignored.  So in the example above, "about time dude" is the province name.

Example message 2:
<paste raw message>

Province name extracted:
-
```

## Acceptance Criteria

- [ ] Channel name confirmed
- [ ] Source bot identified
- [ ] At least 3 example messages documented
- [ ] Province name extraction rule defined (field position, regex, etc.)
- [ ] Edge cases noted
