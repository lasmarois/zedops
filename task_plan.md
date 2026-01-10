# Task Plan: Milestone 4 - Server Management

**Goal:** Full server lifecycle management - create, configure, deploy, and delete Zomboid servers

**Success Criteria:**
- User fills form → Server created on agent's machine
- Server appears in UI with correct config
- Server starts successfully with configured ENV vars
- User can delete server → Container removed cleanly

**Status:** 🚧 In Progress
**Started:** 2026-01-10

---

## Phase Overview

| Phase | Status | Description |
|-------|--------|-------------|
| 0. Steam-Zomboid Labels | completed | Add zedops.managed labels to steam-zomboid images |
| 1. Research | completed | Understand .env.template, docker-compose generation, server naming |
| 2. Agent Server Management | completed | Implement server create/delete in Go agent |
| 3. Manager API | pending | Add server CRUD endpoints |
| 4. UI Server Form | pending | Create form with ENV variable inputs |
| 5. Testing | pending | End-to-end server lifecycle testing |

---

## Phase 0: Steam-Zomboid Labels

**Status:** completed

**Goals:**
- Add zedops.managed labels to steam-zomboid Docker images
- Support v2.0.0+ versions only (MVP scope)
- Enable container filtering in agent

**Tasks:**
- [x] Checkout latest tag (v2.1.0) in steam-zomboid-dev
- [x] Update Dockerfile to add labels:
  - `zedops.managed=true`
  - `zedops.type=project-zomboid`
  - `pz.rcon.enabled=true`
- [x] Retag v2.1.0 and trigger pipeline
- [x] Test: Inspect container labels
- [x] Merge to master
- [x] Backport labels to v2.0.0, v2.0.1 tags (rebuild)
- [ ] Pull updated images on production servers (user action)

**Files to Modify:**
- `/Volumes/Data/docker_composes/steam-zomboid-dev/.gitlab-ci.yml` - Add LABEL directives
- OR `/Volumes/Data/docker_composes/steam-zomboid-dev/Dockerfile` - Add LABEL directives

**Success Criteria:**
- All v2.0.0+ images have `zedops.managed=true` label
- Can inspect with: `docker inspect <image> --format='{{json .Config.Labels}}'`
- Production servers can pull and use labeled images

**Note:** This work is done in steam-zomboid-dev project, separate from zedops repo.

---

## Phase 1: Research

**Status:** completed

**Goals:**
- Understand steam-zomboid .env.template structure
- Design server naming/identification scheme
- Research docker-compose.yml generation (templating vs. string building)
- Design server state management (where to store server configs)
- Understand Zomboid server file structure (bin.*, data.*)

**Tasks:**
- [x] Read steam-zomboid .env.template to understand all ENV variables
- [x] Review existing docker-compose.yml from steam-zomboid project
- [x] Design server identifier format (name, port allocation)
- [x] Choose approach for docker-compose generation (Docker SDK directly)
- [x] Design database schema for server configs
- [x] Document findings in findings.md
- [x] Design registry and tag configuration strategy

**Questions to Answer:**
- What ENV variables are required vs optional?
- How to allocate ports automatically (avoid conflicts)?
- Where to store docker-compose.yml on agent? (per-server directory?)
- How to handle server names (unique constraint, validation)?
- What happens to bin.*/data.* directories when server deleted?
- Should we use docker-compose or direct Docker API?

---

## Phase 2: Agent Server Management

**Status:** completed

**Goals:**
- Implement server.create command handler
- Deploy container using Docker SDK directly
- Implement server.delete command handler
- Clean up server files on deletion
- Filter containers by zedops.managed label

**Tasks:**
- [x] Update ListContainers to filter by `zedops.managed=true` label
- [x] Add server.create message handler to agent/main.go
  - [x] Receive registry from manager in message payload
  - [x] Receive imageTag from manager in message payload
- [x] Implement Docker SDK container creation in agent/server.go
  - [x] Construct image path from registry + tag (both from message)
  - [x] Create container with proper labels
  - [x] Attach to networks (zomboid-servers, zomboid-backend)
  - [x] Bind mount volumes under /var/lib/zedops/servers/{name}/
  - [x] Set restart policy: unless-stopped
