# M9.8.37 - Dynamic Disk Metrics - Findings

## Current Implementation Analysis

### Agent Metrics (agent/metrics.go)

**Current `HostMetrics` struct:**
```go
type HostMetrics struct {
    CPUPercent     float64 `json:"cpuPercent"`
    MemoryUsedMB   int64   `json:"memoryUsedMB"`
    MemoryTotalMB  int64   `json:"memoryTotalMB"`
    DiskUsedGB     int64   `json:"diskUsedGB"`
    DiskTotalGB    int64   `json:"diskTotalGB"`
    DiskPercent    float64 `json:"diskPercent"`
    Timestamp      int64   `json:"timestamp"`
}
```

**Current disk collection logic:**
```go
// Collect disk usage (try /var/lib/zedops first, fallback to /)
diskUsed, diskTotal, diskPercent, err := getDiskUsage("/var/lib/zedops")
if err != nil {
    // Fallback to root filesystem
    diskUsed, diskTotal, diskPercent, err = getDiskUsage("/")
}
```

**getDiskUsage function:**
- Uses `syscall.Statfs` to get filesystem stats
- Returns used/total in GB and percentage
- Works on any valid path

### Key Observations

1. **Device ID available**: `syscall.Statfs_t` includes `Fsid` which can identify unique filesystems

2. **Path to mount point mapping**: Can use `/proc/mounts` to find mount points, or just use the device ID for deduplication

3. **Server data paths come from**:
   - Agent config: `server_data_path` (default)
   - Server database: `server_data_path` column (per-server override)
   - Container inspection: Bind mount sources

## Design Options

### Option A: Container Mount Inspection
```
For each running container:
  → Inspect bind mounts
  → Extract source paths for /home/steam/zomboid-dedicated
  → Get parent directory (server data path)
  → Deduplicate by device ID
  → Return disk metrics for each unique filesystem
```

**Pros**: Accurate, shows only actively used volumes
**Cons**: Requires containers running, more API calls

### Option B: Database Query
```
Query all servers for agent:
  → Get server_data_path for each
  → Use agent default if NULL
  → Deduplicate by device ID
  → Return disk metrics for each unique filesystem
```

**Pros**: Works even with stopped containers
**Cons**: May include stale paths

### Option C: Hybrid (Recommended)
```
1. Start with agent's default server_data_path
2. Query running containers for additional paths
3. Deduplicate by device ID
4. Return metrics with descriptive labels
```

## Confirmed Design

### Approach: Hybrid (Option C)
1. Start with agent's default `server_data_path`
2. Inspect running containers for additional bind mount paths
3. Deduplicate by device ID (Fsid from statfs)
4. Return metrics with descriptive labels

### Data Structure (No Legacy Fields)

```go
type DiskMetric struct {
    Path       string  `json:"path"`       // Original path checked (e.g., "/data/servers")
    MountPoint string  `json:"mountPoint"` // Resolved mount point (e.g., "/data")
    Label      string  `json:"label"`      // Human-readable label (e.g., "Server Data" or path)
    UsedGB     int64   `json:"usedGB"`
    TotalGB    int64   `json:"totalGB"`
    Percent    float64 `json:"percent"`
}

type HostMetrics struct {
    CPUPercent     float64      `json:"cpuPercent"`
    MemoryUsedMB   int64        `json:"memoryUsedMB"`
    MemoryTotalMB  int64        `json:"memoryTotalMB"`
    Disks          []DiskMetric `json:"disks"`      // Array of volume metrics
    Timestamp      int64        `json:"timestamp"`
}
```

**Note:** Legacy fields (`diskUsedGB`, `diskTotalGB`, `diskPercent`) removed - no backward compatibility needed since all components deploy together.

## UI Design (Confirmed)

### Agent Card (Compact View)
- CPU and Memory: Shown as before (top level)
- Storage: Visually differentiated (indented or with separator)
- Show each volume with small progress bar + label

Example layout:
```
┌─────────────────────────────────┐
│ Agent Name                      │
├─────────────────────────────────┤
│ CPU: ████████░░ 80%             │
│ Memory: ██████░░░░ 4GB/8GB      │
│ ─────────────────────────────── │
│ Storage:                        │
│   /data: ██████░░░░ 120GB/200GB │
│   /mnt:  ████░░░░░░ 80GB/500GB  │
└─────────────────────────────────┘
```

### Agent Details Page (Disk Card)
- Existing disk card expanded to show stacked bars
- One progress bar per volume
- Label shows path/mount point

Example layout:
```
┌─────────────────────────────────┐
│ Disk Usage                      │
├─────────────────────────────────┤
│ /data/servers (Server Data)     │
│ ████████████░░░░ 120GB / 200GB  │
│                                 │
│ /mnt/backup                     │
│ ████░░░░░░░░░░░░ 80GB / 500GB   │
└─────────────────────────────────┘
```

## Implementation Plan

### Phase 2: Agent Changes
1. Add `DiskMetric` struct
2. Create `collectDiskMetrics()` function:
   - Get agent default path from config
   - List running containers, inspect bind mounts
   - Collect unique paths
   - For each path: statfs, get device ID
   - Deduplicate by device ID
   - Return array of DiskMetric
3. Update `CollectHostMetrics()` to use new function
4. Remove legacy disk fields

### Phase 3: Manager/Frontend Changes
1. Update TypeScript types
2. Update AgentCard component
3. Update Agent details disk card
