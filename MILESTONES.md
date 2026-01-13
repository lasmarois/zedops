# ZedOps Milestones

**Status Legend:**
- ⏳ **Planned** - Not started yet
- 🚧 **In Progress** - Currently being worked on
- ✅ **Complete** - Finished and tested

---

## Milestone 1: Agent Connection ✅ Complete

**Goal:** Establish WebSocket connection between agent and manager using NATS-inspired message protocol

**Duration:** 1 day (2026-01-10)

**Deliverables:**
- ✅ Agent registration flow (ephemeral token → permanent token)
- ✅ WebSocket connection to Cloudflare Durable Object
- ✅ Manager UI shows agent status (online/offline)
- ✅ Basic auth (hardcoded admin for MVP)
- ✅ NATS-inspired message protocol (subject-based routing, request/reply)
- ✅ Agent authentication (agent.auth) for reconnection

**Success Criteria:**
- ✅ Agent can register and connect to manager
- ✅ Manager displays "Agent online ✓" in UI
- ✅ Connection survives network interruptions (reconnect logic)
- ✅ Messages can be sent bidirectionally

**Planning:** [planning-history/milestone-1-agent-connection/](planning-history/milestone-1-agent-connection/)

**Completed:** 2026-01-10 (commit: 0fc9cac)

---

## Milestone 2: Container Control ✅ Complete

**Goal:** Agent can list and control Docker containers via manager commands

**Duration:** 1 day (2026-01-10)

**Deliverables:**
- ✅ Agent lists Docker containers (via Docker SDK)
- ✅ Manager sends start/stop/restart commands
- ✅ Agent executes Docker operations
- ✅ UI displays container list with status
- ✅ UI has buttons to start/stop/restart containers

**Success Criteria:**
- ✅ User clicks "Start Server" in UI → Container starts on agent's machine
- ✅ Container status updates in real-time (5s refresh interval)
- ✅ Error handling for failed operations

**Dependencies:** Milestone 1 (Agent Connection)

**Planning:** [task_plan.md](task_plan.md) | [findings.md](findings.md) | [progress.md](progress.md)

**Completed:** 2026-01-10 (commits: 1b52342, 19ed5ef, 7c0aa35)

---

## Milestone 3: Log Streaming ✅ Complete

**Goal:** Real-time log streaming from containers to UI

**Duration:** 1 day (2026-01-10)

**Deliverables:**
- ✅ Agent streams container logs via Docker SDK (multiplexed stream format)
- ✅ Durable Object forwards logs to UI clients (pub/sub with circular buffer)
- ✅ UI displays real-time logs with auto-scroll
- ✅ Log filtering (by stream: stdout/stderr, by search term)
- ✅ Last 1000 lines cached for new UI connections
- ✅ Terminal-like viewer with Dracula color scheme
- ✅ Pause/Resume, Clear logs, Auto-scroll controls
- ✅ Connection status indicator and auto-reconnect

**Success Criteria:**
- ✅ User opens log viewer → sees live logs streaming
- ✅ Logs appear in UI <100ms after container outputs (real-time)
- ✅ Multiple users can watch same logs simultaneously
- ✅ Cached logs delivered immediately to new subscribers

**Dependencies:** Milestone 2 (Container Control)

**Planning:** [task_plan.md](task_plan.md) | [findings.md](findings.md) | [progress.md](progress.md)

**Completed:** 2026-01-10 (Session 5 - End-to-end testing successful)

### Implementation Highlights
- **Agent**: Go channels for async log streaming, context-based cancellation
- **Manager**: Pub/sub via Durable Objects, reference counting for stream lifecycle
- **UI**: Custom React log viewer with react hooks, WebSocket with exponential backoff
- **Message Protocol**: log.subscribe, log.line, log.history, log.stream.start/stop

