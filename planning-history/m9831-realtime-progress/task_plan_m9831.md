# Task Plan: M9.8.31 - Real-time Progress Streaming for Data Migration

**Goal:** Show real-time progress when moving server data to a new path
**Priority:** Medium (UX enhancement for M9.8.29)
**Started:** 2026-01-14
**Status:** Phase 2 - Agent Implementation

---

## Overview

When user changes data path and clicks "Apply Changes", show a progress bar with:
- Bytes copied / Total bytes
- Files copied / Total files
- Percentage complete
- Current file being copied (optional)

**Current State:**
- Agent's `MoveServerData()` already calculates total size and logs progress
- But progress is only logged internally, not streamed back
- Frontend shows generic "Applying..." with no progress detail

---

## Architecture Options

### Option A: WebSocket Progress Stream (Recommended)
- Agent sends `move.progress` messages during operation
- DO forwards to frontend via existing WebSocket infrastructure
- Frontend subscribes and displays progress bar

**Pros:** Real-time, uses existing WebSocket
**Cons:** Need subscription mechanism, more complex

### Option B: Polling Endpoint
- Agent stores progress in memory
- Add GET `/servers/:id/move-progress` endpoint
- Frontend polls every 500ms during move

**Pros:** Simpler implementation
**Cons:** Not real-time, extra requests, progress lost if agent restarts

### Option C: Chunked HTTP Response
- Apply-config streams progress as chunked response
- Frontend reads stream and updates UI

**Pros:** No WebSocket changes needed
**Cons:** Cloudflare Workers doesn't support streaming responses well

**Decision:** Option A - WebSocket streaming

---

## Implementation Phases

### Phase 1: Investigation ⏳ IN PROGRESS
- [ ] Review current agent MoveServerData implementation
- [ ] Review existing WebSocket message flow
- [ ] Identify where to inject progress messages
- [ ] Design message format

### Phase 2: Agent Implementation ⏳ PENDING
- [ ] Modify MoveServerData to send progress via channel
- [ ] Update handleServerMoveData to forward progress messages
- [ ] Add `move.progress` message type
- [ ] Test progress messages are sent

### Phase 3: Manager/DO Implementation ⏳ PENDING
- [ ] Forward `move.progress` messages to subscribed frontends
- [ ] Add subscription mechanism for move operations
- [ ] Handle cleanup when move completes/fails

### Phase 4: Frontend Implementation ⏳ PENDING
- [ ] Add progress state to ServerDetail
- [ ] Subscribe to move progress when applying config
- [ ] Create ProgressBar component
- [ ] Display progress during data migration
- [ ] Handle completion/error states

### Phase 5: Testing & Polish ⏳ PENDING
- [ ] Test with small data (~100MB)
- [ ] Test with large data (~10GB)
- [ ] Test error handling (disk full, permission denied)
- [ ] Test cancel/timeout scenarios

---

## Message Format

```typescript
// Agent → Manager
{
  subject: "move.progress",
  data: {
    serverName: string,
    phase: "calculating" | "copying" | "verifying" | "cleaning" | "complete" | "error",
    bytesTotal: number,
    bytesCopied: number,
    filesTotal: number,
    filesCopied: number,
    currentFile?: string,
    error?: string
  }
}
```

---

## Files to Modify

### Agent
- `agent/server.go` - MoveServerData() to send progress
- `agent/main.go` - handleServerMoveData() to forward progress

### Manager
- `manager/src/durable-objects/AgentConnection.ts` - Forward progress messages

### Frontend
- `frontend/src/pages/ServerDetail.tsx` - Progress state and display
- `frontend/src/components/ProgressBar.tsx` - New component (or use existing)

---

## Success Criteria

- [ ] Progress bar shows during data migration
- [ ] Updates in real-time (every 100 files or 100MB)
- [ ] Shows bytes copied, files copied, percentage
- [ ] Handles errors gracefully
- [ ] Cleans up subscription on completion

---

## Notes

- Agent already logs progress every 100 files or 100MB - reuse this logic
- 5-minute timeout exists on move operation - progress helps user know it's working
- Consider adding cancel button (future enhancement)
