---
id: epic-bot01
status: open
type: epic
priority: 0
created: 2026-03-12T00:00:00Z
deps: []
links: []
tags: [discord, nodejs, discord.js]
---
# Discord Message Parser & Report Bot

A Discord bot built with Node.js and discord.js that passively monitors specific channels on a gaming server. Messages posted by another bot follow a consistent format containing a player's name and an action/event. This bot parses those messages, aggregates the data, and generates on-demand reports posted back to Discord.

## Scope

- Monitor specific named channels (to be configured)
- Parse messages from another bot that follow a fixed format
- Aggregate player activity data over time
- Generate reports via Discord commands, output to Discord channel for copy/paste

## Out of Scope (for now)

- Cloud hosting (local-first, cloud migration planned for later)
- User-facing data input (all data comes from the other bot)

## Child Tickets

- setup-dev01: Discord Developer Portal setup
- setup-gh01: GitHub repository setup
- setup-env01: Local Node.js project initialization
- parse-fmt01: Document message format and parsing rules
- parse-agg01: Data aggregation and storage layer
- report-fmt01: Document report output format
- report-cmd01: Bot command handler
