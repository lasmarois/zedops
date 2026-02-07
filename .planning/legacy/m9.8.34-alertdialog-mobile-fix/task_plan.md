# M9.8.34 - Replace Native confirm() with AlertDialog

## Goal
Replace native `confirm()` dialogs with shadcn/ui AlertDialog components to fix mobile browser compatibility issues.

## Problem
Native `confirm()` dialogs are blocked or don't work properly on mobile browsers, preventing users from performing delete operations on mobile devices.

## Phases

### Phase 1: Create Reusable ConfirmDialog Component
**Status**: `complete`

**Tasks**:
- [x] Check if AlertDialog is already installed in shadcn/ui
- [x] Create `ConfirmDialog` component wrapper for common confirmation patterns
- [x] Support customizable title, description, confirm/cancel buttons
- [x] Support destructive variant (red confirm button)

**Files**:
- `frontend/src/components/ui/confirm-dialog.tsx` (NEW)

---

### Phase 2: Update AgentServerList.tsx
**Status**: `complete`

**Tasks**:
- [x] Replace `confirm()` in `handleDeleteServer()` with ConfirmDialog
- [x] Replace `confirm()` in `handleRebuildServer()` with ConfirmDialog
- [x] Add state for dialog open/close
- [x] Add state for pending delete/rebuild server info

**Files**:
- `frontend/src/components/AgentServerList.tsx`

---

### Phase 3: Update ServerDetail.tsx
**Status**: `complete`

**Tasks**:
- [x] Replace `confirm()` in `handleDelete()` with ConfirmDialog
- [x] Replace `confirm()` in `handleRebuild()` with ConfirmDialog
- [x] Add state for dialog open/close

**Files**:
- `frontend/src/pages/ServerDetail.tsx`

---

### Phase 4: Audit Other confirm() Usages
**Status**: `in_progress`

**Remaining confirm() calls**:
- [ ] `ServerDetail.tsx:169` - Apply config changes
- [ ] `ServerList.tsx:102,110,128` - Delete with data options
- [ ] `UserList.tsx:76` - Delete user
- [ ] `RoleAssignmentsManager.tsx:102` - Revoke role
- [ ] `AgentServerList.tsx:343` - Cleanup failed servers

---

### Phase 5: Test on Mobile
**Status**: `pending`

**Tasks**:
- [ ] Build and deploy
- [ ] Test delete on mobile browser
- [ ] Verify dialog appears and functions correctly

---

## Success Criteria
- [ ] Delete buttons work on mobile browsers
- [ ] Delete buttons work on desktop browsers
- [ ] Dialogs match app design
- [ ] No native `confirm()` calls remain

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
