# Findings: Port Validation Research

**Task:** Port Validation & Availability Checking
**Date:** 2026-01-10

---

## Discovery: Current Port Allocation

### Docker Containers Using Ports

```
steam-zomboid-newyear:         16261-16262 UDP
steam-zomboid-build42-jan26:   16263-16264 UDP
steam-zomboid-servertest:      26261-26262 UDP
```

### Host-Level Port Bindings

```bash
$ ss -tuln | grep -E ":(16261|16262|16263|16264)"
udp   UNCONN 0      0            0.0.0.0:16261      0.0.0.0:*
udp   UNCONN 0      0            0.0.0.0:16262      0.0.0.0:*
udp   UNCONN 0      0            0.0.0.0:16263      0.0.0.0:*
udp   UNCONN 0      0            0.0.0.0:16264      0.0.0.0:*
udp   UNCONN 0      0               [::]:16261         [::]:*
udp   UNCONN 0      0               [::]:16262         [::]:*
udp   UNCONN 0      0               [::]:16263         [::]:*
udp   UNCONN 0      0               [::]:16264         [::]:*
```

**Conclusion:** Ports 16261-16264 are bound at host level by Docker containers.

---

## Error Analysis: Failed Server Creation

### Error Message
```
Failed to create server bingchilling: failed to start container:
Error response from daemon: failed to set up container networking:
driver failed programming external connectivity on endpoint steam-zomboid-bingchilling:
Bind for :::16261 failed: port is already allocated
```

### Root Cause
1. UI defaults to port 16261 (auto-suggest from DB query)
2. Manager doesn't check host-level availability
3. Agent creates container successfully
4. Docker fails to **start** container due to port conflict
5. Container left in created-but-not-running state
6. Database record created with status='failed', container_id=null

### Gap Identified
**No host-level port validation** - Manager only queries DB, not actual host state.

---

## Port Checking Approaches

### Option 1: Parse `ss` output (Linux)
**Command:**
```bash
ss -tuln | grep ":16261 "
```

**Pros:**
- Standard utility on most Linux systems
- Shows all bound ports (Docker + non-Docker)
- Works across network namespaces

**Cons:**
- Requires parsing text output
- May need root/elevated permissions
- Platform-specific (Linux only)

**Implementation:**
```go
func getHostBoundPorts() ([]int, error) {
    cmd := exec.Command("ss", "-tuln")
    output, err := cmd.Output()
    // Parse output for port numbers
}
```

### Option 2: Read `/proc/net/tcp` and `/proc/net/udp` (Linux)
**Files:**
- `/proc/net/tcp` - TCP port bindings
- `/proc/net/udp` - UDP port bindings

**Example `/proc/net/udp` line:**
```
  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000:3F85 00000000:0000 07 00000000:00000000 00:00000000 00000000  1000        0 12345
```

Port 16261 (hex: 3F85) is shown in `local_address` field.

**Pros:**
- Direct kernel network state
- No external command execution
- Fastest approach

**Cons:**
- Requires hex parsing
- Linux-specific
- More complex implementation

**Implementation:**
```go
func parseNetProc(filename string) ([]int, error) {
    data, _ := os.ReadFile(filename)
    // Parse hex addresses, extract ports
}
```

### Option 3: Docker SDK Port Inspection
**Already Implemented** - Check container port bindings via Docker API.

**Limitation:** Only sees Docker-managed ports, not host-level bindings from non-Docker processes.

---

## Recommended Approach: Layered Checking

**Layer 1:** Database Check (Manager-side)
- Fast synchronous check
- Catches known ZedOps server allocations

**Layer 2:** Docker Container Check (Agent-side)
- Query all containers (including stopped)
- Extract port bindings from HostConfig

**Layer 3:** Host Network Check (Agent-side)
- Parse `ss -tuln` output (simpler, more maintainable)
- Fallback to `/proc/net/*` if `ss` unavailable

**Why this approach:**
- Catches all port conflicts (DB, Docker, host)
- Graceful degradation (if `ss` fails, still have Docker check)
- Clear separation of concerns

---

## Auto-Suggest Algorithm Design

### Current Behavior (Broken)
```typescript
// Manager queries DB for max(game_port)
const maxPort = await db.query('SELECT MAX(game_port) FROM servers WHERE agent_id = ?');
const suggestedPort = maxPort ? maxPort + 2 : 16261;
```

**Problem:** Only checks DB, not actual availability.

### Proposed Behavior
```typescript
async function suggestNextAvailablePorts(agentId: string) {
  // 1. Get all allocated ports from DB
  const dbPorts = await getAllPortsFromDb(agentId);

  // 2. Query agent for host-level availability
  const unavailablePorts = await checkAgentPortsInRange(agentId, 16261, 16500);

  // 3. Combine and find first available range
  const allUnavailable = [...dbPorts, ...unavailablePorts];

  let gamePort = 16261;
  while (gamePort < 16500) {
    const range = [gamePort, gamePort + 1];
    const rconPort = 27015 + Math.floor((gamePort - 16261) / 2);

    if (allPortsAvailable([...range, rconPort], allUnavailable)) {
      return { gamePort, udpPort: gamePort + 1, rconPort };
    }

    gamePort += 2;
  }

  throw new Error('No available ports in range 16261-16500');
}
```

