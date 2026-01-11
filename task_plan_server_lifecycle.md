# Task Plan: Server Lifecycle Management

**Goal:** Make the manager the source of truth for server state, with robust recovery and delete operations

**Status:** Phase 1-6 Complete, Phase 7 In Progress
**Priority:** High (architectural improvement discovered during port validation work)
**Created:** 2026-01-10
**Last Updated:** 2026-01-11

---

## Problem Statement

Current issues discovered during port validation work:

1. ❌ Container deletion = server becomes "orphaned" (invisible in UI)
2. ❌ Server config and port allocations lost when container is deleted
3. ❌ No way to recover if container is accidentally deleted
4. ❌ Delete action is ambiguous (DB only? Container only? Both?)
5. ❌ Manager doesn't track whether server data exists on host
6. ❌ No distinction between "stopped" and "missing" containers

**Current Architecture Problem:**
- Container existence = server existence
- Docker is source of truth for server state
- Manager DB is just metadata storage
- Deleting container orphans the server record

**Desired Architecture:**
- Manager DB is source of truth for server state
- Container is just runtime manifestation of server
- Accidental container deletion is recoverable
- Clear separation between soft delete and hard delete

---

## Proposed Architecture

### Server States

**New State Machine:**
```
creating → running → stopped → deleted → purged
              ↓
           missing (container deleted but server config preserved)
              ↓
           running (recoverable via "Start" action)
```

**State Definitions:**
- `creating` - Server being created, container starting
- `running` - Container exists and is running
- `stopped` - Container exists but is stopped
- `missing` - Server defined in DB, container missing (may be recoverable)
- `failed` - Server creation failed (existing state)
- `deleted` - Soft delete, container removed, data preserved for cleanup
- `purged` - Hard delete completed (record can be removed from DB)

### Manager Responsibilities (Source of Truth)

**Server Record Fields:**
```typescript
interface Server {
  id: string;
  agent_id: string;
  name: string;
  container_id: string | null;
  config: string; // JSON ENV variables
  image_tag: string;
  game_port: number;
  udp_port: number;
  rcon_port: number;
  status: ServerStatus;
  data_exists: boolean;  // NEW - does server data exist on host?
  deleted_at: number | null;  // NEW - soft delete timestamp
  created_at: number;
  updated_at: number;
}
```

**Server Actions:**
- `GET /servers` - List all servers (including missing/deleted)
- `POST /servers` - Create new server
- `POST /servers/:id/start` - Start server (create container if missing)
- `POST /servers/:id/stop` - Stop container
- `POST /servers/:id/restart` - Restart container
- `POST /servers/:id/rebuild` - Pull new image, recreate container
- `DELETE /servers/:id` - Soft delete (mark deleted, remove container, preserve data)
- `DELETE /servers/:id/purge` - Hard delete (remove DB + container + data)

### Agent Responsibilities (Executor)

**Data Existence Checking:**
```go
type ServerDataStatus struct {
    ServerName  string `json:"serverName"`
    DataExists  bool   `json:"dataExists"`
    BinPath     string `json:"binPath"`
    DataPath    string `json:"dataPath"`
    BinSize     int64  `json:"binSize"`   // Optional: size in bytes
    DataSize    int64  `json:"dataSize"`  // Optional: size in bytes
}
```

**New Message Handler:**
- `server.checkdata` - Check if server data directories exist
- Returns `ServerDataStatus` with existence flags

**Container Creation from Config:**
- Agent can create container from server DB config
- Even if original container was deleted
- Preserves port allocations, ENV, volumes

### UI Experience

**Server Status Display:**
```
[Running] Server Name (Ports: 16261-16262)
  [Stop] [Restart] [Rebuild] [Delete]

[Stopped] Server Name (Ports: 16261-16262)
  [Start] [Delete]

[Missing - Data Exists] Server Name (Ports: 16261-16262) ⚠️
  [▶️ Start] [🗑️ Purge]
  Note: Container was deleted but server data exists. Click Start to recover.

[Missing - No Data] Server Name (Ports: 16261-16262) ⚠️
  [🗑️ Purge]
  Note: Orphaned server record. No container or data found.

[Deleted - Pending Cleanup] Server Name (Ports: 16261-16262)
  [↩️ Restore] [🗑️ Purge]
  Note: Soft deleted. Data preserved for 24h.
```

**Action Confirmations:**
```
Delete Server:
  "Stop and remove container? Server data will be preserved for 24 hours.
   You can restore the server during this time."
  [Cancel] [Delete]

Purge Server:
  "⚠️ PERMANENT ACTION
   This will remove:
   - Server database record
   - Container (if exists)
   - Server data (bin/ and data/ directories)

   Port allocations (16261-16262) will be released.

   This action cannot be undone."
  [Remove Data] [Keep Data]  [Cancel]
```

