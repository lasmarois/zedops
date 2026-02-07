# Goal #1: Complete M10 - Findings

## Bug 1: Agent Status Shows "Online" When Agent Is Offline

**Location:** `manager/src/durable-objects/AgentConnection.ts`

**How it works:**
- Agent connects → sets `status = 'online'` in D1 (line 495, 609-615)
- WebSocket closes → `handleClose()` sets `status = 'offline'` (line 931-938)
- WebSocket error → `handleError()` also sets offline (line 959-966)
- **No timeout mechanism** — relies entirely on WebSocket close event

**Root cause:** Both agents are showing "Online" despite not running. This means either:
1. The WebSocket `close` event never fired (e.g., Durable Object hibernated/evicted before cleanup)
2. Cloudflare evicted the Durable Object without triggering close handlers

**Fix options:**
- A) Add a heartbeat timeout on the manager side (check `last_seen` age, mark offline)
- B) Add a periodic cleanup job/endpoint that marks stale agents offline
- C) Frontend checks `last_seen` age and shows "Stale" if too old
- Option B is most practical for Cloudflare Workers (no cron, but can do it on API call)

## Bug 2: "Last Seen" Shows Epoch Date (1/21/1970)

**Location:** `frontend/src/pages/AgentDetail.tsx:200`

**Root cause:** `new Date(agent.lastSeen)` treats timestamp as milliseconds, but backend sends seconds.

**AgentList.tsx does it correctly:**
```typescript
// AgentList.tsx:197 - CORRECT
formatDistanceToNow(new Date(agent.lastSeen * 1000), { addSuffix: true })

// AgentDetail.tsx:200 - BUG
new Date(agent.lastSeen).toLocaleString()  // Missing * 1000
```

**Fix:** Change to `new Date(agent.lastSeen * 1000).toLocaleString()`

## Bug 3: No Automatic Cleanup of Pending Agents

**Location:** `manager/src/routes/admin.ts:54-73`

**Current behavior:**
- Token generated → pending agent record created in D1
- Ephemeral token expires after 1 hour (JWT)
- But the pending agent record stays in D1 forever
- Manual delete endpoint exists: `DELETE /api/admin/pending-agents/:id`

**Fix options:**
- A) Cleanup on agents list API call (check pending agents with expired tokens)
- B) Scheduled cleanup via Cloudflare Cron Trigger
- C) Frontend shows "Expired" badge and delete button for stale pending agents
- Option A is simplest — cleanup when listing agents

## Agent Detail URL Routing

**Not a bug, by design:** Routes use UUID (`/agents/:id`), not name. Navigation from AgentList uses `agent.id` (UUID). Direct URL by name won't work.

## Server State

### maestroserver (this server)
- Agent process: NOT running
- Systemd service: installed but `disabled` (never enabled)
- Agent log: empty/missing
- Docker: 3 Zomboid servers running fine
- Last agent version: built locally, not via systemd

### zedops-test-agent (10.0.13.208)
- VM unreachable (no route to host)
- Last known: was running but auth was failing

### GitHub Releases
- 5 releases: v1.0.0 through v1.0.5
- Latest: agent-v1.0.5 (Jan 21)
- All CI/CD workflows working (Release Agent, Deploy Dev, Deploy Prod)

## UI State Summary (from browser review)
- Dashboard: 2 agents "Online" (stale), 3 servers, 2 users, 0 players
- Agents page: Both show "Online" with metrics (stale data)
- Agent detail: Shows metrics, storage, server tabs
- Servers page: 3 servers (jeanguy, myfunserver, build42-testing) all "Managed"
- Add Agent dialog: Working (name field + generate command)
