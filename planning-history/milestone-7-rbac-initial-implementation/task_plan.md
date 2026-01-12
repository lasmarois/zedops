# Task Plan: Milestone 7 - RBAC & Audit Logs

**Goal:** Role-based access control and comprehensive audit logging

**Duration:** 2 weeks (estimated)

**Success Criteria:**
- Admin can invite users with specific roles (Admin, Operator, Viewer)
- Operator can control assigned servers but not delete
- Viewer can view assigned server logs but not control
- All actions logged in D1 with timestamps and user attribution
- Login/logout flow with JWT sessions
- Audit log viewer in UI (admin only)

**Status:** ✅ Complete
**Started:** 2026-01-12
**Completed:** 2026-01-12

---

## Phase Overview

| Phase | Status | Description |
|-------|--------|-------------|
| 0. Research & Database Design | ✅ complete | Analyze current auth, design schema, document findings |
| 1. Database Migrations | ✅ complete | Create users, sessions, permissions, audit_logs, invitations tables |
| 2. Backend Auth System | ✅ complete | JWT session tokens, password hashing, auth middleware |
| 3. User Management API | ✅ complete | Invite, list, delete users; role management |
| 4. Permission System | ✅ complete | Permission checks on all endpoints, RBAC enforcement |
| 5. Audit Logging | ✅ complete | Log all actions to audit_logs table |
| 6. Frontend Auth UI | ✅ complete | Login form, user context, logout, session management |
| 7. User Management UI | ✅ complete | User list, invite modal, role editor (admin only) |
| 8. Audit Log Viewer | ✅ complete | Paginated log table with filters (admin only) |
| 9. Testing & Deployment | ✅ complete | End-to-end testing, bootstrap admin creation, production deployment |

---

## Phase 0: Research & Database Design ✅ Complete

**Status:** ✅ complete

**Goals:**
- Understand current authentication system
- Design RBAC schema
- Design audit log structure
- Document security considerations

**Tasks:**
- [x] Analyze current auth (ADMIN_PASSWORD, token system)
- [x] Review existing database schema (agents, servers tables)
- [x] Design new tables (users, sessions, permissions, audit_logs, invitations)
- [x] Define role permissions matrix
- [x] Plan audit events and log structure
- [x] Research password hashing (bcryptjs)
- [x] Plan user invitation flow
- [x] Document findings in findings.md

**Outcome:** Comprehensive findings document with all design decisions

---

## Phase 1: Database Migrations ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Create all new tables for RBAC and audit logging
- Add indexes for performance
- Ensure foreign key constraints

**Tasks:**
- [ ] Create migration `0006_create_rbac_tables.sql`:
  - [ ] `users` table (id, email, password_hash, role, timestamps)
  - [ ] `sessions` table (id, user_id, token_hash, expires_at)
  - [ ] `permissions` table (id, user_id, resource_type, resource_id, permission)
  - [ ] `audit_logs` table (id, user_id, action, resource_type, details, timestamp)
  - [ ] `invitations` table (id, email, role, token_hash, invited_by, expires_at, used_at)
- [ ] Add indexes:
  - [ ] `idx_users_email` ON users(email)
  - [ ] `idx_sessions_token_hash` ON sessions(token_hash)
  - [ ] `idx_sessions_user_id` ON sessions(user_id)
  - [ ] `idx_permissions_user_id` ON permissions(user_id)
  - [ ] `idx_audit_logs_user_id` ON audit_logs(user_id)
  - [ ] `idx_audit_logs_timestamp` ON audit_logs(timestamp)
  - [ ] `idx_invitations_token_hash` ON invitations(token_hash)
- [ ] Run migration on D1 database
- [ ] Verify tables created correctly

**SQL:**
```sql
-- users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login INTEGER
);

-- sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- permissions table
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('agent', 'server', 'global')),
  resource_id TEXT,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'control', 'delete', 'manage_users')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- audit_logs table
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- invitations table
CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);
```

