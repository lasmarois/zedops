# Goal #8 Findings

## Deep dive results (2026-02-07)

### Key discovery: START already handles missing containers
The START endpoint (`agents.ts:1440-1614`) already has a code path for recreating missing servers:
- If `status='missing'` AND `data_exists=true` → sends `server.create` with full config from DB
- If `status='missing'` AND `data_exists=false` → returns error "Cannot start server: no container or data found"
- Uses the same `server.create` message + agent handler as the original create endpoint

### The real gap: START blocks on data_exists=false
When data files are gone (host wipe, manual cleanup), START refuses to recreate.
But `CreateServer()` in agent/server.go creates directories if they don't exist:
```go
mkdir -p dataPath/serverName/bin
mkdir -p dataPath/serverName/data
```
So recreation WITHOUT data would just mean a fresh server with the same config/ports — a valid use case.

### All four scenarios to handle

| Scenario | Container | Data | Expected behavior |
|----------|-----------|------|-------------------|
| 1. Missing, data exists | Gone | Yes | Recreate container, mount existing data → server resumes |
| 2. Missing, data gone | Gone | No | Recreate container, fresh dirs → fresh server, same config |
| 3. Deleted, data exists | Gone | Yes | Restore DB + recreate → server resumes |
| 4. Deleted, data gone | Gone | No | Restore DB + recreate → fresh server, same config |

Currently: Scenario 1 works (via START). Scenarios 2, 3, 4 are broken.

### Code path overlap analysis

**Three endpoints already send `server.create` to the agent:**
1. **Create** (POST /servers) — new server, always works
2. **Start** (when missing + data_exists) — recreation, blocked on no-data
3. **Apply-config** auto-recovery — catches "no such container" error, falls through to create

**Rebuild** refuses when container_id is NULL, but its agent-side logic (`RebuildServerWithConfig`) would also fail since it tries to inspect the old container.

### Restore flow details
- `POST /agents/:id/servers/:serverId/restore` (agents.ts:2035-2127)
- Checks `status='deleted'` AND `deleted_at IS NOT NULL`
- Sends `check-data` to agent to verify if files exist on host
- Sets `status='missing'`, `deleted_at=NULL`, `data_exists=0|1`
- Does NOT recreate container — leaves user stuck with a Missing server
- If agent offline → assumes `data_exists=false`

### Recommended approach: Unified recreate logic

**Core change:** Extract the recreation logic from START into a shared helper, then use it in:

1. **START** — remove the `data_exists` guard (let agent create dirs)
2. **REBUILD** — when `container_id IS NULL`, fall through to recreate instead of 400
3. **RESTORE** — after DB restore, call recreate to bring the server back in one action

The shared logic is:
```
function recreateServer(server, agent):
  config = parse(server.config)
  config.RCON_PORT = server.rcon_port
  config.SERVER_DEFAULT_PORT = server.game_port
  config.SERVER_UDP_PORT = server.udp_port
  registry = server.image || agent.steam_zomboid_registry
  dataPath = server.server_data_path || agent.server_data_path

  send server.create { serverId, name, registry, imageTag, config, ports, dataPath }
  update servers SET container_id=?, status='running'
```

No agent changes needed — `CreateServer()` already handles all cases (creates dirs, pulls image, creates container).

### What "data gone" means for the user
- `bin/` = game binaries → SteamCMD re-downloads on first boot (no real loss)
- `data/` = **world saves, player database, server INI, admin accounts** (REAL LOSS)
- Config in ZedOps DB is preserved (ports, env vars, admin password, mods, image tag)
- Recreating without data = fresh world, player progress gone, admin accounts reset

### UX: User must always know what to expect

**Missing server overview** should show data status prominently:
- "Server data found on disk" (green) — safe to recreate, world preserved
- "Server data not found on disk" (red/warning) — recreation means fresh start

**Confirmation dialogs must differ based on data_exists:**

| Action | data_exists=true | data_exists=false |
|--------|-----------------|-------------------|
| Start/Recreate | "Recreate container? World saves and player data will be preserved." | "Server data not found. This will create a fresh server with the same config. World saves and player progress will NOT be restored. Continue?" |
| Rebuild (missing) | Same as Start | Same as Start |
| Restore | "Restore server? Data found on disk — server will resume." | "Restore server? Data was not found on disk. Server will start fresh with original configuration." |

**Rules:**
- Never auto-recreate without user confirmation when data is missing
- data_exists flag must be refreshed before showing dialog (agent may have come back online)
- If agent is offline, fall back to cached data_exists value
- **Live check endpoint**: `GET /api/agents/:id/servers/:serverId/check-data` — calls agent, updates D1, returns fresh result

### Bug: DO route mismatch for check-data (2026-02-07)
- `stub.fetch('http://internal/check-data')` parses as `hostname=internal`, `pathname=/check-data`
- DO handler was checking `url.pathname === "/internal/check-data"` — never matches
- All check-data requests silently fell through to default (404/error), agents.ts saw non-ok → returned 503
- Fix: changed DO route to match `/check-data` (the actual pathname)
- Other DO URLs like `http://internal/servers/sync` work because `/servers/sync` IS the pathname
- Also found: sync flow calls `http://do/servers/checkdata` but `/servers/checkdata` handler doesn't exist in DO (separate issue)

### Frontend changes needed
- **Missing status:** Show "Start" button (calls START endpoint which handles recreation)
- **Missing status:** Disable Stop/Restart (no container to act on)
- **Missing status:** Show data_exists status in the overview card
- **Rebuild on Missing:** Fall through to recreate with appropriate dialog
- **Restore:** Show data status in confirmation dialog, auto-recreate after DB restore
- **All recreate dialogs:** Different copy for data_exists=true vs false
