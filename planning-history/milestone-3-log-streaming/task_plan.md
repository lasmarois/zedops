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
| 1. Research | complete | Docker log streaming APIs, pub/sub patterns, UI libraries |
| 2. Agent Log Streaming | complete | Implement Docker log streaming in Go agent |
| 3. Durable Object Pub/Sub | complete | Multi-client log forwarding with caching |
| 4. UI Log Viewer | complete | Real-time log display with auto-scroll and filtering |
| 5. Testing | pending | End-to-end validation with multiple clients |

---

## Phase 1: Research ✅ complete

**Status:** complete

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

## Phase 2: Agent Log Streaming ✅ complete

**Status:** complete

**Goals:**
- ✅ Stream container logs from Docker daemon
- ✅ Parse log format (timestamp, stream, message)
- ✅ Send logs to manager via WebSocket
- ✅ Handle log streaming start/stop commands

**Tasks:**
- [x] Implement container log streaming in agent/docker.go
- [x] Add log.stream message handler
- [x] Parse Docker log format (multiplexed stream)
- [x] Handle log.stream.start / log.stream.stop messages
- [x] Add error handling for disconnected streams
- [ ] Test with high-volume log output (pending live testing)

**Files Created/Modified:**
- agent/docker.go - Added StreamContainerLogs(), LogLine struct, parseLogLine()
- agent/main.go - Added handleLogStreamStart(), handleLogStreamStop(), logStreams map

**Implementation Details:**
- Docker multiplexed stream format (8-byte header + payload)
- Channels for async log streaming (100-line buffer)
- Context-based cancellation for stopping streams
- Timestamp parsing from Docker RFC3339Nano format
- Default 1000-line tail

---

## Phase 3: Durable Object Pub/Sub ✅ complete

**Status:** complete

**Goals:**
- ✅ Forward logs from agent to multiple UI clients
- ✅ Implement pub/sub pattern in Durable Objects
- ✅ Cache last 1000 lines for new clients
- ✅ Handle client subscribe/unsubscribe

**Tasks:**
- [x] Add log subscription management to AgentConnection
- [x] Implement log buffer (ring buffer, 1000 lines)
- [x] Forward logs to all subscribed clients
- [x] Add log.subscribe / log.unsubscribe message handlers
- [x] Send cached logs to new subscribers
- [x] Handle client disconnections gracefully

**Files Created/Modified:**
- manager/src/types/LogMessage.ts - Created with log types and CircularBuffer class
- manager/src/durable-objects/AgentConnection.ts - Added pub/sub logic with subscriber maps and log buffers

**Implementation Details:**
- Map<string, LogSubscriber> for subscriber tracking (subscriberId → subscriber)
- Map<string, CircularBuffer<LogLine>> for log buffers (containerId → buffer)
- Reference counting: start/stop agent streaming based on subscriber count
- /logs/ws endpoint for UI WebSocket connections
- Broadcast pattern: agent → Durable Object → all UI subscribers
- Cached logs sent immediately on subscribe (log.history message)

---

## Phase 4: UI Log Viewer ✅ complete

**Status:** complete

**Goals:**
- ✅ Create log viewer component
- ✅ Display logs with auto-scroll
- ✅ Add log filtering (by stream type and search term)
- ✅ Handle WebSocket connection to manager
- ✅ Subscribe to container logs

**Tasks:**
- [x] Create LogViewer.tsx component
- [x] Custom log viewer with terminal-like display (no external library needed)
- [x] Add auto-scroll functionality (toggle on/off)
- [x] Add log filtering UI (stream dropdown + search input)
- [x] Implement WebSocket connection logic (useLogStream hook)
- [x] Handle log.stream messages from manager
- [x] Add loading state and error handling
- [x] Add "View Logs" button to ContainerList
- [x] Update App.tsx routing for log viewer
- [ ] Test with high-volume logs (pending live testing)

**Files Created/Modified:**
- frontend/src/hooks/useLogStream.ts - Created WebSocket hook for log streaming
- frontend/src/components/LogViewer.tsx - Created log viewer component
- frontend/src/components/ContainerList.tsx - Added onViewLogs prop and "View Logs" button
- frontend/src/App.tsx - Added routing for log viewer

**Implementation Details:**
- Terminal-like display with Dracula color scheme
- Auto-scroll with automatic detection when user scrolls up
- Stream filtering (all, stdout, stderr)
- Search filtering (case-insensitive substring match)
- Pause/Resume streaming
- Clear logs button
- Line count display (filtered / total)
- Timestamp formatting (HH:MM:SS.mmm)
- Color-coded stream types (stdout=green, stderr=red, unknown=yellow)
- WebSocket reconnection with exponential backoff
- Graceful cleanup on unmount

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

## Known Limitations

- **Container restart handling**: If a container restarts while viewing logs, the log stream ends and doesn't automatically resume. User must close and reopen the log viewer. This is because:
  - Docker closes the old container's log stream (EOF) on restart
  - Agent detects EOF and exits the streaming goroutine
  - UI remains subscribed but no new logs arrive
  - **Workaround**: Close log viewer and reopen after container restart
  - **Future enhancement**: Auto-detect container restart and reconnect stream
