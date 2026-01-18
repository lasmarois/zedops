-- Migration: Add public_ip column to agents table
-- Purpose: Store agent's public IP for display in server connection info
-- The IP is captured from CF-Connecting-IP header during WebSocket connection

ALTER TABLE agents ADD COLUMN public_ip TEXT;
