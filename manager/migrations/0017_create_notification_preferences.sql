-- Notification preferences: opt-out model (no row = alerts ON)
-- agent_id NULL = global default, non-NULL = per-agent override
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  alert_offline INTEGER NOT NULL DEFAULT 1,
  alert_recovery INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, agent_id)
);

CREATE INDEX idx_notif_prefs_user ON notification_preferences(user_id);
CREATE INDEX idx_notif_prefs_agent ON notification_preferences(user_id, agent_id);
