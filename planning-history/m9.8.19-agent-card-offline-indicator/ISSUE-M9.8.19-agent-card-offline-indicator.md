# M9.8.19 - Agent Card Offline Visual Indicator

**Priority:** MEDIUM (UX Enhancement)

**Started:** 2026-01-13

**Completed:** 2026-01-13

**Status:** ✅ COMPLETE

---

## Problem

When an agent goes offline, the agent card doesn't have a clear visual indicator.

**User request:**
> "the agent card when it goes offline, I would like to see a red vertical side line instead of nothing"

**Current behavior:**
- Agent card likely shows status badge or text change
- No prominent visual indicator (colored border/side line)
- Harder to spot offline agents at a glance

**Expected behavior:**
- Offline agents should have a **red vertical side line** on the left edge
- Makes offline status immediately visible
- Consistent with modern UI patterns (notifications, alerts)

---

## Design Specification

### Visual Indicator
- **Position**: Left edge of agent card
- **Color**: Red (`#ef4444` or `destructive` theme color)
- **Width**: 4px
- **Style**: Solid vertical line from top to bottom of card

### Agent States
- **Online**: Green side line OR no side line (depending on preference)
- **Offline**: Red side line (always visible)
- **Connecting**: Yellow/orange side line (optional, if state exists)

### Example CSS
```css
.agent-card-offline {
  border-left: 4px solid #ef4444; /* red */
}

.agent-card-online {
  border-left: 4px solid #22c55e; /* green - optional */
}
```

---

## Investigation Plan

### Phase 1: Find Agent Card Component
- Locate agent card component (likely `AgentCard.tsx` or similar)
- Understand current layout and styling
- Check how agent status is determined and displayed

### Phase 2: Identify Agent Status
- Find where agent online/offline status comes from
- Check if status is boolean, enum, or string
- Understand when status updates (WebSocket, polling, etc.)

### Phase 3: Implement Side Line
- Add conditional border-left styling based on status
- Use theme colors (destructive for offline, success for online)
- Ensure styling doesn't break responsive layout

### Phase 4: Test Scenarios
- Agent goes offline (disconnect, crash, network loss)
- Agent comes back online
- Multiple agents with mixed states
- Responsive layout (mobile, tablet, desktop)

---

## Files to Investigate

- `frontend/src/components/AgentCard.tsx` (or similar)
- `frontend/src/pages/AgentsPage.tsx` (if cards rendered there)
- `frontend/src/hooks/useAgents.ts` (agent data and status)
- `frontend/src/types/agent.ts` (agent status type definitions)

---

## Implementation Approach

### Option 1: CSS Class Toggle (Recommended)
```tsx
<div
  className={cn(
    "agent-card",
    agent.status === 'offline' && "border-l-4 border-destructive",
    agent.status === 'online' && "border-l-4 border-success"
  )}
>
  {/* card content */}
</div>
```

### Option 2: Inline Style
```tsx
<div
  style={{
    borderLeft: agent.status === 'offline' ? '4px solid #ef4444' : 'none'
  }}
>
  {/* card content */}
</div>
```

### Option 3: Separate Visual Element
```tsx
<div className="relative">
  {agent.status === 'offline' && (
    <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />
  )}
  {/* card content */}
</div>
```

**Recommendation**: Option 1 (CSS class toggle) - cleanest, leverages theme colors, easiest to maintain

---

## User Questions

Before implementing:

1. **Green line for online agents?**
   - Option A: Red for offline, green for online
   - Option B: Red for offline, no line for online (cleaner)
   - **Suggestion**: Option B (red stands out more when needed)

2. **Line width preference?**
   - 3px (subtle)
   - 4px (balanced) ← Recommended
   - 6px (prominent)

3. **Show on all states or just offline?**
   - Offline only
   - Offline + Online
   - All states (offline, online, connecting, disconnected)

---

## Success Criteria

- [ ] Offline agents show red vertical side line (4px, left edge)
- [ ] Side line appears immediately when agent goes offline
- [ ] Side line disappears when agent comes back online
- [ ] Styling doesn't break card layout or responsiveness
- [ ] Works across all screen sizes
- [ ] Consistent with theme colors

---

## Notes

- Simple visual enhancement, low risk
- Should take <30 minutes to implement
- Good opportunity to review agent card component structure
- Consider adding to other cards (server cards?) if pattern works well

---

## Implementation Summary

**Completed:** 2026-01-13 (< 5 minutes)

**What was done:**
- Changed offline agent card left border from `border-l-muted` (gray) to `border-l-destructive` (red)
- Single line change in `frontend/src/components/AgentList.tsx` (line 182)
- Agent card already had left border implementation from M9.8.15 redesign

**Result:**
- ✅ Online agents: Green 4px left border
- ✅ Offline agents: Red 4px left border (was gray)
- ✅ Offline agents now stand out visually

**Commit:** 8ab9857
**File modified:** `frontend/src/components/AgentList.tsx`
