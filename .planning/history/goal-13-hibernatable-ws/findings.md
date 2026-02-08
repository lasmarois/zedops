# Goal #13: Findings

## Root Cause Analysis

### Cloudflare Alert
- **Alert**: "exceeded the daily Cloudflare Durable Objects free tier limit of 2147483647 duration"
- **Impact**: DO requests return errors → agent WebSocket can't connect → both dev+prod agents offline
- **Limit resets**: daily at 00:00 UTC

### Why Duration is So High
The DO uses `server.accept()` (standard WebSocket API). This keeps the DO **awake 24/7** as long as any WebSocket is connected. Every second of wall time counts toward the duration limit.

With `ctx.acceptWebSocket()` (Hibernatable WebSocket API), the DO **sleeps between messages** — only wakes to process each message. Massive duration reduction.

### Measured Usage (Cloudflare GraphQL Analytics, Feb 8)

| Metric | Prod (zedops) | Dev (zedops-dev) | Combined | Free Limit |
|--------|---------------|------------------|----------|------------|
| Worker requests | 19,078 | 19,838 | 38,916 | 100K/day |
| DO requests | 17,050 | 5,401 | 22,451 | 100K/day |
| DO wall time | 90.6s | 45.7s | 136.3s | ? |
| D1 rows read | 203,409 | 134,455 | 337,864 | 5M/day |
| D1 rows written | 90,198 | 24,118 | 114,316 | 100K/day |

Note: DO "wall time" from GraphQL is per-request processing time only. The real duration cost is the **always-on wall time** of the DO holding WebSocket connections open.

### Two WebSocket Connection Types in the DO
1. **Agent WebSocket** (`/ws`) — persistent, always connected, bidirectional NATS protocol
2. **UI WebSocket** (`/logs/ws`) — transient, for log streaming/RCON, multiple concurrent

Both use `server.accept()` — both need migration.

## Hibernatable WebSocket API Key Points

### Migration Pattern
```typescript
// OLD (standard)
server.accept();
server.addEventListener("message", (event) => { ... });
server.addEventListener("close", (event) => { ... });

// NEW (hibernatable)
this.ctx.acceptWebSocket(server, ["agent"]); // tags distinguish ws types
// No addEventListener — use class methods instead:
// async webSocketMessage(ws, message) { ... }
// async webSocketClose(ws, code, reason, wasClean) { ... }
// async webSocketError(ws, error) { ... }
```

### Tags
- Tags (string[]) can be attached to each WebSocket via `acceptWebSocket(ws, tags)`
- Retrieved via `this.ctx.getWebSockets(tag)` to filter by type
- Max 10 tags per WebSocket, max 256 chars each
- Use to distinguish agent WS from UI WS

### State Recovery After Hibernation
- Constructor runs again on wake-up — all instance variables reset to defaults
- Must restore state from `this.ctx.storage` (already partially implemented)
- `this.ctx.getWebSockets()` returns all connected WebSockets
- Ephemeral state (log buffers, player stats maps) will be lost — acceptable, agent will resend

### What Survives Hibernation
- WebSocket connections (maintained by runtime)
- `this.ctx.storage` (persistent KV)
- Tags on WebSockets

### What Does NOT Survive Hibernation
- All class instance variables (reset to constructor defaults)
- In-memory Maps: `pendingReplies`, `logSubscribers`, `logBuffers`, `agentLogSubscribers`, `playerStats`, `uiWebSockets`, `rconSessions`
- `this.ws`, `this.agentId`, `this.agentName`, `this.isRegistered` — all null/false

### Implications for Our Architecture
- `pendingReplies` (request/reply inbox pattern) — if DO hibernates mid-request, reply will be lost. But since messages flow continuously, hibernation only happens during idle periods, so this is safe.
- `playerStats` / `logBuffers` — ephemeral caches, agent will resend. Acceptable loss.
- `logSubscribers` / `agentLogSubscribers` — UI WS references. After hibernation, `getWebSockets("ui")` can retrieve them, but we lose the subscriber metadata (which container they subscribed to). Can re-derive from tags or require UI to re-subscribe.
- `uiWebSockets` map (ws → userId) — lost. Can store userId in WebSocket tag instead.

## Existing Hibernation Scaffolding
The code already has partial support in `getActiveWebSocket()`:
- Uses `this.ctx.getWebSockets()` as fallback
- Restores `agentId`/`agentName` from storage
- But never actually accepts WebSockets with `ctx.acceptWebSocket()`
