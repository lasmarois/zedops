# M9.6 Investigation Plan - UI/UX Consistency Audit

**Milestone:** M9.6 - Investigate Post-M9.5 Inconsistencies
**Duration:** 1-2 hours estimated
**Started:** 2026-01-13
**Completed:** 2026-01-13
**Status:** ✅ Investigation Complete

---

## Overview

After completing M9.5 (bridging design to functionality), we need to identify and document all remaining inconsistencies in the UI/UX. This milestone focuses on investigation only - implementation will happen in M9.7.

---

## Investigation Goals

1. **Navigation Inconsistencies** - Find places where similar actions have different navigation patterns
2. **Component Naming** - Identify misnamed components (e.g., "ContainerList" that shows servers)
3. **UI Pattern Inconsistencies** - Compare how different pages display similar data
4. **Missing Features** - Find features available in one view but not another
5. **Visual Inconsistencies** - Identify styling/layout differences that should be unified

---

## Known Issues (User-Reported)

### Issue 1: Agent's Server List Cannot Navigate to ServerDetail
**Location:** `frontend/src/components/ContainerList.tsx`
**Problem:**
- When viewing servers from AgentDetail page, table rows are NOT clickable
- Only action buttons available (Start, Stop, Delete, etc.)
- Cannot navigate to ServerDetail page to see logs/RCON/metrics

**Comparison:**
- **ServerList.tsx (Global):** Cards are clickable → navigates to `/servers/:id` ✅
- **ContainerList.tsx (Agent):** Table rows NOT clickable → no navigation ❌

**Expected:** Clicking a server row should navigate to ServerDetail, same as global list

---

### Issue 2: Component Misnamed "ContainerList"
**Location:** `frontend/src/components/ContainerList.tsx`
**Problem:**
- Component is called "ContainerList" but it shows SERVERS, not containers
- Shows server data from D1 database (servers table)
- Has two sections: "Containers" (from Docker) and "Servers" (from database)
- Confusing naming for developers and maintenance

**Expected:** Component should be renamed to reflect its actual purpose (shows servers)

**Proposed Names:**
- `ServerList` (conflicts with page name)
- `AgentServerList` (shows servers for specific agent)
- `ServerListTable` (table-based server list vs card-based)
- `ServerManager` (shows + manages servers for agent)

---

## Investigation Areas

### Area 1: Navigation Patterns ✅ Complete
**Goal:** Document all ways users navigate between pages

**Questions:**
- [x] How do you get to ServerDetail from each page?
- [x] Are navigation patterns consistent across similar views?
- [x] Can you always "drill down" to detailed view?
- [x] Are there dead ends where you can't navigate deeper?

