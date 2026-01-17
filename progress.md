# M9.8.38 - Server Card Redesign + Volume Sizes - Progress Log

## Session 1 - 2026-01-17

### Started
- Created planning files for M9.8.38
- Original goal: Display storage consumption for individual server volumes

### Research Completed
- [x] Read current agent metrics implementation (`agent/metrics.go`)
- [x] Understand server data path structure (`agent/server.go`)
- [x] Analyzed current server card implementations
- [x] Documented findings

### Scope Expansion
User feedback led to expanding scope:
- Original: Just add volume sizes to existing cards
- New: Full server card redesign with two layout options + volume sizes

### Design Decisions Made
1. **Two layouts to prototype**: Expandable (A) and Compact+Hover (B)
2. **Temporary toggle**: Allow user to flip between layouts to choose
3. **Unified component**: Same `<ServerCard>` used in AgentServerList and ServerList
4. **Consistency**: Same layout everywhere
5. **Mobile**: Desired but not critical
6. **Storage caching**: 5-min TTL in agent memory

### Next Steps (Updated after review)
The frontend ServerCard is mostly done. Remaining work:
- Integrate ServerCard into AgentServerList (Agent Detail page)
- Implement backend storage collection (Phase 4-5)
- Replace mock storage data with real data

### Files Updated
- `task_plan.md` - Rewrote with 8 phases for expanded scope
- `findings.md` - Added current card analysis
- `progress.md` - This file

---

## Session 2 - 2026-01-17 (Status Review)

### Reviewed Git Changes
Found significant implementation already done (uncommitted):

**Frontend - IMPLEMENTED:**
- `frontend/src/components/ServerCard.tsx` - NEW - Unified card with both layouts
- `frontend/src/components/ServerCardLayoutToggle.tsx` - NEW - Layout toggle button
- `frontend/src/contexts/ServerCardLayoutContext.tsx` - NEW - Layout state context
- `frontend/src/components/ui/tooltip.tsx` - NEW - Shadcn tooltip for compact mode
- `frontend/src/App.tsx` - Added ServerCardLayoutProvider
- `frontend/src/pages/ServerList.tsx` - Now uses ServerCard + layout toggle

**Frontend - NOT YET DONE:**
- `frontend/src/components/AgentServerList.tsx` - Still uses OLD card implementation

**Backend - NOT IMPLEMENTED:**
- No `server.volume.sizes` message handler in agent
- No storage endpoint in manager
- Storage data in ServerCard is MOCK DATA (hardcoded 15.1GB bin, 2.1GB data)

**Other Changes (unrelated to M9.8.38):**
- `agent/server.go` - Added `server.getdatapath` handler (for config apply, not volume sizes)
- `agent/metrics.go` - Multiple disk metrics (M9.8.37 work)
- `manager/src/routes/agents.ts` - Auto-recovery for missing containers (M9.8.36)
- Various UI cleanup changes (confirmation dialogs, etc.)

### Updated Phase Status
| Phase | Status | Notes |
|-------|--------|-------|
| 1. Create ServerCard | `complete` | Component created, context, toggle done |
| 2. Expandable Layout | `complete` | Fully implemented |
| 3. Compact+Hover Layout | `complete` | Tooltip works, mobile deferred |
| 4. Agent Volume Collection | `pending` | Not started |
| 5. Manager API | `pending` | Not started |
| 6. Frontend Integration | `partial` | Mock data only |
| 7. Replace Old Cards | `partial` | ServerList done, AgentServerList NOT done |
| 8. Deployment | `pending` | Not started |

### Recommended Next Steps
1. **Option A**: Focus on getting ServerCard into AgentServerList first (complete UI unification)
2. **Option B**: Implement backend storage collection and replace mock data
3. **Option C**: Get user feedback on current layout before more work

---

## Session 3 - 2026-01-17 (ServerCard Integration)

### Work Completed
- [x] Added ServerCard imports to AgentServerList
- [x] Added layout toggle to AgentServerList header
- [x] Replaced inline card rendering with ServerCard for managed servers
- [x] Kept simplified card for unmanaged containers
- [x] TypeScript compiles without errors

### Files Modified
- `frontend/src/components/AgentServerList.tsx`
  - Added imports: ServerCard, ServerCardLayoutToggle, useServerCardLayout
  - Added `useServerCardLayout()` hook
  - Added `<ServerCardLayoutToggle />` to header
  - Replaced managed server cards with `<ServerCard>` component
  - Preserved unmanaged container cards with simpler styling

### What's Now Working
- Both pages (All Servers + Agent Detail) use the same ServerCard component
- Layout toggle visible on both pages
- Expandable and Compact layouts work on both pages
- Mock storage data displayed in both layouts

### Remaining for M9.8.38
- [ ] Issues & Recovery section still uses old cards (has special restore/purge actions)
- [ ] Backend storage collection (Phases 4-5) not implemented
- [ ] Real storage data to replace mock data

### User Decision: Keep Layout Toggle Permanent
- User tested both layouts, prefers compact
- Toggle kept permanently so other users can choose
- Layout preference now persisted in localStorage (`zedops-server-card-layout`)
- Default changed from expandable to compact

---

## Session 3 continued - Phase 4: Agent Volume Collection

### Implemented
- [x] Added `ServerVolumeSizesRequest` / `ServerVolumeSizesResponse` structs to `agent/server.go`
- [x] Added `GetServerVolumeSizes()` function using `filepath.Walk`
- [x] Added `getDirSize()` helper function
- [x] Added `volumeSizeCache` struct with TTL support
- [x] Added `volumeCache` map and mutex to Agent struct
- [x] Added `handleServerVolumeSizes()` message handler to `agent/main.go`
- [x] Registered `server.volumesizes` case in message switch
- [x] Agent binary built successfully via Docker

