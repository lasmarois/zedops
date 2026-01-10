# Task Plan: Milestone 1 - Agent Connection

**Goal:** Establish WebSocket connection between Go agent and Cloudflare Durable Object manager using NATS-inspired message protocol. Agent registration with token flow, basic auth, UI displays agent status, and reconnection logic.

**Status:** in_progress
**Started:** 2026-01-10

---

## Success Criteria

- ✅ Agent can register with manager using ephemeral token
- ✅ Agent receives permanent token after registration
- ✅ WebSocket connection established between agent and Durable Object
- ✅ Bidirectional NATS-inspired messaging works (subject-based routing)
- ✅ Manager UI shows "Agent online ✓" when agent connected
- ✅ Agent automatically reconnects on network interruption
- ✅ Basic auth implemented (hardcoded admin for MVP)

---

## Context

**Current State:**
- Foundation documents complete (ARCHITECTURE.md, TECH_DECISIONS.md, etc.)
- Empty repository (no code yet)
- Tech stack decided: Workers (full-stack), Go (agent), TypeScript

**Key Architectural Decisions:**
- Single Worker deployment (static assets + API + Durable Objects)
- NATS-inspired WebSocket protocol (subject-based routing)
- Agent-initiated connections (outbound from agent, works through NAT)
- Hardcoded admin auth for MVP (proper RBAC in Milestone 6)

**References:**
- [ARCHITECTURE.md](ARCHITECTURE.md) - Message protocol details
- [TECH_DECISIONS.md](TECH_DECISIONS.md) - TD-001 (NATS protocol), TD-010 (Workers-only)
- [MILESTONES.md](MILESTONES.md) - Milestone 1 overview

---

## Phases

### Phase 1: Project Structure Setup ✅ complete
**Goal:** Initialize all project directories and configuration files

**Tasks:**
- [x] Create `frontend/` directory with Vite + React + TypeScript
- [x] Create `manager/` directory with Wrangler config
- [x] Create `agent/` directory with Go module
- [x] Initialize package.json files
- [x] Create wrangler.toml with D1, Durable Objects config
- [x] Create go.mod with dependencies
- [x] Add .gitignore files
- [x] Create basic README.md in each directory

**Output:**
- `frontend/package.json` with Vite, React, TanStack Query, Zustand dependencies ✅
- `manager/wrangler.toml` with Durable Objects binding, D1 database, static assets ✅
- `manager/schema.sql` with agents table ✅
- `agent/go.mod` with gorilla/websocket and google/uuid dependencies ✅
- README.md files in manager/ and agent/ directories ✅

**Validation:**
- ✅ Project structure created (frontend/, manager/, agent/)
- ✅ All configuration files in place
- ⏳ Dependencies installation deferred (GLIBC limitation on this system)

---

### Phase 2: Manager - Durable Object WebSocket Handler ✅ complete
**Goal:** Create Durable Object that accepts WebSocket connections from agents

**Tasks:**
- [x] Create `manager/src/durable-objects/AgentConnection.ts`
- [x] Implement WebSocket upgrade in `fetch()` handler
- [x] Accept WebSocket connection
- [x] Store connection in Durable Object state
- [x] Implement basic message handler (log received messages)
- [x] Handle connection close/error
- [x] Create `/ws` route in main Worker that routes to Durable Object

**Output:**
- ✅ `AgentConnection.ts` with WebSocket handling (upgrade, message, close, error handlers)
- ✅ `manager/src/index.ts` using Hono, routing `/ws` to Durable Object
- ✅ Basic echo functionality (will be replaced with NATS routing in Phase 3)

**Validation:**
- ⏳ `wrangler dev` validation deferred (GLIBC limitation)
- ✅ Code structure in place
- ✅ WebSocket upgrade logic implemented

---

### Phase 3: NATS-Inspired Message Protocol ⏳ pending
**Goal:** Implement subject-based message routing in Durable Object

**Tasks:**
- [ ] Define `Message` TypeScript interface (subject, reply, data, timestamp)
- [ ] Implement message parser (JSON → Message object)
- [ ] Implement subject routing logic (switch on subject)
- [ ] Create request/reply helper (store pending replies)
- [ ] Implement pub/sub fanout (broadcast to multiple connections)
- [ ] Add message validation (reject invalid subjects)

**Output:**
- `manager/src/types/Message.ts` with interface
- `AgentConnection.ts` with `handleMessage()` function
- Subject routing for: `agent.register`, `agent.heartbeat`, `inbox.*`

**Validation:**
- Send `{"subject":"agent.register"}` → routed correctly
- Send `{"subject":"inbox.abc"}` → handled as reply
- Invalid subject → rejected with error

---

### Phase 4: Agent Registration Flow (Manager) ⏳ pending
**Goal:** Implement token-based agent registration endpoints

**Tasks:**
- [ ] Create D1 database schema (agents table)
- [ ] Create `/api/admin/tokens` endpoint (generate ephemeral token)
- [ ] Implement ephemeral token generation (JWT, 1-hour expiry)
- [ ] Handle `agent.register` message in Durable Object
- [ ] Validate ephemeral token
- [ ] Generate permanent agent token (JWT, no expiry)
- [ ] Store agent in D1 (id, name, token_hash, status)
- [ ] Send reply with permanent token

**Output:**
- D1 migration: `schema.sql` with agents table
- `POST /api/admin/tokens` endpoint (returns ephemeral token)
- `agent.register` handler in Durable Object

**Validation:**
- `POST /api/admin/tokens` → returns ephemeral token
- Agent sends `agent.register` with ephemeral token → receives permanent token
- Agent stored in D1 with `online` status

---

### Phase 5: Go Agent - WebSocket Client ⏳ pending
**Goal:** Build Go agent that connects to manager via WebSocket

