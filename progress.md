# Progress: Milestone 7 - RBAC & Audit Logs

**Milestone:** M7 - RBAC & Audit Logs
**Started:** 2026-01-12
**Status:** Planning Complete, Ready for Implementation

---

## Session 1: Planning & Research ✅ Complete

**Date:** 2026-01-12
**Duration:** ~30 minutes
**Goal:** Create comprehensive planning files for M7 implementation

### Actions Taken

1. **Updated MILESTONES.md**
   - Marked M6 (RCON Integration) as complete
   - Added complete implementation details (duration: 9.5 hours, deliverables, test results)
   - Updated progress: 5/9 (56%) → 6/9 (67%)
   - Changed active milestone from M6 to M7
   - Committed: `b5dca0e` - "Update MILESTONES.md - Mark M6 (RCON Integration) as complete"

2. **Archived Milestone 6**
   - Created `planning-history/milestone-6-rcon-integration/`
   - Moved 4 planning files: task_plan.md, progress.md, findings.md, TEST-PLAN-RCON.md
   - Committed: `82533a9` - "Archive Milestone 6 (RCON Integration) to planning-history"

3. **Examined Current Authentication System**
   - Read `manager/src/routes/admin.ts` - Current ADMIN_PASSWORD implementation
   - Read `manager/src/lib/tokens.ts` - Existing JWT infrastructure (Jose library)
   - Read `manager/src/index.ts` - Main entry point structure
   - Read migration files - Database schema patterns

4. **Created findings.md (313 lines)**
   - 10 comprehensive findings covering all M7 aspects:
     - Finding 1: Current Authentication System
     - Finding 2: Token System (Jose/JWT)
     - Finding 3: Database Schema (5 new tables designed)
     - Finding 4: Frontend Authentication
     - Finding 5: Role-Based Access Control Design
     - Finding 6: Audit Log Design
     - Finding 7: Password Security (bcryptjs)
     - Finding 8: User Invitation Flow
     - Finding 9: Migration Strategy
     - Finding 10: API Endpoint Changes
   - Documented 7 open questions with recommended answers

5. **Created task_plan.md (669 lines)**
   - Defined 9 implementation phases (Phase 0 through Phase 9)
   - Phase 0 marked complete (research & design)
   - Detailed tasks for each remaining phase with code examples
   - Listed 22 files to create/modify
   - Success criteria and verification steps per phase
   - Security considerations and design decisions documented

6. **Created progress.md (this file)**
   - Session 1 documentation
   - Ready for Phase 1 implementation

### Research Findings

See [findings.md](findings.md) for comprehensive research documentation.

**Key Decisions Made:**
- 3-tier role hierarchy: Admin (global), Operator (per-server), Viewer (per-server)
- JWT sessions with 7-day expiry
- bcryptjs for password hashing (10 rounds)
- Manual invitation link copy (no email for MVP)
- Bootstrap admin from ADMIN_PASSWORD on first run
- Per-server permissions for granular access control
- 90-day audit log retention

**New Tables to Create:**
1. `users` - User accounts with email/password
2. `sessions` - Active JWT sessions
3. `permissions` - Per-user, per-resource permissions
4. `audit_logs` - Comprehensive action logging
5. `invitations` - Token-based user invitations

### Next Actions

**Phase 1: Database Migrations** ⏳ Next

1. Create migration `manager/migrations/0006_create_rbac_tables.sql`
2. Create 5 tables with proper indexes and foreign keys
3. Run migration on D1 database
4. Verify all tables and indexes created successfully

### Time Tracking

- **Session 1:** ~30 minutes (Planning & Research)
- **Total:** ~30 minutes

### Status

- ✅ Phase 0: Research & Database Design - Complete
- ⏳ Phase 1: Database Migrations - Ready to start
- ⏳ Phase 2: Backend Auth System - Planned
- ⏳ Phase 3: User Management API - Planned
- ⏳ Phase 4: Permission System - Planned
- ⏳ Phase 5: Audit Logging - Planned
- ⏳ Phase 6: Frontend Auth UI - Planned
- ⏳ Phase 7: User Management UI - Planned
- ⏳ Phase 8: Audit Log Viewer - Planned
- ⏳ Phase 9: Testing & Migration - Planned

---

## Session 2: Phase 1 - Database Migrations ✅ Complete

