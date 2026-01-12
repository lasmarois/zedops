# ISSUE: RBAC Authentication Migration & Refinement

**Status:** 🚧 In Progress
**Created:** 2026-01-12
**Related Milestone:** M7 Phase 2 - RBAC & Audit Logs (Completion)
**Priority:** HIGH

---

## Problem Statement

Milestone 7 Phase 1 successfully implemented the core RBAC system with JWT authentication, user management, permissions, and audit logging. However, the implementation is **incomplete** with mixed authentication methods across endpoints.

**Current State:**
- ✅ Core RBAC system deployed and working (JWT, bcrypt, audit logs)
- ✅ User management UI functional
- ✅ Permission management UI operational
- ⚠️ **Mixed authentication**: Some endpoints use JWT, others still use old ADMIN_PASSWORD
- ⚠️ **Incomplete permission enforcement**: Several endpoints lack permission checks
- ❓ **Architectural decisions pending**: Role model, permission hierarchy, scope

---

## Issues to Resolve

### 🔴 Issue 1: Mixed Authentication Methods

**Problem**: Inconsistent auth across endpoints creates security gaps and poor UX

**Affected Endpoints (Still Using ADMIN_PASSWORD):**
```
GET  /api/agents/:id/containers          - No permission check
POST /api/agents/:id/ports/check         - No permission check
GET  /api/agents/:id/ports/availability  - No permission check
POST /api/agents/:id/servers             - Admin-only (no JWT)
POST /api/agents/:id/servers/sync        - Admin-only (no JWT)
POST /:id/servers/:serverId/restart      - No permission check
POST /:id/servers/:serverId/rebuild      - Admin-only (no JWT)
GET  /api/agents/:id/logs/ws             - No permission check (WebSocket)
```

**Endpoints Using JWT + Permissions (Working):**
```
✅ GET  /api/agents                       - Admin only
✅ GET  /api/agents/:id                   - Admin only
✅ GET  /api/agents/:id/servers           - Filtered by permissions
✅ POST /:id/servers/:serverId/start      - Requires 'control'
✅ POST /:id/servers/:serverId/stop       - Requires 'control'
✅ DELETE /:id/servers/:serverId          - Requires 'delete'
```

**Impact:**
- Non-admin users cannot view logs (even with permissions)
- Non-admin users cannot use RCON (even with control permission)
- Container operations bypass audit logging
- Inconsistent user experience

---

### 🟡 Issue 2: Role Model Clarity

**Problem**: Only 2 roles exist (`admin`, `user`), but code has "Operator" and "Viewer" preset functions

**Current Implementation:**
- Database roles: `admin`, `user`
- Permission presets: `grantOperatorPermissions()`, `grantViewerPermissions()`
- UI role selector: "Admin" or "User"

**Confusion Points:**
1. What's the difference between a "user" role and "viewer" permissions?
2. Should we have 4 roles (admin/operator/viewer/user) instead of 2?
3. Are preset functions misleading if they don't map to actual roles?

**Options:**

| Option | Roles | Permission Model | Pros | Cons |
|--------|-------|------------------|------|------|
| **A (Current)** | admin, user | Flexible per-resource grants | Max flexibility | More management overhead |
| **B (Role-based)** | admin, operator, viewer, user | Predefined per-role | Simpler, clearer | Less flexible |

---

### 🟡 Issue 3: Permission Hierarchy Not Enforced

**Problem**: Permissions are independent - `control` doesn't imply `view`

**Current Behavior:**
```
❌ User granted 'control' permission
   → Can start/stop server
   → CANNOT view logs (needs separate 'view' grant)

❌ User granted 'delete' permission
   → Can delete server
   → CANNOT control it (needs separate 'control' grant)
   → CANNOT view logs (needs separate 'view' grant)
```

**Expected/Intuitive Behavior:**
```
✅ User granted 'control' permission
   → Implies 'view' permission (can see what they control)

✅ User granted 'delete' permission
   → Implies 'control' and 'view' (full access)
```

**Questions:**
1. Should we implement permission hierarchy?
2. Would this be a breaking change for existing permissions?

---

### 🟢 Issue 4: Agent-Level Permissions Not Exposed in UI

**Problem**: Code supports agent-level permissions, but UI only grants server-level

**Use Case Example:**
```
Admin wants to grant Bob access to ALL servers on "home-lab-agent"
Currently: Must grant permission to each server individually
Desired: Grant one agent-level permission
```

**Implementation Exists:**
```typescript
{
  resourceType: "agent",
  resourceId: "agent-1",
  permission: "control"
}
// Would grant control to ALL servers on agent-1
```

**Questions:**
1. Should we add agent-level permission grants to UI?
2. How should agent-level + server-level permissions interact?
   - Option A: Agent-level grants access to all servers (override)
   - Option B: Both must be present (additive)

---

### 🔵 Issue 5: Server Creation Permission

**Problem**: Only admins can create servers (no permission type for "create")

**Current:** `POST /api/agents/:id/servers` requires admin role

**Questions:**
1. Should regular users be able to create servers?
2. If yes, should we add a `create` permission type?
3. Or grant `create` to all users with `control` on an agent?

**Security Consideration:** Unrestricted server creation could:
- Consume host resources (port exhaustion, disk space)
- Create management overhead
- Require quotas/limits

---

### 🔵 Issue 6: RCON Permission Granularity

**Problem**: No separate RCON permission - should RCON require `control` or its own permission?

**Current (Not Implemented):** RCON endpoints use ADMIN_PASSWORD

**Options:**
- **A**: RCON requires `control` permission (operational control includes RCON)
- **B**: RCON requires separate `rcon` permission (more granular)
- **C**: RCON requires `delete` permission (most privileged)

