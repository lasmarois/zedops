# Goal #24: Adopt Dialog — Mount Display + Migration Progress

## Problem

1. ~~Mount paths not showing in adopt dialog~~ — False alarm (browser cache)
2. No visual feedback during data migration in adopt flow — just "Adopting..." button for 30+ seconds

## Solution

Add real-time progress streaming during adoption data migration, reusing the existing `move.progress` WebSocket pattern. The agent sends progress messages during `copyDirContents()`, and the frontend shows a progress bar in the adopt dialog.

---

## Phase 1: Verify mount display works `status: complete`

### Tasks
- [ ] 1.1 Hard-refresh the adopt dialog in browser, confirm mount paths + data path field visible
- [ ] 1.2 Take screenshot as evidence

---

## Phase 2: Agent — Add progress streaming to adoption `status: complete`

### Tasks
- [ ] 2.1 Add progress callback parameter to `copyDirContents()`
- [ ] 2.2 In `AdoptServer()`, create progress callback that sends `adopt.progress` messages
- [ ] 2.3 Calculate total size before copying (like `MoveServerData` does)
- [ ] 2.4 Send progress updates during bin and data migration phases
- [ ] 2.5 Progress message format: `{phase, percent, totalBytes, bytesCopied, serverName}`

### Message Format
```json
{
  "subject": "adopt.progress",
  "data": {
    "serverName": "build42-jan26",
    "phase": "copying-bin" | "copying-data" | "creating-container" | "complete",
    "percent": 45,
    "totalBytes": 1234567,
    "bytesCopied": 555555
  }
}
```

---

## Phase 3: Frontend — Show progress in adopt dialog `status: complete`

### Tasks
- [ ] 3.1 Create `useAdoptProgress` hook (or reuse `useMoveProgress` with different subject filter)
- [ ] 3.2 In `AdoptServerDialog`, listen for `adopt.progress` messages when `adoptMutation.isPending`
- [ ] 3.3 Show progress bar with phase text and percentage
- [ ] 3.4 Transition: "Adopting..." → progress bar → dialog closes on success

---

## Phase 4: Test & Verify `status: complete`

### Tasks
- [ ] 4.1 Build agent, deploy, test with a container that has data to migrate
- [ ] 4.2 Verify progress bar updates during migration
- [ ] 4.3 Verify dialog closes on completion
- [ ] 4.4 Verify no-migration case still works (data already at standard path)

---

## Files to Modify

| File | Changes |
|------|---------|
| `agent/server.go` | Add progress callback to `copyDirContents()`, progress sending in `AdoptServer()` |
| `agent/main.go` | Pass message sender to `AdoptServer()` for progress streaming |
| `frontend/src/components/AdoptServerDialog.tsx` | Progress bar UI during adoption |
| `frontend/src/hooks/useAdoptProgress.ts` | New hook for adopt progress WebSocket messages |