**Date:** 2026-01-12
**Duration:** ~15 minutes
**Goal:** Create and deploy RBAC database schema

### Actions Taken

1. **Created Migration File**
   - File: `manager/migrations/0006_create_rbac_tables.sql`
   - Created 5 tables with full schema:
     - `users` - User accounts (id, email, password_hash, role, timestamps)
     - `sessions` - JWT session tracking (id, user_id, token_hash, expires_at)
     - `permissions` - Per-resource permissions (id, user_id, resource_type, resource_id, permission)
     - `audit_logs` - Action logging (id, user_id, action, resource_type, details, timestamp)
     - `invitations` - User invitations (id, email, role, token_hash, expires_at, used_at)
   - Added 14 indexes for query performance
   - Implemented CHECK constraints for data validation (role validation, resource_type validation, etc.)

2. **Deployed Migration to D1**
   - Command: `npx wrangler d1 execute zedops-db --remote --file=migrations/0006_create_rbac_tables.sql`
   - Result: ✅ 19 queries executed successfully (5 CREATE TABLE + 14 CREATE INDEX)
   - Database size: 0.17 MB → 0.17 MB (minimal overhead)
   - Execution time: 6.58ms

3. **Verified Migration Success**
   - Listed all tables: ✅ 8 tables total (5 new + 2 existing + 1 internal)
   - Verified indexes on users table: ✅ idx_users_email, idx_users_role
   - Tested INSERT/SELECT/DELETE: ✅ All operations successful
   - Confirmed foreign key constraints working

4. **Committed Changes**
   - Committed: `7b1c904` - "Add RBAC database migration (Phase 1 complete)"
   - Migration file ready for deployment

### Database Schema Verification

**Tables Created:**
```
agents          (existing)
audit_logs      ← NEW
invitations     ← NEW
permissions     ← NEW
servers         (existing)
sessions        ← NEW
users           ← NEW
```

**Indexes Created:**
- `idx_users_email`, `idx_users_role`
- `idx_sessions_user_id`, `idx_sessions_token_hash`, `idx_sessions_expires_at`
- `idx_permissions_user_id`, `idx_permissions_resource`
- `idx_audit_logs_user_id`, `idx_audit_logs_action`, `idx_audit_logs_timestamp`, `idx_audit_logs_resource`
- `idx_invitations_email`, `idx_invitations_token_hash`, `idx_invitations_expires_at`

### Next Actions

**Phase 2: Backend Auth System** ⏳ Next

1. Install bcryptjs dependency
2. Create `manager/src/lib/auth.ts` (password hashing, token generation, validation)
3. Create `manager/src/middleware/auth.ts` (requireAuth, requireRole)
4. Create `manager/src/routes/auth.ts` (login, logout, me endpoints)
5. Add bootstrap admin creation in `manager/src/index.ts`

### Time Tracking

- **Session 1:** ~30 minutes (Planning & Research)
- **Session 2:** ~15 minutes (Phase 1 - Database Migrations)
- **Total:** ~45 minutes

### Status

- ✅ Phase 0: Research & Database Design - Complete
- ✅ Phase 1: Database Migrations - Complete
- ⏳ Phase 2: Backend Auth System - Next
- ⏳ Phase 3: User Management API - Planned
- ⏳ Phase 4: Permission System - Planned
- ⏳ Phase 5: Audit Logging - Planned
- ⏳ Phase 6: Frontend Auth UI - Planned
- ⏳ Phase 7: User Management UI - Planned
- ⏳ Phase 8: Audit Log Viewer - Planned
- ⏳ Phase 9: Testing & Migration - Planned

---

## Session 3: Phase 2 - Backend Auth System ✅ Complete

**Date:** 2026-01-12
**Duration:** ~30 minutes
**Goal:** Implement complete backend authentication system with JWT and bcrypt

### Actions Taken

1. **Installed Dependencies**
   - Package: `bcryptjs` (password hashing for Cloudflare Workers)
   - Package: `@types/bcryptjs` (TypeScript definitions)
   - Both installed successfully with no vulnerabilities

