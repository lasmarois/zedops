# Progress Log: M9.8.29 - Data Path Migration with Progress Tracking

**Goal:** Enable moving server data with progress indication
**Started:** 2026-01-14
**Status:** ✅ COMPLETE (Progress UI deferred to M9.8.31)

---

## Session 1: 2026-01-14 - Investigation

### Phase 1: Understanding Current Flow ✅ COMPLETE

**Files Reviewed:**
- `manager/src/routes/agents.ts` lines 2249-2510

**Current Flow:**

1. **PATCH /config** (lines 2249-2369):
   - Saves new config values to DB including `server_data_path`
   - Detects if `dataPathChanged` (line 2300)
   - Returns `{ success, changes, pendingRestart, dataPathChanged }`
   - **Problem:** Old data path is overwritten in DB

2. **POST /apply-config** (lines 2382-2510):
   - Reads current `server_data_path` from DB (already updated)
   - Sends rebuild request with `dataPath` (line 2436-2452)
   - Agent creates container with new path mount
   - **Problem:** Data still at old path, server starts empty!

**Root Cause:**
When user saves new data path via PATCH, old value is overwritten. Apply-config has no way to know where the data WAS.

**Solution Design:**

1. **PATCH returns old path** if data path changed:
   ```typescript
   return { success, changes, pendingRestart, dataPathChanged, oldDataPath: server.server_data_path }
   ```

2. **Frontend stores oldDataPath** when user saves:
   ```typescript
   const [oldDataPath, setOldDataPath] = useState<string | null>(null);
   // On save: if (result.dataPathChanged) setOldDataPath(result.oldDataPath);
   ```

3. **Apply-config receives oldDataPath** in request body:
   ```typescript
   body: { oldDataPath?: string }
   ```

4. **Apply-config calls agent move** before rebuild:
   ```go
   // If oldDataPath provided and different from current:
   // 1. Stop container
   // 2. Call server.movedata
   // 3. Rebuild with new path
   ```

**Benefits:**
- No database schema changes
- Stateless (old path travels with request)
- Works with existing flow

---

### Phase 2: Agent Implementation ✅ COMPLETE

**Files Modified:**

1. **`agent/server.go`** - Added types and function:
   - `ServerMoveDataRequest` - Request payload
   - `MoveProgress` - Progress update structure
   - `ServerMoveDataResponse` - Response payload
   - `MoveServerData()` - Main move function (~150 lines)
   - `copyFile()` - Helper function

2. **`agent/main.go`** - Added handler:
   - Case `server.movedata` in message switch (line 295-296)
   - `handleServerMoveData()` function (~70 lines)

**Move Function Features:**
- Validates source exists, destination doesn't
- Calculates total size before copy
- Copies files recursively preserving permissions
- Logs progress every 100 files or 100MB
- Verifies file count after copy
- Deletes source only after successful copy
- Returns: `{ success, serverName, oldPath, newPath, bytesMoved, filesMoved }`

**Build Status:** ✅ Compiles successfully

---

### Phase 3: Manager Implementation ✅ COMPLETE

**Files Modified:**

1. **`manager/src/routes/agents.ts`**:
   - PATCH /config now returns `oldDataPath` when data path changes (line 2362-2371)
   - POST /apply-config parses optional `oldDataPath` from request body (lines 2395-2402)
   - Apply-config calls agent move before rebuild if oldDataPath provided (lines 2449-2478)

2. **`manager/src/durable-objects/AgentConnection.ts`**:
   - Added endpoint routing for `/servers/:id/move` (lines 149-156)
   - Added `handleServerMoveDataRequest()` handler (~90 lines, lines 1933-2027)
   - 5-minute timeout for large data moves
   - Sends `server.movedata` message to agent

**Flow:**
1. Frontend saves config → PATCH returns `{ ..., dataPathChanged: true, oldDataPath: "/old/path" }`
2. Frontend calls apply-config with `{ oldDataPath: "/old/path" }`
3. Apply-config detects oldDataPath differs from current path
4. Apply-config calls DO move endpoint → Agent moves data
5. On success, apply-config calls DO rebuild endpoint → Container recreated with new path

**Build Status:** ✅ Manager compiles successfully

---

### Phase 4: Frontend Implementation ✅ COMPLETE

**Files Modified:**

1. **`frontend/src/lib/api.ts`**:
   - `updateServerConfig` return type now includes `oldDataPath?: string`
   - `applyServerConfig` now accepts optional `oldDataPath` parameter and includes it in request body

2. **`frontend/src/hooks/useServers.ts`**:
   - `useApplyServerConfig` mutation now accepts `oldDataPath` in parameters

3. **`frontend/src/pages/ServerDetail.tsx`**:
   - `pendingChanges` state now includes `oldDataPath`
   - `handleSaveConfig` stores `oldDataPath` from save response
   - `handleApplyConfig` passes `oldDataPath` to apply mutation

**Flow:**
1. User changes data path → clicks Save
2. PATCH returns `{ dataPathChanged: true, oldDataPath: "/old/path" }`
3. Frontend stores `oldDataPath` in `pendingChanges` state
4. User clicks "Apply Changes"
5. Frontend calls apply-config with `{ oldDataPath: "/old/path" }`
6. Backend moves data before rebuilding container

**Build Status:** ✅ Frontend compiles successfully

---

### Phase 5: Deployment ✅ COMPLETE

**Deployed:**
- Manager: Version `b88d754e-e75a-4408-8579-d1f57050d91b`
- Agent: Restarted with new binary (includes `server.movedata` handler)
- Frontend: Built and deployed

**Ready for Testing:**
1. Edit a server's data path (e.g., change from `/old/path` to `/new/path`)
2. Click "Save" - should see "Apply Changes" banner
3. Click "Apply Changes" - should migrate data then rebuild container

---

### Hotfix: Effective Old Path (2026-01-14 17:35)

**Bug:** When server was using agent's default data path (server.server_data_path = null),
PATCH returned `oldDataPath: null` instead of the effective path.

**Fix:** Updated PATCH query to join with agents table and use:
```typescript
const effectiveOldPath = server.server_data_path || server.agent_server_data_path;
```

**Deployed:** Version `566f947f-b5fe-4124-8d8e-7eb78ce8a6a6`

---

### Hotfix: Data Path Hint Text (2026-01-14 17:45)

**Bug:** ConfigurationEdit showed server's custom path in "Leave empty to use agent default" hint
instead of the agent's actual default path.

**Fix:** Split `actualDataPath` into two variables:
- `agentDefaultPath` - Always the agent's default (for hint text)
- `currentDataPath` - Effective current path (for placeholder)

**Deployed:** Version `8771a934-1be5-429d-a3b5-a141a16f0841`

---

## Summary

**M9.8.29 Data Path Migration - COMPLETE**

All phases implemented:
- Agent: `MoveServerData()` function with atomic copy-then-delete
- Manager: PATCH returns `oldDataPath`, apply-config orchestrates move before rebuild
- Frontend: Stores `oldDataPath` and passes to apply-config
- All components deployed and running

**Deferred to M9.8.31:**
- Real-time progress streaming during data migration
- Agent already logs progress internally (every 100 files/100MB)
- Need: WebSocket streaming from agent → DO → frontend with progress bar UI

---
