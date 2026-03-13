---
id: setup-gh01
status: closed
type: task
priority: 0
created: 2026-03-12T00:00:00Z
deps: []
links: []
parent: epic-bot01
tags: [github, setup, git]
---
# Create GitHub Repository

Initialize a new GitHub repository to host the bot's source code.

## Steps

1. Create a new repo on GitHub (public or private)
2. Clone locally into the project directory
3. Add a `.gitignore` that excludes `node_modules/`, `.env`, and local data/storage files
4. Push initial commit

## Notes

- Repo name on GitHub: uto-discord-bot
- Local folder name: UtopiaDiscordBot
- Tickets directory lives at UtopiaDiscordBot/.tickets/

## Acceptance Criteria

- [x] Repo exists on GitHub
- [x] `.gitignore` excludes `node_modules/`, `.env`, `data/`, `*.db`, `*.sqlite`, `logs/`
- [x] Local clone is set up and pushing works