2. **Created Authentication Library** (`manager/src/lib/auth.ts`)
   - **Password Hashing:**
     - `hashPassword()` - bcrypt with 10 rounds (~100ms per hash)
     - `verifyPassword()` - compare plain-text to hash
   - **Password Validation:**
     - `validatePasswordStrength()` - enforces 8+ chars, 1 upper, 1 lower, 1 number
     - Returns detailed error messages for user feedback
   - **JWT Session Tokens:**
     - `generateSessionToken()` - creates JWT with 7-day expiry
     - `verifySessionToken()` - verifies and decodes JWT
     - Payload includes: userId, email, role, type='user_session'
   - **Token Hashing:**
     - `hashToken()` - SHA-256 for storing tokens in database

3. **Created Authentication Middleware** (`manager/src/middleware/auth.ts`)
   - **requireAuth():**
     - Extracts JWT from Authorization header
     - Verifies token signature and expiry
     - Checks session exists in database and not expired
     - Loads user into context for downstream handlers
     - Updates last_login timestamp (non-blocking)
   - **requireRole():**
     - Enforces role-based access (admin always passes)
     - Returns 403 if user lacks required role
   - **optionalAuth():**
     - Loads user if token present, continues without user if not
     - Useful for endpoints that work with or without authentication

4. **Created Authentication Routes** (`manager/src/routes/auth.ts`)
   - **POST /api/auth/login:**
     - Accepts email and password
     - Verifies password with bcrypt.compare()
     - Generates 7-day JWT session token
     - Stores session in database (hashed token)
     - Returns token and user info
   - **POST /api/auth/logout:**
     - Requires authentication (requireAuth middleware)
     - Invalidates session by deleting from database
   - **GET /api/auth/me:**
     - Requires authentication
     - Returns current user details from database
   - **POST /api/auth/refresh:**
     - Requires authentication
     - Generates new token with extended expiry
     - Updates session in database

5. **Updated Main Entry Point** (`manager/src/index.ts`)
   - Mounted new auth routes: `app.route('/api/auth', auth)`
   - **Added Bootstrap Endpoint** (`POST /api/bootstrap`):
     - Protected by ADMIN_PASSWORD (same as current mechanism)
     - Checks if users table is empty
     - Creates default admin: `admin@zedops.local` with ADMIN_PASSWORD
     - Returns instructions for first login
     - Idempotent (safe to call multiple times)

6. **Committed Changes**
   - Committed: `5b8264f` - "Implement Phase 2: Backend Auth System"
   - 8 files changed: 3 new files, 2 modified files, package.json updated
   - Pushed to origin/main

### Implementation Details

**Password Security:**
- bcrypt 10 rounds (2^10 iterations = ~100ms per hash)
- Secure against brute force attacks
- Automatic salt generation and management

**Session Management:**
- JWT tokens with 7-day expiry
- Tokens stored as SHA-256 hashes in database
- Session validation on every authenticated request
- last_login timestamp updated automatically

**Bootstrap Process:**
```bash
# After deployment, call bootstrap endpoint:
curl -X POST https://zedops.example.com/api/bootstrap \
  -H "Authorization: Bearer <ADMIN_PASSWORD>"

# Then login with:
{
  "email": "admin@zedops.local",
  "password": "<ADMIN_PASSWORD>"
}
```

**API Authentication Flow:**
```
1. User calls POST /api/auth/login with email+password
2. Server verifies password, generates JWT (7d expiry)
3. Server stores session in DB (token hash + expiry)
4. Client receives JWT token
5. Client includes token in Authorization header for all requests
6. requireAuth() middleware verifies token and loads user
7. User can call POST /api/auth/logout to invalidate session
```

### Next Actions

**Phase 3: User Management API** ⏳ Next

1. Create `manager/src/routes/users.ts` (user CRUD operations)
2. Create `manager/src/routes/invitations.ts` (invitation flow)
3. Implement user invitation with 24h token expiry
4. Add role change and user deletion endpoints
5. Protect all endpoints with requireAuth() and requireRole('admin')

### Time Tracking

- **Session 1:** ~30 minutes (Planning & Research)
- **Session 2:** ~15 minutes (Phase 1 - Database Migrations)
- **Session 3:** ~30 minutes (Phase 2 - Backend Auth System)
- **Total:** ~1 hour 15 minutes

### Status

