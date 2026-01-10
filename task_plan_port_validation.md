# Task Plan: Port Validation & Availability Checking

**Goal:** Add comprehensive port validation to prevent server creation failures due to port conflicts

**Status:** Planning
**Priority:** High (blocks Milestone 4 Phase 5 completion)
**Created:** 2026-01-10

---

## Problem Statement

Current issues discovered during testing:
1. ❌ Server creation fails with "port already allocated" error
2. ❌ No pre-flight port availability checking
3. ❌ Failed servers remain in DB with status='failed'
4. ❌ No way to edit/retry failed server configs
5. ❌ UI doesn't allow port customization
6. ❌ Auto-suggest ports without checking actual availability

**Example Error:**
```
failed to start container: Bind for :::16261 failed: port is already allocated
```

**Current Port Usage (Host Level):**
- 16261-16262: steam-zomboid-newyear (UDP)
- 16263-16264: steam-zomboid-build42-jan26 (UDP)
- 26261-26262: steam-zomboid-servertest (UDP)

---

## Architecture Design

### Port Checking Layers

**Layer 1: Database Check (Manager)**
- Query `servers` table for existing port allocations
- Fast, synchronous check before agent communication

**Layer 2: Docker Container Check (Agent)**
- Query Docker API for all container port bindings
- Includes stopped containers (may restart)

**Layer 3: Host Network Check (Agent)**
- NEW: Use `ss` or `/proc/net` to check actual bound ports
- Catches non-Docker services using ports

### New Message Protocol

**Request:** `port.check`
```json
{
  "subject": "port.check",
  "data": {
    "ports": [16265, 16266, 27017]
  },
  "reply": "_INBOX.uuid"
}
```

**Response:**
```json
{
  "subject": "_INBOX.uuid",
  "data": {
    "available": [16265, 16266],
    "unavailable": [
      {
        "port": 27017,
        "reason": "bound by process 'mongod' (PID 1234)"
      }
    ]
  }
}
```

---

## Implementation Phases

### Phase 1: Agent Port Checking (Backend)
**Status:** Pending

**Tasks:**
- [ ] Add `port.check` message handler to agent
- [ ] Implement `CheckPortAvailability()` function
  - Check Docker containers (existing functionality)
  - Check host network bindings (`ss -tuln` or `/proc/net/{tcp,udp}`)
  - Return detailed availability status
- [ ] Add unit tests for port checking logic
- [ ] Update agent message routing

**Files to Modify:**
- `agent/main.go` - Add `handlePortCheck()` handler
- `agent/network.go` (NEW) - Port availability checking logic
- `agent/server.go` - Use port check before creation

**Estimated Complexity:** Medium

---

### Phase 2: Manager Port Validation API (Backend)
**Status:** Pending

**Tasks:**
- [ ] Add GET `/api/agents/:id/ports/availability` endpoint
  - Query servers table for DB-level conflicts
  - Forward to agent for host-level check
  - Combine results
  - Suggest next available port range
- [ ] Update AgentConnection DO to handle port.check forwarding
- [ ] Add port conflict detection to server creation flow

**Files to Modify:**
- `manager/src/routes/agents.ts` - New port availability endpoint
- `manager/src/durable-objects/AgentConnection.ts` - Forward port.check

**Estimated Complexity:** Medium

---

### Phase 3: Enhanced UI Port Selection (Frontend)
**Status:** Pending

**Tasks:**
- [ ] Update ServerForm component
  - Add collapsible "Port Configuration" section
  - Show auto-suggested ports (with availability check)
  - Add "Check Availability" button
  - Show port status indicators (✓ available / ✗ in use)
  - Allow manual port override
- [ ] Add port availability API hook
  - `usePortAvailability(agentId, ports)` hook
  - Real-time availability checking
- [ ] Improve error display
  - Show specific port conflict errors
  - Suggest alternative ports
  - Add "Edit Configuration" button on failed servers

**Files to Modify:**
- `frontend/src/components/ServerForm.tsx` - Enhanced port UI
- `frontend/src/lib/api.ts` - Add `checkPortAvailability()`
- `frontend/src/hooks/usePortAvailability.ts` (NEW) - Port checking hook

**Estimated Complexity:** High

---

### Phase 4: Failed Server Recovery (Enhancement)
**Status:** Pending

**Tasks:**
- [ ] Add "Edit & Retry" functionality for failed servers
  - Load failed server config into form
  - Pre-fill all fields
  - Allow port changes
  - Delete old failed entry on retry
