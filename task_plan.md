# M9 Implementation Plan - Visual Redesign (Implementation Phase)

**Milestone:** M9 - Visual Redesign - Implementation Phase
**Duration:** 22-30 days estimated (2-3 weeks focused work)
**Started:** 2026-01-13
**Status:** 🚧 In Progress

---

## Overview

Implement the complete visual redesign from M8 design specifications. Transform ZedOps from functional UI to professional hypervisor-style infrastructure management tool (Proxmox VE / vSphere quality).

**Design Documents (M8 - Archived):**
- ✅ `DESIGN-SYSTEM.md` - Midnight blue colors, components, log viewer, activity timeline
- ✅ `PAGE-LAYOUTS.md` - 6 complete page layouts with ASCII diagrams
- ✅ `M9-IMPLEMENTATION-GUIDE.md` - 5-phase implementation plan with code examples
- ✅ `findings.md` - User vision and hypervisor UI research

**Reference:** [planning-history/milestone-8-visual-redesign-design/](planning-history/milestone-8-visual-redesign-design/)

---

## Implementation Phases

### Phase 1: Foundation (3-5 days) - IN PROGRESS

**Goal:** Update design system and create core components

**Status:** 🚧 In Progress (85% complete)

**Tasks:**

#### 1.1 Update Color System (1 day) - ✅ COMPLETE
- [x] Update `frontend/src/index.css` with midnight blue CSS variables
- [x] Update `frontend/tailwind.config.js` with semantic colors
- [x] Build test successful
- [ ] Verify WCAG AA contrast ratios (DevTools) - PENDING
- [ ] Test color system on all existing pages - PENDING

