# M9.8.19 - Recent Activity Color Coding & Audit Log Formatting

**Priority:** MEDIUM (UX Enhancement - Visual Clarity)

**Started:** 2026-01-13

---

## Problem

**User request:**
> "next m9.8 subm I would like to work on is the Recent Activity in the dashboard, all activity currently use the cyan color only regardless of the action, and I would like the Audit logs to have a similar format as the recent activity view on the dashboard as well."

### Issue 1: Recent Activity - Monochrome Colors
All activity items in the Dashboard's "Recent Activity" section use the **same cyan/info color**, regardless of action type. This makes it hard to visually distinguish between different types of activities (create, delete, start, stop, etc.).

**Current behavior:**
- Server created → Cyan icon
- Server deleted → Cyan icon
- Container started → Cyan icon
- Container stopped → Cyan icon
- User invited → Cyan icon

**Expected behavior:**
- **Green** for positive actions (create, start, success)
- **Red** for destructive actions (delete, stop, failure)
- **Yellow/Orange** for warnings or important changes
- **Blue/Cyan** for informational actions (view, update)

### Issue 2: Audit Log Formatting
The Audit Log page should have a **similar visual format** to the Recent Activity widget for consistency.

**Current state:**
- Dashboard Recent Activity: Clean, icon-based, color-coded (but all cyan)
- Audit Log page: Different format, needs harmonization

**Expected behavior:**
- Consistent styling between Dashboard and Audit Log page
- Both should use action-based color coding
- Similar layout and presentation

---

## Color Scheme Proposal

### Action Type → Color Mapping

| Action Type | Color | Icon | Example Actions |
|-------------|-------|------|-----------------|
| **Create/Success** | Green | `PlusCircle`, `CheckCircle` | Server created, Container started, User registered |
| **Delete/Stop** | Red | `Trash2`, `StopCircle`, `XCircle` | Server deleted, Container stopped, User removed |
| **Warning/Change** | Yellow/Orange | `AlertCircle`, `Edit` | Configuration updated, Server rebuilt, Role changed |
| **Info/View** | Cyan/Blue | `Info`, `Eye` | Server viewed, Status checked, Data fetched |

### Specific Action Examples

**Server Actions:**
- `server.create` → Green
- `server.delete` → Red
- `server.start` → Green
- `server.stop` → Orange
- `server.rebuild` → Orange
- `server.update` → Blue

**User/Auth Actions:**
- `user.register` → Green
- `user.login` → Blue
- `user.invite` → Blue
- `user.delete` → Red
- `role.assign` → Orange

**Container Actions:**
- `container.start` → Green
- `container.stop` → Orange
- `container.restart` → Orange
- `container.remove` → Red

---

## Investigation Plan

### Phase 1: Locate Recent Activity Component
- Find Dashboard Recent Activity widget
- Understand data structure and action types
- Identify where colors are currently applied

### Phase 2: Audit Log Component
- Find Audit Log page component
- Compare layout with Recent Activity
- Identify differences and harmonization needs

### Phase 3: Color Mapping Implementation
- Create action → color mapping function
- Apply to Recent Activity component
- Apply to Audit Log component

### Phase 4: Test & Deploy
- Verify color coding is clear and consistent
- Test with various action types
- Deploy and validate in production

---

## Files to Investigate

- `frontend/src/pages/Dashboard.tsx` - Recent Activity widget
- `frontend/src/components/AuditLogViewer.tsx` - Audit log component
- `frontend/src/lib/api.ts` - Audit log type definitions

---

## Success Criteria

- [ ] Recent Activity uses color-coded icons based on action type
- [ ] Green for positive actions (create, start)
- [ ] Red for destructive actions (delete, stop)
- [ ] Yellow/Orange for warnings/changes
- [ ] Blue/Cyan for informational actions
- [ ] Audit Log page has consistent format with Recent Activity
- [ ] Both components share common styling/color scheme
- [ ] Changes deployed and tested

---

## Notes

- Focus on readability and quick visual scanning
- Maintain Shadcn UI color palette consistency
- Ensure sufficient contrast for accessibility
- Consider adding subtle animation or transitions for better UX
