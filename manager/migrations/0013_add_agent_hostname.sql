-- Migration: Add hostname column to agents table
-- Purpose: Allow users to configure a custom hostname (like DuckDNS) for their agent
-- The hostname is displayed in Connection Card instead of the auto-detected IP

ALTER TABLE agents ADD COLUMN hostname TEXT;
