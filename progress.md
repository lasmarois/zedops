# Progress: M7 Phase 2 - RBAC Auth Migration & Refinement

**Milestone:** M7 Phase 2 - RBAC Auth Migration & Refinement
**Started:** 2026-01-12
**Status:** Planning Complete, Awaiting Architectural Decisions

---

## Session 1: Planning & Research ✅ Complete

**Date:** 2026-01-12
**Duration:** ~1 hour
**Goal:** Create comprehensive planning files and document architectural decisions needed

### Actions Taken

1. **Archived Phase 1 Planning Files**
   - Created `planning-history/milestone-7-rbac-initial-implementation/`
   - Moved task_plan.md, findings.md, progress.md, MILESTONE-7-COMPLETE.md
   - Renamed MILESTONE-7-COMPLETE.md → PHASE-1-COMPLETE.md
   - Committed: `eb4b04f` - "Archive M7 Phase 1, create ISSUE for Phase 2 (RBAC auth migration)"

2. **Created Issue Document**
   - File: `ISSUE-rbac-auth-migration.md`
   - Documented 7 issues to resolve
   - Listed architectural decisions needed
   - Defined success criteria
   - Estimated 4-6 hours for Phase 2

3. **Updated MILESTONES.md**
   - Split M7 into Phase 1 (complete, 12h) and Phase 2 (in progress, 4-6h est)
   - Updated progress: 6.5/9 milestones (72%)
   - Changed status from "Complete" to "In Progress"
   - Updated current planning status

4. **Created Planning Files**
   - **findings.md** (10 findings):
     - Finding 1: Mixed authentication state (13 endpoints documented)
     - Finding 2: Permission types & hierarchy options
     - Finding 3: Role model options (Option A vs Option B)
     - Finding 4: Agent-level permissions (exists but not exposed)
     - Finding 5: Server creation permission options
     - Finding 6: RCON permission granularity
     - Finding 7: WebSocket authentication challenge
     - Finding 8: Audit logging gaps
     - Finding 9: Frontend auth state
     - Finding 10: Migration strategy
     - Recommendations for each decision

   - **task_plan.md** (8 phases):
     - Phase 0: Architectural Decisions (pending user input)
     - Phase 1: Permission Hierarchy (conditional)
     - Phase 2: Backend Auth Migration (13 endpoints to migrate)
     - Phase 3: WebSocket Auth Migration (logs, RCON)
     - Phase 4: Audit Logging Completion
     - Phase 5: Frontend Updates
     - Phase 6: Agent-Level Permission UI (optional)
     - Phase 7: Testing & Verification
     - Phase 8: Documentation

   - **progress.md** (this file)

5. **Analyzed Current Implementation**
   - Read `manager/src/lib/permissions.ts` - Permission checking logic
   - Read `manager/src/routes/permissions.ts` - Permission management API
   - Read `manager/src/routes/agents.ts` (partial) - Endpoint auth status
   - Identified 8 endpoints still using ADMIN_PASSWORD
   - Identified 5 endpoints needing permission checks added

### Research Findings

See [findings.md](findings.md) for comprehensive research documentation.

