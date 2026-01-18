# Milestone 9.8 - Polish & Production Readiness

**Parent Milestone:** M9.8
**Started:** 2026-01-13
**Completed:** 2026-01-15
**Status:** ✅ COMPLETE

---

## Overview

M9.8 is the final polish phase of the M9 milestone series. After successfully implementing the design (M9), bridging to functionality (M9.5), and fixing critical inconsistencies (M9.6-7), we're now addressing remaining issues to ensure production readiness.

**Approach:** Iterative sub-milestones (M9.8.1, M9.8.2, etc.) - one complex task per sub-milestone using planning-with-files skill.

---

## Goals

1. Fix all critical UX issues discovered during testing
2. Ensure server status accurately reflects agent connectivity
3. Improve error handling and edge cases
4. Polish UI interactions and feedback
5. Validate production readiness

---

## Sub-Milestones

### M9.8.1 - Fix Server Status When Agent Offline ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** CRITICAL
**Duration:** ~1 hour
**Completed:** 2026-01-13

**Issue Resolved:** Server status now reflects agent connectivity:
- Agent offline → Shows "Agent Offline" status (warning/orange) ✅
- Agent online + container running → Shows "Running" (green) ✅
- Agent online + container stopped → Shows "Stopped" (gray) ✅

**Solution:**
- Backend: Added `agent_status` to all server API responses (3 endpoints)
- Frontend: Created `getDisplayStatus()` helper that checks agent status first
- Updated: ServerList, AgentServerList, ServerDetail components

**Deployment:**
- Version: 127bd742-e409-4119-a0db-1a6b1eb8c1ee
- URL: https://zedops.mail-bcf.workers.dev

**Files:**
- `task_plan_m98_1.md` - Implementation plan (4 phases)
- `findings_m98_1.md` - Root cause analysis
- `progress_m98_1.md` - Session log
- `M981-COMPLETE.md` - Completion summary

---

### M9.8.2 - Dynamic Color Coding for Dashboard Stats ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** LOW (Polish/UX Enhancement)
**Duration:** ~10 minutes
**Completed:** 2026-01-13

**Issue Resolved:** Dashboard stat cards now use dynamic color coding:
- Count = 0 → Gray (text-muted-foreground) - indicates inactive/unhealthy ✅
- Count > 0 → Green (text-success) - indicates active/healthy ✅

**Solution:**
- Frontend: Added conditional className to Agents and Servers cards in Dashboard.tsx
- Changed 2 lines with ternary operators: `${count > 0 ? 'text-success' : 'text-muted-foreground'}`
- Visual improvement: "0 running" no longer shows in misleading green color

**Deployment:**
- Version: 88ec4682-d24a-4783-a6de-92599c43e0ef
- URL: https://zedops.mail-bcf.workers.dev

**Files:**
- `task_plan_m98_2.md` - 2-phase implementation plan
- `findings_m98_2.md` - Design analysis
- `progress_m98_2.md` - Session log
- `M982-COMPLETE.md` - Completion summary

---

### M9.8.3 - Fix RCON Window Close Button ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** MEDIUM (UX Issue - User can't close window)
**Duration:** ~20 minutes
**Completed:** 2026-01-13

**Issue Resolved:** RCON terminal X button now properly closes the window:
- Added state management to ServerDetail page ✅
- RCON tab shows "Open RCON Terminal" button ✅
- Button opens terminal as overlay (same as AgentServerList pattern) ✅
- X button calls `setShowRcon(false)` → window closes ✅

**Solution:**
- Frontend: Added `showRcon` state and conditional rendering in ServerDetail.tsx
- Changed from always-on terminal to button-triggered overlay
- Fixed empty `onClose={() => {}}` to proper `onClose={() => setShowRcon(false)}`

**Deployment:**
- Version: 0ac84cfc-79cf-409e-a67b-4345820f5864
- URL: https://zedops.mail-bcf.workers.dev

**Files:**
- `task_plan_m98_3.md` - 3-phase implementation plan
- `findings_m98_3.md` - Root cause investigation
- `progress_m98_3.md` - Session log
- `M983-COMPLETE.md` - Completion summary

---

### M9.8.4 - Embed RCON Terminal in Tab ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** MEDIUM (UX Improvement - User Requested)
**Duration:** ~27 minutes
**Completed:** 2026-01-13

**Issue Resolved:** RCON terminal now embedded directly in ServerDetail tab:
- Added `embedded` prop to RconTerminal component ✅
- ServerDetail: Embedded mode (600px, no X button, fits in tab) ✅
- AgentServerList: Overlay mode unchanged (backward compatible) ✅
- Dual-mode support (one component, two behaviors) ✅

**Solution:**
- Frontend: Added conditional rendering in RconTerminal.tsx based on `embedded` prop
- Removed button approach from M9.8.3 (simpler code)
- Terminal content extracted to reusable JSX variable
- X button only shows in overlay mode