### Known Limitations
- **Container restart handling**: If a container restarts while viewing logs, the log stream ends (Docker EOF) and doesn't automatically resume. User must close and reopen the log viewer.
  - **Workaround**: Close log viewer, wait for container to restart, then reopen
  - **Impact**: Minor UX issue for rare scenario (active log viewing during restart)

### Future Enhancements (Milestone 3.x)
- **Auto-reconnect on container restart**: Detect when container restarts and automatically resume log stream without user intervention
- **Server-side log filtering**: Filter logs by pattern/level on agent before sending to manager (reduce bandwidth)
- **Log level detection**: Parse common log patterns (INFO, WARN, ERROR) for color-coding
- **Log export**: Download logs to file (last N lines or time range)
- **Multi-container view**: View logs from multiple containers in split panes
- **Log timestamps toggle**: Option to hide timestamps for cleaner view
- **Log search history**: Remember recent search terms

---

## Milestone 4: Server Management ✅ Complete

**Goal:** Full server lifecycle management (create, configure, deploy, delete)

**Duration:** 2 days (2026-01-10 to 2026-01-11)

**Deliverables:**
- ✅ UI form to create new Zomboid server
- ✅ ENV variable configuration (server name, passwords, beta branch)
- ✅ Manager sends server config to agent
- ✅ Agent uses Docker SDK directly (not docker-compose)
- ✅ Agent deploys container using steam-zomboid image
- ✅ Delete server functionality (soft delete + purge)

**Success Criteria:**
- ✅ User fills form → Server created on agent's machine
- ✅ Server appears in UI with correct config
- ✅ Server starts successfully with configured ENV vars
- ✅ User can delete server → Container removed cleanly

**Additional Features Delivered:**
- ✅ Port validation with conflict detection and auto-suggestion
- ✅ Soft delete with 24h retention period
- ✅ Server recovery from accidental container deletion
- ✅ Rebuild, start/stop, restore functionality
- ✅ Automatic status sync (docker rm/stop/start detected within 5-10s)
- ✅ Edit & Retry for failed servers
- ✅ Beta branch selector (stable, build42, iwillbackupmysave, etc.)
- ✅ State-specific UI actions based on server status

**Dependencies:** Milestone 3 (Log Streaming)

**Planning:** [task_plan.md](task_plan.md) | [planning-history/server-lifecycle-management/](planning-history/server-lifecycle-management/)

**Completed:** 2026-01-11

**Future Enhancements (deferred):**
- Edit server config after creation
- 24h auto-purge for soft-deleted servers
- Mod management UI (Milestone 8)

---

## Milestone 5: RCON Integration ⏳ Planned

**Goal:** RCON console for server administration

**Duration:** 2 weeks

**Deliverables:**
- Agent connects to server RCON port
- Manager sends RCON commands via WebSocket
- UI terminal (xterm.js) for RCON console
- Command history and autocomplete
- Quick actions (player list, kick, ban, broadcast)

**Success Criteria:**
- User types RCON command in UI terminal → executes on server
- Player list displayed in UI
- Quick action buttons work (kick player, etc.)
- Command history navigable with arrow keys

**Dependencies:** Milestone 4 (Server Management)

**Planning:** *(not started)*

---

## Milestone 5: Host Metrics Display ✅ Complete

**Goal:** Display agent host resource usage (CPU, memory, disk) in UI

**Duration:** 4-6 hours (1 session)

**Deliverables:**
- ✅ Agent collects host metrics (CPU, RAM, disk usage)
- ✅ Agent sends metrics with heartbeat (piggybacked on existing 30s heartbeat)
- ✅ Manager stores metrics in D1 agents.metadata field (no migration required)
- ✅ UI displays metrics with color-coded badges in AgentList table
- ✅ Metrics refresh automatically (30s heartbeat + 5s frontend polling)

**Success Criteria:**
- ✅ Agent reports CPU percentage, memory usage, disk space
- ✅ Manager receives and stores latest metrics in D1 metadata field
- ✅ UI shows metrics prominently in AgentList with visual indicators
- ✅ Metrics update within 30-40 seconds (heartbeat + polling)
- ✅ Visual indicators show resource health (green/yellow/red)

