# Goal #5 (Expanded): Integration Audit — Verified Findings

## Verification Methodology

All findings verified by reading actual source code across all three components (agent, image, manager/frontend) on 2026-02-07.

---

## Gap 1: Port ENV Mismatch — ALREADY FIXED

**Verdict: FALSE — Already fixed at manager level (M9.8.42)**

**Original claim:** Agent doesn't inject port ENVs → INI has wrong values.

**Reality:** The manager injects `SERVER_DEFAULT_PORT`, `SERVER_UDP_PORT`, and `RCON_PORT` into the config map BEFORE sending to the agent. The agent doesn't need to inject them — they arrive in `config.Config` and get passed through correctly.

**Evidence (fix already in place):**
- `manager/src/routes/agents.ts:1101-1106` — Create path: injects all 3 port ENVs
- `manager/src/routes/agents.ts:1474-1480` — Retry/recreate path: injects all 3 port ENVs
- `manager/src/routes/agents.ts:2681-2687` — Config update/rebuild path: injects all 3 port ENVs

**Live verification:**
- `build42-jan26` (ports 16263/16264): ENV has `SERVER_DEFAULT_PORT=16263`, INI has `DefaultPort=16263` — CORRECT
- `build42-testing` (ports 16285/16286): ENV has `SERVER_DEFAULT_PORT=16285`, INI has `DefaultPort=16285` — CORRECT
- `jeanguy` (ports 16289/16290): ENV has `SERVER_DEFAULT_PORT=16261` — WRONG (created before M9.8.42 fix)
- `myfunserver` (ports 16287/16288): ENV has `SERVER_DEFAULT_PORT=16261` — WRONG (created before M9.8.42 fix)

**Remaining issue:** 2 pre-fix containers (jeanguy, myfunserver) have stale port ENVs. A rebuild via config edit would fix them.

**No code change needed.**

---

## Gap 2: No Graceful Shutdown — CONFIRMED

**Verdict: TRUE — Critical (data safety)**

**Evidence:**
- `agent/docker.go:144-155` — `StopContainer()`: 10s timeout, no RCON save.
- `agent/docker.go:158-169` — `RestartContainer()`: 10s timeout, no RCON save.
- `agent/server.go:203-207` — `DeleteServer()`: 10s timeout, no RCON save.
- `agent/server.go:296-300` — `RebuildServer()`: 10s timeout, no RCON save.
- `agent/server.go:458-462` — `rebuildWithNewConfig()`: 10s timeout, no RCON save.
- `steam-zomboid/entry.sh:343` — Uses `exec` so Java gets SIGTERM directly, no signal handler.

**Existing pattern:** `agent/backup.go:399-438` has `attemptRCONSave()` that connects to RCON via zomboid-backend network IP and sends `save` command.

**Impact:** SIGTERM to Java may not flush all data to disk. Risk of world save corruption.

**Fix:** Extract `attemptRCONSave()` to shared utility. Call before all stop operations. Increase timeout to 30s.

---

## Gap 3: RCON Port Not Passed as ENV — ALREADY FIXED

**Verdict: FALSE — Already fixed at manager level (same M9.8.42 fix as Gap 1)**

**Reality:** Manager injects `RCON_PORT` into config map alongside game port ENVs. Was actually fixed even before SERVER_DEFAULT_PORT/SERVER_UDP_PORT — all pre-fix containers have correct RCON_PORT.

**Live verification:**
- `jeanguy`: `RCON_PORT=27029` in ENV, `RCONPort=27029` in INI — CORRECT
- `myfunserver`: `RCON_PORT=27028` in ENV, `RCONPort=27028` in INI — CORRECT

**No code change needed.**

---

## Gap 4: Game Settings Not Exposed — CONFIRMED

**Verdict: TRUE — Feature gap**

Image supports these ENV-to-INI mappings (entry.sh:198-284) that agent/UI don't expose:

