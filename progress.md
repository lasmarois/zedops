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