**Implementation Highlights:**
- **Agent**: `agent/metrics.go` - CollectHostMetrics() with /proc parsing (CPU, memory, disk)
- **Manager**: Extended handleAgentHeartbeat() in AgentConnection.ts to store metrics
- **Frontend**: MetricBadge component in AgentList.tsx with color thresholds
- **Architecture**: Piggybacked on existing heartbeat (no new message type)
- **Backward Compatible**: Works with/without metrics (old agents supported)

**Test Results:**
- ✅ Agent collects metrics successfully (CPU 0%, Mem 31.7%, Disk 74.3%)
- ✅ Metrics stored in D1 metadata field
- ✅ UI displays color-coded badges (yellow for disk 74%, green for CPU/memory)
- ✅ No performance issues or errors

**Dependencies:** None

**Planning:** [planning-history/milestone-5-host-metrics/](planning-history/milestone-5-host-metrics/)

**Completed:** 2026-01-11

**Future Enhancements (Deferred):** See [ISSUE-metrics-enhancements.md](ISSUE-metrics-enhancements.md) for 7 planned enhancements (historical metrics, graphs, per-container metrics, alerting, etc.)

---

## Milestone 6: RCON Integration ✅ Complete

**Goal:** Direct RCON connection and command execution

**Duration:** ~9.5 hours (2026-01-11 to 2026-01-12)

**Deliverables:**
- ✅ Agent connects to server RCON port (via Docker network, secure)
- ✅ Manager sends RCON commands via WebSocket
- ✅ UI terminal (xterm.js) for RCON console
- ✅ Command history and autocomplete (↑↓ arrow navigation)
- ✅ Quick actions (player list, kick, ban, broadcast, save)
- ✅ All UX issues resolved (scrollbars, command history, prompt visibility)

**Success Criteria:**
- ✅ User types RCON command in UI terminal → executes on server
- ✅ Player list displayed in UI with quick action buttons
- ✅ Quick action buttons work (kick player, ban, broadcast, save)
- ✅ Command history navigable with arrow keys
- ✅ Real-time command responses displayed in terminal

**Implementation Highlights:**
- **Agent**: gorcon/rcon v1.3.5 with Docker network access (no host port exposure)
- **Manager**: WebSocket routing with session management, RCON message handlers
- **Frontend**: xterm.js with FitAddon, command history (localStorage), quick actions UI
- **Security**: Docker network isolation, no RCON ports exposed on host
- **Architecture**: Request/reply pattern with 30s timeouts, auto-reconnect on disconnect

**Test Results:**
- ✅ RCON connection via Docker network successful
- ✅ Commands execute correctly (help, players, save, servermsg, kick, ban)
- ✅ Terminal scrolling works correctly
- ✅ Session persists across commands
- ✅ Command history works with ↑↓ navigation
- ✅ Tested on build42-testing and jeanguy servers

**Dependencies:** Milestone 4 (Server Management)

**Planning:** [planning-history/milestone-6-rcon-integration/](planning-history/milestone-6-rcon-integration/)

**Completed:** 2026-01-12 (commits: 82af871, 3158e7e, 9c4efb4, 7074cfd, 82533a9)

---

## Milestone 7: RBAC & Audit Logs 🚧 In Progress

**Goal:** Role-based access control and audit logging

**Duration:** 2 phases (2026-01-12)

### Phase 1: Initial Implementation ✅ Complete

**Completed:** 2026-01-12 (12 hours)

**Deliverables:**
- ✅ User management (email/password, replace hardcoded admin)
- ✅ Roles: Admin, User (with granular permissions)
- ✅ Audit log (all actions logged: who, what, when, target)
- ✅ Audit log viewer in UI
- ✅ User invitation flow
- ✅ JWT-based authentication (secure, stateless)
- ✅ Permission system (per-agent, per-server, global)
- ✅ Core permission enforcement (start/stop/delete operations)

