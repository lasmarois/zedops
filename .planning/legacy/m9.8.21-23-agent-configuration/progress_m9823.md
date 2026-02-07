# Progress Log: M9.8.23 - Per-Server Path Override

**Goal:** Allow per-server data path override when creating a new server
**Started:** 2026-01-14
**Current Phase:** Phase 2 - Backend Implementation

---

## Session 1: 2026-01-14 (Backend Foundation)

### Phase 1: Database Schema ✅ COMPLETE

**Actions Taken:**
1. Created migration file: `manager/migrations/0010_add_server_data_path.sql`
   - Adds `server_data_path TEXT DEFAULT NULL` column to servers table
   - NULL = inherit from agent (backward compatible)
   - Non-NULL = custom path override

2. Applied migration to remote D1 database:
   ```bash
   npx wrangler d1 execute zedops-db --remote --file=./migrations/0010_add_server_data_path.sql
   ```
   - ✅ Success: "1 queries executed, 1 rows written"

**Result:** Database schema ready for per-server path storage

---

### Phase 2: Backend API Updates ⏳ IN PROGRESS

**Completed:**

1. **Path Validation Logic** (`manager/src/routes/agents.ts`, lines 893-910)
   - Validates `body.server_data_path` if provided
   - Checks: absolute path, not root, not system directories
   - Same validation rules as agent configuration (M9.8.21)

2. **Data Path Determination** (line ~1015)
   ```typescript
   const dataPath = body.server_data_path || agent.server_data_path;
   ```
   - Uses custom override if provided
   - Falls back to agent's default

3. **Updated INSERT Query** (lines 1024-1041)
   - Added `server_data_path` column to INSERT statement
   - Stores `body.server_data_path || null` (NULL = inherit)

4. **Updated Agent Message** (lines 1053-1069)
   - Passes determined `dataPath` to agent
   - Agent will create container with correct path

**Completed:**
- [x] Update TypeScript CreateServerRequest interface
  - Added `server_data_path?: string;` field (line 33)
  - Type definitions now consistent with backend logic

**Result:** Backend Phase 2 COMPLETE ✅

---

---

### Phase 3: Frontend Implementation ✅ COMPLETE

**Completed:**

1. **Updated Frontend Types** (`frontend/src/lib/api.ts`, line 376)
   - Added `server_data_path?: string;` to CreateServerRequest interface

2. **Updated ServerForm Component** (`frontend/src/components/ServerForm.tsx`)
   - Imported useQuery and fetchAgentConfig (lines 6-9)
   - Added state for customDataPath and dataPathError (lines 59-60)
   - Added useQuery to fetch agent config for placeholder (lines 63-67)
   - Added validateDataPath function (lines 86-114)
   - Updated handleSubmit to validate data path (lines 123-125)
   - Added server_data_path to request if provided (lines 159-161)
   - Added form field for Server Data Path (lines 328-351)
     - Shows agent's default path as placeholder
     - Validation on change
     - Error display
     - Helper text

**Features:**
- Real-time validation (absolute path, not root, not system dirs)
- Fetches agent config to show default path in placeholder
- Optional field - blank = use agent default
- Error highlighting with border-destructive
- Consistent UX with existing form fields

**Result:** Frontend Phase 3 COMPLETE ✅

---

---

### Phase 4: Build & Deployment ✅ COMPLETE

**Build:**
- ✅ Frontend built successfully (6.08s)
- ✅ Assets: `index-DtmVOGws.js` (970.36 KiB), `index-FB7Tt9UE.css` (46.83 KiB)
- ✅ Updated asset hashes in `manager/src/index.ts`

**Deployment:**
- ✅ Manager deployed to Cloudflare Workers (7.83 sec)
- ✅ Assets uploaded (310.18 KiB / gzip: 61.38 KiB)
- ✅ Version: `b4bd87de-9956-46b5-b85e-0d3b2e85a8e7`
- ✅ URL: https://zedops.mail-bcf.workers.dev

**Result:** M9.8.23 DEPLOYED ✅

---

---

## Session 2: 2026-01-14 (Bugfix - Purge Not Using Custom Path)

### Issue Reported by User
"Purge didn't remove the data" - after testing M9.8.23 with custom path.

### Investigation
Found **3 endpoints** using `agent.server_data_path` instead of checking `server.server_data_path`:
1. Start/recreate endpoint (line 1381)
2. Purge endpoint (line 1793)
3. Soft delete endpoint (line 1700)

**Root Cause:** All three always used agent's default path, ignoring server's custom path.

### Fix Applied

**File:** `manager/src/routes/agents.ts`

**Changes:**
1. **Start/recreate (line 1370):**
   ```typescript
   const dataPath = server.server_data_path || agent.server_data_path;
   ```

2. **Purge (lines 1764-1800):**
   - Updated query to include `server_data_path` column
   - Added dataPath determination logic
   - Passes correct path to agent

3. **Soft delete (lines 1648-1697):**
   - Updated query to include `server_data_path` column
   - Added dataPath determination logic
   - Passes correct path to agent

**Result:** All operations now respect per-server custom paths ✅

### Deployment

- ✅ Backend deployed (5.74 sec)
- ✅ Version: `eaa08662-2276-4b18-9cf5-2f7917033f75`
- ✅ URL: https://zedops.mail-bcf.workers.dev

---

## Next Steps

### Manual Testing:
1. ✅ Navigate to agent detail page
2. ✅ Click "Create Server"
3. ✅ Verify Server Data Path field shows agent's default as placeholder
4. ✅ Test server creation with custom path - WORKS!
5. ✅ Test purge with custom path - WORKS! Data removed correctly
6. ✅ Verify data removed from custom path (not agent default) - CONFIRMED
7. ✅ Verify start/recreate uses custom path correctly - FIXED

**User Confirmation:** "ok it works!" - All functionality verified ✅

---

## Summary

**M9.8.23 Complete:** ✅ Per-Server Path Override at Creation
- Feature implemented and deployed
- Bugfix for purge/delete/recreate applied
- User testing successful
- Production ready

**Versions Deployed:**
- Initial: `b4bd87de-9956-46b5-b85e-0d3b2e85a8e7`
- Bugfix: `eaa08662-2276-4b18-9cf5-2f7917033f75`

**Next Milestone:** M9.8.24 - Restore UI for Soft-Deleted Servers

---

## Files Modified

**Backend:**
- ✅ `manager/migrations/0010_add_server_data_path.sql` (NEW)
- ⏳ `manager/src/routes/agents.ts` (partial - need type definition)

**Frontend:**
- ⏳ `frontend/src/components/CreateServerModal.tsx` (pending)
- ⏳ `frontend/src/lib/api.ts` (pending)

---

## Errors Encountered

None so far - implementation proceeding smoothly.

---

## Notes

- Backend validation logic reuses patterns from M9.8.21 (agent configuration)
- NULL semantics ensure backward compatibility (existing servers inherit from agent)
- Migration applied successfully on first attempt