---

## Implementation Phases

### Phase 1: Database Schema Updates

**Tasks:**
- [ ] Add `data_exists` BOOLEAN field to servers table
- [ ] Add `deleted_at` INTEGER field to servers table (NULL = not deleted)
- [ ] Add migration script for D1 database
- [ ] Update TypeScript types in manager

**Files to Modify:**
- `manager/migrations/` - Add migration SQL
- `manager/src/types.ts` - Update Server interface

**Estimated Complexity:** Low

---

### Phase 2: Agent Data Existence Checking

**Tasks:**
- [ ] Add `CheckServerData()` function in agent
  - Check if `/var/lib/zedops/servers/{server-name}/bin` exists
  - Check if `/var/lib/zedops/servers/{server-name}/data` exists
  - Get directory sizes (optional)
- [ ] Add `server.checkdata` message handler
- [ ] Add batch checking for all servers (efficiency)
- [ ] Return `ServerDataStatus` structure

**Files to Modify:**
- `agent/server.go` - Add CheckServerData() function
- `agent/main.go` - Add server.checkdata handler

**Implementation Notes:**
- Use `os.Stat()` to check directory existence
- Use `filepath.Walk()` to calculate sizes (optional, for future usage display)
- Batch checking: accept array of server names, return array of statuses

**Estimated Complexity:** Low

---

### Phase 3: Manager Server Status Sync

**Tasks:**
- [ ] Add periodic status sync task (every 30s)
- [ ] Query agent for container status + data existence
- [ ] Update `data_exists` field in DB
- [ ] Update `status` field based on:
  - Container exists + running → `running`
  - Container exists + stopped → `stopped`
  - Container missing + data exists → `missing`
  - Container missing + no data → `missing` (orphaned)
- [ ] Add sync endpoint for manual trigger

**Files to Modify:**
- `manager/src/durable-objects/AgentConnection.ts` - Add sync task
- `manager/src/routes/agents.ts` - Add manual sync endpoint

**Implementation Notes:**
- Run sync on agent connection (first sync)
- Run periodic sync every 30 seconds
- Update DB efficiently (batch UPDATE)
- Log state transitions

**Estimated Complexity:** Medium

---

### Phase 4: Server Start with Container Creation

**Tasks:**
- [ ] Modify `POST /servers/:id/start` endpoint
- [ ] If container exists: start it normally
- [ ] If container missing + data exists:
  - Create new container from server DB config
  - Use stored ports, ENV, image_tag
  - Mount existing data directories
  - Update container_id in DB
  - Start container
- [ ] If container missing + no data:
  - Return error: "Cannot start server, no data found"
- [ ] Add UI "Start" button for missing servers

**Files to Modify:**
- `manager/src/routes/agents.ts` - Update start endpoint logic
- `manager/src/durable-objects/AgentConnection.ts` - Add server.create message
- `agent/server.go` - Add CreateServerFromConfig() function
- `frontend/src/components/ContainerList.tsx` - Add Start button for missing servers

**Implementation Notes:**
- CreateServerFromConfig() is similar to existing CreateServer()
- But uses provided config instead of discovering from running container
- Preserves exact port allocations
- Uses exact ENV from DB config

**Estimated Complexity:** Medium-High

---

### Phase 5: Soft Delete and Purge

**Tasks:**
- [ ] Update `DELETE /servers/:id` to soft delete:
  - Set `deleted_at = NOW()`
  - Set `status = 'deleted'`
  - Remove container (keep data)
  - Keep DB record
- [ ] Add `DELETE /servers/:id/purge` endpoint:
  - Remove container (if exists)
  - Remove data directories (optional flag)
  - Remove DB record
- [ ] Add background cleanup job:
  - Find servers where `deleted_at < NOW() - 24h`
  - Auto-purge them (configurable retention)
- [ ] Add `POST /servers/:id/restore` endpoint:
  - Restore soft-deleted server
  - Set `deleted_at = NULL`
  - Set `status = 'missing'`

**Files to Modify:**
- `manager/src/routes/agents.ts` - Update delete, add purge, add restore
- `manager/src/durable-objects/AgentConnection.ts` - Add cleanup job
- `frontend/src/lib/api.ts` - Add purge and restore functions
- `frontend/src/hooks/useServers.ts` - Add purge and restore hooks