**Deployment:**
- Version: 704a00c1-387f-495d-8114-6a333b83c006
- URL: https://zedops.mail-bcf.workers.dev

**Files:**
- `task_plan_m98_4.md` - 4-phase implementation plan
- `findings_m98_4.md` - Use case analysis and design decisions
- `progress_m98_4.md` - Session log
- `M984-COMPLETE.md` - Completion summary

---

### M9.8.5 - Increase Embedded RCON Terminal Height ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** LOW (Polish/UX Enhancement)
**Duration:** ~10 minutes
**Completed:** 2026-01-13

**Issue Resolved:** Embedded RCON terminal now uses much more vertical space:
- Changed from fixed 600px to viewport-based `h-[calc(100vh-300px)]` ✅
- Terminal fills remaining space on page (responsive) ✅
- Adapts to different screen sizes ✅
- One-line CSS change ✅

**Solution:**
- Frontend: Changed height in RconTerminal.tsx (line 589)
- From: `h-[600px]` (fixed, too small)
- To: `h-[calc(100vh-300px)]` (viewport-based, responsive)

**Deployment:**
- Version: ada07587-29d6-4328-9efe-e17ee917d73a
- URL: https://zedops.mail-bcf.workers.dev

**Files:**
- `task_plan_m98_5.md` - 3-phase implementation plan
- `findings_m98_5.md` - Height analysis
- `progress_m98_5.md` - Session log
- `M985-COMPLETE.md` - Completion summary

---

### M9.8.6 - Fix Server Action Buttons ✅ DEPLOYED
**Status:** ✅ Deployed (Awaiting User Testing)
**Priority:** HIGH (Broken Functionality)
**Duration:** ~20 minutes
**Completed:** 2026-01-13

**Issue Resolved:** Server action buttons in ServerDetail page now work:
- Top buttons: Start, Stop, Restart, Rebuild, Delete all functional ✅
- Bottom quick actions: Restart Server and Emergency Stop functional ✅
- Loading states show during operations (e.g., "Starting...", "Stopping...") ✅
- Confirmation dialogs for destructive actions (Rebuild, Delete) ✅
- Delete button redirects to /servers after success ✅

**Solution:**
- Frontend: Added onClick handlers to all action buttons in ServerDetail.tsx
- Imported mutation hooks: useStartServer, useStopServer, useRestartContainer, useRebuildServer, useDeleteServer
- Created handler functions with proper parameter validation
- Added confirmation dialogs for Rebuild and Delete operations
- Wired up 7 buttons (5 top buttons + 2 bottom quick actions)
- Marked 4 unimplemented quick actions as TODO (Save World, Backup Now, Broadcast Message, View Players)

**Deployment:**
- Version: 30fdd409-6ced-4854-a2f2-bd9d1f82a20a
- URL: https://zedops.mail-bcf.workers.dev

**Files:**
- `task_plan_m98_6.md` - 3-phase implementation plan
- `progress_m98_6.md` - Session log

---

### M9.8.7 - Add Purge UI for Deleted Servers ✅ DEPLOYED
**Status:** ✅ Deployed (Awaiting User Testing)
**Priority:** HIGH (Missing Critical Functionality)
**Duration:** ~36 minutes
**Completed:** 2026-01-13

**Issue Resolved:** Added UI to view and purge soft-deleted servers:
- "Deleted Servers" collapsible section in ServerList page ✅
- Shows count: "X servers pending purge (data preserved for 24h)" ✅
- Muted styling (gray border, semi-transparent background) for visual distinction ✅
- Purge button for each deleted server with loading state ✅
- Two-step confirmation dialog with data removal option ✅

**Solution:**
- Frontend: Added collapsible section to ServerList.tsx below active servers
- Separated active and deleted servers (filter by status='deleted')
- Created handlePurge function with two-step confirmation:
  1. First prompt: Choose to remove data (OK) or keep data (Cancel)
  2. Second prompt: Final confirmation with clear warning
- Imported usePurgeServer hook and wired up Purge button
- Section collapsed by default, expands to show deleted servers on click

**Deployment:**
- Version: 06c38364-b6bf-4656-9e9c-17b236980bf6
- URL: https://zedops.mail-bcf.workers.dev

**Files:**
- `task_plan_m98_7.md` - 3-phase implementation plan
- `progress_m98_7.md` - Session log

---

### M9.8.8 - Fix Metrics Auto-Refresh on Agent Overview Page ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** MEDIUM (UX Issue)
**Duration:** ~5 minutes
**Completed:** 2026-01-13

**Issue Resolved:** Metrics now auto-refresh every 5 seconds even when tab not focused:
- Added `refetchIntervalInBackground: true` to useAgents hook ✅
- TanStack Query was pausing refresh when window not focused ✅
- Metrics update continuously now ✅

