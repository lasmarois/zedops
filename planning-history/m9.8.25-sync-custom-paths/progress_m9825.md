# Progress Log: M9.8.25 - Fix Sync Custom Paths

**Goal:** Fix sync and restore to use correct per-server data paths
**Started:** 2026-01-14
**Current Phase:** Phase 1 - Fix Sync

---

## Session 1: 2026-01-14 (Implementation)

### Phase 1: Fix Sync to Use Per-Server Paths ✅ COMPLETE

**Implementation:**
- Read syncServers() function (AgentConnection.ts:1922)
- Found hardcoded path at line 1963
- Fixed by:
  1. Query agent config for default `server_data_path`
  2. Group servers by effective path: `server.server_data_path || agent.server_data_path`
  3. Batch call `server.checkdata` for each unique path (optimized)
  4. Map results back to servers

**Code Changes:**
- Added agent config query (lines 1948-1956)
- Group servers by path (lines 1967-1978)
- Loop through unique paths and check data (lines 1980-2000)
- Maintains existing dataByName map pattern

**Benefits:**
- Respects agent default data path configuration
- Respects per-server custom data paths (M9.8.23)
- Batched by path for efficiency
- Better logging (shows which path being checked)

---

### Phase 2: Make Restore Verify Data Exists ✅ COMPLETE

**Implementation:**
- Modified restore endpoint (agents.ts:1862)
- Now queries server record including `server_data_path`
- Queries agent config for default `server_data_path`
- Determines effective path: `server.server_data_path || agent.server_data_path`
- Calls new `/internal/check-data` endpoint to verify filesystem
- Sets `data_exists` based on actual result (not blindly to 1)
- Handles agent offline gracefully (defaults to false)

**New Endpoint Added:**
- `POST /internal/check-data` in AgentConnection.ts (line 1926)
- Accepts: `{ serverName, dataPath }`
- Calls agent's `server.checkdata` message
- Returns: `{ dataExists, serverName, dataPath }`
- Returns 503 if agent offline

**Benefits:**
- Restore is now accurate (checks filesystem)
- Start button only appears if data actually exists
- Safe defaults (if agent offline, assume no data)
- Better logging (shows path checked and result)

---

### Phase 3: Deployment & Testing ✅ COMPLETE

**Deployment:**
- Fixed duplicate variable declaration (dataByName)
- Deployed to Cloudflare Workers: `npx wrangler deploy`
- Version ID: 4a150058-2cc6-483b-aacd-eeec38057b65
- URL: https://zedops.mail-bcf.workers.dev
- Worker size: 314.20 KiB (gzip: 62.07 KiB)

**What Was Fixed:**
1. **Sync now uses correct paths:**
   - Queries agent config for default path
   - Uses per-server custom paths
   - Batches requests by unique paths (efficient)

2. **Restore now verifies data:**
   - Checks filesystem before setting data_exists
   - Uses correct path (server custom || agent default)
   - Handles agent offline gracefully

**Testing Required:**
- [ ] Sync with agent default path
- [ ] Sync with per-server custom paths
- [ ] Restore with data exists
- [ ] Restore with data missing
- [ ] Agent offline scenario

**Status:** M9.8.25 DEPLOYED - Ready for user testing
