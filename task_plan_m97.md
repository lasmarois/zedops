# M9.7 Implementation Plan - Fix UI/UX Inconsistencies

**Milestone:** M9.7 - Implement M9.6 Findings
**Duration:** 4-6 hours estimated
**Started:** Not started (awaiting user approval)
**Status:** 📋 Planning

---

## Overview

Based on M9.6 investigation findings, this milestone implements fixes for UI/UX inconsistencies discovered after M9.5. Focuses on critical navigation issues, component naming, and polish.

---

## Implementation Phases

### Phase 0: CRITICAL - Fix RCON Password Bug ⏳ Ready to Implement

**Goal:** Fix RCON connectivity on ServerDetail page
**Priority:** CRITICAL
**Effort:** 5 minutes

#### Task 0.1: Fix RCON Password Field Name
- [ ] Open `frontend/src/pages/ServerDetail.tsx`
- [ ] Find line 56: `const rconPassword = config.SERVER_RCON_PASSWORD || ''`
- [ ] Replace with: `const rconPassword = config.RCON_PASSWORD || config.ADMIN_PASSWORD || ''`
- [ ] Save file

**Code Change:**
```tsx
// Before (line 56) - BROKEN
const rconPassword = config.SERVER_RCON_PASSWORD || ''

// After (line 56) - FIXED
const rconPassword = config.RCON_PASSWORD || config.ADMIN_PASSWORD || ''
```

**Why This is Critical:**
- RCON currently doesn't work from ServerDetail page
- Looking for non-existent field `SERVER_RCON_PASSWORD`
- Server config actually stores `RCON_PASSWORD` and `ADMIN_PASSWORD`
- ContainerList uses correct field names and RCON works there

**Testing Checklist:**
- [ ] Navigate to ServerDetail page (`/servers/:id`)
- [ ] Click RCON tab
- [ ] Verify connection succeeds (green "Connected" badge)
- [ ] Type `help` command and press Enter
- [ ] Verify command response appears
- [ ] Test a few RCON commands (players, save, etc.)

---

### Phase 1: Critical Navigation Fix ⏳ Ready to Implement

**Goal:** Make agent server list navigable to ServerDetail page
**Priority:** HIGH
**Effort:** 1-2 hours

#### Task 1.1: Add Navigation to Server Table Rows
- [ ] Open `frontend/src/components/ContainerList.tsx`
- [ ] Import `useNavigate` from `react-router-dom` (add to existing imports)
- [ ] Create navigate instance: `const navigate = useNavigate()`
- [ ] Find server TableRow (line ~812)
- [ ] Add onClick handler: `onClick={() => navigate(`/servers/${server.id}`)}`
- [ ] Add hover styling: `className="cursor-pointer hover:bg-muted/50"`
- [ ] Test: Click server row → should navigate to ServerDetail

**Code Change:**
```tsx
// Before (line 812)
<TableRow key={server.id}>

// After
<TableRow
  key={server.id}
  className="cursor-pointer hover:bg-muted/50 transition-colors"
  onClick={() => navigate(`/servers/${server.id}`)}
>
```

**Import Change:**
```tsx
// Add to existing imports (line ~1-5)
import { useNavigate } from 'react-router-dom';

// Add inside component function (after hooks)
const navigate = useNavigate();
```

**Testing Checklist:**
- [ ] Navigate to `/agents/:id`
- [ ] Click on a server row in the table
- [ ] Should navigate to `/servers/:id` (ServerDetail page)
- [ ] Hover state shows visual feedback
- [ ] Action buttons still work (don't interfere with row click)

---

### Phase 2: Component Refactoring ⏳ Ready to Implement

**Goal:** Rename ContainerList to AgentServerList
**Priority:** MEDIUM
**Effort:** 2-3 hours

#### Task 2.1: Rename Component File
- [ ] Rename `frontend/src/components/ContainerList.tsx` → `AgentServerList.tsx`
- [ ] Update component name in file: `export function AgentServerList`
- [ ] Update interface name: `AgentServerListProps`
- [ ] Update component documentation comment

#### Task 2.2: Update Imports in AgentDetail
- [ ] Open `frontend/src/pages/AgentDetail.tsx`
- [ ] Update import (line 10): `import { AgentServerList } from "@/components/AgentServerList"`
- [ ] Update usage (line 214): `<AgentServerList ... />`
- [ ] Update usage (line 227): `<AgentServerList ... />`

#### Task 2.3: Update Component Props Documentation
- [ ] Review prop names in AgentServerListProps
- [ ] Consider renaming `onViewLogs` (no longer used)
- [ ] Update JSDoc comments to reflect purpose

**Files to Modify:**
- `frontend/src/components/ContainerList.tsx` → Rename
- `frontend/src/components/AgentServerList.tsx` (new name)
- `frontend/src/pages/AgentDetail.tsx` - Update imports (3 places)

**Testing Checklist:**
- [ ] Agent detail page loads without errors
- [ ] Server list displays correctly
- [ ] All functionality still works
- [ ] No TypeScript errors
- [ ] Build succeeds

---

### Phase 3: Polish & Consistency ⏳ Ready to Implement

**Goal:** Standardize UI elements across views
**Priority:** LOW
**Effort:** 30 min

**Note:** Removed RCON port display task - RCON port is internal-only and doesn't need to be shown in UI.

#### Task 3.1: Standardize Action Button Order
- [ ] Review button order across all views
- [ ] Establish standard order:
  1. Start/Stop (primary action)
  2. Restart (if running)
  3. Rebuild
  4. Delete (always last)

**Apply to:**
- [ ] AgentServerList.tsx (server table actions)
- [ ] ServerDetail.tsx (header buttons)

#### Task 3.2: Unify Button Styling
- [ ] Decide on button size: `sm` for tables, `default` for headers
- [ ] Standardize button variants:
  - Start: `variant="success"` or `variant="default"`
  - Stop: `variant="warning"` or `variant="outline"`
  - Restart: `variant="outline"`
  - Rebuild: `variant="outline"`
  - Delete: `variant="destructive"`

**Testing Checklist:**
- [ ] Button order matches everywhere
- [ ] Button colors are consistent
- [ ] Visual hierarchy clear
- [ ] Action flow is intuitive

---

### Phase 4: Optional Enhancements 📋 User Decision Required

**Goal:** Additional improvements based on user preferences
**Priority:** OPTIONAL
**Effort:** TBD

#### Optional 4.1: Add Search/Filter to Agent View
- [ ] Add search input to AgentServerList
- [ ] Add status filter dropdown
- [ ] Match functionality from global ServerList

**Effort:** +2-3 hours

#### Optional 4.2: Hide/Remove Container Section
- [ ] Discuss with user: Keep, hide, or remove?
- [ ] If hide: Add "Show Raw Containers" toggle
- [ ] If remove: Delete container section code

**Effort:** +1-2 hours

#### Optional 4.3: Unify Visual Design
- [ ] If user prefers: convert table to cards
- [ ] OR: convert cards to table
- [ ] OR: implement view toggle (list/grid)

**Effort:** +3-5 hours

---

## Success Criteria

M9.7 Complete When:
- [ ] RCON password bug fixed (Phase 0)
- [ ] RCON works from ServerDetail page
- [ ] Agent server list rows are clickable (Phase 1)
- [ ] Clicking row navigates to ServerDetail page
- [ ] Component renamed to AgentServerList (Phase 2)
- [ ] All imports updated correctly
- [ ] Button order consistent (Phase 3)
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] Deployed to production
- [ ] User approval ✓

