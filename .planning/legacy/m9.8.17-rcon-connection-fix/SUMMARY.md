# M9.8.17 - RCON Connection Fix - SUMMARY

**Date:** 2026-01-13
**Status:** FIXED (Needs user testing)
**Priority:** CRITICAL (Bug in steam-zomboid-dev v2+)

---

## Problem

RCON connection refused for newly created servers from ZedOps manager, but worked fine for existing servers.

**Error:**
```
[RCON] Connection failed: RCON connection failed to 172.20.0.8:27029:
rcon: dial tcp 172.20.0.8:27029: connect: connection refused
```

---

## Root Cause

**Bug in `/Volumes/Data/docker_composes/steam-zomboid-dev/entry.sh`:**

- Line 133 used `exec` which terminated the script immediately after first-run initialization
- For NEW servers: INI created with defaults, RCON config in else block was SKIPPED
- For EXISTING servers: else block ran, RCON configured correctly

**Affects:** All v2+ versions of steam-zomboid-dev container

---

## Solution

### Part 1: Restructure entry.sh (Fixed)

**Changed first-run initialization:**
1. Start server in background (not with exec)
2. Wait for INI file creation (max 60s)
3. Kill the initialization process
4. Move ALL configuration outside if/else block

**Key change at line 150:**
```bash
# Before (didn't work):
kill $SERVER_PID 2>/dev/null || true

# After (works):
pkill -TERM -f "ProjectZomboid64.*-servername ${SERVER_NAME}" || true
```

**Why:** `kill $SERVER_PID` only killed shell wrapper, not actual Java process. `pkill` kills the actual ProjectZomboid64 process.

### Part 2: Retry logic in ZedOps (Added, but not root fix)

Added exponential backoff retry logic to `frontend/src/hooks/useRcon.ts`:
- 5 retry attempts: 2s, 4s, 8s, 16s, 30s
- Shows "Connecting... (attempt X/5)" in UI
- Manual retry button if all attempts fail
- Also fixed useEffect dependency issue (same as M9.8.16)

---

## Files Modified

### steam-zomboid-dev
- `entry.sh` - Fixed first-run initialization and RCON configuration

### ZedOps
- `frontend/src/hooks/useRcon.ts` - Added retry logic, fixed dependencies
- `frontend/src/components/RconTerminal.tsx` - Added retry UI

---

## Testing Results

**Test 1 - Initial fix:**
- ❌ Used `kill $SERVER_PID` - only killed shell wrapper
- Orphaned ProjectZomboid64 process remained running
- RCON config not applied

**Test 2 - pkill fix:**
- ✅ Used `pkill -TERM -f "ProjectZomboid64.*"` - kills actual Java process
- Bash syntax validated
- Cleanup completed successfully

**Note:** Full user testing still needed with actual server creation in ZedOps.

---

## Next Steps

1. ⏳ User testing with new server creation
2. ⏳ Release new container version (v2.2.0?)
3. ⏳ Update ZedOps to use new container version

---

## Related Issues

- **M9.8.16** - Fixed log stream duplicate subscription (same useEffect dependency fix pattern)
- **M9.8.18** - Button loading state propagation bug (documented, not started)

---

## Key Learnings

1. **Process management:** Shell PID ≠ child process PID. Use `pkill` with process name pattern.
2. **User feedback is critical:** Initial approach (retry logic) was wrong. User challenged it, led to finding real bug.
3. **Container initialization patterns:** Game servers often rewrite config files, need to handle timing carefully.
4. **React hooks:** useEffect dependencies should only include primitives, not memoized callbacks.

---

## Impact

- **Critical:** All v2+ steam-zomboid-dev containers affected
- **Workaround:** Manually restart container after creation (RCON config applies on restart)
- **Fix required:** Must release new container version ASAP
