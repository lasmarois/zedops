# M9 Implementation Guide - Visual Redesign

**Version:** M8 Design Complete → M9 Implementation Ready
**Date:** 2026-01-12

---

## Overview

This guide provides a phased implementation plan for M9 (Visual Redesign - Implementation Phase) based on the complete design specifications from M8.

**Design Documents:**
- ✅ `DESIGN-SYSTEM.md` - Colors, typography, components
- ✅ `PAGE-LAYOUTS.md` - Complete page specifications
- ✅ `findings.md` - User vision and requirements
- ✅ `progress.md` - Design process documentation

**Estimated Duration:** 2-3 weeks (M9)

---

## Implementation Phases

### Phase 1: Foundation (3-5 days)

**Goal:** Update design system and core components

#### 1.1 Update Color System (1 day)

**File:** `frontend/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Midnight Blue Theme */
    --background: 220 45% 12%;        /* #0C1628 */
    --foreground: 210 40% 98%;        /* #F8FAFC */

    --card: 220 40% 16%;              /* #151F33 */
    --card-foreground: 210 40% 98%;

    --popover: 220 40% 16%;
    --popover-foreground: 210 40% 98%;

    --primary: 217 91% 60%;           /* #3B82F6 */
    --primary-foreground: 220 45% 12%;

    --secondary: 217 32% 20%;         /* #1F2937 */
    --secondary-foreground: 210 40% 98%;

    --muted: 217 32% 18%;             /* #1A2332 */
    --muted-foreground: 215 20% 70%;  /* #9CA3AF */

    --accent: 217 32% 20%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 84% 60%;         /* #DC2626 */
    --destructive-foreground: 210 40% 98%;

    --border: 217 32% 30%;            /* #374151 */
    --input: 217 32% 30%;
    --ring: 217 91% 60%;

    /* Semantic Colors */
    --success: 142 76% 60%;           /* #34D399 */
    --warning: 38 92% 60%;            /* #FBBF24 */
    --error: 0 84% 65%;               /* #EF4444 */
    --info: 199 89% 60%;              /* #22D3EE */

    --radius: 0.5rem;
  }
}
```

**Testing:**
- Verify all shadcn components render correctly
- Test color contrast with browser DevTools
- Check all status badges (success, warning, error, info)

---

#### 1.2 Create New Components (2-3 days)

**New Component 1: StatusBadge (text-only)**

**File:** `frontend/src/components/ui/status-badge.tsx`

```tsx
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  variant: "success" | "warning" | "error" | "info" | "muted"
  children: React.ReactNode
  className?: string
}

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "text-sm font-medium",
        {
          "text-success": variant === "success",
          "text-warning": variant === "warning",
          "text-error": variant === "error",
          "text-info": variant === "info",
          "text-muted-foreground": variant === "muted",
        },
        className
      )}
    >
      {children}
    </span>
  )
}

// Usage:
// <StatusBadge variant="success">🟢 Online</StatusBadge>
// <StatusBadge variant="error">🔴 Offline</StatusBadge>
```

---

**New Component 2: ActivityTimeline (expandable)**

**File:** `frontend/src/components/ui/activity-timeline.tsx`

