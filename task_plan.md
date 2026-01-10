# Task Plan: Milestone 3 - Log Streaming

**Goal:** Real-time container log streaming from agent to UI via WebSocket

**Success Criteria:**
- User opens log viewer → sees live logs streaming
- Logs appear in UI <100ms after container outputs
- Multiple users can watch same logs simultaneously

**Status:** 🚧 In Progress
**Started:** 2026-01-10

---

## Phase Overview

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Research | pending | Docker log streaming APIs, pub/sub patterns, UI libraries |
| 2. Agent Log Streaming | pending | Implement Docker log streaming in Go agent |
| 3. Durable Object Pub/Sub | pending | Multi-client log forwarding with caching |
| 4. UI Log Viewer | pending | Real-time log display with auto-scroll and filtering |
| 5. Testing | pending | End-to-end validation with multiple clients |

---

## Phase 1: Research

**Status:** pending

**Goals:**
- Research Docker log streaming APIs
- Design pub/sub architecture for multi-client support
- Choose UI library for log display
- Design log caching strategy

**Tasks:**
- [ ] Research Docker SDK log streaming (Go)
- [ ] Review NATS pub/sub patterns
- [ ] Research terminal emulator libraries (xterm.js, react-lazylog, etc.)
- [ ] Design message protocol for log streaming
- [ ] Design log buffer/cache strategy (ring buffer?)
- [ ] Document findings in findings.md

**Questions to Answer:**
- How does Docker log streaming work? (API, streaming format)
- How to handle log backpressure? (client slower than log output)
- How to implement pub/sub in Durable Objects? (WebSocket fanout)
- What's the best UI library for displaying logs?
- How to filter logs by level? (need structured logging or regex?)

---

## Phase 2: Agent Log Streaming

**Status:** pending

**Goals:**
- Stream container logs from Docker daemon
- Parse log format (timestamp, stream, message)
- Send logs to manager via WebSocket
- Handle log streaming start/stop commands

**Tasks:**
- [ ] Implement container log streaming in agent/docker.go
- [ ] Add log.stream message handler
- [ ] Parse Docker log format (JSON or raw)
- [ ] Handle log.stream.start / log.stream.stop messages
- [ ] Add error handling for disconnected streams
- [ ] Test with high-volume log output

**Files to Create/Modify:**
- agent/docker.go - Add StreamContainerLogs() method
- agent/main.go - Add log streaming message handlers

---

## Phase 3: Durable Object Pub/Sub

**Status:** pending

**Goals:**
- Forward logs from agent to multiple UI clients
- Implement pub/sub pattern in Durable Objects
- Cache last 1000 lines for new clients
- Handle client subscribe/unsubscribe

**Tasks:**
- [ ] Add log subscription management to AgentConnection
- [ ] Implement log buffer (ring buffer, 1000 lines)
- [ ] Forward logs to all subscribed clients
- [ ] Add log.subscribe / log.unsubscribe message handlers
- [ ] Send cached logs to new subscribers
- [ ] Handle client disconnections gracefully

**Files to Create/Modify:**
- manager/src/durable-objects/AgentConnection.ts - Add pub/sub logic
- manager/src/types/LogMessage.ts - Log message types

**Implementation Considerations:**
- Use Map<string, WebSocket> for subscriber tracking
- Use circular buffer for 1000-line cache
- Each container has its own log buffer
- Broadcast logs to all subscribers efficiently

---

## Phase 4: UI Log Viewer

**Status:** pending

**Goals:**
- Create log viewer component
- Display logs with auto-scroll
- Add log filtering (by level, by search term)
- Handle WebSocket connection to manager
- Subscribe to container logs

**Tasks:**
- [ ] Create LogViewer.tsx component
- [ ] Integrate terminal/log library (xterm.js or react-lazylog)
- [ ] Add auto-scroll functionality (toggle on/off)
- [ ] Add log filtering UI (dropdown + search)
- [ ] Implement WebSocket connection logic
- [ ] Handle log.stream messages from manager
- [ ] Add loading state and error handling
- [ ] Test with high-volume logs

**Files to Create:**
- frontend/src/components/LogViewer.tsx
- frontend/src/hooks/useLogStream.ts
- frontend/src/lib/websocket.ts (if not exists)

**UI Design:**
- Terminal-like display (black background, monospace font)
- Auto-scroll toggle button
- Filter controls (level dropdown, search input)
- Container selector (dropdown)
- Clear logs button
- Pause/Resume streaming button

---

## Phase 5: Testing

**Status:** pending

**Goals:**
- Validate log streaming with single client
- Test multi-client scenario
- Test high-volume log output
- Verify <100ms latency
- Test filtering and search

**Test Scenarios:**
1. **Single Client Streaming**
   - User opens log viewer for container
   - Logs stream in real-time
   - Auto-scroll works correctly

2. **Multiple Clients**
   - 2-3 users watch same container logs
   - All clients see same logs simultaneously
   - No conflicts or dropped messages

3. **High Volume Logs**
   - Container outputs 100+ lines/second
   - UI remains responsive
   - No memory leaks

4. **Latency Test**
   - Container outputs log line
   - Measure time until UI displays it
   - Should be <100ms

5. **Filtering**
   - Filter by log level (INFO, WARN, ERROR)
   - Search by keyword
   - Filters work in real-time

6. **New Client Cache**
   - New client connects to streaming container
   - Receives last 1000 lines immediately
   - Then continues streaming new logs

7. **Connection Recovery**
   - WebSocket disconnects
   - Reconnects automatically
   - Resumes log streaming

---

## Dependencies

**External:**
- Docker log streaming API
- WebSocket support in Durable Objects (already implemented)
- Terminal/log UI library (to be chosen)

**Internal:**
- ✅ Milestone 2 complete (container control working)
- ✅ WebSocket connection established
- ✅ Message protocol working

---

## Errors Encountered

| Error | Phase | Attempt | Resolution |
|-------|-------|---------|------------|
| _(none yet)_ | - | - | - |

---

## Design Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| _(to be filled during research)_ | - | - |

---

## Notes

- Log streaming is read-only (no commands sent to container)
- Consider log rotation/cleanup to prevent memory issues
- May need to limit number of concurrent log streams per agent
- Consider rate limiting to prevent DoS via log flooding
- Log timestamps should be preserved from container
