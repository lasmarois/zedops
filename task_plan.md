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
| 3. Manager Message Handlers | complete | HTTP endpoints + request/reply pattern for container control |
| 4. UI Container List & Actions | complete | React components, hooks, and manager API endpoints |
| 5. Testing | pending | End-to-end validation of all operations |

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

## Phase 3: Manager Message Handlers ✅ complete

**Status:** complete

**Goals:**
- Add container control handlers to AgentConnection
- Route messages to connected agents
- Implement HTTP endpoints for UI requests
- Implement request/reply pattern for synchronous operations

**Tasks Completed:**
- [x] Add container.* message routing to routeMessage()
- [x] Implement handleContainerList() and handleContainerOperation()
- [x] Add HTTP endpoints to Durable Object (GET /containers, POST /containers/:id/:operation)
- [x] Implement request/reply pattern handlers with inbox subjects
- [x] Add handleContainersRequest() - HTTP → WebSocket with 10s timeout
- [x] Add handleContainerOperationRequest() - HTTP → WebSocket with 30s timeout
- [x] Update agent to support msg.Reply field
- [x] Add sendContainerSuccessWithReply() and sendContainerErrorWithReply()
- [x] Update all container handlers to use reply inbox when specified
- [x] Build and test agent with new request/reply pattern

**Files Modified:**
- manager/src/durable-objects/AgentConnection.ts (added 6 new methods, ~160 lines)
- agent/main.go (updated 4 handlers + added 2 helper functions, ~50 lines)

**Implementation Details:**
- Request/reply pattern: Manager generates unique inbox subjects (_INBOX.{uuid})
- Agent checks msg.Reply and responds to inbox if specified
- HTTP endpoints provide synchronous API for UI
- Timeouts: 10s for list operations, 30s for container operations
- Proper HTTP status codes (200, 400, 500, 503, 504)
- pendingReplies Map manages async request/reply promises

---

## Phase 4: UI Container List & Actions ✅ complete

**Status:** complete

**Goals:**
- Add container types and API functions to frontend
- Create useContainers hooks with TanStack Query
- Create ContainerList React component with actions
- Add routing to view containers for agents
- Add manager API endpoints for container operations

**Tasks Completed:**
- [x] Add container types to lib/api.ts (Container, PortMapping, etc.)
- [x] Add API functions: fetchContainers(), startContainer(), stopContainer(), restartContainer()
- [x] Create hooks/useContainers.ts with TanStack Query
- [x] Create useContainers() hook - fetch with 5s refetch interval
- [x] Create useStartContainer(), useStopContainer(), useRestartContainer() mutations
- [x] Create components/ContainerList.tsx component
- [x] Display containers in table (name, image, state, status)
- [x] Add Start/Stop/Restart buttons based on state
- [x] Show loading states during operations
- [x] Display success/error toast notifications
- [x] Modify AgentList to be clickable (only online agents)
- [x] Add routing in App.tsx (selectedAgent state)
- [x] Add manager API endpoints in routes/agents.ts
- [x] Forward container requests to Durable Objects

**Files Created:**
- frontend/src/hooks/useContainers.ts (~100 lines)
- frontend/src/components/ContainerList.tsx (~350 lines)

**Files Modified:**
- frontend/src/lib/api.ts (added ~160 lines)
- frontend/src/components/AgentList.tsx (made clickable)
- frontend/src/App.tsx (added routing logic)
- manager/src/routes/agents.ts (added ~180 lines)

**Implementation Details:**
- Used TanStack Query for data fetching and state management
- 5-second refetch interval for real-time status updates
- Mutations auto-invalidate queries for immediate UI updates
- Color-coded state indicators (green=running, red=exited, yellow=paused, etc.)
- Only online agents are clickable in agent list
- Container actions disabled during operations (prevents double-clicks)
- Toast notifications auto-dismiss after 3 seconds
- Manager API endpoints forward to Durable Objects

---

## Phase 5: Testing

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
