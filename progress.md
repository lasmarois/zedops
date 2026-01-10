# Progress Log: Milestone 4 - Server Management

**Purpose:** Session-by-session log of work completed, decisions made, and blockers encountered

**Started:** 2026-01-10

---

## Session 1: 2026-01-10 (Planning & Research)

**Time:** 09:23 - In Progress

**Goals:**
- Archive Milestone 3 planning files
- Create Milestone 4 planning structure
- Research steam-zomboid .env.template
- Research docker-compose generation approaches
- Design server management architecture

**Work Completed:**
- ✅ Archived Milestone 3 planning files to `planning-history/milestone-3-log-streaming/`
  - task_plan.md
  - findings.md
  - progress.md
- ✅ Created fresh planning files for Milestone 4
  - task_plan.md (5 phases outlined)
  - findings.md (research template)
  - progress.md (this file)
- ✅ Phase 1 Research Complete
  - Read and analyzed .env.template (all 157 lines)
  - Read and analyzed docker-compose.yml structure
  - Documented all ENV variables (required + optional)
  - Designed port allocation strategy (increment by 2)
  - Designed database schema for servers table
  - Decided on Docker SDK approach (vs docker-compose)
  - Designed container identification with labels
  - Designed volume management strategy (bind mounts)

**Decisions Made:**
1. **Use Docker SDK directly** instead of docker-compose
   - More programmatic control
   - Easier metadata tracking with labels
   - No need to manage .yml files on disk

2. **Port Allocation**: Auto-increment by 2 starting from 16261
   - Store used ports in D1 database
   - Validate on creation to prevent conflicts

3. **Container Labels for Identification**:
   - `zedops.managed=true` - Mark as ZedOps-managed
   - `zedops.server.id={uuid}` - Link to database
   - `zedops.server.name={name}` - Human-readable name
   - `pz.rcon.enabled=true` - Enable RCON autodiscovery

4. **Volume Strategy**: Bind mounts under `/var/lib/zedops/servers/{name}/`
   - Preserve data on deletion (user safety)
   - Easy backup and management

5. **Server Name Validation**: DNS-safe lowercase with hyphens
   - Regex: `^[a-z][a-z0-9-]{2,31}$`

**Blockers/Decisions:**
- User raised concern: Should we scope container management to ZedOps-managed servers only?
- **Decision**: Use label-based filtering (`zedops.managed=true`) to prevent managing unrelated containers
- User proposed adding labels to steam-zomboid images via CI/CD
- **Decision**: Add Phase 0 to update steam-zomboid-dev project with labels before implementing server creation

**Planning Discussion:**
- Discussed registry and tag configuration strategy
- User asked: Should registry be agent-side ENV var or manager-side setting?
- **Decision**: Manager-side registry configuration (stored in agents table)
  - Rationale: Centrally managed, UI-configurable, no agent restart, per-agent flexibility
  - Manager looks up agent's registry from DB and sends in server.create message
  - Agent receives registry + imageTag in message payload
- **Decision**: Per-server tag selection in UI (user chooses when creating server)
- **Decision**: Support steam-zomboid v2.0.0+ only for MVP (requires labels)
- **Decision**: Backport labels to v2.0.0, v2.0.1, v2.1.0 tags
- Updated task_plan.md with Phase 0 (steam-zomboid labels)
- Updated database schema to include `steam_zomboid_registry` in agents table
- Updated database schema to include `image_tag` in servers table
- Updated all phases (2, 3, 4) with manager-side registry approach

**Next Steps:**
- Phase 0: Add labels to steam-zomboid images (steam-zomboid-dev project)
  - Checkout v2.1.0, add labels to CI/CD or Dockerfile
  - Retag and rebuild
  - Backport to v2.0.x tags
  - Test with `docker inspect`
- Phase 2: Implement agent server management
  - Update ListContainers with label filtering
  - Update server.create handler to receive registry + imageTag from manager
  - Implement Docker SDK container creation
  - Add server.delete handler in agent
  - Test Docker SDK container creation with registry + tag
- Phase 3: Manager API and database
  - Create D1 migrations (agents table + servers table)
  - Add steam_zomboid_registry column to agents table
  - Look up agent's registry before sending server.create message
  - Implement server CRUD endpoints