| ENV | INI Setting | Type | Validation | entry.sh Line |
|-----|-------------|------|------------|---------------|
| `SERVER_MAP` | Map | string | none | 228-231 |
| `SERVER_MAX_PLAYERS` | MaxPlayers | int 1-100 | range check | 234-244 |
| `SERVER_PUBLIC` | Public | bool | true/false | 218-225 |
| `SERVER_OPEN` | Open | bool | true/false | 247-254 |
| `SERVER_PVP` | PVP | bool | true/false | 257-264 |
| `SERVER_PAUSE_EMPTY` | PauseEmpty | bool | true/false | 267-274 |
| `SERVER_GLOBAL_CHAT` | GlobalChat | bool | true/false | 277-284 |
| `SERVER_WELCOME_MESSAGE` | ServerWelcomeMessage | string | slash escape | 202-207 |
| `SERVER_PUBLIC_DESCRIPTION` | PublicDescription | string | slash escape | 210-215 |

**Current UI fields (creation):** `SERVER_NAME`, `SERVER_PUBLIC_NAME`, `ADMIN_PASSWORD`, `SERVER_PASSWORD`, `RCON_PASSWORD`, `BETABRANCH`.

**Current UI fields (edit):** `SERVER_PUBLIC_NAME`, `ADMIN_PASSWORD`, `SERVER_PASSWORD`, `BETABRANCH`, `TZ`, `PUID`, `RCON_PASSWORD`.

**Fix:** Add game settings section to both ServerForm and ConfigurationEdit.

---

## Gap 5: Mod Management Not Exposed — CONFIRMED

**Verdict: TRUE — Feature gap**

**Evidence:**
- `steam-zomboid/entry.sh:286-340` — Full stateful mod management with `SERVER_MODS` and `SERVER_WORKSHOP_ITEMS`.
- `steam-zomboid/scripts/mod-functions.sh` — 12 functions for merge/state logic.
- Agent: Zero mod fields in any struct.
- Frontend: No mod UI.
- Manager DB: No mod columns.

**Fix:** Full-stack: DB schema + manager API + agent protocol + frontend UI. This is the largest gap.

---

## Gap 6: Health Check Params Not Configurable — CONFIRMED (SKIP)

**Verdict: TRUE but not worth fixing**

Hardcoded in Dockerfile (build-time). Defaults (30s interval, 10s timeout, 30s start, 3 retries) are reasonable.

---

## What Works Well (Verified)

| Feature | Status | Evidence |
|---------|--------|----------|
| Server name | Match | `SERVER_NAME` ENV set in frontend, read by entry.sh |
| Admin password | Match | `ADMIN_PASSWORD` ENV wired correctly |
| Server password | Match | `SERVER_PASSWORD` ENV wired correctly |
| Public name | Match | `SERVER_PUBLIC_NAME` ENV wired correctly |
| RCON password | Match | `RCON_PASSWORD` ENV wired correctly |
| Beta branch | Match | `BETABRANCH` ENV wired correctly |
| Volume mounts | Match | bin→/home/steam/zomboid-dedicated, data→/home/steam/Zomboid |
| Networks | Match | zomboid-servers + zomboid-backend auto-created |
| Health check | Works | Lifecycle-aware healthcheck.sh |
| Backup/restore | Works | RCON pre-save + tar.gz with meta |
| Labels | Match | zedops.managed, zedops.server.id, etc. |

---

## Key File References

| Component | File | Key Lines |
|-----------|------|-----------|
| Container creation | `agent/server.go` | 33-179 |
| ENV mapping | `agent/server.go` | 70-74 |
| Port binding | `agent/server.go` | 91-104 |
| Config rebuild | `agent/server.go` | 371-527 |
| Stop container | `agent/docker.go` | 144-155 |
| Restart container | `agent/docker.go` | 158-169 |
| Delete server (stop) | `agent/server.go` | 203-207 |
| Rebuild (stop) | `agent/server.go` | 296-300 |
| Rebuild with config (stop) | `agent/server.go` | 458-462 |
| RCON pre-save (backup) | `agent/backup.go` | 399-438 |
| Image ENV defaults | `steam-zomboid/Dockerfile` | 96-109 |
| ENV→INI mapping | `steam-zomboid/entry.sh` | 159-284 |
| Mod management | `steam-zomboid/entry.sh` | 286-340 |
| Server form (create) | `frontend/src/components/ServerForm.tsx` | 120-169 |
| Config edit | `frontend/src/components/ConfigurationEdit.tsx` | all |
| Manager create flow | `manager/src/durable-objects/AgentConnection.ts` | 2504-2592 |
| Manager delete flow | `manager/src/durable-objects/AgentConnection.ts` | 2598-2693 |
