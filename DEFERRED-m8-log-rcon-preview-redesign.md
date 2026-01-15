# DEFERRED: M8 Log & RCON Preview Redesign

**Status:** DEFERRED
**Date Deferred:** 2026-01-14
**Reason:** Design needs rework - current implementation complete but may need UX improvements

---

## Current State

The Log and RCON previews on ServerDetail Overview tab are fully functional and aligned with M8 design spec:

**Log Preview:**
- ✅ Header: "LOG PREVIEW" (all caps)
- ✅ Button: "▼ Expand View"
- ✅ Shows last 5 log lines with timestamps
- ✅ Inline controls: [Auto-scroll ✓] [Pause] [Clear]
- ✅ Real-time streaming

**RCON Preview:**
- ✅ Header: "RCON PREVIEW" (all caps)
- ✅ Button: "▼ Expand View"
- ✅ Shows actual command history (last 3 commands + responses)
- ✅ Format: `> command` then response
- ✅ Controls: [History ▲▼] [Quick Commands ▼]
- ✅ Persists in sessionStorage

---

## Why Deferred

User wants to reconsider the design approach later. Current implementation is functional but UX may need improvement.

---

## Future Considerations

When revisiting this:
1. Review user feedback on current preview functionality
2. Consider alternative layouts for preview cards
3. Evaluate if inline controls are intuitive
4. Assess if command history approach is optimal

---

## Technical Debt

None - current implementation is clean and maintainable. RconHistoryContext can be reused or refactored as needed.

---

## Related Work

- Commits: f8c6bb2 (initial implementation), adfdbea (M8 alignment)
- Planning: `/planning-history/log-rcon-preview/`, `/planning-history/m8-design-alignment/`
- Files modified: ServerDetail.tsx, RconTerminal.tsx, RconHistoryContext.tsx
