# M9.8.24: Restore UI for Soft-Deleted Servers

**Status:** ✅ COMPLETE (with known limitation)
**Date:** 2026-01-14
**Dependencies:** M9.8.7 (Deleted Servers Section)

---

## Summary

Added Restore button to the UI for soft-deleted servers, allowing admins to bring back accidentally deleted servers within the 24-hour retention window.

### What Was Implemented

**Phase 1: Investigation**
- Backend restore endpoint already exists (POST `/api/agents/:id/servers/:serverId/restore`)
- `useRestoreServer` hook already exists
- `restoreServer` API function already exists
- Only missing piece: UI button

**Phase 2: UI Implementation**
- Added Restore button to ServerList.tsx
- Green success variant with RefreshCw icon
- Placed before Purge button in "Deleted Servers" section
- Confirmation dialog explains container needs manual start
- Per-item loading state using mutation variables

**Phase 3: Bugfix - data_exists Flag**
- Initial version: restored servers showed "Missing" but no Start button
- Root cause: Restore didn't set `data_exists=1`
- Fix: Updated restore endpoint to set `data_exists=1`
- Result: Start button now appears after restore

---

## Files Modified

**Frontend:**
- `frontend/src/pages/ServerList.tsx` - Added Restore button and handler
- `manager/src/index.ts` - Updated asset hash to `index-Bd40UWGf.js`

**Backend:**
- `manager/src/routes/agents.ts` (line 1883) - Added `data_exists=1` to restore UPDATE

---

## Deployments

**Deployment 1 (UI):**
- Version ID: f6ed5d50-67cf-487e-92a6-bdca625f03a8
- Assets: index-Bd40UWGf.js (970.82 KiB)

**Deployment 2 (Bugfix):**
- Version ID: cb885cf7-2224-4635-91c5-91a34bffb294
- Fix: Added data_exists=1 to restore endpoint

---

## How to Use

1. Navigate to Servers page
2. Soft-delete a server (Delete button)
3. Expand "Deleted Servers" section
4. Click **Restore** button (green, circular arrow icon)
5. Confirm dialog
6. Server appears with status='Missing'
7. Click **Start** button to recreate container
8. Server becomes 'Running'

---

## Known Limitation (Discovered During Testing)

**Issue:** Restore sets `data_exists=1` blindly without checking filesystem

**Root Cause:** Sync feature uses hardcoded path `/var/lib/zedops/servers` instead of:
- Agent's `server_data_path` configuration
- Per-server `server_data_path` overrides (M9.8.23)

**Impact:**
- Restore assumes data exists (usually correct for soft delete)
- Sync doesn't work correctly for custom data paths
- Start button appears even if data was manually deleted

**Solution:** M9.8.25 will fix sync to use correct paths and make restore verify data existence

See: `M9.8.25-NEXT-sync-custom-paths.md`

---

## Test Results

**Tested Scenarios:**
- ✅ Restore button appears in deleted servers section
- ✅ Restore button confirmation dialog
- ✅ Server restored with status='missing'
- ✅ Start button appears after restore
- ⚠️ Data existence not verified (known limitation)

**User Feedback:**
- "ok it works!" (initial restore functionality)
- Identified data verification limitation (led to M9.8.25)

---

## Related Work

**Previous:**
- M9.8.7: Added "Deleted Servers" collapsible section
- M9.8.21: Agent configuration storage
- M9.8.23: Per-server data path override

**Next:**
- M9.8.25: Fix sync to use per-server paths & make restore verify data

---

## Technical Notes

**Restore Workflow:**
1. DELETE → status='deleted', container removed, data preserved
2. RESTORE → status='missing', data_exists=1, no container
3. START → container recreated from stored config, status='running'

**Start Button Condition:**
```typescript
server.status === 'missing' && server.data_exists
```

This is why setting `data_exists=1` was necessary (quick fix), but M9.8.25 will make it accurate by checking the filesystem.
