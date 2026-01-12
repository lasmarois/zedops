# Task Plan: M7 Phase 2 - RBAC Auth Migration & Refinement

**Goal:** Complete RBAC implementation with consistent JWT authentication across all endpoints

**Duration:** 4-6 hours (estimated)

**Success Criteria:**
- All endpoints use JWT authentication (no ADMIN_PASSWORD)
- All endpoints have permission checks (except public routes)
- Non-admin users can fully use the system with appropriate permissions
- Permission hierarchy is clear and documented
- All operations are audit logged
- Frontend works with JWT everywhere
- Tests pass for all permission scenarios
- WebSocket auth uses JWT (logs, RCON)

**Status:** ⏳ Planned - Awaiting architectural decisions
**Started:** 2026-01-12

---

## Phase Overview

| Phase | Status | Description | Duration |
|-------|--------|-------------|----------|
| 0. Architectural Decisions | ⏳ pending | User decides on role model, hierarchy, etc. | 30 min |
| 1. Permission Hierarchy | ⏳ planned | Implement delete ⊃ control ⊃ view | 30 min |
| 2. Backend Auth Migration | ⏳ planned | Migrate all endpoints to JWT + permissions | 2 hours |
| 3. WebSocket Auth Migration | ⏳ planned | Update logs/RCON WebSocket to use JWT | 1 hour |
| 4. Audit Logging Completion | ⏳ planned | Add missing audit log calls | 30 min |
| 5. Frontend Updates | ⏳ planned | Update WebSocket connections to use JWT | 30 min |
| 6. Agent-Level Permission UI | ⏳ optional | Add UI for agent-level grants | 1 hour |
| 7. Testing & Verification | ⏳ planned | Test all permission scenarios | 1 hour |
| 8. Documentation | ⏳ planned | Update API docs, permission model docs | 30 min |

---

## Phase 0: Architectural Decisions ⏳ Pending User Input

**Status:** ⏳ pending

**Goals:**
- Get user decisions on all architectural questions
- Document decisions for implementation
- Update task plan based on decisions

**Questions for User:**

### Question 1: Role Model
**Options:**
- **A (Recommended)**: Keep 2 roles (admin/user) + flexible permissions
- **B**: Expand to 4 roles (admin/operator/viewer/user) with predefined permissions

**Decision:** [PENDING]

---

### Question 2: Permission Hierarchy
**Options:**
- **A (Recommended)**: Implement hierarchy (delete ⊃ control ⊃ view)
- **B**: Keep independent (each permission must be explicitly granted)

**Decision:** [PENDING]

---

