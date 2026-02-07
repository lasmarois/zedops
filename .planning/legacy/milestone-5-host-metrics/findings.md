# Findings: Milestone 5 - Host Metrics Display

**Milestone:** M5 - Host Metrics Display
**Date:** 2026-01-11
**Status:** Research Complete

---

## Executive Summary

Explored ZedOps agent-manager communication architecture to determine how to add host metrics reporting. Found that:
- Agent sends heartbeat every 30 seconds with minimal payload
- Manager stores agent data in D1 database with unused metadata JSON field
- Frontend polls agent data every 5 seconds
- No metrics collection currently exists
- Architecture is ready for metrics extension without major refactoring

**Recommendation:** Piggyback metrics on existing heartbeat, store in metadata field, display inline in AgentList.

---

## 1. Agent Heartbeat Mechanism

**Location:** `agent/reconnect.go` (lines 134-154)

**Implementation:**
```go
func (a *Agent) sendHeartbeats(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            msg := NewMessage("agent.heartbeat", map[string]string{
                "agentId": a.agentID,
            })
            if err := a.sendMessage(msg); err != nil {
                log.Printf("Failed to send heartbeat: %v", err)
                return
            }
        case <-ctx.Done():
            return
        }
    }
}
```

**Key Findings:**
- **Interval:** 30 seconds (line 135)
- **Spawned:** In `RunWithReconnect()` at line 102 as goroutine
- **Payload:** Currently minimal (just agentId)
- **Error handling:** Logs error and returns (stops heartbeats on failure)
- **Message format:** NATS-inspired with subject + data

**Implication:** Can extend payload to include metrics without changing interval or structure.

---

## 2. Manager Heartbeat Handler

**Location:** `manager/src/durable-objects/AgentConnection.ts` (lines 458-480)

**Implementation:**
```typescript
private async handleAgentHeartbeat(message: Message): Promise<void> {
  if (!this.isRegistered || !this.agentId) {
    this.sendError("Agent must be registered to send heartbeat");
    return;
  }

  // Update last_seen in D1
  const now = Math.floor(Date.now() / 1000);
  try {
    await this.env.DB.prepare(
      `UPDATE agents SET last_seen = ? WHERE id = ?`
    )
      .bind(now, this.agentId)
      .run();
  } catch (error) {
    console.error("[AgentConnection] Failed to update last_seen:", error);
  }

  // Acknowledge heartbeat
  this.send(createMessage("agent.heartbeat.ack", {
    timestamp: Date.now(),
  }));
}
```

