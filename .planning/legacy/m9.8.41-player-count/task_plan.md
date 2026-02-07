# M9.8.41 - Real-Time Player Count Display

**Goal:** Display connected player count for each server using backend RCON commands, with real-time updates.

---

## Current State

### Existing RCON Infrastructure
- ✅ Agent has full RCON implementation (`agent/rcon.go`)
- ✅ Manager routes RCON via WebSocket (`AgentConnection.ts`)
- ✅ Frontend has RconTerminal with player list parsing
- ✅ `players` command returns: "Players connected (N): player1, player2..."

### Where Player Count Should Display
1. **Dashboard** - Total players across all servers
2. **ServerCard** - Per-server player count (e.g., "3/32 players")
3. **ServerDetail** - Overview tab metrics card

---

## Architecture Options

### Option A: Polling from Frontend (Simple)
```
Frontend polls /api/servers/{id}/players every 30s
  → Manager forwards to Agent via DO
  → Agent executes RCON `players` command
  → Returns count + player names
```
**Pros:** Simple, uses existing RCON infrastructure
**Cons:** High latency, many RCON connections, not truly real-time

### Option B: Agent-Side Caching with Periodic RCON (Recommended)
```
Agent runs background task every 30s:
  → For each running server, execute RCON `players`
  → Cache result in memory
  → Include in host metrics broadcast

Manager stores latest player counts in DO
  → Serves via REST API or existing metrics endpoint

Frontend fetches with metrics (already polling every 5s)
```
**Pros:** Efficient, reuses metrics infrastructure, low latency
**Cons:** More agent-side work, RCON connections per poll

### Option C: WebSocket Push (Most Real-Time)
```
Agent subscribes to server events
  → On player join/leave, push update via WebSocket
  → Manager broadcasts to connected UIs
```
**Pros:** True real-time, minimal polling
**Cons:** Requires game server event integration (may not be available)

---

## Selected Approach: Option B (Agent-Side Caching)

### Rationale
- Reuses existing metrics polling infrastructure
- Agent already has RCON implementation
- Frontend already fetches metrics every 5s
- No new WebSocket channels needed

---

## Implementation Phases

### Phase 1: Agent - Player Count Collector
- [ ] Create `playerstats.go` with periodic RCON polling
- [ ] Add player count to metrics broadcast (`metrics.players`)
- [ ] Handle RCON connection errors gracefully
- [ ] Cache results per server (30s refresh)

### Phase 2: Manager - Store & Expose Player Counts
- [ ] Store player counts in AgentConnection DO
- [ ] Include in existing metrics response or new endpoint
- [ ] Add to server list API responses

### Phase 3: Frontend - Display Player Counts
- [ ] Dashboard: Total players stat card
- [ ] ServerCard: Player count in subtitle
- [ ] ServerDetail: Players metric card with live count

### Phase 4: Testing & Deploy
- [ ] Test with running server
- [ ] Verify real-time updates
- [ ] Deploy to production

---

## Current Phase: Phase 1
**Status:** `pending`