**Files to Create:**
- `manager/migrations/0006_create_rbac_tables.sql`

**Verification:**
- Query D1 to confirm all tables exist
- Verify indexes created
- Check foreign key constraints

---

## Phase 2: Backend Auth System ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Replace ADMIN_PASSWORD with JWT session tokens
- Implement password hashing with bcryptjs
- Create auth middleware for protecting endpoints

**Tasks:**
- [ ] Install dependencies:
  - [ ] `npm install bcryptjs` in manager/
  - [ ] `npm install --save-dev @types/bcryptjs`
- [ ] Create `manager/src/lib/auth.ts`:
  - [ ] `hashPassword(password)` - Hash password with bcryptjs
  - [ ] `verifyPassword(password, hash)` - Verify password
  - [ ] `generateSessionToken(userId, email, role)` - Create JWT session token
  - [ ] `verifySessionToken(token)` - Verify and decode JWT
  - [ ] `validatePasswordStrength(password)` - Check password requirements
- [ ] Create `manager/src/middleware/auth.ts`:
  - [ ] `requireAuth()` - Middleware to check JWT token
  - [ ] `requireRole(role)` - Middleware to check user role
  - [ ] `extractUser(c)` - Extract user from context
- [ ] Create `manager/src/routes/auth.ts`:
  - [ ] `POST /api/auth/login` - Email + password → JWT token
  - [ ] `POST /api/auth/logout` - Invalidate session
  - [ ] `GET /api/auth/me` - Get current user info
- [ ] Bootstrap admin creation:
  - [ ] Add startup check in `index.ts`
  - [ ] If users table empty → create admin from ADMIN_PASSWORD
- [ ] Update token types in `manager/src/lib/tokens.ts`:
  - [ ] Add `generateUserSessionToken()` function
  - [ ] Add session token payload interface

**Code Structure:**
```typescript
// lib/auth.ts
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  // Min 8 chars, 1 uppercase, 1 lowercase, 1 number
}
```

```typescript
// middleware/auth.ts
export function requireAuth() {
  return async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verifyToken(token, c.env.TOKEN_SECRET);
    if (payload.type !== 'user_session') return c.json({ error: 'Invalid token' }, 401);

    // Check session not expired
    const session = await c.env.DB.prepare(
      'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?'
    ).bind(hashToken(token), Date.now()).first();

    if (!session) return c.json({ error: 'Session expired' }, 401);

    // Attach user to context
    c.set('user', { id: payload.userId, email: payload.email, role: payload.role });
    await next();
  };
}
```

**Files to Create:**
- `manager/src/lib/auth.ts`
- `manager/src/middleware/auth.ts`
- `manager/src/routes/auth.ts`

**Files to Modify:**
- `manager/src/index.ts` - Add bootstrap admin, mount /api/auth route
- `manager/src/lib/tokens.ts` - Add user session token functions
- `manager/package.json` - Add bcryptjs dependency

**Verification:**
- POST /api/auth/login with correct password → returns JWT token
- POST /api/auth/login with wrong password → returns 401
- GET /api/auth/me with valid token → returns user info
- GET /api/auth/me with expired token → returns 401

---

## Phase 3: User Management API ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Admin can invite new users
- Admin can list, view, delete users
- Admin can change user roles
- Invitation acceptance flow

**Tasks:**
- [ ] Create `manager/src/routes/users.ts`:
  - [ ] `POST /api/users/invite` - Invite user (admin only)
  - [ ] `GET /api/users` - List all users (admin only)
  - [ ] `GET /api/users/:id` - Get user details (admin only)
  - [ ] `PATCH /api/users/:id/role` - Change role (admin only)
  - [ ] `DELETE /api/users/:id` - Delete user (admin only)
  - [ ] `GET /api/users/invitations` - List pending invitations (admin only)
  - [ ] `DELETE /api/users/invitations/:id` - Cancel invitation (admin only)
