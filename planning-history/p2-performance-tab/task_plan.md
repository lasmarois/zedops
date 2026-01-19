# Task: P2 - Performance Tab with Metrics Exploration

## Goal
Replace the placeholder Performance tab with interactive charts showing CPU, Memory, and Player history. Also consolidate the Overview tab's CPU/Memory/Disk cards into a single metrics card with a link to Performance tab.

## Current State
- Sparklines on Overview tab show 30-minute history (P1 complete)
- Performance tab is a placeholder with "coming soon" message
- D1 stores 3-day metrics at 10-second intervals
- API supports ranges: 30m, 24h, 3d

## Target State
- Overview: Single "Server Metrics" card with CPU, Memory, Disk I/O columns + sparklines
- Performance tab: Full interactive Recharts graphs with time range selector
- Time ranges: 30m, 3h, 12h, 24h, 3d (all synced)
- Clear "Data retained: 3 days" messaging

## Architecture

```
Overview Tab (MetricsRow.tsx)
  └─ MetricsCard (NEW)
       ├─ CPU column: value + sparkline
       ├─ Memory column: value + sparkline
       ├─ Disk I/O column: value (no sparkline)
       └─ Footer: "View Performance Details →" link

Performance Tab (ServerDetail.tsx)
  └─ PerformanceTab (NEW)
       ├─ TimeRangeSelector: [30m] [3h] [12h] [24h] [3d]
       ├─ MetricsChart (CPU) - Recharts AreaChart
       ├─ MetricsChart (Memory) - Recharts AreaChart
       └─ MetricsChart (Players) - Recharts AreaChart
```

## Phases

### Phase 1: Install Recharts & Update API
**Status:** `complete`
- [x] Install recharts dependency
- [x] Add '3h' and '12h' range options to API endpoint
- [x] Implement downsampling for larger ranges (12h: 1-min avg, 24h: 5-min avg, 3d: 15-min avg)
- [x] Update useServerMetricsHistory hook to accept new ranges

### Phase 2: Create MetricsCard Component
**Status:** `complete`
- [x] Create `frontend/src/components/server-overview/MetricsCard.tsx`
- [x] Horizontal 3-column layout: CPU | Memory | Disk I/O
- [x] Each column: label, value, sparkline (except Disk I/O)
- [x] Footer with "View Performance Details →" link
- [x] Navigation to Performance tab on click

### Phase 3: Update MetricsRow
**Status:** `complete`
- [x] Remove separate CPU, Memory, Disk I/O cards
- [x] Import and use MetricsCard
- [x] Keep Uptime and Players cards separate
- [x] Result: 5 cards → 3 cards (Uptime, Metrics, Players)

### Phase 4: Create Performance Tab Components
**Status:** `complete`
- [x] Create `frontend/src/components/performance/TimeRangeSelector.tsx`
- [x] Create `frontend/src/components/performance/MetricsChart.tsx` (Recharts wrapper)
- [x] Create `frontend/src/components/performance/PerformanceTab.tsx` (main container)
- [x] Add "ℹ️ Data retained: 3 days" info badge

### Phase 5: Integrate Performance Tab
**Status:** `complete`
- [x] Replace placeholder in ServerDetail.tsx with PerformanceTab
- [x] Wire up shared time range state
- [x] Ensure all three charts sync to same time range
- [x] Add hover tooltips showing exact value + timestamp

### Phase 6: Build, Deploy & Test
**Status:** `complete`
- [x] Build frontend (fix any TypeScript errors)
- [x] Deploy to Cloudflare
- [ ] Test on production with real data
- [ ] Verify all time ranges work correctly

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/components/server-overview/MetricsCard.tsx` | Consolidated metrics card |
| `frontend/src/components/performance/TimeRangeSelector.tsx` | Time range button group |
| `frontend/src/components/performance/MetricsChart.tsx` | Recharts wrapper |
| `frontend/src/components/performance/PerformanceTab.tsx` | Main Performance tab |

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/server-overview/MetricsRow.tsx` | Use MetricsCard, remove old cards |
| `frontend/src/pages/ServerDetail.tsx` | Import PerformanceTab |
| `frontend/src/hooks/useServers.ts` | Add '3h', '12h' to range type |
| `manager/src/routes/servers.ts` | Add new ranges with downsampling |

## Out of Scope (YAGNI)
- Drag-to-zoom on charts
- Date/time picker
- Alerts/thresholds
- CSV export
- Disk I/O historical tracking

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