- ✅ Phase 0: Research & Database Design - Complete
- ✅ Phase 1: Database Migrations - Complete
- ✅ Phase 2: Backend Auth System - Complete
- ⏳ Phase 3: User Management API - Next
- ⏳ Phase 4: Permission System - Planned
- ⏳ Phase 5: Audit Logging - Planned
- ⏳ Phase 6: Frontend Auth UI - Planned
- ⏳ Phase 7: User Management UI - Planned
- ⏳ Phase 8: Audit Log Viewer - Planned
- ⏳ Phase 9: Testing & Migration - Planned

---

## Session 4: Phase 3 - User Management API ✅ Complete

**Date:** 2026-01-12
**Duration:** ~30 minutes
**Goal:** Implement complete user management and invitation system

### Actions Taken

1. **Created User Management Routes** (`manager/src/routes/users.ts`)
   - **GET /api/users** - List all users with details
   - **GET /api/users/:id** - Get user with permissions and active sessions
   - **POST /api/users** - Create user directly (admin can bypass invitation)
   - **PATCH /api/users/:id/role** - Change user role (admin/operator/viewer)
   - **PATCH /api/users/:id/password** - Reset user password (invalidates all sessions)
   - **DELETE /api/users/:id** - Delete user (with self-deletion protection)
   - **DELETE /api/users/:id/sessions** - Force logout (invalidate all sessions)
   - All routes protected with `requireAuth()` and `requireRole('admin')`

2. **Created Invitation Routes** (`manager/src/routes/invitations.ts`)
   - **Admin Endpoints:**
     - POST /api/users/invite - Create invitation (24h JWT token)
     - GET /api/users/invitations - List all invitations with status (pending/accepted/expired)
     - DELETE /api/users/invitations/:id - Cancel pending invitation
   - **Public Endpoints:**
     - GET /api/invite/:token/verify - Verify invitation token validity
     - POST /api/invite/:token/accept - Accept invitation and create account

3. **Updated Main Entry Point** (`manager/src/index.ts`)
   - Imported user and invitation routes
   - Mounted routes:
     - `/api/users` → user management
     - `/api/users/invite` → invitation creation
     - `/api/invite` → public invitation endpoints

4. **Committed and Pushed**
   - Committed: `8252817` - "Implement Phase 3: User Management API"
   - 3 files changed: 2 new files (users.ts, invitations.ts), 1 modified (index.ts)
   - Total: 689 lines of code added

### Implementation Details

**User Management Features:**
- Complete CRUD operations for users
- Role management (admin, operator, viewer)
- Password reset capability (admin can reset any user)
- Session management (force logout individual users)
- Self-deletion protection (admin cannot delete themselves)
- Duplicate email prevention
- Cascading deletes (foreign keys remove sessions and permissions)

**Invitation Flow:**
```
1. Admin: POST /api/users/invite { email, role }
   → System generates 24h JWT token
   → Returns invitation URL

2. User clicks: https://zedops.example.com/invite/<token>
   → Frontend calls: GET /api/invite/:token/verify
   → Shows invitation details (email, role, expiry)

3. User sets password:
   → Frontend calls: POST /api/invite/:token/accept { password }
   → System creates user account
   → Marks invitation as used

4. User logs in:
   → POST /api/auth/login { email, password }
   → Receives JWT session token
```

**Invitation Token Security:**
- JWT signed with TOKEN_SECRET
- 24-hour expiry (hard limit)
- Stored as SHA-256 hash in database
- One-time use (marked used_at after acceptance)
- Token payload includes: email, role, type='user_invitation'

**Password Validation:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- Detailed error messages for user feedback

**API Endpoint Summary:**

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /api/users | GET | Admin | List all users |
| /api/users/:id | GET | Admin | Get user details |
| /api/users | POST | Admin | Create user directly |
| /api/users/:id/role | PATCH | Admin | Change user role |
| /api/users/:id/password | PATCH | Admin | Reset password |
| /api/users/:id | DELETE | Admin | Delete user |
| /api/users/:id/sessions | DELETE | Admin | Force logout |
| /api/users/invite | POST | Admin | Create invitation |
| /api/users/invitations | GET | Admin | List invitations |
| /api/users/invitations/:id | DELETE | Admin | Cancel invitation |
| /api/invite/:token/verify | GET | Public | Verify token |
| /api/invite/:token/accept | POST | Public | Accept & create account |

### Next Actions

**Phase 4: Permission System** ⏳ Next