- [ ] Create `manager/src/routes/invitations.ts`:
  - [ ] `GET /api/invite/:token` - Verify invitation (public)
  - [ ] `POST /api/invite/:token/accept` - Accept invitation (public)
- [ ] Add role checks using `requireRole('admin')` middleware
- [ ] Generate invitation tokens (JWT, 24h expiry)
- [ ] Store invitation token hashes in D1
- [ ] Mark invitation as used when accepted
- [ ] Create user account on invitation acceptance

**Invitation Flow:**
```typescript
// POST /api/users/invite
{
  email: "user@example.com",
  role: "operator"
}
→ Generate token, store in invitations table
→ Return: { invitationLink: "https://zedops.example.com/invite/<token>" }

// GET /api/invite/:token
→ Verify token not expired, not used
→ Return: { email: "user@example.com", role: "operator", invitedBy: "admin@..." }

// POST /api/invite/:token/accept
{
  password: "SecurePass123"
}
→ Validate password strength
→ Hash password
→ Create user account
→ Mark invitation as used
→ Return: { success: true }
```

**Files to Create:**
- `manager/src/routes/users.ts`
- `manager/src/routes/invitations.ts`

**Files to Modify:**
- `manager/src/index.ts` - Mount /api/users and /api/invite routes

**Verification:**
- POST /api/users/invite with admin token → creates invitation
- POST /api/users/invite with non-admin token → returns 403
- GET /api/invite/:token with valid token → returns invitation details
- POST /api/invite/:token/accept with valid password → creates user
- POST /api/invite/:token/accept with used token → returns 400

---

## Phase 4: Permission System ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Enforce RBAC on all endpoints
- Per-server permissions for Operator and Viewer roles
- Permission checks return 403 if unauthorized

**Tasks:**
- [ ] Create `manager/src/lib/permissions.ts`:
  - [ ] `checkPermission(user, action, resourceType, resourceId)` - Check if user has permission
  - [ ] `getUserPermissions(userId)` - Get all permissions for user
  - [ ] `grantPermission(userId, resourceType, resourceId, permission)` - Grant permission
  - [ ] `revokePermission(userId, permissionId)` - Revoke permission
- [ ] Add permission middleware:
  - [ ] `requirePermission(action, resourceType)` - Middleware for permission check
- [ ] Update all agent endpoints in `agents.ts`:
  - [ ] `GET /api/agents` - Admin only
  - [ ] `GET /api/agents/:id` - Admin or has permission to any server on agent
  - [ ] `GET /api/agents/:id/containers` - Check permission for each server
  - [ ] `POST /api/agents/:id/servers` - Admin only (create server)
  - [ ] `DELETE /api/agents/:id/servers/:serverId` - Admin only (delete server)
  - [ ] `POST /api/agents/:id/servers/:serverId/start` - Admin or Operator with permission
  - [ ] `POST /api/agents/:id/servers/:serverId/stop` - Admin or Operator with permission
  - [ ] `GET /api/agents/:id/logs/ws` - Admin or has view permission on server
- [ ] Update RCON endpoints:
  - [ ] RCON access - Admin or Operator with permission

**Permission Check Logic:**
```typescript
// lib/permissions.ts
export async function checkPermission(
  db: D1Database,
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string | null
): Promise<boolean> {
  // Admins have all permissions
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
  if (user.role === 'admin') return true;

  // Check specific permission
  const permission = await db.prepare(
    'SELECT * FROM permissions WHERE user_id = ? AND resource_type = ? AND resource_id = ? AND permission = ?'
  ).bind(userId, resourceType, resourceId, action).first();

  return !!permission;
}
```

**Permission Levels:**
- `view` - Can view resource (servers, logs)
- `control` - Can start/stop/restart servers, use RCON
- `delete` - Can delete servers
- `manage_users` - Can manage users (admin only)

**Files to Create:**
- `manager/src/lib/permissions.ts`

**Files to Modify:**
- `manager/src/routes/agents.ts` - Add permission checks to all endpoints
- `manager/src/durable-objects/AgentConnection.ts` - Check permissions in WebSocket handlers

