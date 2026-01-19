# Task: P1 - Metrics Sparklines (M9.8.47)

## Goal
Add 3-day historical metrics storage in D1 and display sparklines in server overview cards for CPU, Memory, and Player count.

## Current State
- Agent collects host metrics every 30s via heartbeat
- Container metrics collected on-demand via Docker stats API
- **No historical storage** - only latest metrics in `agents.metadata`
- Frontend has placeholder sparklines (static bars, 30% opacity)
- Polling: 5s frontend, 30s agent heartbeat

## Target State
- D1 table stores metrics history (3-day retention)
- Agent sends per-server metrics at regular intervals
- Manager stores metrics and auto-cleans old data
- Frontend displays real sparklines with trend data
- Expandable views: 30min (card), 24h, 3d

## Architecture

```
AGENT (10s interval)
  └─ Collect container metrics for all running servers
  └─ Send "server.metrics.batch" message

MANAGER (Durable Object)
  └─ Receive batch metrics
  └─ Store in D1 server_metrics_history table
  └─ Periodic cleanup of data > 3 days old

D1 DATABASE
  └─ server_metrics_history table
  └─ Indexed by (server_id, timestamp)

FRONTEND
  └─ Fetch history on page load
  └─ Real sparkline component
  └─ 10s refresh interval
```

## Phases

### Phase 1: Database Schema
**Status:** `complete`
- [x] Create migration `0014_server_metrics_history.sql`
- [x] Table: server_id, timestamp, cpu_percent, memory_percent, player_count
- [x] Index on (server_id, timestamp DESC)
- [x] Apply migration to remote D1

### Phase 2: Agent Metrics Collection
**Status:** `complete`
- [x] Create `metricscollector.go` for batch server metrics
- [x] Collect from all running containers every 10s
- [x] Send `server.metrics.batch` message to manager
- [x] Include CPU%, Memory%, player count per server

### Phase 3: Manager Metrics Storage
**Status:** `complete`
- [x] Handle `server.metrics.batch` in AgentConnection.ts
- [x] Store metrics in D1 server_metrics_history table
- [x] Implement cleanup: delete records older than 3 days
- [x] Add API endpoint: `GET /api/servers/:id/metrics/history?range=30m|24h|3d`

### Phase 4: Frontend Sparkline Component
**Status:** `complete`
- [x] Create `Sparkline.tsx` component
- [x] Accept data points array, color, height
- [x] SVG-based line or bar chart
- [x] Responsive sizing

### Phase 5: Integrate Sparklines into MetricsRow
**Status:** `complete`
- [x] Add `useServerMetricsHistory` hook
- [x] Fetch 30min history on mount
- [x] Replace SparklinePlaceholder with real Sparkline
- [x] Update CPU, Memory, Players cards

### Phase 6: Build, Deploy & Test
**Status:** `complete`
- [x] Build frontend
- [x] Build agent
- [x] Deploy to Cloudflare
- [x] Deploy agent binary
- [x] Verify sparklines display correctly (metrics being stored, 7 rows per server)

## Files to Create/Modify

### New Files
- `manager/migrations/0014_server_metrics_history.sql`
- `agent/metricscollector.go`
- `frontend/src/components/ui/sparkline.tsx`
- `frontend/src/hooks/useServerMetricsHistory.ts`

### Modified Files
- `agent/main.go` - Start metrics collector goroutine
- `manager/src/durable-objects/AgentConnection.ts` - Handle batch metrics
- `manager/src/routes/servers.ts` - Add history endpoint
- `frontend/src/components/server-overview/MetricsRow.tsx` - Use real sparklines
- `frontend/src/lib/api.ts` - Add history fetch function

## Data Retention Calculation

**10-second intervals for 3 days:**
- 6 records/min × 60 min × 24 hr × 3 days = 25,920 records per server
- With ~10 servers: ~260,000 records max
- Each record: ~100 bytes → ~26 MB total
- D1 free tier: 5 GB → Plenty of headroom

**Cleanup strategy:**
- Run cleanup on each metrics batch insert
- Delete WHERE timestamp < (now - 3 days)
- Could also use scheduled cleanup via Cron Trigger if needed

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
