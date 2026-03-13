---
id: setup-dev01
status: closed
type: task
priority: 0
created: 2026-03-12T00:00:00Z
deps: []
links: []
parent: epic-bot01
tags: [discord, setup, developer-portal]
---
# Set Up Discord Developer Portal and Bot Application

Step-by-step guide to registering a new bot application in the Discord Developer Portal and adding it to the target server.

## Steps

1. Go to https://discord.com/developers/applications
2. Click **New Application** — give it a name (this becomes the bot's display name)
3. Navigate to the **Bot** tab on the left sidebar
4. Click **Add Bot** → confirm
5. Under the Bot tab:
   - Copy the **Token** — this is your bot's secret credential (treat like a password, never commit to git)
   - Enable **Message Content Intent** under Privileged Gateway Intents (required to read message content)
6. Navigate to **OAuth2 → URL Generator**:
   - Integration type: Guild Install
   - Scopes: check `bot` and `applications.commands`
   - Bot Permissions: check at minimum `Read Messages/View Channels`, `Send Messages`, `Read Message History`
7. Copy the generated URL and send to server owner to invite the bot to the target server

## Notes

- Server Members Intent is NOT needed for current scope (player names come from message text, not member list)
- Bot token saved securely in `.env` file (never committed)
- Message Content Intent enabled
- Bot invite URL sent to server owner (pending authorization)

## Acceptance Criteria

- [x] Bot application created in Developer Portal
- [x] Bot token saved securely (in `.env` file, never committed)
- [x] Message Content Intent enabled
- [ ] Bot invited to and visible in the target Discord server (pending friend's authorization)