**Files Modified:**
- `frontend/src/index.css` - Midnight blue palette applied (#0C1628 background)
- `frontend/tailwind.config.js` - Added error color, cleaned up semantic colors

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 28-83

---

#### 1.2 Create New Components (2-3 days) - ✅ COMPLETE
- [x] Create `StatusBadge` component (text-only variant)
- [x] Create `ActivityTimeline` component (expandable)
- [x] Create `LogViewer` component (Smart Hybrid pattern)
- [x] Create `Separator` component (dependency)
- [ ] Add component tests/stories (optional) - DEFERRED

**Files Created:**
- `frontend/src/components/ui/status-badge.tsx` - 5 variants (success, warning, error, info, muted)
- `frontend/src/components/ui/activity-timeline.tsx` - Expandable timeline with inline cards
- `frontend/src/components/ui/log-viewer.tsx` - Smart Hybrid pattern (compact + auto-expanded errors)
- `frontend/src/components/ui/separator.tsx` - Horizontal/vertical separator

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 86-323

---

#### 1.3 Test Design System (1 day) - PENDING
- [x] Build test passed
- [ ] WCAG AA contrast verified (browser DevTools)
- [ ] StatusBadge tested in existing pages
- [ ] ActivityTimeline tested with sample data
- [ ] LogViewer tested with sample logs
- [ ] All shadcn components styled correctly with new theme
- [ ] Visual inspection of midnight blue theme in browser

---

### Phase 2: Navigation & Layout (4-5 days) - READY TO START

**Goal:** Implement sidebar navigation and global layout

**Status:** ⏳ Pending

**Tasks:**

#### 2.1 Sidebar Navigation (2 days)
- [ ] Create `Sidebar.tsx` component
  - [ ] Logo section
  - [ ] Navigation sections (Infrastructure, Management)
  - [ ] Active state styling
  - [ ] User menu at bottom
- [ ] Create `SectionHeader` component
- [ ] Create `NavLink` component with active state
- [ ] Test navigation links (React Router)

**Files to Create:**
- `frontend/src/components/layout/Sidebar.tsx`

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 343-493

---

#### 2.2 Main Layout (1 day)
- [ ] Create `MainLayout.tsx` with sidebar + content area
- [ ] Update `App.tsx` with new route structure
- [ ] Test layout with existing pages
- [ ] Verify overflow handling

**Files to Create:**
- `frontend/src/components/layout/MainLayout.tsx`

**Files to Modify:**
- `frontend/src/App.tsx` - New route structure

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 504-552

---

#### 2.3 Breadcrumb Component (1 day)
- [ ] Create `Breadcrumb.tsx` component
- [ ] Test breadcrumb links
- [ ] Integrate with all pages

**Files to Create:**
- `frontend/src/components/layout/Breadcrumb.tsx`

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 556-598

---

### Phase 3: Dashboard & Lists (5-6 days) - PENDING

**Goal:** Implement Dashboard, Agent List, Server List pages

**Status:** ⏳ Pending

**Dependencies:** Phase 2 complete

**Tasks:**

#### 3.1 Dashboard Page (2-3 days)
- [ ] Create `Dashboard.tsx` page
- [ ] Implement stats cards (4 cards: Agents, Servers, Users, Players)
- [ ] Agent status table (condensed, top 5)
- [ ] Activity timeline (last 5-10 events)
- [ ] Quick actions bar
- [ ] Responsive grid (1/2/4 columns)

**Files to Create:**
- `frontend/src/pages/Dashboard.tsx`

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 606-619, PAGE-LAYOUTS.md lines 67-129

---

#### 3.2 Enhanced Agent List (1-2 days)
- [ ] Update `AgentList.tsx` with filters (status, search)
- [ ] Make table rows clickable (navigate to Agent Detail)
- [ ] Add hover effects
- [ ] Add [+ Add Agent] button
- [ ] Keep existing table structure

**Files to Modify:**
- `frontend/src/pages/AgentList.tsx`

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 623-632, PAGE-LAYOUTS.md lines 166-210

---

#### 3.3 Enhanced Server List (1-2 days)
- [ ] Create global `ServerList.tsx` (all servers across agents)
- [ ] Add filters (agent, status, search)
- [ ] Add pagination
- [ ] Make rows clickable → Server Detail
- [ ] Add actions menu

**Files to Create:**
- `frontend/src/pages/ServerList.tsx` (new global view)

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 634-644, PAGE-LAYOUTS.md lines 317-355

---

### Phase 4: Detail Pages (7-10 days) - PENDING

**Goal:** Implement Agent Detail and Server Detail pages with tabs

**Status:** ⏳ Pending

**Dependencies:** Phase 3 complete

**Tasks:**

#### 4.1 Agent Detail Page (3-4 days)
- [ ] Create `AgentDetail.tsx` page with 3 tabs
- [ ] **Overview Tab:**
  - [ ] Host metrics cards (CPU, memory, disk)
  - [ ] Server list table (condensed)
  - [ ] [+ Create Server] button
- [ ] **Servers Tab:**
  - [ ] Full server list for agent
  - [ ] Filters and pagination
- [ ] **Configuration Tab (optional/future):**
  - [ ] Agent settings placeholder
- [ ] Actions bar (Restart, Configure, Disconnect)
- [ ] Breadcrumb navigation

**Files to Create:**
- `frontend/src/pages/AgentDetail.tsx`

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 649-688, PAGE-LAYOUTS.md lines 212-276

---

#### 4.2 Server Detail Page (4-6 days) - THE CROWN JEWEL
- [ ] Create `ServerDetail.tsx` page with 6 tabs
- [ ] **Overview Tab (2 days):**
  - [ ] Server metrics cards (5 cards)
  - [ ] Log preview panel (collapsible, use LogViewer)
  - [ ] RCON preview panel (collapsible)
  - [ ] Quick actions bar
  - [ ] [Expand View] buttons → Navigate to tabs
- [ ] **Logs Tab (1 day):**
  - [ ] Full-screen LogViewer component
  - [ ] Controls (pause, clear, download, filters)
- [ ] **RCON Tab (1 day):**
  - [ ] Embed existing RconTerminal component
  - [ ] Quick actions bar
- [ ] **Configuration Tab (1-2 days - NICE TO HAVE):**
  - [ ] Docker ENV editor form
  - [ ] Port conflict detection
  - [ ] Sub-tabs: Docker ENV, Server INI (future), Mods (future)
- [ ] **Performance Tab (placeholder/future):**
  - [ ] Graphs (24h metrics)
- [ ] **Backups Tab (placeholder/future):**
  - [ ] Backup list and controls

**Files to Create:**
- `frontend/src/pages/ServerDetail.tsx`

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 690-730, PAGE-LAYOUTS.md lines 358-623

---

### Phase 5: Polish & Testing (3-4 days) - PENDING

**Goal:** Responsive behavior, animations, bug fixes

**Status:** ⏳ Pending

**Dependencies:** Phase 4 complete

**Tasks:**

#### 5.1 Responsive Behavior (2 days)
- [ ] **Mobile (<768px):**
  - [ ] Sidebar: Hamburger menu + overlay drawer
  - [ ] Tables: Convert to stacked cards
  - [ ] Stats: 1 column layout
  - [ ] Preview panels: Full-screen modal
- [ ] **Tablet (768-1024px):**
  - [ ] Sidebar: Icon-only, expandable
  - [ ] Tables: Hide some columns
  - [ ] Stats: 2 columns
- [ ] **Desktop (>1024px):**
  - [ ] Full layout as designed

**Files to Modify:**
- All layout components (Sidebar, tables, Dashboard)

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 737-757, PAGE-LAYOUTS.md lines 670-719

---

#### 5.2 Animations & Transitions (1 day)
- [ ] Tab transitions (fade in/out)
- [ ] Preview panel expand/collapse
- [ ] Sidebar mobile drawer (slide in/out)
- [ ] Table row hover effects
- [ ] Apply Tailwind transition classes

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 759-772

---

#### 5.3 Testing & Bug Fixes (1-2 days)
- [ ] All pages render correctly
- [ ] Navigation works (all routes)
- [ ] Breadcrumbs update correctly
- [ ] Tabs work (all detail pages)
- [ ] Preview panels expand/collapse
- [ ] Filters work (lists)
- [ ] Search works
- [ ] Responsive behavior (mobile, tablet, desktop)
- [ ] Colors correct (midnight blue theme)
- [ ] WCAG AA compliance verified
- [ ] No console errors
- [ ] Performance acceptable (no lag)

**Reference:** M9-IMPLEMENTATION-GUIDE.md lines 775-790

---

## Implementation Priority

### MUST HAVE (M9 Core) - 11 items
1. ✅ Color system update
2. ✅ New components (StatusBadge, ActivityTimeline, LogViewer)
3. ✅ Sidebar navigation
4. ✅ Main layout
5. ✅ Breadcrumb component
6. ✅ Dashboard page
7. ✅ Enhanced Agent List
8. ✅ Enhanced Server List
9. ✅ Agent Detail (Overview + Servers tabs)
10. ✅ Server Detail (Overview + Logs + RCON tabs)
11. ✅ Basic responsive (mobile sidebar)

### NICE TO HAVE (M9 Polish) - 4 items
12. ⭐ Agent Detail: Configuration tab
13. ⭐ Server Detail: Configuration tab (Docker ENV editor)
14. ⭐ Full responsive testing (tablet breakpoints)
15. ⭐ Animation polish

### FUTURE (M10+) - 4 items
16. ⏭️ Server Detail: Performance tab (needs metrics collection)
17. ⏭️ Server Detail: Backups tab (needs backup feature)
18. ⏭️ Server Detail: Configuration > Server INI sub-tab (needs parser)
19. ⏭️ Historical metrics graphs (needs time-series storage)

---

## Success Criteria

**M9 Complete When:**
- [ ] All MUST HAVE items implemented
- [ ] All pages render with midnight blue theme
- [ ] Navigation works (sidebar, breadcrumbs, links)
- [ ] Dashboard shows stats, agents, activity
- [ ] Agent Detail has 2-3 tabs working
- [ ] Server Detail has 3-4 tabs working (Overview, Logs, RCON, Config)
- [ ] Preview panels collapse/expand correctly
- [ ] Mobile sidebar works (hamburger menu)
- [ ] No visual regressions from M7.5
- [ ] WCAG AA compliance maintained
- [ ] Deployed to production
- [ ] User approval ✓

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| *(none yet)* | - | - |

---

## Notes

- **Design artifacts reference:** All design specs in `planning-history/milestone-8-visual-redesign-design/`
- **Component reuse:** Leverage existing shadcn/ui components from M7.5
- **Incremental testing:** Test each page/component as implemented (don't wait until end)
- **User vision:** Professional hypervisor-style UI (Proxmox VE / vSphere pattern)
- **Color palette:** Midnight blue (#0C1628 background, pronounced blue not black)
- **Status badges:** Text-only (no filled backgrounds) for clean aesthetic

---

## Timeline Estimate

| Phase | Days | Status |
|-------|------|--------|
| Phase 1: Foundation | 3-5 | ⏳ Pending |
| Phase 2: Navigation & Layout | 4-5 | ⏳ Pending |
| Phase 3: Dashboard & Lists | 5-6 | ⏳ Pending |
| Phase 4: Detail Pages | 7-10 | ⏳ Pending |
| Phase 5: Polish & Testing | 3-4 | ⏳ Pending |
| **Total** | **22-30** | **2-3 weeks focused** |

**Started:** 2026-01-13
**Target Completion:** 2026-02-04 to 2026-02-12 (3-4 weeks)

---

## Quick Reference

**Key Files to Create:**
- `frontend/src/components/ui/status-badge.tsx`
- `frontend/src/components/ui/activity-timeline.tsx`
- `frontend/src/components/ui/log-viewer.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/components/layout/Breadcrumb.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/ServerList.tsx` (global view)
- `frontend/src/pages/AgentDetail.tsx`
- `frontend/src/pages/ServerDetail.tsx`

**Key Files to Modify:**
- `frontend/src/index.css` - Color system
- `frontend/src/App.tsx` - Route structure
- `frontend/src/pages/AgentList.tsx` - Enhancements

**Design References:**
- Color system: `DESIGN-SYSTEM.md` lines 8-76
- Components: `DESIGN-SYSTEM.md` lines 86-543
- Page layouts: `PAGE-LAYOUTS.md` (all)
- Implementation guide: `M9-IMPLEMENTATION-GUIDE.md` (complete plan)