**Tasks:**
- [ ] Create `agent/main.go` entrypoint
- [ ] Implement WebSocket dial to manager URL
- [ ] Create `Message` struct (matches TypeScript interface)
- [ ] Implement message send/receive (JSON encoding)
- [ ] Implement registration flow (send `agent.register` with ephemeral token)
- [ ] Store permanent token to file (`~/.zedops-agent/token`)
- [ ] Implement request/reply pattern (pending map + channel)
- [ ] Add graceful shutdown (SIGTERM handler)

**Output:**
- `agent/main.go` with WebSocket client
- `agent/message.go` with Message struct and helpers
- `agent/token.go` with token storage

**Validation:**
- `go run main.go --token=<ephemeral>` → connects and registers
- Permanent token saved to `~/.zedops-agent/token`
- Agent can send/receive messages

---

### Phase 6: Agent Reconnection Logic ⏳ pending
**Goal:** Agent automatically reconnects on connection loss

**Tasks:**
- [ ] Implement reconnection loop (exponential backoff)
- [ ] Detect WebSocket close/error
- [ ] Reuse permanent token on reconnect
- [ ] Send `agent.heartbeat` every 30 seconds
- [ ] Handle heartbeat in Durable Object (update last_seen)
- [ ] Add max retry limit (e.g., 10 attempts)
- [ ] Log connection state changes

**Output:**
- `agent/reconnect.go` with reconnection logic
- Heartbeat goroutine in main.go

**Validation:**
- Stop manager → agent retries connection
- Restart manager → agent reconnects successfully
- Network disconnect → agent reconnects when network returns

---

### Phase 7: Manager API - Agent Status ⏳ pending
**Goal:** Expose API endpoint to list agents and their status

**Tasks:**
- [ ] Create `GET /api/agents` endpoint
- [ ] Query D1 for all agents
- [ ] Query Durable Objects for connection status (online/offline)
- [ ] Return JSON array of agents with status
- [ ] Add basic auth middleware (hardcoded admin password from ENV)
- [ ] Test with curl/Postman

**Output:**
- `GET /api/agents` endpoint
- Auth middleware in `manager/src/middleware/auth.ts`

**Validation:**
- `GET /api/agents` with auth header → returns agent list
- Agent online → status: "online"
- Agent offline → status: "offline"
- No auth header → 401 Unauthorized

---

### Phase 8: Basic UI - Agent List ⏳ pending
**Goal:** React UI component to display agent list

**Tasks:**
- [ ] Set up Vite dev server
- [ ] Install Shadcn UI components (Table, Badge)
- [ ] Create `AgentList.tsx` component
- [ ] Fetch agents from `/api/agents` (TanStack Query)
- [ ] Display agents in table (name, status, last seen)
- [ ] Add status badge (green = online, gray = offline)
- [ ] Add basic layout (header, main content)
- [ ] Add auth login (hardcoded password input)

**Output:**
- `frontend/src/components/AgentList.tsx`
- `frontend/src/App.tsx` with layout
- Auth context for storing admin token

**Validation:**
- `npm run dev` → UI loads at localhost:5173
- Agent list displays correctly
- Online agents show green badge
- Offline agents show gray badge

---

### Phase 9: Integration Testing & Validation ⏳ pending
**Goal:** End-to-end testing of agent connection flow

**Test Scenarios:**
1. **Fresh Registration:**
   - Generate ephemeral token from manager
   - Start agent with ephemeral token
   - Verify agent registers and receives permanent token
   - Verify UI shows "Agent online ✓"

2. **Reconnection:**
   - Stop manager (simulate network loss)
   - Verify agent retries connection
   - Restart manager
   - Verify agent reconnects automatically
   - Verify UI updates to "online"

3. **Bidirectional Messaging:**
   - Agent sends message with subject `test.echo`
   - Manager echoes message back
   - Agent receives echo response

4. **Multiple Agents:**
   - Start 3 agents with different names
   - Verify all 3 shown in UI
   - Stop 1 agent
   - Verify UI shows 2 online, 1 offline

**Tasks:**
- [ ] Test all scenarios above
- [ ] Fix any bugs found
- [ ] Document test results in progress.md

**Output:** Fully working agent connection system

**Validation:** All test scenarios pass ✅

---

## Dependencies

- **External:**
  - Cloudflare account (free tier)
  - Go 1.21+
  - Node.js 18+
  - Docker (for local D1 testing)

- **Between Phases:**
  - Phase 2 depends on Phase 1 (project structure)
  - Phase 3 depends on Phase 2 (WebSocket handler)
  - Phase 4 depends on Phase 3 (message protocol)
  - Phase 5 depends on Phase 4 (registration endpoint)
  - Phase 6 depends on Phase 5 (agent client)
  - Phase 7 depends on Phase 2, 4 (Durable Object + D1)
  - Phase 8 depends on Phase 7 (API endpoint)
  - Phase 9 depends on all previous phases

---

## Current Phase Details

**Phase:** Phase 3 - NATS-Inspired Message Protocol
**Next Action:** Implement subject-based message routing in Durable Object

---

## Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Use Vite for frontend | Fast, modern, TypeScript support | 2026-01-10 |
| Hardcode admin password | MVP simplicity, proper auth in M6 | 2026-01-10 |
| Store token in file | Simple persistence for agent | 2026-01-10 |
| 30s heartbeat interval | Balance between freshness and traffic | 2026-01-10 |

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| _(none yet)_ | - | - |

---

## Notes

- Keep this milestone focused: ONLY agent connection, no container control yet
- Don't build features for future milestones (stay disciplined)
- Test frequently (after each phase if possible)
- Commit after each phase completion
