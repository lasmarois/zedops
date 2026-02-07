# Task Plan: M9.8.33 - Real-Time Agent Logs

**Goal:** View agent's log output in real-time from the platform UI
**Started:** 2026-01-14
**Status:** Phase 1 - Investigation

---

## Problem Statement

Currently, viewing agent logs requires SSH access to the host machine (`journalctl -u zedops-agent -f`). This makes debugging agent issues difficult, especially for users without direct server access.

**User Request:** Add a "Logs" tab to the agent detail page to view agent logs in real-time, similar to container logs.

---

## Phases

### Phase 1: Investigation ✓ COMPLETE
- [x] Understand how container logs streaming works (existing implementation)
- [x] Determine how agent can capture its own stdout/stderr
- [x] Review WebSocket infrastructure in Durable Object
- [x] Identify reusable components

### Phase 2: Agent Implementation ✓ COMPLETE
- [x] Add log capture mechanism (ring buffer for recent logs)
- [x] Add `agent.logs.subscribe` message handler
- [x] Stream logs to manager via WebSocket when subscribed
- [x] Handle unsubscribe/disconnect cleanup

### Phase 3: Manager/DO Implementation ✓ COMPLETE
- [x] Add `agent.logs` route in AgentConnection.ts
- [x] Forward log messages to subscribed frontend clients
- [x] Handle WebSocket subscription lifecycle

### Phase 4: Frontend Implementation ✓ COMPLETE
- [x] Add "Logs" tab to AgentDetail page
- [x] Create AgentLogViewer component (reuse LogViewer patterns)
- [x] Connect to WebSocket for real-time streaming
- [x] Add pause/resume, clear, auto-scroll controls

### Phase 5: Testing & Polish - IN PROGRESS
- [ ] Build and deploy agent with log capture
- [ ] Test with agent restart scenarios
- [ ] Test multiple subscribers
- [x] Add log level filtering
- [ ] Deploy and verify

---

## Key Files to Modify

**Agent:**
- `agent/main.go` - Add log capture and streaming handlers

**Manager:**
- `manager/src/durable-objects/AgentConnection.ts` - Add agent.logs route

**Frontend:**
- `frontend/src/pages/AgentDetail.tsx` - Add Logs tab
- `frontend/src/components/AgentLogViewer.tsx` (NEW) - Log display component

---

## Design Decisions

**Approach:** Option A - WebSocket stream (reuse existing infrastructure)

**Why:**
- Already have WebSocket connection between agent ↔ DO ↔ frontend
- Container logs use similar pattern (proven architecture)
- Real-time streaming without polling
- Minimal new infrastructure needed

**Log Capture Strategy:**
- Agent captures its own log output via custom log writer
- Maintain ring buffer (last 1000 lines) for history on connect
- Stream new logs as they occur

---

## Success Criteria

- [ ] Agent detail page has "Logs" tab
- [ ] Logs stream in real-time when tab is open
- [ ] Recent log history shown on initial connect
- [ ] Pause/resume functionality works
- [ ] No memory leaks from long-running streams
- [ ] Works when agent reconnects

---

## References

- Container logs implementation: `agent/main.go` (handleContainerLogs)
- WebSocket infrastructure: `manager/src/durable-objects/AgentConnection.ts`
- Frontend LogViewer: `frontend/src/components/LogViewer.tsx`
- Issue tracking: `ISSUE-metrics-enhancements.md` (Section 8)