**Use Cases:**
- Option A: "If you can start/stop, you can use RCON" (most common)
- Option B: "RCON is sensitive (kick/ban players), needs explicit grant"
- Option C: "RCON can be destructive, treat like delete"

---

### 🔵 Issue 7: Global Permissions Not Used

**Problem**: Global permissions exist in types but aren't implemented

**Current:** `resourceType: 'global'` exists but no code uses it

**Questions:**
1. Do we need global permissions?
2. Use case: "Super admin" with manage_users globally but not full admin?
3. Or is admin/user binary sufficient?

---

## Architectural Decisions Needed

Before implementing Phase 2, we need to decide:

### Decision 1: Role Model
- [ ] **Keep current**: 2 roles (admin/user) + flexible permissions
- [ ] **Expand roles**: 4 roles (admin/operator/viewer/user) with predefined permissions

### Decision 2: Permission Hierarchy
- [ ] **Implement hierarchy**: control ⊃ view, delete ⊃ control ⊃ view
- [ ] **Keep independent**: Each permission must be explicitly granted

### Decision 3: Auth Migration Priority
- [ ] **High priority**: Migrate all endpoints to JWT immediately
- [ ] **Medium priority**: Migrate after architectural decisions finalized
- [ ] **Low priority**: Keep mixed auth (not recommended)

### Decision 4: Agent-Level Permissions
- [ ] **Add to UI**: Expose agent-level permission grants
- [ ] **Keep server-only**: Don't add UI (agent-level exists but not used)

### Decision 5: Server Creation
- [ ] **Admin-only**: Keep current (only admins create servers)
- [ ] **Add permission**: Create new `create` permission type
- [ ] **Use control**: Users with `control` on agent can create servers

### Decision 6: RCON Permission
- [ ] **Use control**: RCON requires `control` permission
- [ ] **Separate permission**: Add new `rcon` permission type
- [ ] **Use delete**: RCON requires `delete` permission

---

## Scope of Phase 2 Work

Based on decisions above, Phase 2 will include:

### Core Tasks (Required):
1. **Migrate remaining endpoints to JWT auth**
   - Replace all ADMIN_PASSWORD checks with requireAuth()
   - Add permission checks to all operations
   - Update WebSocket auth (JWT token in query param or header)

2. **Implement chosen permission model**
   - If hierarchy: Update checkPermission() to include implied permissions
   - If new permissions: Update database constraints and types

3. **Update audit logging**
   - Ensure ALL operations are logged
   - Fix any endpoints missing audit logs

4. **Comprehensive testing**
   - Test all permission scenarios (view, control, delete)
   - Test with multiple non-admin users
   - Verify audit logs capture everything

### Optional Tasks (Based on decisions):
5. **Agent-level permission UI** (if approved)
6. **Server creation permission** (if approved)
7. **Separate RCON permission** (if approved)
8. **Role model refactor** (if switching to 4 roles)

---

## Success Criteria

Phase 2 will be complete when:

- [ ] **All endpoints use JWT authentication** (no ADMIN_PASSWORD)
- [ ] **All endpoints have permission checks** (except public routes)
- [ ] **Non-admin users can fully use the system** (with appropriate permissions)
- [ ] **Permission hierarchy is clear and documented** (whatever model chosen)
- [ ] **All operations are audit logged** (comprehensive tracking)
- [ ] **Frontend works with JWT everywhere** (no password prompts)
- [ ] **Tests pass for all permission scenarios** (view/control/delete)
- [ ] **WebSocket auth uses JWT** (logs, RCON)
- [ ] **Documentation is updated** (README, API docs)

---

## Estimated Effort

**Phase 2 Estimate:** 4-6 hours

- Auth migration: 2-3 hours
- Permission model implementation: 1-2 hours
- Testing: 1 hour
- Documentation: 30 minutes

**Total M7 Time:**
- Phase 1: 12 hours ✅
- Phase 2: 4-6 hours (estimated)
- **Total: 16-18 hours**

---

## Open Questions for User

Before starting Phase 2 planning, user needs to answer:

1. **Role model**: 2 roles (current) or 4 roles (admin/operator/viewer/user)?
2. **Permission hierarchy**: Should control → view, delete → control → view?
3. **Agent-level permissions UI**: Add UI for granting access to all servers on an agent?
4. **Server creation**: Admin-only, or add permission for regular users?
5. **RCON permission**: Use `control` permission, or separate `rcon` permission?

---

## Related Files

**Planning (Phase 1 - Archived):**
- `planning-history/milestone-7-rbac-initial-implementation/task_plan.md`
- `planning-history/milestone-7-rbac-initial-implementation/findings.md`
- `planning-history/milestone-7-rbac-initial-implementation/progress.md`
- `planning-history/milestone-7-rbac-initial-implementation/PHASE-1-COMPLETE.md`

**Implementation Files:**
- `manager/src/lib/permissions.ts` - Permission checking logic
- `manager/src/routes/permissions.ts` - Permission management API
- `manager/src/routes/agents.ts` - Endpoint auth checks
- `manager/src/middleware/auth.ts` - JWT authentication
- `frontend/src/lib/api.ts` - Frontend API client

**Documentation:**
- `QUICK-START-RBAC.md` - Quick deployment guide
- `DEPLOYMENT-RBAC.md` - Comprehensive deployment guide

---

## Next Steps

1. **User answers architectural questions** (above)
2. **Launch planning-with-files for Phase 2** (new task_plan.md)
3. **Implement auth migration** (prioritize based on decisions)
4. **Test thoroughly** (all permission scenarios)
5. **Update documentation** (reflect final implementation)
6. **Mark M7 as fully complete** ✅
