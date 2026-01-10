-- Migration: Create servers table
-- Date: 2026-01-10
-- Purpose: Store server configurations and state for ZedOps-managed servers

CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  container_id TEXT,
  config TEXT NOT NULL,
  image_tag TEXT NOT NULL DEFAULT 'latest',
  game_port INTEGER NOT NULL,
  udp_port INTEGER NOT NULL,
  rcon_port INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  UNIQUE(agent_id, name),
  UNIQUE(agent_id, game_port)
);

-- Index for lookups by agent
CREATE INDEX idx_servers_agent_id ON servers(agent_id);

-- Index for status queries
CREATE INDEX idx_servers_status ON servers(status);
