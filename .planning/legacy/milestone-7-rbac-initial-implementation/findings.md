# Findings: Milestone 7 - RBAC & Audit Logs

**Milestone:** M7 - RBAC & Audit Logs
**Started:** 2026-01-12
**Status:** Planning Phase

---

## Finding 1: Current Authentication System

**Date:** 2026-01-12
**Context:** Understanding current auth to design RBAC replacement

**Current Implementation:**
- **Location:** `manager/src/routes/admin.ts`
- **Method:** Hardcoded `ADMIN_PASSWORD` environment variable
- **Flow:**
  1. Client sends `Authorization: Bearer <password>` header
  2. Manager compares with `env.ADMIN_PASSWORD`
  3. If match → allow access, else 401

**Code:**
```typescript
const providedPassword = authHeader.substring(7); // Remove "Bearer "
if (providedPassword !== c.env.ADMIN_PASSWORD) {
  return c.json({ error: 'Invalid admin password' }, 401);
}
```

**Limitations:**
- ❌ Single admin password (no multi-user support)
- ❌ No role-based permissions
- ❌ Password shared among all admins
- ❌ No user session management
- ❌ No audit trail of who did what

**Replacement Strategy:**
- Replace hardcoded password with user table
- Add session tokens (JWT) for authenticated users
- Add roles and permissions system
- Keep ADMIN_PASSWORD for bootstrap (first admin account)

---

## Finding 2: Token System (Jose/JWT)

**Date:** 2026-01-12
**Context:** Understanding existing token infrastructure

**Current Implementation:**
- **Library:** Jose (JWT for Cloudflare Workers)
- **Location:** `manager/src/lib/tokens.ts`
- **Token Types:**
  1. **Ephemeral Tokens:** 1-hour expiry, for agent registration
  2. **Permanent Tokens:** No expiry, for agent ongoing auth

**Functions:**
```typescript
generateEphemeralToken(agentName, secret) → JWT (1h expiry)
generatePermanentToken(agentId, agentName, secret) → JWT (no expiry)
verifyToken(token, secret) → JWTPayload
hashToken(token) → SHA-256 hash
```

**Reusability for RBAC:**
- ✅ Can reuse `verifyToken()` for user session tokens
- ✅ Can reuse JWT signing logic
- ✅ Already using HS256 algorithm
- ❌ Need to add user-specific claims (userId, role, permissions)

**New Token Type Needed:**
```typescript
{
  type: 'user_session',
  userId: string,
  email: string,
  role: string,
  permissions: string[],
  iat: number,
  exp: number  // 7 days expiry
}
```

---

## Finding 3: Database Schema

**Date:** 2026-01-12
**Context:** Planning new tables for RBAC and audit logs

**Existing Tables:**

### `agents` Table
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  last_seen INTEGER,
  status TEXT NOT NULL,
  metadata TEXT,
  steam_zomboid_registry TEXT NOT NULL DEFAULT '...',
  server_data_path TEXT NOT NULL DEFAULT '...',
  created_at INTEGER NOT NULL
);
```

### `servers` Table
```sql
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  container_id TEXT,
  config TEXT NOT NULL,
  image_tag TEXT NOT NULL,
  game_port INTEGER NOT NULL,
  udp_port INTEGER NOT NULL,
  rcon_port INTEGER NOT NULL,
  status TEXT NOT NULL,
  data_exists BOOLEAN NOT NULL DEFAULT 0,
  deleted_at INTEGER DEFAULT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
```

**New Tables Needed:**

### `users` Table (PLANNED)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login INTEGER
);
```

