# M9.8.18 - Button Loading State Propagation - COMPLETE

**Completed:** 2026-01-13
**Duration:** ~45 minutes (including additional fixes)
**Deployed:** Version 7c5738c7-54fd-4aa7-b71c-a8bace8f0da7

---

## Problem Summary

React Query mutation `isPending` is a **global state** that affects ALL buttons checking the same mutation. When one button was clicked, ALL similar buttons would show loading state and become disabled.

**User Reports:**
1. Initial: "Purge and delete button for servers - clicking on one of them, all of them show the loading animation"
2. Follow-up: "When I click stop, all the buttons (stop, restart) of the other servers become grayed out"

---

## Root Cause

React Query's `isPending` applies to the entire mutation, not per-item. Example:
```tsx
// ❌ WRONG - Global check
<Button disabled={purgeServerMutation.isPending}>
  {purgeServerMutation.isPending ? 'Purging...' : 'Purge'}
</Button>
```

When ANY purge operation runs, ALL purge buttons show loading.

---

## Solution Pattern

Use React Query's `variables` field to scope checks per-item:
```tsx
// ✅ CORRECT - Per-item check
<Button disabled={purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id}>
  {purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id ? 'Purging...' : 'Purge'}
</Button>
```

---

## All Fixes Applied

### 1. ServerList.tsx (1 fix)
**Line 295:** Purge button
```tsx
disabled={purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id}
```

### 2. AgentServerList.tsx (10 fixes)

**Server operation buttons:**
- Line 876: Start button (stopped servers)
- Line 926: Rebuild dropdown item
- Line 944: Delete dropdown item
- Line 1048: Start button (missing/recovery servers)
- Line 1061: Restore button
- Line 1077: Purge dropdown item
- Lines 1117, 1124: Purge dialog buttons (2 buttons)

**Container operation buttons:**
- Line 839: Start button
- Line 851: Stop button
- Line 860: Restart button

**Pattern:**
```tsx
// Server operations
disabled={mutation.isPending && mutation.variables?.serverId === server.id}

// Container operations
disabled={mutation.isPending && mutation.variables?.containerId === container.id}
```

**Removed:** `isOperationPending()` helper function (line 521)

### 3. UserList.tsx (1 fix)
**Line 300:** Delete user button
```tsx
disabled={deleteUserMutation.isPending && deleteUserMutation.variables === user.id}
```

**Note:** `deleteUser` mutation takes userId as direct parameter (not object), so `variables` IS the userId string.

### 4. RoleAssignmentsManager.tsx (1 fix)
**Line 338:** Revoke role button
```tsx
disabled={revokeMutation.isPending && revokeMutation.variables?.assignmentId === assignment.id}
```

---

## Total Impact

**13 buttons fixed** across 4 components:
- 1 server list button (ServerList)
- 10 server/container buttons (AgentServerList)
- 1 user management button (UserList)
- 1 role management button (RoleAssignmentsManager)

---

## Verification

### Tested Scenarios:
1. ✅ Click Purge on Server A → Only Server A's button shows loading
2. ✅ Click Stop on Container 1 → Only Container 1's buttons gray out
3. ✅ Click Delete on User A → Only User A's button shows loading
4. ✅ Click Revoke on Assignment 1 → Only that Revoke button shows loading

### Not Fixed (Not Needed):
- Cleanup button (AgentServerList line 699) - Single button per agent
- Sync button (AgentServerList line 734) - Single button per agent
- Invite user form (UserList line 215) - Single form, not multiple instances
- Grant role form (RoleAssignmentsManager line 299) - Single form

---

## Files Modified

1. `frontend/src/pages/ServerList.tsx`
2. `frontend/src/components/AgentServerList.tsx`
3. `frontend/src/components/UserList.tsx`
4. `frontend/src/components/RoleAssignmentsManager.tsx`
5. `manager/src/index.ts` (asset filename updates)

---

## Deployment History

1. **Initial deploy (server operations):**
   - Version: 0aa69cb7-856d-4c53-866a-f3e02bcfb100
   - Fixed: Server operations (purge, delete, rebuild, restore)

2. **Container operations fix:**
   - Version: 7c5738c7-54fd-4aa7-b71c-a8bace8f0da7
   - Fixed: Container operations (start, stop, restart)

3. **Final deploy (user/role management):**
   - Version: [pending]
   - Fixed: User delete, role revoke buttons

---

## Lessons Learned

1. **Always scope mutations to items** - Use `variables` field for per-item loading states
2. **Check ALL similar patterns** - One fix isn't enough, search comprehensively
3. **User testing catches edge cases** - Initial fix missed container operations
4. **Systematic search prevents regressions** - Found user/role buttons proactively

---

## Related Documentation

- React Query docs: https://tanstack.com/query/latest/docs/framework/react/guides/mutations
- Issue: ISSUE-M9.8.18-button-loading-state.md
- Planning: task_plan_m98.md, findings_m98.md, progress_m98.md
