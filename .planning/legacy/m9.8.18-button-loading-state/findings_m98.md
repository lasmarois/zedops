# Findings: M9.8.18 - Button Loading State Propagation

**Investigation started:** 2026-01-13

---

## Problem Statement

When clicking action buttons (Delete, Purge, etc.), ALL similar buttons show the loading animation instead of just the clicked button.

**Example:**
- Click "Delete" on Server A
- ALL "Delete" buttons show darker shade + loading state
- Only Server A is actually deleted
- Other buttons return to normal

---

## Hypothesis

React state management issue - likely one of:
1. Shared boolean state for all buttons (`isDeleting` instead of `deletingId`)
2. React Query mutation `isLoading` applying globally
3. Missing item ID tracking in loading state

---

## Component Investigation

### Components to Check
- [ ] ContainerList.tsx
- [ ] ServerList.tsx
- [ ] AgentList.tsx
- [ ] ServerDetail.tsx
- [ ] AgentDetail.tsx

---

## Discoveries

### Root Cause Confirmed

React Query mutation `isPending` is a **global state** that applies to ALL instances of the mutation, not per-item.

**Example from ServerList.tsx (line 295-298):**
```tsx
<Button
  disabled={purgeServerMutation.isPending}  // ❌ Global - affects ALL buttons
>
  {purgeServerMutation.isPending ? 'Purging...' : 'Purge'}
</Button>
```

When ANY server's Purge button is clicked:
1. `purgeServerMutation.mutate()` is called
2. `purgeServerMutation.isPending` becomes `true`
3. ALL Purge buttons check `isPending` → all show "Purging..." and disabled state
4. Only the clicked server is actually purged
5. When complete, `isPending` becomes `false` → all buttons return to normal

### Affected Components

#### 1. ServerList.tsx (1 occurrence)
- **Line 295-298**: Purge button (multiple deleted servers)
- **Impact**: Clicking Purge on one server disables ALL Purge buttons

#### 2. AgentServerList.tsx (9 occurrences)
- **Line 699**: Cleanup Failed Servers button
- **Line 734**: Sync button
- **Line 876**: Start button (missing servers section)
- **Line 926**: Rebuild dropdown item
- **Line 944**: Delete dropdown item
- **Line 1048**: Start button (orphaned servers section)
- **Line 1061**: Restore button
- **Line 1077**: Purge dropdown item
- **Lines 1117, 1124**: Purge dialog buttons
- **Impact**: Clicking any action on one server affects ALL similar buttons

#### 3. ServerDetail.tsx (NOT affected)
- Has mutation isPending checks BUT only renders ONE server
- No propagation bug since there's only one set of buttons

### Solution Pattern

React Query provides `variables` field that contains the parameters of the current mutation:

```tsx
// ✅ Correct - scope to specific server
<Button
  disabled={purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id}
>
  {purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id
    ? 'Purging...'
    : 'Purge'}
</Button>
```

This checks:
1. Is ANY purge operation running? (`isPending`)
2. Is it for THIS specific server? (`variables?.serverId === server.id`)
3. Only disable/show loading if BOTH conditions are true

---

## Extended Investigation (Post-User Testing)

### Additional Occurrences Found

After initial fix, user reported:
> "when I click stop, all the buttons (stop, restart) of the other servers become grayed out"

#### 3. AgentServerList.tsx - Container Operations (3 additional)
- **Line 839**: Start button - `isOperationPending()` (global)
- **Line 851**: Stop button - `isOperationPending()` (global)
- **Line 860**: Restart button - `isOperationPending()` (global)
- **Lines 521-527**: `isOperationPending()` helper function

**Root cause:** Used helper function that checked ALL container mutations:
```tsx
const isOperationPending = (): boolean => {
  return (
    startMutation.isPending ||
    stopMutation.isPending ||
    restartMutation.isPending
  );
};
```

**Fix:** Removed helper, used per-container checks:
```tsx
disabled={stopMutation.isPending && stopMutation.variables?.containerId === container.id}
```

#### 4. UserList.tsx (1 occurrence)
- **Line 300**: Delete user button
- **Pattern**: Multiple users in table, each with Delete button
- **Variables**: `userId` (direct string, not object)
- **Fix**: `disabled={deleteUserMutation.isPending && deleteUserMutation.variables === user.id}`

**Note:** deleteUser mutation takes userId directly as parameter, so `variables` IS the userId string.

#### 5. RoleAssignmentsManager.tsx (1 occurrence)
- **Line 338**: Revoke role button
- **Pattern**: Multiple role assignments in table, each with Revoke button
- **Variables**: `{ assignmentId: string; userId: string }`
- **Fix**: `disabled={revokeMutation.isPending && revokeMutation.variables?.assignmentId === assignment.id}`

---

## Complete Summary

**Total occurrences fixed: 13**
1. ServerList.tsx: 1 (Purge)
2. AgentServerList.tsx: 10 (Start x2, Stop, Restart, Delete, Rebuild, Restore, Purge x3)
3. UserList.tsx: 1 (Delete user)
4. RoleAssignmentsManager.tsx: 1 (Revoke role)

**Pattern variations:**
- Server operations: `variables?.serverId === server.id`
- Container operations: `variables?.containerId === container.id`
- User operations: `variables === user.id` (direct parameter)
- Role operations: `variables?.assignmentId === assignment.id`
