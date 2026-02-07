# Task Plan: M9.8.29 - Data Path Migration with Progress Tracking

**Goal:** Enable moving server data to a different path with progress indication
**Priority:** HIGH (Completes M9.8.26-30 configuration management)
**Started:** 2026-01-14
**Status:** IN PROGRESS

---

## Overview

When user changes `server_data_path` in configuration and clicks "Apply Changes", the backend should:
1. Stop container
2. Move data from old path to new path (with progress updates)
3. Recreate container with new volume mounts
4. Start container

This is the final piece of the configuration editing feature (M9.8.28).

---

## Current State

**What Exists:**
- `PATCH /api/agents/:id/servers/:serverId/config` - Saves config changes to DB
- `POST /api/agents/:id/servers/:serverId/apply-config` - Rebuilds container with new config
- Frontend shows "Apply Changes" button after saving

**What's Missing:**
- Agent doesn't have data move capability
- Apply-config doesn't handle data path changes specially
- No progress tracking during migration

---

## Implementation Phases

### Phase 1: Investigation ⏳ IN PROGRESS

**Goals:**
1. Understand current apply-config flow
2. Check how data path is stored and passed
3. Identify where to add move logic
4. Design progress update mechanism

**Questions:**
- How does apply-config currently handle data path changes?
- What's the best way to stream progress (WebSocket vs HTTP chunked)?
- Should move be atomic (copy then delete) or direct (mv)?

**Files to Review:**
- `manager/src/routes/agents.ts` - apply-config endpoint
- `agent/server.go` - RebuildServerWithConfig
- `frontend/src/components/ConfigurationEdit.tsx` - Apply flow

---

### Phase 2: Agent Implementation ⏳ PENDING

**Tasks:**

1. **Add MoveServerData function** in `agent/server.go`:
   ```go
   func (dc *DockerClient) MoveServerData(serverName, oldPath, newPath string, progressCh chan<- MoveProgress) error
   ```
   - Validate source exists
   - Create destination directory
   - Copy files recursively with progress updates
   - Delete source after successful copy (atomic move)
   - Handle errors gracefully (rollback if needed)

2. **Add server.movedata handler** in `agent/main.go`:
   - Accept: serverName, oldPath, newPath
   - Stream progress updates back to manager
   - Return success/error

3. **Progress structure:**
   ```go
   type MoveProgress struct {
       Phase       string  `json:"phase"`       // "calculating", "copying", "cleaning", "complete"
       Percent     int     `json:"percent"`     // 0-100
       CurrentFile string  `json:"currentFile"` // Optional: file being copied
       BytesCopied int64   `json:"bytesCopied"`
       TotalBytes  int64   `json:"totalBytes"`
       Error       string  `json:"error,omitempty"`
   }
   ```

---

### Phase 3: Manager Implementation ⏳ PENDING

**Tasks:**

1. **Update apply-config endpoint** to detect data path changes:
   - Compare old `server_data_path` with new
   - If changed: trigger move before rebuild
   - Store old path in server record or request

2. **Add move orchestration**:
   - Stop container
   - Send `server.movedata` message to agent
   - Wait for completion (with timeout)
   - On success: proceed with rebuild
   - On failure: rollback status, report error

3. **Progress streaming** (options):
   - Option A: Agent sends progress messages, DO buffers and returns on completion
   - Option B: WebSocket subscription for real-time progress
   - Option C: Polling endpoint for progress status

**Recommended:** Option A for simplicity - return progress updates in final response

---

### Phase 4: Frontend Implementation ⏳ PENDING

**Tasks:**

1. **Update ConfigurationEdit apply flow**:
   - Detect if data path changed
   - Show enhanced progress for data migration
   - Display: "Moving data... X% (copying file.lua)"

2. **Progress UI**:
   - Progress bar component
   - Current operation text
   - Cancel button (if possible)
   - Error display with retry option

3. **Error handling**:
   - Show clear error message if move fails
   - Offer retry or rollback options
   - Don't leave user in undefined state

---

### Phase 5: Testing ⏳ PENDING

**Test Cases:**
1. Move small server (~100MB) - should complete in seconds
2. Move large server (~10GB) - should show meaningful progress
3. Move to non-existent path - should create directory
4. Move when disk full - should fail gracefully
5. Move while container running - should stop first
6. Cancel mid-move - should clean up properly

---

## Success Criteria

- [ ] Agent can move server data between paths
- [ ] Progress updates streamed during move
- [ ] Apply-config handles data path changes automatically
- [ ] Frontend shows progress bar during migration
- [ ] Errors handled gracefully (no data loss)
- [ ] Works with existing apply-config flow

---

## Notes

- Atomic move: Copy first, delete after verification (safer than mv)
- Progress calculation: Count files first, then track bytes copied
- Timeout: Large moves may take 10+ minutes - need appropriate timeout
- Permissions: Agent runs as root, should preserve file ownership
- Rollback: If move fails partway, source should remain intact

---

## References

- M9.8.28: Configuration editing (completed)
- M9.8.30: Image defaults (completed)
- ISSUE-M9.8.26-30: Master planning document (archived)