1. Create `manager/src/lib/permissions.ts` (permission checking logic)
2. Add permission checks to all agent/server endpoints
3. Implement per-server permission enforcement
4. Add permission grant/revoke endpoints
5. Test operator and viewer role restrictions

### Time Tracking

- **Session 1:** ~30 minutes (Planning & Research)
- **Session 2:** ~15 minutes (Phase 1 - Database Migrations)
- **Session 3:** ~30 minutes (Phase 2 - Backend Auth System)
- **Session 4:** ~30 minutes (Phase 3 - User Management API)
- **Total:** ~1 hour 45 minutes

### Status

- ✅ Phase 0: Research & Database Design - Complete
- ✅ Phase 1: Database Migrations - Complete
- ✅ Phase 2: Backend Auth System - Complete
- ✅ Phase 3: User Management API - Complete
- ⏳ Phase 4: Permission System - Next
- ⏳ Phase 5: Audit Logging - Planned
- ⏳ Phase 6: Frontend Auth UI - Planned
- ⏳ Phase 7: User Management UI - Planned
- ⏳ Phase 8: Audit Log Viewer - Planned
- ⏳ Phase 9: Testing & Migration - Planned

---

## Session 5: Phase 4 - Permission System ✅ Complete

**Date:** 2026-01-12
**Duration:** ~45 minutes
**Goal:** Implement complete permission system with RBAC enforcement

### Actions Taken

1. **Created Permission Library** (`manager/src/lib/permissions.ts`)
   - **Core Functions:**
     - `checkPermission()` - Central permission checking logic
     - `canViewServer()`, `canControlServer()`, `canDeleteServer()` - Convenience wrappers
     - `getUserVisibleServers()` - Get all servers user can access
     - `getUserPermissions()` - List all permissions for a user
   - **Permission Management:**
     - `grantPermission()` - Grant permission to user (idempotent)
     - `revokePermission()` - Remove specific permission
     - `revokeAllPermissionsForResource()` - Remove all permissions for a resource
   - **Role Presets:**
     - `grantOperatorPermissions()` - Grant view + control
     - `grantViewerPermissions()` - Grant view only

2. **Created Permission API Routes** (`manager/src/routes/permissions.ts`)
   - **GET /api/permissions/:userId** - List all permissions for a user
   - **POST /api/permissions/:userId** - Grant permission (with resource validation)
   - **POST /api/permissions/:userId/operator/:serverId** - Grant operator access to server
   - **POST /api/permissions/:userId/viewer/:serverId** - Grant viewer access to server
   - **DELETE /api/permissions/:permissionId** - Revoke specific permission
   - **DELETE /api/permissions/:userId/:resourceType/:resourceId** - Revoke all for resource
   - All routes protected with `requireAuth()` and `requireRole('admin')`

3. **Updated Main Entry Point** (`manager/src/index.ts`)
   - Imported permission routes
   - Mounted at `/api/permissions`

4. **Added RBAC Enforcement to Agent Routes** (`manager/src/routes/agents.ts`)
   - Added `requireAuth()` middleware to all routes (global authentication)
   - Replaced hardcoded ADMIN_PASSWORD checks with user context
   - **Updated Endpoints:**
     - GET /api/agents - Admin only (global view)
     - GET /api/agents/:id - Admin only
     - GET /api/agents/:id/servers - Permission-filtered (users only see allowed servers)
     - POST /:id/servers/:serverId/start - Requires `control` permission
     - POST /:id/servers/:serverId/stop - Requires `control` permission
     - DELETE /:id/servers/:serverId - Requires `delete` permission

5. **Committed and Pushed**
   - Committed: `8a979cd` - "Implement Phase 4: Permission System"
   - 4 files changed: 2 new files (permissions.ts lib + routes), 2 modified (index.ts, agents.ts)
   - Total: 704 lines added, 65 lines removed

### Implementation Details

**Permission Model:**
```typescript
// Admin: Global access (bypasses all checks)
if (userRole === 'admin') return true;

// Non-admins: Check database for explicit permission grant
SELECT * FROM permissions
WHERE user_id = ? AND resource_type = 'server'
AND resource_id = ? AND permission = 'control'
```

**Permission Types:**
- `view` - Can view server status and logs
- `control` - Can start, stop, restart server
- `delete` - Can delete server (soft delete)
- `manage_users` - Can manage users (admin only, not used yet)

