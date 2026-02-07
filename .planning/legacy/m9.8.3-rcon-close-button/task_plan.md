# M9.8.3 Task Plan - Fix RCON Window Close Button

**Milestone:** M9.8.3 - Fix RCON Window X Button Not Closing
**Parent:** M9.8 - Polish & Production Readiness
**Priority:** MEDIUM (UX Issue - User can't close window)
**Estimated Duration:** 20 minutes
**Started:** 2026-01-13

---

## Goal

Fix the RCON terminal window so that clicking the X button properly closes the window.

---

## Success Criteria

- [x] Plan created
- [x] RCON window identified (RconTerminal.tsx)
- [x] X button close handler found
- [x] Issue root cause identified
- [ ] Close handler fixed in ServerDetail.tsx
- [ ] Build succeeds
- [ ] Deployed to production
- [ ] User validates X button closes window

---

## Root Cause Identified ✅

**Location:** `frontend/src/pages/ServerDetail.tsx` line 349

**Problem:**
```tsx
<RconTerminal
  agentId={agentId}
  serverId={serverId}
  serverName={serverName}
  containerID={containerID}
  rconPort={rconPort}
  rconPassword={rconPassword}
  onClose={() => {}} // Not used in tab context ← EMPTY FUNCTION!
/>
```

**Issue:** The `onClose` prop is an empty function that does nothing when X button is clicked.

**Correct Pattern (from AgentServerList.tsx line 1060):**
```tsx
<RconTerminal
  agentId={agentId}
  serverId={rconServer.id}
  serverName={rconServer.name}
  containerID={rconServer.container_id || ''}
  rconPort={rconServer.rcon_port}
  rconPassword={rconPassword}
  onClose={() => setRconServer(null)}  ← PROPER HANDLER
/>
```

**Why It Fails:**
1. RconTerminal is always rendered as fixed full-screen overlay (line 469)
2. User clicks X button → calls `onClose()`
3. `onClose` is empty function `() => {}` → does nothing
4. No state change → component stays mounted → window stays open

---

## Implementation Phases

### Phase 1: Investigation ✅ COMPLETE (10 min)

**Completed:**
- ✅ Found RconTerminal component (frontend/src/components/RconTerminal.tsx)
- ✅ Found X button with onClick={onClose} (line 484)
- ✅ Found usage in ServerDetail.tsx with empty onClose (line 349)
- ✅ Found correct usage pattern in AgentServerList.tsx (line 1060)
- ✅ Documented root cause

---

### Phase 2: Fix Close Handler (5 min) - `in_progress`

**Solution:** Add state to conditionally render RconTerminal in ServerDetail

**Changes Needed:**

1. **Add state** (near line 28):
   ```tsx
   const [showRcon, setShowRcon] = useState(false)
   ```

2. **Update RCON tab to show button instead of always-on terminal** (line 330):
   ```tsx
   <TabsContent value="rcon" className="space-y-6">
     <Card>
       <CardContent className="py-12 text-center">
         {agentId && containerID ? (
           <Button onClick={() => setShowRcon(true)}>
             Open RCON Terminal
           </Button>
         ) : (
           <p className="text-muted-foreground">
             Server must be running to use RCON
           </p>
         )}
       </CardContent>
     </Card>
   </TabsContent>
   ```

3. **Add conditional RconTerminal outside tabs** (after tabs, near line 360):
   ```tsx
   {showRcon && agentId && containerID && (
     <RconTerminal
       agentId={agentId}
       serverId={serverId}
       serverName={serverName}
       containerID={containerID}
       rconPort={rconPort}
       rconPassword={rconPassword}
       onClose={() => setShowRcon(false)}
     />
   )}
   ```

**Files to Modify:**
- `frontend/src/pages/ServerDetail.tsx`

---

### Phase 3: Build & Deploy (5 min) - `pending`

**Steps:**
1. Build frontend: `cd frontend && npm run build`
2. Deploy backend: `cd manager && npx wrangler deploy`
3. Verify deployment URL: https://zedops.mail-bcf.workers.dev
4. Test RCON window X button

**Expected Results:**
- Click "Open RCON Terminal" button in RCON tab
- RCON window opens as full-screen overlay
- Click X button → RCON window closes
- Window state properly cleared

---

## Errors Encountered

None yet.

---

## Notes

- This is M9.8.3 (third sub-milestone of M9.8 polish phase)
- AgentServerList has the correct pattern (conditional rendering + proper onClose)
- ServerDetail needs to match this pattern
- Simple state management fix
