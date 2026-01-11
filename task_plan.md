# Task Plan: Milestone 5 - Host Metrics Display

**Goal:** Display agent host resource usage (CPU, memory, disk) in UI

**Duration:** 4-6 hours (1 session)

**Success Criteria:**
- Agent reports CPU percentage, memory usage, disk space
- Manager receives and stores latest metrics in D1 metadata field
- UI shows metrics prominently in AgentList with visual indicators
- Metrics update within 30-40 seconds (heartbeat + polling)
- Visual indicators show resource health (green/yellow/red)

**Status:** ⏳ Not Started
**Started:** 2026-01-11
**Completed:** _(pending)_

---

## Phase Overview

| Phase | Status | Description |
|-------|--------|-------------|
| 0. Research & Design | ✅ complete | Explore agent communication, design architecture |
| 1. Agent Metrics Collection | ⏳ pending | Collect CPU/memory/disk in Go agent |
| 2. Manager Metrics Storage | ⏳ pending | Store metrics in D1 metadata field |
| 3. Frontend Metrics Display | ⏳ pending | Display metrics with badges in AgentList |
| 4. Testing & Verification | ⏳ pending | End-to-end testing |

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Collection frequency | Every heartbeat (30s) | Reuse existing heartbeat, no new goroutine needed |
| Storage strategy | D1 agents.metadata JSON | No migration required, field already exists |
| Collection method | /proc filesystem parsing | No external dependencies, smaller binary |
| UI location | Inline in AgentList table | Immediate visibility, no extra navigation |
| Visual indicators | Color-coded badges | Consistent with existing UI patterns |

**Thresholds:**
- Green: <70% utilization
- Yellow: 70-85% utilization (warning)
- Red: >85% utilization (critical)

---

## Phase 0: Research & Design ✅ Complete

**Status:** ✅ complete

**Goals:**
- Understand agent-manager communication patterns
- Identify where to add metrics collection
- Design storage and display strategy

**Tasks:**
- [x] Explore agent heartbeat mechanism (agent/reconnect.go)
- [x] Explore manager heartbeat handler (manager/AgentConnection.ts)
- [x] Review agents table schema and metadata field
- [x] Review frontend data fetching (useAgents hook)
- [x] Design metrics collection approach
- [x] Design storage strategy (metadata vs new table)
- [x] Design UI display approach

**Key Findings:**
- Agent sends heartbeat every 30 seconds (agent/reconnect.go:134-154)
- Heartbeat handler exists (manager/AgentConnection.ts:458-480)
- Agents table has metadata JSON field (currently empty/unused)
- Frontend polls agents every 5 seconds via useAgents hook
- No metrics collection currently exists

**Outcome:** Architecture designed, ready for implementation

---

## Phase 1: Agent Metrics Collection ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- Collect host metrics (CPU, memory, disk) in Go agent
- Send metrics with heartbeat every 30 seconds
- Handle collection errors gracefully

**Tasks:**
- [ ] Create new file: `agent/metrics.go`
  - [ ] Implement `CollectHostMetrics()` function
  - [ ] Parse /proc/stat for CPU usage percentage
  - [ ] Parse /proc/meminfo for memory (used/total)
  - [ ] Use syscall.Statfs() for disk usage at /var/lib/zedops
  - [ ] Return structured HostMetrics object
- [ ] Modify `agent/reconnect.go` (sendHeartbeats function)
  - [ ] Call CollectHostMetrics() before creating heartbeat message (line ~142)
  - [ ] Add metrics to heartbeat payload
  - [ ] Handle errors gracefully (log warning, send heartbeat without metrics)
- [ ] Compile and test agent binary
  - [ ] Verify metrics collection works on Linux
  - [ ] Verify /proc parsing is correct
  - [ ] Test error handling (missing files, parse errors)

