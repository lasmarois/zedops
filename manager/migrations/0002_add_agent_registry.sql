-- Migration: Add steam_zomboid_registry column to agents table
-- Date: 2026-01-10
-- Purpose: Enable manager-side registry configuration for server creation

ALTER TABLE agents ADD COLUMN steam_zomboid_registry TEXT NOT NULL DEFAULT 'registry.gitlab.nicomarois.com/nicolas/steam-zomboid';
