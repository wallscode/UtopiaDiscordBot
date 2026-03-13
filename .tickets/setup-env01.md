---
id: setup-env01
status: open
type: task
priority: 1
created: 2026-03-12T00:00:00Z
deps: [setup-gh01, setup-dev01]
links: []
parent: epic-bot01
tags: [nodejs, discord.js, setup, local]
---
# Initialize Node.js Project

Set up the local Node.js project with discord.js and project structure.

## Steps

1. In the project directory, run `npm init -y`
2. Install core dependencies:
   - `discord.js` — Discord API wrapper
   - `dotenv` — loads `.env` file into `process.env`
3. Create `.env` file with at minimum:
   ```
   DISCORD_TOKEN=your-bot-token-here
   CLIENT_ID=your-application-client-id
   GUILD_ID=your-server-id
   ```
4. Create initial project structure:
   ```
   /src
     index.js         # entry point, client initialization
     /commands        # one file per slash command
     /handlers        # message parsing logic
     /reports         # report generation logic
   ```
5. In `index.js`: initialize the discord.js Client, load intents (Guilds, GuildMessages, MessageContent), connect with `client.login(process.env.DISCORD_TOKEN)`
6. Confirm bot comes online (green dot in Discord) with `node src/index.js`

## Acceptance Criteria

- [ ] `npm start` (or `node src/index.js`) starts the bot without errors
- [ ] Bot appears online in Discord
- [ ] `.env` is gitignored and not committed
