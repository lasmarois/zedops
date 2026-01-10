# Findings: Milestone 4 - Server Management

**Purpose:** Research findings, discoveries, and technical decisions for server management implementation

**Started:** 2026-01-10

---

## Research Topics

### 1. Steam Zomboid .env.template Structure ✅

**Required Fields:**
- `SERVER_NAME` - Unique identifier (must match INI file)
- `ADMIN_PASSWORD` - Admin account password (first startup only)
- `SERVER_DEFAULT_PORT` - Game port 1 (UDP)
- `SERVER_UDP_PORT` - Game port 2 (UDP)
- `RCON_PORT` - RCON management port (internal)
- `RCON_PASSWORD` - RCON authentication

**Optional Fields:**
- `SERVER_PASSWORD` - Player join password (empty = public)
- `SERVER_PUBLIC_NAME` - Name shown in server browser
- `BETABRANCH` - Game version (none, unstable, build41, etc.)
- `IMAGE_TAG` - Docker image version (default: latest)
- `PUID` - File permissions UID (default: 1430)
- `TZ` - Timezone (default: America/New_York)

**Bootstrap Settings (Optional):**
- `SERVER_WELCOME_MESSAGE` - Welcome banner
- `SERVER_PUBLIC_DESCRIPTION` - Server browser description
- `SERVER_PUBLIC` - Show in public browser (true/false)
- `SERVER_MAP` - World map selection
- `SERVER_MAX_PLAYERS` - Player limit (1-100)
- `SERVER_OPEN` - Allow non-whitelisted players
- `SERVER_PVP` - Enable PvP combat
- `SERVER_PAUSE_EMPTY` - Pause when empty
- `SERVER_GLOBAL_CHAT` - Enable global chat

**Mod Management:**
- `SERVER_MODS` - Semicolon-separated mod IDs
- `SERVER_WORKSHOP_ITEMS` - Semicolon-separated Workshop IDs

### 2. Docker Compose vs Docker SDK ✅

**Decision: Use Docker SDK directly**

**Rationale:**
- More programmatic control (create/modify containers in code)
- No need to manage docker-compose.yml files on disk
- Easier to track container metadata
- Can attach labels for identification
- Direct API access for all operations

**Implementation:**
- Use Go Docker SDK (already used in agent)
- Create containers with proper network attachments
- Use labels to mark "managed" servers: `zedops.managed=true`, `zedops.server.name={name}`
- Volumes: Create named volumes or bind mounts (bin.{name}, data.{name})

### 3. Port Allocation Strategy ✅

**Port Requirements per Server:**
- Game Port 1 (UDP): Base port (e.g., 16261)
- Game Port 2 (UDP): Base port + 1 (e.g., 16262)
- RCON Port (TCP, internal): 27015+

**Allocation Strategy:**
1. **Default starting port**: 16261
2. **Increment by 2** for each server (16261, 16263, 16265, ...)
3. **Store used ports** in D1 database (servers table)
4. **Auto-suggest**: Query existing servers, find highest port, add 2
5. **Validation**: Check for conflicts before creation

**Port Ranges:**
- Game ports: 16261-16299 (supports ~20 servers)
- RCON ports: 27015-27035 (supports ~20 servers)

### 4. Server State Management ✅

**Database Schema (D1):**
```sql
CREATE TABLE servers (
  id TEXT PRIMARY KEY,              -- UUID
  agent_id TEXT NOT NULL,           -- Foreign key to agents
  name TEXT NOT NULL,               -- Server identifier (DNS-safe)
  container_id TEXT,                -- Docker container ID (null if not created)
  config TEXT NOT NULL,             -- JSON of ENV variables
  image_tag TEXT NOT NULL DEFAULT 'latest', -- Docker image tag (latest, 2.1.0, etc.)
  game_port INTEGER NOT NULL,       -- SERVER_DEFAULT_PORT
  udp_port INTEGER NOT NULL,        -- SERVER_UDP_PORT
  rcon_port INTEGER NOT NULL,       -- RCON_PORT
  status TEXT NOT NULL,             -- creating, running, stopped, failed, deleting
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  UNIQUE(agent_id, name),
  UNIQUE(agent_id, game_port)
);
```

**State Transitions:**
- creating → running (success)
- creating → failed (error)
- running → stopped (user action or container exit)
- stopped → running (restart)
- running/stopped → deleting (delete initiated)
- deleting → (removed from DB)

