# Findings: Milestone 2 - Container Control

**Purpose:** Track research discoveries, architectural findings, and implementation insights

**Last Updated:** 2026-01-10

---

## Research Findings

### Docker SDK for Go

**Official Docker SDK:**
- Package: `github.com/docker/docker/client`
- Maintained by Docker Inc.
- Full Docker Engine API coverage
- Well documented

**Key Features:**
- Container operations: List, Start, Stop, Restart, Remove, Inspect
- Network operations
- Volume operations
- Image operations
- Connect to Docker daemon via socket (/var/run/docker.sock)

**Usage Example:**
```go
import "github.com/docker/docker/client"

cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
if err != nil {
    panic(err)
}

containers, err := cli.ContainerList(ctx, types.ContainerListOptions{All: true})
```

**Decision:** Use official Docker SDK (github.com/docker/docker/client)

**Rationale:**
- Official support from Docker
- Comprehensive API coverage
- Well tested and maintained
- Already used by docker-compose, docker CLI, etc.

---

## Message Protocol Design

### NATS Subjects for Container Operations

Based on Milestone 1's NATS-inspired protocol:

**Agent → Manager:**
- `container.list.response` - Response to list request with container array
- `container.operation.success` - Container operation succeeded
- `container.operation.error` - Container operation failed

**Manager → Agent:**
- `container.list` - Request list of all containers
- `container.start` - Start container by ID
- `container.stop` - Stop container by ID
- `container.restart` - Restart container by ID
- `container.inspect` - Get detailed container info

**UI → Manager → Agent Flow:**
1. UI sends WebSocket message to manager
2. Manager forwards to agent's Durable Object
3. Agent executes Docker operation
4. Agent sends response back to manager
5. Manager forwards response to UI

**Challenge:** How to route messages to specific agents?
- UI needs to specify target agent ID in message
- Manager looks up agent's Durable Object by ID
- Manager forwards message to that Durable Object

---

## Container Metadata

### Minimum Required Fields

From Docker API response:
- **ID** - Container unique identifier (64-char hex)
- **Names** - Array of container names (e.g., ["/steam-zomboid-servertest"])
- **Image** - Image name (e.g., "ghcr.io/nicomarois/steam-zomboid:latest")
- **State** - Container state (created, running, paused, restarting, removing, exited, dead)
- **Status** - Human-readable status (e.g., "Up 2 hours", "Exited (0) 5 minutes ago")
- **Created** - Unix timestamp of creation

### Optional but Useful Fields

- **Ports** - Port mappings (e.g., [{PrivatePort: 16261, PublicPort: 16261, Type: "udp"}])
- **Labels** - Container labels (useful for filtering Zomboid servers)
- **Networks** - Networks container is connected to

**Decision:** Start with minimum fields, add optional fields as needed

---

## UI Architecture

### Existing Structure (from Milestone 1)

**State Management:**
- Zustand for auth state (`frontend/src/stores/authStore.ts`)
- TanStack Query for API calls (`frontend/src/hooks/useAgents.ts`)

**Components:**
- Login.tsx - Password authentication
- AgentList.tsx - Display agents

**API Client:**
- `frontend/src/lib/api.ts` - Fetch functions

### Proposed Structure for Milestone 2

**New Store:**
- `containerStore.ts` - Container state per agent (Map<agentId, Container[]>)

**New Components:**
- `ContainerList.tsx` - Display containers for selected agent
- `ContainerRow.tsx` - Single container with action buttons

**WebSocket Integration:**
- Need to establish WebSocket connection from UI to manager
- Currently using REST API only (GET /api/agents)
- For real-time updates, need WebSocket

**Decision:** Add WebSocket connection to UI
- Connect to wss://manager/ws on login
- Send/receive container control messages
- Auto-update container status on push from agent

---

## Docker Socket Permissions

**Issue:** Docker daemon socket requires root or docker group membership

**Solutions:**
1. Run agent as root (not recommended)
2. Add agent user to docker group (common practice)
3. Use sudo for docker commands (requires passwordless sudo)

**Recommended:** Add agent user to docker group

**Commands:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply group changes (or re-login)
newgrp docker

# Test access
docker ps
```

**Note:** Document in deployment guide

---

## Filtering Containers

**Question:** Should agent list ALL containers or only Zomboid servers?

**Options:**
1. **List all containers** - Let UI filter/group
2. **Filter by label** - Only containers with specific label (e.g., `zomboid=true`)
3. **Filter by image** - Only containers using steam-zomboid image

**Decision:** List all containers initially
- Simpler implementation
- More flexible (can manage other containers too)
- Can add filtering later if needed

**Future Enhancement:**
- Add label filter option (container.list with filter param)
- UI checkbox to "Show only Zomboid servers"

---

## Real-time Updates

**Question:** How should UI get real-time container status updates?

**Options:**
1. **Polling** - UI requests container.list every N seconds
2. **Push** - Agent monitors Docker events, pushes updates
3. **Hybrid** - Poll on interval, push on manual operations

**Decision:** Start with hybrid approach
- UI polls every 10 seconds for fresh data
- Agent sends immediate update after user-initiated operations
- Phase 2 optimization: Add Docker event monitoring

**Docker Events API:**
```go
// Future enhancement
msgs, errs := cli.Events(ctx, types.EventsOptions{})
for {
    select {
    case msg := <-msgs:
        // Container started, stopped, died, etc.
        // Push update to manager
    case err := <-errs:
        // Handle error
    }
}
```

---

## Error Handling

### Categories of Errors

1. **Docker Daemon Errors**
   - Daemon unreachable (socket not found)
   - Permission denied (user not in docker group)
   - API version mismatch

2. **Container Operation Errors**
   - Container not found
   - Container already started/stopped
   - Operation timeout

3. **Network Errors**
   - WebSocket connection lost during operation
   - Message delivery failure

### Error Response Format

```typescript
interface ContainerError {
    error: string;          // Error message
    code: string;           // Error code (e.g., "DOCKER_DAEMON_UNREACHABLE")
    containerID?: string;   // Container ID if applicable
    operation?: string;     // Operation that failed (start, stop, etc.)
}
```

**Decision:** Use structured error codes
- Allows UI to show specific help messages
- Enables error tracking/analytics later

---

## Next Steps

1. Implement Docker client wrapper in Go
2. Define message types in TypeScript/Go
3. Add container handlers to AgentConnection
4. Create UI components
5. Test end-to-end flow

---

## Questions to Resolve

- [ ] Should agent buffer container status updates or always query fresh from Docker?
- [ ] How to handle agent with no containers? Empty state in UI?
- [ ] Should we support docker-compose operations or just individual containers?
- [ ] Rate limiting for container operations? (prevent spam clicking "restart")

---

## References

- Docker Go SDK: https://pkg.go.dev/github.com/docker/docker/client
- Docker Engine API: https://docs.docker.com/engine/api/
- Milestone 1 message protocol: `manager/src/types/Message.ts`