**Implementation Highlights:**
- **Backend**: JWT tokens with jose library, bcrypt password hashing
- **Database**: 4 new tables (users, permissions, invitations, audit_logs)
- **Frontend**: React Context API for auth state, UserList, PermissionsManager, AuditLogViewer components
- **Security**: Authorization middleware on protected endpoints, token expiration, secure password hashing

**Test Results:**
- ✅ Login works with default admin credentials (admin@zedops.local)
- ✅ Unauthenticated requests blocked (401)
- ✅ Authenticated requests work with JWT tokens
- ✅ User management API fully functional
- ✅ Deployed to production: https://zedops.mail-bcf.workers.dev
- ✅ Registration page working (invitation token verification)
- ✅ Permission management functional (grant/revoke)
- ✅ User invitations with "user" role working

**Post-Deployment Fixes:**
- Fixed SPA routing (inlined index.html with catch-all route)
- Fixed API endpoint mismatches (permissions endpoints)
- Fixed role validation (operator/viewer → user)
- Created migration 0008 to update database constraints

**Migrations:**
- 0006: Create RBAC tables
- 0007: Insert default admin user
- 0008: Update role constraint (admin/user)

**Planning (Archived):**
- [planning-history/milestone-7-rbac-initial-implementation/](planning-history/milestone-7-rbac-initial-implementation/)

---

### Phase 2: Auth Migration & Refinement ✅ Complete

**Started:** 2026-01-12
**Completed:** 2026-01-12

**Goal:** Complete RBAC implementation with consistent JWT authentication across all endpoints

**Issue:** [ISSUE-rbac-auth-migration.md](ISSUE-rbac-auth-migration.md)

**Completed Work:**
- ✅ Migrated all endpoints from ADMIN_PASSWORD to JWT auth
  - Container operations (`/containers`, `/ports/*`)
  - Server operations (restart, rebuild, sync, start, stop, delete)
  - Log streaming WebSocket (`/logs/ws` - JWT via query param)
  - RCON WebSocket (JWT + permission checking)
- ✅ Complete permission enforcement
  - Permission checks on all container operations
  - RCON permission checking (operator role required)
- ✅ Architectural decisions implemented
  - **Role model:** 4 roles (admin, agent-admin, operator, viewer)
  - **Permission hierarchy:** operator ⊃ viewer (includes capabilities)
  - **Agent-level permissions:** Implemented with scope system
  - **Server creation:** agent-admin can create, others admin-only
- ✅ Comprehensive testing
  - Tested all role scenarios (viewer, operator, agent-admin, admin)
  - Tested multi-scope permissions (global, agent, server)
  - Verified audit logs capture all operations
- ✅ Audit logging complete
  - All server operations logged with user attribution
  - RCON commands logged with full context
  - Audit log viewer with pagination and filtering

**Actual Time:** ~12 hours (Phase 2 only, Phase 1: 12h = 24h total)

**Status:** ✅ All requirements met and tested

**Total M7 Time:**
- Phase 1: 12 hours ✅
- Phase 2: 12 hours ✅
- **Total: 24 hours (actual)**

**Dependencies:** Milestone 6 (RCON Integration), Phase 1 Complete

**Deployment Guides:**
- [QUICK-START-RBAC.md](QUICK-START-RBAC.md) - 10-minute TL;DR guide
- [DEPLOYMENT-RBAC.md](DEPLOYMENT-RBAC.md) - Comprehensive deployment guide

---

## Milestone 7.5: UI Styling & Design System ✅ Complete

**Goal:** Implement comprehensive UI styling with shadcn/ui and Tailwind CSS

**Duration:** 1-2 weeks estimated → **8.25 hours actual** (73% under budget!)

**Completed:** 2026-01-12

**Rationale:**
After building all core features (M1-M7), apply consistent design system across the entire product. This approach ensures styling decisions are informed by complete product context and all features are styled cohesively.

