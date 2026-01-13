# M9.8.7 Fixes - Purge Issues

**Issues Reported:**
1. Server page doesn't refresh after purging (still shows server until manual page refresh)
2. Files still exist on host after purging with "remove data" option

---

## Issue 1: UI Not Refreshing ✅ FIXED

**Expected:** After purge, deleted server disappears from list
**Actual:** Server still shows until manual page reload

**Root Cause:**
- usePurgeServer hook only invalidated `['servers', agentId]` and `['containers', agentId]`
- ServerList page uses `useAllServers()` with query key `['servers', 'all']`
- This query key was not being invalidated!

**Fix Applied:**
- Added `queryClient.invalidateQueries({ queryKey: ['servers', 'all'] })` to usePurgeServer onSuccess (line 272-274 in useServers.ts)
- Now invalidates all 3 query keys: agent-specific servers, global servers, agent containers

**Status:** ✅ Fixed and deployed (version: 33c76a5f-309c-411d-ae75-4bd3951ba000)
**User Tested:** ✅ Confirmed working

---

## Issue 2: Data Not Removed - INVESTIGATING

**Expected:** When user clicks OK (remove data), server data deleted from host
**Actual:** Files still exist in /var/lib/zedops/servers after purge

**Status:** User confirmed data still exists after purge attempt

**Questions for User:**
1. When you clicked Purge, what did you click in the dialogs?
   - First dialog: Did you click **OK** (delete data) or **Cancel** (keep data)?
   - Second dialog: Did you click **OK** to confirm?

2. Are you logged in as an **admin user**? (purge requires admin privileges)
   - Check your user role in the UI or database

3. What do you see in the **agent logs** during purge?
   - Look for lines like: "Deleting server container: ... (removeVolumes: true)"
   - Look for: "Removing volume directories: /var/lib/zedops/servers/..."
   - Any error messages?

4. What's the exact server name and path?
   - Server name: ?
   - Path where files exist: /var/lib/zedops/servers/[what?]

**Code Investigation:**
✅ Backend purge endpoint passes `removeVolumes` flag correctly (agents.ts line 1615)
✅ Durable Object forwards `removeVolumes` to agent (AgentConnection.ts line 1698)
✅ Agent handler receives and parses `removeVolumes` (main.go line 720)
✅ Agent DeleteServer function implements data removal (server.go lines 202-211)

**Next Steps Based on Investigation:**
- If not admin: Need to add better error message in UI
- If logs show permission error: Need to fix file permissions
- If logs show error: Need to fix the specific error
- If removeData=false was sent: Confirmation dialog might be confusing, need to improve UX
