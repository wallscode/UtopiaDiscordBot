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
Channel: #general (confirm exact name)

Example message 1:
<paste raw message>

Province name extracted:
-

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