### `sessions` Table (PLANNED)
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### `permissions` Table (PLANNED)
```sql
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('agent', 'server', 'global')),
  resource_id TEXT,  -- NULL for global permissions
  permission TEXT NOT NULL CHECK (permission IN ('view', 'control', 'delete', 'manage_users')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### `audit_logs` Table (PLANNED)
```sql
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
```

---

## Finding 4: Frontend Authentication

**Date:** 2026-01-12
**Context:** Understanding frontend auth state management

**Current Implementation:**
- **Password Storage:** `localStorage.getItem('adminPassword')`
- **Location:** `frontend/src/App.tsx`
- **Flow:**
  1. User enters password in login form
  2. Password stored in localStorage
  3. All API requests include `Authorization: Bearer <password>` header

**Code Snippet:**
```typescript
const [password, setPassword] = useState(() => {
  return localStorage.getItem('adminPassword') || '';
});
```

**Limitations:**
- ❌ Password stored in plain text in localStorage
- ❌ No session expiry (password persists forever)
- ❌ No user identity (just a password)
- ❌ No logout functionality

**Replacement Strategy:**
- Replace password with JWT session token
- Store token in localStorage (short-lived, 7 days)
- Include user info in context (email, role, permissions)
- Add proper login/logout flow
- Add token refresh mechanism

---

## Finding 5: Role-Based Access Control Design

**Date:** 2026-01-12
**Context:** Defining roles and permissions for ZedOps

**Role Hierarchy:**

### Admin (Global)
- **Scope:** Entire system
- **Permissions:**
  - ✅ Manage users (invite, delete, change roles)
  - ✅ View all agents
  - ✅ View all servers
  - ✅ Control all servers (start, stop, restart, delete)
  - ✅ Create new servers
  - ✅ View audit logs
  - ✅ Manage agent registrations

### Operator (Per-Server)
- **Scope:** Specific servers
- **Permissions:**
  - ✅ View assigned servers
  - ✅ Control assigned servers (start, stop, restart)
  - ✅ View server logs
  - ✅ Use RCON console
  - ❌ Cannot delete servers
  - ❌ Cannot create new servers
  - ❌ Cannot manage users

### Viewer (Per-Server)
- **Scope:** Specific servers
- **Permissions:**
  - ✅ View assigned servers (status only)
  - ✅ View server logs (read-only)
  - ❌ Cannot control servers
  - ❌ Cannot use RCON console
  - ❌ Cannot delete servers

**Permission Matrix:**

| Action | Admin | Operator | Viewer |
|--------|-------|----------|--------|
| View agents | ✅ All | ❌ | ❌ |
| View servers | ✅ All | ✅ Assigned | ✅ Assigned |
| Create server | ✅ | ❌ | ❌ |
| Start/Stop server | ✅ | ✅ Assigned | ❌ |
| Delete server | ✅ | ❌ | ❌ |
| View logs | ✅ | ✅ Assigned | ✅ Assigned |
| RCON console | ✅ | ✅ Assigned | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ❌ | ❌ |

---

## Finding 6: Audit Log Design

**Date:** 2026-01-12
**Context:** Planning comprehensive audit logging

**Events to Log:**

### User Management
- `user.created` - New user account created
- `user.deleted` - User account deleted
- `user.role_changed` - User role modified
- `user.login` - User logged in
- `user.logout` - User logged out

### Agent Management
- `agent.registered` - New agent registered
- `agent.deleted` - Agent removed

### Server Management
- `server.created` - New server created
- `server.deleted` - Server soft-deleted
- `server.purged` - Server permanently removed
- `server.started` - Server started
- `server.stopped` - Server stopped
- `server.restarted` - Server restarted
- `server.rebuilt` - Server rebuilt
- `server.restored` - Soft-deleted server restored

### RCON Actions
- `rcon.command` - RCON command executed
- `rcon.kick` - Player kicked
- `rcon.ban` - Player banned

**Log Entry Structure:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "action": "server.started",
  "resource_type": "server",
  "resource_id": "server-uuid",
  "details": {
    "server_name": "my-server",
    "agent_id": "agent-uuid"
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "timestamp": 1673456789
}
```

**UI Display:**
- Paginated table (50 entries per page)
- Filters: User, Action, Resource, Date range
- Search by resource name
- Color-coded by action type (create=green, delete=red, modify=yellow)

---

## Finding 7: Password Security

**Date:** 2026-01-12
**Context:** Planning secure password storage

**Requirements:**
- ✅ Hash passwords with bcrypt or similar
- ✅ Salt automatically handled by bcrypt
- ✅ Min password length: 8 characters
- ✅ Require: 1 uppercase, 1 lowercase, 1 number
- ✅ Never log passwords (audit logs exclude sensitive data)

**Cloudflare Workers Compatibility:**
- ✅ bcrypt available via `bcryptjs` package (pure JS, no native deps)
- ✅ Or use `@noble/hashes` for argon2 (modern, recommended)

**Chosen Library:** `bcryptjs`
- **Reason:** Widely used, well-tested, compatible with Workers
- **Cost:** 10 rounds (2^10 iterations, ~100ms per hash)
- **Usage:**
  ```typescript
  import bcrypt from 'bcryptjs';

  // Hash password
  const hash = await bcrypt.hash(password, 10);

  // Verify password
  const match = await bcrypt.compare(password, hash);
  ```

---

## Finding 8: User Invitation Flow

**Date:** 2026-01-12
**Context:** Designing secure user onboarding

