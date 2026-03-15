---
id: province-inv05
status: closed
type: feature
priority: 2
created: 2026-03-13T00:00:00Z
deps: [province-inv03, province-inv04]
links: []
parent: province-inv01
tags: [provinces, commands, admin]
---
# /provinces Command

Implement the `/provinces` slash command to display the current province inventory and optionally trigger a refresh.

## Command Usage

- `/provinces` — display the current province inventory and the last updated timestamp
- `/provinces refresh` — rebuild the inventory from the last 48 hours of general channel messages (admin only)

## Admin Restriction Options

Option A — **Discord Role check** (recommended): Check if the invoking user has a role named `Admin` (or configurable role name) before allowing refresh. No Discord permission required from the server owner beyond assigning the role.

Option B — **Discord Permission check**: Check if the invoking user has the `Administrator` or `ManageGuild` permission. Requires the user to have server-level admin permissions.

Option C — **Allowlist in .env**: Define a comma-separated list of allowed Discord user IDs in `.env`. Simple but requires bot restart to update.

> Recommendation: Option A (role check) — most flexible for the server owner to manage without touching bot config.

## Output Format

```
Province Inventory (last updated: 2026-03-13 12:00 UTC)
Total: 21 provinces

Ill be there in a tick
Tea time
Stewies Time Machine
...
```

## Acceptance Criteria

- [ ] `/provinces` lists all known provinces alphabetically with last updated timestamp
- [ ] `/provinces refresh` is restricted to admins (method TBD per above options)
- [ ] Non-admins attempting refresh receive a clear error message
- [ ] After refresh, posts confirmation with count of provinces found