**Solution:**
- Frontend: Added `refetchIntervalInBackground: true` option to useAgents.ts
- Simple one-line fix: TanStack Query default behavior was to pause polling when tab unfocused
- Now polls every 5 seconds regardless of focus state

**Deployment:**
- Version: c7def356-eb84-47e0-8ae5-2633bbca1d3e
- URL: https://zedops.mail-bcf.workers.dev

**User Feedback:** "ok it works !" ✓

**Files:**
- `planning-history/m9.8.8-metrics-auto-refresh/task_plan.md` - Complete
- `frontend/src/hooks/useAgents.ts` - Modified

---

### M9.8.9 - Fix User Email Display in Sidebar ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** LOW (Display Issue)
**Duration:** ~5 minutes
**Completed:** 2026-01-13

**Issue Resolved:** Sidebar now shows actual user email instead of hardcoded admin@zedops.local:
- Connected Sidebar to UserContext ✅
- Shows dynamic user email (mail@nicomarois.com) ✅
- Shows dynamic role ✅
- Logout button wired up ✅

**Solution:**
- Frontend: Connected Sidebar.tsx to UserContext
- Was hardcoded: "admin" and "admin@zedops.local"
- Now dynamic: `user?.email` and `user?.role`
- Added getUserInitials() function for avatar letter

**Deployment:**
- Version: eba47108-2d6e-4b74-8306-50fc2282708e
- URL: https://zedops.mail-bcf.workers.dev

**User Feedback:** "yep it works !" ✓

**Files:**
- `planning-history/m9.8.9-user-email-display/task_plan.md` - Complete
- `frontend/src/components/layout/Sidebar.tsx` - Modified

---

### M9.8.18 - Fix Button Loading State Propagation ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** LOW (Visual Bug - No Functional Impact)
**Duration:** ~45 minutes (including comprehensive fix)
**Completed:** 2026-01-13

**Issue Resolved:** Button loading states now scoped per-item instead of global:
- Clicking Delete on Server A no longer affects Delete buttons on Server B/C ✅
- Clicking Purge on one server no longer affects other Purge buttons ✅
- Clicking Stop on Container 1 no longer grays out all Stop buttons ✅
- Clicking Delete User no longer affects other Delete buttons ✅
- Clicking Revoke Role no longer affects other Revoke buttons ✅
- All action buttons properly scoped to specific items ✅

**Solution:**
- Frontend: Changed from global `isPending` check to per-item check
- Pattern: `disabled={mutation.isPending && mutation.variables?.itemId === item.id}`
- **Fixed 13 buttons across 4 components:**
  1. **ServerList.tsx** (1): Purge button
  2. **AgentServerList.tsx** (10): Start (x2), Stop, Restart, Delete, Rebuild, Restore, Purge (x3)
  3. **UserList.tsx** (1): Delete user button
  4. **RoleAssignmentsManager.tsx** (1): Revoke role button
- Removed `isOperationPending()` helper function (was checking ALL mutations globally)

**Deployment History:**
1. Initial (server ops): Version 0aa69cb7-856d-4c53-866a-f3e02bcfb100
2. Container ops: Version 7c5738c7-54fd-4aa7-b71c-a8bace8f0da7
3. Final (user/role): Version 5eff9145-128e-4404-933d-0bf1b9e76cbd
- URL: https://zedops.mail-bcf.workers.dev

**Files:**
- `task_plan_m98.md` - 4-phase implementation plan
- `findings_m98.md` - Complete root cause analysis with all discoveries
- `progress_m98.md` - Session log
- `COMPLETE.md` - Full documentation with all 13 fixes

---

### M9.8.19 - Recent Activity Color Coding & Audit Log Formatting ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** MEDIUM (UX Enhancement)
**Duration:** ~2 hours (including ActivityTimeline conversion)
**Completed:** 2026-01-13

**Issue Resolved:** Dashboard Recent Activity and Audit Log now use consistent color coding:
- Created shared audit-colors utility for all 21 action types ✅
- Dashboard Recent Activity: Color-coded actions (not all cyan) ✅
- Audit Log page: Converted to ActivityTimeline format matching Dashboard ✅
- Semantic colors: Green (create), Red (delete), Orange (change), Cyan (info) ✅

**Solution:**
- Frontend: Created `lib/audit-colors.ts` with keyword-based color mapping
- Dashboard: Replaced incomplete actionColorMap with shared utility
- AuditLog: Converted from table to ActivityTimeline component
- Visual consistency achieved across both pages

**Deployment History:**
1. Phase 5: Version c63d9b24-5f11-4b1e-80bd-af7b565182b9
2. Phase 7 (ActivityTimeline): Version 36bd523f-4d4d-404f-a09b-b304205e75c9
3. Bug fix 1 (JSON.parse): Version eb2d177c-6ee4-4450-afe6-dab7275184ae
4. Bug fix 2 (asset sync): Version a7e571e3-8825-48aa-8f6e-86882fb00b8a (FINAL)
- URL: https://zedops.mail-bcf.workers.dev

