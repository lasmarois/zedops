# Findings: M9.8.21 - Server Metrics Empty/Not Displaying

**Investigation started:** 2026-01-13

---

## Problem Statement

**User report:**
> "there is the servers metric that should be fixed, they are empty right now"

Server metrics are displaying as empty or not showing at all.

---

## Investigation

### Where Are Server Metrics Displayed?

Found locations:
- [x] **ServerDetail.tsx** (frontend/src/pages/ServerDetail.tsx) - Lines 200-268
  - 5 metric cards: Uptime, CPU, Memory, Disk, Players
  - **ALL METRICS ARE HARDCODED TO 0 OR "N/A"**
- [x] **AgentDetail.tsx** (frontend/src/pages/AgentDetail.tsx) - Lines 47-54
  - Shows HOST-level metrics (CPU, memory, disk)
  - **THIS IS WORKING** - displays real data from agent.metadata.metrics

### What Metrics Should Be Shown?

ServerDetail.tsx shows 5 metrics (lines 117-122):
- **Uptime**: Currently "N/A" (TODO: Calculate from container start time)
- **CPU Usage**: Currently 0% (TODO: Get from agent metrics)
- **Memory Usage**: Currently 0GB (TODO: Get from agent metrics)
- **Disk Usage**: Currently 0GB (TODO: Get from agent metrics)
- **Player Count**: Currently 0/32 (TODO: Get from RCON)

### Current State - Frontend

**ServerDetail.tsx placeholders (lines 117-122):**
```typescript
const uptime = "N/A" // TODO: Calculate from container start time
const players = { current: 0, max: 32 } // TODO: Get from RCON
const cpuPercent = 0 // TODO: Get from agent metrics
const memoryUsedGB = 0 // TODO: Get from agent metrics
const diskUsedGB = 0 // TODO: Get from agent metrics
```

**Problem**: No API fetching, no data structure, just placeholders.

---

## Discoveries

### Discovery 1: Metrics System IS Implemented (But Not for Per-Server)

**CRITICAL FINDING**: The ZedOps system HAS a complete metrics collection and transmission pipeline, but it only collects **HOST-level metrics**, NOT per-container metrics.

#### Agent-Side Metrics Collection (✅ WORKING)

**File**: `agent/metrics.go`

**CollectHostMetrics() function:**
- Collects HOST-level metrics every 30 seconds
- **CPU**: Parses `/proc/stat`, calculates delta between samples
- **Memory**: Reads `/proc/meminfo` (MemTotal and MemAvailable)
- **Disk**: Uses `syscall.Statfs()` on `/var/lib/zedops` (with fallback to `/`)

**Data Structure:**
```go
type HostMetrics struct {
    CPUPercent     float64   // Host CPU usage percentage
    MemoryUsedMB   int64     // Used memory in MB
    MemoryTotalMB  int64     // Total memory in MB
    DiskUsedGB     int64     // Used disk in GB
    DiskTotalGB    int64     // Total disk in GB
    DiskPercent    float64   // Disk usage percentage
    Timestamp      int64     // Unix timestamp
}
```

**Limitation**: No per-container metrics - cannot track individual server resource usage.

#### Agent→Manager Transmission (✅ WORKING)

**File**: `agent/reconnect.go` (lines 135-174)

**How it works:**
- Agent sends WebSocket heartbeat every 30 seconds
- Message subject: `agent.heartbeat`
- Payload includes `{ agentId, metrics }`
- Backward compatible: Sends heartbeat without metrics if collection fails

```go
func (a *Agent) sendHeartbeats(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    for {
        select {
        case <-ticker.C:
            metrics, err := CollectHostMetrics()
            msg := NewMessage("agent.heartbeat", map[string]interface{}{
                "agentId": a.agentID,
                "metrics": metrics,
            })
            a.sendMessage(msg)
        }
    }
}
```

#### Manager-Side Storage (✅ WORKING)

**File**: `manager/src/durable-objects/AgentConnection.ts` (lines 481-519)

**handleAgentHeartbeat() function:**
- Receives heartbeat messages
- Extracts `metrics` from message payload
- Stores in `agents.metadata` column as JSON
- Updates `last_seen` timestamp

**Database Schema** (`manager/schema.sql`):
```sql
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'offline',
    last_seen INTEGER,
    metadata TEXT,  -- ← Stores metrics as JSON: { metrics: {...} }
    ...
);
```

#### Manager API (✅ WORKING)

**File**: `manager/src/routes/agents.ts`

**Two endpoints return metrics:**
1. `GET /api/agents` - Returns all agents with metadata.metrics
2. `GET /api/agents/:id` - Returns single agent with metadata.metrics

**Response structure:**
```json
{
  "id": "...",
  "name": "...",
  "status": "online",
  "metadata": {
    "metrics": {
      "cpuPercent": 23.5,
      "memoryUsedMB": 4096,
      "memoryTotalMB": 16384,
      "diskUsedGB": 120,
      "diskTotalGB": 500,
      "diskPercent": 24.0,
      "timestamp": 1705152000,
      "lastUpdate": 1705152000
    }
  }
}
```

