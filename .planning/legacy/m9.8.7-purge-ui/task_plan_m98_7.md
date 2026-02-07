# M9.8.7 Task Plan - Add Purge UI for Deleted Servers

**Milestone:** M9.8.7 - Add UI to Purge Soft-Deleted Servers
**Parent:** M9.8 - Polish & Production Readiness
**Priority:** HIGH (Missing Critical Functionality)
**Estimated Duration:** 45 minutes
**Started:** 2026-01-13

---

## Goal

Add UI to display soft-deleted servers and allow users to purge them (permanently delete with data removal).

---

## Success Criteria

- [x] Plan created
- [x] Investigate how deleted servers are stored (status field, deleted_at field)
- [x] Find where to display deleted servers in UI
- [x] Add "Deleted Servers" section to servers list
- [x] Add Purge button with confirmation dialog
- [x] Build succeeds
- [x] Deployed to production
- [ ] User can purge deleted server data (testing)

---

## Current State Analysis

**User Report:**
> "I created a server earlier and deleted it from the UI, now how can I purge its data? is there a way at the moment? something missing?"

**Current State:**
- Delete button performs soft delete (`removeVolumes: false`)
- Confirmation says "Server data will be preserved for 24 hours"
- `usePurgeServer` hook exists in useServers.ts
- Backend has `purgeServer(agentId, serverId, removeData)` API function
- **NO UI to view or purge deleted servers**

**Investigation Needed:**
1. How are deleted servers stored? (status field? deleted_at field?)
2. Does the API currently return deleted servers?
3. Where should we display deleted servers? (Dashboard? Servers list? Separate page?)
4. What should the purge confirmation say?

---

## Implementation Phases

### Phase 1: Investigation (15 min) - `complete`

**Goal:** Understand current deleted server implementation

**Findings:**
- ✅ API `/api/servers` already returns deleted servers (no filter)
- ✅ Deleted servers have: `status='deleted'` and `deleted_at` timestamp
- ✅ `usePurgeServer` hook exists: `purgeServer(agentId, serverId, removeData)`
- ✅ ServerList.tsx displays all servers (including deleted) without distinction
- ✅ Database schema: `deleted_at` field (nullable integer timestamp)

**Files Read:**
- `manager/src/routes/servers.ts` - API endpoint (lines 33-85)
- `manager/src/types/Server.ts` - Type definitions (deleted_at field)
- `frontend/src/pages/ServerList.tsx` - Main servers list page
- `frontend/src/hooks/useServers.ts` - Has usePurgeServer hook

**Current State:**
- Deleted servers are returned by API but shown mixed with active servers
- No visual distinction for deleted servers
- No Purge button in UI

---

### Phase 2: Add Deleted Servers UI (20 min) - `complete`

**Goal:** Display deleted servers in separate section with purge button

**Changes Made:**

**1. Added imports (lines 8-9):**
- usePurgeServer from @/hooks/useServers
- Trash2, ChevronDown, ChevronUp icons

**2. Added state and mutation hook (lines 33-34):**
- showDeletedServers state (collapsible section)
- purgeServerMutation hook

**3. Separated active and deleted servers (lines 52-53):**
```tsx
const activeServers = allServers.filter(server => server.status !== 'deleted')
const deletedServers = allServers.filter(server => server.status === 'deleted')
```

**4. Created handlePurge function (lines 64-87):**
- Two-step confirmation dialog
- First prompt: Choose to remove data (OK) or keep data (Cancel)
- Second prompt: Final confirmation with warning
- Calls purgeServerMutation with removeData flag

**5. Added "Deleted Servers" section (lines 238-308):**
- Collapsible section below active servers
- Shows count: "X servers pending purge (data preserved for 24h)"
- Muted styling (gray border, semi-transparent background)
- Purge button for each server with loading state
- Stops click propagation (doesn't navigate to detail)

**Files Modified:**
- `frontend/src/pages/ServerList.tsx`

---

### Phase 3: Build & Deploy (10 min) - `complete`

**Steps:**
1. ✅ Build frontend: `cd frontend && npm run build` - SUCCESS (5.99s)
2. ✅ Deploy backend: `cd manager && npx wrangler deploy` - SUCCESS
3. ✅ Verify deployment URL: https://zedops.mail-bcf.workers.dev
4. ⏳ Test purge functionality (user testing)

**Build Results:**
- Frontend: 931.21 KB → 250.60 KB gzipped (5.99s)
- Total Upload: 300.86 KiB / gzip: 59.99 KiB
- Worker Startup Time: 3 ms
- Version ID: 06c38364-b6bf-4656-9e9c-17b236980bf6

**Error Fixed:**
- TypeScript error: Changed StatusBadge variant from "default" to "muted" (line 266)

**Expected Results:**
- ✅ Deleted servers visible in collapsible "Deleted Servers" section
- ✅ Purge button with two-step confirmation dialog
- ✅ Option to remove data (OK) or keep data (Cancel)
- ✅ User can now purge the server they deleted earlier

---

## Errors Encountered

None yet.

---

## Notes

- This is M9.8.7 (seventh sub-milestone of M9.8 polish phase)
- User encountered missing functionality (high priority)
- Backend functionality exists, just need UI
- Related to server lifecycle management plan (wild-petting-toast.md Phase 6)
