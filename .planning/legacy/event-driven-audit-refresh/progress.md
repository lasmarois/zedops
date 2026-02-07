# Progress: Event-driven audit log refresh

## Session Log

### 2026-01-18 - Implementation Start
- Created planning files
- Already removed `refetchInterval: 30000` from useAuditLogs.ts
- Starting Phase 1: Update useServers.ts

## Changes Made
| File | Change | Status |
|------|--------|--------|
| useAuditLogs.ts | Removed refetchInterval, added comment | Done |
| useServers.ts | Add auditLogs invalidation to 11 mutations | Done |
| useUsers.ts | Add auditLogs invalidation to 6 mutations | Done |
| QuickActions.tsx | Add manual invalidation after RCON | Done |

## Next: Build and Deploy