**Key Findings:**
- **Action:** Updates `last_seen` timestamp in D1
- **No current storage:** Doesn't store any metrics or extra data
- **Acknowledgment:** Sends "agent.heartbeat.ack" back to agent
- **Error handling:** Logs error but continues (doesn't crash on DB failure)

**Implication:** Can extend to store metrics in metadata field with minimal changes.

---

## 3. Agents Table Schema

**Location:** `manager/schema.sql` (lines 4-13)

**Current Schema:**
```sql
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT DEFAULT 'offline',
  last_seen INTEGER,
  created_at INTEGER NOT NULL,
  metadata TEXT
);
```

**Extended by Migrations:**
- `steam_zomboid_registry TEXT` (migration 0002)
- `server_data_path TEXT` (migration 0004)

**Metadata Field Analysis:**
- **Type:** TEXT (stores JSON as string)
- **Current usage:** Empty/unused in practice
- **Queried:** Yes, in GET /api/agents endpoint (routes/agents.ts:50)
- **Parsed:** Yes, as JSON in frontend (api.ts:17)

**Example Existing Query:**
```typescript
// routes/agents.ts, line 46-50
const metadataJson = agent.metadata || '{}';
const metadata = JSON.parse(metadataJson) as Record<string, unknown>;
```

**Implication:** Perfect place to store metrics without migration. Field is already parsed as JSON.

---

## 4. Message Protocol

**Location:** `manager/src/types/Message.ts` (lines 11-23)

**Message Interface:**
```typescript
interface Message {
  subject: string;           // Routing key
  reply?: string;           // Optional reply inbox
  data: any;                // Payload (any type)
  timestamp?: number;       // Unix milliseconds
}
```

**Subject Routing (AgentConnection.ts, lines 223-260):**
- `agent.register` - Registration with ephemeral token
- `agent.auth` - Authentication with permanent token
- `agent.heartbeat` - Periodic heartbeat
- `container.*` - Container operations
- `server.*` - Server lifecycle
- `log.*` - Log streaming
- `port.check` - Port availability
- Inbox replies: `_INBOX.<uuid>` for request/reply

**Key Finding:** Protocol is flexible - `data` field is `any` type, can be object or string.

**Example Extended Heartbeat:**
```json
{
  "subject": "agent.heartbeat",
  "data": {
    "agentId": "uuid",
    "metrics": {
      "cpuPercent": 45.2,
      "memoryUsedMB": 8192
    }
  }
}
```

**Implication:** Can add metrics object to data without breaking existing code.

---

## 5. AgentConnection Durable Object State

**Location:** `manager/src/durable-objects/AgentConnection.ts`

**Instance State (In-Memory):**
- `ws: WebSocket | null` - Active connection
- `agentId: string | null` - Agent UUID
- `agentName: string | null` - Agent name
- `isRegistered: boolean` - Registration flag
- `pendingReplies: Map<string, handler>` - Request/reply handlers
- `logSubscribers: Map<string, LogSubscriber>` - UI log subscriptions
- `logBuffers: Map<string, CircularBuffer<LogLine>>` - Cached logs (1000 lines)

**Persistent Storage (Hibernation Recovery):**
```typescript
// Stored at lines 344-345
await this.ctx.storage.put('agentId', agentId);
await this.ctx.storage.put('agentName', agentName);

// Restored at lines 505-517 if needed
this.agentId = await this.ctx.storage.get<string>('agentId');
this.agentName = await this.ctx.storage.get<string>('agentName');
```

**Database Updates (D1):**
- Agent registered: INSERT (line 331-336)
- Auth successful: UPDATE status + last_seen (line 431-435)
- Heartbeat received: UPDATE last_seen (line 467-471)
- Disconnect: UPDATE status = 'offline' (line 591-595)

**Key Finding:** Durable Objects are ephemeral (can hibernate). Metrics should be stored in D1, not just in-memory.

**Implication:** Must store metrics in D1 agents table, not just Durable Object state.

---

## 6. Frontend Data Fetching

**Location:** `frontend/src/hooks/useAgents.ts`

**Hook Implementation:**
```typescript
export function useAgents() {
  const password = useAuthStore((state) => state.password);
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => fetchAgents(password!),
    enabled: !!password,
    refetchInterval: 5000,  // Polls every 5 seconds
  });
}
```

**API Endpoint:** `manager/src/routes/agents.ts`
- **GET /api/agents** (lines 25-61) - Returns all agents with status
- **GET /api/agents/:id** (lines 69-109) - Returns single agent details

**Response Format (api.ts, lines 10-17):**
```typescript
interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: number;
  createdAt: number;
  metadata: Record<string, unknown>;  // Currently empty
}
```

**Key Findings:**
- Frontend polls every 5 seconds
- Agent heartbeat is every 30 seconds
- **Mismatch:** Frontend polls 6x more frequently than agent updates
- Metadata field is fetched but currently empty

**Implication:** Metrics will appear in UI within 5-35 seconds (5s poll + up to 30s heartbeat delay).

---

## 7. Existing Agent Metadata Usage

**Current State:**
- **Agents table metadata column:** Exists but unused
- **API response:** Includes metadata field (empty object)
- **Frontend type:** `metadata: Record<string, unknown>`

**Code Examples:**

**Manager routes (agents.ts, line 46-50):**
```typescript
const metadataJson = agent.metadata || '{}';
const metadata = JSON.parse(metadataJson) as Record<string, unknown>;

return {
  ...agent,
  metadata,
  lastSeen: agent.last_seen,
  createdAt: agent.created_at,
};
```

**Frontend type (api.ts, line 16):**
```typescript
metadata: Record<string, unknown>;
```

**Key Finding:** Infrastructure for metadata already exists end-to-end, just unused.

---

## 8. Linux /proc Filesystem Research

**Available Metrics:**

1. **CPU Usage:**
   - **File:** `/proc/stat`
   - **Format:**
     ```
     cpu  user nice system idle iowait irq softirq steal guest guest_nice
     ```
   - **Method:** Calculate percentage from delta between two samples
   - **Example:** `(total_delta - idle_delta) / total_delta * 100`

2. **Memory Usage:**
   - **File:** `/proc/meminfo`
   - **Format:**
     ```
     MemTotal:       16384000 kB
     MemFree:         2048000 kB
     MemAvailable:    8192000 kB
     ```
   - **Method:** `MemUsed = MemTotal - MemAvailable`
   - **Note:** Use MemAvailable (not MemFree) for accurate available memory

3. **Disk Usage:**
   - **Method:** `syscall.Statfs(path string, stat *Statfs_t)`
   - **Path:** `/var/lib/zedops` (or fallback to `/` if not exists)
   - **Calculation:** `used = total - available`

**Go Standard Library Support:**
- `bufio.Scanner` - For parsing /proc files
- `strconv.ParseInt/ParseUint` - For converting string numbers
- `syscall.Statfs` - For disk usage

**No External Dependencies Needed:** All metrics can be collected using Go stdlib.

---

## 9. Alternative Approaches Considered

### Option A: Separate Metrics Message (Rejected)
**Approach:** Create new "agent.metrics" message type with 10-second interval

**Pros:**
- More frequent updates
- Separates concerns (heartbeat vs metrics)

**Cons:**
- Adds another goroutine
- More WebSocket messages (higher overhead)
- More complex (two message types to maintain)

**Rejected because:** 30-second intervals are sufficient for host metrics, and reusing heartbeat is simpler.

---

### Option B: Store in New agent_metrics Table (Rejected for MVP)
**Approach:** Create time-series table for historical metrics

**Schema:**
```sql
CREATE TABLE agent_metrics (
  agent_id TEXT,
  timestamp INTEGER,
  cpu_percent FLOAT,
  memory_mb INTEGER,
  disk_gb INTEGER,
  PRIMARY KEY (agent_id, timestamp)
);
```

**Pros:**
- Historical tracking
- Can query trends over time
- Can create graphs/charts

**Cons:**
- Requires database migration
- More complex queries
- More storage usage
- Overkill for MVP

**Rejected for MVP because:** Historical data not needed yet. Can add in Milestone 6+ if user wants trending.

---

### Option C: Use gopsutil Library (Rejected)
**Approach:** Use github.com/shirou/gopsutil for metrics collection

**Pros:**
- Cross-platform (Windows, macOS, Linux)
- Well-tested library
- Handles edge cases

**Cons:**
- External dependency
- Larger binary size (~2-3 MB increase)
- More dependencies to maintain

**Rejected because:** /proc parsing is straightforward for Linux, and we want minimal dependencies.

---

### Option D: Store in Durable Object Only (Rejected)
**Approach:** Store metrics only in Durable Object in-memory state

**Pros:**
- Fastest access (no DB query)
- Simplest implementation

**Cons:**
- Lost on hibernation (Durable Objects can hibernate)
- Not persisted across restarts
- Frontend can't access if DO hibernated

**Rejected because:** Metrics must survive hibernation and be accessible even if DO is hibernated.

---

## 10. Performance Considerations

**Agent Performance:**
- **Metrics collection:** <5ms (parsing /proc files is fast)
- **Heartbeat send:** Already happening every 30s (no additional overhead)
- **Binary size increase:** ~10-20 KB (new metrics.go file)

**Manager Performance:**
- **DB update:** Already updating last_seen, adding metadata is same query cost
- **JSON parsing:** Minimal (<1ms to stringify metrics object)
- **Storage:** ~100 bytes per agent for metrics JSON

**Frontend Performance:**
- **Polling:** Already happening every 5s (no change)
- **Rendering:** 3 badges per agent (~10 agents = 30 badges, negligible)
- **Bundle size:** ~2 KB for MetricBadge component

**Conclusion:** Performance impact is negligible across all components.

---

## 11. Backward Compatibility Analysis

**Old Agents (Without Metrics):**
- Send heartbeat with `data: { agentId: "..." }`
- Manager checks `message.data.metrics || null`
- If null, skips metadata update (or stores empty metrics)
- Frontend checks `agent.metadata?.metrics`
- If undefined, shows "Collecting..." or "N/A"

**Old Manager (Before This Update):**
- Would ignore metrics field in heartbeat data
- Would still update last_seen correctly
- No breaking changes

**Conclusion:** Fully backward compatible in both directions.

---

## 12. Edge Cases & Error Handling

| Scenario | Behavior | Handling |
|----------|----------|----------|
| /proc files not readable | Log warning, send heartbeat without metrics | Graceful degradation |
| /proc parse error | Log error, send heartbeat without metrics | Continue with partial data |
| /var/lib/zedops doesn't exist | Fallback to / for disk metrics | Use root filesystem |
| Metrics collection timeout | Implement 5-second timeout in Go | Cancel collection, send heartbeat |
| Manager DB write fails | Log error, continue (metrics lost this cycle) | Retry on next heartbeat |
| Frontend receives null metrics | Show "Collecting..." or "N/A" | UI handles missing data |
| Agent restart | Resume metrics on next heartbeat (30s) | No state persistence needed |
| Manager hibernation | Metrics stored in D1, not lost | Query D1 on wake |

---

## 13. Security Considerations

**Metrics Data Sensitivity:**
- CPU/memory/disk usage is low sensitivity (not PII)
- No credentials or secrets in metrics
- No user data or file paths exposed

**Authorization:**
- Metrics only visible to authenticated users (JWT required)
- GET /api/agents requires valid password (existing auth)
- No new endpoints, no new auth concerns

**Input Validation:**
- Agent sends metrics (trusted source)
- Manager validates metrics exist before storing
- Frontend displays metrics (read-only, no user input)

**Conclusion:** No new security concerns introduced.

---

## 14. Testing Strategy

**Unit Tests:**
- `agent/metrics.go` - Test /proc parsing with mock data
- `manager/AgentConnection.ts` - Test heartbeat with/without metrics
- `frontend/MetricBadge` - Test color thresholds

**Integration Tests:**
- End-to-end: Agent → Manager → Frontend
- Backward compatibility: Old agent with new manager
- Error handling: Missing /proc files, DB failures

**Manual Testing:**
- Visual verification of badges in AgentList
- Color thresholds (simulate high CPU/memory/disk)
- Offline agents show "Offline"
- Reconnection restores metrics

---

## 15. Implementation Timeline

**Estimated Breakdown:**
- **Phase 1 (Agent):** 2-3 hours
  - Create metrics.go: 1.5 hours
  - Modify reconnect.go: 0.5 hours
  - Test locally: 0.5 hours
- **Phase 2 (Manager):** 1 hour
  - Modify AgentConnection.ts: 0.5 hours
  - Test with wrangler dev: 0.5 hours
- **Phase 3 (Frontend):** 1-2 hours
  - Update types: 0.25 hours
  - Create MetricBadge: 0.5 hours
  - Integrate in AgentList: 0.5 hours
  - Test UI: 0.5 hours
- **Phase 4 (Testing):** 0.5 hours
  - End-to-end verification
  - Edge case testing

**Total:** 4.5-6.5 hours (aligns with milestone estimate of 4-6 hours)

---

## Key Takeaways

1. **Heartbeat mechanism exists** - Can piggyback metrics on it
2. **Metadata field unused** - Perfect for metrics storage
3. **No migration needed** - Use existing infrastructure
4. **Backward compatible** - Works with old agents/managers
5. **Simple implementation** - /proc parsing, no external libs
6. **Inline UI display** - Fits existing AgentList pattern
7. **Graceful degradation** - Errors don't break heartbeat
8. **Performance impact minimal** - <100ms per heartbeat cycle

**Ready to implement Phase 1.**