```tsx
import { useState } from "react"
import { Button } from "./button"
import { Card, CardContent } from "./card"
import { Separator } from "./separator"

interface ActivityEvent {
  id: string
  timestamp: string
  user: string
  action: string
  target: string
  actionColor: "success" | "warning" | "error" | "info" | "muted"
  details?: Record<string, string>
}

interface ActivityTimelineProps {
  events: ActivityEvent[]
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id}>
          <div className="flex items-start gap-3">
            {/* Timeline dot */}
            <div className={cn(
              "mt-1.5 h-2 w-2 rounded-full",
              event.actionColor === "success" && "bg-success",
              event.actionColor === "warning" && "bg-warning",
              event.actionColor === "error" && "bg-error",
              event.actionColor === "info" && "bg-info",
              event.actionColor === "muted" && "bg-muted-foreground"
            )} />

            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">{event.timestamp}</div>
              <div className="text-sm">
                <span className="text-primary font-medium">{event.user}</span>
                {" "}
                <span className={cn(
                  event.actionColor === "success" && "text-success",
                  event.actionColor === "warning" && "text-warning",
                  event.actionColor === "error" && "text-error",
                  event.actionColor === "info" && "text-info",
                  event.actionColor === "muted" && "text-muted-foreground"
                )}>{event.action}</span>
                {" "}
                {event.target}
              </div>

              {/* Expanded details */}
              {expanded === event.id && event.details && (
                <Card className="mt-3 bg-muted">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-semibold mb-3">Event Details</h4>
                    <dl className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-sm">
                      {Object.entries(event.details).map(([key, value]) => (
                        <>
                          <dt className="text-muted-foreground">{key}:</dt>
                          <dd>{value}</dd>
                        </>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              )}
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setExpanded(expanded === event.id ? null : event.id)}
            >
              {expanded === event.id ? "Collapse ▲" : "Details ▼"}
            </Button>
          </div>

          <Separator className="my-4 opacity-30" />
        </div>
      ))}
    </div>
  )
}
```

---

**New Component 3: LogViewer (Smart Hybrid)**

**File:** `frontend/src/components/ui/log-viewer.tsx`

```tsx
import { Card, CardContent } from "./card"
import { Button } from "./button"

interface LogEntry {
  timestamp: string
  level: "INFO" | "DEBUG" | "WARN" | "ERROR"
  message: string
  details?: {
    stackTrace?: string
    context?: Record<string, string>
  }
}

interface LogViewerProps {
  logs: LogEntry[]
}

export function LogViewer({ logs }: LogViewerProps) {
  return (
    <div className="font-mono text-sm space-y-1">
      {logs.map((log, i) => {
        // Normal logs: compact terminal style
        if (log.level === "INFO" || log.level === "DEBUG") {
          return (
            <div key={i} className="text-muted-foreground">
              <span className="text-muted-foreground">[{log.timestamp}]</span>
              {" "}
              <span className={log.level === "DEBUG" ? "text-info" : ""}>
                [{log.level}]
              </span>
              {" "}
              {log.message}
            </div>
          )
        }

        // Warnings: highlighted line
        if (log.level === "WARN") {
          return (
            <div key={i} className="text-warning">
              <span className="text-muted-foreground">[{log.timestamp}]</span>
              {" "}
              <span>[WARN]</span>
              {" "}
              {log.message}
            </div>
          )
        }

        // Errors: auto-expanded card
        return (
          <Card key={i} className="bg-muted border-error/20 my-2">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-muted-foreground">[{log.timestamp}]</span>
                  {" "}
                  <span className="text-error font-semibold">[ERROR]</span>
                  {" "}
                  {log.message}
                </div>
                <Button size="sm" variant="ghost">Collapse ▲</Button>
              </div>

              {log.details && (
                <div className="mt-3 space-y-2 text-sm">
                  {log.details.context && (
                    <>
                      <div className="text-muted-foreground">Details:</div>
                      <ul className="space-y-1 ml-4">
                        {Object.entries(log.details.context).map(([key, value]) => (
                          <li key={key}>• {key}: {value}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {log.details.stackTrace && (
                    <>
                      <div className="text-muted-foreground mt-3">Stack trace:</div>
                      <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
                        {log.details.stackTrace}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
```

---

#### 1.3 Test Design System (1 day)

**Checklist:**
- [ ] All colors render correctly
- [ ] WCAG AA contrast verified (browser DevTools)
- [ ] StatusBadge component works (all variants)
- [ ] ActivityTimeline component works (expandable)
- [ ] LogViewer component works (Smart Hybrid pattern)
- [ ] All shadcn components styled correctly

---

### Phase 2: Navigation & Layout (4-5 days)

**Goal:** Implement sidebar navigation and global layout

#### 2.1 Sidebar Navigation (2 days)

**File:** `frontend/src/components/layout/Sidebar.tsx` (NEW)

