-- Generic key/value settings written by the manager itself (not user-facing).
-- First use: 'agent_version' — latest agent release info stored by the CI broadcast webhook,
-- so /api/agent/version can answer without depending on the GitHub API being reachable.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