### Question 3: Agent-Level Permissions UI
**Options:**
- **A (Recommended)**: Add UI for granting access to all servers on an agent
- **B**: Skip for now (code supports it, but UI doesn't expose it)

**Decision:** [PENDING]

---

### Question 4: Server Creation Permission
**Options:**
- **A (Recommended)**: Admin-only (keep current)
- **B**: Add 'create' permission type
- **C**: Users with 'control' on agent can create

**Decision:** [PENDING]

---

### Question 5: RCON Permission
**Options:**
- **A (Recommended)**: RCON requires 'control' permission
- **B**: RCON requires separate 'rcon' permission
- **C**: RCON requires 'delete' permission

**Decision:** [PENDING]

---

**Tasks:**
- [ ] Present questions to user
- [ ] Document decisions in progress.md
- [ ] Update task plan phases based on decisions
- [ ] Mark Phase 0 complete

**Outcome:** Clear architectural direction for implementation

---

## Phase 1: Permission Hierarchy Implementation ⏳ Planned

**Status:** ⏳ planned (conditional on Phase 0 decision)

**Goals:**
- Implement permission hierarchy: delete ⊃ control ⊃ view
- Update checkPermission() logic
- Maintain backward compatibility

**Tasks:**

### 1.1 Update Permission Checking Logic
- [ ] Read `manager/src/lib/permissions.ts`
- [ ] Update `checkPermission()` function (line 43-68):
  ```typescript
  // Current logic: exact match only
  const permission = await db.prepare(`
    SELECT id FROM permissions
    WHERE user_id = ? AND resource_type = ?
    AND (resource_id = ? OR resource_id IS NULL)
    AND permission = ?
  `).bind(userId, resourceType, resourceId, action).first();

  // New logic: check hierarchy
  let permissionQuery = '';
  if (action === 'view') {
    permissionQuery = "AND permission IN ('view', 'control', 'delete')";
  } else if (action === 'control') {
    permissionQuery = "AND permission IN ('control', 'delete')";
  } else if (action === 'delete') {
    permissionQuery = "AND permission = 'delete'";
  } else {
    permissionQuery = "AND permission = ?";
  }
  ```
- [ ] Update all convenience functions (canViewServer, canControlServer, canDeleteServer)
- [ ] Add comments documenting hierarchy

### 1.2 Update Documentation
- [ ] Add hierarchy explanation to `manager/src/lib/permissions.ts` file header
- [ ] Document in ISSUE-rbac-auth-migration.md

**Files to Modify:**
- `manager/src/lib/permissions.ts` - Update checkPermission()

**Verification:**
- Create test: User with 'control' can view (no explicit 'view' grant)
- Create test: User with 'delete' can control and view
- Create test: User with only 'view' cannot control

**Skip if:** User chooses to keep independent permissions (Phase 0 Decision 2B)

---

## Phase 2: Backend Auth Migration ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Replace all ADMIN_PASSWORD checks with requireAuth() + permission checks
- Ensure all endpoints use JWT authentication
- Maintain backward compatibility during rollout

**Affected Endpoints:**

| Endpoint | Current Auth | New Auth | Permission |
|----------|-------------|----------|------------|
| GET /api/agents/:id/containers | ADMIN_PASSWORD | requireAuth() | Admin only |
| POST /api/agents/:id/ports/check | ADMIN_PASSWORD | requireAuth() | Admin only (for now) |
| GET /api/agents/:id/ports/availability | ADMIN_PASSWORD | requireAuth() | Admin only (for now) |
| POST /api/agents/:id/servers | ADMIN_PASSWORD | requireAuth() | Admin only OR 'create' (Phase 0 decision) |
| POST /api/agents/:id/servers/sync | ADMIN_PASSWORD | requireAuth() | Admin only |
| POST /:id/servers/:serverId/restart | None | requireAuth() | canControlServer() |
| POST /:id/servers/:serverId/rebuild | None | requireAuth() | Admin only (destructive) |

### 2.1 Migrate Container Operations

**Endpoint:** `GET /api/agents/:id/containers` (line ~121)

- [ ] Read current implementation
- [ ] Remove ADMIN_PASSWORD check (lines 123-131)
- [ ] Add `requireAuth()` middleware (already applied at line 28)
- [ ] Add admin-only check:
  ```typescript
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }
  ```
- [ ] Test: Admin can fetch containers
- [ ] Test: Non-admin gets 403

**Files to Modify:**
- `manager/src/routes/agents.ts` (line ~121-165)

---

### 2.2 Migrate Port Operations

**Endpoints:**
- `POST /api/agents/:id/ports/check` (line ~174)
- `GET /api/agents/:id/ports/availability` (line ~239)

- [ ] Remove ADMIN_PASSWORD checks
- [ ] Add admin-only requirement (ports are global agent resource)
- [ ] Consider: Should port checking be allowed for users with 'create' permission?
- [ ] Test: Admin can check ports
- [ ] Test: Non-admin gets 403

**Files to Modify:**
- `manager/src/routes/agents.ts` (lines ~174-225, ~239-350)

---

### 2.3 Migrate Server Creation

**Endpoint:** `POST /api/agents/:id/servers` (line ~570)

- [ ] Remove ADMIN_PASSWORD check
- [ ] Implement based on Phase 0 Decision 4:
  - **If admin-only:** Add `requireRole('admin')` check
  - **If 'create' permission:** Add `canCreateServer()` check
  - **If control-based:** Check if user has 'control' on agent
- [ ] Test appropriate scenarios

**Files to Modify:**
- `manager/src/routes/agents.ts` (line ~570-799)
- `manager/src/lib/permissions.ts` (if adding canCreateServer())

---

### 2.4 Migrate Server Sync

**Endpoint:** `POST /api/agents/:id/servers/sync` (line ~875)

- [ ] Remove ADMIN_PASSWORD check
- [ ] Add admin-only requirement (sync is administrative operation)
- [ ] Test: Admin can sync
- [ ] Test: Non-admin gets 403

**Files to Modify:**
- `manager/src/routes/agents.ts` (line ~875-1035)

---

### 2.5 Add Auth to Restart Endpoint

**Endpoint:** `POST /:id/servers/:serverId/restart` (line ~460)

- [ ] Read current implementation
- [ ] Add `requireAuth()` check (already applied)
- [ ] Add permission check:
  ```typescript
  const user = c.get('user');
  const serverId = c.req.param('serverId');

  const hasPermission = await canControlServer(c.env.DB, user.id, user.role, serverId);
  if (!hasPermission) {
    return c.json({ error: 'Forbidden - requires control permission' }, 403);
  }
  ```
- [ ] Test: User with 'control' can restart
- [ ] Test: User without permission gets 403

**Files to Modify:**
- `manager/src/routes/agents.ts` (line ~460-518)

---

### 2.6 Add Auth to Rebuild Endpoint

**Endpoint:** `POST /:id/servers/:serverId/rebuild` (line ~1100+)

- [ ] Locate rebuild endpoint
- [ ] Add `requireAuth()` check
- [ ] Add admin-only OR 'delete' permission check (rebuild is destructive)
  ```typescript
  const user = c.get('user');
  if (user.role !== 'admin') {
    const canDelete = await canDeleteServer(c.env.DB, user.id, user.role, serverId);
    if (!canDelete) {
      return c.json({ error: 'Forbidden - requires delete permission' }, 403);
    }
  }
  ```
- [ ] Test scenarios

**Files to Modify:**
- `manager/src/routes/agents.ts`

---

**Verification:**
- All endpoints return 401 without JWT token
- All endpoints enforce appropriate permissions
- Admin can access all endpoints
- Non-admin with permissions can access allowed endpoints
- Non-admin without permissions gets 403

---

## Phase 3: WebSocket Auth Migration ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Migrate WebSocket endpoints from password to JWT
- Update log streaming WebSocket
- Update RCON WebSocket (when implemented)
- Implement permission checks for WebSocket connections

### 3.1 Migrate Log Streaming WebSocket

**Endpoint:** `GET /api/agents/:id/logs/ws` (line ~527)

**Current:**
```typescript
const password = c.req.query('password');
if (!password || password !== c.env.ADMIN_PASSWORD) {
  return c.json({ error: 'Invalid or missing password' }, 401);
}
```

**New Implementation:**
```typescript
// Extract JWT from query parameter
const token = c.req.query('token');
if (!token) {
  return c.json({ error: 'Missing token' }, 401);
}

// Verify JWT
const payload = await verifySessionToken(token, c.env.TOKEN_SECRET);
if (!payload || payload.type !== 'user_session') {
  return c.json({ error: 'Invalid token' }, 401);
}

// Load user
const user = await c.env.DB.prepare(
  'SELECT id, email, role FROM users WHERE id = ?'
).bind(payload.userId).first();

if (!user) {
  return c.json({ error: 'User not found' }, 401);
}

// Check permission to view logs
// Extract serverId from query or connection context
const serverId = c.req.query('serverId');
if (serverId) {
  const hasPermission = await canViewServer(c.env.DB, user.id as string, user.role as string, serverId);
  if (!hasPermission) {
    return c.json({ error: 'Forbidden - no permission to view this server' }, 403);
  }
}

// Pass user context to Durable Object
// Forward WebSocket upgrade with user info
```

- [ ] Update authentication logic
- [ ] Add permission check based on server being viewed
- [ ] Pass user context to Durable Object for ongoing checks
- [ ] Handle permission revocation (close socket if permission removed)

**Files to Modify:**
- `manager/src/routes/agents.ts` (line ~527-561)
- `manager/src/durable-objects/AgentConnection.ts` (log stream handler)

---

### 3.2 Update RCON WebSocket Auth

**Endpoint:** RCON WebSocket (not yet implemented with JWT)

- [ ] Locate RCON WebSocket upgrade handler
- [ ] Implement JWT authentication (same as log streaming)
- [ ] Add permission check based on Phase 0 Decision 5:
  - **If 'control':** `canControlServer()`
  - **If separate 'rcon':** `canUseRcon()` (new function)
  - **If 'delete':** `canDeleteServer()`
- [ ] Pass user context to Durable Object
- [ ] Update RCON command handler to include user ID for audit logs

**Files to Modify:**
- `manager/src/durable-objects/AgentConnection.ts` (RCON handlers)
- `manager/src/lib/permissions.ts` (if adding canUseRcon())

---

**Verification:**
- WebSocket connections fail without valid JWT
- WebSocket connections enforce permissions
- Users can only view/control servers they have permission for
- Token expiration closes WebSocket gracefully

---

## Phase 4: Audit Logging Completion ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Add audit logs for all operations currently missing them
- Ensure comprehensive tracking of user actions

### 4.1 Add Missing Server Operation Logs

**Operations Missing Audit Logs:**

- [ ] Server restart (`POST /:id/servers/:serverId/restart`)
  ```typescript
  await logServerRestarted(c.env.DB, c, user.id, serverId);
  ```

- [ ] Server rebuild (`POST /:id/servers/:serverId/rebuild`)
  ```typescript
  await logServerRebuilt(c.env.DB, c, user.id, serverId);
  ```

- [ ] Server sync (`POST /api/agents/:id/servers/sync`)
  ```typescript
  await logServersSynced(c.env.DB, c, user.id, agentId);
  ```

**Files to Modify:**
- `manager/src/lib/audit.ts` - Add new logging functions
- `manager/src/routes/agents.ts` - Add audit calls after operations

---

### 4.2 Add RCON Command Logging

- [ ] Create `logRconCommand()` function in audit.ts:
  ```typescript
  export async function logRconCommand(
    db: D1Database,
    c: Context,
    userId: string,
    serverId: string,
    command: string
  ) {
    await logAudit(db, c, {
      userId,
      action: 'rcon.command',
      resourceType: 'server',
      resourceId: serverId,
      details: JSON.stringify({ command }),
    });
  }
  ```

- [ ] Add audit call in RCON command handler
- [ ] Test: RCON commands appear in audit logs

**Files to Modify:**
- `manager/src/lib/audit.ts` - Add logRconCommand()
- `manager/src/durable-objects/AgentConnection.ts` - Add audit calls

---

### 4.3 Optional: Log Viewing Tracking

**Decision:** Should we log when users view logs/servers?

**Pros:** Complete audit trail, security monitoring
**Cons:** Very noisy, large audit log table

**Recommendation:** Skip for MVP, add later if needed for compliance

---

**Verification:**
- All operations create audit log entries
- Audit logs include user ID, action, resource, timestamp
- Audit log viewer displays new entries

---

## Phase 5: Frontend Updates ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Update frontend to use JWT for WebSocket connections
- Remove password prompts
- Update API client if needed

### 5.1 Update Log Streaming Hook

**File:** `frontend/src/hooks/useLogStream.ts`

**Current:**
```typescript
const password = adminPassword; // From parameter
const wsUrl = `${protocol}//${wsHost}/api/agents/${agentId}/logs/ws?password=${encodeURIComponent(password)}`;
```

**New:**
```typescript
import { getToken } from '../lib/auth';

const token = getToken();
if (!token) {
  throw new Error('Not authenticated');
}
const wsUrl = `${protocol}//${wsHost}/api/agents/${agentId}/logs/ws?token=${encodeURIComponent(token)}&serverId=${serverId}`;
```

- [ ] Update useLogStream hook
- [ ] Remove adminPassword parameter
- [ ] Use getToken() from auth.ts
- [ ] Add serverId to query params for permission check
- [ ] Test: Log viewer works with JWT

**Files to Modify:**
- `frontend/src/hooks/useLogStream.ts`

---

### 5.2 Update RCON Hook

**File:** `frontend/src/hooks/useRcon.ts`

- [ ] Update similar to useLogStream
- [ ] Use getToken() instead of adminPassword
- [ ] Add serverId to query for permission check
- [ ] Test: RCON terminal works with JWT

**Files to Modify:**
- `frontend/src/hooks/useRcon.ts`

---

### 5.3 Remove Password Prompts

**Files That May Still Reference Password:**

- [ ] Search codebase for `adminPassword` references
- [ ] Remove any remaining password input fields
- [ ] Update components to rely on UserContext authentication
- [ ] Test: No password prompts appear in UI

**Files to Check:**
- `frontend/src/components/ContainerList.tsx`
- `frontend/src/components/LogViewer.tsx`
- `frontend/src/components/RconTerminal.tsx`

---

**Verification:**
- All frontend operations use JWT tokens
- No password prompts in UI
- WebSocket connections work with JWT
- Log viewer and RCON terminal functional

---

## Phase 6: Agent-Level Permission UI ⏳ Optional

**Status:** ⏳ optional (conditional on Phase 0 Decision 3)

**Goals:**
- Add UI for granting permissions at agent level
- Update PermissionsManager component
- Document agent-level vs server-level behavior

### 6.1 Update PermissionsManager Component

**File:** `frontend/src/components/PermissionsManager.tsx`

**Current:** Only allows server-level grants

**New:** Add selector for grant scope

- [ ] Add radio buttons or dropdown:
  ```typescript
  [ ] Grant to specific server: [Server dropdown]
  [ ] Grant to all servers on agent: [Agent dropdown]
  ```

- [ ] When "all servers on agent" selected:
  - resourceType: 'agent'
  - resourceId: agentId (not serverId)

- [ ] Update grantPermission API call to support agent-level

- [ ] Add explanation text:
  "Agent-level permissions grant access to ALL servers on the agent, including future servers."

**Files to Modify:**
- `frontend/src/components/PermissionsManager.tsx`

---

### 6.2 Update Permission Display

- [ ] Show agent-level permissions differently:
  - "Control access to agent home-lab (all servers)"
  - vs
  - "Control access to server zomboid-1"

- [ ] Group permissions by scope (agent-level vs server-level)

---

### 6.3 Update Backend Permission Routes

**File:** `manager/src/routes/permissions.ts`

- [ ] Verify agent-level grants work (already implemented, just needs testing)
- [ ] Add validation: If resourceType='agent', verify agent exists
- [ ] Test scenarios

---

**Verification:**
- Can grant agent-level permission from UI
- Agent-level permission grants access to all servers on agent
- Permission display clearly shows agent-level vs server-level
- User with agent-level permission can access all servers

**Skip if:** User chooses not to add agent-level UI (Phase 0 Decision 3B)

---

## Phase 7: Testing & Verification ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Comprehensive testing of all permission scenarios
- Verify audit logging
- Test with multiple users

### 7.1 Setup Test Users

- [ ] Invite test user via admin UI
- [ ] Register test user
- [ ] Create test user in database directly for speed:
  ```sql
  INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
  VALUES (
    'test-user-1',
    'test@example.com',
    '$2b$10$...', -- bcrypt hash of 'testpass'
    'user',
    unixepoch() * 1000,
    unixepoch() * 1000
  );
  ```

---

### 7.2 Test Permission Scenarios

**Scenario 1: View-Only Permission**
- [ ] Grant 'view' permission to server-123
- [ ] Login as test user
- [ ] Verify: Can see server-123 in list
- [ ] Verify: Can view server-123 logs
- [ ] Verify: Cannot start/stop server-123 (403)
- [ ] Verify: Cannot use RCON on server-123 (403)
- [ ] Verify: Cannot delete server-123 (403)

**Scenario 2: Control Permission**
- [ ] Grant 'control' permission to server-456
- [ ] Login as test user
- [ ] Verify: Can see server-456 in list
- [ ] Verify: Can view logs (if hierarchy implemented)
- [ ] Verify: Can start/stop/restart server-456
- [ ] Verify: Can use RCON on server-456
- [ ] Verify: Cannot delete server-456 (403)

**Scenario 3: Delete Permission**
- [ ] Grant 'delete' permission to server-789
- [ ] Login as test user
- [ ] Verify: Can see server-789
- [ ] Verify: Can view logs (if hierarchy)
- [ ] Verify: Can control server (if hierarchy)
- [ ] Verify: Can delete server-789

**Scenario 4: No Permissions**
- [ ] Revoke all permissions from test user
- [ ] Login as test user
- [ ] Verify: Server list is empty
- [ ] Verify: Attempting to access server by URL returns 403

**Scenario 5: Agent-Level Permission (if implemented)**
- [ ] Grant 'control' permission to agent-abc
- [ ] Create new server on agent-abc
- [ ] Login as test user
- [ ] Verify: Can see all servers on agent-abc
- [ ] Verify: Can control all servers on agent-abc
- [ ] Verify: Cannot see servers on other agents

---

### 7.3 Test WebSocket Auth

**Log Streaming:**
- [ ] Login as test user with 'view' permission
- [ ] Open log viewer for permitted server
- [ ] Verify: Logs stream successfully
- [ ] Verify: Token in URL (not password)
- [ ] Open log viewer for non-permitted server
- [ ] Verify: Connection rejected (403)

**RCON:**
- [ ] Login as test user with 'control' permission
- [ ] Open RCON terminal for permitted server
- [ ] Verify: Can execute commands
- [ ] Open RCON for non-permitted server
- [ ] Verify: Connection rejected (403)

---

### 7.4 Test Audit Logging

- [ ] Perform various operations as test user
- [ ] Login as admin
- [ ] Open audit log viewer
- [ ] Verify: All operations logged with correct user ID
- [ ] Verify: Server start/stop logged
- [ ] Verify: RCON commands logged
- [ ] Verify: Permission grants/revokes logged
- [ ] Verify: Restart/rebuild operations logged

---

### 7.5 Test Admin Override

- [ ] Login as admin
- [ ] Verify: Can access all servers (no permission grants needed)
- [ ] Verify: Can perform all operations
- [ ] Verify: Permission checks bypassed

---

**Verification Checklist:**
- [ ] All permission scenarios tested
- [ ] WebSocket authentication works
- [ ] Audit logs complete and accurate
- [ ] No security bypasses found
- [ ] Admin override works correctly
- [ ] 401 errors for unauthenticated requests
- [ ] 403 errors for unauthorized requests

---

## Phase 8: Documentation ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Update API documentation
- Document permission model
- Update deployment guides

### 8.1 Update API Documentation

- [ ] Create `docs/API.md` or update existing docs
- [ ] Document authentication:
  ```markdown
  ## Authentication

  All API endpoints (except public routes) require JWT authentication.

  ### HTTP Endpoints
  Include JWT token in Authorization header:
  ```
  Authorization: Bearer <jwt_token>
  ```

  ### WebSocket Endpoints
  Include JWT token in query parameter:
  ```
  wss://zedops.example.com/api/agents/:id/logs/ws?token=<jwt_token>&serverId=<server_id>
  ```
  ```

- [ ] Document permission model:
  - Role types (admin, user)
  - Permission types (view, control, delete)
  - Permission hierarchy (if implemented)
  - Agent-level vs server-level permissions

- [ ] Document each endpoint:
  - Authentication required: Yes/No
  - Permission required: Admin | Permission type
  - Example requests/responses

**Files to Create:**
- `docs/API.md` (if doesn't exist)

---

### 8.2 Update Permission Model Documentation

- [ ] Update `ISSUE-rbac-auth-migration.md` with final decisions
- [ ] Create `docs/PERMISSIONS.md`:
  ```markdown
  # ZedOps Permission System

  ## Roles
  - **admin**: Full system access (bypasses all permission checks)
  - **user**: Requires explicit permission grants

  ## Permission Types
  - **view**: View server details, logs, status
  - **control**: Start, stop, restart servers, use RCON
  - **delete**: Delete/purge servers

  ## Permission Hierarchy
  [If implemented]
  - delete ⊃ control ⊃ view
  - Users with 'delete' also have 'control' and 'view'
  - Users with 'control' also have 'view'

  ## Granting Permissions
  [Instructions with screenshots]
  ```

**Files to Create:**
- `docs/PERMISSIONS.md`

---

### 8.3 Update Deployment Guides

- [ ] Update `QUICK-START-RBAC.md`:
  - Verify all steps still accurate
  - Add permission management examples
  - Update verification steps

- [ ] Update `DEPLOYMENT-RBAC.md`:
  - Add permission model explanation
  - Add troubleshooting section
  - Add permission testing steps

**Files to Modify:**
- `QUICK-START-RBAC.md`
- `DEPLOYMENT-RBAC.md`

---

### 8.4 Update MILESTONES.md

- [ ] Mark M7 Phase 2 as complete
- [ ] Update total time with actual hours
- [ ] Document final architectural decisions
- [ ] Update progress percentage

**Files to Modify:**
- `MILESTONES.md`

---

**Verification:**
- Documentation is clear and complete
- Examples work as documented
- New users can understand permission system
- API docs match implementation

---

## Success Criteria Checklist

Before marking Phase 2 complete, verify:

- [ ] **All endpoints use JWT authentication** (no ADMIN_PASSWORD checks remain)
- [ ] **All endpoints have permission checks** (except public routes like /api/invite/:token)
- [ ] **Non-admin users can use the system** (with appropriate permissions granted)
- [ ] **Permission hierarchy is clear** (documented in code and docs)
- [ ] **All operations are audit logged** (no missing audit calls)
- [ ] **Frontend works with JWT everywhere** (no password prompts)
- [ ] **Tests pass for all scenarios** (view, control, delete, no permissions)
- [ ] **WebSocket auth uses JWT** (logs and RCON)
- [ ] **Documentation is updated** (API docs, permission model, deployment guides)
- [ ] **Architectural decisions documented** (in progress.md and ISSUE file)

---

## Files to Create/Modify

### Backend (Manager)

**To Modify:**
- `manager/src/routes/agents.ts` - Migrate all endpoints to JWT + permissions
- `manager/src/lib/permissions.ts` - Implement permission hierarchy (if approved)
- `manager/src/lib/audit.ts` - Add missing audit log functions
- `manager/src/durable-objects/AgentConnection.ts` - Update WebSocket auth

**To Create:**
- None (if permission hierarchy not implemented)
- `manager/src/lib/permissions.ts` - Add canCreateServer() if needed

### Frontend

**To Modify:**
- `frontend/src/hooks/useLogStream.ts` - Use JWT instead of password
- `frontend/src/hooks/useRcon.ts` - Use JWT instead of password
- `frontend/src/components/PermissionsManager.tsx` - Add agent-level grants (optional)

### Documentation

**To Create:**
- `docs/API.md` - API documentation with auth
- `docs/PERMISSIONS.md` - Permission model documentation

**To Modify:**
- `QUICK-START-RBAC.md` - Update with permission examples
- `DEPLOYMENT-RBAC.md` - Add troubleshooting, testing
- `MILESTONES.md` - Mark Phase 2 complete
- `ISSUE-rbac-auth-migration.md` - Document final decisions

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing auth | Medium | High | Incremental migration, test after each endpoint |
| WebSocket auth complexity | Medium | Medium | Test thoroughly with real connections |
| Permission hierarchy breaks existing grants | Low | High | Carefully implement backward compatibility |
| Audit log gaps | Low | Medium | Review all endpoints systematically |
| User confusion with permission model | Medium | Low | Clear documentation and examples |

---

## Rollback Plan

If critical issues found during Phase 2:

1. **Revert endpoint migrations**: Restore ADMIN_PASSWORD checks for problematic endpoints
2. **Skip permission hierarchy**: Keep independent permissions if issues arise
3. **Delay WebSocket migration**: Keep password auth for WebSockets temporarily
4. **Document known issues**: Create ISSUE file for future resolution

**Git Strategy:**
- Commit after each phase completes successfully
- Use feature branch if preferred: `git checkout -b feature/rbac-phase2`
- Can revert individual commits if needed

---

## Notes

- Phase 0 decisions will determine which optional phases to implement
- Permission hierarchy is recommended but optional
- Agent-level permission UI is nice-to-have, not critical
- RCON using 'control' permission is simplest approach
- WebSocket auth is critical for non-admin users
- Testing must be thorough (security-critical changes)
