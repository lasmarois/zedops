# Goal #8 Findings

## Current server lifecycle gaps

### Rebuild requires existing container
- `POST /agents/:id/servers/:serverId/rebuild` (agents.ts:2130-2250)
- Checks `server.container_id IS NULL` → returns 400 "Server has no container to rebuild"
- Sends `server.rebuild` with `containerId` — agent stops old, creates new

### Restore only restores DB record
- `POST /agents/:id/servers/:serverId/restore` (agents.ts:2027-2127)
- Sets `status = 'missing'`, `deleted_at = NULL`
- Checks if data exists on host filesystem
- Does NOT recreate the container — user has no way to start it after

### Missing state detection
- Sync in `AgentConnection.ts:3218-3370` compares D1 records vs live containers
- Container gone + status not in [creating, deleting, deleted] → status = 'missing'
- Frontend shows Missing badge but all action buttons are broken

### Start endpoint behavior for missing servers
- `POST /agents/:id/servers/:serverId/start` (agents.ts:1429-1610)
- **Potential existing path**: need to verify if start handles `container_id = NULL`
- If it does, the fix might just be showing a "Start" button for Missing servers

## What's stored in D1 (everything needed to recreate)
- `name` — server name (used for container name: `steam-zomboid-{name}`)
- `config` — JSON string with env vars (ADMIN_PASSWORD, SERVER_NAME, ports, etc.)
- `image_tag` — e.g., "latest", "2.1.5"
- `image` — custom registry override (NULL = use agent's steam_zomboid_registry)
- `game_port`, `udp_port`, `rcon_port` — port bindings
- `server_data_path` — custom data path override (NULL = use agent default)
- `agent_id` → joins to `agents.steam_zomboid_registry`, `agents.server_data_path`

## Agent create flow (server.go:33-180)
- Pulls image: `{registry}:{imageTag}`
- Creates dirs: `{dataPath}/{name}/bin`, `{dataPath}/{name}/data`
- Container: name=`steam-zomboid-{name}`, labels, networks, volumes, ports
- Networks: `zomboid-servers`, `zomboid-backend`
- Restart policy: `unless-stopped`

## Design decision needed
**Option A: Extend rebuild** to handle missing containers (create-if-missing)
- Pro: Single endpoint, simpler frontend
- Con: Overloaded semantics ("rebuild" implies something exists)

**Option B: New recreate endpoint**
- Pro: Clear intent, clean separation
- Con: Another endpoint to maintain

**Option C: Make start handle missing** (verify if it already does)
- Pro: Minimal code change, natural UX (start = "make it run")
- Con: Start may not pull latest image or apply config changes
