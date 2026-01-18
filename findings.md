# M9.8.39 Findings

## Current Implementation

### AuditLogViewer.tsx
- Filters: User, Action, Target Type
- Pagination: page/pageSize with Previous/Next
- Uses `ActivityTimeline` component for display
- Transforms logs to `ActivityEvent[]` format

### ActivityTimeline (activity-timeline.tsx)
- Vertical colored bar on left
- User + timestamp header
- Action badge + target
- Expandable details panel

### Existing Color System (audit-colors.ts)
```typescript
getAuditActionColor(action: string) → "success" | "warning" | "error" | "info" | "muted"
```

## Action Types in System
From AuditLogViewer filter options:
- user_login, user_logout, user_created, user_deleted
- permission_granted, permission_revoked
- server_created, server_deleted, server_started, server_stopped

## Target Types
- user, server, agent, permission

## Icon Mapping Plan

### Action Icons (Lucide)
| Action | Icon | Color |
|--------|------|-------|
| server_started | Play | success |
| server_stopped | Square | warning |
| server_created | Plus | success |
| server_deleted | Trash | error |
| user_login | LogIn | info |
| user_logout | LogOut | muted |
| user_created | UserPlus | success |
| user_deleted | UserMinus | error |
| permission_granted | ShieldCheck | success |
| permission_revoked | ShieldX | error |

### Item Icons (Lucide)
| Type | Icon |
|------|------|
| server | Server |
| user | User |
| agent | Bot |
| permission | Shield |
