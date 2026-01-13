# Findings: M7 Phase 2 - RBAC Auth Migration & Refinement

**Milestone:** M7 Phase 2 - RBAC Auth Migration & Refinement
**Started:** 2026-01-12
**Phase:** Research & Architectural Design

---

## Finding 1: Mixed Authentication State

**Current Implementation:**

### ✅ Endpoints Using JWT + Permissions (Working)
```typescript
// manager/src/routes/agents.ts
GET  /api/agents                       - requireAuth() + requireRole('admin')
GET  /api/agents/:id                   - requireAuth() + requireRole('admin')
GET  /api/agents/:id/servers           - requireAuth() + filtered by getUserVisibleServers()
POST /:id/servers/:serverId/start      - requireAuth() + canControlServer()
POST /:id/servers/:serverId/stop       - requireAuth() + canControlServer()
DELETE /:id/servers/:serverId          - requireAuth() + canDeleteServer()
```

### ⚠️ Endpoints Using ADMIN_PASSWORD (Need Migration)
```typescript
GET  /api/agents/:id/containers        - Line 123: authHeader !== ADMIN_PASSWORD
POST /api/agents/:id/ports/check       - Line 176: authHeader !== ADMIN_PASSWORD
GET  /api/agents/:id/ports/availability - Line 245: authHeader !== ADMIN_PASSWORD
POST /api/agents/:id/servers           - Line 577: authHeader !== ADMIN_PASSWORD (create server)
POST /api/agents/:id/servers/sync      - Line 877: authHeader !== ADMIN_PASSWORD
POST /:id/servers/:serverId/restart    - No auth check (proxies to DO)
POST /:id/servers/:serverId/rebuild    - No auth check (proxies to DO)
GET  /api/agents/:id/logs/ws           - Line 532: query param 'password' === ADMIN_PASSWORD
```

