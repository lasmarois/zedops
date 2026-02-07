# Progress Log: M9.8.33 - Real-Time Agent Logs

**Goal:** View agent's log output in real-time from the platform UI
**Started:** 2026-01-14
**Status:** Phase 1 - Investigation

---

## Session 1: 2026-01-14

### Phase 1: Investigation - COMPLETE ✓

**Task:** Understand existing container logs implementation to reuse patterns

**Completed:**
- [x] Read `agent/main.go` - handleLogStreamStart (lines 560-650)
- [x] Read `manager/src/durable-objects/AgentConnection.ts` - handleUIWebSocketUpgrade (line 1032)
- [x] Read `frontend/src/hooks/useLogStream.ts` - WebSocket hook pattern
- [x] Document findings in `findings_m9833.md`

**Key Findings:**
- Container logs use WebSocket with pub/sub pattern
- Agent tracks streams in map, sends `log.line` messages
- DO manages subscribers and buffers, broadcasts to all
- Frontend has auto-reconnect with exponential backoff
- Can reuse entire pattern for agent logs

---

### Phase 2: Agent Implementation - COMPLETE ✓

**Task:** Add log capture mechanism and message handlers to agent

**Completed:**
- [x] Create `LogCapture` struct with ring buffer (`logcapture.go`)
- [x] Wrap `log` package output with custom writer
- [x] Add `handleAgentLogsSubscribe()` handler
- [x] Add `handleAgentLogsUnsubscribe()` handler
- [ ] Test locally (requires Go environment)

**Files Created/Modified:**
- `agent/logcapture.go` (NEW) - LogCapture struct, ring buffer, subscriber management
- `agent/main.go` - Added logCapture field, initialized in main(), message handlers

**Key Design:**
- Ring buffer stores last 1000 log lines
- LogCapture wraps log.SetOutput to capture all logs
- Sends `agent.logs.history` on subscribe
- Streams `agent.logs.line` messages for new logs
- Supports single manager subscription (can be extended)

---

### Phase 3: DO/Manager Routing - COMPLETE ✓

**Task:** Add agent log routing in Durable Object

**Completed:**
- [x] Add agent log subscriber tracking in DO
- [x] Add `AgentLogLine` and `AgentLogSubscriber` types to LogMessage.ts
- [x] Handle `agent.logs.subscribe` from UI → forward to agent
- [x] Handle `agent.logs.line` from agent → broadcast to UI
- [x] Handle `agent.logs.history` from agent → forward to UI
- [x] Auto-subscribe when first UI subscriber connects
- [x] Auto-unsubscribe when last UI subscriber disconnects

**Files Modified:**
- `manager/src/types/LogMessage.ts` - Added AgentLogLine, AgentLogSubscriber types
- `manager/src/durable-objects/AgentConnection.ts` - Added routing and handlers

---

### Phase 4: Frontend Implementation - COMPLETE ✓

**Task:** Add Logs tab to AgentDetail page

**Completed:**
- [x] Create `useAgentLogStream.ts` hook (similar to useLogStream)
- [x] Create `AgentLogViewer.tsx` component with Dracula theme
- [x] Add Logs tab to AgentDetail page
- [x] Build and update manager index.ts hashes

**Files Created/Modified:**
- `frontend/src/hooks/useAgentLogStream.ts` (NEW) - WebSocket hook for agent logs
- `frontend/src/components/AgentLogViewer.tsx` (NEW) - Log viewer with level filtering
- `frontend/src/pages/AgentDetail.tsx` - Added Logs tab

---

### Phase 5: Test and Deploy - COMPLETE ✓

**Task:** Deploy and verify functionality

**Completed:**
- [x] Deploy manager to Cloudflare (Version: 23d2645d-5866-448c-9630-c677920e1a5a)
- [x] Build agent with new log capture
- [x] Deploy new agent binary (running on localhost)
- [ ] Test end-to-end functionality (user testing)

**Agent Running:**
- Name: maestroserver
- ID: 98f63c0b-e48c-45a6-a9fe-a80108c81791
- Status: Connected, heartbeats active

---

### Bug Fixes During Testing

**Issue 1: "Agent not connected" error**
- Root cause: Agent token had `agentName: "maestroserver"` but agent was connecting as `maestroserver.nicomarois.com` (hostname)
- This caused agent and UI to connect to different Durable Objects
- Fix: Restarted agent with explicit `--name maestroserver` flag

**Issue 2: React error #310 "Rendered more hooks than during the previous render"**
- Root cause: In `AgentDetail.tsx`, `useQuery` and `useMutation` hooks were placed AFTER early returns
- This violates React's rules of hooks (hooks must be called in the same order every render)
- Fix: Moved hooks to top of component, before any conditional returns (lines 28-42)
- Redeployed: Version 91979330-2dd6-432d-b564-9d689f3ab294

---

### Enhancement: Cached Logs When Agent Offline

**User Request:** Show last logs before disconnect so users can see "what just happened?"

**Implementation:**
- DO now sends `agentOnline` status with history message
- Frontend hook tracks `isAgentOnline` state
- AgentLogViewer shows:
  - "Agent Offline" badge (amber) when agent disconnected
  - Info banner: "Agent is offline. Showing N cached log lines from before disconnect."
  - Empty state message when offline with no logs

**Files Modified:**
- `manager/src/durable-objects/AgentConnection.ts` - Added `agentOnline` to history message
- `frontend/src/hooks/useAgentLogStream.ts` - Track and expose `isAgentOnline`
- `frontend/src/components/AgentLogViewer.tsx` - Status badge and info banner

**Deployed:** Version 041fd8d8-c75d-4f51-844b-ccac746b51a7

---