**Server Filtering:**
```typescript
// GET /api/agents/:id/servers
// Admins see all servers for agent
// Operators/Viewers see only permitted servers
if (user.role !== 'admin') {
  const visibleServerIds = await getUserVisibleServers(db, userId, userRole);
  servers = servers.filter(s => visibleServerIds.includes(s.id));
}
```

**Grant Operator Permissions:**
```bash
# Admin grants operator access to server:
POST /api/permissions/user-123/operator/server-456

# Creates two permissions:
- { user_id: user-123, resource_type: 'server', resource_id: 'server-456', permission: 'view' }
- { user_id: user-123, resource_type: 'server', resource_id: 'server-456', permission: 'control' }
```

**Grant Viewer Permissions:**
```bash
# Admin grants viewer access to server:
POST /api/permissions/user-789/viewer/server-456

# Creates one permission:
- { user_id: user-789, resource_type: 'server', resource_id: 'server-456', permission: 'view' }
```

**Permission Check Flow:**
```
1. User calls: POST /api/agents/:id/servers/:serverId/start
2. requireAuth() middleware: Verifies JWT, loads user into context
3. canControlServer() check: Queries permissions table
4. If admin → return true (bypass)
5. If non-admin → return true only if permission exists
6. If no permission → 403 Forbidden
```

**API Endpoint Summary:**

| Endpoint | Method | Auth | Permission | Description |
|----------|--------|------|------------|-------------|
| /api/permissions/:userId | GET | Admin | - | List user permissions |
| /api/permissions/:userId | POST | Admin | - | Grant permission |
| /api/permissions/:userId/operator/:serverId | POST | Admin | - | Grant operator access |
| /api/permissions/:userId/viewer/:serverId | POST | Admin | - | Grant viewer access |
| /api/permissions/:permissionId | DELETE | Admin | - | Revoke permission |
| /api/agents | GET | Required | Admin only | List agents |
| /api/agents/:id/servers | GET | Required | Filtered | List servers |
| POST /:id/servers/:serverId/start | POST | Required | control | Start server |
| POST /:id/servers/:serverId/stop | POST | Required | control | Stop server |
| DELETE /:id/servers/:serverId | DELETE | Required | delete | Delete server |

### Next Actions

**Phase 5: Audit Logging** ⏳ Next

1. Create `manager/src/lib/audit.ts` (audit logging functions)
2. Add audit logging to all user actions:
   - User management (create, delete, role change)
   - Permission changes (grant, revoke)
   - Server operations (start, stop, delete, create)
   - Auth events (login, logout)
3. Extract IP address and user-agent from requests
4. Store audit logs in database with user attribution

### Time Tracking

- **Session 1:** ~30 minutes (Planning & Research)
- **Session 2:** ~15 minutes (Phase 1 - Database Migrations)
- **Session 3:** ~30 minutes (Phase 2 - Backend Auth System)
- **Session 4:** ~30 minutes (Phase 3 - User Management API)
- **Session 5:** ~45 minutes (Phase 4 - Permission System)
- **Total:** ~2 hours 30 minutes

### Status

- ✅ Phase 0: Research & Database Design - Complete
- ✅ Phase 1: Database Migrations - Complete
- ✅ Phase 2: Backend Auth System - Complete
- ✅ Phase 3: User Management API - Complete
- ✅ Phase 4: Permission System - Complete
- ⏳ Phase 5: Audit Logging - Next
- ⏳ Phase 6: Frontend Auth UI - Planned
- ⏳ Phase 7: User Management UI - Planned
- ⏳ Phase 8: Audit Log Viewer - Planned
- ⏳ Phase 9: Testing & Migration - Planned

---

## Next Session: Phase 5 - Audit Logging

**Goals:**
- Create audit logging library
- Add logging to all sensitive operations
- Capture user context (IP, user-agent, timestamp)
- Log all CRUD operations and auth events

**Estimated Duration:** ~1 hour

**Files to Create:**
- `manager/src/lib/audit.ts`

**Files to Modify:**
- `manager/src/routes/auth.ts` (log login/logout)
- `manager/src/routes/users.ts` (log user management)
- `manager/src/routes/permissions.ts` (log permission changes)
- `manager/src/routes/agents.ts` (log server operations)