**Pages to Check:**
- [x] Dashboard → ServerDetail (via agents, not directly)
- [x] ServerList (global) → ServerDetail ✅ Works
- [x] AgentDetail → ServerDetail ❌ Broken (Finding #1)
- [x] Agents → AgentDetail ✅ Works
- [x] Servers tab in AgentDetail ❌ Broken (Finding #1)

---

### Area 2: Component Naming ✅ Complete
**Goal:** Find all misnamed or confusing component/variable names

**Questions:**
- [x] Do component names match their actual purpose?
- [x] Are prop names clear and consistent?
- [x] Are variable names aligned with M9.5 changes (servers vs containers)?

**Files to Check:**
- [x] ContainerList.tsx - Shows servers, not just containers ❌ (Finding #2)
- [x] ContainerList props - Do they reference containers or servers?
- [x] Hook names - useContainers vs useServers ✅ Both exist
- [x] API response types - Container vs Server ✅ Separate types

---

### Area 3: Visual Design Consistency ✅ Complete
**Goal:** Compare visual patterns across similar views

**Questions:**
- [x] Do all server lists use the same visual pattern? ❌ No (Finding #3)
- [x] Are status badges consistent everywhere? ✅ Mostly consistent
- [x] Do action buttons appear in the same order/style? ❌ No (Finding #5)
- [x] Are loading states consistent? ✅ Yes (Skeleton components)

**Patterns to Compare:**
- [x] ServerList (cards) vs ContainerList (table) ❌ Different (Finding #3)
- [x] Status badges across all pages ✅ Consistent
- [x] Action button groups ❌ Different order (Finding #5)
- [x] Empty states ✅ Consistent
- [x] Error states ✅ Consistent
- [x] Loading skeletons ✅ Consistent

---

### Area 4: Feature Parity ✅ Complete
**Goal:** Ensure features available in one view exist in similar views

**Questions:**
- [x] Can you perform the same actions from both server lists? ⚠️ Partial
- [x] Are all server states visible in both views? ✅ Yes
- [x] Can you access logs/RCON from both paths? ❌ Only from ServerDetail

**Features to Compare:**
- [x] Start/Stop/Restart actions ✅ Available in agent view
- [x] Delete/Purge actions ✅ Available in agent view
- [x] Rebuild action ✅ Available in agent view
- [x] View Logs ❌ Need to navigate to ServerDetail (Finding #1)
- [x] View RCON ❌ Need to navigate to ServerDetail (Finding #1)
- [x] Server creation ✅ Available in both contexts
- [x] Status filtering ❌ Only in global ServerList (Finding #7)
- [x] Search functionality ❌ Only in global ServerList (Finding #7)

---

### Area 5: Data Consistency ✅ Complete
**Goal:** Verify data shown is consistent across views

**Questions:**
- [x] Does the same server show the same data in different views? ✅ Yes
- [x] Are status indicators consistent? ✅ Yes
- [x] Do port numbers match everywhere? ⚠️ Display format differs (Finding #4)
- [x] Are timestamps formatted consistently? ✅ Yes

**Data to Compare:**
- [x] Server status (running/stopped/failed) ✅ Consistent
- [x] Port numbers (game/UDP/RCON) ⚠️ Format differs (Finding #4)
- [x] Agent names ✅ Consistent
- [x] Created dates ✅ Consistent
- [x] Last updated times ✅ Consistent

---

## Investigation Methodology

### Step 1: Manual UI Walkthrough
1. Start at Dashboard
2. Navigate through all possible paths to ServerDetail
3. Document each path and its characteristics
4. Note any missing navigation options

### Step 2: Code Review
1. Read all server-related components
2. Compare similar components side-by-side
3. Document naming inconsistencies
4. Identify code duplication opportunities

### Step 3: Visual Comparison
1. Take screenshots of each server view
2. Compare layouts, colors, spacing
3. Document differences
4. Propose unified design

### Step 4: Feature Matrix
1. Create table of all features
2. Mark which views have which features
3. Identify gaps
4. Prioritize missing features

---

## Findings Log

### Finding 1: Navigation Inconsistency ✅ CONFIRMED
**Issue:** ContainerList table rows not clickable
**Impact:** Users cannot navigate to ServerDetail from agent view
**Severity:** High - breaks expected UX pattern
**File:** `frontend/src/components/ContainerList.tsx`
**Line:** 812 (TableRow has no onClick)
**Fix Needed:** Add onClick to TableRow to navigate to `/servers/${server.id}`

---

### Finding 2: Component Naming Issue ✅ CONFIRMED
**Issue:** ContainerList is misnamed
**Impact:** Developer confusion, maintenance difficulty
**Severity:** Medium - technical debt
**File:** `frontend/src/components/ContainerList.tsx`
**Imports:** Used in AgentDetail.tsx (lines 10, 214, 227)
**Fix Needed:** Rename component + update all imports

---

### Finding 3: Visual Design Inconsistency ✅ CONFIRMED
**Issue:** Global ServerList uses Cards, Agent ServerList uses Table
**Impact:** Inconsistent UX, users have to relearn interface
**Severity:** Medium - UX consistency
**Files:**
- `ServerList.tsx` lines 118-161 (Cards)
- `ContainerList.tsx` lines 800-962 (Table)
**Question:** Should we unify on Cards or Tables? Or keep both for different contexts?

---

### Finding 4: TBD
*(More findings to be added during investigation)*

---

## Success Criteria

M9.6 Complete When:
- [x] All navigation paths documented
- [x] All naming inconsistencies identified
- [x] Visual design differences cataloged
- [x] Feature parity gaps listed
- [x] Data consistency verified
- [x] Prioritized list of issues created for M9.7
- [x] Findings documented in findings_m96.md
- [x] M9.7 implementation plan created

---

## Deliverables

1. ✅ **findings_m96.md** - Detailed findings with code examples (8 findings documented)
2. ✅ **task_plan_m97.md** - Implementation plan for M9.7 with 3 phases
3. ✅ **progress_m96.md** - Investigation progress log
4. ✅ **Issue priority list** - High/Medium/Low/Deferred (see findings_m96.md)

---

## Notes

- Focus on INVESTIGATION only - no implementation
- Document everything, even minor issues
- Take screenshots for visual comparisons
- Propose solutions but don't implement yet
- Consider backward compatibility when proposing changes