**User Feedback:** "it works !!" ✓

**Files:**
- `task_plan_m98.md` - 7-phase implementation plan
- `findings_m98.md` - Complete action type analysis
- `progress_m98.md` - Session log
- `frontend/src/lib/audit-colors.ts` - Created
- `frontend/src/pages/Dashboard.tsx` - Modified
- `frontend/src/components/AuditLogViewer.tsx` - Major refactor
- `manager/src/index.ts` - Asset filename sync

---

### M9.8.20 - Server Creation Agent Dropdown on Servers Page ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** MEDIUM (UX Enhancement - Workflow Improvement)
**Duration:** ~1 hour
**Completed:** 2026-01-13

**Issue Resolved:** Servers page now has dropdown to select agent directly (no navigation needed):
- Dropdown shows all agents with status indicators (green/red dots) ✅
- Offline agents disabled with explanation ✅
- Modal auto-opens when agent selected ✅
- Form closes on successful creation ✅
- Workflow: 5+ steps → 2-3 steps ✅

**Solution:**
- Frontend: Added DropdownMenu to ServerList.tsx with agent cards
- Modal integration with ServerForm component
- Edge cases handled: 0 agents, all offline, permissions
- Old flow: Servers → /agents → find agent → click → form
- New flow: Servers → dropdown → select → form

**Deployment:**
- Version: 4a0d3f57-80d5-4707-b46b-0926779f148f
- URL: https://zedops.mail-bcf.workers.dev

**User Feedback:** "it works !" ✓

**Files:**
- `task_plan_m920.md` - 5-phase implementation plan
- `findings_m920.md` - Investigation and design
- `progress_m920.md` - Session log
- `ISSUE-M9.8.20-server-creation-dropdown.md` - Complete spec
- `frontend/src/pages/ServerList.tsx` - Major modification

---

### M9.8.21 - Server Metrics Empty/Not Displaying ✅ VERIFIED
**Status:** ✅ Working (Verified 2026-01-18)
**Priority:** MEDIUM (Bug Fix)

**Issue Reported:**
> "there is the servers metric that should be fixed, they are empty right now"

**Resolution:**
Issue was transient or resolved during M9.8.44 development. Full metrics pipeline verified:
- **Frontend**: `useServerMetrics` hook polls `/api/agents/:id/servers/:serverId/metrics` every 5s
- **Backend**: `agents.ts:2241` forwards request to Durable Object
- **DO**: `AgentConnection.ts:1124` sends `container.metrics` message to agent
- **Agent**: `main.go:309` handles message, calls `CollectContainerMetrics` in `docker.go:394`
- **Display**: MetricsRow component in ServerOverview shows CPU, Memory, Disk I/O, Uptime

Metrics display correctly for running servers in the Overview tab.

---

### M9.8.32 - Separate Image and Tag Fields
**Status:** COMPLETE
**Priority:** HIGH (Bug Fix + Architecture Improvement)
**Duration:** ~2 hours
**Completed:** 2026-01-14

**Bug Fixed:** Rebuild failures with "invalid reference format" error.

**Root Cause:** `agents.ts:1093` stored full image reference in `image_tag` column, causing double-reference when rebuilding (`registry + ":" + "registry:tag"`).

**Solution:**
- Added `image` column to servers table (nullable, for per-server registry override)
- Fixed backend to not overwrite `image_tag` after creation
- Updated all rebuild/apply-config flows to use `server.image || agent.steam_zomboid_registry`
- Added Image Registry field to Configuration edit form

**Database Migration:** `0011_separate_image_tag.sql`

**Files:**
- `planning-history/m9832-separate-image-tag/progress_m9832.md` - Completion details

---

### M9.8.33 - Real-Time Agent Logs
**Status:** COMPLETE
**Priority:** MEDIUM (Feature Enhancement)
**Duration:** ~3 hours
**Completed:** 2026-01-14

**Feature Implemented:** Real-time agent log streaming in the platform UI:
- Agent LogCapture with 1000-line ring buffer
- WebSocket pub/sub for real-time streaming
- DO caching (1000 lines) for offline viewing
- Auto-subscribe on agent connect (no UI dependency)
- Re-subscribe on agent reconnect
- AgentLogViewer component with status indicators
- Logs tab in AgentDetail page

**Key Components:**
- **Agent:** `logcapture.go`, `main.go` (handlers), `reconnect.go` (cleanup)
- **Manager:** `AgentConnection.ts` (routing, caching, auto-subscribe)
- **Frontend:** `AgentLogViewer.tsx`, `useAgentLogStream.ts`, `AgentDetail.tsx`

