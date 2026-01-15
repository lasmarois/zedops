# M9.8.33 - Real-Time Agent Logs

**Status:** COMPLETE
**Completed:** 2026-01-14
**Duration:** ~3 hours (debugging + fixes)

---

## Overview

Implemented real-time agent log streaming to view agent output in the platform UI. Users can monitor agent activity, troubleshoot issues, and view cached logs even when the agent is offline.

---

## Features Implemented

### Agent Side (Go)
- **LogCapture system** - Custom io.Writer that captures all Go log output
- **Ring buffer** - 1000-line circular buffer for log history
- **Pub/sub pattern** - Subscribers receive new logs in real-time
- **Message handlers** - `agent.logs.subscribe`, `agent.logs.unsubscribe`
- **Cleanup on disconnect** - Proper state reset when WebSocket disconnects

### Manager/DO Side (TypeScript)
- **Log routing** - Forward `agent.logs.line` messages to UI subscribers
- **Log caching** - 1000-line CircularBuffer in DO for offline viewing
- **Auto-subscribe on connect** - DO subscribes to agent logs immediately on authentication
- **Re-subscribe on reconnect** - If agent reconnects with existing UI subscribers, re-subscribes automatically
- **Offline support** - Cached logs available even when agent disconnected

### Frontend (React)
- **AgentLogViewer component** - Real-time log display with auto-scroll
- **useAgentLogStream hook** - WebSocket connection management
- **Status indicators** - Shows agent online/offline status
- **Cached log count** - Shows how many logs are cached when offline

---

## Key Files Modified

### Agent
- `agent/main.go` - Added log streaming handlers and cleanup
- `agent/reconnect.go` - Added `cleanupOnDisconnect()` call
- `agent/logcapture.go` - LogCapture implementation (already existed)

### Manager
- `manager/src/durable-objects/AgentConnection.ts`:
  - Added `agentLogBuffer` (CircularBuffer)
  - Added `agentLogSubscribers` map
  - Added `isAgentLogStreaming` flag
  - Added `handleAgentLogSubscribe`, `handleAgentLogUnsubscribe`
  - Added `handleAgentLogLine`, `handleAgentLogHistory`
  - Auto-subscribe on agent auth/register
  - Reset streaming state on agent disconnect

### Frontend
- `frontend/src/components/AgentLogViewer.tsx` - New component
- `frontend/src/hooks/useAgentLogStream.ts` - New hook
- `frontend/src/pages/AgentDetail.tsx` - Added Logs tab

---

## Bug Fixes During Implementation

1. **"Already streaming to manager" on reconnect**
   - Root cause: Agent's `agentLogChan` not cleaned up on WebSocket disconnect
   - Fix: Added `cleanupOnDisconnect()` method

2. **Logs not showing after agent reconnect**
   - Root cause: DO's `isAgentLogStreaming` flag not reset on disconnect
   - Fix: Reset flag in `handleClose()`

3. **No re-subscribe when agent reconnects**
   - Root cause: DO only subscribed when UI first connected
   - Fix: Added re-subscribe logic in `handleAgentAuth`

4. **Cache empty until someone views logs**
   - Root cause: DO only subscribed when UI requested
   - Fix: Auto-subscribe on agent connect (always cache)

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Agent     │     │  Durable Object  │     │  Frontend   │
│             │     │                  │     │             │
│ LogCapture  │────▶│  agentLogBuffer  │────▶│ LogViewer   │
│ (1000 lines)│     │  (1000 lines)    │     │             │
│             │     │                  │     │             │
│ Subscribe ◀─┼─────│  Auto-subscribe  │◀────│  Subscribe  │
│             │     │  on connect      │     │  on view    │
└─────────────┘     └──────────────────┘     └─────────────┘
```

---

## Message Protocol

### Agent → Manager
- `agent.logs.history` - Initial log history on subscribe
- `agent.logs.line` - Individual log line (real-time)

### Manager → Agent
- `agent.logs.subscribe` - Request log streaming
- `agent.logs.unsubscribe` - Stop log streaming

### Manager → Frontend
- `agent.logs.history` - Cached logs + agent status
- `agent.logs.line` - Real-time log line
- `agent.logs.subscribed` - Subscription acknowledgment

---

## Testing Performed

1. **Basic streaming** - Logs appear in UI in real-time
2. **History on connect** - Previous logs shown on tab open
3. **Agent reconnect** - Logs resume after reconnection
4. **Offline caching** - Cached logs visible when agent offline
5. **Multiple subscribers** - Multiple UI tabs receive logs
6. **Auto-cache** - Logs cached even without UI viewing

---

## User Verification

- User confirmed logs appear in UI
- User confirmed offline caching works
- Feature approved for completion