```tsx
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Server,
  Laptop,
  Users,
  Shield,
  FileText,
  LayoutDashboard,
  Settings,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
}

const infrastructureItems: NavItem[] = [
  { label: "Agents", href: "/agents", icon: Laptop, count: 5 },
  { label: "Servers", href: "/servers", icon: Server, count: 128 },
]

const managementItems: NavItem[] = [
  { label: "Users", href: "/users", icon: Users, count: 12 },
  { label: "Permissions", href: "/permissions", icon: Shield },
  { label: "Audit Logs", href: "/audit-logs", icon: FileText },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <div className="flex flex-col h-full w-60 bg-background border-r border-border">
      {/* Logo */}
      <div className="p-6">
        <h1 className="text-xl font-bold">ZedOps</h1>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6">
        {/* Dashboard */}
        <div>
          <NavLink
            href="/dashboard"
            icon={LayoutDashboard}
            label="Dashboard"
            active={location.pathname === "/dashboard"}
          />
        </div>

        {/* Infrastructure */}
        <div>
          <SectionHeader>Infrastructure</SectionHeader>
          <div className="space-y-1">
            {infrastructureItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                count={item.count}
                active={location.pathname.startsWith(item.href)}
              />
            ))}
          </div>
        </div>

        {/* Management */}
        <div>
          <SectionHeader>Management</SectionHeader>
          <div className="space-y-1">
            {managementItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                count={item.count}
                active={location.pathname.startsWith(item.href)}
              />
            ))}
          </div>
        </div>
      </nav>

      <Separator />

      {/* User Menu */}
      <div className="p-4">
        <div className="text-sm text-muted-foreground mb-2">admin@zedops.local</div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost">
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {children}
    </div>
  )
}

interface NavLinkProps {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  active?: boolean
}

function NavLink({ href, icon: Icon, label, count, active }: NavLinkProps) {
  return (
    <Link
      to={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
        active
          ? "bg-muted border-l-2 border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </Link>
  )
}
```

**Testing:**
- [ ] Sidebar renders with all navigation items
- [ ] Active state styling works
- [ ] Navigation links work (React Router)
- [ ] Section headers styled correctly
- [ ] User menu displays

---

#### 2.2 Main Layout (1 day)

**File:** `frontend/src/components/layout/MainLayout.tsx` (NEW)

```tsx
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"

export function MainLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

**Update:** `frontend/src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { MainLayout } from "./components/layout/MainLayout"
import { Dashboard } from "./pages/Dashboard"
import { AgentList } from "./pages/AgentList"
import { AgentDetail } from "./pages/AgentDetail"
import { ServerList } from "./pages/ServerList"
import { ServerDetail } from "./pages/ServerDetail"
// ... other imports

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="agents" element={<AgentList />} />
          <Route path="agents/:id" element={<AgentDetail />} />
          <Route path="servers" element={<ServerList />} />
          <Route path="servers/:id" element={<ServerDetail />} />
          {/* ... other routes */}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

---

#### 2.3 Breadcrumb Component (1 day)

**File:** `frontend/src/components/layout/Breadcrumb.tsx` (NEW)

```tsx
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {item.href ? (
            <Link to={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight className="h-4 w-4" />}
        </div>
      ))}
    </div>
  )
}

// Usage:
// <Breadcrumb items={[
//   { label: "Dashboard", href: "/dashboard" },
//   { label: "Agents", href: "/agents" },
//   { label: "maestroserver" }
// ]} />
```

---

### Phase 3: Pages - Dashboard & Lists (5-6 days)

**Goal:** Implement Dashboard, Agent List, Server List

#### 3.1 Dashboard Page (2-3 days)

**File:** `frontend/src/pages/Dashboard.tsx` (NEW)

**Components to create:**
1. Stats cards (4 cards)
2. Agent status table (reuse from AgentList, condensed)
3. Activity timeline (use ActivityTimeline component)
4. Quick actions bar

**Implementation:**
- Use TanStack Query for data fetching
- Grid layout for stats cards
- Responsive (1 col mobile, 2 col tablet, 4 col desktop)

---

#### 3.2 Enhanced Agent List (1-2 days)

**File:** `frontend/src/pages/AgentList.tsx` (MODIFY)

**Changes:**
- Add filters (status dropdown, search box)
- Make table rows clickable (cursor-pointer, hover effect)
- Add [+ Add Agent] button
- Keep existing table structure

