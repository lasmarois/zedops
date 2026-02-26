-- Migration: Add alert_update column to notification_preferences
-- Follows same opt-out model: 1 = ON (default), 0 = OFF
ALTER TABLE notification_preferences ADD COLUMN alert_update INTEGER NOT NULL DEFAULT 1;
