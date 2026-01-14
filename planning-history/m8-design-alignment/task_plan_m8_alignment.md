# Task Plan: Align Log/RCON Previews with M8 Design

**Goal:** Update ServerDetail Overview tab previews to match M8 design specifications

**Priority:** HIGH (Design Compliance)
**Started:** 2026-01-13

---

## Current State vs M8 Design

### Log Preview
**Current:**
- ✅ Shows last 5 real log lines with timestamps
- ✅ Real-time streaming
- ✅ "Expand View →" button
- ❌ Missing inline controls (Auto-scroll, Pause, Clear)

**M8 Design:**
- Header: "LOG PREVIEW"
- Button: "[▼ Expand View]"
- Controls: [Auto-scroll ✓] [Pause] [Clear]
- Last 5 lines with timestamps

### RCON Preview
**Current:**
- Shows static helper content
- Header: "RCON Console"
- Button: "Open Console →"
- No actual RCON interaction

**M8 Design:**
- Header: "RCON PREVIEW"
- Button: "[▼ Expand View]"
- Shows actual command history (last 2-3 commands + responses)
- Controls: [History ▲▼] [Quick Commands ▼]
- Example output:
  ```
  > players
  Players online (5): John, Sarah, Mike, Alex, Jordan

  > servermsg Welcome to the server!
  Message broadcast to all players
  ```

---

## Phases

### Phase 1: Log Preview - Add Inline Controls ✅ complete

**Goal:** Add Auto-scroll, Pause, Clear controls to log preview card

**Tasks:**
1. Add control buttons below log lines
2. Wire up auto-scroll toggle (control the streaming behavior)
3. Wire up pause button (stop receiving new logs)
4. Wire up clear button (clear displayed logs)
5. Update button text to "[▼ Expand View]" format

**State management:**
- Track `isLogsPaused` state
- Track `autoScrollEnabled` state
- Expose `clearLogs` from useLogStream hook (already available)

### Phase 2: RCON Preview - Command History Tracking ✅ complete

**Goal:** Show real RCON command history in preview

**Approach:** Store last few commands in localStorage/state

**Tasks:**
1. Connect to RCON using useRcon hook (only when server running)
2. Create command history state (store last 3 commands + responses)
3. When RCON tab sends commands, update history
4. Display history in preview card
5. Add controls: [History ▲▼] [Quick Commands ▼]

**Alternative simpler approach:**
- Use sessionStorage to track commands sent from RCON tab
- Preview reads from sessionStorage
- Show last 2-3 commands

**Decision:** Use React Context to share command history between RCON tab and preview

### Phase 3: RCON Context Provider 📋 pending

**Goal:** Share RCON command history between tabs

**Tasks:**
1. Create RconHistoryContext
2. Provider wraps ServerDetail component
3. RconTerminal component adds commands to history
4. RCON Preview reads from history
5. Store in sessionStorage for persistence

**Data structure:**
```typescript
interface RconHistoryEntry {
  timestamp: number;
  command: string;
  response: string;
}

interface RconHistoryContext {
  history: RconHistoryEntry[];
  addEntry: (command: string, response: string) => void;
  clearHistory: () => void;
}
```

### Phase 4: Update RCON Preview UI ✅ complete

**Goal:** Update RCON preview to match M8 design

**Tasks:**
1. Change header to "RCON PREVIEW"
2. Change button to "[▼ Expand View]"
3. Display last 2-3 commands from history
4. Add controls: [History ▲▼] [Quick Commands ▼]
5. Show connection status when no history
6. Graceful empty states

### Phase 5: Build & Deploy 📋 pending

**Tasks:**
1. Build frontend
2. Update manager HTML
3. Deploy to Cloudflare Workers
4. Test both previews
5. Verify M8 alignment

---

## Status Legend
- ⏳ in_progress
- ✅ complete
- 📋 pending
- ❌ blocked

---

## Design Compliance Checklist

### Log Preview
- [ ] Header: "LOG PREVIEW" (all caps)
- [ ] Button: "[▼ Expand View]" format
- [ ] Shows last 5 lines with timestamps
- [ ] Controls: [Auto-scroll ✓] [Pause] [Clear]
- [ ] Real-time streaming works

### RCON Preview
- [ ] Header: "RCON PREVIEW" (all caps)
- [ ] Button: "[▼ Expand View]" format
- [ ] Shows actual command history (last 2-3)
- [ ] Format: "> command" then response
- [ ] Controls: [History ▲▼] [Quick Commands ▼]
- [ ] Graceful empty state

---

## Notes

**RCON History Challenges:**
- RconTerminal uses xterm.js (commands in terminal buffer)
- Need way to extract/share command history
- Options:
  1. React Context (share state between components)
  2. SessionStorage (persist across tab switches)
  3. Global event emitter
  4. Zustand/Redux store

**Chosen approach:** React Context + SessionStorage
- Context for real-time updates
- SessionStorage for persistence
