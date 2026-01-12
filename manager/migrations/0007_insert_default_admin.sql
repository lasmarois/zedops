-- Migration 0007: Insert default admin user
-- This creates the first admin user for initial system access
--
-- Default credentials:
--   Email: admin@zedops.local
--   Password: admin123
--
-- ⚠️  IMPORTANT: Change these credentials immediately after first login!

INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
VALUES (
  'admin-' || lower(hex(randomblob(16))),
  'admin@zedops.local',
  '$2b$10$kzv5mUNv/DBMRAc.Q6d/kO62N7iUtcqTRew7fBoG681sOc7KIrbeW',
  'admin',
  unixepoch() * 1000,
  unixepoch() * 1000
)
ON CONFLICT(email) DO NOTHING;
