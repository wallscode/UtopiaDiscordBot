#!/usr/bin/env bash
# Starts the Utopia Discord bot.
# Usage: ./start.sh          run the bot
#        ./start.sh --dev    run with nodemon (auto-restart on file changes)
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed or not on PATH." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Error: .env file not found. It must define DISCORD_TOKEN." >&2
  exit 1
fi

# Install dependencies if missing or if package-lock.json changed since last install.
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Dependencies changed, running npm ci..."
  npm ci
fi

if [ "${1:-}" = "--dev" ]; then
  exec npm run dev
else
  exec npm start
fi
