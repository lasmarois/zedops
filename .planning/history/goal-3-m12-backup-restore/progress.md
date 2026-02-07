# Progress: Goal #3 — M12: Backup & Restore

## Session 1 — 2026-02-07

### Status: All phases complete, builds passing

**Context**: Full implementation plan provided by user. Plan was designed during plan mode in previous session. All patterns explored and documented.

### Steps Completed
- [x] Updated GOALS.md — Goal #3 registered, set as active
- [x] Created planning files (task_plan.md, findings.md, progress.md)
- [x] Read agent/main.go — understand message handler pattern
- [x] Read agent/server.go:600-900 — MoveServerData pattern for reference
- [x] Explored AgentConnection.ts — DO routes, inbox pattern, progress broadcast
- [x] Read routes/agents.ts — API endpoint pattern (auth, permission, D1, DO proxy)
- [x] Read useMoveProgress.ts — WebSocket progress hook pattern
- [x] Read api.ts — API client function pattern
- [x] Read ServerDetail.tsx — backups tab placeholder location
- [x] Read rcon.go — RCON connection pattern for pre-save

### Phase 1: Database Migration — DONE
- Created `manager/migrations/0015_create_backups_table.sql`

### Phase 2: Agent Backup Logic — DONE
- Created `agent/backup.go` (520+ lines):
  - CreateBackup with RCON pre-save, tar.gz compression, progress, retention
  - ListBackups from .meta.json sidecars
  - DeleteBackup with path traversal protection
  - RestoreFromBackup with stop/rename/extract/restart + rollback on failure
  - 4 message handlers (handleBackupCreate/List/Delete/Restore)
- Modified `agent/main.go` — added 4 cases to receiveMessages switch
  - backup.create and backup.restore run as goroutines (long-running)

### Phase 3: Manager Routes — DONE
- Modified `AgentConnection.ts`:
  - 4 DO fetch routes (backup create/sync/delete/restore)
  - backup.progress handler in routeMessage switch
  - handleBackupProgress broadcasts to all UI WebSocket subscribers
  - handleBackupCreateRequest (5min timeout)
  - handleBackupSyncRequest (30s timeout)
  - handleBackupDeleteRequest (30s timeout)
  - handleBackupRestoreRequest (10min timeout)
- Modified `routes/agents.ts`:
  - POST create backup (D1 insert + DO call + D1 update)
  - GET list backups (D1 query)
  - POST sync backups (agent list → D1 reconcile)
  - DELETE backup (DO delete + D1 delete)
  - POST restore (DO call + D1 status update)

### Phase 4: Frontend — DONE
- Added to `api.ts`: listBackups, createBackup, deleteBackup, restoreBackup, syncBackups
- Created `useBackups.ts`: useBackups, useCreateBackup, useDeleteBackup, useRestoreBackup, useSyncBackups
- Created `useBackupProgress.ts`: WebSocket progress hook (same pattern as useMoveProgress)
- Created `BackupsTab.tsx`: Full UI with create form, progress banner, backup list table, confirm dialogs
- Modified `ServerDetail.tsx`: Replaced placeholder with BackupsTab component, cleaned unused imports

### Phase 5: Build Verification — DONE
- Agent build: passes (Docker cross-compilation, 7.7M binary)
- Frontend build: passes (TypeScript + Vite)
- Fixed 3 TS errors: type-only import for Backup, unused AlertTriangle, forward-ref of progress variable

### Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| TS1484: Backup type import | 1 | Changed to `import type { Backup }` |
| TS6133: AlertTriangle unused | 1 | Removed from import |
| TS2448: progress used before declaration | 1 | Added separate `progressEnabled` state |
| TS6133: CardHeader/CardTitle unused | 1 | Removed from ServerDetail import |

### Next Steps
- [x] Push to dev branch for CI deployment
- [x] Test end-to-end on dev environment

## Session 2 — 2026-02-07

### E2E Testing on Dev

- Connected test VM agent to dev environment
- Backup attempts failed because agent auto-updated to v1.0.5 (no backup code)
- Root cause: `updater.CheckOnce()` on startup replaces binary with latest release
- **Fix**: Added `--no-update` CLI flag to skip auto-update during development
- After fix: Create backup, Restore from backup both work end-to-end
- Also logged bug: install command hardcodes prod WS URL even on dev

### Test Results
| Operation | Result |
|-----------|--------|
| Create backup (100KB test data) | OK — tar.gz created, D1 updated, UI shows Complete |
| Restore from backup | OK — data preserved in data.pre-restore.*, archive extracted |
| Delete backup | Not tested yet (UI button visible) |

### Code Changes This Session
- `agent/main.go` — Added `--no-update` flag to skip auto-update
