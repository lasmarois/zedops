# Server Lifecycle Management

**Status:** ✅ Complete
**Implementation Date:** 2026-01-10 to 2026-01-11
**Session:** 10

---

## Overview

Complete overhaul of server lifecycle management to make the manager the source of truth for server state, enabling recovery from accidental container deletion and providing clear delete operations.

## Problem Solved

Before this work:
- ❌ Accidental `docker rm` made servers invisible (orphaned)
- ❌ Server config and port allocations lost on delete
- ❌ No recovery mechanism for deleted containers
- ❌ No distinction between soft delete and hard delete

After this work:
- ✅ Accidental container deletion is recoverable
- ✅ Server config preserved even if container deleted
- ✅ Clear distinction: Delete = soft (24h), Purge = hard (permanent)
- ✅ UI shows all server states regardless of container
- ✅ Automatic sync detection for container state changes

---

## Architecture Changes

### Database Schema
- Added `data_exists` BOOLEAN field (tracks if server data on host)
- Added `deleted_at` INTEGER field (soft delete timestamp)

### Server States
- **creating** - Initial state
- **running** - Container exists and running
- **stopped** - Container exists but stopped
- **missing** - Container deleted but server config preserved (recoverable)
- **failed** - Creation failed
- **deleted** - Soft deleted, 24h retention
- **deleting** - In process of deletion

### Agent Capabilities
- `CheckServerData()` - Verifies if server data directories exist
- Batch data existence checking for efficiency

### Manager Features
- **Status Sync** - Compares container state with DB, updates automatically
- **Container Recreation** - Start button recreates container from DB config
- **Soft Delete** - Removes container, preserves data and ports for 24h
- **Purge** - Hard delete (DB + container + optional data removal)
- **Restore** - Brings back soft-deleted server

### UI Improvements
- **All Servers Section** - Shows every server regardless of container state
- **State-Specific Actions** - Different buttons based on server state
- **Visual Badges** - Color-coded status indicators
- **Automatic Sync Detection** - No manual sync button needed (kept for debugging)

---

## Implementation Phases

### Phase 1: Database Schema Migration ✅
- Added `data_exists` and `deleted_at` columns
- Updated TypeScript Server interface

### Phase 2: Agent Data Existence Checking ✅
- Implemented `CheckServerData()` in Go agent
- Added `server.checkdata` message handler
- Batch checking support

### Phase 3: Server Status Sync ✅
- Added `POST /api/agents/:id/servers/sync` endpoint
- Sync triggered on agent connect
- Compares container list + data existence vs DB state

### Phase 4: Server Start with Container Recreation ✅
- Start button recreates container from DB config if missing
- Reuses existing CreateServer logic
- Updates container_id in DB after recreation

### Phase 5: Soft Delete and Purge ✅
- DELETE endpoint → soft delete (sets deleted_at, removes container)
- Added `/purge` endpoint → hard delete (optional data removal)
- Added `/restore` endpoint → undelete server

### Phase 6: UI Updates ✅
- Added "All Servers" section showing all states
- State-specific action buttons
- Visual status badges
- Purge confirmation with data removal option
- Show/hide deleted servers toggle

### Phase 7: Automatic Sync Detection ✅
- **Initial**: Detected container deletion (`docker rm`)
- **Extended**: Added container stop/start detection (`docker stop`, `docker start`)
- Frontend watches for mismatches between container state and server status
- Automatic sync triggered within 5-10 seconds
- 10-second debounce per server prevents excessive syncing

---

## Key Technical Decisions

### Why Smart Polling over Event Monitoring

**Considered**: Docker Events API with WebSocket push from agent to manager

**Rejected Because**:
- Adds complexity (agent monitoring, WebSocket push, DO routing)
- Higher latency (event → agent → manager → DO → DB → frontend)
- More points of failure

**Chosen**: Smart polling with mismatch detection
- Already polling both data sources every 5s
- Frontend detects discrepancies instantly
- Triggers sync only when needed
- Simple to implement and debug
- Reuses existing infrastructure

### Automatic Sync Detection Logic

```typescript
// Three cases detected:
1. Container missing from list → docker rm
2. Server='running', Container='exited' → docker stop
3. Server='stopped', Container='running' → docker start

// Debounce strategy:
- Track last sync time per server
- Only sync if >10s since last sync for that server
- Prevents duplicate syncs during rapid changes
```

---

## Files Modified

### Backend (Manager)
- `manager/migrations/0005_add_server_lifecycle_fields.sql` (NEW)
- `manager/src/types/Server.ts`
- `manager/src/routes/agents.ts`
- `manager/src/durable-objects/AgentConnection.ts`

### Backend (Agent)
- `agent/server.go`
- `agent/main.go`
- `agent/docker.go`

### Frontend
- `frontend/src/components/ContainerList.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/hooks/useServers.ts`

---

## Testing Results

All test cases passed:

1. **Container Recovery** ✅
   - Created server → `docker rm` → Status shows "missing (recoverable)"
   - Clicked Start → Container recreated with same config
   - Auto-sync detected within 5-10s

2. **Soft Delete** ✅
   - Deleted server → Container removed, data preserved
   - Server shows as "deleted" in UI
   - Port allocations preserved

3. **Restore** ✅
   - Restored deleted server → Status "missing"
   - Started server → Recovered successfully

4. **Purge** ✅
   - Purged with data removal → All cleaned up
   - DB record removed, ports released

5. **Automatic Sync Detection** ✅
   - `docker rm` → Auto-detected, synced to 'missing' (5-10s)
   - `docker stop` → Auto-detected, synced to 'stopped' (5-10s)
   - `docker start` → Auto-detected, synced to 'running' (5-10s)
   - Debounce working (no duplicate syncs)

---

## Success Metrics

- [x] Accidentally deleted container can be recovered with "Start" button
- [x] Server config (ports, ENV) preserved even if container deleted
- [x] Clear distinction between soft delete and hard delete (purge)
- [x] UI shows server state regardless of container existence
- [x] Data existence is tracked and displayed
- [ ] Soft-deleted servers auto-purge after 24h (not implemented - future)
- [x] Port allocations preserved until server is purged
- [x] All server operations work regardless of container state
- [x] Container state changes automatically detected and synced

---

## Commits

1. `3b89dc9` - Phase 1-2: Database migration and agent data checking
2. `16c59c5` - Phase 3: Server status sync
3. `a4a1482` - Phase 4: Server start with container recreation
4. `c22e103` - Phase 5: Soft delete and purge
5. `85aa1c0` - Phase 6b: UI component updates
6. `27d86fe` - Phase 6c: TypeScript fixes and deployment
7. `38e3ced` - Phase 6d: Bug fix for container labels in sync
8. `befd7ff` - Phase 7: Automatic sync detection (initial)
9. `cc56d40` - Phase 7: Extended auto-sync for all state changes (final)

---

## Future Enhancements

- [ ] Auto-purge deleted servers after 24h (background job)
- [ ] Server cloning (copy config to create new server)
- [ ] Server templates (save configs for reuse)
- [ ] Bulk operations (multi-select delete/purge)
- [ ] Disk usage monitoring (show data sizes)
- [ ] Server state change notifications

---

## Related Work

- **Port Validation** (`planning-history/port-validation/`) - Discovered the orphaned server issue that led to this work
- **Rebuild Feature** - Extended by Phase 4 container recreation

---

## Planning Files

- `task_plan_server_lifecycle.md` - Complete implementation plan (7 phases)
- `findings_server_lifecycle.md` - Research and architectural analysis
- `progress.md` - Session-by-session implementation log
