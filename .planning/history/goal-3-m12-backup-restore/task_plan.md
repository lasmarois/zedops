# Task Plan: Goal #3 — M12: Backup & Restore

## Goal
Add manual backup and restore functionality for Project Zomboid server save data. Backups stored on agent host alongside server data, metadata tracked in D1 for fast UI listing.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backup storage | `{dataPath}/{serverName}/backups/` | Co-located with server data |
| What to back up | Only `data/` directory | `bin/` is large (2-4 GB) and recreatable |
| Metadata | D1 table + `.meta.json` sidecar on disk | D1 avoids hitting agent on every tab view |
| Progress | `backup.progress` WebSocket subject | Same pattern as `move.progress` |
| Pre-backup save | RCON `save` if server running; non-blocking if fails | Best-effort consistency |
| Restore safety | Rename `data/` to `data.pre-restore.{ts}/` before extracting | Rollback on failure |
| Retention | Max 10 backups per server; oldest auto-deleted | Simple disk usage control |
| Naming | `{ISO-timestamp}_{label}.tar.gz` | Sortable, descriptive |

---

## Phase 1: Database Migration — `status: complete`

- [x] Create `manager/migrations/0015_create_backups_table.sql`

## Phase 2: Agent Backup & Restore Logic — `status: complete`

- [x] Create `agent/backup.go` with all functions
- [x] Modify `agent/main.go` — add 4 message handlers (backup.create/list/delete/restore)

## Phase 3: Manager DO + API Routes — `status: complete`

- [x] Modify `AgentConnection.ts` — DO fetch routes + backup.progress broadcast
- [x] Modify `routes/agents.ts` — 5 API endpoints (create/list/sync/delete/restore)

## Phase 4: Frontend Hooks + UI — `status: complete`

- [x] Add API functions to `api.ts` (listBackups, createBackup, deleteBackup, restoreBackup, syncBackups)
- [x] Create `useBackups.ts` — TanStack Query hooks
- [x] Create `useBackupProgress.ts` — WebSocket progress hook
- [x] Create `BackupsTab.tsx` — full UI component
- [x] Modify `ServerDetail.tsx` — replace placeholder with BackupsTab

## Phase 5: Build Verification — `status: complete`

- [x] Agent build (Docker cross-compilation) — passes
- [x] Frontend build (TypeScript + Vite) — passes
- [ ] Push to dev, test end-to-end

---

## File Changes Summary

| File | Action |
|------|--------|
| `manager/migrations/0015_create_backups_table.sql` | **New** |
| `agent/backup.go` | **New** |
| `frontend/src/hooks/useBackups.ts` | **New** |
| `frontend/src/hooks/useBackupProgress.ts` | **New** |
| `frontend/src/components/BackupsTab.tsx` | **New** |
| `agent/main.go` | **Modify** — add 4 message handlers |
| `manager/src/durable-objects/AgentConnection.ts` | **Modify** — add DO routes + progress |
| `manager/src/routes/agents.ts` | **Modify** — add 5 API endpoints |
| `frontend/src/lib/api.ts` | **Modify** — add API functions |
| `frontend/src/pages/ServerDetail.tsx` | **Modify** — replace placeholder with BackupsTab |
