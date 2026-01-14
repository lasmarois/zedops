# Task Plan: M9.8.17 - Fix RCON Connection for New Servers

**Goal:** Fix RCON connection refused error for newly created servers

**Status:** IN PROGRESS

**Priority:** MEDIUM (Bug Fix)

**Started:** 2026-01-13 19:50

---

## Problem

User reports RCON connection failure for new servers created from manager:
```
[RCON] Connection failed: RCON connection failed to 172.20.0.8:27029:
rcon: dial tcp 172.20.0.8:27029: connect: connection refused
```

**Observations:**
- WebSocket connects successfully
- Error shows correct IP (172.20.0.8) and port (27029)
- Connection is refused (port not listening)
- Happens specifically on "new servers created from the manager"

---

## Root Cause Analysis

**Hypothesis:**
1. Server container starts immediately (status = "running")
2. RCON terminal auto-opens when server is created
3. Game server inside container takes time to initialize
4. RCON port (27029) not listening yet when connection attempted
5. Project Zomboid servers need 30-60 seconds to fully start

**Similar to:**
- Database connection pooling (wait for DB to be ready)
- Health checks (container running ≠ service ready)

---

## Proposed Solutions

### Option 1: Retry Logic with Backoff ⭐ RECOMMENDED
Add automatic retry in RCON terminal when connection fails:
- Retry 3-5 times with exponential backoff
- Show "Server starting, retrying..." message
- User can manually retry if auto-retry exhausted

**Pros:**
- ✅ Handles timing issue automatically
- ✅ User-friendly (no manual intervention needed)
- ✅ Works for all scenarios (new servers, restarts)

**Cons:**
- ⚠️ Adds complexity to connection logic

### Option 2: Delay RCON Auto-Connect
Wait N seconds before auto-connecting RCON on new servers:
- Add delay only for newly created servers
- Show "Waiting for server to start..." message

**Pros:**
- ✅ Simple implementation
- ✅ Prevents initial connection failure

**Cons:**
- ⚠️ Fixed delay might be too short or too long
- ⚠️ Doesn't handle server restarts
- ⚠️ Poor UX (user waits with no feedback)

### Option 3: Don't Auto-Connect RCON
Remove auto-connect, require manual connection:
- Show "Connect" button when server created
- User clicks when ready

**Pros:**
- ✅ Simple, no timing issues

**Cons:**
- ⚠️ Extra step for user
- ⚠️ Breaks current UX flow

---

## Recommendation

**Option 1: Retry Logic with Backoff**

Implementation:
1. Detect connection refused error
2. Automatically retry 5 times with delays: 2s, 4s, 8s, 16s, 30s
3. Show connection state: "Connecting... (attempt 1/5)"
4. If all retries fail, show "Manual Retry" button
5. Total wait time: ~60 seconds (reasonable for PZ server startup)

---

## Implementation Tasks

### Phase 1: Investigation
- [ ] Find RCON connection logic in useRconTerminal hook
- [ ] Identify connection error handling
- [ ] Check if retry logic already exists
- [ ] Understand server creation flow (when RCON terminal opens)

### Phase 2: Implement Retry Logic
- [ ] Add retry state to useRconTerminal hook
- [ ] Implement exponential backoff (2s, 4s, 8s, 16s, 30s)
- [ ] Update connection status messages
- [ ] Show retry attempt counter
- [ ] Add manual retry button when exhausted

### Phase 3: UI Updates
- [ ] Update connection status badge
- [ ] Show "Connecting... (attempt X/5)" message
- [ ] Add "Server starting, retrying..." info
- [ ] Improve error message clarity

### Phase 4: Testing & Deployment
- [ ] Test with newly created server
- [ ] Test with server restart
- [ ] Test connection failure after retries
- [ ] Build and deploy
- [ ] User testing

---

## Files to Investigate

- `frontend/src/hooks/useRconTerminal.ts` (or similar)
- `frontend/src/components/RconTerminal.tsx`
- RCON WebSocket connection logic

---

## Success Criteria

- [ ] New servers connect to RCON automatically (with retry)
- [ ] User sees clear status during connection attempts
- [ ] Manual retry available if auto-retry fails
- [ ] No connection refused errors visible to user (retries handle it)
- [ ] Works for server creation and restarts

---

## Notes

Project Zomboid servers typically take 30-60 seconds to fully start and listen on RCON port. Retry logic is a standard pattern for this scenario.

Following planning-with-files pattern:
- Planning files in ROOT directory
- Will archive to planning-history/m9.8.17-fix-rcon-new-servers/ after completion
