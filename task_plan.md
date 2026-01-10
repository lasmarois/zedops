# Task Plan: Milestone 2 - Container Control

**Goal:** Agent can list and control Docker containers via manager commands

**Success Criteria:**
- User clicks "Start Server" in UI → Container starts on agent's machine
- Container status updates in real-time
- Error handling for failed operations

**Status:** 🚧 In Progress
**Started:** 2026-01-10

---

## Phase Overview

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Research | complete | Docker SDK options, message protocol design, UI architecture |
| 2. Agent Docker Integration | complete | Implement Docker client in Go agent |
| 3. Message Protocol | in_progress | Define container control messages (list, start, stop, restart) |
| 4. Manager Message Handlers | pending | Add container control handlers to AgentConnection |
| 5. UI Container List | pending | Display containers in React UI |
| 6. UI Container Actions | pending | Start/stop/restart buttons with real-time updates |
| 7. Testing | pending | End-to-end validation of all operations |

---

## Phase 1: Research ✅ complete

**Status:** in_progress

**Goals:**
- Choose Docker SDK for Go
- Define message protocol
- Understand container metadata requirements
- Review UI architecture

**Tasks:**
- [ ] Research Go Docker SDK options (official vs alternatives)
- [ ] Review existing agent code structure
- [ ] Design message subjects (container.list, container.start, etc.)
- [ ] Identify container metadata to track (name, image, status, ports, etc.)
- [ ] Review UI structure and state management (Zustand)
- [ ] Document findings in findings.md

---

## Phase 2: Agent Docker Integration ✅ complete

**Status:** complete

**Goals:**
- ✅ Connect agent to local Docker daemon
- ✅ List all containers
- ✅ Execute start/stop/restart operations

**Tasks:**
- [x] Add Docker SDK dependency to go.mod
- [x] Create docker.go with Docker client wrapper
- [x] Implement container.list handler
- [x] Implement container.start/stop/restart handlers
- [x] Add error handling for Docker operations

**Files Created/Modified:**
- ✅ agent/go.mod (added github.com/docker/docker/client v28.5.2)
- ✅ agent/go.sum (generated with all dependencies)
- ✅ agent/docker.go (new file - 157 lines)
- ✅ agent/main.go (added Docker client init + handlers)
- ✅ agent/Dockerfile.build (updated to golang:latest)

---

## Phase 3: Message Protocol

**Status:** pending

**Goals:**
- Define NATS-style subjects for container operations
- Define request/response data structures

**Proposed Subjects:**
- `container.list` - Request list of containers
- `container.list.response` - List of containers with metadata
- `container.start` - Start a container by ID
- `container.stop` - Stop a container by ID
- `container.restart` - Restart a container by ID
- `container.status` - Query container status
- `container.operation.success` - Success response
- `container.operation.error` - Error response

**Data Structures (Draft):**
```go
type Container struct {
    ID      string
    Name    string
    Image   string
    Status  string // running, stopped, paused, etc.
    State   string // created, running, paused, restarting, removing, exited, dead
    Ports   []PortMapping
    Created int64
}

type PortMapping struct {
    PrivatePort int
    PublicPort  int
    Type        string // tcp, udp
}

type ContainerOperation struct {
    ContainerID string
    Operation   string // start, stop, restart
}
```

---

## Phase 4: Manager Message Handlers

**Status:** pending

**Goals:**
- Add container control handlers to AgentConnection
- Route messages to connected agents
- Forward responses to UI

**Tasks:**
- [ ] Add container.* handlers to routeMessage()
- [ ] Implement message forwarding from UI to agent
- [ ] Implement response forwarding from agent to UI
- [ ] Add validation for container operations

**Files to Modify:**
- manager/src/durable-objects/AgentConnection.ts
- manager/src/types/Message.ts (if needed for new types)

---

## Phase 5: UI Container List

**Status:** pending

**Goals:**
- Display list of containers in UI
- Show container status, name, image

**Tasks:**
- [ ] Create ContainerList React component
- [ ] Add container state to Zustand store
- [ ] Fetch containers via WebSocket
- [ ] Display container metadata (name, status, image, ports)
- [ ] Auto-refresh on status changes

**Files to Create:**
- frontend/src/components/ContainerList.tsx
- frontend/src/stores/containerStore.ts (or add to existing store)

---

## Phase 6: UI Container Actions

**Status:** pending

**Goals:**
- Add start/stop/restart buttons
- Show loading states during operations
- Display success/error messages
- Real-time status updates

**Tasks:**
- [ ] Add action buttons to ContainerList rows
- [ ] Implement WebSocket message sending for operations
- [ ] Show loading spinner during operations
- [ ] Handle success/error responses
- [ ] Update container status in real-time

**Files to Modify:**
- frontend/src/components/ContainerList.tsx
- frontend/src/stores/containerStore.ts

---

## Phase 7: Testing

**Status:** pending

**Goals:**
- Validate all container operations
- Test error scenarios
- Verify real-time updates

**Test Scenarios:**
1. **List Containers**
   - Agent with running containers → UI shows all containers
   - Agent with no containers → UI shows empty state

2. **Start Container**
   - Click "Start" on stopped container → Container starts
   - Status updates from "stopped" to "running"
   - Success message displayed

3. **Stop Container**
   - Click "Stop" on running container → Container stops
   - Status updates from "running" to "stopped"
   - Success message displayed

4. **Restart Container**
   - Click "Restart" on running container → Container restarts
   - Brief "restarting" status, then back to "running"

5. **Error Handling**
   - Stop already stopped container → Error message
   - Invalid container ID → Error message
   - Docker daemon unreachable → Error message

6. **Real-time Updates**
   - Container status changes externally (docker CLI) → UI updates
   - Multiple UI clients see same updates

---

## Dependencies

**External:**
- Docker daemon running on agent machine
- Docker Go SDK (github.com/docker/docker)

**Internal:**
- ✅ Milestone 1 complete (agent authentication working)
- ✅ WebSocket connection established
- ✅ Message protocol established

---

## Errors Encountered

| Error | Phase | Attempt | Resolution |
|-------|-------|---------|------------|
| _(none yet)_ | - | - | - |

---

## Design Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| _(to be filled during research)_ | - | - |

---

## Notes

- Consider filtering containers by label (e.g., only show Zomboid servers)
- May need to handle Docker socket permissions on agent
- UI should distinguish between Docker errors vs network errors
- Consider pagination if agent has many containers
- Real-time updates: Should agent push container status changes, or should UI poll?