**Deliverables:**
- ✅ Install and configure shadcn/ui + Tailwind CSS v3.4.0
- ✅ Create design system (colors, spacing, typography, semantic variants)
- ✅ Replace custom components with shadcn components (10 components refactored)
  - ✅ Forms (ServerForm with proper inputs, validation states)
  - ✅ Tables (AgentList, ContainerList with semantic styling)
  - ✅ Dialogs (confirmations, modals with Radix UI)
  - ✅ Cards (server cards with consistent styling)
  - ✅ Badges (status indicators with 5 semantic variants)
  - ✅ Buttons (consistent sizing, 9 variants, states)
- ✅ Implement responsive layouts (mobile/tablet/desktop breakpoints)
- ✅ Add proper loading states (skeleton components with pulse animation)
- ✅ Add error states (Alert components with destructive variant)
- ✅ Add empty states (consistent messaging with helpful hints)
- ✅ Polish log viewer (Dracula theme preserved)
- ✅ Accessibility improvements (WCAG AA, keyboard navigation, ARIA attributes)

**Key Achievements:**
- **Code reduction:** -1,385 lines (-27%)
- **WCAG AA compliant:** 11.5:1 text contrast, 4.6-10.8:1 button contrast
- **Zero regressions:** All functionality preserved
- **Production deployed:** https://zedops.mail-bcf.workers.dev

**Critical Fix:**
- Tailwind v4 → v3 downgrade (color utility generation issue resolved)

**Success Criteria:**
- ✅ All pages use shadcn components consistently
- ✅ Design tokens applied across entire app
- ✅ Responsive layouts work on mobile, tablet, desktop
- ✅ Loading/error/empty states present everywhere
- ✅ UI feels polished and professional
- ✅ No custom CSS outside design system
- ✅ Consistent spacing, typography, colors throughout

**Pages Styled:**
1. ✅ Login page
2. ✅ Agent list page
3. ✅ Container list page (servers view)
4. ✅ Server creation form
5. ✅ Log viewer
6. ✅ RCON console
7. ✅ Audit logs viewer
8. ✅ User management page
9. ✅ Permissions management page
10. ✅ Registration page

**Dependencies:** Milestone 7 (RBAC & Audit Logs)

**Planning (Archived):** [planning-history/milestone-7.5-ui-styling/](planning-history/milestone-7.5-ui-styling/)

**Deferred:** Phase 6 (Testing & Verification) → Moved to Milestone 11

---

## Milestone 8: Visual Redesign - Design Phase ✅ Complete

**Goal:** Design comprehensive visual redesign and modern template for ZedOps UI

**Duration:** 1-2 weeks estimated → **1 day actual** (6 sessions, highly efficient!)

**Started:** 2026-01-12
**Completed:** 2026-01-12

**Rationale:**
After completing the foundational UI styling (M7.5), create a cohesive visual design that elevates the product from functional to exceptional. This complex design phase will define the visual language, user flows, and template structure before implementation.

**Deliverables:**
- **Visual Design System**
  - Color palette refinement (beyond current Bootstrap colors)
  - Typography hierarchy and font selection
  - Iconography system
  - Component visual specifications
  - Spacing and layout grid system

- **Template Design**
  - Navigation structure (sidebar vs header vs hybrid)
  - Dashboard/home page design
  - Page templates for all major sections
  - Mobile-first responsive layouts
  - Dark theme visual refinement

- **Design Assets**
  - High-fidelity mockups (Figma/Sketch/similar)
  - Component library documentation
  - Design tokens specification
  - Visual style guide

- **User Experience Enhancements**
  - Improved information architecture
  - Streamlined user flows
  - Visual hierarchy optimization
  - Micro-interactions and animation specifications

**Success Criteria:**
- Complete visual mockups for all 10+ pages
- Design system fully documented
- Stakeholder approval on visual direction
- Clear implementation specifications for M9
- Responsive designs for mobile, tablet, desktop
- Accessibility considerations documented (color contrast, touch targets, etc.)

