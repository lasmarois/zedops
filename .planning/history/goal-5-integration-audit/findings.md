# Goal #5: ZedOps Integration Audit - Findings

## Integration Overview

The agent-image integration is **functionally complete** for basic operations (create, delete, restart, backup/restore) but has gaps in configuration exposure and data safety.

---

## Critical Gaps

### Gap 1: Port ENV Mismatch (HIGH)
- Agent binds ports via Docker (`gamePort`, `udpPort`) but does NOT pass `SERVER_DEFAULT_PORT` / `SERVER_UDP_PORT` ENVs to the container
- Image writes default port values (16261/16262) to INI if ENVs not set
- If agent binds non-default ports, INI has wrong values → server listens on wrong port inside container
- **Fix:** Agent should pass port ENVs in `server.go` CreateServer

### Gap 2: No Graceful Shutdown (HIGH - data safety)
- Agent sends SIGTERM with 10s timeout, no RCON `save` command before stop
- `entry.sh` has no signal handlers — SIGTERM goes straight to Java
- Data may not flush to disk → corruption risk
- Pattern already exists in `backup.go:399-438` (`attemptRCONSave`) — needs reuse in StopContainer
- **Fix:** Send RCON save before stop, increase timeout to 30s

### Gap 3: RCON Port Not Passed as ENV (MEDIUM)
- Agent stores `RCONPort` but doesn't pass it as `RCON_PORT` ENV
- Image reads `RCON_PORT` from ENV to write to INI (entry.sh:187)
- RCON password IS correctly passed (`RCON_PASSWORD` set in ServerForm.tsx:141)
- **Fix:** Add `RCON_PORT` to ENV array in server.go

---

## Feature Gaps

### Gap 4: Game Settings Not Exposed
Image supports 10+ game settings via ENV that agent/UI don't expose:

| ENV | Setting | Image Support | Agent/UI Support |
|-----|---------|:---:|:---:|
| `SERVER_MAP` | Map selection | ✓ | ✗ |
| `SERVER_MAX_PLAYERS` | Player limit | ✓ | ✗ |
| `SERVER_PUBLIC` | Show in browser | ✓ | ✗ |
| `SERVER_OPEN` | Public vs whitelist | ✓ | ✗ |
| `SERVER_PVP` | PvP enabled | ✓ | ✗ |
| `SERVER_PAUSE_EMPTY` | Pause when empty | ✓ | ✗ |
| `SERVER_GLOBAL_CHAT` | Global chat | ✓ | ✗ |
| `SERVER_WELCOME_MESSAGE` | Welcome banner | ✓ | ✗ |
| `SERVER_PUBLIC_DESCRIPTION` | Description | ✓ | ✗ |

### Gap 5: Mod Management Not Exposed
- Image has full stateful mod management (`SERVER_MODS`, `SERVER_WORKSHOP_ITEMS`)
- Agent has zero mod support — no request fields, no UI
- Users must manually edit INI or use RCON

### Gap 6: Health Check Params Not Configurable
- Hardcoded in Dockerfile (30s interval, 30s start, 3 retries)
- Agent can't adjust per-server
- Minor issue — current defaults are reasonable

---

## What Works Well

| Feature | Agent | Image | Status |
|---------|:---:|:---:|--------|
| Server name | ✓ | ✓ | ✓ Match |
| Admin password | ✓ | ✓ | ✓ Match |
| Server password | ✓ | ✓ | ✓ Match |
| Public name | ✓ | ✓ | ✓ Match |
| RCON password | ✓ | ✓ | ✓ Match |
| Beta branch | ✓ | ✓ | ✓ Match |
| Volume mounts | ✓ | ✓ | ✓ Paths match |
| Networks | ✓ | ✓ | ✓ Auto-created |
| Health check | ✓ read | ✓ built-in | ✓ Works (Goal #4 fixed) |
| Backup/restore | ✓ | ✓ | ✓ Works |
| Labels | ✓ | ✓ | ✓ Match |

---

## Recommendations (Prioritized)

### Priority 1: Critical Fixes
1. **Pass port ENVs** — `SERVER_DEFAULT_PORT`, `SERVER_UDP_PORT`, `RCON_PORT` in CreateServer
2. **Graceful shutdown** — RCON save before stop (reuse backup.go pattern)

### Priority 2: Feature Additions
3. **Expose game settings** in create/edit server UI (map, max players, pvp, etc.)
4. **Mod management UI** — pass `SERVER_MODS`/`SERVER_WORKSHOP_ITEMS` ENVs

### Priority 3: Robustness
5. **Image validation** — use existing `GetImageDefaults()` to verify image structure at creation
6. **Document integration contract** — port binding strategy, volume paths, RCON internal network

---

## Key File References

| Component | File | Key Lines |
|-----------|------|-----------|
| Container creation | `agent/server.go` | 33-179 |
| ENV mapping | `agent/server.go` | 70-74 |
| Port binding | `agent/server.go` | 91-104 |
| Labels | `agent/server.go` | 110-116 |
| Volume mounts | `agent/server.go` | 122-133 |
| Stop container | `agent/docker.go` | 144-155 |
| RCON pre-save | `agent/backup.go` | 399-438 |
| Image ENV defaults | `steam-zomboid/Dockerfile` | 96-109 |
| ENV→INI mapping | `steam-zomboid/entry.sh` | 159-284 |
| Mod management | `steam-zomboid/entry.sh` | 286-340 |
| Health check | `steam-zomboid/scripts/healthcheck.sh` | all |
| Server form | `frontend/src/components/ServerForm.tsx` | 120-169 |
| Config edit | `frontend/src/components/ConfigurationEdit.tsx` | all |
