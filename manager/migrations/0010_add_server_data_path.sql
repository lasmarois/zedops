-- Migration 0010: Add per-server data path override
-- Date: 2026-01-14
-- Purpose: Allow servers to override agent's default data path
--
-- M9.8.23: Per-Server Path Override at Creation
-- References: M9.8.21 (Agent Configuration)
--
-- Behavior:
-- - NULL = inherit from agent's server_data_path (default behavior)
-- - Non-NULL = custom path for this specific server
--
-- When agent's path changes:
-- - Servers with NULL: Use new agent path on next operation
-- - Servers with custom path: Unaffected (use their custom path)

ALTER TABLE servers ADD COLUMN server_data_path TEXT DEFAULT NULL;
