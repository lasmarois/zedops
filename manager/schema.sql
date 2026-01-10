-- ZedOps D1 Database Schema
-- Milestone 1: Agent Connection

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT NOT NULL,               -- User-provided agent name
  token_hash TEXT NOT NULL,         -- SHA-256 hash of permanent token
  status TEXT DEFAULT 'offline',    -- 'online' | 'offline'
  last_seen INTEGER,                -- Unix timestamp
  created_at INTEGER NOT NULL,      -- Unix timestamp
  metadata TEXT                     -- JSON: OS, version, etc.
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_seen ON agents(last_seen);

-- Note: Additional tables will be added in future milestones:
-- - users (M6: RBAC)
-- - user_server_roles (M6: RBAC)
-- - servers (M4: Server Management)
-- - audit_logs (M6: Audit Logs)