**Verification:**
- Admin can access all resources
- Operator with permission can control assigned server
- Operator without permission cannot access other servers
- Viewer can view logs but not control server
- Viewer attempting to start server → returns 403

---

## Phase 5: Audit Logging ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Log all user actions to audit_logs table
- Include user, action, resource, timestamp, IP, user-agent
- Exclude sensitive data (passwords, tokens)

**Tasks:**
- [ ] Create `manager/src/lib/audit.ts`:
  - [ ] `logAction(db, userId, action, resourceType, resourceId, details, ip, userAgent)` - Insert audit log
  - [ ] Helper functions for common actions
- [ ] Add audit logging to all endpoints:
  - [ ] User management (create, delete, role change)
  - [ ] Server management (create, delete, start, stop, restart, rebuild)
  - [ ] RCON commands (command, kick, ban)
  - [ ] Login/logout events
- [ ] Extract IP address and user-agent from request headers
- [ ] Store details as JSON (e.g., `{ server_name: "...", command: "..." }`)

**Audit Events:**
```typescript
// user.created
{
  action: 'user.created',
  resourceType: 'user',
  resourceId: newUserId,
  details: JSON.stringify({ email, role })
}

// server.started
{
  action: 'server.started',
  resourceType: 'server',
  resourceId: serverId,
  details: JSON.stringify({ server_name, agent_id })
}

// rcon.command
{
  action: 'rcon.command',
  resourceType: 'server',
  resourceId: serverId,
  details: JSON.stringify({ command: 'players', response_length: 123 })
}
```

**Files to Create:**
- `manager/src/lib/audit.ts`

**Files to Modify:**
- `manager/src/routes/auth.ts` - Log login/logout
- `manager/src/routes/users.ts` - Log user management actions
- `manager/src/routes/agents.ts` - Log server actions
- `manager/src/durable-objects/AgentConnection.ts` - Log RCON commands

**Verification:**
- User logs in → audit log entry created
- Admin deletes user → audit log entry created
- Operator starts server → audit log entry created with userId
- RCON command executed → audit log entry created

---

## Phase 6: Frontend Auth UI ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Replace password input with email + password login form
- Store JWT token in localStorage (not password)
- Add user context with email, role, permissions
- Add logout functionality

**Tasks:**
- [ ] Update `frontend/src/App.tsx`:
  - [ ] Remove password state
  - [ ] Add user state: `{ email, role, token }`
  - [ ] Add UserContext provider
  - [ ] Load token from localStorage on mount
  - [ ] Verify token with GET /api/auth/me
  - [ ] Redirect to login if token invalid
- [ ] Create `frontend/src/components/Login.tsx`:
  - [ ] Email input
  - [ ] Password input
  - [ ] Submit → POST /api/auth/login
  - [ ] Store token in localStorage
  - [ ] Update user context
- [ ] Create `frontend/src/contexts/UserContext.tsx`:
  - [ ] Provide user info (email, role, permissions)
  - [ ] Provide login() function
  - [ ] Provide logout() function
- [ ] Add user menu in header:
  - [ ] Show current user email
  - [ ] Logout button → clear token, redirect to login
- [ ] Update API utility to use token:
  - [ ] Replace password with token in Authorization header
  - [ ] Handle 401 errors → redirect to login

**Login Form:**
```tsx
<form onSubmit={handleLogin}>
  <input type="email" placeholder="Email" />
  <input type="password" placeholder="Password" />
  <button type="submit">Login</button>
</form>
```

**User Context:**
```typescript
interface User {
  id: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: Permission[];
}

const UserContext = createContext<{
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}>(...);
```

**Files to Create:**
- `frontend/src/components/Login.tsx`
- `frontend/src/contexts/UserContext.tsx`

**Files to Modify:**
- `frontend/src/App.tsx` - Use UserContext, add logout button
- `frontend/src/lib/api.ts` - Use token instead of password

