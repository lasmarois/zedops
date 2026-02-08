# Goal #9: Fix Missing/Broken DO Routes in Apply-Config Auto-Recovery

## Problem
The apply-config flow's auto-recovery path (triggered when container is missing) had multiple broken DO route calls that silently failed:
1. `/servers/checkdata` — no matching DO handler (fixed: switched to `/check-data`)
2. `/servers/${serverId}/create` — no matching DO handler (fixed: switched to `/servers`)

Also found earlier in Goal #8:
3. `/internal/check-data` — DO handler matched wrong pathname (fixed: `/check-data`)

## Phase 1: Fix broken DO routes
**Status:** `complete`

- [x] Fix `/servers/checkdata` → use existing `/check-data` endpoint with correct request format
- [x] Fix `/servers/${serverId}/create` → use existing `POST /servers` endpoint
- [x] Audit all `stub.fetch` calls to verify DO routes exist

## Phase 2: Test apply-config auto-recovery
**Status:** `complete`

- [x] Remove container from test VM (keep DB record with container_id)
- [x] Apply a config change via UI (Public Name + Max Players)
- [x] Verify: rebuild fails with "no such container"
- [x] Verify: check-data call succeeds (agent logs show data_exists=true)
- [x] Verify: auto-recovery creates new container with updated config
- [x] Verify: server comes back running (Starting, 58s uptime)

## Phase 3: Commit and deploy
**Status:** `complete`

- [x] Commit both fixes (check-data route + create route)
- [x] Push to dev and main
- [x] Verify CI passes — both green