**Bug Fixes:**
1. Agent cleanup on disconnect (prevents "Already streaming" error)
2. DO flag reset on agent disconnect
3. Re-subscribe logic on agent reconnect
4. Auto-cache on connect (not dependent on UI viewing)

**Deployment:**
- Version: 78e77d3d-ce7a-4979-a8b8-a26aec1fd3a8
- URL: https://zedops.mail-bcf.workers.dev

**User Feedback:** "ok it works" (both live streaming and offline caching verified)

**Files:**
- `planning-history/m9.8.33-agent-logs/M9833-COMPLETE.md` - Completion summary

---

### M9.8.34 - PUID Display Bug Fix
**Status:** COMPLETE
**Priority:** LOW (Bug Fix)
**Duration:** ~15 minutes
**Completed:** 2026-01-15

**Bug Fixed:** Configuration tab showed incorrect PUID value when setting was never set by user.

**Root Causes:**
1. Display fallback was '1000' but actual image default is '1430'
2. Edit form defaulted to '1430' and saved it even without user changes (polluting config)

**Solution:**
- `ConfigurationDisplay.tsx`: Changed fallback from '1000' to '1430'
- `ConfigurationEdit.tsx`: Changed default from '1430' to '' (empty string)
- Now: Unset PUID shows "1430 (image default)", edit form uses placeholder not value

**Files:**
- `planning-history/m9.8.34-puid-display-bug/M9834-COMPLETE.md` - Completion summary

---

### M9.8.35 - Log Viewer Theme Alignment
**Status:** COMPLETE
**Priority:** LOW (UI Polish)
**Duration:** ~20 minutes
**Completed:** 2026-01-15

**Enhancement:** Revamped log viewers to align with midnight blue theme.

**Before:**
- Hardcoded Dracula theme colors with inline styles
- Inconsistent look between log viewers
- Not integrated with theme system

**After:**
- New `TerminalLog` base component using Tailwind/theme CSS variables
- Sleek design with subtle hover effects and depth
- Consistent controls (Pause, Follow, Clear, Search)
- Status indicators with pulsing animation for live streams
- Error highlighting in log entries
- Unified design across container and agent log viewers

**Files Created:**
- `frontend/src/components/ui/terminal-log.tsx` - Base terminal component

**Files Modified:**
- `frontend/src/components/LogViewer.tsx` - Container logs
- `frontend/src/components/AgentLogViewer.tsx` - Agent logs
- `frontend/src/components/layout/MainLayout.tsx` - Added id for scroll tracking

**Additional Feature - Floating Scroll-to-Top Button:**
- Appears when scrolled down 300px+
- Scrolls to top AND disables auto-scroll
- Slick design: dark gradient, blue glow, hover/press animations
- Works on both Agent Logs and Server Logs

**Deployment:**
- Version: 4e9e97d4-99e9-46d7-ad8d-1873ef94d156
- URL: https://zedops.mail-bcf.workers.dev

---

### M9.8.36 - Container Health Visual Feedback ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** MEDIUM (UX Enhancement)
**Duration:** ~2 hours
**Completed:** 2026-01-15

**Feature Implemented:** Visual feedback for container health states during startup:
- **Starting** (health check pending) → Muted purple badge with spinning loader icon
- **Running/Healthy** (health check passed) → Green badge with pulse icon
- **Unhealthy** (health check failed) → Red badge with alert icon
- Containers without health checks show "Running" (green) as before

**Key Changes:**
- **Agent:** `docker.go` - Added `Health` field, `ContainerInspect` calls for health status
- **Manager:** `servers.ts`, `agents.ts` - Merged health status from containers into server responses
- **Frontend:**
  - Added `health?: string` to Container and Server interfaces
  - `getContainerStatusDisplay()` in AgentServerList.tsx
  - `getDisplayStatus()` in server-status.ts handles health states
  - StatusBadge "starting" variant with purple color

**UI Locations Updated:**
- AgentServerList container rows
- ServerDetail overview tab
- ServerList page

**Files:**
- `planning-history/m9.8.36-container-health-visual-feedback/` - Full planning docs

---

## Completion Criteria

M9.8 complete when:
- [x] All critical UX issues resolved
- [x] Server status accurately reflects reality
- [x] No misleading information in UI
- [x] Error states properly handled
- [x] Production testing validates all features
- [x] User approves completion ✓

---

## Notes

- Each sub-milestone uses planning-with-files skill
- One complex task per sub-milestone
- Test thoroughly after each sub-milestone
- Archive planning files after each completion
- Move to M10 only after user approval

---

## Future Enhancements (Post M9.8)

### Agent Disconnect Functionality
**Status:** 📋 Planned (Not Implemented)
**Priority:** LOW
**Current State:** Disconnect button exists in AgentDetail page but is non-functional (no onClick handler)

**Proposed Implementation:**
- Add confirmation dialog: "Are you sure you want to disconnect this agent?"
- Close WebSocket connection from manager side
- Optionally mark agent as manually disconnected (vs connection lost)
- Show appropriate status/messaging after disconnect
- Allow reconnection or require agent restart

