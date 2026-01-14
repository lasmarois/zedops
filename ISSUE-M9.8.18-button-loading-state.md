# M9.8.18 - Fix Button Loading State Propagation

**Priority:** LOW (Visual bug, no functional impact)

**Started:** 2026-01-13

---

## Problem

When clicking action buttons (e.g., Purge, Delete for servers), ALL similar buttons show the loading animation (darker shade + loading state) instead of just the clicked button.

**User report:**
> "I noticed that the animation of some buttons, like the purge and delete button for servers when clicking on one of them, all of them show the loading animation with the pushed darker shade button color then only the one clicked is affected by the action, this is minor since it doesn't do anything unexpected on the other objects but should be investigated to catch all occurence of this bug in the whole frontend."

**Observed behavior:**
1. User clicks "Delete" on Server A
2. ALL "Delete" buttons show loading state (darker shade)
3. Only Server A is actually deleted
4. Other buttons return to normal state

**Expected behavior:**
- Only the clicked button should show loading state
- Other similar buttons should remain in normal state

---

## Root Cause Hypothesis

This is likely a React state management issue:

**Possible causes:**
1. **Shared loading state** - Single boolean `isDeleting` used for all buttons
   ```tsx
   const [isDeleting, setIsDeleting] = useState(false);

   // All buttons read the same state:
   <Button loading={isDeleting} onClick={handleDelete}>Delete</Button>
   ```

2. **Missing item ID in state** - Loading state doesn't track which specific item
   ```tsx
   const [isDeleting, setIsDeleting] = useState(false);
   // Should be:
   const [deletingId, setDeletingId] = useState<string | null>(null);
   ```

3. **Mutation hook not scoped to item** - React Query mutation used globally
   ```tsx
   const { mutate, isLoading } = useDeleteServer();
   // isLoading applies to ALL calls, not per-item
   ```

---

## Investigation Plan

### Phase 1: Find All Occurrences
Search for button loading states in:
- `frontend/src/components/ContainerList.tsx` - Server actions
- `frontend/src/components/AgentCard.tsx` - Agent actions
- Any other action buttons with loading states

### Phase 2: Identify Pattern
For each occurrence, check:
1. How is loading state managed? (useState, React Query, etc.)
2. Is state scoped per-item or global?
3. How is the button rendered? (in map/loop?)

### Phase 3: Fix Pattern
**Solution A: Track ID in state**
```tsx
const [deletingId, setDeletingId] = useState<string | null>(null);

const handleDelete = async (serverId: string) => {
  setDeletingId(serverId);
  try {
    await deleteServer(serverId);
  } finally {
    setDeletingId(null);
  }
};

// In button:
<Button
  loading={deletingId === server.id}
  onClick={() => handleDelete(server.id)}
>
  Delete
</Button>
```

**Solution B: Use React Query per-item state**
```tsx
const { mutate, isPending, variables } = useMutation({
  mutationFn: deleteServer,
});

// In button:
<Button
  loading={isPending && variables === server.id}
  onClick={() => mutate(server.id)}
>
  Delete
</Button>
```

### Phase 4: Test All Fixed Buttons
- Test each action button type
- Verify only clicked button shows loading
- Verify action still works correctly

---

## Files to Investigate

- `frontend/src/components/ContainerList.tsx`
- `frontend/src/components/AgentCard.tsx`
- `frontend/src/hooks/useServers.ts`
- `frontend/src/hooks/useAgents.ts`
- Any component with action buttons

---

## Success Criteria

- [ ] All button loading states scoped per-item
- [ ] Clicking one button doesn't affect others
- [ ] Loading animation shows only on clicked button
- [ ] Actions complete correctly
- [ ] No visual glitches or race conditions

---

## Notes

- This is a minor visual bug with no functional impact
- Good opportunity to establish consistent pattern for loading states
- Should check ALL action buttons in frontend, not just delete/purge
