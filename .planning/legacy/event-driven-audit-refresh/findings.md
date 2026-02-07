# Findings: Event-driven audit log refresh

## Hook Structure Analysis

### useServers.ts
- 11 mutation hooks, all follow same pattern
- Each has `onSuccess` callback with `queryClient.invalidateQueries()`
- Just need to add `['auditLogs']` invalidation to each

### useUsers.ts
- 6 mutation hooks
- Same pattern as servers

### useRcon.ts
- WebSocket-based, NOT a TanStack Query mutation
- Used for interactive RCON terminal (long-lived connection)
- Not relevant for this task

### QuickActions.tsx
- Uses `executeRconCommand()` from lib/api.ts (plain fetch)
- NOT a TanStack mutation - called directly in component
- Need to manually call queryClient.invalidateQueries after success

## Actions that create audit logs
Based on backend audit logging:
- Server: create, delete, start, stop, rebuild, purge, restore, config update
- User: invite, delete, permission changes, role changes
- RCON: commands (save, broadcast, etc.)