**Message Format (Extended Heartbeat):**
```json
{
  "subject": "agent.heartbeat",
  "data": {
    "agentId": "uuid",
    "metrics": {
      "cpuPercent": 45.2,
      "memoryUsedMB": 8192,
      "memoryTotalMB": 16384,
      "diskUsedGB": 120,
      "diskTotalGB": 500,
      "diskPercent": 24.0,
      "timestamp": 1673024400
    }
  }
}
```

**Files to Create/Modify:**
- `agent/metrics.go` (NEW) - Metrics collection logic
- `agent/reconnect.go` (lines 134-154) - Add metrics to heartbeat

**Verification:**
- Agent logs show metrics collection successful
- Heartbeat messages include metrics payload
- Errors logged but heartbeat still sent if collection fails

---

## Phase 2: Manager Metrics Storage ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- Receive metrics from agent heartbeat
- Store metrics in D1 agents.metadata field
- Maintain backward compatibility with old agents

**Tasks:**
- [ ] Modify `manager/src/durable-objects/AgentConnection.ts`
  - [ ] Update `handleAgentHeartbeat()` function (lines 458-480)
  - [ ] Extract metrics from message.data.metrics (if present)
  - [ ] Update D1: SET metadata = JSON with metrics
  - [ ] Handle missing metrics gracefully (backward compatibility)
- [ ] Test with wrangler dev
  - [ ] Verify metrics stored in D1 metadata field
  - [ ] Verify old agents without metrics still work
  - [ ] Check metadata JSON structure

**Storage Format (D1 agents.metadata):**
```json
{
  "metrics": {
    "cpuPercent": 45.2,
    "memoryUsedMB": 8192,
    "memoryTotalMB": 16384,
    "diskUsedGB": 120,
    "diskTotalGB": 500,
    "diskPercent": 24.0,
    "lastUpdate": 1673024400
  }
}
```

**Files to Modify:**
- `manager/src/durable-objects/AgentConnection.ts` (lines 458-480)

**Verification:**
- Query D1: `SELECT metadata FROM agents WHERE id = ?`
- Verify JSON structure matches expected format
- Verify lastUpdate timestamp is recent

---

## Phase 3: Frontend Metrics Display ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- Display metrics in AgentList with visual indicators
- Color-code based on thresholds
- Handle missing metrics gracefully

**Tasks:**
- [ ] Modify `frontend/src/lib/api.ts`
  - [ ] Update Agent interface (lines 10-17)
  - [ ] Add HostMetrics type definition
  - [ ] Add metrics field to Agent interface
- [ ] Modify `frontend/src/components/AgentList.tsx`
  - [ ] Add table header "Resources" (line ~88)
  - [ ] Create MetricBadge component (helper function)
  - [ ] Create getMetricColor() function (threshold logic)
  - [ ] Add metrics cell in table row (after Status column)
  - [ ] Display CPU, Memory, Disk as compact badges
  - [ ] Show "N/A" for offline agents or missing metrics
- [ ] Build and test frontend
  - [ ] Verify metrics display correctly
  - [ ] Verify color thresholds work (green/yellow/red)
  - [ ] Test with missing metrics (shows "N/A")
  - [ ] Test responsive layout

**UI Component Structure:**
```tsx
<td style={{ padding: '1rem' }}>
  {agent.status === 'online' && agent.metadata?.metrics ? (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <MetricBadge label="CPU" value={metrics.cpuPercent} />
      <MetricBadge label="MEM" value={memPercent} />
      <MetricBadge label="DSK" value={metrics.diskPercent} />
    </div>
  ) : (
    <span>Offline / Collecting...</span>
  )}
</td>
```

**Files to Modify:**
- `frontend/src/lib/api.ts` (lines 10-17) - Type definitions
- `frontend/src/components/AgentList.tsx` (lines 88-152) - UI display

**Verification:**
- Agent metrics visible in AgentList table
- Colors match thresholds (green <70%, yellow 70-85%, red >85%)
- Offline agents show "Offline"
- Agents without metrics show "Collecting..."