- [ ] Add automatic cleanup of failed containers
  - Agent cleans up containers that failed to start
  - Remove orphaned containers after 5 minutes
- [ ] Add bulk cleanup utility
  - "Clean Up Failed Servers" button in UI
  - Removes all failed entries from DB

**Files to Modify:**
- `frontend/src/components/ContainerList.tsx` - Add edit button
- `agent/server.go` - Add cleanup logic
- `manager/src/routes/agents.ts` - Add bulk cleanup endpoint

**Estimated Complexity:** Medium

---

## Success Criteria

- [ ] Agent can check port availability at host level
- [ ] UI shows port availability before submission
- [ ] Port conflicts are detected before container creation
- [ ] Users can customize ports in the UI
- [ ] Failed servers can be edited and retried
- [ ] Clear error messages guide users to resolution
- [ ] Next available ports are auto-suggested

---

## Testing Plan

### Test Cases

1. **Port Conflict Detection**
   - Try to create server with ports 16261-16262 (should fail gracefully)
   - UI should show "Port 16261 is already in use by steam-zomboid-newyear"

2. **Port Availability Check**
   - Click "Check Availability" button
   - Should query agent and show ✓/✗ indicators
   - Should suggest next available range (e.g., 16265-16266)

3. **Manual Port Override**
   - Enter custom ports (e.g., 17000-17001)
   - Should validate availability
   - Should create server successfully

4. **Failed Server Recovery**
   - Create server with conflicting ports (should fail)
   - Click "Edit & Retry" on failed server
   - Change ports to available range
   - Should succeed on retry

5. **Auto-Suggest Logic**
   - Query `/api/agents/:id/ports/availability`
   - Should return next available sequential range
   - Should skip over unavailable ports

---

## Technical Implementation Details

### Port Checking Algorithm (Agent)

```go
func (dc *DockerClient) CheckPortAvailability(ctx context.Context, ports []int) (PortAvailability, error) {
    availability := PortAvailability{
        Available:   []int{},
        Unavailable: []PortConflict{},
    }

    // 1. Check Docker containers
    containers, _ := dc.cli.ContainerList(ctx, container.ListOptions{All: true})
    dockerPorts := extractPortsFromContainers(containers)

    // 2. Check host network bindings
    hostPorts, _ := getHostBoundPorts() // Parse ss -tuln or /proc/net/*

    // 3. Compare requested ports
    for _, port := range ports {
        if conflict, found := checkConflict(port, dockerPorts, hostPorts); found {
            availability.Unavailable = append(availability.Unavailable, conflict)
        } else {
            availability.Available = append(availability.Available, port)
        }
    }

    return availability, nil
}
```

### Auto-Suggest Algorithm (Manager)

```typescript
// Find next available port range
async function suggestPorts(agentId: string): Promise<PortSuggestion> {
  // 1. Get all ports from servers table
  const dbPorts = await getDbAllocatedPorts(agentId);

  // 2. Query agent for host-level ports
  const hostPorts = await checkAgentPorts(agentId, rangeToCheck);

  // 3. Find first available sequential range
  let gamePort = 16261; // Start from base
  while (true) {
    const range = [gamePort, gamePort + 1]; // UDP ports
    const rconPort = 27015 + (gamePort - 16261) / 2; // RCON offset

    if (allAvailable([...range, rconPort], [...dbPorts, ...hostPorts])) {
      return { gamePort, udpPort: gamePort + 1, rconPort };
    }
    gamePort += 2; // Increment by 2
  }
}
```

---

## Risks & Mitigations

**Risk 1:** Agent performance impact from frequent port checks
- **Mitigation:** Cache host port bindings for 30 seconds
- **Mitigation:** Only check when user clicks "Check Availability"

**Risk 2:** Race condition between check and creation
- **Mitigation:** Final validation during container creation
- **Mitigation:** Lock ports in DB immediately on submission

**Risk 3:** Complex error messages confuse users
- **Mitigation:** User-friendly error formatting
- **Mitigation:** Actionable suggestions (e.g., "Try ports 16265-16266")

---

## Dependencies

- Docker SDK (existing)
- `ss` command or `/proc/net/*` access on host
- React Query for UI state management (existing)
- D1 database queries (existing)

---

## Future Enhancements (Post-MVP)

- Port range reservation system
- Automatic port assignment (no user input needed)
- Port usage visualization (chart showing allocated ranges)
- Port conflict resolution wizard
- Health checks for bound ports