**Container Identification:**
- Label: `zedops.managed=true`
- Label: `zedops.server.id={server_id}`
- Label: `zedops.server.name={name}`
- Container name: `steam-zomboid-{name}`

### 5. Registry & Image Tag Configuration ✅

**Decision: Agent-level registry + Per-server tag selection**

**Rationale:**
- Registry is infrastructure-level (where to pull images)
- Tag is user choice (which version to run)
- Allows different servers to run different versions
- Supports versioned rollouts and testing

**Implementation:**

**A) Manager-Side Registry Configuration**
- Stored in D1 database: `agents.steam_zomboid_registry` column
- Default: `registry.gitlab.nicomarois.com/nicolas/steam-zomboid`
- Configured per-agent (allows different registries per agent)
- UI-configurable (no agent restart required)
- Manager sends registry to agent in server.create message

**B) Per-Server Tag Selection**
- Stored in database: `image_tag` column
- UI dropdown: "latest", "2.1", "2.0", etc.
- Default: "latest"
- Validated format: semver or "latest"
- Passed to Docker SDK: `{registry}:{tag}`

**C) Container Label Requirements**
- Steam-zomboid images must have labels (v2.0.0+):
  - `zedops.managed=true` - Marks as ZedOps-compatible
  - `zedops.type=project-zomboid` - Container type
  - `pz.rcon.enabled=true` - RCON autodiscovery

**D) Container Filtering**
- Agent filters containers by `zedops.managed=true` label
- Only shows ZedOps-managed servers in UI
- Prevents accidental management of unrelated containers
- Existing production servers can add label to be managed

**Version Support:**
- MVP: Only support steam-zomboid v2.0.0+
- Labels added to CI/CD pipeline for v2.0.0, v2.0.1, v2.1.0+
- Older versions unsupported (no labels)

---

## Technical Discoveries

### Docker SDK Container Creation

**Required Parameters:**
```go
// Image constructed from registry (from manager) + tag (from user)
// Registry comes from server.create message (looked up from agents table in D1)
registry := "registry.gitlab.nicomarois.com/nicolas/steam-zomboid" // from msg.Data.Registry
imageTag := "latest" // from msg.Data.ImageTag
fullImage := fmt.Sprintf("%s:%s", registry, imageTag)

container.Config{
    Image: fullImage, // e.g., registry.gitlab.nicomarois.com/nicolas/steam-zomboid:latest
    Env: []string{
        "SERVER_NAME=myserver",
        "ADMIN_PASSWORD=secret",
        // ... all ENV vars
    },
    Labels: map[string]string{
        "zedops.managed": "true",
        "zedops.server.id": "uuid",
        "zedops.server.name": "myserver",
        "pz.rcon.enabled": "true", // For RCON autodiscovery
    },
}

container.HostConfig{
    Binds: []string{
        "/path/to/bin.myserver:/home/steam/zomboid-dedicated",
        "/path/to/data.myserver:/home/steam/Zomboid",
    },
    PortBindings: nat.PortMap{
        "16261/udp": []nat.PortBinding{{HostPort: "16261"}},
        "16262/udp": []nat.PortBinding{{HostPort: "16262"}},
    },
    RestartPolicy: container.RestartPolicy{Name: "unless-stopped"},
}

network.NetworkingConfig{
    EndpointsConfig: map[string]*network.EndpointSettings{
        "zomboid-servers": {},
        "zomboid-backend": {},
    },
}
```

### Server Name Validation

**Rules:**
- Lowercase alphanumeric + hyphens only
- Must start with letter
- 3-32 characters
- No consecutive hyphens
- Regex: `^[a-z][a-z0-9-]{2,31}$`

### Volume Management

**Strategy: Bind Mounts**
- Base path: `/var/lib/zedops/servers/{server_name}/`
- Bin directory: `/var/lib/zedops/servers/{server_name}/bin/`
- Data directory: `/var/lib/zedops/servers/{server_name}/data/`
- Create directories before container creation
- Preserve on deletion (user data safety)

---

## Example Configurations

*(Example server configs will be added here)*

---

## References

- steam-zomboid project: `/Volumes/Data/docker_composes/steam-zomboid-dev/`
- Existing production servers: `/Volumes/Data/docker_composes/steam-zomboid-servers/`
- Docker SDK Go docs: https://docs.docker.com/engine/api/sdk/