---

## UI/UX Improvements Needed

### Current Issues
1. ❌ No visual indication of port conflicts
2. ❌ No way to manually specify ports
3. ❌ Error messages don't suggest solutions
4. ❌ Failed servers can't be edited/retried

### Proposed Improvements

**Port Configuration Section:**
```
┌─ Port Configuration ────────────────────┐
│                                         │
│ Game Port:  [16265] [Check Availability]│
│             ✓ Available                 │
│                                         │
│ UDP Port:   [16266] (Auto: +1)         │
│             ✓ Available                 │
│                                         │
│ RCON Port:  [27017] (Auto-suggest)     │
│             ✗ In use by mongodb        │
│             Try: 27018 instead         │
│                                         │
│ [ ] Use custom ports                   │
│                                         │
└─────────────────────────────────────────┘
```

**Error Display:**
```
┌─ Server Creation Failed ────────────────┐
│                                         │
│ ✗ Port 16261 is already in use         │
│   Used by: steam-zomboid-newyear       │
│                                         │
│ Suggested ports:                        │
│ • 16265-16266 (Available)              │
│ • 16267-16268 (Available)              │
│                                         │
│ [Edit Configuration]  [Try Again]      │
│                                         │
└─────────────────────────────────────────┘
```

---

## Testing Scenarios

### Scenario 1: Happy Path
1. User opens ServerForm
2. Clicks "Check Availability" (auto-populated ports)
3. All ports show ✓ Available
4. Submits form
5. Server created successfully

### Scenario 2: Port Conflict
1. User opens ServerForm
2. Ports default to 16261-16262 (already in use)
3. Clicks "Check Availability"
4. Shows ✗ Port 16261 in use by steam-zomboid-newyear
5. System auto-suggests 16265-16266
6. User accepts suggestion
7. Server created successfully

### Scenario 3: Manual Port Selection
1. User opens ServerForm
2. Checks "Use custom ports"
3. Enters 17000-17001
4. Clicks "Check Availability"
5. All ports show ✓ Available
6. Submits form
7. Server created successfully

### Scenario 4: Failed Server Retry
1. Server creation fails with port conflict
2. Server marked as 'failed' in DB
3. UI shows failed server with "Edit & Retry" button
4. User clicks "Edit & Retry"
5. Form opens with previous config pre-filled
6. User changes ports
7. Clicks "Check Availability"
8. Submits with available ports
9. Server created successfully

---

## Performance Considerations

### Port Checking Latency

**Estimated times:**
- DB query: ~10ms (local D1)
- Agent WebSocket round-trip: ~100-300ms
- Host port check (`ss`): ~50ms
- Total: ~150-350ms

**Optimization strategies:**
- Cache host port bindings for 30s
- Only check on explicit user action (button click)
- Show loading state during check

### Database Impact

**Query frequency:**
- Per server creation: 3 queries (lookup agent, check conflicts, insert)
- Per port check: 1 query (get all ports for agent)

**Mitigation:**
- Add index on (agent_id, game_port) - already exists
- Cache agent registry/data_path lookups

---

## Security Considerations

### Agent Port Scanning Risk

**Concern:** Agent can scan all host ports (information disclosure)

**Mitigation:**
- Limit port check range to game ports (16000-17000, 27000-28000)
- Only expose availability (boolean), not process details
- Rate limit port check requests (max 5/minute)

### Port Reservation Attack

**Concern:** Malicious actor reserves all available ports in DB

**Mitigation:**
- Limit servers per agent (e.g., max 10)
- Clean up failed servers after 1 hour
- Admin can manually delete failed servers

---

## Open Questions

1. **Port range limits?**
   - Should we restrict to 16261-16500 for game ports?
   - Should we restrict to 27015-27100 for RCON?

2. **Failed server cleanup?**
   - Auto-delete after X minutes?
   - Require manual cleanup?
   - Keep for audit trail?

3. **Port reservation during creation?**
   - Should we "lock" ports in DB immediately?
   - Or rely on Docker's atomic container creation?

4. **Multi-agent coordination?**
   - Each agent has independent port space
   - No cross-agent port conflicts possible (different hosts)
   - Confirm this assumption?

---

## References

- [Docker Port Bindings API](https://docs.docker.com/engine/api/v1.41/#operation/ContainerCreate)
- [Linux ss command](https://man7.org/linux/man-pages/man8/ss.8.html)
- [/proc/net/tcp format](https://www.kernel.org/doc/Documentation/networking/proc_net_tcp.txt)
- Project Zomboid default ports: 16261 (game), 16262 (UDP), 27015 (RCON)