**Verification:**
- User enters email + password → logs in successfully
- Token stored in localStorage
- User refreshes page → still logged in (token verified)
- User clicks logout → token cleared, redirected to login
- Invalid token → redirected to login

---

## Phase 7: User Management UI ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Admin can view list of all users
- Admin can invite new users
- Admin can change user roles
- Admin can delete users

**Tasks:**
- [ ] Create `frontend/src/components/UserManagement.tsx`:
  - [ ] User list table (email, role, created_at, last_login)
  - [ ] Invite button → opens modal
  - [ ] Role dropdown per user (admin can change)
  - [ ] Delete button per user (confirmation dialog)
- [ ] Create `frontend/src/components/InviteUserModal.tsx`:
  - [ ] Email input
  - [ ] Role selector (Admin, Operator, Viewer)
  - [ ] Submit → POST /api/users/invite
  - [ ] Show invitation link (copy to clipboard)
- [ ] Create `frontend/src/components/InvitationAccept.tsx`:
  - [ ] Route: `/invite/:token`
  - [ ] Show invitation details (email, role, invited by)
  - [ ] Password input (with strength indicator)
  - [ ] Confirm password input
  - [ ] Submit → POST /api/invite/:token/accept
  - [ ] Redirect to login on success
- [ ] Add "Users" nav item (admin only)
- [ ] Hide user management from non-admins

**User List UI:**
```
┌────────────────────────────────────────────┐
│ Users                      [+ Invite User]  │
├────────────────────────────────────────────┤
│ Email              Role      Created   Actions│
│ admin@zedops.local Admin     Jan 10    [X]   │
│ user@example.com   Operator  Jan 12    [Edit Role] [Delete]│
└────────────────────────────────────────────┘
```

**Files to Create:**
- `frontend/src/components/UserManagement.tsx`
- `frontend/src/components/InviteUserModal.tsx`
- `frontend/src/components/InvitationAccept.tsx`

**Files to Modify:**
- `frontend/src/App.tsx` - Add /users route, add /invite/:token route

**Verification:**
- Admin sees "Users" in nav
- Admin can invite user → receives invitation link
- User clicks invitation link → can set password
- Admin can change user role → role updated in DB
- Admin can delete user → user removed from DB
- Non-admin does not see "Users" nav item

---

## Phase 8: Audit Log Viewer ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Admin can view paginated audit log
- Admin can filter by user, action, resource, date range
- Admin can search by resource name

**Tasks:**
- [ ] Create `frontend/src/components/AuditLogs.tsx`:
  - [ ] Audit log table (timestamp, user, action, resource, details)
  - [ ] Pagination (50 entries per page)
  - [ ] Filters:
    - [ ] User dropdown (filter by user)
    - [ ] Action dropdown (filter by action type)
    - [ ] Resource dropdown (filter by resource type)
    - [ ] Date range picker (filter by date range)
  - [ ] Search input (search by resource name)
  - [ ] Color-coded actions (create=green, delete=red, modify=yellow)
- [ ] Create API hook `useAuditLogs()`:
  - [ ] Fetch logs with pagination and filters
  - [ ] Handle loading state
  - [ ] Handle error state
- [ ] Add "Audit Logs" nav item (admin only)

**Audit Log UI:**
```
┌──────────────────────────────────────────────────────────┐
│ Audit Logs                                                │
│ Filters: [User ▼] [Action ▼] [Resource ▼] [Date Range]  │
│ Search: [_____________________]                           │
├──────────────────────────────────────────────────────────┤
│ Time       User            Action           Resource      │
│ 12:34:56   admin@...       server.started   my-server    │
│ 12:34:45   user@...        rcon.command     my-server    │
│ 12:34:30   admin@...       user.created     user@...     │
├──────────────────────────────────────────────────────────┤
│ [< Prev]  Page 1 of 10  [Next >]                        │
└──────────────────────────────────────────────────────────┘
```

**Files to Create:**
- `frontend/src/components/AuditLogs.tsx`
- `frontend/src/hooks/useAuditLogs.ts`

