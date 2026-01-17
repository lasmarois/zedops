# M9.8.38 - Server Volume Sizes - Findings

## Research Log

### Current Implementation Analysis

#### Server Data Structure
Each server has two directories:
```
{dataPath}/{serverName}/bin/   → Game binaries (~10-20GB)
{dataPath}/{serverName}/data/  → Saves, configs (variable)
```

**Path Resolution:**
- Agent has default: `agent.server_data_path` (e.g., `/var/lib/zedops/servers`)
- Server can override: `server.server_data_path` (per-server)
- Effective path: `server.server_data_path || agent.server_data_path`

#### Existing Code References
- `agent/server.go:76-78` - Creates bin/ and data/ directories
- `agent/server.go:609-611` - `CheckServerData()` checks if directories exist
- `manager/src/routes/servers.ts` - Returns `server_data_path` and `agent_server_data_path`

#### Current Disk Metrics (M9.8.37)
- Filesystem-level metrics (whole device usage)
- Uses container bind mounts to discover filesystems
- Shows mount points like `/Volumes/Data`, `/Volumes/Petty`
- **NOT** per-server/per-directory sizes

### Key Difference
| M9.8.37 (Disk Metrics) | M9.8.38 (Volume Sizes) |
|------------------------|------------------------|
| Filesystem free space | Directory used space |
| `/dev/sda1: 80% full` | `myserver: 15GB bin + 2GB data` |
| Whole device view | Per-server breakdown |

### Technical Considerations

#### Directory Size Calculation
Linux options:
1. **`du -sb {path}`** - Sums up all file sizes recursively
   - Pros: Accurate, standard tool
   - Cons: Can be slow for large directories (IO bound)

2. **Go `filepath.Walk`** - Walk tree and sum sizes
   - Pros: No external process
   - Cons: Similar performance to `du`

3. **Cached calculation** - Store results with TTL
   - Pros: Fast repeated queries
   - Cons: Stale data possible

#### Performance Estimates
For a typical server:
- `bin/`: ~10-20GB, ~50,000 files → 2-5 seconds to `du`
- `data/`: ~1-5GB, ~1,000 files → <1 second to `du`
- Total per server: 3-6 seconds worst case

#### Caching Strategy Options
1. **No cache** - Always calculate fresh (slow but accurate)
2. **TTL cache** - Cache for 5-10 minutes
3. **Lazy background refresh** - Return cached, trigger refresh

## Current Server Card Analysis

### AgentServerList (Agent Detail page)
```
┌─────────────────────────────────────────────────────────────────────┐
│ [●] ServerName          [Managed]                    [Start] [⋮]   │
│     docker.io/renegademaster/zomboid:latest                        │
│     Up 2 hours                                                      │
└─────────────────────────────────────────────────────────────────────┘
```
- Status badge (icon only) + name + managed badge
- Image info OR port info
- Container status text
- Action buttons + dropdown

### ServerList (All Servers page)
```
┌─────────────────────────────────────────────────────────────────────┐
│ [●] ServerName                          Game: 16261 UDP: 16262 ... │
│     Agent: maestroserver | Tag: latest                              │
└─────────────────────────────────────────────────────────────────────┘
```
- Status badge (icon only) + name
- Agent name + image tag
- Ports on the right

### Current Limitations
1. **No storage info** - Can't see how much space a server uses
2. **Ports clutter** - Takes up space, rarely needed at a glance
3. **Limited info density** - Click required to see most details
4. **No expandability** - Can't expand to see more without navigating
5. **Inconsistent layout** - Different info shown in different lists

## Design Decisions

(To be filled after brainstorming)
