# Findings: M9.8.33 - Real-Time Agent Logs

**Goal:** Document research and design decisions for agent log streaming
**Updated:** 2026-01-14

---

## Existing Container Logs Implementation

### Agent Side (`agent/main.go`)
- **Handler:** `handleLogStreamStart()` (line ~570)
- **Pattern:**
  1. Receives `log.stream.start` message with `containerId`
  2. Creates context with cancel for cleanup
  3. Calls `a.docker.StreamContainerLogs()` to get log channel
  4. Sends `log.line` messages to manager in goroutine
  5. Tracks active streams in `a.logStreams` map
  6. `handleLogStreamStop()` cancels context

### Manager/DO Side (`AgentConnection.ts`)
- **Endpoint:** `/api/agents/:id/logs/ws` (WebSocket)
- **Pattern:**
  1. Frontend connects, sends `log.subscribe` with `containerId`
  2. DO forwards `log.stream.start` to agent
  3. Agent sends `log.line` messages back
  4. DO broadcasts to all WebSocket subscribers
  5. Caches recent logs for new subscribers

### Frontend Side
- **Hook:** `useLogStream.ts` - Manages WebSocket connection
- **Component:** `LogViewer.tsx` - Renders logs with Dracula theme
- **Messages:**
  - `log.subscribe` → Subscribe to container logs
  - `log.history` ← Cached logs on connect
  - `log.line` ← New log entry
  - `log.stream.error` ← Error notification
  - `log.unsubscribe` → Stop streaming

---

## Agent Log Capture Options

### Option 1: Custom io.Writer
```go
// Wrap log output with custom writer that also sends to subscribers
type LogCapture struct {
    buffer *ring.Buffer
    subscribers []chan string
}

func (lc *LogCapture) Write(p []byte) (n int, err error) {
    // Write to original output
    // Add to ring buffer
    // Send to subscribers
}
```

### Option 2: Log Hook
```go
// Use log package hooks if using structured logging
log.SetOutput(io.MultiWriter(os.Stdout, &logCapture))
```

### Option 3: Redirect stdout/stderr
```go
// Capture at OS level
// More complex, may miss some output
```

**Recommendation:** Option 1 or 2 (simpler, Go-native)

---

## Message Protocol Design

*To be defined*

### Subscribe
```json
{
  "subject": "agent.logs.subscribe",
  "data": {
    "historyLines": 100
  }
}
```

### Log Entry
```json
{
  "subject": "agent.logs",
  "data": {
    "timestamp": "2026-01-14T12:34:56Z",
    "level": "INFO",
    "message": "Log message here"
  }
}
```

### Unsubscribe
```json
{
  "subject": "agent.logs.unsubscribe"
}
```

---

## Code Audit Results

### Agent Container Logs (main.go:560-650)
- **Handler:** `handleLogStreamStart()` (line 561)
- **Flow:**
  1. Receives `log.stream.start` with `containerId`, `tail`, `follow`, `timestamps`
  2. Tracks streams in `a.logStreams` map (containerId → cancel func)
  3. Calls `a.docker.StreamContainerLogs(ctx, containerId, tail)` → returns (logChan, errChan)
  4. Goroutine reads from logChan, sends `log.line` messages to manager
  5. On `log.stream.stop`, context cancelled, goroutine exits

### DO Container Logs (AgentConnection.ts:1032-1400)
- **WebSocket Endpoint:** `/logs/ws` via `handleUIWebSocketUpgrade()` (line 1032)
- **Tracking:**
  - `logSubscribers: Map<string, LogSubscriber>` - subscriberId → { ws, containerIds }
  - `logBuffers: Map<string, CircularBuffer<LogLine>>` - containerId → buffer
- **Flow:**
  1. UI connects, sends `log.subscribe` with containerId (line 1113)
  2. DO adds to logSubscribers, sends cached history from logBuffers
  3. DO forwards `log.stream.start` to agent
  4. Agent sends `log.line` messages (line 292, 1375)
  5. DO broadcasts to all subscribers for that container (line 1395)

### Frontend Log Hook (useLogStream.ts)
- **Connection:** `${protocol}//${host}/api/agents/${agentId}/logs/ws?token=${token}`
- **Messages Sent:**
  - `log.subscribe` { containerId }
  - `log.unsubscribe` { containerId }
- **Messages Received:**
  - `log.history` { containerId, lines[] }
  - `log.line` { containerId, timestamp, stream, message }
  - `log.subscribed` { containerId, message }
  - `log.stream.error` { error }
- **Features:**
  - Auto-reconnect with exponential backoff (max 5 attempts)
  - Graceful unsubscribe on disconnect

---

## Agent Logs Design (New Implementation)

### Proposed Message Protocol

#### Subscribe (UI → DO → Agent)
```json
{
  "subject": "agent.logs.subscribe",
  "data": {
    "tail": 500
  }
}
```

#### Log Entry (Agent → DO → UI)
```json
{
  "subject": "agent.logs.line",
  "data": {
    "timestamp": 1705234567890,
    "level": "INFO",
    "message": "Starting container: steam-zomboid-test"
  }
}
```

#### History (DO → UI on connect)
```json
{
  "subject": "agent.logs.history",
  "data": {
    "lines": [...]
  }
}
```

### Implementation Components

**Agent (Go):**
1. Custom `LogCapture` writer wrapping stdout
2. Ring buffer (1000 lines) for history
3. `agentLogSubscribers` map tracking manager subscription
4. `handleAgentLogsSubscribe()` - start sending logs
5. `handleAgentLogsUnsubscribe()` - stop sending

**DO (TypeScript):**
1. `agentLogSubscribers: Map<WebSocket, boolean>` - track UI subscribers
2. `agentLogBuffer: CircularBuffer<AgentLogLine>` - cache recent logs
3. Forward `agent.logs.subscribe` to agent
4. Forward `agent.logs.line` to all UI subscribers

**Frontend (React):**
1. `useAgentLogStream` hook (copy useLogStream pattern)
2. `AgentLogViewer` component (copy LogViewer pattern)
3. Logs tab in AgentDetail page

---
