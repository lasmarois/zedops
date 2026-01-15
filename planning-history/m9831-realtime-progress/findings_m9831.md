# Findings: M9.8.31 - Real-time Progress Streaming

**Purpose:** Document discoveries during implementation
**Started:** 2026-01-14

---

## Current Implementation Analysis

### Agent: MoveServerData() - server.go:656

**Current behavior:**
1. Calculates total size/files first (lines 678-692)
2. Walks source directory copying files (lines 700-736)
3. Logs progress every 100 files or 100MB via `log.Printf` (lines 726-732)
4. Returns final `ServerMoveDataResponse` after completion

**Key progress logging point (line 726-732):**
```go
if filesCopied%100 == 0 || bytesCopied%(100*1024*1024) < info.Size() {
    percent := 0
    if totalBytes > 0 {
        percent = int((bytesCopied * 100) / totalBytes)
    }
    log.Printf("Copy progress: %d%% (%d/%d files, %d/%d bytes)", percent, filesCopied, totalFiles, bytesCopied, totalBytes)
}
```

**Modification needed:**
- Add callback parameter: `progressFn func(MoveProgress)`
- Call callback at each progress point instead of just logging
- Callback will be provided by `handleServerMoveData`

### Agent: handleServerMoveData() - main.go:910

**Current behavior:**
1. Parses request (serverName, oldPath, newPath)
2. Calls `MoveServerData()` synchronously
3. Sends single response to `msg.Reply` inbox on completion

**Modification needed:**
- Create progress callback that sends `move.progress` messages
- Pass callback to `MoveServerData()`
- Continue sending final response on completion

### WebSocket Message Flow

**Existing pattern:**
- Agent sends message with `Subject` field
- Manager's DO receives in `handleMessage()`
- Processes based on subject (heartbeat, reply, etc.)

**New message type needed:**
```
Subject: "move.progress"
Data: {
  serverName: string,
  phase: "calculating" | "copying" | "verifying" | "cleaning" | "complete" | "error",
  bytesTotal: number,
  bytesCopied: number,
  filesTotal: number,
  filesCopied: number,
  percent: number,
  currentFile?: string,
  error?: string
}
```

---

## Design Decisions

### Decision 1: Progress Callback vs Channel

**Options:**
- A) Callback function - simpler, synchronous
- B) Channel - more Go-idiomatic, async

**Decision:** Callback function - simpler for this use case, no goroutine needed

### Decision 2: Frontend Subscription

**Options:**
- A) Frontend explicitly subscribes to progress for specific server
- B) DO broadcasts all progress, frontend filters
- C) DO stores progress in memory, frontend polls

**Decision:** Option B - broadcast via existing WebSocket, frontend filters by serverName
- Simpler implementation
- Reuses existing WebSocket infrastructure
- Frontend already connected

---
