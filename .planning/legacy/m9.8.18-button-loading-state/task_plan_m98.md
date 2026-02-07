# Task Plan: M9.8.18 - Fix Button Loading State Propagation

**Goal:** Fix button loading states so only the clicked button shows loading animation, not all similar buttons

**Priority:** LOW (Visual bug only)
**Started:** 2026-01-13

---

## Phases

### Phase 1: Find All Occurrences ✅ complete
- Search for components with action buttons and loading states
- Identify patterns of button loading management
- Document each occurrence with current implementation

**Files checked:**
- ✅ ServerList.tsx - 1 occurrence (Purge button)
- ✅ AgentServerList.tsx - 9 occurrences (Start, Stop, Delete, Rebuild, Purge, Restore, Cleanup, Sync)
- ✅ ServerDetail.tsx - Not affected (single server page)

### Phase 2: Identify Root Cause Pattern ✅ complete
- React Query mutation `isPending` is GLOBAL state
- All buttons checking same `isPending` show loading simultaneously
- Need to check `variables` field to scope to specific item
- Solution: `isPending && variables?.itemId === currentItem.id`

### Phase 3: Implement Fix ✅ complete
- Use React Query `variables` pattern (no new state needed)
- Apply fix to ServerList.tsx (1 occurrence)
- Apply fix to AgentServerList.tsx (9 occurrences)
- Ensure consistent pattern across all buttons

**Fix Pattern:**
```tsx
// Before: disabled={mutation.isPending}
// After:  disabled={mutation.isPending && mutation.variables?.serverId === server.id}
```

### Phase 4: Test & Deploy ⏳ in_progress
- Test each action button type
- Verify only clicked button shows loading
- Build frontend and deploy manager
- Update MILESTONE-M98.md

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