**Implementation Notes:**
- Soft delete default behavior (safe)
- Purge requires explicit user action
- Purge shows confirmation with data size
- Restore brings server back to missing state
- Background cleanup configurable via ENV

**Estimated Complexity:** Medium

---

### Phase 6: UI Updates

**Tasks:**
- [ ] Update ContainerList to show all server states
- [ ] Add state-specific action buttons:
  - Running: [Stop] [Restart] [Rebuild] [Delete]
  - Stopped: [Start] [Delete]
  - Missing (data exists): [▶️ Start] [🗑️ Purge]
  - Missing (no data): [🗑️ Purge]
  - Deleted: [↩️ Restore] [🗑️ Purge Now]
- [ ] Add visual indicators for each state
- [ ] Update confirmation dialogs with clear explanations
- [ ] Add "Show Deleted Servers" toggle
- [ ] Display data existence status

**Files to Modify:**
- `frontend/src/components/ContainerList.tsx` - Major UI overhaul
- `frontend/src/components/ServerForm.tsx` - No changes needed
- Add CSS for state indicators

**Visual Design:**
```
State Badges:
- Running: Green badge
- Stopped: Gray badge
- Missing (data): Yellow badge with ⚠️
- Missing (no data): Red badge with ⚠️
- Deleted: Orange badge with 🗑️
- Failed: Red badge with ❌
```

**Estimated Complexity:** High

---

### Phase 7: Automatic Sync Detection (Post-Implementation Enhancement)

**Context:** After implementing Phases 1-6, user observed that `docker stop` is detected instantly in UI, but `docker rm` requires manual sync button. Investigation revealed the frontend already has all data needed to detect this discrepancy automatically.

**Problem:**
- Frontend polls both containers (Docker) and servers (DB) every 5s
- `docker stop` appears instant because stopped containers remain in container list
- `docker rm` requires manual sync because server DB record shows `status='running'` but container is gone
- Manual sync button feels redundant when system already detects stopped containers

**Solution:**
- Add automatic sync detection via `useEffect` in ContainerList
- Watch for servers with `status='running'` but missing from container list
- Automatically trigger sync when discrepancy detected
- Debounce with 10s cooldown per server to prevent excessive calls

**Tasks:**
- [x] Document investigation in findings_server_lifecycle.md
- [x] Add `useEffect` hook in ContainerList.tsx after line 52
- [x] Import `useRef` from React for debounce tracking
- [x] Implement mismatch detection logic
- [x] Implement automatic sync trigger with debounce
- [ ] Test with manual `docker rm` commands
- [ ] Verify sync only triggers once per discrepancy
- [x] Keep manual sync button for debugging/force refresh

**Files to Modify:**
- `frontend/src/components/ContainerList.tsx` - Add automatic sync detection

**Implementation Code:**
```typescript
// Automatic sync detection
const lastSyncRef = useRef<{ [serverId: string]: number }>({});

useEffect(() => {
  if (!data || !serversData || syncServersMutation.isPending) return;

  const now = Date.now();
  const containers = data.containers;
  const servers = serversData.servers;

  // Find servers with missing containers
  const missingContainers = servers.filter(server => {
    // Skip transient states
    if (['creating', 'deleting', 'deleted'].includes(server.status)) {
      return false;
    }

    // Server thinks it has a running container
    if (server.status === 'running' && server.container_id) {
      // But container doesn't exist
      return !containers.find(c => c.id === server.container_id);
    }

    return false;
  });

  // Trigger sync if discrepancies found
  if (missingContainers.length > 0) {
    // Check if we recently synced for these servers (within 10s)
    const needsSync = missingContainers.some(server => {
      const lastSync = lastSyncRef.current[server.id] || 0;
      return now - lastSync > 10000; // 10 second debounce
    });

    if (needsSync) {
      console.log('Auto-sync triggered for', missingContainers.length, 'servers');
      syncServersMutation.mutateAsync({ agentId }).then(() => {
        // Mark all as synced
        missingContainers.forEach(server => {
          lastSyncRef.current[server.id] = now;
        });
      });
    }
  }
}, [data, serversData, agentId, syncServersMutation]);
```

**Benefits:**
- `docker rm` detection feels as instant as `docker stop` detection
- Uses existing polling mechanism (no new backend infrastructure)
- Reuses existing sync endpoint
- Minimal code (~30 lines)
- Manual sync button remains for edge cases

**Edge Cases Handled:**
- Don't sync during transient states (`creating`, `deleting`, `deleted`)
- Don't sync if already syncing (check `syncServersMutation.isPending`)
- Don't re-sync same servers within 10s (debounce)
- Skip servers without container_id (never had container)

