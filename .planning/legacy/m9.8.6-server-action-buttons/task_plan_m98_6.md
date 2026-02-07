# M9.8.6 Task Plan - Fix Server Action Buttons

**Milestone:** M9.8.6 - Fix Server Action Buttons Not Working
**Parent:** M9.8 - Polish & Production Readiness
**Priority:** HIGH (Broken Functionality)
**Estimated Duration:** 30 minutes
**Started:** 2026-01-13

---

## Goal

Fix the server action buttons in ServerDetail page that are currently not doing anything when clicked.

---

## Success Criteria

- [x] Plan created
- [x] Identify which buttons aren't working (top/bottom)
- [x] Find missing handlers/implementations
- [x] Fix button click handlers
- [x] Build succeeds
- [x] Deployed to production
- [ ] User validates buttons work

---

## Current State Analysis

**User Report:**
> "works perfectly !! now next thing is the quick action buttons in the individual servers pages, they don´t do anything )the one at the top and the one at the bottom of the page"

**Investigation Needed:**
1. Find ServerDetail.tsx buttons at top of page
2. Find buttons at bottom of page
3. Check if handlers are missing or not wired up
4. Check if hooks/API functions exist

**Expected Locations:**
- Top buttons: Likely in server header (Start, Stop, Restart, etc.)
- Bottom buttons: Need to identify location

---

## Implementation Phases

### Phase 1: Investigation (10 min) - `complete`

**Goal:** Find all action buttons and identify missing handlers

**Steps:**
1. ✅ Read ServerDetail.tsx
2. ✅ Find buttons at top of page
3. ✅ Find buttons at bottom of page
4. ✅ Check onClick handlers
5. ✅ Verify hooks exist (useStartServer, useStopServer, etc.)
6. ✅ Document findings

**Files Read:**
- `frontend/src/pages/ServerDetail.tsx`
- `frontend/src/hooks/useServers.ts`
- `frontend/src/hooks/useContainers.ts`
- `frontend/src/lib/api.ts`

**Findings:**
- **Top buttons (lines 103-127):** Start, Stop, Restart, Rebuild, Delete - ALL missing onClick handlers
- **Bottom buttons (lines 278-285):** Quick Actions - ALL missing onClick handlers
- **Available hooks from useServers.ts:** useStartServer, useStopServer, useRebuildServer, useDeleteServer
- **Available hooks from useContainers.ts:** useRestartContainer (no server-level restart exists)
- **All necessary hooks exist and are ready to use**

---

### Phase 2: Fix Button Handlers (10 min) - `complete`

**Goal:** Wire up missing onClick handlers

**Changes Made:**

**1. Added imports (lines 10-11):**
- useStartServer, useStopServer, useRebuildServer, useDeleteServer from @/hooks/useServers
- useRestartContainer from @/hooks/useContainers

**2. Initialized mutation hooks (lines 21-25)**

**3. Created handler functions (lines 28-72):**
- handleStart() - Starts server
- handleStop() - Stops server
- handleRestart() - Restarts container
- handleRebuild() - Rebuilds server (with confirmation)
- handleDelete() - Deletes server (with confirmation, navigates to /servers on success)

**4. Wired up top buttons (lines 157-183):**
- ✅ Start button → handleStart with loading state
- ✅ Stop button → handleStop with loading state
- ✅ Restart button → handleRestart with loading state
- ✅ Rebuild button → handleRebuild with loading state + confirmation dialog
- ✅ Delete button → handleDelete with loading state + confirmation dialog

**5. Wired up bottom quick actions (lines 333-353):**
- ✅ Restart Server → handleRestart
- ✅ Emergency Stop → handleStop
- 🔲 Save World, Backup Now, Broadcast Message, View Players → Disabled (TODO)

**Files Modified:**
- `frontend/src/pages/ServerDetail.tsx`

---

### Phase 3: Build & Deploy (10 min) - `complete`

**Steps:**
1. ✅ Build frontend: `cd frontend && npm run build` - SUCCESS (5.90s)
2. ✅ Deploy backend: `cd manager && npx wrangler deploy` - SUCCESS
3. ✅ Verify deployment URL: https://zedops.mail-bcf.workers.dev
4. ⏳ Test all action buttons (user testing)

**Build Results:**
- Frontend: 928.80 KB → 250.11 KB gzipped (5.90s)
- Total Upload: 300.86 KiB / gzip: 59.99 KiB
- Worker Startup Time: 3 ms
- Version ID: 30fdd409-6ced-4854-a2f2-bd9d1f82a20a

**Expected Results:**
- ✅ Start button starts server (useStartServer)
- ✅ Stop button stops server (useStopServer)
- ✅ Restart button restarts server (useRestartContainer)
- ✅ Rebuild button rebuilds server (useRebuildServer + confirmation)
- ✅ Delete button deletes server (useDeleteServer + confirmation + redirect)

---

## Errors Encountered

None yet.

---

## Notes

- This is M9.8.6 (sixth sub-milestone of M9.8 polish phase)
- User reported broken functionality (high priority)
- Need to investigate first to understand scope