---

## Files to Modify

### Phase 0 (CRITICAL - RCON Fix)
- `frontend/src/pages/ServerDetail.tsx` - Fix RCON password field name (line 56)

### Phase 1 (Critical - Navigation)
- `frontend/src/components/ContainerList.tsx` - Add navigation

### Phase 2 (Refactoring)
- `frontend/src/components/ContainerList.tsx` → Rename to `AgentServerList.tsx`
- `frontend/src/pages/AgentDetail.tsx` - Update imports

### Phase 3 (Polish)
- `frontend/src/components/AgentServerList.tsx` - Port display, button order
- `frontend/src/pages/ServerDetail.tsx` - Button consistency (optional)

---

## Risk Assessment

### Low Risk
- Phase 1: Adding onClick to table rows (non-breaking)
- Phase 3: UI polish (visual only)

### Medium Risk
- Phase 2: File rename (requires careful import updates)
- Must update all references or build will fail

### Mitigation
- Test after each phase
- Use TypeScript to catch missing imports
- Run build before deploying
- Test navigation flows manually

---

## Testing Strategy

### Manual Testing
1. **Navigation Test:**
   - Visit AgentDetail page
   - Click server row
   - Verify navigation to ServerDetail
   - Verify action buttons still work

2. **Rename Test:**
   - Verify no import errors
   - Check all pages load
   - Run build
   - Check for TypeScript errors

3. **Visual Test:**
   - Compare ports across views
   - Check button order
   - Verify consistent styling

### Automated Testing
- TypeScript compilation: `npm run type-check`
- Build: `npm run build`
- No runtime errors in console

---

## Rollback Plan

If issues occur:
1. **Phase 1 Issues:** Remove onClick from TableRow
2. **Phase 2 Issues:** Revert file rename via git
3. **Phase 3 Issues:** Revert individual changes

Git workflow:
```bash
# Before starting
git checkout -b fix/m97-ui-consistency

# After each phase
git add .
git commit -m "M9.7 Phase X: Description"

# If rollback needed
git reset --hard HEAD~1
```

---

## Timeline Estimate

| Phase | Tasks | Estimated |
|-------|-------|-----------|
| Phase 0: RCON Fix | Fix password field name | 5 min |
| Phase 1: Navigation Fix | Add onClick to rows | 1-2 hours |
| Phase 2: Rename Component | File rename + imports | 2-3 hours |
| Phase 3: Polish | Button order/styling | 30 min |
| Testing & Deployment | Full validation | 30 min |
| **Total** | 4 phases + testing | **4-6 hours** |

**Optional Enhancements:** +3-10 hours (if user requests)

---

## Open Questions for User

Before starting M9.7:

1. **Priority Confirmation:**
   - Proceed with all 3 phases?
   - Or just Phase 1 (critical fix)?

2. **Visual Design:**
   - Keep Card + Table hybrid? ✅ Recommended
   - Unify on one style? (more work)

3. **Container Section:**
   - Keep as-is?
   - Hide behind toggle?
   - Remove entirely?

4. **Optional Enhancements:**
   - Add search/filter to agent view?
   - Any other requests from M9.6 findings?

---

## Notes

- All changes are backward compatible
- No breaking API changes
- Frontend-only modifications
- Can be deployed independently
- User decisions needed for optional enhancements

---

## Dependencies

**Required Before Starting:**
- M9.6 investigation complete ✅
- User approval on findings ⏳
- Decision on optional enhancements ⏳

**No External Dependencies:**
- No new packages needed
- No backend changes required
- No database migrations

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| *(none yet - not started)* | - | - |
