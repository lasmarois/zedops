# Task Plan: M9.8.16 - Fix Log Stream Duplicate Subscription

**Goal:** Fix "Already streaming logs for this container" error

**Status:** COMPLETE

**Priority:** MEDIUM (Bug Fix)

**Started:** 2026-01-13 19:35

---

## Problem

User reports error when viewing server logs:
```
[LogStream] Stream error: Already streaming logs for this container
```

**Root Cause Analysis:**
The `useLogStream` hook has a dependency issue in its `useEffect`:

```typescript
useEffect(() => {
  if (enabled) {
    connect();
  }

  return () => {
    disconnect();
  };
}, [enabled, connect, disconnect]); // ← Problem: connect/disconnect are recreated on every render
```

**Issue:**
- `connect` and `disconnect` are `useCallback` functions that depend on `enabled`, `agentId`, `containerId`
- When any dependency changes, these callbacks are recreated
- This triggers the useEffect to run again
- The old connection disconnects and new one connects immediately
- **Race condition:** Backend might not process unsubscribe before new subscribe arrives
- Result: Backend thinks there are two active subscriptions

---

## Solution

**Fix the dependency array:**
- Remove `connect` and `disconnect` from useEffect deps
- Keep only the actual values: `enabled`, `agentId`, `containerId`
- The callbacks will be stable and only recreated when their deps actually change

**Alternative considered:**
- Add explicit unsubscribe acknowledgment from backend
- **Rejected:** Adds complexity, frontend fix is simpler

---

## Implementation Tasks

### Phase 1: Fix Hook Dependencies ✅ COMPLETE
- [x] Remove `connect` and `disconnect` from useEffect dependency array
- [x] Add direct dependencies: `agentId`, `containerId`
- [x] Added eslint-disable comment for intentional pattern

### Phase 2: Testing ✅ COMPLETE
- [x] Test opening log viewer
- [x] Test navigating away and back
- [x] Test switching between different containers
- [x] Verify no duplicate subscription errors
- [x] Check reconnection logic still works

### Phase 3: Deployment ✅ COMPLETE
- [x] Build frontend
- [x] Deploy to Cloudflare Workers
- [x] User testing and approval

---

## Files to Modify

- `frontend/src/hooks/useLogStream.ts` - Fix useEffect dependencies

**No backend changes required**

---

## Success Criteria

- [x] No "Already streaming logs" error when viewing logs
- [x] Logs display correctly on first view
- [x] Logs display correctly when navigating back
- [x] Reconnection logic still works if connection drops
- [x] User confirms fix works

---

## Notes

This is a common React hooks pattern issue - including callback functions in dependency arrays when they're already memoized with useCallback creates unnecessary re-renders and can cause race conditions.

Following planning-with-files pattern:
- Planning files in ROOT directory
- Will archive to planning-history/m9.8.16-fix-log-stream-subscription/ after completion
