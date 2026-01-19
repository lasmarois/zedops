# Findings: P1 - Metrics Sparklines

## Current Metrics Flow

### Agent Side (`agent/metrics.go`)
- `CollectHostMetrics()` - CPU, Memory, Disk from /proc
- Sent via heartbeat every 30s
- Container metrics via Docker stats API (on-demand)

### Manager Side (`AgentConnection.ts`)
- Heartbeat handler stores in `agents.metadata` (JSON)
- Container metrics proxied to agent, returned directly
- No persistence of container metrics

### Frontend Side
- `useServerMetrics` hook - 5s polling
- `MetricsRow.tsx` - Displays current values
- `SparklinePlaceholder` - Static bars (ready to replace)

## Key Structures

### ContainerMetrics (agent/docker.go)
```go
type ContainerMetrics struct {
    ContainerID   string
    CPUPercent    float64
    MemoryUsedMB  int64
    MemoryLimitMB int64
    DiskReadMB    int64
    DiskWriteMB   int64
    Uptime        string
    UptimeSeconds int64
}
```

### Player Stats (agent/playerstats.go)
- Already tracking player count via RCON
- Sent via `players.update` message
- Stored in DO memory (`playerStats` Map)

## Design Decisions

### Why 10-second intervals?
- 30s heartbeat is too coarse for smooth sparklines
- 5s would generate too much data
- 10s balances granularity vs storage

### Why D1 over DO storage?
- DO storage is per-agent, not queryable across agents
- D1 allows aggregate queries and cleanup
- Better for multi-server views

### Sparkline Display Ranges
- **Card view**: Last 30 minutes (180 points)
- **Expanded view**: 24 hours (8,640 points) - may need downsampling
- **Full history**: 3 days (25,920 points) - definitely needs downsampling

### Downsampling Strategy
For 24h/3d views, aggregate into larger buckets:
- 24h: 5-minute averages (288 points)
- 3d: 15-minute averages (288 points)

## Player Count Integration

Player count is already collected separately via `playerstats.go`:
- Uses persistent RCON connections
- 10-second polling interval
- Stored in DO memory

**Option 1**: Include player count in metrics batch (simplest)
**Option 2**: Keep separate, join at query time (cleaner separation)

→ **Decision**: Include in metrics batch for unified history table

## API Design

### Get Metrics History
```
GET /api/servers/:serverId/metrics/history?range=30m|24h|3d
```

Response:
```json
{
  "success": true,
  "range": "30m",
  "points": [
    { "timestamp": 1737234567, "cpu": 45.2, "memory": 62.1, "players": 5 },
    { "timestamp": 1737234577, "cpu": 47.1, "memory": 62.3, "players": 5 },
    ...
  ]
}
```

## Sparkline Component Requirements

- SVG-based for crisp rendering
- Auto-scale Y axis based on data range
- Handle missing data points (gaps)
- Responsive width
- Customizable colors
- Optional: Hover tooltip with exact value

## Existing Placeholder (MetricsRow.tsx:19-32)
```tsx
function SparklinePlaceholder() {
  return (
    <div className="h-8 mt-2 flex items-end gap-0.5 opacity-30">
      {[3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 7].map((h, i) => (
        <div
          key={i}
          className="w-1.5 bg-primary/40 rounded-sm"
          style={{ height: `${h * 3}px` }}
        />
      ))}
    </div>
  )
}
```

## D1 Considerations

### Free Tier Limits
- 5 GB storage
- 5 million rows read/day
- 100,000 rows written/day

### Our Usage (10 servers, 10s intervals)
- Writes: 6/min × 60 × 24 × 10 = 86,400 writes/day ✓
- Reads: Depends on UI usage, should be fine
- Storage: ~26 MB for 3 days ✓

## Alternative: Scheduled Cleanup

Instead of cleaning on every insert, use Cloudflare Cron Trigger:
```toml
[triggers]
crons = ["0 * * * *"]  # Every hour
```

Handler deletes records > 3 days old. More efficient but requires wrangler.toml change.