**Backend Needs:**
- Manager endpoint to force-disconnect an agent's WebSocket
- Durable Object method to close specific agent connection
- Consider: Should disconnect persist or auto-reconnect on agent side?

**UI Location:** AgentDetail page header (currently has red "Disconnect" button)

---

### Beta Branch Migration / World Reset
**Status:** 📋 Planned (Not Implemented)
**Priority:** MEDIUM
**Discovered:** 2026-01-18 (during M9.8.42 testing)

**Issue:**
When switching a server between stable and unstable (or vice versa), the server fails to start because existing world/save files are incompatible with the new game version.

**Current Behavior:**
- User changes BETABRANCH in Configuration
- Applies config (container recreated with new branch)
- Server fails to start due to incompatible save data

**Proposed Solutions:**
1. **Warning Dialog:** Show warning when changing beta branch that world data may need to be reset
2. **Backup & Reset Option:** Offer to backup current data and start fresh
3. **Auto-Detection:** Detect version mismatch on startup failure and suggest reset
4. **Data Migration:** If possible, provide migration path (likely not feasible due to game limitations)

**User Impact:** Currently requires manual deletion of world files via SSH/file manager

---

### M9.8.37 - Dynamic Disk Metrics ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** MEDIUM (Feature Enhancement)
**Duration:** ~2 hours
**Completed:** 2026-01-15

**Feature Implemented:** Agent disk metrics now show all unique filesystems used by server containers:
- Parses `/proc/mounts` to discover mounted devices
- Inspects ALL bind mounts from ALL ZedOps-managed containers
- Deduplicates by device name (e.g., `/dev/mapper/main--array-petty`)
- Shows mount point as label (e.g., `/Volumes/Petty`, `/Volumes/Data`, `/`)
- Works with any path structure (handles both `servername/bin` and `bin.servername` patterns)

**Key Changes:**
- **Agent:** `metrics.go` - Added `parseMounts()`, `findMountForPath()`, rewrote `collectDiskMetrics()`
- **Frontend:** Updated AgentList.tsx, AgentDetail.tsx, Dashboard.tsx for multi-disk display
- **Backward Compatibility:** Frontend handles both old (single disk) and new (array) formats

**Bug Fixes:**
1. Root mount point `/` not matching paths (fixed prefix check logic)
2. Old naming convention `bin.servername` being skipped (now uses mount-based discovery)

**Files Modified:**
- `agent/metrics.go` - Major refactor
- `frontend/src/components/AgentList.tsx` - Storage section with separator
- `frontend/src/pages/AgentDetail.tsx` - Stacked progress bars
- `frontend/src/pages/Dashboard.tsx` - Compact multi-disk display

**Pending:** UI overflow handling for many storage volumes (see notes below)

---

### M9.8.38 - Server Volume Sizes ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** LOW (Feature Enhancement)
**Duration:** ~3 hours (across multiple sessions)
**Completed:** 2026-01-17

**Feature Implemented:** Display storage consumption for individual server volumes (bin/ and data/ directories).

**What Was Built:**
- **Agent:** `server.volumesizes` message handler with `filepath.Walk` for size calculation
- **Agent:** 5-minute cache to avoid expensive disk scans on every request
- **Manager:** `GET /api/agents/:id/servers/:serverId/storage` endpoint
- **Manager:** DO handler `handleServerStorageRequest` forwarding to agent
- **Frontend:** `useServerStorage` hook with React Query
- **Frontend:** Unified `ServerCard` component with two layout options:
  - Expandable layout: click to expand, shows storage inline
  - Compact layout: hover tooltip for storage details
- **Frontend:** `ServerCardLayoutToggle` for switching layouts (persisted to localStorage)

**Display Locations:**
- ✅ Server cards in AgentServerList (Agent Detail page)
- ✅ Server cards in ServerList (All Servers page)
- ✅ Both layouts show: bin/ size, data/ size, total size

**Bug Fixed During Implementation:**
- `this.sendToAgent is not a function` → Changed to `this.send()` in AgentConnection.ts

**Planning Files:** [planning-history/m9.8.38-server-volume-sizes/](planning-history/m9.8.38-server-volume-sizes/)

---

### M9.8.39 - Audit Logs Revamp ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** LOW (Polish/UX Enhancement)
**Completed:** 2026-01-17

**Implementation:**
Redesigned audit logs from vertical timeline to compact horizontal log lines.

**Features:**
- New `CompactAuditLog` component with grid-based layout
- Lucide icons for actions (play, stop, trash, login, etc.) and targets (server, user, agent)
- Color-coded actions and targets
- User icon next to actor name
- Timestamp on far left for log-style readability
- Full ID resolution: UUIDs resolved to names via servers/users/agents lookup
- Inline expandable details with timestamp and IP address
- Dashboard Recent Activity aligned with same format