---

#### 3.3 Enhanced Server List (1-2 days)

**File:** `frontend/src/pages/ServerList.tsx` (NEW or MODIFY)

**Features:**
- Global server list (all servers across all agents)
- Filters: Agent dropdown, status dropdown, search
- Pagination
- Clickable rows → Navigate to `/servers/:id`

---

### Phase 4: Pages - Detail Pages (7-10 days)

**Goal:** Implement Agent Detail and Server Detail pages

#### 4.1 Agent Detail Page (3-4 days)

**File:** `frontend/src/pages/AgentDetail.tsx` (NEW)

**Tab Structure:**
```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="servers">Servers</TabsTrigger>
    <TabsTrigger value="config">Configuration</TabsTrigger>
  </TabsList>

  <TabsContent value="overview">
    {/* Host metrics cards */}
    {/* Server list (condensed) */}
  </TabsContent>

  <TabsContent value="servers">
    {/* Full server list for this agent */}
  </TabsContent>

  <TabsContent value="config">
    {/* Agent settings (future) */}
  </TabsContent>
</Tabs>
```

**Implementation Order:**
1. Overview tab (2 days)
   - Host metrics cards
   - Server list table
   - [+ Create Server] button
2. Servers tab (1 day)
   - Reuse server table component
   - Add filters
3. Configuration tab (1 day - future/placeholder)

---

#### 4.2 Server Detail Page (4-6 days)

**File:** `frontend/src/pages/ServerDetail.tsx` (NEW)

**Tab Structure:**
```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="config">Configuration</TabsTrigger>
    <TabsTrigger value="logs">Logs</TabsTrigger>
    <TabsTrigger value="rcon">RCON</TabsTrigger>
    <TabsTrigger value="performance">Performance</TabsTrigger>
    <TabsTrigger value="backups">Backups</TabsTrigger>
  </TabsList>

  {/* Tab contents */}
</Tabs>
```

**Implementation Order:**
1. Overview tab (2 days)
   - Server metrics cards
   - Log preview (collapsible, use LogViewer)
   - RCON preview (collapsible)
   - Quick actions bar
   - [Expand View] buttons → Navigate to tab
2. Logs tab (1 day)
   - Embed existing LogViewer component
   - Full-screen layout
3. RCON tab (1 day)
   - Embed existing RconTerminal component
   - Add quick actions bar
4. Configuration tab (1-2 days)
   - Docker ENV editor form
   - Port conflict detection
   - Save/reset buttons
5. Performance tab (placeholder/future)
6. Backups tab (placeholder/future)

---

### Phase 5: Polish & Testing (3-4 days)

**Goal:** Responsive behavior, animations, bug fixes

#### 5.1 Responsive Behavior (2 days)

**Mobile (<768px):**
- Sidebar: Hamburger menu + overlay drawer
- Tables: Convert to stacked cards
- Stats: 1 column layout
- Preview panels: Full-screen modal

**Tablet (768-1024px):**
- Sidebar: Icon-only, expandable
- Tables: 2 columns or hide some columns
- Stats: 2 columns

**Desktop (>1024px):**
- Full layout as designed

**Files to modify:**
- Sidebar.tsx (add hamburger menu)
- All table components (responsive variants)
- Dashboard.tsx (responsive grid)

---

#### 5.2 Animations & Transitions (1 day)

**Apply to:**
- Tab transitions (fade in/out)
- Preview panel expand/collapse
- Sidebar mobile drawer (slide in/out)
- Table row hover effects

**Use Tailwind classes:**
- `transition-colors duration-200`
- `animate-in fade-in-0 slide-in-from-left-5`
- `animate-out fade-out-0 slide-out-to-left-5`

---

#### 5.3 Testing & Bug Fixes (1-2 days)

**Test Checklist:**
- [ ] All pages render correctly
- [ ] Navigation works (all routes)
- [ ] Breadcrumbs update correctly
- [ ] Tabs work (all detail pages)
- [ ] Preview panels expand/collapse
- [ ] Filters work (agent list, server list)
- [ ] Search works
- [ ] Responsive behavior (mobile, tablet, desktop)
- [ ] Colors correct (midnight blue theme)
- [ ] WCAG AA compliance
- [ ] No console errors
- [ ] Performance acceptable (no lag)