**Files to Modify:**
- `frontend/src/App.tsx` - Add /audit route
- `frontend/src/lib/api.ts` - Add fetchAuditLogs() function

**Verification:**
- Admin sees "Audit Logs" in nav
- Audit logs display in paginated table
- Filters work correctly
- Search filters logs by resource name
- Color-coded actions display correctly
- Non-admin does not see "Audit Logs" nav item

---

## Phase 9: Testing & Migration ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- End-to-end testing of all RBAC features
- Bootstrap admin creation works
- Migration from ADMIN_PASSWORD to multi-user complete

**Tasks:**
- [ ] Bootstrap admin creation:
  - [ ] Test with fresh database (no users)
  - [ ] Verify admin created with email admin@zedops.local
  - [ ] Verify password is ADMIN_PASSWORD value
  - [ ] Verify admin can log in
- [ ] Test user invitation flow:
  - [ ] Admin invites user
  - [ ] User accepts invitation
  - [ ] User logs in successfully
  - [ ] User sees correct permissions
- [ ] Test role permissions:
  - [ ] Admin can access all resources
  - [ ] Operator can control assigned servers only
  - [ ] Operator cannot delete servers
  - [ ] Viewer can view logs only
  - [ ] Viewer cannot control servers
- [ ] Test audit logging:
  - [ ] All actions logged correctly
  - [ ] Logs include user, action, resource, timestamp
  - [ ] Admin can view audit logs
  - [ ] Non-admin cannot view audit logs
- [ ] Test edge cases:
  - [ ] Expired invitation token
  - [ ] Invalid invitation token
  - [ ] Weak password rejected
  - [ ] Duplicate email rejected
  - [ ] Session expiry after 7 days
  - [ ] 401 errors redirect to login

**Test Scenarios:**

### Scenario 1: Fresh Installation
1. Deploy manager with empty database
2. System creates bootstrap admin
3. Admin logs in with admin@zedops.local and ADMIN_PASSWORD
4. Admin invites first operator user
5. Operator accepts invitation and sets password
6. Operator logs in and sees assigned servers only

### Scenario 2: Role Permissions
1. Admin creates server
2. Admin grants operator permission to server
3. Operator logs in
4. Operator can start/stop server
5. Operator cannot delete server
6. Operator cannot see other servers

### Scenario 3: Audit Logging
1. Admin creates server → audit log entry
2. Operator starts server → audit log entry
3. Admin views audit logs → sees all entries
4. Operator attempts to view audit logs → 403 error

### Scenario 4: Session Management
1. User logs in → receives JWT token
2. Token stored in localStorage
3. User refreshes page → still logged in
4. User logs out → token cleared
5. User attempts to access resource → redirected to login

**Files to Modify:**
- `manager/src/index.ts` - Add bootstrap admin logic

**Verification:**
- All test scenarios pass
- No errors in console
- Audit logs populated correctly
- Permissions enforced correctly
- Session management works correctly

---

## Success Criteria

- [x] Plan complete with all phases detailed
- [ ] Database has users, sessions, permissions, audit_logs, invitations tables
- [ ] Admin can invite users with specific roles
- [ ] Operator can control assigned servers but not delete
- [ ] Viewer can view assigned server logs but not control
- [ ] All actions logged in D1 with timestamps and user attribution
- [ ] Login/logout flow with JWT sessions working
- [ ] Audit log viewer in UI (admin only) working
- [ ] Bootstrap admin creation on fresh install
- [ ] Migration from ADMIN_PASSWORD complete

---

## Critical Files

