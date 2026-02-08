# Goal #11: Findings

## Source: M15 Post-Mortem Audit (2026-02-07)

### RBAC Enforcement Audit Results

Full audit of all API routes revealed the system is well-protected:

**Fully protected (admin-only blanket middleware):**
- `/api/admin/*` — 3 endpoints
- `/api/users/*` — 7 endpoints
- `/api/role-assignments/*` — 5 endpoints
- `/api/audit/*` — 2 endpoints (after M15 fix)

**Role-based access (granular permission checks):**
- Server start/stop/restart/rebuild — `canControlServer()`
- Server create — `canCreateServer()`
- Server view/metrics/storage — `canViewServer()`
- Server delete — `canDeleteServer()`
- RCON commands — `canControlServer()`

**Corrected (already role-based, not admin-only as initially thought):**
- Backup create — `canControlServer()` (already correct)
- Backup list — `canViewServer()` (already correct)
- Backup sync — `canControlServer()` (already correct)
- Backup delete — `canControlServer()` (already correct)
- Backup restore — `canControlServer()` (already correct)

**Actually needed fixing:**
- check-data — had NO permission check at all, added `canViewServer()`
- ports/availability — was `user.role !== 'admin'`, changed to `canCreateServer()`

### Invitation Flow (Already Correct)

The invitation acceptance endpoint (invitations.ts:342) correctly handles roles:
```typescript
const systemRole = invitation.role === 'admin' ? 'admin' : null;
```

Non-admin invitations:
- User created with `role = null` (not 'viewer'/'operator')
- Instructions tell user to contact admin for resource access
- Backend validation already accepts all 4 roles (line 42)

### Frontend UserContext

`UserContext.tsx` correctly:
- Stores user object with `role` field
- Exposes via `useUser()` hook
- Role is `'admin'` or `null` (matching backend)

### Key Files for This Goal

| File | Changes Needed |
|------|---------------|
| `frontend/src/pages/Dashboard.tsx` | Empty state for no-access users |
| `frontend/src/pages/ServerList.tsx` | Empty state for no-access users |
| `frontend/src/App.tsx` | Admin route guard wrapper |
| `manager/src/routes/agents.ts` | Broaden backup/check-data/ports endpoints |
