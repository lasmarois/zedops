-- Migration 0009: Implement role-based RBAC with multi-scope assignments
-- Date: 2026-01-12
-- Purpose: Replace permission-based model with role-based model
-- Milestone: M7 Phase 2 - RBAC Auth Migration & Refinement
--
-- Changes:
-- 1. Update users table: role can be 'admin' or NULL
-- 2. Drop permissions table (replaced by role_assignments)
-- 3. Create role_assignments table (multi-scope role assignments)
-- 4. Update invitations table to support new roles
-- 5. Migrate existing 'user' role users to NULL role

-- ============================================================================
-- Step 1: Update users table to allow NULL role
-- ============================================================================

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin') OR role IS NULL),  -- Only 'admin' or NULL
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login INTEGER
);

-- Copy existing data, converting 'user' role to NULL
INSERT INTO users_new (id, email, password_hash, role, created_at, updated_at, last_login)
SELECT
  id,
  email,
  password_hash,
  CASE WHEN role = 'admin' THEN 'admin' ELSE NULL END,  -- 'user' → NULL
  created_at,
  updated_at,
  last_login
FROM users;

-- Drop old table
DROP TABLE users;

-- Rename new table
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- Step 2: Drop old permissions table
-- ============================================================================

DROP TABLE IF EXISTS permissions;

-- ============================================================================
-- Step 3: Create role_assignments table for multi-scope role assignments
-- ============================================================================

CREATE TABLE role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('agent-admin', 'operator', 'viewer')),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'agent', 'server')),
  resource_id TEXT,  -- NULL for global, agent_id for agent, server_id for server
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (role != 'agent-admin' OR scope = 'agent'),  -- agent-admin only at agent scope
  UNIQUE (user_id, scope, resource_id, role)  -- One role per user per scope per resource
);

-- Create indexes for performance
CREATE INDEX idx_role_assignments_user ON role_assignments(user_id);
CREATE INDEX idx_role_assignments_scope_resource ON role_assignments(scope, resource_id);
CREATE INDEX idx_role_assignments_role ON role_assignments(role);

-- ============================================================================
-- Step 4: Update invitations table to support new roles
-- ============================================================================

CREATE TABLE invitations_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agent-admin', 'operator', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy existing invitations (admin stays admin, 'user' becomes NULL but we'll handle that in app)
INSERT INTO invitations_new (id, email, role, token_hash, invited_by, created_at, expires_at, used_at)
SELECT
  id,
  email,
  CASE WHEN role = 'admin' THEN 'admin' ELSE 'viewer' END,  -- Default non-admin invites to viewer
  token_hash,
  invited_by,
  created_at,
  expires_at,
  used_at
FROM invitations;

-- Drop old table
DROP TABLE invitations;

-- Rename new table
ALTER TABLE invitations_new RENAME TO invitations;

-- Recreate indexes
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);

-- ============================================================================
-- Migration complete
-- ============================================================================
-- Notes:
-- - Existing admin users retain their admin role
-- - Existing 'user' role users now have NULL role (no default access)
-- - Permissions table dropped (fresh start for role assignments)
-- - Invitations for non-admin users default to 'viewer' role
-- - Application code must handle NULL role users (show "ask admin for access")