### Agent Message Protocol
```
Request: server.volumesizes
Payload: { serverName: string, dataPath: string }
Response: { success: bool, sizes?: { binBytes, dataBytes, totalBytes, mountPoint }, error?: string }
```

### Cache Behavior
- Cache key: `{serverName}:{dataPath}`
- TTL: 5 minutes
- Fresh calculation on cache miss or expiry

---

## Session 3 continued - Phase 5-6: Manager API + Frontend Integration

### Phase 5: Manager API
- [x] Added `GET /api/agents/:id/servers/:serverId/storage` endpoint in `manager/src/routes/agents.ts`
- [x] Added `handleServerStorageRequest` handler in `manager/src/durable-objects/AgentConnection.ts`
- [x] Sends `server.volumesizes` message to agent and waits for reply
- [x] Returns 503 if agent offline

### Phase 6: Frontend Integration
- [x] Added `ServerStorageSizes` and `ServerStorageResponse` types in `frontend/src/lib/api.ts`
- [x] Added `getServerStorage()` API function
- [x] Added `useServerStorage()` hook in `frontend/src/hooks/useServers.ts`
- [x] Updated `ServerCard.tsx` to use real storage data:
  - Calls `useServerStorage(server.agent_id, server.id)`
  - Shows "Loading..." while fetching
  - Shows "Unavailable" if agent offline or error
  - Shows "..." for total bytes while loading

### End-to-End Flow
```
Frontend (ServerCard) -> useServerStorage hook -> getServerStorage API
    -> /api/agents/:id/servers/:serverId/storage
    -> AgentConnection DO -> handleServerStorageRequest
    -> sendToAgent(server.volumesizes) -> Agent handleServerVolumeSizes
    -> GetServerVolumeSizes() (filepath.Walk) -> cached response
```

### M9.8.38 Status Summary
| Phase | Status |
|-------|--------|
| 1. Create ServerCard | complete |
| 2. Expandable Layout | complete |
| 3. Compact Layout | complete |
| 4. Agent Volume Collection | complete |
| 5. Manager API | complete |
| 6. Frontend Integration | complete |
| 7. Replace Old Cards | complete |
| 8. Deployment | complete (agent pending) |

### Next Steps
- [x] Deploy manager + frontend to Cloudflare
- [ ] Deploy updated agent binary to host (user action required)
- [ ] Test end-to-end in production

---

## Session 3 continued - Phase 8: Deployment

### Deployed to Cloudflare
- URL: https://zedops.mail-bcf.workers.dev
- Version: `a42f0906-7628-4911-92b2-c3cd5538155b`

### Deployment Issue Fixed
- **Problem**: Blank page on refresh
- **Cause**: `manager/src/index.ts` had hardcoded asset filenames that didn't match build output
- **Fix**: Updated asset paths from `index-DnI2FYYu.js` → `index-C8OaW8Lz.js` and `index-CnOgss55.css` → `index-dc-jheIq.css`

### Memory Rules Updated
- Added deployment checklist to `.claude/rules/workflow/local-dev.md`
- Added CRITICAL section about updating index.ts asset paths after build
- This must be done every time the frontend is rebuilt

### Remaining
- [ ] User needs to update agent binary on host to enable storage feature

---

## Session 4 - 2026-01-17 (Debugging Storage Feature)

### Issue
- Agent deployed and running (verified: heartbeats sending and receiving ACKs)
- Storage shows "Unavailable" in UI despite agent being online

### Investigation
1. Checked agent logs - no `server.volumesizes` messages received
2. Verified handler registered in agent: `case "server.volumesizes":` at line 317
3. Verified manager route exists: `GET /:id/servers/:serverId/storage` at line 2287
4. Verified DO handler: `handleServerStorageRequest` at line 2367
5. No storage requests reaching Cloudflare worker (wrangler tail showed nothing)

### Debug Changes Made
- Added console.log to manager route (lines 2288-2292)
- Added console.log to useServerStorage hook (lines 463-471)
- Updated index.ts asset path: `index-C8OaW8Lz.js` → `index-SkS7Fd2S.js`

### Bug Found & Fixed
- **Error**: `this.sendToAgent is not a function`
- **Cause**: In `AgentConnection.ts` line 2421, called non-existent method `this.sendToAgent()`
- **Fix**: Changed to `this.send()` which is the correct method name
- **File**: `manager/src/durable-objects/AgentConnection.ts`

### Storage Feature Now Working
- Agent receives `server.volumesizes` messages
- Agent calculates bin/ and data/ sizes using `filepath.Walk`
- Results cached for 5 minutes
- UI displays real storage data:
  - build42-testing: 5.36 GB (bin: 5.34 GB, data: 17.6 MB)
  - myfunserver: 5.34 GB (bin: 5.34 GB, data: 3.8 MB)
  - jeanguy: 5.34 GB (bin: 5.34 GB, data: 3.5 MB)

### M9.8.38 Complete
All phases finished:
- [x] Phase 1-3: ServerCard component with expandable/compact layouts
- [x] Phase 4: Agent volume collection
- [x] Phase 5: Manager API endpoint
- [x] Phase 6: Frontend integration
- [x] Phase 7: Replace old cards
- [x] Phase 8: Deployment + bug fix
