# Task Plan: M9.8.7 - Add Purge UI for Deleted Servers

**Goal:** Add UI to view and permanently purge soft-deleted servers

**Status:** COMPLETE

**Started:** 2026-01-13 15:15
**Completed:** 2026-01-13 15:35

---

## Objective

Add UI to view and permanently purge soft-deleted servers

## Tasks

- [x] Add imports for usePurgeServer hook
- [x] Separate active and deleted servers in ServerList
- [x] Create handlePurge function with two-step confirmation
- [x] Add collapsible "Deleted Servers" section
- [x] Fix TypeScript error (StatusBadge variant)
- [x] Build and deploy frontend
- [x] Fix Bug #1: UI not refreshing after purge (query invalidation)
- [x] Fix Bug #2: Data not removed from host filesystem
- [x] Update backend purge logic (remove container_id check)
- [x] Update Durable Object to forward serverName
- [x] Update agent Go code to handle data removal without container
- [x] Build and deploy agent + manager
- [x] User testing and confirmation

## Result

Complete purge functionality with proper data removal

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| TypeScript: StatusBadge variant "default" invalid | 1 | Changed to "muted" variant |
| UI not refreshing after purge | 1 | Added `['servers', 'all']` query invalidation |
| Data not removed during purge | 1 | Removed container_id check in backend |
| Data not removed during purge | 2 | Updated agent to handle removal without container |

## Key Decisions

1. **Two-step purge confirmation:** First prompt chooses data removal (OK) or keep (Cancel), second prompt is final confirmation
2. **Deleted servers collapsible:** Hidden by default to keep UI clean, expandable to show deleted servers
3. **Agent data removal independent:** DeleteServer function works even without container, using serverName to find data path
4. **Always send delete command:** Backend now sends delete command if agent is online, regardless of container existence

## Files Modified

- `frontend/src/pages/ServerList.tsx` - Added deleted servers section and purge UI
- `frontend/src/hooks/useServers.ts` - Fixed query invalidation in usePurgeServer
- `manager/src/routes/agents.ts` - Fixed purge logic to work without container_id
- `manager/src/durable-objects/AgentConnection.ts` - Updated to forward serverName
- `agent/server.go` - Added serverName to DeleteRequest, updated DeleteServer function
- `agent/main.go` - Updated handler to pass serverName parameter
