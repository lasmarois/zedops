# M9.8.42 Findings - Port Configuration Bug

## Initial Investigation

### Symptom
- UI shows ports 16285-16286 for server `build42-testing`
- Server INI inside container resets to default 16261-16262
- RCON connection for player count feature failing (wrong port)

### Container Inspection
```bash
docker inspect steam-zomboid-build42-testing --format '{{range .Config.Env}}{{println .}}{{end}}' | grep PORT
```
Result:
```
RCON_PORT=27027        # Correct - custom port
SERVER_DEFAULT_PORT=16261  # WRONG - should be 16285
SERVER_UDP_PORT=16262      # WRONG - should be 16286
```

## Root Cause Analysis

### Data Flow
1. Frontend sends `gamePort` and `udpPort` in server create request
2. Manager stores ports in DB (`game_port`, `udp_port` columns)
3. Manager builds config map with env vars for agent
4. **BUG:** Only `RCON_PORT` is added, not `SERVER_DEFAULT_PORT`/`SERVER_UDP_PORT`
5. Agent uses config map for container env vars
6. Agent uses `gamePort`/`udpPort` separately for Docker port bindings
7. Docker image has defaults (16261/16262) which get used

### Code Evidence

`manager/src/routes/agents.ts:1049-1053`:
```typescript
const configWithRconPort = {
  ...body.config,
  RCON_PORT: rconPort.toString(),
  // BUG: gamePort and udpPort not added as env vars
};
```

### Why RCON Works
RCON port IS being added to the config (line 1052), so RCON_PORT env var is correct.
The same pattern needs to be applied for game/UDP ports.

## Affected Flows

1. **Server Create** (`POST /api/agents/:id/servers`) - Line ~1049
2. **Server Recreate** (start with missing container) - Line ~1395
3. **Rebuild** - May need to pass ports if not reading from existing container

## Docker Image Expectation

The Project Zomboid Docker image expects these env vars:
- `SERVER_DEFAULT_PORT` - Main game port
- `SERVER_UDP_PORT` - UDP port (usually gamePort + 1)
- `RCON_PORT` - RCON port

These are used by the entrypoint script to configure `servertest.ini`.

---

## Additional Finding: BETABRANCH Naming

### Issue
Beta branch config not being applied to container.

### Root Cause
Frontend was using `BETA_BRANCH` (with underscore), but Docker image expects `BETABRANCH` (no underscore).

Container inspection showed:
```
BETA_BRANCH=unstable    # What we were setting (wrong name)
BETABRANCH=none         # Docker image default (correct name, but not our value)
```

### Fix
Changed all frontend references from `BETA_BRANCH` to `BETABRANCH`:
- ServerForm.tsx
- ConfigurationDisplay.tsx
- ConfigurationEdit.tsx
