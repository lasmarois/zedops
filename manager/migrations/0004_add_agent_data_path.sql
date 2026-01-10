-- Migration: Add server_data_path column to agents table
-- Date: 2026-01-10
-- Purpose: Enable manager-side data path configuration for server storage

ALTER TABLE agents ADD COLUMN server_data_path TEXT NOT NULL DEFAULT '/var/lib/zedops/servers';
