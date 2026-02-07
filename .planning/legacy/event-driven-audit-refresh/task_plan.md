# Task: Event-driven audit log refresh

## Goal
Replace polling-based refresh of Recent Activity with event-driven invalidation.
When any action occurs that creates an audit log entry, immediately refresh the audit logs query.

## Current State
- `useAuditLogs` hook had `refetchInterval: 30000` (just removed)
- Mutations in `useServers.ts` and `useUsers.ts` don't invalidate `['auditLogs']`
- RCON commands via `executeRconCommand` in QuickActions.tsx are plain fetch calls

## Phases

### Phase 1: Update useServers.ts mutations
**Status:** `complete`
- [ ] Add `queryClient.invalidateQueries({ queryKey: ['auditLogs'] })` to all mutation onSuccess callbacks

Mutations to update:
- useCreateServer
- useDeleteServer
- useRebuildServer
- useCleanupFailedServers
- useStartServer
- useStopServer
- usePurgeServer
- useRestoreServer
- useSyncServers
- useUpdateServerConfig
- useApplyServerConfig

### Phase 2: Update useUsers.ts mutations
**Status:** `complete`
- [ ] Add audit log invalidation to all user mutations

Mutations to update:
- useInviteUser
- useDeleteUser
- useGrantPermission
- useRevokePermission
- useGrantRoleAssignment
- useRevokeRoleAssignment

### Phase 3: Update QuickActions.tsx for RCON commands
**Status:** `complete`
- [ ] Import useQueryClient from @tanstack/react-query
- [ ] Get queryClient instance
- [ ] Invalidate audit logs after successful RCON commands (save, broadcast)

### Phase 4: Build and Deploy
**Status:** `complete`
- [ ] Build frontend
- [ ] Update asset hash in index.ts
- [ ] Deploy to Cloudflare
- [ ] Test that Recent Activity updates after actions

## Files to Modify
- `frontend/src/hooks/useAuditLogs.ts` (already updated - removed refetchInterval)
- `frontend/src/hooks/useServers.ts`
- `frontend/src/hooks/useUsers.ts`
- `frontend/src/components/server-overview/QuickActions.tsx`
- `manager/src/index.ts` (asset hash)

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
