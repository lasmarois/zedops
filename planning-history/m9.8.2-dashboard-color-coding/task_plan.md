# M9.8.2 Task Plan - Dynamic Color Coding for Dashboard Stats

**Milestone:** M9.8.2 - Add Dynamic Color Coding to Dashboard Stats Cards
**Parent:** M9.8 - Polish & Production Readiness
**Priority:** LOW (Polish/UX Enhancement)
**Estimated Duration:** 15 minutes
**Started:** 2026-01-13

---

## Goal

Add dynamic color coding to Dashboard stat cards so that "0 running" and "0 online" display in gray (muted) instead of green, providing at-a-glance health indication.

---

## Success Criteria

- [x] Plan created
- [ ] Dashboard stats use dynamic colors based on values
- [ ] "0 running" shows in gray (text-muted-foreground)
- [ ] "N running" (N > 0) shows in green (text-success)
- [ ] "0 online" shows in gray (text-muted-foreground)
- [ ] "N online" (N > 0) shows in green (text-success)
- [ ] Build succeeds
- [ ] Deployed to production
- [ ] User validates visual improvement

---

## Current State Analysis

**Location:** `frontend/src/pages/Dashboard.tsx`

**Current Code (Lines 96-98, Servers Card):**
```tsx
<div className="text-sm text-success">{runningServers} running</div>
<div className="text-sm text-muted-foreground">{totalServers - runningServers} stopped</div>
```

**Problem:** "0 running" displays in green (text-success), which is misleading - green indicates healthy/active state.

**Current Code (Lines 96-98, Agents Card):**
```tsx
<div className="text-sm text-success">{onlineAgents} online</div>
<div className="text-sm text-muted-foreground">{offlineAgents} offline</div>
```

**Problem:** "0 online" displays in green, misleading when all agents are down.

---

## Implementation Phases

### Phase 1: Update Dashboard Stats (5 min) - `pending`

**File to Modify:** `frontend/src/pages/Dashboard.tsx`

**Changes:**

1. **Servers Card (lines 96-98):**
   ```tsx
   <div className={`text-sm ${runningServers > 0 ? 'text-success' : 'text-muted-foreground'}`}>
     {runningServers} running
   </div>
   <div className="text-sm text-muted-foreground">
     {totalServers - runningServers} stopped
   </div>
   ```

2. **Agents Card (lines ~96-98 in Agents section):**
   ```tsx
   <div className={`text-sm ${onlineAgents > 0 ? 'text-success' : 'text-muted-foreground'}`}>
     {onlineAgents} online
   </div>
   <div className="text-sm text-muted-foreground">
     {offlineAgents} offline
   </div>
   ```

**Logic:**
- If count > 0 → green (text-success)
- If count = 0 → gray (text-muted-foreground)

**Files Modified:**
- `frontend/src/pages/Dashboard.tsx` (2 sections)

---

### Phase 2: Build & Deploy (5 min) - `pending`

**Steps:**
1. Build frontend: `cd frontend && npm run build`
2. Deploy backend: `cd manager && npx wrangler deploy`
3. Verify deployment URL: https://zedops.mail-bcf.workers.dev
4. Test with agent offline (maestroserver already down)
5. Test with agent online (restart maestroserver)

**Expected Results:**
- Agent offline: "0 running" gray, "2 stopped" gray, "0 online" gray, "1 offline" gray
- Agent online: "2 running" green, "0 stopped" gray, "1 online" green, "0 offline" gray

---

## Errors Encountered

None yet.

---

## Notes

- This is a pure visual enhancement (no logic changes)
- Minimal code change (2 lines modified)
- No TypeScript interface changes needed
- No backend changes needed
- Consistent with badge color patterns used elsewhere