**Layout:**
```
[time ago] | [action icon] action | [user icon] actor | [target icon] target | [expand v]
```

**Files:**
- `frontend/src/components/ui/compact-audit-log.tsx` - New component
- `frontend/src/components/AuditLogViewer.tsx` - Updated to use CompactAuditLog
- `frontend/src/pages/Dashboard.tsx` - Recent Activity aligned
- `frontend/src/lib/audit-colors.ts` - Added icon mapping functions

**Planning Files:** [planning-history/m9.8.39-audit-logs-revamp/](planning-history/m9.8.39-audit-logs-revamp/)

---

### M9.8.40 - Segmented Action Buttons ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** LOW (UI Polish)
**Completed:** 2026-01-17

**Implementation:**
Redesigned server action buttons with glass morphism segmented style.

**Updated Components:**
- `ServerDetail.tsx` - Header action buttons (Start/Stop/Restart | Rebuild/Delete)
- `ServerCard.tsx` - Managed server action buttons
- `AgentServerList.tsx` - Unmanaged container buttons + Issues/Recovery buttons

**Design Features:**
- Glass morphism container (`border-white/10 bg-white/5 backdrop-blur-md`)
- Segmented dividers between related actions
- Color-coded text (success/warning/info/destructive)
- Inner glow on hover matching button color
- Loading animations (spin for actions, pulse for stop/delete)

**Planning Files:** [planning-history/m9.8.40-segmented-buttons/](planning-history/m9.8.40-segmented-buttons/)

---

### M9.8.41 - Real-Time Player Count Display ✅ COMPLETE
**Status:** ✅ Deployed (blocker M9.8.42 resolved)
**Priority:** MEDIUM (Feature Enhancement)
**Completed:** 2026-01-18

**Feature Implemented:** Real-time player count display for running servers using RCON polling.

**Architecture:**
```
Agent (playerstats.go)
  └─ Persistent RCON connections per server
  └─ 10-second polling interval
  └─ Sends `players.update` message via WebSocket

Manager (AgentConnection.ts)
  └─ Receives `players.update` messages
  └─ Stores in memory (playerStats Map)
  └─ Exposes via /players endpoint
  └─ Merges into server API responses

Frontend
  └─ ServerCard shows "X/Y players" in info line
  └─ ServerDetail uses real player data
```

**Key Components:**
- **Agent:** `playerstats.go` - PlayerStatsCollector with persistent RCON connections
- **Manager:** `AgentConnection.ts` - Player stats storage and API endpoint
- **Frontend:** `ServerCard.tsx`, `ServerDetail.tsx`, `api.ts` - Display integration

**Bug Fixed:**
- Race condition during shutdown - added mutex lock in `reconnect.go`

**Planning Files:** [planning-history/m9.8.41-player-count/](planning-history/m9.8.41-player-count/)

---

### M9.8.42 - Server Port & Env Var Configuration Fix ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** HIGH (Bug Fix)
**Completed:** 2026-01-18

**Issues Fixed:**

1. **Port env vars not passed to container**
   - `SERVER_DEFAULT_PORT` and `SERVER_UDP_PORT` were not being added to config
   - Only `RCON_PORT` was being added
   - Fixed in 5 locations in `manager/src/routes/agents.ts`:
     - Server create flow
     - Server recreate flow
     - Rebuild route (was only sending containerId, not full config)
     - Apply-config rebuild flow
     - Apply-config auto-recovery flow

2. **BETABRANCH env var name mismatch**
   - Frontend was using `BETA_BRANCH` (with underscore)
   - Docker image expects `BETABRANCH` (no underscore)
   - Fixed in 3 frontend files: ServerForm, ConfigurationDisplay, ConfigurationEdit
   - Migrated existing database configs with SQL REPLACE

**Verified:**
```
SERVER_DEFAULT_PORT=16285 ✅
SERVER_UDP_PORT=16286 ✅
BETABRANCH=unstable ✅
RCON_PORT=27027 ✅
```

**Planning Files:** [planning-history/m9.8.42-port-config-fix/](planning-history/m9.8.42-port-config-fix/)

---

### M9.8.43 - Clickable Players Card ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** LOW (UX Enhancement)
**Completed:** 2026-01-18

**Feature Implemented:** Players card in ServerDetail is now interactive:
- **Hover tooltip** (desktop): Shows compact player list with green status dots
- **Click dialog** (mobile-friendly): Opens full dialog with player avatars and names
- Card shows "Click to view" hint when players are connected

**Files Modified:**
- `frontend/src/pages/ServerDetail.tsx` - Added Dialog and Tooltip for players

---

### M9.8.44 - Server Overview Page Redesign ✅ COMPLETE
**Status:** ✅ Deployed
**Priority:** MEDIUM (UX Enhancement)
**Completed:** 2026-01-18