### Backend (Manager)
- `manager/migrations/0006_create_rbac_tables.sql` (NEW)
- `manager/src/lib/auth.ts` (NEW) - Password hashing, JWT generation
- `manager/src/lib/permissions.ts` (NEW) - Permission checks
- `manager/src/lib/audit.ts` (NEW) - Audit logging
- `manager/src/middleware/auth.ts` (NEW) - Auth middleware
- `manager/src/routes/auth.ts` (NEW) - Login/logout endpoints
- `manager/src/routes/users.ts` (NEW) - User management endpoints
- `manager/src/routes/invitations.ts` (NEW) - Invitation endpoints
- `manager/src/routes/agents.ts` (MODIFY) - Add permission checks
- `manager/src/durable-objects/AgentConnection.ts` (MODIFY) - Add permission checks
- `manager/src/index.ts` (MODIFY) - Bootstrap admin, mount routes
- `manager/package.json` (MODIFY) - Add bcryptjs dependency

### Frontend
- `frontend/src/components/Login.tsx` (NEW)
- `frontend/src/components/UserManagement.tsx` (NEW)
- `frontend/src/components/InviteUserModal.tsx` (NEW)
- `frontend/src/components/InvitationAccept.tsx` (NEW)
- `frontend/src/components/AuditLogs.tsx` (NEW)
- `frontend/src/contexts/UserContext.tsx` (NEW)
- `frontend/src/hooks/useAuditLogs.ts` (NEW)
- `frontend/src/App.tsx` (MODIFY) - User context, routing
- `frontend/src/lib/api.ts` (MODIFY) - Use JWT token

---

## Dependencies

**External:**
- bcryptjs (password hashing)
- Jose (JWT, already in use)

**Internal:**
- ✅ Milestone 6 complete (RCON integration)
- ✅ Database migrations system working
- ✅ JWT token system in place (for agents)

---

## Security Considerations

### Password Storage
- ✅ Passwords hashed with bcryptjs (10 rounds)
- ✅ Never log passwords
- ✅ Password strength validation (min 8 chars, 1 upper, 1 lower, 1 number)

### Session Management
- ✅ JWT tokens with 7-day expiry
- ✅ Token hashes stored (not raw tokens)
- ✅ Sessions invalidated on logout
- ✅ Token verification on every request

### Permission Checks
- ✅ All endpoints protected with auth middleware
- ✅ Role checks on sensitive operations
- ✅ Per-resource permission checks
- ✅ Admin bypass for all permission checks

### Audit Logging
- ✅ All actions logged
- ✅ User attribution for accountability
- ✅ Exclude sensitive data (passwords, tokens)
- ✅ Immutable logs (no delete operation)

---

## Design Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Use bcryptjs for password hashing | Compatible with Cloudflare Workers, well-tested | 2026-01-12 |
| JWT session tokens (7-day expiry) | Balance security and UX, no refresh token for MVP | 2026-01-12 |
| 3 roles (Admin, Operator, Viewer) | Simple hierarchy, covers common use cases | 2026-01-12 |
| Per-server permissions (not per-agent) | More granular control, matches user mental model | 2026-01-12 |
| Manual invitation link copy (no email) | Simpler MVP, add email integration later | 2026-01-12 |
| Bootstrap admin from ADMIN_PASSWORD | Smooth migration path, no manual user creation | 2026-01-12 |
| Audit logs retention: 90 days | Balance storage and compliance, configurable later | 2026-01-12 |

---

## Future Enhancements (Deferred)

- [ ] Email integration for invitations (Cloudflare Email Routing)
- [ ] Password reset flow ("forgot password")
- [ ] Token refresh mechanism (refresh tokens)
- [ ] Two-factor authentication (2FA)
- [ ] API rate limiting (prevent brute force)
- [ ] User profile page (change password, view activity)
- [ ] Team/group permissions (assign multiple users to team)
- [ ] Audit log export (CSV, JSON)
- [ ] Audit log retention policy (auto-delete after N days)
- [ ] Advanced audit log search (full-text search)

---

## Notes

- RBAC is critical for production use (multi-user, security, compliance)
- Audit logs provide accountability and troubleshooting capabilities
- Session-based auth better than password-based (security)
- Bootstrap admin ensures smooth onboarding for new installations
- Permission checks must be comprehensive (every endpoint)
- Audit logging must be reliable (no missed events)
