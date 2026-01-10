-- Migration 0005: Add server lifecycle management fields
-- Date: 2026-01-10
-- Purpose: Add data_exists and deleted_at fields to enable soft delete and recovery features

-- Add data_exists field to track if server data exists on host
ALTER TABLE servers ADD COLUMN data_exists BOOLEAN NOT NULL DEFAULT 0;

-- Add deleted_at field for soft delete (NULL = not deleted)
ALTER TABLE servers ADD COLUMN deleted_at INTEGER DEFAULT NULL;

-- Note:
-- - data_exists is updated by status sync (checks if bin/ or data/ directories exist)
-- - deleted_at is set when soft deleting a server (DELETE endpoint)
-- - Servers with deleted_at < NOW() - 24h are auto-purged by background job
