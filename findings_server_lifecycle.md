# Findings: Server Lifecycle Management

**Date**: 2026-01-10
**Goal**: Research current server implementation to design lifecycle improvements

---

## Database Schema Analysis

### Current `servers` Table Structure
```sql
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  container_id TEXT,                    -- Nullable, but no distinction between cases
  config TEXT NOT NULL,                 -- JSON ENV vars
  image_tag TEXT NOT NULL,
  game_port INTEGER NOT NULL,
  udp_port INTEGER NOT NULL,
  rcon_port INTEGER NOT NULL,
  status TEXT NOT NULL,                 -- Limited: creating, running, stopped, failed, deleting
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
```

**Migration**: `/Volumes/Data/docker_composes/zedops/manager/migrations/0003_create_servers_table.sql`

**Current Status Values**: `creating` | `running` | `stopped` | `failed` | `deleting`

**Issues Identified**:
1. `container_id` nullable but no way to distinguish:
   - Never created (failed before reaching agent)
   - Container manually deleted (`docker rm`)
2. No `data_exists` field (can't track if server data is on host)
3. No `deleted_at` field (can't implement soft delete)
4. DELETE removes DB record immediately (port allocations lost)

---

## Server Creation Flow Analysis

**Manager Side** (`manager/src/routes/agents.ts` lines 566-789):
1. Validate admin password and server name
2. Auto-suggest ports if not provided (lines 624-655)
3. Port conflict detection (lines 657-694):
   - Database check (existing port allocations)
   - Host-level check (via agent)
4. Insert DB record: `status='creating'`, `container_id=NULL` (lines 700-717)
5. Forward to AgentConnection DO via HTTP POST (lines 719-738)
6. On success: Update `container_id` and `status='running'` (lines 752-759)
7. On failure: Update `status='failed'` (lines 740-746)

**Agent Side** (`agent/server.go` lines 32-166):
1. Pull image from registry
2. Create directories: `/var/lib/zedops/servers/{name}/bin` and `/data`
3. Create container with:
   - Labels: `zedops.managed=true`, `zedops.server.id`, `zedops.server.name`
   - Networks: `zomboid-servers`, `zomboid-backend`
   - Volumes: bind mounts
   - Ports: UDP bindings
   - Restart policy: `unless-stopped`
4. Start container
5. Return `container_id` to manager

**Key Observations**:
- Request/reply pattern (NATS-style with `_INBOX.*` subjects)
- 60-second timeout for creation
- Container ID populated only after successful agent response
- If agent never responds, `container_id` stays NULL

---

## Server Deletion Flow Analysis

**Manager Side** (`manager/src/routes/agents.ts` lines 969-1078):
1. Validate server exists
2. If `container_id=NULL`: Delete from DB directly (lines 1005-1017)
3. Update `status='deleting'` (lines 1019-1024)
4. Forward to agent via DO (lines 1026-1049)
5. On success: Delete DB record (lines 1063-1068)
6. On failure: Revert to `status='failed'` (lines 1051-1061)

**Agent Side** (`agent/server.go` lines 168-214):
1. Inspect container to get server name from label
2. Stop container (10s timeout)
3. Remove container
4. Optional: Remove `/var/lib/zedops/servers/{name}/` directory

**Issues Identified**:
- DB record deleted immediately on success
- Port allocations lost permanently
- No way to recover if user accidentally deletes
- No soft delete mechanism

---

## Orphaned Server Detection

**Finding**: Orphaned server detection already partially implemented!

**Location**: `/Volumes/Data/docker_composes/zedops/frontend/src/components/ContainerList.tsx`

**Lines 355-365**: `getOrphanedServers()` function
```typescript
const getOrphanedServers = (): Server[] => {
  if (!serversData || !data) return [];

  const containerIds = new Set(data.containers.map(c => c.id));

  return serversData.servers.filter(server => {
    if (!server.container_id) return true;
    return !containerIds.has(server.container_id);
  });
};
```

**Lines 516-542**: Warning banner showing orphaned servers
**Lines 477-497**: "Clean Up Orphaned Servers" button

**What It Does**:
- Detects servers where `container_id` doesn't exist in actual container list
- Shows warning banner with list of orphaned servers
- Provides bulk cleanup button
- Only shown when orphaned servers exist

**What It Doesn't Do**:
- Can't recover orphaned servers (no "Start" button)
- Can't distinguish between "data exists" vs "no data"
- No per-server actions in orphaned state

---

## UI Rendering Pattern

**File**: `/Volumes/Data/docker_composes/zedops/frontend/src/components/ContainerList.tsx`

**Data Sources**:
```typescript
const { data } = useContainers(agentId);       // Docker containers from agent
const { data: serversData } = useServers(agentId);  // Server records from DB
```

**Current Rendering**:
- Lines 593-780: Main table shows **containers only**
- Server info shown via `getServerFromContainerId()` lookup (lines 351-353)
- Server actions (Rebuild, Delete) are **conditional per container row** (lines 689-758)
- Orphaned servers only visible in warning banner (not main table)

**Refetch Interval**: 5 seconds (lines useContainers.ts:24, useServers.ts:26)

**Key Insight**: UI is container-centric, not server-centric. This makes sense when containers exist, but breaks down for orphaned servers.

---

## Durable Object Lifecycle

**File**: `/Volumes/Data/docker_composes/zedops/manager/src/durable-objects/AgentConnection.ts`

**WebSocket Handling** (lines 124-159):
- Agent connects via `/ws?name=<agent-name>`
- Each agent gets consistent DO instance via `idFromName(agentName)`
- Event listeners: `message`, `close`, `error`

**Heartbeat Mechanism** (lines 439-461):
- `handleAgentHeartbeat()` is **reactive only**
- Agent sends heartbeat → updates `last_seen` in D1
- **NO periodic task from DO side**

**Connection Lifecycle**:
- OnConnect: Accept WebSocket, register handlers
- OnMessage: Route to `routeMessage()` (lines 191-256)
- OnClose/Error: Update agent status to `offline` (lines 482-527)
- **NO cleanup timers or periodic sync**

**Key Findings**:
- DOs can run `setInterval()` but only while actively receiving messages
- Cloudflare has 30-second execution limit per request
- Current architecture is agent-pull, not server-push
- Best approach for sync: on-demand endpoint + call on agent connect

---

## Agent Data Path Configuration

**Migrations**:
- **0002**: Added `steam_zomboid_registry` to agents table
- **0004**: Added `server_data_path` to agents table (default: `/var/lib/zedops/servers`)

**Usage**: Manager fetches these values when creating servers (agents.ts lines 603-607)

**Paths**:
- Bin: `/var/lib/zedops/servers/{server-name}/bin`
- Data: `/var/lib/zedops/servers/{server-name}/data`

**Insight**: Agent knows where data should be, so it can check existence.

---

## Container-Server Linking

**Current Method**: Match `server.container_id` to `container.id`

**Labels Used**:
- `zedops.managed=true` - Filter managed containers
- `zedops.server.id={uuid}` - Link to DB record
- `zedops.server.name={name}` - Human-readable name

**Benefit**: Even if `container_id` in DB is stale, we can re-link via labels.

---

## Port Validation System (Recently Completed)

**From**: `planning-history/port-validation/`

**Key Features**:
- 3-layer checking: DB, Docker, Host
- Auto-suggest next available ports
- Phase 3: Enhanced UI with port configuration section
- Phase 4: Failed server recovery ("Edit & Retry" button)
- Bulk cleanup for failed servers

**Relevant to Lifecycle Management**:
- Port allocations stored in DB
- Currently lost when server deleted
- Should be preserved until purge operation

---

## Architectural Insights

### Current Problems
1. **Container deletion = server orphaned** (invisible in main UI)
2. **Server config lost** on delete (can't recover)
3. **Port allocations lost** on delete (can't restore)
4. **No distinction** between "container stopped" and "container missing"
5. **No data existence tracking** (can't tell if recovery is possible)

### Root Cause
- Docker is source of truth for server existence
- Manager DB is just metadata storage
- Deleting container breaks the system

### Desired State
- Manager DB is source of truth for server state
- Container is runtime manifestation of server
- Accidental container deletion is recoverable
- Soft delete preserves everything for 24h

---

## Design Constraints

### Database
- D1 has ALTER TABLE support (can add columns)
- Migrations run via `wrangler d1 execute`
- Must be backwards compatible (existing servers)

### Agent
- Written in Go
- Uses Docker SDK for container operations
- Can check file existence with `os.Stat()`
- Already has directory paths from manager

### UI
- React with TanStack Query
- 5-second polling interval (aggressive)
- Inline styles (no CSS modules)
- Conditional rendering based on server status

### Durable Objects
- WebSocket-based communication
- Request/reply pattern with timeouts
- Can use `ctx.waitUntil()` for background tasks
- 30-second execution limit per request

---

## Proposed Solutions

### Phase 1: Database Schema
Add fields:
```sql
ALTER TABLE servers ADD COLUMN data_exists BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE servers ADD COLUMN deleted_at INTEGER DEFAULT NULL;
```

### Phase 2: Agent Data Checking
```go
func (dc *DockerClient) CheckServerData(serverName, dataPath string) ServerDataStatus {
    binPath := filepath.Join(dataPath, serverName, "bin")
    dataPathFull := filepath.Join(dataPath, serverName, "data")

    return ServerDataStatus{
        ServerName: serverName,
        DataExists: dirExists(binPath) || dirExists(dataPathFull),
        BinPath:    binPath,
        DataPath:   dataPathFull,
    }
}
```

### Phase 3: Status Sync
- Leverage existing 5s polling
- Add `GET /api/agents/:id/servers/sync` endpoint
- Compare container list + data existence + DB state
- Batch update server statuses

### Phase 4: Container Recreation
- Modify start endpoint to create container from DB config if missing
- Reuse existing `CreateServer()` function
- Update `container_id` in DB

### Phase 5: Soft Delete
- DELETE → set `status='deleted'`, `deleted_at=NOW()`
- Add PURGE → hard delete (DB + container + data)
- Add RESTORE → undelete (set `deleted_at=NULL`, `status='missing'`)

### Phase 6: UI Updates
- Add "All Servers" section after containers table
- Show server state regardless of container
- State-specific action buttons
- Visual badges for each state
- "Show Deleted Servers" toggle

---

## Key Files Reference

| Component | File | Key Lines |
|-----------|------|-----------|
| DB migrations | manager/migrations/ | - |
| Server CRUD | manager/src/routes/agents.ts | 566-789 (create), 969-1078 (delete) |
| AgentConnection DO | manager/src/durable-objects/AgentConnection.ts | 124-159 (WS), 439-461 (heartbeat) |
| Agent server ops | agent/server.go | 32-166 (create), 168-214 (delete) |
| Agent message routing | agent/main.go | 639-683 (create), 686-717 (delete) |
| UI container list | frontend/src/components/ContainerList.tsx | 593-780 (table), 355-365 (orphaned) |
| API client | frontend/src/lib/api.ts | - |
| Server hooks | frontend/src/hooks/useServers.ts | - |

---

## Container State Detection Analysis (Post-Implementation)

**Context**: After implementing Phases 1-6, user observed that `docker stop` is detected instantly in UI, but `docker rm` requires manual sync button.

### Current Polling Mechanism

**Frontend Hooks** (`frontend/src/hooks/`):
- `useContainers()`: Polls `GET /api/agents/:id/containers` every 5s (useContainers.ts:24)
- `useServers()`: Polls `GET /api/agents/:id/servers` every 5s (useServers.ts:31)

**Two Data Streams**:
1. **Containers** → Queries Docker directly via agent → Live container state
2. **Servers** → Queries D1 database → Stored server state

### Why `docker stop` Appears Instant

**Path**: Docker → Agent → Manager DO → Frontend
- Container list endpoint returns stopped containers with `state='exited'`
- Frontend renders container state directly from Docker response
- This is showing **container state** from Docker, not **server status** from DB
- No database update required

**UI Behavior**:
- Shows "State: exited" badge immediately
- Shows "Start" button (container-level operation)
- Server status in DB still shows `'running'` until sync

### Why `docker rm` Needs Manual Sync

**What Happens**:
1. Container deleted from Docker
2. Container disappears from `GET /containers` response
3. Server record in DB still has:
   - `status='running'`
   - `container_id=<deleted-container-id>`
4. Frontend shows server in "All Servers" list with wrong status
5. Manual sync button triggers status update

**Database Sync Required**:
- Update `status` to `'missing'`
- Update `data_exists` based on directory check
- Clear stale `container_id` reference (optional)

### Automatic Sync Detection Solution

**Key Insight**: Frontend already has all data needed to detect discrepancy!

**Detection Logic**:
```typescript
// Frontend receives both:
containers: Container[]  // From Docker (every 5s)
servers: Server[]        // From DB (every 5s)

// Detect servers with missing containers:
servers.filter(server => {
  // Server claims to be running with a container
  if (server.status === 'running' && server.container_id) {
    // But container doesn't exist in Docker
    return !containers.find(c => c.id === server.container_id);
  }
  return false;
});

// Automatically trigger sync when discrepancy detected
```

**Implementation Approach**:
1. Add `useEffect()` in ContainerList.tsx
2. Watch for mismatches between servers and containers data
3. Automatically call `syncServersMutation` when mismatch detected
4. Debounce to avoid excessive sync calls
5. Track last sync time to prevent re-syncing same issue

**Benefits**:
- No manual sync button needed
- Feels as responsive as `docker stop` detection
- Uses existing polling mechanism
- No new backend infrastructure required
- Minimal frontend code (~20 lines)

**Edge Cases to Handle**:
- Don't sync during `creating` or `deleting` states (transient)
- Don't sync if already syncing (prevent duplicate calls)
- Don't sync immediately after user action (wait for DB update)
- Only sync once per discrepancy (use ref to track)

### Why This Works Better Than Event Monitoring

**Rejected Approach**: Docker Events API
- Requires agent to monitor Docker daemon events
- Need WebSocket push from agent to manager
- Complex state management (which DO instance to notify)
- Adds latency (event → agent → manager → DO → DB → frontend)

**Chosen Approach**: Smart Polling
- Already polling both data sources every 5s
- Frontend can detect discrepancy immediately
- Sync only when needed (not every 5s)
- Reuses existing infrastructure
- Simple to implement and debug

### Implementation Location

**File**: `frontend/src/components/ContainerList.tsx`

**Add After Line 52** (after state declarations):
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

**Outcome**: Manual sync button becomes optional (keep for debugging/force refresh)

---

## Next Steps

All phases implemented (1-6). Final enhancement:
- Add automatic sync detection to eliminate manual sync button
- Update progress.md with final session notes
- Archive planning files to `planning-history/server-lifecycle-management/`
