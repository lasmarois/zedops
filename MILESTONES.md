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

## Milestone 5: Host Metrics Display ⏳ Planned

**Goal:** Display agent host resource usage (CPU, memory, disk) in UI

**Duration:** 4-6 hours (1 session)

**Rationale:**
Focus on product core features before deployment polish. Agent already runs natively on host and has full network access. Port checking works. Installation scripts and systemd services are deferred for later polish phase (see Milestone 8).

**Deliverables:**
- Agent collects host metrics (CPU, RAM, disk usage)
- Agent sends metrics to manager via message protocol
- Manager stores metrics in Durable Object state
- UI displays metrics with visual indicators (progress bars/badges)
- Metrics refresh automatically with existing polling

**Success Criteria:**
- Agent reports CPU percentage, memory usage, disk space
- Manager receives and stores latest metrics
- UI shows metrics prominently in agent details view
- Metrics update within 10-15 seconds (existing polling interval)
- Visual indicators show resource health (green/yellow/red)

**Current State:**
- ✅ Agent runs natively on host (single binary, manual start)
- ✅ Port checking works (3-layer validation via /proc/net)
- ✅ Full network access (no Docker isolation)
- ❌ No host metrics collection yet
- ❌ No metrics display in UI

**Implementation Plan:**
1. **Phase 1: Agent Metrics Collection** (~2-3 hours)
   - Add metrics collection in `agent/main.go` using Go runtime package
   - CPU: via runtime.NumCPU() and /proc/stat
   - Memory: via runtime.MemStats and /proc/meminfo
   - Disk: via syscall.Statfs() for /var/lib/zedops/
   - Send metrics with agent heartbeat or new message type

2. **Phase 2: Manager Storage & API** (~1 hour)
   - Store metrics in Durable Object state (latest values only)
   - Add GET /api/agents/:id/metrics endpoint (or include in existing agent details)
   - Handle metric updates from agent messages

3. **Phase 3: UI Display** (~1-2 hours)
   - Add metrics section in ContainerList or AgentDetails component
   - Progress bars or badges for CPU/memory/disk
   - Color-coded thresholds (green <70%, yellow 70-90%, red >90%)
   - Auto-refresh with existing polling

**Dependencies:** None

**Planning:** [planning-history/milestone-5-host-metrics/](planning-history/milestone-5-host-metrics/) *(to be created)*

---

## Milestone 6: RCON Integration ⏳ Planned

**Goal:** Direct RCON connection and command execution

**Duration:** 1-2 weeks

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

## Milestone 7: RBAC & Audit Logs ⏳ Planned

**Goal:** Role-based access control and audit logging

**Duration:** 2 weeks

**Deliverables:**
- User management (email/password, replace hardcoded admin)
- Roles: Admin (global), Operator (per-server), Viewer (per-server)
- Audit log (all actions logged: who, what, when, target)
- Audit log viewer in UI
- User invitation flow

**Success Criteria:**
- Admin can invite users with specific roles
- Operator can control server but not delete
- Viewer can view logs but not control server
- All actions logged in D1 with timestamps

**Dependencies:** Milestone 6 (RCON Integration)

**Planning:** *(not started)*

---

## Milestone 7.5: UI Styling & Design System ⏳ Planned

**Goal:** Implement comprehensive UI styling with shadcn/ui and Tailwind CSS

**Duration:** 1-2 weeks

**Rationale:**
After building all core features (M1-M7), apply consistent design system across the entire product. This approach ensures styling decisions are informed by complete product context and all features are styled cohesively.

**Deliverables:**
- Install and configure shadcn/ui + Tailwind CSS
- Create design system (colors, spacing, typography, themes)
- Replace custom components with shadcn components
  - Forms (ServerForm with proper inputs, validation states)
  - Tables (AgentList, ContainerList with sorting, filtering)
  - Dialogs (confirmations, modals)
  - Cards (server cards, agent cards)
  - Badges (status indicators, labels)
  - Buttons (consistent sizing, variants, states)
- Implement responsive layouts (mobile, tablet, desktop)
- Add proper loading states (skeletons, spinners)
- Add error states (inline errors, toast notifications)
- Add empty states (no servers, no agents, no logs)
- Polish log viewer (terminal styling with shadcn theme)
- Dark mode support (optional but recommended)
- Accessibility improvements (ARIA labels, keyboard navigation)

**Success Criteria:**
- All pages use shadcn components consistently
- Design tokens applied across entire app
- Responsive layouts work on mobile, tablet, desktop
- Loading/error/empty states present everywhere
- UI feels polished and professional
- No custom CSS outside design system
- Consistent spacing, typography, colors throughout

**Pages to Style:**
1. Login page
2. Agent list page
3. Container list page (servers view)
4. Server creation form
5. Log viewer
6. RCON console (if M6 complete)
7. Audit logs viewer (if M7 complete)

**Dependencies:** Milestone 7 (RBAC & Audit Logs)

**Planning:** *(not started)*

---

## Milestone 8: Agent Deployment & Polish ⏳ Deferred

**Goal:** Production-ready agent deployment with installation automation

**Duration:** 3-5 days

**Rationale:**
Deferred until after core product features are complete and UI is styled. Agent already runs natively on host as a single binary. This milestone focuses on deployment convenience and multi-platform support.

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

**Dependencies:** Milestone 7.5 (UI Styling)

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
| M5: Host Metrics Display | 4-6 hours | TBD | ⏳ Planned |
| M6: RCON Integration | 1-2 weeks | TBD | ⏳ Planned |
| M7: RBAC & Audit Logs | 2 weeks | TBD | ⏳ Planned |
| M7.5: UI Styling & Design System | 1-2 weeks | TBD | ⏳ Planned |
| M8: Agent Deployment & Polish | 3-5 days | TBD | ⏳ Deferred |

**Progress:** 4/9 core milestones complete (44%) in 2 days 🎉

**Next Focus:** M5 (Host Metrics) → M6 (RCON) → M7 (RBAC) → M7.5 (UI Styling) → M8 (Deployment Polish)

**Total to MVP:** ~12 weeks estimated → ~2-3 weeks actual (at current pace)

**Note:** Initial estimates were conservative. With planning-with-files pattern and focused implementation sessions, Milestones 1-3 were completed much faster than expected. Future milestones may follow similar acceleration.

---

## Current Status

**Active Milestone:** Ready for Milestone 5 (Host Metrics) 🎯

**Completed Milestones:**
- ✅ Milestone 1 - Agent Connection (2026-01-10)
- ✅ Milestone 2 - Container Control (2026-01-10)
- ✅ Milestone 3 - Log Streaming (2026-01-10)
- ✅ Milestone 4 - Server Management (2026-01-10 to 2026-01-11)

**Next Up:**
- **Milestone 5** - Host Metrics Display (4-6 hours, focus on product core)
- **Milestone 6** - RCON Integration (server administration features)
- **Milestone 7** - RBAC & Audit Logs (multi-user support)
- **Milestone 7.5** - UI Styling & Design System (comprehensive shadcn/ui styling)

**Deferred:**
- **Milestone 8** - Agent Deployment & Polish (installation automation, deferred until after UI styling)

**Current Planning:** Milestone 4 archived, ready to start M5
