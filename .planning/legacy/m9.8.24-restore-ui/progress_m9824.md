# Progress Log: M9.8.24 - Restore UI for Soft-Deleted Servers

**Goal:** Add UI to view and restore soft-deleted servers
**Started:** 2026-01-14
**Current Phase:** Phase 1 - Investigation

---

## Session 1: 2026-01-14 (Investigation & Implementation)

### Phase 1: Investigation ✅ COMPLETE

**Findings:**

1. **ServerList.tsx**:
   - ✅ Already has "Deleted Servers" collapsible section (M9.8.7)
   - ✅ Shows deleted servers with Purge button
   - ❌ No Restore button yet

2. **useRestoreServer hook**:
   - ✅ Already exists in `hooks/useServers.ts`
   - ✅ Follows same pattern as usePurgeServer
   - ✅ Invalidates queries on success

3. **restoreServer API function**:
   - ✅ Already exists in `lib/api.ts`
   - ✅ Calls POST `/api/agents/:id/servers/:serverId/restore`

4. **Backend restore endpoint**:
   - ✅ Already implemented
   - ✅ Changes status: 'deleted' → 'missing'
   - ✅ Sets deleted_at = NULL
   - ✅ Requires admin role
   - ✅ Returns message: "Server restored successfully. Use START to recreate container."

**Conclusion:** Everything exists except the UI button! Just need to add Restore button.

---

### Phase 2: Backend Verification ✅ COMPLETE

Backend endpoint behavior confirmed:
- Changes status from 'deleted' to 'missing'
- Clears deleted_at timestamp
- Does NOT recreate container (user must click Start)
- Requires admin role
- Logs audit event: 'server.restored'

---

### Phase 3: API Hook Implementation ✅ COMPLETE

Hook already exists, no changes needed!

---

### Phase 4: UI Implementation ✅ COMPLETE

**Tasks:**
1. ✅ Import useRestoreServer to ServerList.tsx
2. ✅ Add restoreServerMutation
3. ✅ Create handleRestore function with confirmation dialog
4. ✅ Add Restore button next to Purge button
5. ✅ Add loading state (per-item using mutation variables)

**Implementation Details:**
- Button: Green success variant with RefreshCw icon
- Placement: Before Purge button in deleted servers section
- Confirmation: Clear message explaining container needs manual start
- Loading: Per-item state using `restoreServerMutation.variables?.serverId === server.id`

---

### Phase 5: Deployment ✅ COMPLETE

**Deployment:**
- Built frontend: `npm run build` (6.02s)
- Generated: `assets/index-Bd40UWGf.js` (970.82 KiB)
- Updated asset hash in manager/src/index.ts
- Deployed to Cloudflare Workers: `npx wrangler deploy`
- Version ID: f6ed5d50-67cf-487e-92a6-bdca625f03a8
- URL: https://zedops.mail-bcf.workers.dev

**Status:** M9.8.24 COMPLETE ✅

---

## Session 2: 2026-01-14 (Bugfix - data_exists Flag)

### Issue Found During User Testing

**Problem:**
- User tested restore: ✅ Restore button appeared
- User clicked Restore: ✅ Server restored with status='missing'
- Expected: Start button should appear
- Actual: Only Rebuild button appeared (no Start button)

**Root Cause:**
- Start button condition (AgentServerList.tsx:1038): `server.status === 'missing' && server.data_exists`
- Restore endpoint only updated: `status = 'missing'`, `deleted_at = NULL`
- **Missing**: `data_exists` field not updated
- Result: Server had status='missing' but data_exists=0, hiding Start button

**Fix Applied:**
- Updated restore endpoint (agents.ts:1883)
- Added `data_exists = 1` to UPDATE statement
- Reasoning: Soft delete preserves data, so data exists after restore
- New SQL: `UPDATE servers SET status = 'missing', deleted_at = NULL, data_exists = 1, updated_at = ? WHERE id = ?`

**Deployment:**
- Deployed fix: `npx wrangler deploy`
- Version ID: cb885cf7-2224-4635-91c5-91a34bffb294
- Date: 2026-01-14

**Testing Instructions:**
1. Delete a server (soft delete)
2. Click Restore button
3. Verify server appears with status='Missing'
4. **Verify Start button now appears** (green button)
5. Click Start to recreate container

---

## Session 3: 2026-01-14 (User Testing - Discovered Limitation)

### Issue Discovered During Testing

**User Feedback:**
- "Are we making sure the data exists for real somehow?"
- Sync button clicked but Start button didn't appear before fix
- `data_exists=1` is being set blindly without filesystem check

**Investigation Results:**

**✅ Sync DOES check filesystem:**
- Agent has `server.checkdata` handler (agent/server.go:402-418)
- Checks if `bin/` or `data/` directories exist
- Manager calls this during sync (AgentConnection.ts:1959-1965)

**❌ BUT Sync has critical bug:**
```typescript
// AgentConnection.ts:1959-1965
const dataCheckResponse = await this.sendMessageWithReply({
  subject: 'server.checkdata',
  data: {
    servers: serverNames,
    dataPath: '/var/lib/zedops/servers',  // HARDCODED! ❌
  },
}, 10000);
```

**Problems:**
1. Sync uses hardcoded path `/var/lib/zedops/servers`
2. Ignores agent's `server_data_path` configuration
3. Ignores per-server `server_data_path` overrides (M9.8.23)
4. Restore sets `data_exists=1` blindly without checking filesystem

**Impact:**
- Servers with custom data paths: sync checks wrong location
- Restore: assumes data exists without verification
- Start button appears even when data might not exist at custom path

**Solution: New Submilestone Required**
See M9.8.25 task document for:
- Fix sync to use per-server data paths (Option A)
- Make restore verify data exists before setting flag (Option C)