---

## Implementation Priority

### MUST HAVE (M9 Core)
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

### NICE TO HAVE (M9 Polish)
12. ⭐ Agent Detail: Configuration tab
13. ⭐ Server Detail: Configuration tab (Docker ENV editor)
14. ⭐ Full responsive testing (tablet breakpoints)
15. ⭐ Animation polish

### FUTURE (M10+)
16. ⏭️ Server Detail: Performance tab (needs metrics collection)
17. ⏭️ Server Detail: Backups tab (needs backup feature)
18. ⏭️ Server Detail: Configuration > Server INI sub-tab (needs parser)
19. ⏭️ Historical metrics graphs (needs time-series DB)

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

## Development Tips

### Component Reuse

**Don't rebuild from scratch:**
- Sidebar: New component
- Dashboard: New page
- Agent List: Modify existing (add filters, clickable rows)
- Server List: New or modify existing ContainerList
- Agent Detail: New page (reuse table components)
- Server Detail: New page (embed existing LogViewer, RconTerminal)

**Reuse from M7.5:**
- All shadcn/ui components (Button, Card, Table, Tabs, etc.)
- LogViewer (modify for Smart Hybrid pattern)
- RconTerminal (embed as-is)
- Forms (ServerForm → Configuration tab)

### State Management

**TanStack Query for:**
- Fetching agents, servers, users, audit logs
- Real-time updates (refetch intervals)

**React State for:**
- Tab active state (useSearchParams for URL sync)
- Expanded/collapsed preview panels
- Filters (local state or URL params)

### Routing

**React Router v6:**
- Nested routes under MainLayout
- Dynamic params for detail pages (`:id`)
- URL params for tabs (`?tab=overview`)

### Testing Strategy

**As you implement:**
1. Build one page at a time
2. Test in browser immediately
3. Verify responsive behavior
4. Check colors with DevTools
5. Test navigation flows
6. Fix bugs before moving to next page

**Don't wait until end to test everything!**

---

## Deployment

**When M9 core complete:**

```bash
# 1. Build frontend
cd frontend
npm run build

# 2. Deploy to Cloudflare Workers
cd ../manager
wrangler deploy

# 3. Verify production
# Visit: https://zedops.mail-bcf.workers.dev
# Test: All pages, navigation, colors, responsive
```

**Rollback Plan:**
- Keep M7.5 in git history
- Can revert if major issues found
- Test in staging first (if available)

---

## Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Foundation | 3-5 days | Design system + components |
| Phase 2: Navigation | 4-5 days | Sidebar + layout + breadcrumbs |
| Phase 3: Dashboard & Lists | 5-6 days | 3 pages (Dashboard, Agent List, Server List) |
| Phase 4: Detail Pages | 7-10 days | 2 pages (Agent Detail, Server Detail) |
| Phase 5: Polish & Testing | 3-4 days | Responsive + animations + testing |
| **Total** | **22-30 days** | **Full visual redesign complete** |

**Calendar Time:** 2-3 weeks with focused work

---

## Questions & Support

**If stuck during implementation:**

1. **Reference design docs:**
   - `DESIGN-SYSTEM.md` for colors, components
   - `PAGE-LAYOUTS.md` for page structure
   - `findings.md` for user requirements

2. **Check shadcn docs:**
   - https://ui.shadcn.com/docs/components
   - All components already installed from M7.5

3. **Test incrementally:**
   - Don't build everything before testing
   - Verify each page/component as you go

4. **Ask for help:**
   - Screenshot issues
   - Share error messages
   - Describe expected vs actual behavior

---

## Next Steps

**After M8 approval:**
1. Create new M9 planning files (task_plan.md, progress.md)
2. Start Phase 1: Foundation
3. Commit after each phase
4. Deploy when MUST HAVE items complete
5. Polish with NICE TO HAVE items
6. Complete M9, archive planning files
7. Celebrate! 🎉

**Ready to begin M9 implementation!**