**Flow:**
1. **Admin invites user:**
   - Admin enters email + role
   - System generates invitation token (JWT, 24h expiry)
   - Invitation link sent to email (if configured) or copied to clipboard
   - Invitation stored in `invitations` table

2. **User accepts invitation:**
   - User clicks invitation link: `/invite/<token>`
   - System verifies token (not expired, not used)
   - User creates password
   - System creates user account
   - Invitation marked as used

3. **Invitation expiry:**
   - After 24h, invitation token expires
   - Admin can resend invitation (generates new token)

**Invitation Table (NEW):**
```sql
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

**Email Integration (Optional):**
- Use Cloudflare Email Routing or external SMTP
- Deferred to later (manual link copy for MVP)

---

## Finding 9: Migration Strategy

**Date:** 2026-01-12
**Context:** Planning migration from ADMIN_PASSWORD to multi-user

**Migration Plan:**

### Step 1: Create New Tables
```sql
-- Migration 0006_create_rbac_tables.sql
CREATE TABLE users (...);
CREATE TABLE sessions (...);
CREATE TABLE permissions (...);
CREATE TABLE audit_logs (...);
CREATE TABLE invitations (...);
```

### Step 2: Create Bootstrap Admin
- On first deployment, check if users table is empty
- If empty, create default admin user:
  - Email: `admin@zedops.local`
  - Password: Value of `ADMIN_PASSWORD` environment variable
  - Role: `admin`

### Step 3: Update API Endpoints
- Add middleware to check JWT tokens (not ADMIN_PASSWORD)
- Add permission checks to all endpoints
- Log all actions to audit_logs table

### Step 4: Update Frontend
- Replace login form (password → email + password)
- Add user context (email, role, permissions)
- Add user menu (profile, logout)
- Add user management UI (admin only)
- Add audit log viewer (admin only)

### Step 5: Deprecate ADMIN_PASSWORD
- Keep for bootstrap only
- Log warning if used after migration
- Remove in future version

---

## Finding 10: API Endpoint Changes

**Date:** 2026-01-12
**Context:** Planning API changes for RBAC

**New Endpoints:**

### Authentication
- `POST /api/auth/login` - Email + password → JWT session token
- `POST /api/auth/logout` - Invalidate session token
- `POST /api/auth/refresh` - Refresh expiring token (optional)
- `GET /api/auth/me` - Get current user info

### User Management (Admin only)
- `POST /api/users/invite` - Invite new user
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user details
- `PATCH /api/users/:id/role` - Change user role
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/invitations` - List pending invitations
- `DELETE /api/users/invitations/:id` - Cancel invitation

### Permissions (Admin only)
- `POST /api/users/:id/permissions` - Grant permission to user
- `DELETE /api/users/:id/permissions/:permId` - Revoke permission
- `GET /api/users/:id/permissions` - List user permissions

### Audit Logs (Admin only)
- `GET /api/audit` - List audit logs (paginated, filtered)
- `GET /api/audit/:id` - Get audit log details

### Invitation Acceptance (Public)
- `GET /api/invite/:token` - Verify invitation token
- `POST /api/invite/:token/accept` - Accept invitation + create account

**Modified Endpoints:**
- All existing endpoints need permission checks
- Add `userId` to audit logs on every action

---

## Open Questions

1. **Email Integration:** Use Cloudflare Email Routing, external SMTP, or manual link copy for invitations?
   - **Recommendation:** Manual link copy for MVP, add email later

2. **Session Expiry:** 7 days, 30 days, or configurable?
   - **Recommendation:** 7 days (good balance of security and UX)

3. **Token Refresh:** Implement refresh token mechanism or just re-login?
   - **Recommendation:** Re-login for MVP (simpler), add refresh later

4. **Password Reset:** Add "forgot password" flow or defer?
   - **Recommendation:** Defer to post-MVP (admin can reset user password)

5. **2FA:** Add two-factor authentication or defer?
   - **Recommendation:** Defer to post-MVP

6. **API Rate Limiting:** Add rate limiting to prevent brute force attacks?
   - **Recommendation:** Add basic rate limiting (10 failed logins → 15min lockout)

7. **Audit Log Retention:** Keep forever or expire after N days?
   - **Recommendation:** Keep for 90 days (configurable via ENV later)

---

## References

- Jose (JWT for Workers): https://github.com/panva/jose
- bcryptjs: https://www.npmjs.com/package/bcryptjs
- Cloudflare Workers Auth: https://developers.cloudflare.com/workers/examples/
- RBAC Best Practices: https://en.wikipedia.org/wiki/Role-based_access_control