**Impact:**
- Non-admin users CANNOT view logs (even with 'view' permission)
- Non-admin users CANNOT use RCON (even with 'control' permission)
- Port checking bypasses audit logging
- Container operations not tracked in audit logs
- Inconsistent UX (some operations work with JWT, others don't)

---

## Finding 2: Permission Types & Hierarchy

**Current Permission Types:**
```typescript
type Permission = 'view' | 'control' | 'delete' | 'manage_users';
```

**Current Behavior (No Hierarchy):**
```
User granted 'control' permission:
  ✅ Can start/stop server
  ❌ Cannot view logs (needs separate 'view' grant)

User granted 'delete' permission:
  ✅ Can delete server
  ❌ Cannot control server (needs separate 'control' grant)
  ❌ Cannot view logs (needs separate 'view' grant)
```

**Proposed Hierarchy:**
```
delete ⊃ control ⊃ view
  └─ delete implies control and view
  └─ control implies view
  └─ view is standalone
```

**Implementation Impact:**
- Would need to update `checkPermission()` in `manager/src/lib/permissions.ts`
- Logic change:
  ```typescript
  // Current: exact match only
  permission.permission === action

  // Proposed: check hierarchy
  if (action === 'view') {
    return permission.permission IN ('view', 'control', 'delete');
  }
  if (action === 'control') {
    return permission.permission IN ('control', 'delete');
  }
  if (action === 'delete') {
    return permission.permission === 'delete';
  }
  ```

**Pros:**
- More intuitive (if you can delete, you can control)
- Fewer permission grants needed
- Matches user mental model

**Cons:**
- Breaking change if anyone uses non-hierarchical grants
- Less flexible (can't grant delete without control)

---

## Finding 3: Role Model Options

**Option A: Current (2 Roles + Flexible Permissions)**

```
Roles:
- admin: Bypasses all permission checks (implicit full access)
- user: Requires explicit permission grants per-resource

Permissions:
- Granted individually per-server (or per-agent, but UI doesn't expose this)
- Preset functions exist: grantOperatorPermissions(), grantViewerPermissions()
```

**Pros:**
- Maximum flexibility (mix and match permissions)
- Fewer roles to manage
- Can grant different permissions to different servers

**Cons:**
- More grants to manage (one per server per permission)
- Preset functions don't map to roles (misleading names)

---

**Option B: 4 Roles with Predefined Permissions**

```
Roles:
- admin: Full system access (bypasses all checks)
- operator: control + view permissions on assigned resources
- viewer: view permission only on assigned resources
- user: No default permissions (must be granted explicitly)

Permission Assignment:
- Assigning 'operator' role → automatically has control + view on assigned servers
- Assigning 'viewer' role → automatically has view on assigned servers
- No explicit permission grants needed (role defines permissions)
```

**Database Changes Needed:**
```sql
-- Update role constraint
CHECK (role IN ('admin', 'operator', 'viewer', 'user'))

-- Migration: Convert existing 'user' role grants to appropriate role
-- Users with control permissions → operator
-- Users with view-only permissions → viewer
-- Users with no permissions → user
```

**Pros:**
- Simpler user management (assign role, done)
- Clear role names match common patterns
- Preset functions now match role names

**Cons:**
- Less flexible (can't mix permissions)
- More roles to manage
- Can't grant "control on server A, view on server B" to same user

---

**Recommendation:** Keep Option A (2 roles + flexible permissions) BUT:
- Rename preset functions to avoid confusion:
  - `grantOperatorPermissions()` → `grantControlAccess()`
  - `grantViewerPermissions()` → `grantViewAccess()`
- Update UI labels to clarify role vs permissions

---

## Finding 4: Agent-Level Permissions

**Current Support (Exists but Not Used):**
```typescript
// Code supports this, but UI doesn't expose it
{
  resourceType: 'agent',
  resourceId: 'agent-123',
  permission: 'control'
}
// Would grant control to ALL servers on agent-123
```

**Permission Check Logic (Already Implemented):**
```typescript
// manager/src/lib/permissions.ts line 56-65
SELECT id FROM permissions
WHERE user_id = ?
AND resource_type = ?
AND (resource_id = ? OR resource_id IS NULL)  // NULL = wildcard (agent-level)
AND permission = ?
```

**Use Cases:**
1. "Grant Bob access to all servers on my home lab agent"
2. "Grant monitoring team view access to all production servers"
3. Simplify permission management for multi-server agents

**Implementation Needed:**
- Add agent-level grant option to PermissionsManager.tsx
- UI selector: "Grant access to: [Server dropdown] or [All servers on this agent]"
- Document behavior: Agent-level OR server-level grants access (additive)

---

## Finding 5: Server Creation Permission

**Current:** Only admins can create servers (`POST /api/agents/:id/servers`)

**Options:**

**A. Keep Admin-Only (Recommended)**
- Pros: Prevents resource exhaustion, maintains control
- Cons: Less self-service for users
- Use case: Small teams where admins provision servers

**B. Add 'create' Permission**
- New permission type: `'view' | 'control' | 'delete' | 'create' | 'manage_users'`
- Grant 'create' permission on agent → user can create servers on that agent
- Pros: More self-service, flexible
- Cons: Requires migration, new permission type, need quotas to prevent abuse

**C. Create Implies Control on Agent**
- Users with 'control' permission on agent can create servers
- Pros: Reuses existing permission
- Cons: Conflates control (of existing servers) with create (new servers)

**Recommendation:** Option A (admin-only) for MVP, add Option B (create permission) later when quotas/limits implemented

---

## Finding 6: RCON Permission Granularity

**Current:** RCON endpoints use old password auth (not implemented)

**Options:**

**A. RCON Requires 'control' Permission (Recommended)**
```typescript
// RCON is operational control (kick, ban, save, broadcast)
// Users who can start/stop should also be able to use RCON
if (!await canControlServer(db, userId, userRole, serverId)) {
  return c.json({ error: 'Forbidden' }, 403);
}
```
- Pros: Intuitive (operational control includes RCON)
- Cons: RCON is powerful (can kick players, ban, etc.)

**B. RCON Requires Separate 'rcon' Permission**
```typescript
type Permission = 'view' | 'control' | 'delete' | 'rcon' | 'manage_users';
```
- Pros: More granular (can grant control without RCON)
- Cons: Extra permission type, migration needed, more complexity
- Use case: "User can restart servers but not kick players"

**C. RCON Requires 'delete' Permission**
- Pros: RCON treated as high-privilege operation
- Cons: Doesn't match mental model (RCON isn't destructive like delete)

**Recommendation:** Option A (use 'control' permission) for MVP, can add Option B later if needed

---

## Finding 7: WebSocket Authentication Challenge

**Current:** WebSocket endpoints use query parameter for password
```typescript
// manager/src/routes/agents.ts line 532
const password = c.req.query('password');
if (!password || password !== c.env.ADMIN_PASSWORD) {
  return c.json({ error: 'Invalid or missing password' }, 401);
}
```

**Problem:** WebSocket upgrade requests don't support Authorization header in browser

**Solutions:**

**A. JWT in Query Parameter (Simplest)**
```typescript
GET /api/agents/:id/logs/ws?token=<jwt>

// In handler:
const token = c.req.query('token');
const payload = await verifySessionToken(token, c.env.TOKEN_SECRET);
// Then check permissions
```
- Pros: Works in browser, simple
- Cons: Token visible in URL (browser history, logs)
- Security: Tokens are short-lived (7 days), can be revoked

**B. JWT in Sec-WebSocket-Protocol Header**
```typescript
// Frontend:
new WebSocket(url, ['access_token', jwt]);

// Backend:
const protocols = c.req.header('Sec-WebSocket-Protocol');
const token = protocols?.split(',')[1]?.trim();
```
- Pros: Not in URL
- Cons: More complex, requires protocol negotiation

**Recommendation:** Option A (token in query param) for simplicity, already have short-lived tokens

---

## Finding 8: Audit Logging Gaps

**Currently Logged:**
- User login/logout (auth.ts)
- User management (users.ts)
- Permission grants/revokes (permissions.ts)
- Server start/stop/delete (agents.ts lines 944, 1111, 1309)

**NOT Currently Logged:**
- Container restarts (no audit call)
- Server rebuilds (no audit call)
- Port checks (no audit call)
- Log viewing (not tracked)
- RCON commands (not tracked)

**Proposed Additions:**
```typescript
// Server operations
logServerRestarted(db, c, userId, serverId);
logServerRebuilt(db, c, userId, serverId);

// RCON operations
logRconCommand(db, c, userId, serverId, command);

// Optional: Log viewing (could be noisy)
logServerViewed(db, c, userId, serverId);  // On log stream start
```

---

## Finding 9: Frontend Auth State

**Current Implementation:**
```typescript
// frontend/src/contexts/UserContext.tsx
- Stores JWT token in localStorage
- Provides login(), logout(), user state
- Auto-loads on mount
- 401 errors trigger logout

// frontend/src/lib/api.ts
- getAuthHeaders() reads token from localStorage
- All API calls use Authorization: Bearer <token>
```

**Works Well For:**
- HTTP endpoints (agents, servers, users, permissions)

**Needs Updates For:**
- WebSocket connections (logs, RCON)
- Currently use password query param
- Need to pass token instead

**Update Needed:**
```typescript
// frontend/src/hooks/useLogStream.ts
// Current:
const wsUrl = `${protocol}//${wsHost}/api/agents/${agentId}/logs/ws?password=${encodeURIComponent(adminPassword)}`;

// Proposed:
const token = getToken();
const wsUrl = `${protocol}//${wsHost}/api/agents/${agentId}/logs/ws?token=${encodeURIComponent(token)}`;
```

---

## Finding 10: Migration Strategy

**Approach:** Incremental migration (not all-at-once)

**Phase 1: Architectural Decisions** (User Input Required)
- Decide on role model (2 roles vs 4 roles)
- Decide on permission hierarchy (implement or keep independent)
- Decide on agent-level permission UI (add or skip)
- Decide on server creation permission (admin-only or new permission)
- Decide on RCON permission model (use control or separate)

**Phase 2: Backend Auth Migration**
1. Update endpoints one-by-one to use requireAuth()
2. Add permission checks (canViewServer, canControlServer)
3. Update WebSocket handlers to use JWT
4. Add missing audit log calls

**Phase 3: Permission System Enhancement**
- Implement permission hierarchy (if approved)
- Add agent-level permission endpoints (if approved)
- Add create permission type (if approved)

**Phase 4: Frontend Updates**
- Update WebSocket connections to use JWT
- Remove password prompts
- Update UI if role model changes

**Phase 5: Testing**
- Test all permission scenarios
- Test with non-admin users
- Verify audit logs

---

## Architectural Recommendations Summary

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **Role Model** | Keep 2 roles (admin/user) | Maximum flexibility, fewer migrations |
| **Permission Hierarchy** | Implement (delete ⊃ control ⊃ view) | More intuitive, fewer grants |
| **Agent-Level Permissions** | Add UI | Useful for multi-server management |
| **Server Creation** | Admin-only for now | Simpler, add quotas later |
| **RCON Permission** | Use 'control' permission | Intuitive, matches operational control |
| **WebSocket Auth** | JWT in query param | Simplest, works in browser |

---

## Finding 11: Code Quality Issues in agents.ts (Phase 3)

**Discovery:** During Phase 3 migration, found duplicate route definition and potential issues.

**Issue 1: Duplicate Route - DELETE /servers/failed**

Two identical route handlers exist for bulk cleanup of failed servers:

```typescript
// Line 1218 - CORRECT (with leading slash)
agents.delete('/:id/servers/failed', async (c) => { ... });

// Line 1677 - DUPLICATE (missing leading slash - may not work correctly)
agents.delete(':id/servers/failed', async (c) => { ... });
```

**Impact:**
- Route at line 1677 has incorrect path syntax (missing `/`)
- May not match requests properly
- Code duplication increases maintenance burden

**Recommendation:**
- Remove duplicate route at line 1677
- Keep route at line 1218 (correct path syntax)

**Issue 2: Generic Container Endpoints**

Found endpoints that operate on containers generically (not server-specific):
- POST /api/agents/:id/containers/:containerId/start (line 353)
- POST /api/agents/:id/containers/:containerId/stop (line 401)
- POST /api/agents/:id/containers/:containerId/restart (line 454)

**Current Permission Logic:**
- Start: Admin-only (line 358)
- Stop/Restart: Uses `canControlServer()` via container→server lookup

**Inconsistency:**
- Why is generic start admin-only, but stop/restart use server permissions?
- Should all three use the same permission model

**Recommendation:**
- Review if generic container endpoints are needed
- If yes: Make permission model consistent (all use server lookup)
- If no: Remove generic endpoints, use server-specific routes only

---

## FINAL ARCHITECTURAL DECISION (User Confirmed)

After discussion with user and review of ARCHITECTURE.md original design, implementing:

### 4-Role Model with Multi-Scope Assignments

**Roles:**
1. **admin** - System role (global only, bypasses all checks)
   - Full system access
   - Invite users, manage all agents/servers
   - View all audit logs

2. **agent-admin** - Assignment role (agent-scope only)
   - Full control of assigned agent
   - Can create/delete servers on that agent
   - All operator capabilities for servers on that agent
   - Can manage agent settings

3. **operator** - Assignment role (global, agent, or server scope)
   - Start/stop/restart servers
   - Change server config
   - Use RCON console
   - View logs

4. **viewer** - Assignment role (global, agent, or server scope)
   - View server status
   - View logs (read-only)
   - No control operations

**NULL System Role:**
- Users can be created WITHOUT any system role
- These users see "Please ask an admin for access" until assigned roles
- Access granted via role_assignments table

**Role Assignment Scopes:**
- **global**: Role applies to all agents/servers (rare, mainly for shared users)
- **agent**: Role applies to all servers on that agent (inheritance)
- **server**: Role applies to specific server only (override)

**Inheritance & Override:**
```
User Alice (no system role):
1. Assigned viewer on agent-1, agent-2
   → Can view ALL servers on those 2 agents

2. Then assigned operator on server-X (in agent-1)
   → Now has operator on server-X, viewer on other agent-1 servers

3. Then assigned operator on server-Y (in agent-2)
   → Now has operator on server-Y, viewer on other agent-2 servers

4. Agents 3-4: No access (no assignment)
```

**Permission Hierarchy (Capability Levels):**
```
admin > agent-admin > operator > viewer

Within scope:
- agent-admin includes all operator capabilities for their agent
- operator implies viewer (can view what they control)
- viewer is standalone (read-only)
```

**Database Schema Changes:**
```sql
-- Users table: role can be NULL or 'admin'
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin') OR role IS NULL),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Role assignments for non-admin users
CREATE TABLE role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('agent-admin', 'operator', 'viewer')),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'agent', 'server')),
  resource_id TEXT, -- NULL for global, agent_id or server_id
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (role != 'agent-admin' OR scope = 'agent'),
  UNIQUE (user_id, scope, resource_id, role)
);
```

**Migration Path:**
1. Drop old `permissions` table
2. Create new `role_assignments` table
3. Migrate existing user roles to system admin or NULL
4. No data migration for permissions (fresh start)

---

## Open Questions for User

Before proceeding with implementation, user must decide:

1. ✅ Role model: **4 roles (admin/agent-admin/operator/viewer) with NULL option**
2. ✅ Permission hierarchy: **Implement (operator ⊃ viewer)**
3. ✅ Agent-level permissions UI: **Add UI for role assignments**
4. ✅ Server creation: **Agent-admin can create, others admin-only**
5. ✅ RCON permission: **Use operator role**

User answers will determine which phases to implement.

---

## Finding 11: 🚨 Agent List Endpoint Blocks Non-Admin Users (CRITICAL)

**Date Discovered:** 2026-01-12 (Phase 5 Frontend Updates)

**Issue:**
The `GET /api/agents` endpoint is hardcoded to admin-only, which prevents non-admin users from navigating the system even with valid role assignments.

**Location:**
```typescript
// manager/src/routes/agents.ts:39-44
agents.get('/', async (c) => {
  const user = c.get('user');

  // Only admins can list all agents
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }
```

**Impact:**
- **Severity:** 🔴 CRITICAL - Completely blocks non-admin users
- When a non-admin user logs in, the frontend AgentList component calls `GET /api/agents`
- Backend returns 403 Forbidden
- User sees error page with "Error: Forbidden - requires admin role"
- User cannot access ANY servers, even with valid role assignments
- Makes the entire RBAC system non-functional for non-admin users

**Root Cause:**
The endpoint was designed for admin-only agent management. The RBAC implementation added role assignments for servers but didn't update the agent list endpoint to filter agents based on user's accessible servers.

**Solution:**
Modify `GET /api/agents` to return filtered agent list for non-admin users:

```typescript
agents.get('/', async (c) => {
  const user = c.get('user');

  if (user.role === 'admin') {
    // Admins see all agents (existing behavior)
    const result = await c.env.DB.prepare('SELECT * FROM agents').all();
    return c.json({ success: true, agents: result.results });
  }

  // Non-admins: Return only agents where user has role assignments
  const assignments = await getUserRoleAssignments(c.env.DB, user.id);

  const agentIds = new Set<string>();

  for (const assignment of assignments) {
    if (assignment.scope === 'global') {
      // Global access: return all agents
      const result = await c.env.DB.prepare('SELECT * FROM agents').all();
      return c.json({ success: true, agents: result.results });
    }

    if (assignment.scope === 'agent' && assignment.resource_id) {
      agentIds.add(assignment.resource_id);
    }

    if (assignment.scope === 'server' && assignment.resource_id) {
      // Find which agent this server belongs to
      const server = await c.env.DB.prepare(
        'SELECT agent_id FROM servers WHERE id = ?'
      ).bind(assignment.resource_id).first<{ agent_id: string }>();
      if (server) {
        agentIds.add(server.agent_id);
      }
    }
  }

  if (agentIds.size === 0) {
    return c.json({ success: true, agents: [] });
  }

  // Return only agents user has access to
  const placeholders = Array.from(agentIds).map(() => '?').join(',');
  const agents = await c.env.DB.prepare(
    `SELECT * FROM agents WHERE id IN (${placeholders})`
  ).bind(...Array.from(agentIds)).all();

  return c.json({ success: true, agents: agents.results });
});
```

**Logic:**
1. Admin users → Return all agents (no change)
2. Users with global role assignments → Return all agents
3. Users with agent-scope assignments → Return those specific agents
4. Users with server-scope assignments → Return agents that contain those servers
5. Users with no assignments → Return empty array

**Files to Modify:**
- `manager/src/routes/agents.ts` (lines 39-88)

**Priority:** 🔴 CRITICAL - Must be implemented before Phase 5 can be considered complete

**Testing Required:**
1. Create test user with NULL system role
2. Grant operator role at agent scope
3. Login as test user
4. Verify: Can see agent list (only assigned agents)
5. Verify: Can navigate to servers on assigned agents
6. Verify: Cannot see non-assigned agents

**Status:** ✅ RESOLVED - Implemented agent filtering logic

**Implementation Details:**
- Modified `manager/src/routes/agents.ts` (lines 11-119)
- Admin users: Return all agents (no change)
- Non-admin users: Filter by role assignments
  - Global scope → all agents
  - Agent scope → specific agents
  - Server scope → agents containing those servers
  - No assignments → empty list
- Uses `getUserRoleAssignments()` to check user's access
- Returns filtered list without errors

**Date Resolved:** 2026-01-12 (Phase 5 completion)

---

## Finding 12: 🐛 Audit Logging Functions Not Called (Phase 6)

**Date Discovered:** 2026-01-12 Evening (Phase 6 review)

**User Report:**
> "I feel audit logs is not completed"

**Investigation:**
User requested verification of audit logging implementation. Upon inspection:

**What Existed:**
- ✅ Audit log functions defined in `manager/src/lib/audit.ts`:
  - `logServerOperation()` - Generic server operation logger
  - `logServerCreated()` - Server creation
  - `logRconCommand()` - RCON command execution
  - `logRoleAssignmentGranted/Revoked()` - Role management

**What Was Missing:**
- ❌ NO audit log calls in any server operation endpoints
- ❌ NO audit log calls in RCON handler
- ❌ Functions existed but were never invoked

**Endpoints Missing Audit Logs:**
```typescript
// manager/src/routes/agents.ts
POST   /api/agents/:id/servers                    - Server creation (no log)
POST   /api/agents/:id/servers/:serverId/start    - Server start (no log)
POST   /api/agents/:id/servers/:serverId/stop     - Server stop (no log)
POST   /api/agents/:id/containers/:containerId/restart - Restart (no log)
POST   /api/agents/:id/servers/:serverId/rebuild  - Rebuild (no log)
DELETE /api/agents/:id/servers/:serverId          - Soft delete (no log)
DELETE /api/agents/:id/servers/:serverId/purge    - Hard delete (no log)
POST   /api/agents/:id/servers/:serverId/restore  - Restore (no log)

// manager/src/durable-objects/AgentConnection.ts
rcon.command - RCON command execution (no log)
```

**Impact:**
- No audit trail for server operations
- Compliance/security issue - can't track who did what
- No forensics if issues occur

**Resolution:**

### 1. Added Audit Logging to All Server Operations

**File:** `manager/src/routes/agents.ts`

Added `logServerOperation()` or `logServerCreated()` calls after each operation:

```typescript
// Server creation
await logServerCreated(c.env.DB, c, user.id, serverId, body.name, agentId);

// Server start (both normal start and container recreation)
await logServerOperation(c.env.DB, c, user.id, 'server.started', serverId, server.name as string, agentId);

// Server stop
await logServerOperation(c.env.DB, c, user.id, 'server.stopped', serverId, server.name as string, agentId);

// Server restart
if (response.ok) {
  await logServerOperation(c.env.DB, c, user.id, 'server.restarted', server.id, server.name, agentId);
}

// Server rebuild
await logServerOperation(c.env.DB, c, user.id, 'server.rebuilt', serverId, server.name as string, agentId);

// Server delete (soft delete)
await logServerOperation(c.env.DB, c, user.id, 'server.deleted', serverId, serverName?.name || 'unknown', agentId);

// Server purge (hard delete)
await logServerOperation(c.env.DB, c, user.id, 'server.purged', serverId, server.name as string, agentId);

// Server restore
await logServerOperation(c.env.DB, c, user.id, 'server.restored', serverId, server.name as string, agentId);
```

### 2. Added RCON Command Audit Logging

**Challenge:** RCON commands execute in a Durable Object via WebSocket, which doesn't have access to user context.

**Solution:**
1. Modified WebSocket upgrade in `agents.ts` to pass user ID via header:
   ```typescript
   const headers = new Headers(c.req.raw.headers);
   headers.set('X-User-Id', session.user_id);
   const modifiedRequest = new Request(c.req.raw, { headers });
   ```

2. Added user tracking in Durable Object:
   ```typescript
   // AgentConnection.ts
   private uiWebSockets: Map<WebSocket, string> = new Map(); // WebSocket -> userId

   // On WebSocket upgrade
   const userId = request.headers.get("X-User-Id") || undefined;
   if (userId) {
     this.uiWebSockets.set(server, userId);
   }
   ```

3. Added audit logging in RCON handler:
   ```typescript
   // After successful RCON command
   if (message.subject === "rcon.command" && reply.data.success) {
     const userId = this.uiWebSockets.get(ws);
     const session = this.rconSessions.get(sessionId);

     if (session && userId) {
       const server = await this.env.DB.prepare(
         'SELECT name FROM servers WHERE id = ?'
       ).bind(session.serverId).first();

       await logRconCommand(
         this.env.DB,
         mockContext,
         userId,
         session.serverId,
         server.name,
         command
       );
     }
   }
   ```

### 3. Missing Audit Logs API Endpoint

**Discovery:** Frontend has `AuditLogViewer.tsx` component but backend endpoint `/api/audit` didn't exist.

**Error:**
```
GET /api/audit?page=1&pageSize=50 - 404 Not Found
```

**Solution:**
Created `manager/src/routes/audit.ts`:
- GET /api/audit - Paginated audit log retrieval
- Filtering by: user, action, resource type, date range
- Joins users table to show email instead of user_id
- Admin-only access (for now)

**Bug Found During Implementation:**
```typescript
// WRONG:
audit.get('/', requireAuth, async (c) => { ... });

// CORRECT:
audit.get('/', requireAuth(), async (c) => { ... });
```

Issue: `requireAuth` is a function that **returns** middleware, so it must be called with `()`.

**Error Symptoms:**
- Worker threw exception (Error 1101)
- Uncaught error crash instead of proper 401/403 responses

**Resolution:**
- Fixed function call
- Deployed successfully
- Audit logs API now working

**Files Modified:**
- `manager/src/routes/agents.ts` - Added 8 audit log calls
- `manager/src/durable-objects/AgentConnection.ts` - Added RCON logging + user tracking
- `manager/src/types/LogMessage.ts` - Added userId to LogSubscriber interface
- `manager/src/routes/audit.ts` - NEW: Audit logs API endpoint
- `manager/src/index.ts` - Mounted `/api/audit` route

**Deployments:**
- v e0c28d15: Audit logging implementation
- v 8fe08055: Audit API endpoint
- v ca34b87c: Debug logging
- v ec6c7e02: Test endpoint
- v 1dd14f00: Ping endpoint
- v 0c83e320: Fixed requireAuth() bug ✅

**Status:** ✅ RESOLVED

**Date Resolved:** 2026-01-12 Evening (Phase 6 completion)

**Verification:**
- All server operations create audit_logs entries
- RCON commands logged with user attribution
- Frontend AuditLogViewer displays logs correctly
- Pagination and filtering working

---