- [x] Add server.delete message handler
- [x] Implement cleanup logic (stop container, remove container, optionally remove volumes)
- [ ] Handle port allocation validation (check conflicts) - Deferred to manager
- [x] Test server creation with various configs and image tags - Compiled successfully

**Files to Create/Modify:**
- agent/main.go - Add server.create, server.delete handlers
- agent/server.go (new) - Server management functions using Docker SDK
- agent/docker.go - Update ListContainers with label filtering
- agent/Dockerfile or docker-compose.yml - Add STEAM_ZOMBOID_REGISTRY env var

**Implementation Details:**
- Registry config: Received from manager in server.create message (looked up from agents table)
- Image construction: `fmt.Sprintf("%s:%s", msg.Data.Registry, msg.Data.ImageTag)`
- Container labels:
  - `zedops.managed=true`
  - `zedops.server.id={uuid}`
  - `zedops.server.name={name}`
  - `pz.rcon.enabled=true`
- Volume paths: `/var/lib/zedops/servers/{name}/bin/` and `/var/lib/zedops/servers/{name}/data/`

**Message Format (server.create):**
```json
{
  "subject": "server.create",
  "data": {
    "serverId": "uuid",
    "name": "myserver",
    "registry": "registry.gitlab.nicomarois.com/nicolas/steam-zomboid",
    "imageTag": "latest",
    "config": { /* ENV variables */ }
  }
}
```

---

## Phase 3: Manager API

**Status:** pending

**Goals:**
- Add server CRUD endpoints to manager
- Store server configs in D1 database
- Route server commands to correct agent
- Validate server configurations
- Handle server lifecycle state

**Tasks:**
- [ ] Create D1 migration for servers table (with image_tag column)
- [ ] Add steam_zomboid_registry column to agents table (default: registry.gitlab.nicomarois.com/nicolas/steam-zomboid)
- [ ] Run migrations: `wrangler d1 execute zedops-db --file=migrations/XXXX_*.sql`
- [ ] Add POST /api/agents/:id/servers (create server)
  - [ ] Look up agent's steam_zomboid_registry from database
  - [ ] Send registry + imageTag to agent in server.create message
  - [ ] Validate server name (DNS-safe regex)
  - [ ] Validate image tag format
  - [ ] Check for name/port conflicts
  - [ ] Auto-suggest next available port
  - [ ] Store server config in D1
  - [ ] Route server.create to agent
- [ ] Add GET /api/agents/:id/servers (list servers)
- [ ] Add DELETE /api/agents/:id/servers/:serverId (delete server)
  - [ ] Route server.delete to agent
  - [ ] Remove from D1 after successful deletion
- [ ] Add validation for server names, ports, ENV vars, image tags
- [ ] Route commands to AgentConnection Durable Object
- [ ] Handle server state transitions (creating → running → deleting)
- [ ] Add error handling for conflicts (name/port already in use)

**Files to Create/Modify:**
- manager/src/routes/agents.ts - Add server endpoints
- manager/src/types/Server.ts (new) - Server types
- D1 migration - Create servers table

**Database Schema:**
```sql
-- Migration 1: Update agents table with registry config
ALTER TABLE agents ADD COLUMN steam_zomboid_registry TEXT NOT NULL DEFAULT 'registry.gitlab.nicomarois.com/nicolas/steam-zomboid';

-- Migration 2: Create servers table
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  container_id TEXT,
  config TEXT NOT NULL, -- JSON of ENV vars
  image_tag TEXT NOT NULL DEFAULT 'latest', -- Docker image tag
  game_port INTEGER NOT NULL,
  udp_port INTEGER NOT NULL,
  rcon_port INTEGER NOT NULL,
  status TEXT NOT NULL, -- creating, running, stopped, failed, deleting
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  UNIQUE(agent_id, name),
  UNIQUE(agent_id, game_port)
);
```

---

## Phase 4: UI Server Form

**Status:** pending

**Goals:**
- Create server creation form component
- Load .env.template variables (or hardcode for MVP)
- Input validation (required fields, port ranges)
- Display server list with status
- Add delete server functionality
- Show server creation progress

