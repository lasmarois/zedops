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

## Milestone 4: Server Management ⏳ Planned

**Goal:** Full server lifecycle management (create, configure, deploy, delete)

**Duration:** 2-3 weeks

**Deliverables:**
- UI form to create new Zomboid server
- ENV variable configuration (reads from steam-zomboid .env.template)
- Manager sends server config to agent
- Agent generates docker-compose.yml
- Agent deploys container using steam-zomboid image
- Delete server functionality

**Success Criteria:**
- User fills form → Server created on agent's machine
- Server appears in UI with correct config
- Server starts successfully with configured ENV vars
- User can delete server → Container removed cleanly

**Dependencies:** Milestone 3 (Log Streaming)

**Planning:** *(not started)*

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

## Milestone 6: RBAC & Audit Logs ⏳ Planned

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

**Dependencies:** Milestone 5 (RCON Integration)

**Planning:** *(not started)*

---

## Future Milestones (Ideas)

### Milestone 7: Mod Management UI
- UI for managing mods (SERVER_MODS, SERVER_WORKSHOP_ITEMS)
- Mod browser (popular mods with descriptions)
- One-click mod installation

### Milestone 8: Server Metrics & Monitoring
- Agent reports CPU, memory, disk usage
- UI dashboards with charts
- Alerts for resource thresholds

### Milestone 9: Backup & Restore
- Automated server backups
- Backup schedule configuration
- One-click restore from backup

### Milestone 10: Agent Auto-Update
- Manager notifies agents of new version
- Agent downloads and replaces binary
- Graceful restart without losing connections

---

## Roadmap Timeline

| Milestone | Estimated | Actual | Status |
|-----------|-----------|--------|--------|
| M1: Agent Connection | 1-2 weeks | 1 day | ✅ Complete |
| M2: Container Control | 2 weeks | 1 day | ✅ Complete |
| M3: Log Streaming | 1 week | 1 day | ✅ Complete |
| M4: Server Management | 2-3 weeks | TBD | ⏳ Planned |
| M5: RCON Integration | 2 weeks | TBD | ⏳ Planned |
| M6: RBAC & Audit Logs | 2 weeks | TBD | ⏳ Planned |

**Progress:** 3/6 milestones complete (50%) in 1 day 🎉

**Total to MVP:** ~12 weeks estimated → TBD actual

**Note:** Initial estimates were conservative. With planning-with-files pattern and focused implementation sessions, Milestones 1-3 were completed much faster than expected. Future milestones may follow similar acceleration.

---

## Current Status

**Active Milestone:** Ready for Milestone 4 - Server Management 🎯

**Completed Milestones:**
- ✅ Milestone 1 - Agent Connection (2026-01-10)
- ✅ Milestone 2 - Container Control (2026-01-10)
- ✅ Milestone 3 - Log Streaming (2026-01-10)

**Next Up:** Milestone 4 - Server Management

**Current Planning:** Planning files will be created when Milestone 4 begins