**Estimated Complexity:** Low

---

## Success Criteria

- [x] Accidentally deleted container can be recovered with "Start" button
- [x] Server config (ports, ENV) preserved even if container deleted
- [x] Clear distinction between soft delete and hard delete (purge)
- [x] UI shows server state regardless of container existence
- [x] Data existence is tracked and displayed
- [ ] Soft-deleted servers auto-purge after 24h (configurable) - Not implemented yet
- [x] Port allocations preserved until server is purged
- [x] All server operations work regardless of container state
- [ ] Container deletion automatically detected without manual sync button (Phase 7)

---

## Testing Plan

### Test Cases

1. **Container Recovery**
   - Create server
   - Manually `docker rm` the container
   - Verify server shows as "Missing - Data Exists"
   - Click "Start" button
   - Verify container recreated with same ports/config
   - Verify server returns to "Running" state

2. **Soft Delete**
   - Create server
   - Click "Delete" button
   - Verify container removed
   - Verify server shows as "Deleted"
   - Verify data directories still exist
   - Verify port allocations still reserved

3. **Restore Deleted Server**
   - Soft delete a server
   - Click "Restore" button
   - Verify server back to "Missing" state
   - Click "Start" to recover
   - Verify server running with original config

4. **Hard Delete (Purge)**
   - Create server
   - Click "Purge" button
   - Confirm data removal
   - Verify container removed
   - Verify data directories removed
   - Verify DB record removed
   - Verify ports released

5. **Orphaned Server Detection**
   - Create server
   - Manually delete data directories
   - Manually `docker rm` container
   - Verify server shows as "Missing - No Data"
   - Verify only "Purge" action available (no "Start")

6. **Auto-Cleanup**
   - Soft delete a server
   - Wait 24h (or adjust cleanup interval to 1min for testing)
   - Verify server auto-purged
   - Verify data removed
   - Verify ports released

---

## Risks & Mitigations

**Risk 1:** Database migration on production D1 may fail
- **Mitigation:** Test migration on development first
- **Mitigation:** Add rollback script
- **Mitigation:** Migrations are additive (non-destructive)

**Risk 2:** Status sync creates performance issues
- **Mitigation:** Batch updates (single query for all servers)
- **Mitigation:** Run sync only when agent connected
- **Mitigation:** Configurable sync interval

**Risk 3:** Container recreation fails (config changed)
- **Mitigation:** Validate config before creation
- **Mitigation:** Show clear error message
- **Mitigation:** Keep server in "missing" state on failure

**Risk 4:** User confusion about delete vs purge
- **Mitigation:** Clear confirmation dialogs
- **Mitigation:** Visual warnings for purge
- **Mitigation:** Default to safe operation (soft delete)

---

## Dependencies

- D1 database migrations (existing capability)
- Agent server creation logic (existing)
- Docker SDK (existing)
- React Query state management (existing)

---

## Future Enhancements (Post-MVP)

- Server cloning (copy config to create new server)
- Server templates (save configs for reuse)
- Bulk operations (soft delete multiple servers)
- Server groups/tags for organization
- Disk usage monitoring (show data sizes)
- Backup/restore functionality
- Server state change notifications

---

## Open Questions

1. **Cleanup Interval:** 24h default for soft-deleted servers? Configurable?
2. **Port Reallocation:** Should soft-deleted servers reserve ports? (Proposed: Yes)
3. **Data Size Display:** Show disk usage for each server? (Future enhancement)
4. **State Transitions:** Should we allow direct transitions (e.g., running → deleted)?
5. **Batch Operations:** Should we support bulk soft delete / purge?

---

## Estimated Timeline

- Phase 1: 1 session (DB schema) ✅ Complete
- Phase 2: 1 session (Agent data checking) ✅ Complete
- Phase 3: 1-2 sessions (Status sync) ✅ Complete
- Phase 4: 2 sessions (Container creation from config) ✅ Complete
- Phase 5: 2 sessions (Soft delete + purge) ✅ Complete
- Phase 6: 2-3 sessions (UI updates) ✅ Complete
- Phase 7: 1 session (Automatic sync detection) 🚧 In Progress

**Total:** ~10-12 development sessions (11 sessions completed so far)

---

## Related Work

- Builds on Port Validation feature (Phase 1-4 complete)
- Addresses orphaned server issue discovered during port validation
- Improves on current rebuild feature (Phase 2b)
- Foundation for future backup/restore features

---

## References

- `planning-history/port-validation/` - Related feature that revealed this need
- `MILESTONES.md` - Overall project roadmap
- `ARCHITECTURE.md` - System architecture
