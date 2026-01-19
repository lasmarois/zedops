# Findings: P2 - Performance Tab

## Design Decisions (from brainstorming)

### 1. Consolidated Metrics Card Layout
**Decision:** Horizontal 3-column layout within single card

```
┌─────────────────────────────────────────────────────────────┐
│  Server Metrics                                             │
├───────────────────┬───────────────────┬─────────────────────┤
│  CPU              │  Memory           │  Disk I/O           │
│  45.2%            │  2.7 / 8.0 GB     │  ↓1.2  ↑0.8 GB      │
│  ▁▂▃▅▆▇█▇▆▅▃▂    │  ▁▁▂▂▃▄▅▅▆▆▇▇    │  Cumulative         │
├─────────────────────────────────────────────────────────────┤
│              View Performance Details →                     │
└─────────────────────────────────────────────────────────────┘
```

**Rationale:** Clean visual grouping, reduces card count from 5 to 3

### 2. Time Range Navigation
**Decision:** Preset buttons only (30m, 3h, 12h, 24h, 3d)

**Rationale:**
- Covers 90% of use cases
- Simple to implement
- Avoids complex chart interaction libraries
- Can add drag-to-zoom in V2 if needed

### 3. Charting Library
**Decision:** Recharts

**Rationale:**
- Popular React library, good docs
- ~45KB gzipped (acceptable)
- Built-in hover tooltips (essential for "what was CPU at 3pm?")
- Handles responsive sizing well

**Alternatives considered:**
- Custom SVG (more work, zero deps)
- uPlot (faster but less React-idiomatic)

### 4. Downsampling Strategy
| Range | Sample Rate | Points |
|-------|-------------|--------|
| 30m | raw (10s) | ~180 |
| 3h | raw (10s) | ~1,080 |
| 12h | 1-min avg | ~720 |
| 24h | 5-min avg | ~288 |
| 3d | 15-min avg | ~288 |

**Rationale:** Keep point count reasonable for chart rendering

### 5. 3-Day Limit Messaging
**Decision:** Info badge in time selector: "ℹ️ Data retained: 3 days"

**Rationale:**
- Clear but not intrusive
- 3d button being rightmost naturally communicates max
- No confusing 7d/30d buttons

## Existing Code References

### Current Metrics API
`manager/src/routes/servers.ts:291-403`
- GET /api/servers/:serverId/metrics/history
- Supports: 30m, 24h, 3d
- Returns: { success, range, points: [{ timestamp, cpu, memory, players }] }

### Current Sparkline Component
`frontend/src/components/ui/sparkline.tsx`
- SVG-based, supports line and bar styles
- Works well for 30-minute data

### Current MetricsRow
`frontend/src/components/server-overview/MetricsRow.tsx`
- 5 cards: Uptime, CPU, Memory, Disk I/O, Players
- Uses useServerMetricsHistory hook
- Sparklines for CPU, Memory, Players

### Performance Tab Placeholder
`frontend/src/pages/ServerDetail.tsx:529-543`
- Currently shows "coming soon" message
- Tab already exists in navigation

## D1 Data Structure
```sql
server_metrics_history (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  cpu_percent REAL,
  memory_percent REAL,
  memory_used_mb INTEGER,
  memory_limit_mb INTEGER,
  player_count INTEGER,
  created_at INTEGER NOT NULL
)
```

- 10-second collection interval
- 3-day retention (cleanup runs probabilistically)
- ~26K rows per server at full retention