---

## Phase 4: Testing & Verification ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- End-to-end testing of metrics flow
- Edge case testing
- Performance verification

**Test Scenarios:**

1. **Happy Path**
   - Start agent with metrics collection
   - Wait 30 seconds for first heartbeat
   - Verify metrics appear in D1 metadata
   - Refresh frontend, verify metrics display
   - Verify colors match thresholds

2. **Backward Compatibility**
   - Old agent without metrics sends heartbeat
   - Manager accepts heartbeat without metrics
   - Frontend shows "Collecting..." for agent without metrics

3. **Collection Failure**
   - Agent fails to collect metrics (e.g., /proc not readable)
   - Agent logs warning
   - Agent sends heartbeat without metrics
   - Manager stores agent without metrics
   - Frontend shows "Collecting..."

4. **Reconnection**
   - Agent disconnects
   - Agent reconnects
   - Metrics resume within 30 seconds

5. **Manager Hibernation**
   - Manager Durable Object hibernates
   - Agent reconnects after wake
   - Metrics persist in D1 (not lost)
   - Frontend displays persisted metrics

6. **High Resource Usage**
   - Simulate high CPU/memory/disk usage
   - Verify metrics reflect high values
   - Verify badges show red color (>85%)

**Verification Checklist:**
- [ ] Metrics collected every 30 seconds
- [ ] Metrics stored in D1 metadata field
- [ ] Metrics displayed in AgentList with correct colors
- [ ] Offline agents show "Offline"
- [ ] Collection errors logged but don't break heartbeat
- [ ] Old agents without metrics still work
- [ ] Manager hibernation doesn't lose metrics
- [ ] High resource usage shows red badges

---

## Dependencies

**External:**
- Linux /proc filesystem (for CPU/memory collection)
- syscall package (for disk usage)

**Internal:**
- ✅ Milestone 4 complete (agents, containers, servers working)
- ✅ Agent heartbeat mechanism (agent/reconnect.go)
- ✅ Manager heartbeat handler (manager/AgentConnection.ts)
- ✅ D1 agents table with metadata field
- ✅ Frontend useAgents hook with 5s polling

---

## Errors Encountered

| Error | Phase | Attempt | Resolution |
|-------|-------|---------|------------|
| _(none yet)_ | - | - | - |

---

## Design Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Use heartbeat for metrics | Reuse existing 30s heartbeat, no new goroutine needed | 2026-01-11 |
| Store in metadata field | No migration required, field already exists and is unused | 2026-01-11 |
| Parse /proc filesystem | No external dependencies, keeps binary small | 2026-01-11 |
| Display inline in AgentList | Immediate visibility, consistent with existing patterns | 2026-01-11 |
| Use color-coded badges | Consistent with existing status badges, clear visual feedback | 2026-01-11 |
| 30-second refresh rate | Sufficient for host monitoring, matches heartbeat interval | 2026-01-11 |

---

## Notes

- **No database migration required:** metadata field already exists in agents table
- **Backward compatible:** Old agents without metrics will continue to work
- **Ephemeral metrics:** No historical data stored (can add time-series in Milestone 6+)
- **Linux only:** Metrics collection uses /proc filesystem (works on Linux hosts)
- **Graceful degradation:** If collection fails, heartbeat still sent without metrics
- **Frontend polling:** 5-second polling means metrics display updates within 5-35 seconds

---

## Future Enhancements (Deferred)

- [ ] Historical metrics tracking (time-series table)
- [ ] Metrics graphs/charts (line graphs, sparklines)
- [ ] Per-container resource metrics (CPU/memory per container)
- [ ] Network metrics (bandwidth usage)
- [ ] Custom thresholds (user-configurable warning/critical levels)
- [ ] Alerting (email/webhook on threshold breach)
- [ ] Windows/macOS support (different metrics collection methods)
