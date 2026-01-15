# Milestone 9.8 - Polish & Production Readiness

**Parent Milestone:** M9.8
**Started:** 2026-01-13
**Status:** 🚧 In Progress

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

### M9.8.21 - Server Metrics Empty/Not Displaying
**Status:** 📋 Not Started
**Priority:** MEDIUM (Bug Fix)

**Issue Reported:**
> "there is the servers metric that should be fixed, they are empty right now"

**Investigation Needed:**
- Identify where server metrics are displayed
- Check if metrics are being collected by agent
- Check if metrics are being sent to manager
- Check frontend rendering of metrics
- Determine root cause (collection, transmission, or display)

**Files:**
- `ISSUE-M9.8.21-server-metrics-empty.md` - Created

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

## Completion Criteria

M9.8 complete when:
- [ ] All critical UX issues resolved
- [ ] Server status accurately reflects reality
- [ ] No misleading information in UI
- [ ] Error states properly handled
- [ ] Production testing validates all features
- [ ] User approves completion ✓

---

## Notes

- Each sub-milestone uses planning-with-files skill
- One complex task per sub-milestone
- Test thoroughly after each sub-milestone
- Archive planning files after each completion
- Move to M10 only after user approval

---

## Future Enhancements (Post M9.8)

### M9.8.32 - Separate Image and Tag Fields (Database Schema Refactor)
**Status:** 📋 Planned (Not Implemented)
**Priority:** HIGH (Bug Fix + Architecture Improvement)
**Origin:** User suggestion during M9.8.30 (see progress_m9830.md line 452)

**Current Problem (Bug Discovered 2026-01-14):**
The `image_tag` field gets overwritten with the full resolved image name after server creation (e.g., `registry.gitlab.../steam-zomboid:latest` instead of just `latest`). This causes rebuild failures with "invalid reference format" because the code constructs: `registry + ":" + image_tag` → invalid double reference.

**Root Cause:** `agents.ts:1093` stores `result.imageName` (full reference) in `image_tag` column.

**Proposed Architecture:**
- **`image` field:** Full image path without tag (e.g., `registry.gitlab.nicomarois.com/nicolas/steam-zomboid`)
- **`tag` field:** Just the tag portion (e.g., `latest`, `v2.1.0`, `build42`)
- Construct full reference when needed: `${image}:${tag}`

**Benefits:**
- Clear separation of concerns
- No ambiguity about what each field contains
- Easy to change tags without touching image path
- Consistent with Docker's own terminology
- Per-server image override (different servers can use different registries)
- Fixes the current bug permanently

**Schema Migration:**
```sql
-- Add new columns
ALTER TABLE servers ADD COLUMN image TEXT;
ALTER TABLE servers ADD COLUMN tag TEXT DEFAULT 'latest';

-- Migrate data: Split existing image_tag into image and tag
UPDATE servers SET
  image = SUBSTR(image_tag, 1, INSTR(image_tag, ':') - 1),
  tag = SUBSTR(image_tag, INSTR(image_tag, ':') + 1)
WHERE image_tag LIKE '%:%';

-- For servers with just a tag (no colon), use agent's registry
UPDATE servers SET
  image = (SELECT steam_zomboid_registry FROM agents WHERE agents.id = servers.agent_id),
  tag = image_tag
WHERE image_tag NOT LIKE '%:%';

-- Drop old column after verification
-- ALTER TABLE servers DROP COLUMN image_tag;
```

**Files to Modify:**
- `manager/migrations/` - New migration file
- `manager/src/routes/agents.ts` - Update all server queries/inserts
- `frontend/src/components/ConfigurationEdit.tsx` - Add image field (optional override)
- `agent/main.go` - Use image + tag from message

**Estimated Time:** 3-4 hours

**Workaround (Until Fixed):**
```sql
UPDATE servers SET image_tag = 'latest' WHERE image_tag LIKE '%:%';
```

---

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
