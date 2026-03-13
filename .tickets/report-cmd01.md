---
id: report-cmd01
status: closed
type: feature
priority: 2
created: 2026-03-12T00:00:00Z
deps: [parse-agg01, report-fmt01]
links: []
parent: epic-bot01
tags: [commands, reports, discord.js]
---
# Bot Command Handler for On-Demand Reports

Implement Discord slash commands that trigger report generation and post the output to the channel.

## Design Notes

- Use discord.js **slash commands** (`/reportname`) rather than prefix commands (`!reportname`) — slash commands are the modern standard, show up in Discord's autocomplete, and don't require the Message Content intent for invocation
- Commands are registered with Discord via the REST API on startup (or via a separate deploy script)
- Each command calls into the report generation logic and posts the formatted result

## Commands to Implement

> Specific command names and arguments to be defined after report-fmt01 is complete.

Placeholder structure:
- `/stats` — post a summary report
- Additional commands TBD based on report-fmt01

## Command Options to Consider

- A `period` option (e.g., `today`, `week`, `all-time`) if time windows are needed
- A `player` option for per-player lookups
- A `reset` command (admin-only) to clear accumulated data

## Acceptance Criteria

- [ ] Slash commands registered and visible in Discord (type `/` and see them)
- [ ] Each command triggers the correct report
- [ ] Output is posted to the channel where the command was invoked
- [ ] Output respects Discord's 2000-character message limit (splits or truncates if needed)
- [ ] Commands restricted to appropriate channels or roles if needed
