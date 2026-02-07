# Goal #5 (Expanded): Integration Audit — Verify & Fix All Gaps

**Milestone:** M14 - Docker Image Improvements
**Status:** In Progress
**Created:** 2026-02-07

## Context

Goal #5 originally completed an audit of agent-image integration. Now expanded to:
1. Re-verify all findings against actual code (DONE)
2. Fix critical gaps — Gaps 1+3 already fixed (M9.8.42), Gap 2 still needs fix
3. Implement all feature gaps (Gaps 4-5)
4. Skip Gap 6 (health check params — not worth fixing)

---

## Phase 1: Audit & Verify Findings `status: complete`
- [x] Read all agent code (server.go, docker.go, backup.go)
- [x] Read all image code (Dockerfile, entry.sh, docker-entrypoint.sh, healthcheck.sh)
- [x] Read frontend code (ServerForm.tsx, ConfigurationEdit.tsx)
- [x] Trace manager flow (AgentConnection.ts create/delete handlers)
- [x] Confirm/deny each finding with file:line evidence
- [x] Update findings.md with verified verdicts
- [x] Live-verified on 5 running containers — confirmed fix works for new servers
- [x] Identified 2 pre-fix containers (jeanguy, myfunserver) with stale port ENVs

**Result:** Gaps 1+3 already fixed at manager level (M9.8.42). Gap 2 confirmed. Gaps 4+5 confirmed. Gap 6 skipped.

---

## Phase 2: Fix Port ENV Mismatch (Gap 1 + Gap 3) `status: complete (already fixed)`

Already fixed in `manager/src/routes/agents.ts` as part of M9.8.42. Manager injects
`SERVER_DEFAULT_PORT`, `SERVER_UDP_PORT`, `RCON_PORT` into config map before sending to agent.

**Remaining action:** Rebuild 2 pre-fix containers (jeanguy, myfunserver) to pick up correct ENVs.

---

## Phase 3: Graceful Shutdown (Gap 2) `status: complete`
- [x] Added `GracefulSave()` method on DockerClient (docker.go) — inspects container ENV for RCON_PORT/RCON_PASSWORD, connects via zomboid-backend, sends `save`, waits 3s
- [x] Used Option A: Inspect container ENVs (no protocol changes needed)
- [x] Added graceful save to: StopContainer, RestartContainer, DeleteServer, RebuildServer, rebuildWithNewConfig
- [x] Increased timeout from 10s to 30s (`GracefulStopTimeout` constant) on all stop operations
- [x] 3s post-save delay for disk flush included in GracefulSave
- [x] Build compiles successfully

**Files modified:** `agent/docker.go`, `agent/server.go`

---

## Phase 4: Game Settings UI (Gap 4) `status: complete`
- [x] Add game settings section to `ServerForm.tsx` (collapsible "Game Settings" section)
  - SERVER_MAP (text input)
  - SERVER_MAX_PLAYERS (number input, 1-100)
  - SERVER_PUBLIC (toggle/select)
  - SERVER_OPEN (toggle/select)
  - SERVER_PVP (toggle/select)
  - SERVER_PAUSE_EMPTY (toggle/select)
  - SERVER_GLOBAL_CHAT (toggle/select)
  - SERVER_WELCOME_MESSAGE (textarea)
  - SERVER_PUBLIC_DESCRIPTION (textarea)
- [x] Add same settings to `ConfigurationEdit.tsx` (Game Settings card)
- [x] Settings flow through existing config map — no agent/manager changes needed
- [ ] Test: create server with custom settings, verify INI values

**Files modified:** `frontend/src/components/ServerForm.tsx`, `frontend/src/components/ConfigurationEdit.tsx`

---

## Phase 5: Mod Management (Gap 5) `status: complete`
- [x] Add `SERVER_MODS` and `SERVER_WORKSHOP_ITEMS` text inputs to ServerForm (collapsible section)
- [x] Add same to ConfigurationEdit (Mod Management card)
- [x] These are just ENV variables — flow through existing config map
- [x] No DB schema change needed (stored in config JSON blob)
- [x] No agent protocol change needed (config map already supports arbitrary ENVs)
- [ ] Test: create server with mods, verify entry.sh processes them
- [x] Frontend builds successfully

**Files modified:** `frontend/src/components/ServerForm.tsx`, `frontend/src/components/ConfigurationEdit.tsx`

---

## Phase 6: Test & Deploy `status: complete`
- [x] Build agent binary with graceful shutdown (compiles, bin ready)
- [x] Build frontend with game settings + mod UI (compiles clean)
- [x] Push to dev branch for CI deployment
- [x] Deploy agent to test VM (zedops-test-agent) with --no-update
- [x] Verify on dev environment:
  - [x] Create server with game settings → ENVs in container confirmed
  - [x] Config edit form loads all game settings correctly
  - [x] Mod management UI renders in both create + edit
  - [x] Graceful shutdown: RCON save attempted on stop (logged correctly)
  - [x] Graceful shutdown: skipped on delete of stopped container (correct)
- [x] Merge dev to main → prod deploy triggered
- [x] Tag agent-v1.0.7 → release workflow builds + broadcasts update to agents
- [x] Delete test server, clean up

---

## Error Log

(none yet)
