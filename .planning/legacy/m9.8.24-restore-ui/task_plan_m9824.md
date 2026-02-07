# Task Plan: M9.8.24 - Restore UI for Soft-Deleted Servers

**Goal:** Add UI to view and restore soft-deleted servers

**Priority:** MEDIUM (UX Enhancement)
**Started:** 2026-01-14
**References:** Server Lifecycle Management, M9.8.7 (Purge UI)

---

## User Requirements

1. **Show deleted servers** in UI (currently hidden)
2. **Restore button** to bring back soft-deleted servers
3. **Clear UX** - users understand what "deleted" means
4. **Time indicators** - show when deleted, when auto-purge
5. **Confirmation dialogs** for restore action

---

## Current State Analysis

### What Already Exists

**Backend:**
- ✅ POST `/api/agents/:id/servers/:serverId/restore` endpoint
- ✅ Soft delete system (deleted_at timestamp, status='deleted')
- ✅ 24-hour retention window

**Frontend:**
- ✅ M9.8.7 added "Deleted Servers" section in ServerList.tsx
- ✅ Shows deleted servers in collapsible section
- ✅ Purge button functional
- ❓ Restore button - need to check if exists

### Investigation Needed

1. Does ServerList show deleted servers? (M9.8.7 added this)
2. Does useRestoreServer hook exist?
3. Where else do we need to show deleted servers? (AgentServerList?)
4. What happens when restore is clicked? (status changes, container recreation?)

---

## Implementation Plan

### Phase 1: Investigation ⏳ PENDING

**Goal:** Understand current state and what needs to be added

**Tasks:**
1. Check ServerList.tsx - does it show deleted servers?
2. Check if useRestoreServer hook exists in useServers.ts
3. Check if Restore button already exists anywhere
4. Check backend restore endpoint behavior
5. Check AgentServerList.tsx - does it show deleted servers?

**Outcome:** Clear understanding of what's missing

---

### Phase 2: Backend Verification ⏳ PENDING

**Goal:** Verify restore endpoint works correctly

**Tasks:**
1. Read restore endpoint code
2. Understand what it does:
   - Changes status from 'deleted' to 'missing'?
   - Sets deleted_at to NULL?
   - Does it recreate container?
3. Verify permissions required

**Outcome:** Understand restore behavior

---

### Phase 3: API Hook Implementation ⏳ PENDING

**Goal:** Create/update useRestoreServer hook

**Tasks:**
1. Check if useRestoreServer already exists
2. If not, create it in useServers.ts
3. Follow pattern from useDeleteServer/usePurgeServer
4. Handle success/error states
5. Invalidate queries on success

**Outcome:** Hook ready for UI integration

---

### Phase 4: UI Implementation ⏳ PENDING

**Goal:** Add Restore button to deleted servers sections

**Tasks:**

**ServerList.tsx:**
1. Add Restore button next to Purge button
2. Add confirmation dialog
3. Wire up useRestoreServer hook
4. Show loading state
5. Handle success (remove from deleted section)

**AgentServerList.tsx (if needed):**
1. Check if it has deleted servers section
2. Add if missing (follow ServerList pattern)
3. Add Restore button
4. Wire up hook

**Visual Design:**
- Restore button: Green/success variant
- Confirmation: "Restore this server? Container will need to be started manually."
- Show loading state during restore

**Outcome:** Restore functionality available in UI

---

### Phase 5: Testing & Polish ⏳ PENDING

**Goal:** Verify restore workflow works end-to-end

**Tasks:**
1. Delete a server (soft delete)
2. Verify it appears in "Deleted Servers" section
3. Click Restore button
4. Verify confirmation dialog appears
5. Confirm restore
6. Verify server moves to active servers (status='missing')
7. Verify can start server after restore
8. Test error cases (agent offline, server not found)

**Outcome:** Working restore feature

---

## Design Decisions

### UX Approach
Following M9.8.7 pattern:
- Separate "Deleted Servers" collapsible section
- Muted styling for deleted servers
- Time indicators (deleted X ago)
- Restore + Purge buttons side by side

### Restore Behavior
Based on backend investigation:
- Status changes from 'deleted' to 'missing'
- Container not automatically recreated
- User must click "Start" after restore to recreate container
- Data preserved (unless purged)

### Confirmation Dialog
```
Title: Restore Server?
Message: This will restore [server-name] from deleted status.
         The container will need to be started manually.
Buttons: [Cancel] [Restore]
```

---

## Files to Modify

### Backend (Read Only)
- `manager/src/routes/agents.ts` - Verify restore endpoint

### Frontend
1. **hooks/useServers.ts** - Add/verify useRestoreServer hook
2. **pages/ServerList.tsx** - Add Restore button (if not exists)
3. **components/AgentServerList.tsx** - Add deleted section + Restore (if needed)

---

## Success Criteria

- [ ] Investigation complete - know what exists
- [ ] useRestoreServer hook functional
- [ ] Restore button visible in ServerList
- [ ] Restore button visible in AgentServerList (if applicable)
- [ ] Confirmation dialog works
- [ ] Restore changes server status correctly
- [ ] Server can be started after restore
- [ ] User testing successful

---

**Status:** 📋 READY TO START
**Estimated Time:** 1-2 hours
**Complexity:** MEDIUM (mostly UI work, backend exists)
