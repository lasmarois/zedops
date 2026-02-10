# Goal #24: Findings

## Bug #1: Mount paths not showing in adopt dialog — FALSE ALARM

- The inspect API **does** return `mounts` correctly (verified via browser JS console)
- Response includes: `mounts: [{source, target, type}, ...]` with full paths
- The adopt dialog code in `AdoptServerDialog.tsx` correctly filters and renders them
- **Root cause**: Browser was serving cached old frontend (pre-Goal #23 deploy). Not a real bug.
- The data path field also works — it was just missing from the cached version

## Bug #2: No migration progress feedback — REAL

- During adoption, the button shows "Adopting..." with no other feedback
- Data migration took ~36 seconds for build42-jan26 (bin: 17s, data: 18s)
- The existing `move.progress` WebSocket infrastructure streams real-time progress during config-change moves
- However, adoption migration does NOT use `MoveServerData()` — it uses the new `copyDirContents()` which has no progress callback
- The adopt API endpoint has a 60-second timeout in the DO (`handleServerAdoptRequest`)

## Existing Progress Infrastructure

### `useMoveProgress` hook (`frontend/src/hooks/useMoveProgress.ts`)
- Filters `move.progress` messages from WebSocket by server name
- Provides: phase, percent, totalBytes, bytesCopied, totalFiles, filesCopied, currentFile
- Used in ServerDetail page during apply-config data path changes

### Agent `MoveServerData()` progress
- Sends `move.progress` messages during copy
- Progress updates every 100 files OR every 100MB
- Phases: calculating → copying → verifying → cleaning → complete

### Adopt flow difference
- `AdoptServer()` uses `copyDirContents()` — no progress callback
- The adopt happens via `server.adopt` message, not `server.movedata`
- Progress would need to be sent as a different subject (e.g., `adopt.progress`)
- OR we could reuse `move.progress` with the server name

## Design Options

### Option A: Add progress to agent AdoptServer (recommended)
- Add progress callback to `copyDirContents()` similar to `MoveServerData()`
- Agent sends `adopt.progress` (or `move.progress`) messages during copy
- Frontend listens via WebSocket and shows progress in dialog
- **Pro**: Real-time, reuses existing pattern
- **Con**: Requires WebSocket listener in adopt dialog

### Option B: Indeterminate progress bar
- Show a spinner/indeterminate bar with status text ("Migrating data...")
- No real-time feedback, just "something is happening"
- **Pro**: Simple, no agent changes needed
- **Con**: No real progress info, user doesn't know how long to wait

### Option C: Estimated time based on inspection
- Before starting, inspect mounts to estimate data size
- Show estimated time in dialog
- **Pro**: Gives user expectation
- **Con**: Estimate could be wrong, still no real-time feedback
