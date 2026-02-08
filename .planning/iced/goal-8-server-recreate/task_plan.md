# Goal #8: Server Recreate — Recover Missing/Deleted Servers from Stored Config

## Problem
ZedOps stores all the information needed to recreate a server (registry, tag, config, ports, data path) but has no code path to recreate a container when it's gone. This affects:
- **Missing servers** (container removed, host reboot, VM migration)
- **Restored servers** (undelete sets status='missing' but doesn't recreate container)
- **Rebuild on missing** (returns 400 because container_id is null)

## Phase 1: Backend — Recreate endpoint
**Status:** `pending`

- [ ] Add `POST /api/agents/:id/servers/:serverId/recreate` endpoint (or extend rebuild)
  - Reads server config from D1 (same as rebuild does)
  - Sends `server.create` to agent with stored config (registry, tag, config, ports, dataPath)
  - Updates `container_id` and `status` on success
  - Works when `container_id IS NULL` (the key difference from rebuild)
- [ ] Alternative: make rebuild handle `container_id = NULL` by falling through to create logic
  - Simpler approach — rebuild becomes "ensure container exists with this config"
  - Decision: pick one approach

**Key files:**
- `manager/src/routes/agents.ts` — rebuild endpoint (lines 2130-2250), create endpoint (lines 1036-1214)
- `agent/server.go` — CreateServer (lines 33-180), RebuildServerWithConfig (lines 422-534)

## Phase 2: Restore flow — Auto-recreate on restore
**Status:** `pending`

- [ ] Update restore endpoint to trigger recreate after DB restore
  - Current: `POST /api/agents/:id/servers/:serverId/restore` sets `status='missing'`
  - New: after DB restore, send `server.create` to agent to recreate container
  - Server goes from 'deleted' → 'running' in one action (not 'deleted' → 'missing' → manual start)
- [ ] Handle case where data doesn't exist on host (fresh recreate vs data restore)
- [ ] Handle case where agent is offline (restore DB record, recreate when agent reconnects?)

**Key files:**
- `manager/src/routes/agents.ts` — restore endpoint (lines 2027-2127)

## Phase 3: Frontend — Recreate button for Missing servers
**Status:** `pending`

- [ ] Show "Recreate" button when server status is "Missing"
- [ ] Disable Stop/Restart when Missing (they can't work without a container)
- [ ] Rebuild button should work for Missing servers too (calls recreate endpoint)
- [ ] After restore, navigate to server detail (currently stays on list with Missing status)

**Key files:**
- `frontend/src/pages/ServerDetail.tsx` — action buttons
- `frontend/src/components/ServerCard.tsx` — server list actions

## Phase 4: Sync resilience — Reconnect recreate
**Status:** `pending`

- [ ] On agent reconnect, sync should detect servers with `status != 'deleted'` but no matching container
- [ ] Option A: Auto-recreate missing containers on sync
- [ ] Option B: Just mark as Missing and let user decide (current behavior, may be fine)
- [ ] Decision: auto-recreate vs manual — discuss with user

**Key files:**
- `manager/src/durable-objects/AgentConnection.ts` — syncServers (lines 3218-3370)

## Phase 5: Testing & verification
**Status:** `pending`

- [ ] Test: create server → delete container manually → verify recreate works
- [ ] Test: soft-delete server → restore → verify container is recreated
- [ ] Test: rebuild on Missing server → verify it creates instead of 400 error
- [ ] Test on dev environment with test VM agent
