# M9.8.38 - Server Card Redesign + Volume Sizes

## Goal
Redesign server cards with two layout options (expandable vs compact) and integrate per-server storage metrics. Unify card design across AgentServerList and ServerList.

## Scope Expansion
Originally just "volume sizes" - now includes full card redesign to properly integrate storage info.

## Requirements
- [ ] Two card layout options: Expandable (A) and Compact+Hover (B)
- [ ] Temporary toggle to compare layouts and choose
- [ ] Unified card component used in both server lists
- [ ] Show total storage size at a glance
- [ ] Show bin/data breakdown on expand/hover
- [ ] Mobile-friendly (desired, not critical)
- [ ] Consistent layout everywhere

## Design Decisions
- **Option A (Expandable)**: Click to expand, shows full details inline
- **Option B (Compact+Hover)**: Dense layout, tooltip on hover for details
- **Toggle**: Temporary UI to flip between A/B for user evaluation
- **Consistency**: Same `<ServerCard>` component used everywhere
- **Storage**: Cache with 5-min TTL (calculated on first view)

## Phases

### Phase 1: Create Unified ServerCard Component
Status: `complete`
- [x] Create `frontend/src/components/ServerCard.tsx`
- [x] Support both layout modes via prop: `layout="expandable" | "compact"`
- [x] Create `ServerCardLayoutContext.tsx` for layout state
- [x] Create `ServerCardLayoutToggle.tsx` for switching layouts
- [x] Add layout toggle (temporary, for evaluation)
- [ ] **Remaining**: Extract common logic from AgentServerList (still uses old cards)

### Phase 2: Implement Expandable Layout (Option A)
Status: `complete`
- [x] Collapsed: Status + Name + Total Size + Actions
- [x] Expanded: Storage breakdown, ports, uptime, config details
- [x] Smooth expand/collapse animation
- [x] Click card to expand (not navigate)
- [x] Click server name to navigate to detail

### Phase 3: Implement Compact+Hover Layout (Option B)
Status: `complete`
- [x] Dense single/two-row layout
- [x] Hover tooltip with full details (using Shadcn Tooltip)
- [x] Click anywhere to navigate to detail
- [ ] Touch-friendly (long-press for tooltip on mobile?) - deferred

### Phase 4: Agent Volume Size Collection
Status: `complete`
- [x] Add `GetServerVolumeSizes(serverName, dataPath)` to agent
- [x] Use Go `filepath.Walk` to sum sizes (avoid shelling out to `du`)
- [x] Return: `{ binBytes, dataBytes, totalBytes, mountPoint }`
- [x] Add message handler: `server.volumesizes`
- [x] Cache results in agent memory (5-min TTL)
- [x] Agent binary built successfully

### Phase 5: Manager/API Integration
Status: `complete`
- [x] Add endpoint: `GET /api/agents/:id/servers/:serverId/storage`
- [x] Route through Durable Object to agent (`handleServerStorageRequest`)
- [x] Returns cached data from agent (5-min TTL)
- [x] Handle offline agents (returns 503)

### Phase 6: Frontend Integration
Status: `complete`
- [x] Add `useServerStorage(agentId, serverId)` hook
- [x] Add `getServerStorage` API function
- [x] Integrate real storage display into ServerCard
- [x] Show loading state while fetching ("Loading...")
- [x] Handle unavailable data ("Unavailable")

### Phase 7: Replace Old Cards + Testing
Status: `complete`
- [x] Replace cards in AgentServerList with ServerCard - **DONE** (managed servers only)
- [x] Replace cards in ServerList with ServerCard - **DONE**
- [x] Layout toggle added to ServerList
- [x] Layout toggle added to AgentServerList
- [x] Test both layouts - **User tested, prefers compact**
- [x] Layout toggle kept permanently (user preference)
- [x] Layout preference persisted to localStorage
- [x] Default changed to compact layout
- Note: Issues & Recovery section still uses old cards (special restore/purge actions)

### Phase 8: Deployment
Status: `complete`
- [x] Build frontend: `npm run build`
- [x] Update index.ts asset paths to match build output
- [x] Deploy to Cloudflare: `npx wrangler deploy`
- [ ] Deploy updated agent binary to host (user action required)
- [x] Verified in production: https://zedops.mail-bcf.workers.dev

## Files to Create
- `frontend/src/components/ServerCard.tsx` - Unified card component
- `frontend/src/components/ServerCardExpanded.tsx` - Expandable internals
- `frontend/src/components/ServerCardTooltip.tsx` - Hover tooltip
- `frontend/src/hooks/useServerStorage.ts` - Storage data hook

## Files to Modify
- `agent/server.go` or new `agent/storage.go` - Volume size calculation
- `agent/main.go` - Message handler
- `manager/src/routes/agents.ts` or `servers.ts` - Storage endpoint
- `frontend/src/components/AgentServerList.tsx` - Use ServerCard
- `frontend/src/pages/ServerList.tsx` - Use ServerCard

## Card Layout Specs

### Option A: Expandable
```
COLLAPSED:
┌─────────────────────────────────────────────────────────────────────┐
│ [●] ServerName          [Managed]    17.2 GB        [Start] [▼]    │
│     maestro • latest • 2h uptime                                    │
└─────────────────────────────────────────────────────────────────────┘

EXPANDED:
┌─────────────────────────────────────────────────────────────────────┐
│ [●] ServerName          [Managed]    17.2 GB        [Start] [▲]    │
│     maestro • latest • 2h uptime                                    │
├─────────────────────────────────────────────────────────────────────┤
│   Storage     bin/ 15.1 GB    data/ 2.1 GB    Mount: /Volumes/Data │
│   Ports       Game: 16261     UDP: 16262      RCON: 16269          │
│   Created     2026-01-15 14:30                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Option B: Compact + Hover
```
NORMAL:
┌─────────────────────────────────────────────────────────────────────┐
│ [●] ServerName     maestro • latest • 17.2 GB • 2h   [Start] [⋮]   │
└─────────────────────────────────────────────────────────────────────┘

HOVER TOOLTIP:
┌────────────────────────────┐
│ Storage                    │
│   bin/  15.1 GB            │
│   data/  2.1 GB            │
│   Mount: /Volumes/Data     │
├────────────────────────────┤
│ Ports                      │
│   Game: 16261              │
│   UDP:  16262              │
│   RCON: 16269              │
├────────────────────────────┤
│ Created: 2026-01-15        │
└────────────────────────────┘
```

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