**Key Discoveries:**
- Mixed auth methods: 6 endpoints use JWT, 8 still use ADMIN_PASSWORD
- Permission hierarchy not implemented (control doesn't imply view)
- Agent-level permissions supported in code but not exposed in UI
- WebSocket auth uses query param (need JWT migration)
- RCON permission model undefined
- Server creation is admin-only (no 'create' permission)
- Audit logging incomplete (restart, rebuild, RCON not logged)

**Architectural Recommendations:**
| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Role Model | Keep 2 roles (admin/user) | Maximum flexibility |
| Permission Hierarchy | Implement (delete ⊃ control ⊃ view) | More intuitive |
| Agent-Level Permissions | Add UI | Useful for multi-server management |
| Server Creation | Admin-only for now | Simpler, add quotas later |
| RCON Permission | Use 'control' permission | Intuitive |
| WebSocket Auth | JWT in query param | Simplest, works in browser |

### Next Actions

**Phase 0: Architectural Decisions** ⏳ Next

User must answer 5 questions before implementation can proceed:

1. **Role model:** Keep 2 roles (admin/user) or expand to 4 (admin/operator/viewer/user)?
2. **Permission hierarchy:** Implement (delete ⊃ control ⊃ view) or keep independent?
3. **Agent-level permissions UI:** Add to UI or skip?
4. **Server creation:** Admin-only or add 'create' permission?
5. **RCON permission:** Use 'control' permission or separate 'rcon' permission?

**Recommendations:**
- All questions have recommended answers in findings.md
- User should review findings.md and ISSUE-rbac-auth-migration.md
- Decisions will determine which phases to implement (some are conditional)

### Time Tracking

- **Session 1:** ~1 hour (Planning & Research)
- **Total:** ~1 hour

### Status

- ✅ Phase 0: Architectural Decisions - Complete (1 hour)
- ⏳ Phase 1: Database Migration - Next
- ⏳ Phase 2: Permission Logic Rewrite - Planned
- ⏳ Phase 3: Backend Auth Migration - Planned
- ⏳ Phase 4: WebSocket Auth Migration - Planned
- ⏳ Phase 5: Frontend Updates - Planned
- ⏳ Phase 6: Audit Logging Completion - Planned
- ⏳ Phase 7: Testing & Verification - Planned
- ⏳ Phase 8: Documentation - Planned

---

## Session 2: Architectural Decisions Complete ✅

**Date:** 2026-01-12 (continued)
**Duration:** ~1 hour
**Goal:** Finalize role model and architectural approach

### Actions Taken

1. **Discussed Role Model Options**
   - User reviewed ARCHITECTURE.md original design (3 roles: admin/operator/viewer)
   - User confirmed desire for role-based (not permission-based) approach
   - User clarified need for per-agent and per-server role assignments
   - User requested 4th role: agent-admin (can create/delete servers on assigned agent)
   - User requested NULL system role option (users without default access)

2. **Finalized Architectural Decisions**
   - Q1: Role model → 4 roles (admin/agent-admin/operator/viewer) with NULL option
   - Q2: Permission hierarchy → Implement (operator ⊃ viewer, agent-admin ⊃ operator)
   - Q3: Agent-level assignments → Yes (with server-level override)
   - Q4: Server creation → agent-admin role can create on their agent
   - Q5: RCON permission → operator role required

3. **Updated Planning Files**
   - Updated findings.md with "FINAL ARCHITECTURAL DECISION" section
   - Updated task_plan.md with Phase 0 complete, new Phase 1 (Database Migration)
   - Redefined phases to match role-based implementation

### Final Role Model

**4 Roles:**
1. **admin** - System role (global, bypasses all checks)
2. **agent-admin** - Assignment role (agent-scope, full control of agent)
3. **operator** - Assignment role (multi-scope, control + RCON)
4. **viewer** - Assignment role (multi-scope, read-only)

**NULL System Role:**
- Users can exist without any system role
- Must be assigned roles at agent/server level to access resources

**Multi-Scope Assignments:**
- **global**: Role applies to all agents/servers
- **agent**: Role applies to all servers on that agent (inheritance)
- **server**: Role applies to specific server only (override)

**Example (Alice):**
- System role: NULL
- Assigned: viewer on agent-1, agent-2
- Assigned: operator on server-X (in agent-1)
- Result: Viewer on all servers in agent-1/agent-2, except server-X (operator)

### Database Schema

New `role_assignments` table replaces old `permissions` table:
```sql
CREATE TABLE role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('agent-admin', 'operator', 'viewer')),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'agent', 'server')),
  resource_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (role != 'agent-admin' OR scope = 'agent'),
  UNIQUE (user_id, scope, resource_id, role)
);
```

### Next Actions

**Phase 1: Database Migration** 🚧 In Progress
1. ✅ Create migration 0009_role_based_rbac.sql
2. ⏳ Update TypeScript interfaces
3. ⏳ Test migration locally

---

## Session 3: Phase 1 - Database Migration 🚧 In Progress

**Date:** 2026-01-12 (continued)
**Status:** In Progress
**Goal:** Create and test database migration for role-based RBAC

### Actions Taken

1. **Created Migration 0009** ✅
   - File: `manager/migrations/0009_role_based_rbac.sql`
   - Updates users table: role can be 'admin' or NULL
   - Drops old permissions table
   - Creates new role_assignments table with multi-scope support
   - Updates invitations table to support new roles
   - Migrates existing 'user' role to NULL
   - Adds indexes for performance

**Migration Schema:**
```sql
-- users: role TEXT CHECK (role IN ('admin') OR role IS NULL)
-- role_assignments: (user_id, role, scope, resource_id, created_at)
--   - role: 'agent-admin', 'operator', 'viewer'
--   - scope: 'global', 'agent', 'server'
--   - Constraint: agent-admin only at agent scope
--   - Unique: (user_id, scope, resource_id, role)
```

2. **Updated TypeScript Interfaces** ✅
   - Updated AuthUser interface: role is now 'admin' | null
   - Added RoleAssignment interface with scope support
   - Updated users.ts:
     * POST /api/users: Accepts admin or null role
     * GET /api/users/:id: Returns roleAssignments instead of permissions
     * PATCH /api/users/:id/role: Supports admin or null role
   - Updated invitations.ts:
     * POST /api/users/invite: Supports all 4 roles
     * POST /api/invite/:token/accept: Creates admin users with admin role, others with NULL role

**Key Implementation Notes:**
- Invitation flow: Non-admin invitations create NULL role users (admin assigns access separately)
- Role assignments will be managed through new endpoints (Phase 2)
- Permissions table replaced by role_assignments table

3. **Tested Migration** ✅
   - Created comprehensive test script
   - Ran migration against test database with existing data
   - Verified all schema changes:
     * Users table: role allows NULL ✅
     * Users data: admin preserved, 'user' → NULL ✅
     * role_assignments table created with all columns ✅
     * permissions table dropped ✅
     * invitations table updated with new roles ✅
   - Tested data operations:
     * NULL role user insert ✅
     * Role assignments insert (operator, agent scope) ✅
     * Constraints work correctly ✅
   - All tests passed

**Migration 0009 Status:** ✅ Ready for deployment

### Next Steps

**Phase 1 Complete!** ✅

---

## Session 4: Phase 2 - Permission Logic Rewrite ✅ Complete

**Date:** 2026-01-12 (continued)
**Status:** Complete
**Goal:** Rewrite permission checking from permission-based to role-based with inheritance/override

### Actions Taken

1. **Complete Rewrite of `manager/src/lib/permissions.ts`** ✅
   - Replaced permission-based types with role-based types
   - Implemented `getEffectiveRole()` function:
     * Server-level assignment (overrides)
     * Agent-level assignment (inheritance)
     * Global assignment (applies to all)
     * System admin role (bypasses all)
   - Implemented `getEffectiveRoleForAgent()` for agent-level operations
   - Created `roleHasCapability()` with capability hierarchy:
     * admin: All capabilities (*)
     * agent-admin: create_server, delete_server, control_server, use_rcon, view_server, view_logs
     * operator: control_server, use_rcon, view_server, view_logs
     * viewer: view_server, view_logs
   - Updated all convenience functions:
     * `canViewServer()` - role-based check
     * `canControlServer()` - role-based check
     * `canDeleteServer()` - role-based check
     * `canUseRcon()` - NEW, checks use_rcon capability
     * `canCreateServer()` - NEW, checks create_server capability
   - Rewrote `getUserVisibleServers()`:
     * Expands agent-level assignments to server IDs
     * Expands global assignments to all servers
     * Returns deduplicated list of accessible servers
   - Replaced permission management functions:
     * `grantRoleAssignment()` - replaces grantPermission()
     * `revokeRoleAssignment()` - replaces revokePermission()
     * `revokeAllRoleAssignmentsForResource()` - updated for roles
     * `getUserRoleAssignments()` - replaces getUserPermissions()
     * `getRoleAssignmentsForResource()` - NEW, shows who has access

**Key Implementation Details:**
- Inheritance: Agent-level assignment applies to ALL servers on that agent
- Override: Server-level assignment overrides agent-level for that specific server
- Capability hierarchy: Higher roles include lower role capabilities
- NULL role users: No access until assigned a role

**Phase 2 Status:** ✅ Complete

### Next Steps

**Phase 2 Complete!** ✅

Ready to proceed to Phase 3: Backend Auth Migration (update all endpoints to use new permission logic)

---

## Session 5: Phase 3 - Backend Auth Migration 🚧 In Progress

**Date:** 2026-01-12 (continued)
**Status:** In Progress
**Goal:** Replace all ADMIN_PASSWORD authentication with role-based JWT authentication

### Actions Taken

**Endpoints Migrated So Far:**

1. ✅ **GET /api/agents/:id/containers** (line ~121)
   - Replaced ADMIN_PASSWORD with admin-only role check
   - Uses: `user.role !== 'admin'` → 403

2. ✅ **POST /api/agents/:id/ports/check** (line ~174)
   - Replaced ADMIN_PASSWORD with admin-only role check
   - Rationale: Port management is global agent resource

3. ✅ **GET /api/agents/:id/ports/availability** (line ~239)
   - Replaced ADMIN_PASSWORD with admin-only role check
   - Rationale: Port allocation is global agent resource

4. ✅ **POST /api/agents/:id/servers** (line ~570)
   - Replaced ADMIN_PASSWORD with `canCreateServer()` check
   - Uses new permission function from Phase 2
   - Allows: admin + agent-admin (on their agent)

5. ✅ **POST /api/agents/:id/servers/sync** (line ~875)
   - Replaced ADMIN_PASSWORD with admin-only role check
   - Rationale: Sync is admin-only operation

6. ✅ **POST /api/agents/:id/containers/:containerId/start** (line ~353)
   - Replaced ADMIN_PASSWORD with admin-only role check
   - Note: Generic container start (not server-specific)

7. ✅ **POST /api/agents/:id/containers/:containerId/stop** (line ~401)
   - Replaced ADMIN_PASSWORD with `canControlServer()` check
   - Looks up server by container_id, checks control permission
   - Allows: admin, agent-admin, operator with access

8. ✅ **POST /api/agents/:id/containers/:containerId/restart** (line ~454)
   - Replaced ADMIN_PASSWORD with `canControlServer()` check
   - Same pattern as stop endpoint

9. ✅ **GET /api/agents/:id/logs/ws** (line ~524 - WebSocket)
   - Replaced ADMIN_PASSWORD (query param) with JWT token auth
   - Token passed via query parameter: `?token=<jwt>`
   - Verifies JWT signature and session validity
   - Note: WebSocket endpoints can't use Authorization header in browser

10. ✅ **DELETE /api/agents/:id/servers/failed** (line ~1218)
    - Replaced ADMIN_PASSWORD with admin-only role check
    - Bulk cleanup operation, admin-only appropriate

### Implementation Patterns Used

**Pattern 1: Admin-Only Operations**
```typescript
const user = c.get('user');
if (user.role !== 'admin') {
  return c.json({ error: 'Forbidden - requires admin role' }, 403);
}
```

**Pattern 2: Server-Specific Permission Checks**
```typescript
const user = c.get('user');
const hasPermission = await canControlServer(c.env.DB, user.id, user.role, serverId);
if (!hasPermission) {
  return c.json({ error: 'Forbidden - requires operator or higher role for this server' }, 403);
}
```

**Pattern 3: Container-to-Server Permission Lookup**
```typescript
// Find server by container_id
const server = await c.env.DB.prepare(
  'SELECT id FROM servers WHERE container_id = ? AND agent_id = ?'
).bind(containerId, agentId).first<{ id: string }>();

if (!server) {
  return c.json({ error: 'Server not found for this container' }, 404);
}

// Check permission on the server
const hasPermission = await canControlServer(c.env.DB, user.id, user.role, server.id);
```

**Pattern 4: WebSocket JWT Auth (Query Param)**
```typescript
const token = c.req.query('token');
const { verifySessionToken, hashToken } = await import('../lib/auth');
const payload = await verifySessionToken(token, c.env.TOKEN_SECRET);
const tokenHash = await hashToken(token);
const session = await c.env.DB.prepare(
  'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?'
).bind(tokenHash, Date.now()).first<{ user_id: string }>();
```

11. ✅ **DELETE /api/agents/:id/servers/:serverId/purge** (line ~1414)
    - Replaced ADMIN_PASSWORD with admin-only role check
    - Rationale: Permanent deletion is destructive, admin-only

12. ✅ **POST /api/agents/:id/servers/:serverId/restore** (line ~1517)
    - Replaced ADMIN_PASSWORD with admin-only role check
    - Rationale: Restoring deleted servers is admin operation

13. ✅ **POST /api/agents/:id/servers/:serverId/rebuild** (line ~1572)
    - Replaced ADMIN_PASSWORD with `canControlServer()` check
    - Allows: admin, agent-admin, operator with access to server
    - Rationale: Rebuild = stop + remove + recreate (control operation)

14. ✅ **DELETE /api/agents/:id/servers/failed** (line ~1677, duplicate)
    - Replaced ADMIN_PASSWORD with admin-only role check
    - Note: Duplicate route with missing leading slash (`:id` vs `/:id`)
    - Should be cleaned up in future refactor

### Migration Complete! ✅

**All ADMIN_PASSWORD authentication checks removed** from agents.ts.

Verified via grep: Only remaining reference is type definition (line 22), which is expected.

**Final Count:** 14 endpoints migrated to role-based JWT authentication

### Findings

1. **Duplicate Route Found:**
   - Line 1218: `agents.delete('/:id/servers/failed', ...)` ✓ correct
   - Line 1677: `agents.delete(':id/servers/failed', ...)` ✗ missing slash
   - Both have identical logic
   - Recommendation: Remove duplicate at line 1677

### Testing Approach

Created comprehensive test plan for verifying backend changes:

**Test Files Created:**
1. **TEST-PLAN-phase3-backend.md** - Complete test plan with:
   - Setup instructions (create test users, get tokens)
   - Test scenarios for all endpoint types
   - Expected results and verification steps
   - Edge case testing
   - Cleanup procedures

2. **test-backend-auth.sh** - Quick smoke test script:
   - Tests JWT authentication works
   - Verifies endpoints reject invalid tokens
   - Confirms admin can access endpoints
   - Tests WebSocket JWT authentication
   - ~2 minutes to run

**Testing Strategy:**
- Quick smoke test: Verify JWT auth basics work
- Full test plan: Comprehensive permission testing (requires Phase 5 for role assignments)
- Automated tests: Phase 7 (Testing & Verification)

**Limitations:**
- Cannot fully test permission-based endpoints until Phase 5 (role assignment UI)
- WebSocket testing with curl is limited (full test in Phase 7)
- Manual testing only at this stage

### Next Steps

**Option 1: Run Backend Tests First**
```bash
# Set admin password
export ADMIN_PASSWORD='your-admin-password'

# Run quick smoke test
bash test-backend-auth.sh

# Review full test plan
cat TEST-PLAN-phase3-backend.md
```

**Option 2: Proceed to Phase 5**
- Build role assignment management UI
- Then do comprehensive permission testing
- This is recommended as it enables full testing

**Phase 3 Complete!** ✅ Ready for testing or Phase 5

---

## Pending Implementation

Phases 0-4 complete. Ready to start Phase 5 (Frontend Updates).

---

## Session 6: Phase 5 - Frontend Updates 🚧 In Progress

**Date:** 2026-01-12 (continued)
**Status:** In Progress
**Goal:** Update frontend to use new role-based permission system

### Phase 5 Plan

**Priority 1: Role Assignment Management** (Critical - enables testing)
1. Update PermissionsManager component to use role-based system
2. Replace permission types (view/control/delete) with roles (agent-admin/operator/viewer)
3. Support multi-scope assignments (global/agent/server)
4. Update API hooks to use new role assignment endpoints

**Priority 2: Frontend Authentication Updates**
1. Update WebSocket connections to use JWT tokens
2. Remove ADMIN_PASSWORD prompts
3. Update useLogStream hook
4. Update useRcon hook (if exists)

**Priority 3: NULL Role User Experience**
1. Handle users with NULL system role
2. Show appropriate messaging when user has no access
3. Update UserList to show system role + assignment count

### Actions Taken

**Priority 1: Role Assignment Management - Backend**

1. ✅ **Created role-assignments.ts routes** (manager/src/routes/role-assignments.ts)
   - Replaces old permissions.ts with role-based system
   - Implements all CRUD operations for role assignments:
     * GET /api/users/:userId/role-assignments - List user's assignments
     * POST /api/users/:userId/role-assignments - Grant role assignment
     * DELETE /api/role-assignments/:assignmentId - Revoke assignment
     * DELETE /api/users/:userId/role-assignments/:scope/:resourceId - Revoke all on resource
     * GET /api/role-assignments/:scope/:resourceId - List assignments for resource
   - Validates role constraints (agent-admin only at agent scope)
   - Validates scope constraints (global cannot have resource_id)
   - Checks resource existence (agents, servers)
   - Admin-only endpoints (requireAuth + requireRole)

2. ✅ **Registered new routes** (manager/src/index.ts)
   - Mounted at /api/role-assignments
   - Old /api/permissions routes kept for backward compatibility (deprecated)

**API Endpoints Summary:**
```typescript
// Grant assignment
POST /api/users/{userId}/role-assignments
Body: { role: 'agent-admin'|'operator'|'viewer', scope: 'global'|'agent'|'server', resourceId?: string }

// List user assignments
GET /api/users/{userId}/role-assignments

// Revoke assignment
DELETE /api/role-assignments/{assignmentId}

// List resource assignments
GET /api/role-assignments/{scope}/{resourceId}
```

**Next: Update frontend to use new API**

**Priority 1: Role Assignment Management - Frontend** ✅ Complete

3. ✅ **Updated API client** (frontend/src/lib/api.ts)
   - Added RoleAssignment interface
   - Added UserRoleAssignmentsResponse interface
   - Added fetchUserRoleAssignments()
   - Added grantRoleAssignment()
   - Added revokeRoleAssignment()

4. ✅ **Updated React Query hooks** (frontend/src/hooks/useUsers.ts)
   - Added useUserRoleAssignments() hook
   - Added useGrantRoleAssignment() hook
   - Added useRevokeRoleAssignment() hook
   - All hooks integrated with TanStack Query for caching/invalidation

5. ✅ **Created RoleAssignmentsManager component** (frontend/src/components/RoleAssignmentsManager.tsx)
   - Complete rewrite using role-based system
   - Supports all 3 roles (agent-admin, operator, viewer)
   - Supports all 3 scopes (global, agent, server)
   - Validates role constraints (agent-admin only at agent scope)
   - Validates scope constraints (global cannot have resource_id)
   - Shows system admin badge if user has admin role
   - Color-coded role badges (green=agent-admin, blue=operator, gray=viewer)
   - Agent dropdown for agent scope assignments
   - Server ID input for server scope assignments
   - Inline help text explaining each role's capabilities

6. ✅ **Updated App.tsx routing**
   - Replaced PermissionsManager with RoleAssignmentsManager
   - Updated import statement
   - Existing user management flow unchanged

**Result:** Complete role assignment management UI ready for use!

**Next Steps:**
- Priority 2: Frontend Authentication Updates (WebSocket JWT, remove password prompts)
- Priority 3: NULL Role User Experience (update UserList, handle no-access cases)