**Feature Implemented:** Complete redesign of server detail Overview tab with layout switcher.

**Removed:**
- Log Preview section (use Logs tab instead)
- RCON Preview section (use RCON tab instead)

**New Components Created:**
- `MetricsRow` - 5 metric cards with sparkline placeholders
- `ServerInfoCard` - Version, map, mods count, data path
- `ConnectionCard` - Server IP:port with copy button, Steam direct connect
- `HealthIndicators` - Container, RCON, Disk space status dots
- `QuickActions` - Save World, Broadcast, Backup Now, RCON Console buttons
- `RecentEvents` - Server-filtered audit logs (CompactAuditLog style)
- `LayoutSwitcher` - Dropdown to switch between layouts
- `ServerOverview` - Main component orchestrating all above

**Layout Options:**
1. **Grid** - Metrics row, 2-column grid below
2. **Stacked** - Full-width vertical sections
3. **Masonry** - CSS columns with auto-sizing
4. **Sidebar** - Info/health pinned left, main content right (DEFAULT)

**Files Created:**
- `frontend/src/components/server-overview/*.tsx` (9 files)

**Planning Files:** [planning-history/m9.8.44-server-overview-redesign/](planning-history/m9.8.44-server-overview-redesign/)

---

## Placeholder Items - Future Implementation

The following items from M9.8.44 are currently placeholders and need real data/functionality:

### P1: Metrics Sparklines
**Current State:** Visual placeholder bars (faded styling)
**Required Implementation:**
- Store metrics history in D1 database (CPU, Memory, Players per server)
- 3-day retention period with automatic cleanup
- 10-second polling intervals from agent
- Sparkline component rendering last 30 mins in card, expandable to 24h/3d views
- Affected metrics: CPU, Memory, Players (Uptime and Disk I/O don't need sparklines)

**Decision Made:** D1 storage, 3-day retention

---

### P2: Health Indicators - RCON Status
**Current State:** Shows "Unknown" / "Not checked"
**Required Implementation:**
- Periodic RCON ping to verify connectivity
- Store RCON connection status in player stats collector (already has persistent connections)
- Expose RCON health via API endpoint
- Display: Healthy (green), Error (red), Unknown (gray)

---

### P3: Health Indicators - Disk Space
**Current State:** Shows "Unknown"
**Required Implementation:**
- Leverage existing `server.volumesizes` endpoint (M9.8.38)
- Calculate disk usage percentage from server volumes
- Display thresholds: <75% healthy (green), 75-90% warning (orange), >90% error (red)
- May need agent disk quota info for accurate percentage

---

### P4: Quick Actions - Save World
**Current State:** Navigates to RCON tab
**Required Implementation:**
- Direct RCON command execution from button
- Send `save` command via existing RCON infrastructure
- Show loading state and success/error toast
- No RCON tab navigation needed

---

### P5: Quick Actions - Broadcast Message
**Current State:** Navigates to RCON tab
**Required Implementation:**
- Modal dialog to input message
- Send `servermsg "message"` via RCON
- Show loading state and success/error toast
- Character limit validation

---

### P6: Quick Actions - Backup Now
**Current State:** Disabled with "Coming soon" tooltip
**Required Implementation:**
- Backend: Backup API endpoint (agent-side tar/zip of data directory)
- Frontend: Trigger backup, show progress, download link
- Integration with future backup/restore milestone

---

### P7: Connection Card - Server IP ✅ COMPLETE
**Status:** ✅ Deployed
**Completed:** 2026-01-18

**Implementation:**
- Capture agent's public IP from `CF-Connecting-IP` header during WebSocket connection
- Store `public_ip` in agents table (migration 0012)
- Update IP on every agent auth (reconnection)
- Pass through API: agents → servers → frontend → ConnectionCard

**Files Modified:**
- `manager/migrations/0012_add_agent_public_ip.sql` - Added column
- `manager/src/durable-objects/AgentConnection.ts` - Capture IP on connect, store on register/auth
- `manager/src/routes/agents.ts` - Include publicIp in agent responses
- `manager/src/routes/servers.ts` - Include agent_public_ip in server responses
- `frontend/src/lib/api.ts` - Added types
- `frontend/src/components/server-overview/ServerOverview.tsx` - Pass IP to ConnectionCard
- `frontend/src/pages/ServerDetail.tsx` - Pass agentPublicIp prop

---

### Priority Order (Suggested)
1. **P7** - Server IP (simple, high visibility)
2. **P2** - RCON Status (leverages existing infrastructure)
3. **P3** - Disk Space (leverages M9.8.38 endpoint)
4. **P4** - Save World (simple RCON command)
5. **P5** - Broadcast Message (RCON + modal)
6. **P1** - Sparklines (requires D1 schema, agent changes)
7. **P6** - Backup Now (requires full backup infrastructure)
