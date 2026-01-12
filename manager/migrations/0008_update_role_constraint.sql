-- Migration 0008: Update role constraint to use 'user' instead of 'operator'/'viewer'
-- This aligns the database with the implemented role system

-- Create new users table with updated constraint
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login INTEGER
);

-- Copy existing data
INSERT INTO users_new SELECT * FROM users;

-- Drop old table
DROP TABLE users;

-- Rename new table
ALTER TABLE users_new RENAME TO users;

-- Recreate invitations table with updated role constraint
CREATE TABLE invitations_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

-- Copy existing data
INSERT INTO invitations_new SELECT * FROM invitations;

-- Drop old table
DROP TABLE invitations;

-- Rename new table
ALTER TABLE invitations_new RENAME TO invitations;
