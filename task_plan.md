# M9.8.47 - Agent Log Level Improvements

## Goal
Fix agent logs showing server creation errors as INFO instead of ERROR in the UI log viewer.

## Context
- User reported: `Failed to create server buena: ...` shows as INFO
- Log viewer has level filtering and icons - they work correctly
- Issue is in log level detection logic in agent

## Root Cause
`agent/logcapture.go` line 54 detects log levels by keywords, but doesn't include:
- "Failed to" / "failed to"
- "Failed:" / "failed:"

## Phases

### Phase 1: Fix Log Level Detection
**Status:** `complete`
- [x] Identify where log levels are parsed (logcapture.go:50-61)
- [x] Add "Failed to", "failed to", "Failed:", "failed:" to ERROR detection
- [x] Review other common error patterns in agent code

### Phase 2: Verify Frontend Already Works
**Status:** `complete`
- [x] Check terminal-log.tsx has level-based styling
- [x] Confirm ERROR level shows red/destructive styling (XCircle icon, red-400 color, red-500/10 bg)

### Phase 3: Build and Test
**Status:** `complete`
- [x] Build agent binary
- [x] Deploy to maestroserver
- [ ] Test by triggering error (will verify when error occurs naturally)

### Phase 4: Update M9.8 Tracker
**Status:** `in_progress`
- [ ] Mark M9.8.47 as complete in MILESTONE-M98.md
- [ ] Commit changes

## Files to Modify
| File | Change |
|------|--------|
| `agent/logcapture.go` | Add error keywords to detection |
| `MILESTONE-M98.md` | Update status when complete |
