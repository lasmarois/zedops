# Task Plan: M9.8.25 - Fix Sync to Use Per-Server Data Paths

**Goal:** Fix sync and restore to accurately check data existence using correct paths
**Priority:** HIGH (Bug Fix)
**Started:** 2026-01-14

---

## Problem Summary

**Current Issues:**
1. Sync uses hardcoded path `/var/lib/zedops/servers` (ignores agent & server configs)
2. Restore sets `data_exists=1` blindly without filesystem verification
3. Start button appears even when data doesn't exist at custom paths

**Impact:**
- Broken for servers with custom data paths (M9.8.23)
- Misleading UX (Start button shows when data missing)

---

## Implementation Phases

### Phase 1: Fix Sync to Use Per-Server Paths ⏳ PENDING

**Approach:** Batch servers by data path (optimized)

**Tasks:**
1. Read syncServers() function (AgentConnection.ts:1922)
2. Query agent config to get default `server_data_path`
3. Group servers by data path: `server.server_data_path || agent.server_data_path`
4. Call `server.checkdata` for each path group
5. Update `data_exists` based on actual filesystem results

**Files:**
- `manager/src/durable-objects/AgentConnection.ts`

---

### Phase 2: Make Restore Verify Data Exists ⏳ PENDING

**Approach:** Check filesystem before setting data_exists

**Tasks:**
1. Read restore endpoint (agents.ts:1852)
2. Query agent config to get default path
3. Determine server's data path
4. Call agent to check data existence
5. Set `data_exists` based on actual result (not blindly to 1)
6. Handle agent offline scenario

**Files:**
- `manager/src/routes/agents.ts`

---

### Phase 3: Testing & Deployment ⏳ PENDING

**Test Scenarios:**
1. Sync with agent default path
2. Sync with per-server custom paths
3. Restore with data exists
4. Restore with data missing
5. Agent offline handling

**Deployment:**
1. Deploy manager
2. Test in production
3. Verify Start button behavior

---

## Success Criteria

- [ ] Sync checks correct path for each server
- [ ] Restore verifies data existence
- [ ] Start button only appears when data exists
- [ ] Works with default paths
- [ ] Works with custom paths
- [ ] Agent offline handled gracefully
- [ ] No performance regression
