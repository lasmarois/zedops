-- Migration: Add theme preference to users table
-- Stored per-user, synced across devices

ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'solar-flare';