**Tasks:**
- [ ] Create ServerForm.tsx component
- [ ] Create ServerList.tsx component (or extend ContainerList)
- [ ] Add form inputs for key ENV variables:
  - Server name (required, unique, DNS-safe)
  - Image version dropdown (required, default: latest)
    - Options: "latest", "2.1", "2.0"
    - Could fetch from registry API (future enhancement)
  - Server public name (optional)
  - Admin password (required)
  - Server password (optional)
  - Default port (required, auto-suggest next available)
  - Beta branch (dropdown: none, build42, etc.)
- [ ] Add form validation
  - Server name: regex `^[a-z][a-z0-9-]{2,31}$`
  - Image tag: semver or "latest"
  - Ports: valid range, no conflicts
- [ ] Implement server creation API call
- [ ] Add loading state during creation
- [ ] Update UI when server created successfully
- [ ] Add delete button with confirmation dialog
- [ ] Handle errors gracefully

**Files to Create:**
- frontend/src/components/ServerForm.tsx
- frontend/src/components/ServerList.tsx
- frontend/src/hooks/useServers.ts
- Update frontend/src/lib/api.ts with server endpoints

**UI Design:**
- Form with collapsible sections (Basic, Advanced, Mods)
- Image Version selector at top (dropdown with semver versions)
- Port auto-suggestion based on existing servers
- Validation feedback inline
- Progress indicator during creation
- Server list shows: name, image version, status, ports, created date
- Actions: View logs, Start/Stop, Delete

---

## Phase 5: Testing

**Status:** pending

**Goals:**
- Test server creation with various configs
- Test server lifecycle (create → start → stop → delete)
- Test validation (duplicate names, port conflicts)
- Test error handling (agent offline, Docker errors)
- Verify file cleanup on deletion

**Test Scenarios:**
1. **Basic Server Creation**
   - Fill minimal required fields
   - Server created and started successfully
   - Appears in container list
   - Can view logs

2. **Full Configuration**
   - Fill all form fields
   - Server created with correct ENV vars
   - ENV vars applied correctly in container

3. **Validation**
   - Try duplicate server name → Error
   - Try invalid port → Error
   - Try missing required fields → Error

4. **Port Conflict**
   - Create server with auto-suggested port
   - Create another server → Port increments

5. **Server Deletion**
   - Stop running server
   - Delete server
   - Container removed from Docker
   - bin.* and data.* directories removed (or kept?)

6. **Error Handling**
   - Agent offline → Cannot create server
   - Docker error → Show error to user
   - Creation fails midway → Clean up partial state

---

## Dependencies

**External:**
- steam-zomboid Docker image
- Docker Compose (or Docker SDK for direct container creation)
- .env.template from steam-zomboid project (for reference)

**Internal:**
- ✅ Milestone 3 complete (log streaming working)
- ✅ Agent can execute Docker operations
- ✅ Manager can route commands to agents

---

## Errors Encountered

| Error | Phase | Attempt | Resolution |
|-------|-------|---------|------------|
| _(none yet)_ | - | - | - |

---

## Design Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Use Docker SDK directly | More programmatic control, easier metadata tracking, no .yml files | 2026-01-10 |
| Port allocation: increment by 2 | Game uses 2 consecutive UDP ports (16261, 16262) | 2026-01-10 |
| Container labels for identification | Filter by `zedops.managed=true`, link to DB with `zedops.server.id` | 2026-01-10 |
| Bind mounts for volumes | Preserve data on deletion, easy backup, under `/var/lib/zedops/servers/` | 2026-01-10 |
| Server name validation regex | DNS-safe lowercase with hyphens: `^[a-z][a-z0-9-]{2,31}$` | 2026-01-10 |
| Manager-side registry + per-server tag | Registry stored in agents table (centrally managed), tag is user choice per server | 2026-01-10 |
| Support v2.0.0+ only for MVP | Requires labels in images, backport to 2.0.x tags | 2026-01-10 |
| Add Phase 0 for steam-zomboid labels | Must add labels before implementing server creation | 2026-01-10 |

---

## Notes

- Consider using Docker SDK directly instead of docker-compose (more control)
- Server names must be DNS-safe (lowercase, hyphens only)
- Port allocation: suggest next available port based on existing servers
- Keep server configs in D1 for persistence across agent restarts
- bin.* and data.* directories should persist on deletion (user data preservation)
- Consider "soft delete" for servers (mark as deleted but keep data)
