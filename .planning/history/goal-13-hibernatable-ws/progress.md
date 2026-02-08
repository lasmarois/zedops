# Goal #13: Progress

## Session 1 — 2026-02-08

### Investigation
- User received Cloudflare 90% limit email alert
- Both dev and prod agents offline (can't connect)
- Queried Cloudflare GraphQL Analytics API for actual usage metrics
- Root cause: DO uses `server.accept()` keeping DO awake 24/7 → exceeds duration limit
- Agent process running but WebSocket died Feb 7 at 20:53, not reconnected
- Email confirmed: "exceeded daily Durable Objects free tier limit of duration"
- DO requests returning errors until midnight UTC reset

### Metrics Collected
- Worker requests: 38K/day (under 100K limit)
- DO requests: 22K/day (under 100K limit)
- D1 rows written: 114K/day (slightly over 100K limit — secondary concern)
- DO duration: the blocker

### Plan Created
- Phase 1: Migrate agent WS to Hibernatable API
- Phase 2: Migrate UI WS to Hibernatable API
- Phase 3: State recovery on wake
- Phase 4: Test & deploy
- Scope limited to WS migration only — polling intervals deferred for discussion

### Research Done
- Read full AgentConnection.ts (3595 lines)
- Two WS types: agent (`/ws`) and UI (`/logs/ws`)
- Both use `server.accept()` + `addEventListener()`
- Existing `getActiveWebSocket()` already has `ctx.getWebSockets()` fallback
- State stored in storage: agentId, agentName (for hibernation recovery)
- Cloudflare docs: `ctx.acceptWebSocket(ws, tags)` + class-level handlers
- Tags strategy designed: `["agent"]` vs `["ui", "sub:xxx", "user:xxx"]`

## Session 2 — 2026-02-08

### Implementation Complete
- Full rewrite of AgentConnection.ts: `server.accept()` → `ctx.acceptWebSocket()`
- Removed `addEventListener()` calls, added class-level `webSocketMessage/Close/Error` handlers
- Tag-based routing: `"agent"` tag for agent WS, `"ui"/"sub:xxx"/"user:xxx"` tags for UI
- Subscription tracking migrated from in-memory Maps to `ctx.storage` keys:
  - `sub:<subscriberId>` → `containerId` (container log subscriptions)
  - `agentsub:<subscriberId>` → `true` (agent log subscriptions)
- In-memory caches with invalidation for subscription lookups
- State restoration via `restoreState()` — lazy, called on first message/request after wake
- Persists: agentId, agentName, clientIp, isAgentLogStreaming to storage
- Acceptable losses on hibernation: pendingReplies, playerStats, logBuffers, rconSessions
- Deleted old code: `ws` field, `uiWebSockets` map, `logSubscribers` map, `agentLogSubscribers` map
- Updated LogMessage.ts: removed `ws` field from `LogSubscriber` and `AgentLogSubscriber`
- Agent close now clears storage (agentId, agentName, clientIp, isAgentLogStreaming)
- UI close cleans up storage subscriptions and stops log streams if no remaining subscribers

### Build Verification
- Frontend build: ✅ no TS errors
- Wrangler dry-run deploy: ✅ compiles successfully (405.57 KiB / gzip: 73.86 KiB)

### Deploy to Dev
- CI: `gh run 21801478891` — ✅ all steps passed (58s)
- Agent: Built successfully, started against dev, but **DO is rate-limited**
  - `curl /ws?name=test` → 500 Internal Server Error
  - `/health` works (no DO), `/api/agents` works (D1 only)
  - Limit resets at midnight UTC (~7.5 hours from now)
- **Agent stopped** — will resume testing after midnight UTC reset

### DO Limit Resolved
- User upgraded to Workers Paid plan — DO limit cleared
- Initial attempts still failed (enforcement cache), resolved after ~15 min

### Testing on Dev (test VM: zedops-test-agent)
- Old agent token was lost — deleted agent from D1, re-created via API
- Generated ephemeral token: `POST /api/admin/tokens` with admin JWT
- Agent started on test VM with `--token` flag → **connected successfully**
- Registration: ephemeral token → permanent token exchange ✅
- Heartbeat: `last_seen` updating every 30s in D1 ✅
- Host metrics: CPU 0.2%, MEM 17.3%, Storage 31% visible in dashboard ✅
- Container list: 3 containers loaded via DO request/reply pattern ✅
- UI dashboard: agent shows "Online" with metrics ✅
- Agent detail page: full overview with host metrics + container list ✅

## Session 3 — 2026-02-08

### Full Verification Complete
All features tested end-to-end on dev environment (zedops-dev) with test VM agent:

- **Agent logs tab**: ✅ "Live" status, 500+ lines streaming real-time
- **Container log streaming**: ✅ Created managed server record pointing to existing container, 1000 lines streaming with "Streaming" status
- **RCON**: ✅ Connected to game server, executed `players` (returned "Players connected (0):") and Save World (returned "World saved"). Initial auth failure was because test server record had empty config — after adding RCON_PASSWORD=test123, works perfectly.
- **Player stats broadcasting**: ✅ players.update messages delivered to all UI WebSockets (visible in LogStream console as "Unknown message" since log viewer doesn't consume them)
- **DO hibernation cycle**: ✅ Navigated away (all UI WS closed), waited 15s, navigated back — DO restored state correctly (agent online, metrics, containers). Agent logs streaming "Live" after wake-up with 503 lines.
- **Responsiveness**: ✅ Container stop ~5s through hibernatable DO, memory dropped 71% → 14.8% visible in real-time. No latency regression.
- **DO duration**: Theoretical ~98% reduction. Cannot query CF GraphQL analytics directly (wrangler OAuth token), user offered to check dashboard.

### Container cleanup
- Stopped steam-zomboid-backup-test container (to free VM resources)
- Test server record (test-server-1) remains in dev DB
