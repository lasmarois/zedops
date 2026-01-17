# M9.8.37 - Dynamic Disk Metrics

## Goal
Replace the single root filesystem disk metric with dynamic disk metrics showing usage for all volumes where server data is located.

## Current State
- Agent collects disk metrics for single path only (`/var/lib/zedops` or fallback to `/`)
- `HostMetrics` struct has single disk fields: `DiskUsedGB`, `DiskTotalGB`, `DiskPercent`
- UI shows one disk usage bar regardless of where servers are actually stored

## Problem
If servers are on different volumes (e.g., `/data/ssd`, `/data/hdd`, `/mnt/storage`), only root filesystem usage is shown. Users can't see actual disk space for their server data.

## Requirements
- [x] Show disk usage for all unique filesystems where server data exists
- [x] Dynamically discover paths from agent default + running container mounts (Hybrid)
- [x] Deduplicate by device ID (same filesystem accessed via different paths)
- [x] Display multiple volume metrics in UI

## Design Decisions (Confirmed)
1. **Source of paths**: Hybrid - Agent default `server_data_path` + running container bind mounts
2. **Backward compatibility**: NOT needed - clean break to `disks` array only
3. **UI Display**:
   - **Agent Card**: Differentiate CPU/Memory from storage (indent or visual separator)
   - **Agent Details**: Stacked progress bars per volume in existing disk card

## Phases

### Phase 1: Research & Design
Status: `complete`
- [x] Analyze current metrics collection in agent
- [x] Determine best source for server data paths
- [x] Design new data structures
- [x] Get user input on open questions

### Phase 2: Agent Changes
Status: `complete`
- [x] Add `DiskMetric` struct for individual volume
- [x] Add path discovery logic (container bind mount inspection)
- [x] Implement deduplication by device ID (string-based Fsid)
- [x] Update `HostMetrics` with `Disks` array
- [x] No backward compatibility needed (clean break)

### Phase 3: Manager/API Changes
Status: `complete`
- [x] Update TypeScript types for new metrics structure
- [x] WebSocket message handling works with new format (no changes needed)

### Phase 4: Frontend UI
Status: `complete`
- [x] AgentDetail.tsx - Stacked progress bars per volume in disk card
- [x] AgentList.tsx - Storage section with separator, multiple disk meters
- [x] Dashboard.tsx - Shows primary disk % or "N vols" for multiple

### Phase 5: Testing & Deployment
Status: `complete`
- [x] Manager deployed to Cloudflare
- [ ] Agent needs to be deployed to host(s)

## Files to Modify
- `agent/metrics.go` - Core metrics collection
- `agent/main.go` - Message handling (if needed)
- `manager/src/durable-objects/AgentConnection.ts` - Type updates
- `frontend/src/components/AgentCard.tsx` or similar - UI display

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
