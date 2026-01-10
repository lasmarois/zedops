# ZedOps Milestones

**Status Legend:**
- ⏳ **Planned** - Not started yet
- 🚧 **In Progress** - Currently being worked on
- ✅ **Complete** - Finished and tested

---

## Milestone 1: Agent Connection ⏳ Planned

**Goal:** Establish WebSocket connection between agent and manager using NATS-inspired message protocol

**Duration:** 1-2 weeks

**Deliverables:**
- Agent registration flow (ephemeral token → permanent token)
- WebSocket connection to Cloudflare Durable Object
- Manager UI shows agent status (online/offline)
- Basic auth (hardcoded admin for MVP)
- NATS-inspired message protocol (subject-based routing, request/reply)

**Success Criteria:**
- Agent can register and connect to manager
- Manager displays "Agent online ✓" in UI
- Connection survives network interruptions (reconnect logic)
- Messages can be sent bidirectionally

**Planning:** [planning-history/milestone-1-agent-connection/](planning-history/milestone-1-agent-connection/) *(not started)*

---

## Milestone 2: Container Control ⏳ Planned

**Goal:** Agent can list and control Docker containers via manager commands

**Duration:** 2 weeks

**Deliverables:**
- Agent lists Docker containers (via Docker SDK)
- Manager sends start/stop/restart commands
- Agent executes Docker operations
- UI displays container list with status
- UI has buttons to start/stop/restart containers

**Success Criteria:**
- User clicks "Start Server" in UI → Container starts on agent's machine
- Container status updates in real-time
- Error handling for failed operations

**Dependencies:** Milestone 1 (Agent Connection)

**Planning:** *(not started)*

---

## Milestone 3: Log Streaming ⏳ Planned

**Goal:** Real-time log streaming from containers to UI

**Duration:** 1 week

**Deliverables:**
- Agent streams container logs via WebSocket
- Durable Object forwards logs to UI clients (pub/sub)
- UI displays real-time logs with auto-scroll
- Log filtering (by server, by level)
- Last 1000 lines cached for new UI connections

**Success Criteria:**
- User opens log viewer → sees live logs streaming
- Logs appear in UI <100ms after container outputs
- Multiple users can watch same logs simultaneously

**Dependencies:** Milestone 2 (Container Control)

**Planning:** *(not started)*

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

## Roadmap Timeline (Estimated)

| Milestone | Duration | Cumulative |
|-----------|----------|------------|
| M1: Agent Connection | 1-2 weeks | 2 weeks |
| M2: Container Control | 2 weeks | 4 weeks |
| M3: Log Streaming | 1 week | 5 weeks |
| M4: Server Management | 2-3 weeks | 8 weeks |
| M5: RCON Integration | 2 weeks | 10 weeks |
| M6: RBAC & Audit Logs | 2 weeks | 12 weeks |

**Total to MVP:** ~12 weeks (3 months)

**Note:** These are estimates. Actual duration will vary based on:
- Complexity discovered during implementation
- Scope changes
- Testing and bug fixes
- Learning curve with Cloudflare stack

---

## Current Status

**Active Milestone:** None (project in setup phase)

**Next Up:** Milestone 1 - Agent Connection

**To start:** Use planning-with-files skill to create detailed plan for Milestone 1