#### Frontend - AgentDetail (✅ WORKING)

**File**: `frontend/src/pages/AgentDetail.tsx` (lines 47-54)

**Successfully displays HOST metrics:**
```typescript
const metrics = agent.metadata?.metrics
const cpuPercent = metrics?.cpuPercent
const memUsedGB = metrics ? (metrics.memoryUsedMB / 1024).toFixed(1) : null
const diskUsedGB = metrics?.diskUsedGB
```

Shows with visual progress bars and real-time updates.

#### Frontend - ServerDetail (❌ NOT WORKING)

**File**: `frontend/src/pages/ServerDetail.tsx`

**Problem**: Hardcoded placeholders only, no data fetching.

---

### Discovery 2: Complete Data Flow Diagram

```
Agent (every 30s)
    ↓
CollectHostMetrics() [agent/metrics.go]
    ├─ CPU: /proc/stat
    ├─ Memory: /proc/meminfo
    └─ Disk: /var/lib/zedops (syscall.Statfs)
    ↓
WebSocket heartbeat: agent.heartbeat { agentId, metrics }
    ↓
Manager DurableObject [AgentConnection.ts:handleAgentHeartbeat()]
    ↓
UPDATE agents SET metadata = JSON({ metrics: {...} })
    ↓
API: GET /api/agents (returns agents with metadata.metrics)
    ↓
Frontend: useAgents() hook
    ↓
AgentDetail.tsx ✅ (displays metrics)
ServerDetail.tsx ❌ (placeholders only)
```

---

### Discovery 3: Gap Analysis - What's Missing for ServerDetail

| Metric | Status | Issue |
|--------|--------|-------|
| **CPU Usage** | ❌ Not available | Agent only provides HOST CPU, not per-container |
| **Memory Usage** | ❌ Not available | Agent only provides HOST memory, not per-container |
| **Disk Usage** | ❌ Not available | Agent only provides HOST disk, not per-container |
| **Uptime** | ❌ Not available | Need container start time from Docker API |
| **Player Count** | ❌ Not available | Requires RCON integration (separate system) |

**Root Cause**: No per-container metrics collection system exists.

---

### Discovery 4: What Data We Actually Have Available

**USER IS RIGHT**: We DO have access to the necessary data! Here's what's available:

#### Uptime - ✅ AVAILABLE NOW
**Source**: Docker ContainerInspect API (agent/docker.go line 115)
```go
inspect, err := dc.cli.ContainerInspect(ctx, containerID)
// inspect.State.StartedAt gives us container start time!
```

**Current status**:
- Agent has `GetContainerStatus()` function that calls ContainerInspect
- `StartedAt` is already being captured (line 125)
- NOT being sent to frontend yet

**To get uptime**: Calculate `time.Now() - inspect.State.StartedAt`

#### Docker Stats - ✅ CAN BE ADDED
**Source**: Docker Stats API (can call via existing Docker client)
```go
stats, err := dc.cli.ContainerStats(ctx, containerID, false) // false = one-time snapshot
// Returns: CPU %, Memory usage, Network I/O, Block I/O
```

**Current status**:
- Agent has Docker client initialized
- No function exists yet to call ContainerStats
- Would be ~30 lines of code to add

**What we'd get**:
- Per-container CPU usage (percentage)
- Per-container memory usage (bytes, limit)
- Network I/O (rx/tx bytes)
- Block I/O (read/write bytes)

#### Player Count - ❌ SEPARATE SYSTEM
**Source**: RCON query to game server
- Requires RCON integration (separate from metrics system)
- Need to implement RCON "players" command parsing
- More complex, can be done separately

---

### Discovery 5: Implementation Path (User's Suggestion)

**The user is correct** - we can implement per-server metrics using existing infrastructure:

**Option B (Revised): Implement Per-Container Metrics**

**Agent Changes (~1 hour)**:
1. Add `CollectContainerMetrics(containerID)` function using `ContainerStats()` API
2. Add `GetContainerUptime(containerID)` function using `ContainerInspect().State.StartedAt`
3. Add message handler for `container.metrics` requests
4. Return per-container stats on demand

**Manager Changes (~30 min)**:
1. Add endpoint `GET /api/agents/:id/servers/:serverId/metrics`
2. Forward metrics request to agent via WebSocket
3. Return container stats + uptime

**Frontend Changes (~30 min)**:
1. Add API function `fetchServerMetrics(agentId, serverId)`
2. Update ServerDetail.tsx to fetch and display metrics
3. Add polling (every 5s like other data)

**Total estimate: 2 hours (much more achievable than 4-6 hours!)**

**What we get:**
- ✅ Real uptime (from StartedAt)
- ✅ Per-container CPU usage
- ✅ Per-container memory usage
- ✅ Per-container disk I/O
- ⏸️ Player count (separate RCON task)

**What we DON'T need:**
- ❌ Storage/persistence (metrics are ephemeral, fetched on-demand)
- ❌ Complex state management
- ❌ New database columns
