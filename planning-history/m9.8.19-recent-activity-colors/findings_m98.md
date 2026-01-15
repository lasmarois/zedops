# Findings: M9.8.19 - Recent Activity Color Coding & Audit Log Formatting

**Investigation started:** 2026-01-13

---

## Problem Statement

**User request:**
> "Recent Activity in the dashboard, all activity currently use the cyan color only regardless of the action, and I would like the Audit logs to have a similar format as the recent activity view on the dashboard as well."

**Two issues:**
1. Recent Activity uses monochrome cyan color for all actions
2. Audit Log page has different format than Recent Activity widget

---

## Component Investigation

### Components to Find
- [ ] Dashboard Recent Activity widget
- [ ] Audit Log page component
- [ ] Audit log data type definitions

---

## Action Types in Use

Found in `manager/src/lib/audit.ts`:

**User Actions:**
- user.created ✅
- user.deleted ❌
- user.login ℹ️
- user.logout ℹ️
- user.role_changed ⚠️
- user.password_changed ⚠️

**Invitation Actions:**
- invitation.created ✅
- invitation.accepted ✅
- invitation.cancelled ⚠️

**Permission/Role Actions:**
- permission.granted ✅
- permission.revoked ❌
- role_assignment.granted ✅
- role_assignment.revoked ❌

**Server Actions:**
- server.created ✅
- server.started ✅
- server.stopped ⚠️
- server.restarted ⚠️
- server.deleted ❌
- server.purged ❌
- server.restored ✅
- server.rebuilt ⚠️

**Agent Actions:**
- agent.registered ✅
- agent.deleted ❌

**RCON Actions:**
- rcon.command ℹ️

**Legend:**
- ✅ Green (success/create/start)
- ❌ Red (delete/revoke/destructive)
- ⚠️ Orange (warning/change/stop)
- ℹ️ Blue (info/view/read)

---

## Color Scheme Proposal

| Action Category | Color | Variant | Actions |
|-----------------|-------|---------|---------|
| **Create/Success** | Green | `success` | created, started, granted, accepted, registered, restored |
| **Delete/Destructive** | Red | `error` | deleted, purged, revoked |
| **Warning/Change** | Orange | `warning` | stopped, restarted, rebuilt, changed, modified, cancelled |
| **Info/Read** | Cyan | `info` | login, logout, command, view |

---

## Discoveries

### Current Implementation (Dashboard.tsx lines 41-47)

**INCOMPLETE mapping - only 5 actions:**
```tsx
const actionColorMap: Record<string, "success" | "warning" | "error" | "info"> = {
  'server.start': 'success',     // ❌ Wrong - should be 'server.started'
  'server.stop': 'warning',      // ❌ Wrong - should be 'server.stopped'
  'server.delete': 'error',      // ❌ Wrong - should be 'server.deleted'
  'agent.connect': 'info',       // ❌ Doesn't exist in audit types
  'agent.disconnect': 'warning', // ❌ Doesn't exist in audit types
}
```

**Problem:** All unmapped actions fall back to 'info' (cyan) → everything looks cyan!

### ActivityTimeline Component (activity-timeline.tsx)

**Already supports 5 color variants:**
- success (green)
- warning (orange)
- error (red)
- info (cyan)
- muted (gray)

**Design:** Vertical colored bar with glow effect + colored badge - very nice!

### AuditLogViewer Component (AuditLogViewer.tsx lines 73-93)

**Uses keyword-based color logic:**
```tsx
const getActionVariant = (action: string) => {
  if (action.includes('delete') || action.includes('revoke')) return 'destructive';
  if (action.includes('create') || action.includes('grant')) return 'success';
  if (action.includes('update') || action.includes('modify')) return 'warning';
  return 'default';
}
```

**Uses Badge component** (not ActivityTimeline) - inconsistent with Dashboard!

---

## Solution Approach

### 1. Create Comprehensive Action Color Mapping
Extract to shared utility function in `lib/utils.ts` or `lib/audit-colors.ts`:
```tsx
export function getAuditActionColor(action: string): "success" | "warning" | "error" | "info" {
  // Keyword-based matching for flexibility
  if (action.includes('created') || action.includes('started') ||
      action.includes('granted') || action.includes('accepted') ||
      action.includes('registered') || action.includes('restored')) {
    return 'success';
  }

  if (action.includes('deleted') || action.includes('purged') ||
      action.includes('revoked')) {
    return 'error';
  }

  if (action.includes('stopped') || action.includes('restarted') ||
      action.includes('rebuilt') || action.includes('changed') ||
      action.includes('modified') || action.includes('cancelled')) {
    return 'warning';
  }

  // login, logout, command, etc.
  return 'info';
}
```

### 2. Update Dashboard to Use Utility
Replace hardcoded map with function call.

### 3. Update AuditLogViewer to Use Shared Utility
Replace local color mapping with shared utility for consistency.

---

## Final Implementation

### Shared Utility: `audit-colors.ts`

**Three exported functions:**

1. **`getAuditActionColor(action: string): AuditActionColor`**
   - Main color mapping function
   - Returns: `"success" | "warning" | "error" | "info" | "muted"`
   - Used by: Dashboard Recent Activity (ActivityTimeline component)

2. **`getAuditActionBadgeVariant(action: string)`**
   - Badge-specific variant mapper
   - Converts `"error"` → `"destructive"` (Shadcn Badge convention)
   - Returns: `"success" | "warning" | "destructive" | "default"`
   - Used by: AuditLogViewer (Badge component)

3. **`getAuditActionBadgeStyle(action: string): string`**
   - Enhanced badge styling for better contrast
   - Returns CSS classes: `bg-green-600 text-white border-green-700` etc.
   - Used by: AuditLogViewer (Badge component)

### Color Mapping Logic (Keyword-based)

```typescript
// Green (success)
'created', 'started', 'granted', 'accepted', 'registered', 'restored'

// Red (error)
'deleted', 'purged', 'revoked'

// Orange (warning)
'stopped', 'restarted', 'rebuilt', 'changed', 'modified', 'updated', 'cancelled'

// Cyan (info) - default
'login', 'logout', 'command', and any unmapped actions
```

### Design Decisions

**Why keyword-based matching?**
- Flexible: Works with existing actions and future additions
- Semantic: Groups actions by intent (create, delete, modify)
- Maintainable: No need to update mapping for each new action type

**Why keep table format in AuditLogViewer?**
- Pagination: Handles 50+ items per page
- Filtering: User, action, target type filters
- Context: Shows IP address, full details, exact timestamps
- ActivityTimeline: Better suited for small "recent activity" widgets (5 items)

**Result:** Color consistency achieved while maintaining optimal UX for each component's use case.
