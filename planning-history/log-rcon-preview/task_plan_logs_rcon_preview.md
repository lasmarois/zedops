# Task Plan: Log & RCON Preview on ServerDetail Overview Tab

**Goal:** Replace hardcoded placeholders in Log Preview and RCON Preview with real data

**Priority:** MEDIUM (UX Enhancement)
**Started:** 2026-01-13

---

## Current State

### Log Preview (lines 290-316)
- Shows hardcoded placeholder logs
- "Expand View" button switches to Logs tab (works)
- LogViewer component exists and works in Logs tab
- Uses `useLogStream` hook for real-time streaming

### RCON Preview (lines 318-346)
- Shows hardcoded placeholder RCON output
- "Expand View" button switches to RCON tab (works)
- RconTerminal component exists and works in RCON tab
- Uses `useRcon` hook for RCON connection

---

## Phases

### Phase 1: Investigate Log/RCON Hooks ✅ complete
- ✅ Read LogViewer component - uses `useLogStream` hook
- ✅ Read RconTerminal component - uses `useRcon` hook
- ✅ Understand data flow and state management

### Phase 2: Create Preview-Friendly Hooks ✅ complete

**Decision**: Option A - Reuse existing `useLogStream` hook

**Reasoning**:
- Simpler implementation (no new hooks needed)
- Maintains real-time updates automatically
- Can optimize later if resource usage becomes an issue

**Log Preview**: Use existing `useLogStream` hook
**RCON Preview**: Use static helper content (no hook needed)

### Phase 3: Implement Log Preview ✅ complete

**Tasks completed**:
1. ✅ Imported `useLogStream` in ServerDetail.tsx
2. ✅ Called hook at top of component (hooks rule compliance)
3. ✅ Extracted last 5 logs using `logs.slice(-5)`
4. ✅ Replaced hardcoded log lines with real data
5. ✅ Formatted timestamps: `HH:MM:SS` format
6. ✅ Color-coded stderr logs (red text)
7. ✅ Added graceful empty states:
   - "Server must be running to view logs" when stopped
   - "No logs yet" when no logs received
8. ✅ Show count: "Last N of M lines"

**Files modified**:
- `frontend/src/pages/ServerDetail.tsx` (lines 11, 35-40, 298-343)

### Phase 4: Implement RCON Preview ✅ complete

**Approach used**: Static helper content (Option 1)

**Tasks completed**:
1. ✅ Changed section title from "RCON Preview" to "RCON Console"
2. ✅ Changed button text to "Open Console →"
3. ✅ Replaced hardcoded fake output with helpful content:
   - Informative description text
   - Common commands table (4 commands with descriptions)
   - Clear call-to-action
4. ✅ Added graceful empty state when server not running

**Files modified**:
- `frontend/src/pages/ServerDetail.tsx` (lines 345-389)

### Phase 5: Build & Deploy ✅ complete

**Tasks completed**:
1. ✅ Built frontend (new asset: index-BwaGf5Da.js)
2. ✅ Updated manager HTML with new asset filename
3. ✅ Deployed to Cloudflare Workers (version: ae13c19e-92eb-4102-973e-54817a92a21a)
4. ✅ Verified deployment successful

---

## Status Legend
- ⏳ in_progress
- ✅ complete
- 📋 pending
- ❌ blocked

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | - | - |

---

## Notes

**Log Preview Considerations**:
- Should we auto-scroll to latest?
- Should preview update in real-time or be static snapshot?
- Decision: Real-time (use same streaming hook)

**RCON Preview Considerations**:
- RconTerminal manages own state (commands in xterm.js buffer)
- Hard to extract "last N commands" without refactoring
- Simpler to start with static helper content
- Can enhance later with shared command history context
