# Task Plan: M9.8.21 - Server Metrics Empty/Not Displaying

**Goal:** Fix empty server metrics display

**Priority:** MEDIUM (Bug Fix)
**Started:** 2026-01-13

---

## Phases

### Phase 1: Locate Metrics Display & Understand Problem ✅ complete
- ✅ Find where server metrics are displayed (which pages/components?)
  - **Answer**: ServerDetail.tsx lines 117-122 (placeholders), 200-268 (display)
- ✅ Identify what metrics should be shown (CPU, RAM, players, etc.)
  - **Answer**: 5 metrics - Uptime, CPU %, Memory GB, Disk GB, Player Count
- ✅ Check if metrics data exists in API responses
  - **Answer**: HOST metrics exist in agent.metadata.metrics, NO per-server metrics
- ✅ Verify metrics are being collected by agent
  - **Answer**: HOST metrics collected every 30s, NO per-container metrics
- ✅ Document current state
  - **Answer**: Complete data flow documented in findings_m921.md

**Questions answered:**
- ✅ Where are server metrics displayed? **ServerDetail.tsx**
- ✅ What specific metrics are empty? **All 5: uptime, CPU, memory, disk, players**
- ✅ Are metrics collected but not displayed, or not collected at all? **HOST metrics collected, per-container NOT collected**

### Phase 2: Implementation Planning ✅ complete

**USER FEEDBACK**: "we have at least the uptime from the agent right now and the agent could send the docker stats"

**REVISED DISCOVERY**:
- ✅ Uptime IS available via `ContainerInspect().State.StartedAt`
- ✅ Docker Stats API CAN provide per-container metrics
- ✅ Agent already has Docker client initialized
- ✅ No database changes needed (on-demand fetching)

**CHOSEN APPROACH**: Implement Per-Container Metrics (Revised - ~2 hours)

**Implementation breakdown:**
1. **Agent** (~1h): Add ContainerStats + ContainerUptime functions, add message handler
2. **Manager** (~30min): Add metrics endpoint, forward to agent
3. **Frontend** (~30min): Fetch and display real metrics

### Phase 3: Agent - Container Metrics Collection 📋 pending

**Goal**: Add Docker container metrics collection to agent

**Tasks**:
1. Add `CollectContainerMetrics(containerID)` function in `agent/docker.go`
   - Use `docker.ContainerStats(ctx, containerID, false)` for one-time snapshot
   - Parse CPU percentage, memory usage, disk I/O
   - Return structured metrics data

2. Add `GetContainerUptime(containerID)` function in `agent/docker.go`
   - Use existing `ContainerInspect()` call
   - Extract `inspect.State.StartedAt`
   - Calculate uptime duration

3. Add message handler in `agent/main.go`
   - Handle `container.metrics` subject
   - Accept `{ containerId }` in payload
   - Return `{ metrics, uptime }` in response

**Data structure**:
```go
type ContainerMetrics struct {
    ContainerID  string  `json:"containerId"`
    CPUPercent   float64 `json:"cpuPercent"`
    MemoryUsedMB int64   `json:"memoryUsedMB"`
    MemoryLimitMB int64  `json:"memoryLimitMB"`
    DiskReadMB   int64   `json:"diskReadMB"`
    DiskWriteMB  int64   `json:"diskWriteMB"`
    Uptime       string  `json:"uptime"` // "2h 34m"
    UptimeSeconds int64  `json:"uptimeSeconds"`
}
```

### Phase 4: Manager - Metrics API Endpoint ✅ complete

**Goal**: Add endpoint to fetch server metrics from agent

**Tasks completed**:
1. ✅ Added `GET /api/agents/:id/servers/:serverId/metrics` in `manager/src/routes/agents.ts`
2. ✅ Look up server's container_id from database
3. ✅ Forward `container.metrics` message to agent via WebSocket
4. ✅ Return metrics to frontend
5. ✅ Added handleContainerMetricsRequest in AgentConnection.ts

### Phase 5: Frontend - Display Real Metrics ✅ complete

**Goal**: Replace placeholder metrics with real data

**Tasks completed**:
1. ✅ Added `fetchServerMetrics(agentId, serverId)` in `frontend/src/lib/api.ts`
2. ✅ Added `useServerMetrics(agentId, serverId)` hook in `frontend/src/hooks/useServers.ts`
3. ✅ Updated ServerDetail.tsx to fetch metrics (refetchInterval: 5000)
4. ✅ Replaced hardcoded placeholders with real data
5. ✅ Fixed TypeScript errors

### Phase 6: Test & Deploy ✅ complete

**Build & deployment**:
1. ✅ Built agent binary successfully
2. ✅ Built frontend (new assets generated)
3. ✅ Updated manager HTML with new asset filenames
4. ✅ Deployed manager to Cloudflare Workers
5. ✅ Restarted agent on maestroserver

**Bug discovered & fixed**:
6. ✅ Fixed React hooks violation in ServerDetail.tsx
   - Issue: useServerMetrics called after conditional returns
   - Fix: Moved hook to top of component with optional chaining
   - Rebuild & redeploy completed
7. ✅ Final deployment version: f3a5926f-5580-4cdd-a4ad-d7527631d886

---

## Status Legend
- ⏳ in_progress
- ✅ complete
- 📋 pending
- ❌ blocked

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| Go: undefined types.StatsJSON | 1 | Created custom StatsData struct with JSON tags |
| Go: sendErrorWithReply undefined | 1 | Used sendContainerErrorWithReply instead |
| TypeScript: Unused variables | 1 | Removed unused destructured variables from useServerMetrics |
| React: ServerDetail page not loading | 1 | Moved useServerMetrics hook to top of component (hooks rule violation) |
