# Progress: M9.8.16 - Fix Log Stream Duplicate Subscription

**Milestone:** M9.8.16
**Started:** 2026-01-13 19:35

---

## Session Log

### 19:35 - Investigation Started

**User report:**
```
[LogStream] Stream error: Already streaming logs for this container
```

**Root cause identified:**
- useEffect dependency array includes `connect` and `disconnect` callbacks
- These are useCallback functions that get recreated when their deps change
- Causes useEffect to run multiple times
- Race condition: disconnect doesn't complete before new connect
- Backend sees duplicate subscription attempt

**Solution:**
- Remove callback functions from dependency array
- Use only primitive values: `enabled`, `agentId`, `containerId`

### 19:40 - Fix Implemented

**Changes made:**
- ✅ Updated useEffect dependency array in useLogStream.ts
- ✅ Removed `connect` and `disconnect` from deps (they're already memoized)
- ✅ Added primitive values: `enabled`, `agentId`, `containerId`
- ✅ Added eslint-disable comment to acknowledge intentional pattern

**Before:**
```typescript
}, [enabled, connect, disconnect]); // ← Callbacks trigger unnecessary re-renders
```

**After:**
```typescript
}, [enabled, agentId, containerId]); // ← Only primitive values
```

**Build and deployment:**
- ✅ Built frontend successfully (5.84s)
- ✅ Updated asset filename: index-Bv4-c-RU.js
- ✅ Deployed to Cloudflare Workers (8.58s)

**Deployment:**
- Version: d1480495-083d-4015-bad8-945a551c32b0
- URL: https://zedops.mail-bcf.workers.dev
- Status: Ready for user testing

**Testing instructions:**
1. Open log viewer for a container
2. Navigate away (back to containers)
3. Open log viewer again for same container
4. Should NOT see "Already streaming logs" error
5. Logs should display correctly

---

### 19:45 - User Testing Complete

**User confirmation:**
- ✅ Tested log viewer
- ✅ No more "Already streaming logs" error
- ✅ Fix confirmed working

---

## Next Steps

1. ✅ Fix useEffect dependencies in useLogStream.ts
2. ✅ Build and deploy
3. ✅ User testing - M9.8.16 COMPLETE