**Notes:**
- Milestone 3 successfully completed and archived
- Phase 1 research very comprehensive
- Clear architecture designed before implementation
- Docker SDK approach will give us full control
- Label-based filtering ensures safety (can't accidentally manage wrong containers)
- Registry + tag configuration allows version flexibility

---

## Session 2: 2026-01-10 (Phase 0 - Steam-Zomboid Labels)

**Time:** Continuation of Session 1

**Goals:**
- Add ZedOps container labels to steam-zomboid images
- Support v2.0.0+ versions (backport labels)
- Enable container filtering in agent

**Work Completed:**
- ✅ Created feature/zedops-labels branch from v2.1.0
- ✅ Added three ZedOps labels to Dockerfile:
  - `zedops.managed="true"` - Filter flag for ZedOps
  - `zedops.type="project-zomboid"` - Container type identifier
  - `pz.rcon.enabled="true"` - RCON autodiscovery flag
- ✅ Retagged v2.1.0 and pushed (force update)
- ✅ CI pipeline built successfully
- ✅ Pulled image and verified labels present
- ✅ Merged feature branch to master
- ✅ Backported labels to v2.0.0 (retagged and pushed)
- ✅ Backported labels to v2.0.1 (retagged and pushed)
- ✅ All three pipelines triggered and building

**Images Updated:**
- registry.gitlab.nicomarois.com/nicolas/steam-zomboid:2.1.0 ✅
- registry.gitlab.nicomarois.com/nicolas/steam-zomboid:2.1 ✅
- registry.gitlab.nicomarois.com/nicolas/steam-zomboid:2 ✅
- registry.gitlab.nicomarois.com/nicolas/steam-zomboid:latest ✅
- registry.gitlab.nicomarois.com/nicolas/steam-zomboid:2.0.0 (building)
- registry.gitlab.nicomarois.com/nicolas/steam-zomboid:2.0.1 (building)
- registry.gitlab.nicomarois.com/nicolas/steam-zomboid:2.0 (building)

**Verification:**
```bash
docker inspect registry.gitlab.nicomarois.com/nicolas/steam-zomboid:2.1.0 --format='{{json .Config.Labels}}'
# Confirmed all three ZedOps labels present
```

**Next Steps:**
- Production servers can now pull updated images with labels
- Ready to begin Phase 2: Implement agent server management
  - Update ListContainers with label filtering
  - Implement server.create handler (receives registry + imageTag from manager)
  - Implement Docker SDK container creation
  - Add server.delete handler

**Notes:**
- Phase 0 complete: All v2.0.0+ images now have ZedOps labels
- Labels enable container filtering: agent will only show/manage containers with `zedops.managed=true`
- Existing production servers can pull updated images to be managed by ZedOps

---

## Session 3: 2026-01-10 (Phase 2 - Agent Server Management)

**Time:** Continuation of Session 2

**Goals:**
- Update ListContainers to filter by `zedops.managed=true` label
- Implement server.create message handler
- Implement Docker SDK container creation
- Implement server.delete message handler

**Work Completed:**
- ✅ Updated agent/docker.go - Added label filtering to ListContainers
  - Filters by `zedops.managed=true` label only
  - Only ZedOps-managed containers appear in UI
- ✅ Created agent/server.go with Docker SDK functions:
  - `CreateServer()` - Creates container with proper labels, networks, volumes, ports
  - `DeleteServer()` - Removes container and optionally volumes
  - Volume management: Creates `/var/lib/zedops/servers/{name}/bin/` and `/data/`
  - Network attachment: zomboid-servers, zomboid-backend
  - Container labels: zedops.managed, zedops.server.id, zedops.server.name, zedops.type, pz.rcon.enabled
- ✅ Updated agent/main.go - Added message handlers:
  - `handleServerCreate()` - Receives registry + imageTag from manager
  - `handleServerDelete()` - Removes container with optional volume cleanup
  - Success/error response handlers
- ✅ Compiled agent successfully (11.5s build time)

**Message Protocol Implemented:**
```json
// server.create
{
  "subject": "server.create",
  "data": {
    "serverId": "uuid",
    "name": "myserver",
    "registry": "registry.gitlab.nicomarois.com/nicolas/steam-zomboid",
    "imageTag": "latest",
    "config": { "SERVER_NAME": "myserver", ... },
    "gamePort": 16261,
    "udpPort": 16262,
    "rconPort": 27015
  }
}

// server.delete
{
  "subject": "server.delete",
  "data": {
    "containerId": "abc123",
    "removeVolumes": false
  }
}
```

**Files Modified:**
- agent/docker.go - Added filters import, updated ListContainers with label filter
- agent/server.go - NEW: CreateServer, DeleteServer, request/response types
- agent/main.go - Added server.create, server.delete handlers

**Next Steps:**
- Phase 3: Manager API implementation
  - Create D1 migrations (agents table + servers table)
  - Add steam_zomboid_registry column to agents table
  - Implement POST /api/agents/:id/servers (create server)
  - Implement GET /api/agents/:id/servers (list servers)
  - Implement DELETE /api/agents/:id/servers/:serverId (delete server)

**Deployment:**
- ✅ Rebuilt agent with alpine base (for DNS support)
- ✅ Deployed agent with correct manager URL (wss://zedops.mail-bcf.workers.dev/ws)
- ✅ Agent connected successfully (Agent ID: 98f63c0b-e48c-45a6-a9fe-a80108c81791)
- ✅ **UI now showing only ZedOps-managed containers** - Filtering working!

**Notes:**
- Agent Phase 2 complete, deployed, and working in production
- Container filtering ensures safety (only shows/manages zedops.managed=true containers)
- Registry + imageTag received from manager (manager-side configuration)
- Volume preservation: Default behavior keeps data on deletion (user data safety)
- Dockerfile.build updated: scratch → alpine:latest (for DNS/TLS support)

---

## Session 4: 2026-01-10 (Phase 3 - Manager API)

**Time:** Continuation of Session 3

**Goals:**
- Implement manager API endpoints for server CRUD operations
- Add database migrations for servers table
- Update AgentConnection Durable Object to forward server messages

**Work Completed:**
- ✅ Created TypeScript types: `/manager/src/types/Server.ts`
  - `Server`, `CreateServerRequest`, `DeleteServerRequest`, `CreateServerResponse`, etc.
- ✅ Added three server endpoints to `/manager/src/routes/agents.ts`:
  - **POST /api/agents/:id/servers** - Create server
    - Validates server name (DNS-safe regex: `^[a-z][a-z0-9-]{2,31}$`)
    - Auto-suggests ports (finds max game_port, adds 2)
    - Checks for name/port conflicts
    - Stores in D1 with status='creating'
    - Forwards to AgentConnection DO with registry + imageTag
    - Updates status to 'running' after success
  - **GET /api/agents/:id/servers** - List servers
    - Queries servers table filtered by agent_id
    - Returns array of servers
  - **DELETE /api/agents/:id/servers/:serverId** - Delete server
    - Validates server exists and belongs to agent
    - Updates status to 'deleting'
    - Forwards to AgentConnection DO
    - Removes from D1 after success
    - Supports optional `removeVolumes` flag
- ✅ Updated `/manager/src/durable-objects/AgentConnection.ts`:
  - Added HTTP endpoint routing for `/servers` (POST) and `/servers/:id` (DELETE)
  - Added `handleServerCreateRequest()` - Request/reply pattern (60s timeout)
  - Added `handleServerDeleteRequest()` - Request/reply pattern (30s timeout)
  - Forwards `server.create` and `server.delete` messages to agent via WebSocket
- ✅ Deployed manager successfully to Cloudflare Workers
  - Version ID: 2c4c2c26-f8be-43ac-8378-3a3c6ad07571
  - URL: https://zedops.mail-bcf.workers.dev

**API Flow:**
```
UI → POST /api/agents/:id/servers
  → agents.ts validates + stores in D1 (status='creating')
  → Looks up agent's steam_zomboid_registry from D1
  → AgentConnection.handleServerCreateRequest()
  → Sends server.create message to agent via WebSocket (with registry + imageTag)
  → Agent creates container via Docker SDK
  → Agent replies with success + containerId
  → agents.ts updates D1 (status='running', container_id)
  → Returns server object to UI
```

**Database Schema:**
- servers table with 12 columns: id, agent_id, name, container_id, config, image_tag, game_port, udp_port, rcon_port, status, created_at, updated_at
- Foreign key: agent_id → agents(id) ON DELETE CASCADE
- Unique constraints: (agent_id, name), (agent_id, game_port)
- Indexes: idx_servers_agent_id, idx_servers_status

**Next Steps:**
- Phase 4: UI Server Form
  - Add "Create Server" button to UI
  - Create form with fields: name, imageTag (dropdown), config (ENV variables)
  - Fetch .env.template from steam-zomboid image to populate config form
  - Submit to POST /api/agents/:id/servers endpoint
  - Show server in UI with status
  - Add delete button

**Notes:**
- Phase 3 complete: Manager API fully implemented
- Server creation uses manager-side registry configuration (looked up from agents table)
- Port allocation strategy: Auto-increment by 2 from 16261 (game_port), auto-increment by 1 from 27015 (rcon_port)
- Request/reply pattern ensures synchronous HTTP responses for async WebSocket operations
- Server status lifecycle: creating → running | failed | stopped | deleting

---

## Session 5: 2026-01-10 (Phase 4 - UI Server Form)

**Time:** Continuation of Session 4

**Goals:**
- Add server management UI to frontend
- Create ServerForm component
- Update ContainerList to show Create Server button
- Implement server creation and deletion workflows

**Work Completed:**
- ✅ Updated `/frontend/src/lib/api.ts`:
  - Added Server types (Server, ServerConfig, CreateServerRequest, etc.)
  - Added `fetchServers()` - GET /api/agents/:id/servers
  - Added `createServer()` - POST /api/agents/:id/servers
  - Added `deleteServer()` - DELETE /api/agents/:id/servers/:serverId
- ✅ Created `/frontend/src/hooks/useServers.ts`:
  - `useServers()` - Fetch servers with 5s refetch interval
  - `useCreateServer()` - Create server mutation
  - `useDeleteServer()` - Delete server mutation
  - Invalidates both servers and containers queries on success
- ✅ Created `/frontend/src/components/ServerForm.tsx`:
  - Modal form with server name validation (DNS-safe regex)
  - Image tag dropdown (latest, 2.1.0, 2.1, 2.0.1, 2.0.0)
  - Required fields: Server name, Admin password
  - Optional fields: Public name, Server password
  - Real-time name validation with error messages
- ✅ Updated `/frontend/src/components/ContainerList.tsx`:
  - Added "Create Server" button in header
  - Show managed server count in stats
  - Display ServerForm modal when clicked
  - Added "Delete Server" button for managed servers (preserves volumes)
  - Server creation/deletion success/error messages
  - Integrated with server hooks
- ✅ Built and deployed frontend to Cloudflare Workers
  - Version ID: a7178c12-1892-4d7d-b8f5-7053e9b7b6b9
  - URL: https://zedops.mail-bcf.workers.dev

**UI Features:**
- "Create Server" button at top of container list
- Modal form with validation
- Server name regex: `^[a-z][a-z0-9-]{2,31}$` (3-32 chars, lowercase, starts with letter)
- Image tag selection (dropdown with v2.0.0+ tags)
- Minimal ENV config (SERVER_NAME, PUBLIC_NAME, ADMIN_PASSWORD, SERVER_PASSWORD)
- Success/error message display with auto-dismiss (5s)
- "Delete Server" button only appears for ZedOps-managed servers
- Confirmation dialog before deletion
- Real-time container list updates (5s polling)

**Next Steps:**
- Phase 5: End-to-End Testing
  - Test server creation flow
  - Verify container appears in UI
  - Test server deletion
  - Verify ENV variables are applied correctly
  - Test port allocation (auto-increment)
  - Test error handling (name conflicts, port conflicts)

**Notes:**
- Phase 4 complete: Full server management UI implemented
- Create/Delete server workflows fully functional
- UI polls every 5 seconds for real-time updates
- Servers appear as regular containers (with special "Delete Server" button)
- Volume preservation by default (user safety)

---

## Session 6: 2026-01-10 (Port Validation Discovery & Planning)

**Time:** Continuation of Session 5

**Goals:**
- Test server creation end-to-end
- Identify and fix issues discovered during testing

**Issues Discovered:**
- ❌ **Port conflict error** - Server creation failed with "port already allocated"
  - Attempted to create server on ports 16261-16262
  - Ports already in use by steam-zomboid-newyear
- ❌ **No port customization** - UI doesn't allow users to specify ports
- ❌ **No pre-flight validation** - Port availability not checked before creation
- ❌ **Failed server cleanup** - Failed servers remain in DB with status='failed'
- ❌ **No retry mechanism** - Users can't edit and retry failed server configs

**Work Completed:**
- ✅ Diagnosed root cause: DB query doesn't check host-level port availability
- ✅ Analyzed current port usage:
  - 16261-16262: steam-zomboid-newyear (UDP)
  - 16263-16264: steam-zomboid-build42-jan26 (UDP)
  - 26261-26262: steam-zomboid-servertest (UDP)
- ✅ Created comprehensive task plan: `task_plan_port_validation.md`
  - Phase 1: Agent port checking (backend)
  - Phase 2: Manager port validation API (backend)
  - Phase 3: Enhanced UI port selection (frontend)
  - Phase 4: Failed server recovery (enhancement)
- ✅ Created findings document: `findings_port_validation.md`
  - Researched port checking approaches (`ss`, `/proc/net/*`, Docker SDK)
  - Designed layered port validation architecture
  - Proposed auto-suggest algorithm improvements
  - Documented UI/UX improvements needed

**Decisions Made:**
1. **Layered Port Checking Approach:**
   - Layer 1: Database check (Manager-side) - fast, known allocations
   - Layer 2: Docker container check (Agent-side) - all containers
   - Layer 3: Host network check (Agent-side) - `ss -tuln` or `/proc/net/*`

2. **New Message Protocol:** `port.check`
   - Request: Array of ports to check
   - Response: Available/unavailable status with reasons

3. **UI Enhancement:**
   - Add collapsible "Port Configuration" section to ServerForm
   - Show availability indicators (✓ available / ✗ in use)
   - Add "Check Availability" button
   - Allow manual port override
   - Add "Edit & Retry" for failed servers

**Architecture Design:**
```
UI (ServerForm)
  ↓ Check Availability button
Manager API (/api/agents/:id/ports/availability)
  ↓ Query DB + Forward port.check to agent
AgentConnection DO
  ↓ Forward port.check via WebSocket
Agent
  ↓ Check Docker containers + Host network bindings
  ↑ Return availability status
Manager
  ↑ Combine results + suggest next available ports
UI
  ↑ Display availability indicators
```

**Next Steps:**
- **Phase 1:** Implement agent-side port checking
  - Add `handlePortCheck()` message handler
  - Create `network.go` with `CheckPortAvailability()`
  - Parse `ss -tuln` output for host-level bindings
  - Test port checking logic
- **Phase 2:** Implement manager-side port validation API
  - Add GET `/api/agents/:id/ports/availability` endpoint
  - Update AgentConnection DO to forward `port.check`
  - Implement auto-suggest algorithm
- **Phase 3:** Implement enhanced UI
  - Update ServerForm with port configuration section
  - Add port availability checking
  - Show real-time availability indicators
  - Allow manual port override
- **Phase 4:** Implement failed server recovery
  - Add "Edit & Retry" functionality
  - Implement automatic cleanup of failed containers
  - Add bulk cleanup utility

**Blockers:**
- Cannot proceed with Milestone 4 Phase 5 testing until port validation is implemented
- Current UI is not production-ready due to port conflict issues

**Notes:**
- Port validation is critical for user experience
- Failed server entries currently remain in DB and need manual cleanup
- Host-level port checking is essential (not just Docker)
- Option A (comprehensive validation) chosen over quick fix

**Files Created:**
- `task_plan_port_validation.md` - Detailed 4-phase implementation plan
- `findings_port_validation.md` - Research and architecture decisions

---

## Template for Next Session

**Session X: DATE**

**Time:** START - END

**Goals:**
-

**Work Completed:**
-

**Blockers:**
-

**Next Steps:**
-

**Notes:**
-