**Dependencies:** Milestone 7.5 (UI Styling & Design System)

**Planning:** [planning-history/milestone-8-visual-redesign-design/](planning-history/milestone-8-visual-redesign-design/)

**Status:** ✅ Complete - All design specifications ready for M9 implementation

**Deliverables:**
- ✅ `DESIGN-SYSTEM.md` - Complete design system (colors, typography, components, log viewer, activity timeline)
- ✅ `PAGE-LAYOUTS.md` - All page specifications (6 pages with ASCII diagrams)
- ✅ `M9-IMPLEMENTATION-GUIDE.md` - 5-phase implementation plan with code examples
- ✅ `findings.md` - User vision, requirements, hypervisor UI research
- ✅ `progress.md` - 6 sessions documented
- ✅ `task_plan.md` - All phases complete

**Key Achievements:**
- Midnight blue color palette (#0C1628 background, WCAG AA compliant)
- Hypervisor-style UI design (Proxmox VE / vSphere pattern)
- Text-only status badges (clean, professional)
- Smart Hybrid log viewer (compact + auto-expanded errors)
- Expandable activity timeline (inline cards)
- Sidebar with sections (Infrastructure, Management)
- 6 complete page layouts (Dashboard, Agent List/Detail, Server List/Detail)
- Tab structures (Agent: 3 tabs, Server: 6 tabs)
- Preview panels (collapsible → navigate to tab)
- Responsive specifications (mobile, tablet, desktop)

**Implementation Priority (M9):**
- MUST HAVE: 11 core items (sidebar, dashboard, lists, detail pages)
- NICE TO HAVE: 4 polish items (configuration tabs, full responsive)
- FUTURE: 4 items (performance, backups, server.ini, metrics graphs)

**Timeline Estimate for M9:** 22-30 days (2-3 weeks focused work)

**Note:** This was a design-only milestone. No code changes - all work is design artifacts and specifications ready for M9 implementation.

---

## Milestone 9: Visual Redesign - Implementation Phase 🚧 In Progress

**Goal:** Implement the visual redesign from M8 into production-ready code

**Duration:** 2-3 weeks (22-30 days estimated)

**Started:** 2026-01-13

**Rationale:**
Transform design artifacts from M8 into a fully functional, polished UI. This complex implementation phase requires careful attention to detail, performance, and maintaining existing functionality.

**Deliverables:**
- **Phase 1: Foundation (3-5 days)**
  - Midnight blue color system update
  - New components (StatusBadge, ActivityTimeline, LogViewer)
  - Design system testing

- **Phase 2: Navigation & Layout (4-5 days)**
  - Sidebar navigation with sections
  - Main layout (sidebar + content area)
  - Breadcrumb component

- **Phase 3: Dashboard & Lists (5-6 days)**
  - Dashboard page (stats cards, agent table, activity)
  - Enhanced Agent List (filters, clickable rows)
  - Global Server List (all servers across agents)

- **Phase 4: Detail Pages (7-10 days)**
  - Agent Detail page (3 tabs: Overview, Servers, Configuration)
  - Server Detail page (6 tabs: Overview, Config, Logs, RCON, Performance, Backups)
  - Preview panels (collapsible → navigate to tab)

- **Phase 5: Polish & Testing (3-4 days)**
  - Responsive layouts (mobile, tablet, desktop)
  - Animations and transitions
  - Testing and bug fixes

**Success Criteria:**
- All MUST HAVE items implemented (11 core features)
- All pages render with midnight blue theme
- Navigation works (sidebar, breadcrumbs, links)
- Dashboard shows stats, agents, activity
- Agent Detail has 2-3 tabs working
- Server Detail has 3-4 tabs working (Overview, Logs, RCON, Config)
- Preview panels collapse/expand correctly
- Mobile sidebar works (hamburger menu)
- No visual regressions from M7.5
- WCAG AA compliance maintained
- Production deployed and validated

**Dependencies:** Milestone 8 (Visual Redesign - Design Phase)

**Planning:** [task_plan.md](task_plan.md) | [findings.md](findings.md) | [progress.md](progress.md)

**Design References:** [planning-history/milestone-8-visual-redesign-design/](planning-history/milestone-8-visual-redesign-design/)

---

## Milestone 10: Agent Deployment & Polish ⏳ Deferred

**Goal:** Production-ready agent deployment with installation automation

**Duration:** 3-5 days

**Rationale:**
Deferred until after visual redesign is complete (M9). Agent already runs natively on host as a single binary. This milestone focuses on deployment convenience and multi-platform support.

**Deliverables:**
- Cross-platform build script (Linux, Windows, macOS)
- Installation script (`curl | bash` style for Linux)
- Systemd service file (Linux)
- Windows service configuration
- Agent auto-update mechanism
- UI "Install Agent" button with copy-to-clipboard command
- Multi-arch support (amd64, arm64)

**Success Criteria:**
- User runs: `curl -sSL https://zedops.example.com/install.sh | sudo bash`
- Script downloads agent binary for correct OS/arch
- Prompts for registration token (from UI)
- Installs as systemd service (auto-start on boot)
- Agent connects to manager successfully
- Service survives reboot (auto-restart)
- Agent can auto-update when new version released

**Dependencies:** Milestone 9 (Visual Redesign - Implementation)

**Planning:** *(not started)*

---

## Milestone 11: Testing & Verification ⏳ Planned

**Goal:** Comprehensive testing and quality assurance across the entire platform

**Duration:** 1-2 weeks

**Rationale:**
After completing all implementation (M1-M9), conduct thorough testing to ensure production readiness. This includes M7.5 Phase 6 (deferred UI testing) plus comprehensive QA for the entire system.

**Deliverables:**
- **Cross-Browser Testing**
  - Chrome, Firefox, Safari, Edge
  - Desktop and mobile browsers
  - Browser compatibility matrix

- **Responsive Testing**
  - Actual device testing (phones, tablets)
  - Various screen sizes (375px to 1920px+)
  - Orientation testing (portrait/landscape)

- **Performance Testing**
  - Page load times
  - Bundle size analysis
  - Runtime performance profiling
  - Memory leak detection
  - Network latency simulation

- **Accessibility Testing**
  - Lighthouse accessibility audits
  - axe DevTools scanning
  - Manual keyboard navigation testing
  - Screen reader testing (NVDA, JAWS, VoiceOver)
  - Color contrast verification

- **Functional Testing**
  - End-to-end user flows
  - Edge case scenarios
  - Error handling validation
  - Security testing (XSS, CSRF, etc.)

- **Integration Testing**
  - Agent-Manager communication
  - WebSocket reconnection scenarios
  - Concurrent user sessions
  - Load testing (multiple agents, servers)

**Success Criteria:**
- All tests pass with no critical issues
- Performance metrics meet targets
- Accessibility scores 95+ on Lighthouse
- Cross-browser compatibility confirmed
- Security vulnerabilities addressed
- Production deployment validated

**Dependencies:** Milestone 9 (Visual Redesign - Implementation)

**Planning:** *(not started)*

---

## Future Milestones (Ideas)

### Milestone 9: Mod Management UI
- UI for managing mods (SERVER_MODS, SERVER_WORKSHOP_ITEMS)
- Mod browser (popular mods with descriptions)
- One-click mod installation

### Milestone 10: Server Metrics & Monitoring
- Server-level CPU, memory, disk usage (per-container)
- UI dashboards with charts
- Alerts for resource thresholds
- Historical metrics storage

### Milestone 11: Backup & Restore
- Automated server backups
- Backup schedule configuration
- One-click restore from backup

### Milestone 12: Agent Auto-Update
- Manager notifies agents of new version
- Agent downloads and replaces binary
- Graceful restart without losing connections
- Rollback on failure

---

## Roadmap Timeline

| Milestone | Estimated | Actual | Status |
|-----------|-----------|--------|--------|
| M1: Agent Connection | 1-2 weeks | 1 day | ✅ Complete |
| M2: Container Control | 2 weeks | 1 day | ✅ Complete |
| M3: Log Streaming | 1 week | 1 day | ✅ Complete |
| M4: Server Management | 2-3 weeks | 2 days | ✅ Complete |
| M5: Host Metrics Display | 4-6 hours | 4 hours | ✅ Complete |
| M6: RCON Integration | 1-2 weeks | 9.5 hours | ✅ Complete |
| M7: RBAC & Audit Logs | 2 weeks | 24 hours | ✅ Complete (Phase 1 & 2) |
| M7.5: UI Styling & Design System | 1-2 weeks | 8.25 hours | ✅ Complete |
| M8: Visual Redesign - Design | 1-2 weeks | 1 day | ✅ Complete |
| M9: Visual Redesign - Implementation | 2-3 weeks | TBD | ⏳ Planned |
| M10: Agent Deployment & Polish | 3-5 days | TBD | ⏳ Deferred |
| M11: Testing & Verification | 1-2 weeks | TBD | ⏳ Planned |

**Progress:** 8/11 core milestones complete (73%) 🎉

**Active Milestone:** M9 (Visual Redesign - Implementation Phase) 🚧

**Total to MVP:** ~12 weeks estimated → ~2.5 weeks actual (current pace: 80% under estimate!)

**Note:** Initial estimates were conservative. With planning-with-files pattern and focused implementation sessions, M1-M7.5 were completed much faster than expected. M7.5 came in 73% under budget!

---

## Current Status

**Active Milestone:** Milestone 9 (Visual Redesign - Implementation Phase) 🚧

**Completed Milestones:**
- ✅ Milestone 1 - Agent Connection (2026-01-10)
- ✅ Milestone 2 - Container Control (2026-01-10)
- ✅ Milestone 3 - Log Streaming (2026-01-10)
- ✅ Milestone 4 - Server Management (2026-01-10 to 2026-01-11)
- ✅ Milestone 5 - Host Metrics Display (2026-01-11)
- ✅ Milestone 6 - RCON Integration (2026-01-11 to 2026-01-12)
- ✅ **Milestone 7 - RBAC & Audit Logs** (2026-01-12)
  - ✅ Phase 1 - Initial Implementation (12 hours)
  - ✅ Phase 2 - Auth Migration & Refinement (12 hours)
  - Total: 24 hours
- ✅ **Milestone 7.5 - UI Styling & Design System** (2026-01-12)
  - ✅ Phases 0-5 - Complete (8.25 hours, 73% under budget)
  - Deferred: Phase 6 (Testing) → Moved to M11
- ✅ **Milestone 8 - Visual Redesign - Design Phase** (2026-01-12)
  - ✅ All 6 phases complete (1 day, 6 sessions)
  - Design system, page layouts, implementation guide created

**In Progress:**
- 🚧 **Milestone 9 - Visual Redesign - Implementation Phase** (Started: 2026-01-13)
  - Phase 1: Foundation (⏳ Pending)
  - Design artifacts ready for implementation

**Deferred:**
- **Milestone 10** - Agent Deployment & Polish (after M9)
- **Milestone 11** - Testing & Verification (after M9)
- **Documentation** - Comprehensive API and user documentation (after M11)

**Current Planning:** M9 planning files created! Starting Phase 1: Foundation.

**Backlog:**
- See [ISSUE-metrics-enhancements.md](ISSUE-metrics-enhancements.md) for deferred M5 enhancements
- M7.5 Phase 6 testing moved to M11

### Reminders
- ability to remove server data (I think this is already implemented when purging.)
- edit existing server settings
- remove the sync status button? no need now since it happens automatically ?