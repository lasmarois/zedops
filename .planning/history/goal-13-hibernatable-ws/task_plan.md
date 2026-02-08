# Goal #13: Hibernatable WebSocket Migration

Parent: Infra (Cloudflare free tier compliance)

## Context

The DO uses `server.accept()` which keeps it awake 24/7 while WebSockets are connected. This blows past the free tier DO duration limit. Migrating to `ctx.acceptWebSocket()` lets the DO hibernate between messages, reducing duration by ~99%.

## Scope

**In scope (this goal):**
- Migrate AgentConnection DO from standard WebSocket to Hibernatable WebSocket API
- Both agent WS and UI WS connections

**Out of scope (discuss later with user):**
- Frontend polling interval changes
- Agent-side metrics/heartbeat interval changes
- D1 write reduction

---

## Phase 1: State Restoration Infrastructure ✅

- [x] Add `stateRestored` flag + `restoreState()` method
- [x] Add `getAgentWebSocket()` using `ctx.getWebSockets("agent")`
- [x] Add `getContainerSubscriptions()` with in-memory cache
- [x] Add `getAgentLogSubscriptions()` with in-memory cache
- [x] Persist `clientIp` and `isAgentLogStreaming` to storage

## Phase 2: Migrate WebSocket Acceptance ✅

- [x] Agent WS: `server.accept()` → `ctx.acceptWebSocket(server, ["agent"])`
- [x] UI WS: `server.accept()` → `ctx.acceptWebSocket(server, tags)`
- [x] Update `send()` and `sendMessageWithReply()` to use `getAgentWebSocket()`

## Phase 3: Add Class-Level Hibernation Handlers ✅

- [x] `webSocketMessage(ws, message)` — tag-based routing
- [x] `webSocketClose(ws, code, reason, wasClean)` — tag-based routing
- [x] `webSocketError(ws, error)` — tag-based routing
- [x] Refactored `handleAgentMessage()` — takes raw data
- [x] Refactored `handleUIMessageFromHibernation()` — takes raw data
- [x] Refactored `handleAgentClose()` — clears storage
- [x] Added `handleUIClose()` — cleans up storage subscriptions

## Phase 4: Update Subscription & Broadcast Methods ✅

- [x] `handleLogSubscribe()` → `ctx.storage` backed
- [x] `handleLogUnsubscribe()` → `ctx.storage` backed
- [x] `handleLogLine()` → broadcast via storage subscriber lookup + `ctx.getWebSockets("sub:<id>")`
- [x] Agent log subscribe/unsubscribe → `ctx.storage` backed
- [x] Agent log line/history → broadcast via storage lookup
- [x] `handlePlayersUpdate()` → `ctx.getWebSockets("ui")`
- [x] `handleMoveProgress/BackupProgress()` → `ctx.getWebSockets("ui")`
- [x] `handleUIRCONMessage()` → `getUserId(ws)` from tags

## Phase 5: Remove Dead Code ✅

- [x] Deleted: `ws`, `uiWebSockets`, `logSubscribers`, `agentLogSubscribers`
- [x] Deleted: `handleMessage()`, `handleUIMessage()`, `handleClose()`, `handleError()`, `getActiveWebSocket()`
- [x] Updated `/status` endpoint to use `ctx.getWebSockets()` counts
- [x] Updated `LogSubscriber` / `AgentLogSubscriber` types (removed `ws` field)

## Phase 6: Test & Deploy

- [x] 6.1 Frontend build — no TS errors ✅
- [x] 6.2 Wrangler dry-run deploy — no errors ✅
- [x] 6.3 Deploy to dev (push to `dev` branch) ✅ — CI run 21801478891 passed
- [x] 6.4 Agent on test VM connects with ephemeral token ✅
- [x] 6.5 Agent registers, gets permanent token, authenticates ✅
- [x] 6.6 Heartbeats updating last_seen in D1 ✅
- [x] 6.7 Host metrics (CPU/MEM/Storage) flowing to dashboard ✅
- [x] 6.8 Container list loads via DO request/reply ✅ (3 containers)
- [x] 6.9 Agent shows "Online" in UI dashboard and agent detail ✅
- [x] 6.10 Verify: UI log streaming (container logs tab) ✅ — 1000 lines streaming, "Streaming" status
- [x] 6.11 Verify: Agent logs tab ✅ — "Live" status, 500+ lines
- [x] 6.12 Verify: RCON works ✅ — Connected, `players` command + Save World both returned correctly
- [x] 6.13 Verify: Player stats broadcasting ✅ — players.update messages delivered to UI WebSockets
- [x] 6.14 DO hibernation cycle ✅ — wake-up restores state, all features work after hibernation
- [x] 6.15 Responsiveness ✅ — container stop ~5s, no latency regression
- [x] 6.16 DO duration — theoretical ~98% reduction (86,400s → ~600-2000s/day per agent)
- [x] 6.17 Deploy to prod ✅ — CI run 21802163641 passed (57s), maestroserver reconnected, all servers healthy
