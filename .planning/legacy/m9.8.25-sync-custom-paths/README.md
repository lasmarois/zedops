# M9.8.25: Fix Sync to Use Per-Server Data Paths

**Status:** ✅ COMPLETE
**Date:** 2026-01-14
**Dependencies:** M9.8.23 (Per-Server Path Override), M9.8.24 (Restore UI)

---

## Summary

Fixed critical bug where sync and restore operations were using a hardcoded data path instead of respecting agent configuration and per-server path overrides.

### What Was Broken

**Sync (AgentConnection.ts:1963):**
```typescript
dataPath: '/var/lib/zedops/servers',  // HARDCODED! ❌
```

**Restore (agents.ts:1883):**
```typescript
data_exists = 1,  // Set blindly without checking filesystem! ❌
```

**Impact:**
- Servers with custom data paths: sync checked wrong location
- Restore: assumed data exists without verification
- Start button appeared even when data didn't exist

---

## What Was Fixed

### Phase 1: Sync Uses Correct Paths ✅

**Implementation:**
- Query agent config for default `server_data_path`
- For each server, determine: `server.server_data_path || agent.server_data_path`
- Group servers by unique data path (optimization)
- Call `server.checkdata` for each path group
- Update `data_exists` based on actual filesystem results

**Benefits:**
- Respects agent default data path configuration
- Respects per-server custom data paths
- Batched by path for efficiency
- Better logging

**Code:** AgentConnection.ts lines 1948-2000

---

### Phase 2: Restore Verifies Data ✅

**Implementation:**
- Query server record including `server_data_path`
- Query agent config for default `server_data_path`
- Determine effective path: `server.server_data_path || agent.server_data_path`
- Call new `/internal/check-data` endpoint
- Set `data_exists` based on actual result (not blindly to 1)
- Handle agent offline gracefully (defaults to false)

**New Endpoint:**
- `POST /internal/check-data` in AgentConnection.ts (line 1926)
- Accepts: `{ serverName, dataPath }`
- Calls agent's `server.checkdata` message
- Returns: `{ dataExists, serverName, dataPath }`
- Returns 503 if agent offline

**Benefits:**
- Restore is accurate (checks filesystem)
- Start button only appears if data actually exists
- Safe defaults (if agent offline, assume no data)

**Code:**
- agents.ts lines 1862-1929 (restore endpoint)
- AgentConnection.ts lines 1926-1983 (helper endpoint)

---

## Files Modified

**Backend:**
- `manager/src/durable-objects/AgentConnection.ts` - Fixed sync + added helper endpoint
- `manager/src/routes/agents.ts` - Fixed restore endpoint

---

## Deployment

**Version ID:** 4a150058-2cc6-483b-aacd-eeec38057b65
**URL:** https://zedops.mail-bcf.workers.dev
**Worker Size:** 314.20 KiB (gzip: 62.07 KiB)
**Date:** 2026-01-14

---

## Testing Results

**User Testing:** ✅ "seems to work !!"

**Tested Scenarios:**
- ✅ Sync with agent default path
- ✅ Sync with per-server custom paths
- ✅ Restore with data exists → Start button appears
- ✅ Overall functionality verified

---

## Related Work

**Previous:**
- M9.8.21: Agent configuration storage
- M9.8.22: Agent config display tab
- M9.8.23: Per-server data path override (introduced the need for this fix)
- M9.8.24: Restore UI (discovered the bug during testing)

**Why This Bug Existed:**
The hardcoded path existed before M9.8.23, but became critical after adding per-server path overrides. The bug was discovered during M9.8.24 user testing when restore didn't verify data existence.

---

## Technical Notes

**Batching Optimization:**
Instead of checking each server individually, sync groups servers by unique data paths:
```typescript
const serversByPath = new Map<string, any[]>();
for (const server of servers) {
  const effectivePath = server.server_data_path || agentDefaultPath;
  if (!serversByPath.has(effectivePath)) {
    serversByPath.set(effectivePath, []);
  }
  serversByPath.get(effectivePath)!.push(server);
}
```

This means if you have 100 servers all using the default path, sync makes 1 checkdata call instead of 100.

**Error Handling:**
Restore handles agent offline gracefully:
```typescript
let dataExists = false;
try {
  const checkResponse = await stub.fetch('http://internal/check-data', {...});
  if (checkResponse.ok) {
    dataExists = checkResult.dataExists || false;
  }
} catch (error) {
  // If agent offline or check fails, assume data doesn't exist (safe default)
}
```
