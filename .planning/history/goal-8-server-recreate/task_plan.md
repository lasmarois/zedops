# Goal #8: Server Recreate — Recover Missing/Deleted Servers from Stored Config

## Problem
ZedOps stores all the information needed to recreate a server but has no working code path when the container is gone. The user gets stuck with a "Missing" server and broken action buttons.

## Phase 1: Backend — Shared recreate helper + fix endpoints
**Status:** `complete`

- [ ] Extract shared `recreateServerContainer()` helper from START's existing recreation logic
  - Assembles config from D1 (server + agent tables)
  - Sends `server.create` to agent via DO
  - Updates container_id + status on success
  - No agent changes needed — `CreateServer()` already creates dirs + pulls image
- [ ] Fix START: remove `data_exists` guard — allow recreation even without data
  - Agent's `CreateServer()` creates dirs anyway (`mkdir -p`)
  - Fresh server with same config is a valid use case
- [ ] Fix REBUILD: when `container_id IS NULL`, call recreate helper instead of returning 400
- [ ] Fix RESTORE: after DB restore, call recreate helper to bring server back in one action
  - Server goes from 'deleted' → 'running' (not 'deleted' → 'missing' → stuck)
  - If agent offline: restore DB only, set status='missing' (existing behavior, acceptable)

**Key files:**
- `manager/src/routes/agents.ts` — START (~1440), REBUILD (~2135), RESTORE (~2035)

## Phase 2: Frontend — Data-aware dialogs and button states
**Status:** `complete`

- [ ] Missing server: show "Start" button instead of broken Stop/Restart/Rebuild
  - Start calls existing START endpoint which now handles recreation
  - Disable Stop and Restart when status is Missing
  - Rebuild can stay enabled (now falls through to recreate)
- [ ] Show data status in Missing server overview
  - "Server data found on disk" (reassuring) vs "Server data not found" (warning)
- [ ] Data-aware confirmation dialogs:
  - data_exists=true: "Recreate container? World saves and player data will be preserved."
  - data_exists=false: "Server data not found on disk. This will create a fresh server with the same configuration. World saves and player progress will NOT be restored."
- [ ] Restore dialog: show data status before user confirms
  - data_exists=true: "Data found — server will resume where it left off"
  - data_exists=false: "Data not found — server will start fresh with original config"
- [ ] After restore completes: navigate to server detail (show Running, not Missing)

**Key files:**
- `frontend/src/pages/ServerDetail.tsx` — action buttons + dialogs
- `frontend/src/components/ServerCard.tsx` — server list actions

## Phase 3: Testing on dev
**Status:** `complete`

- [ ] Scenario 1: Missing + data exists → Start → server resumes with existing data
- [ ] Scenario 2: Missing + data gone → Start → fresh server, correct warning shown
- [ ] Scenario 3: Rebuild on Missing → recreate works (no 400 error)
- [ ] Scenario 4: Delete → Restore (data exists) → server comes back running
- [ ] Scenario 5: Delete → remove data files → Restore (no data) → fresh server with warning
- [ ] All scenarios on test VM via dev environment
