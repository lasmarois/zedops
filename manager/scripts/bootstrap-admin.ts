/**
 * Bootstrap Admin User Script
 *
 * Creates the initial admin user for ZedOps system.
 * Run this once after deploying the RBAC system.
 *
 * Usage:
 *   npm run bootstrap-admin
 *
 * Default credentials:
 *   Email: admin@zedops.local
 *   Password: admin123
 *
 * IMPORTANT: Change these credentials immediately after first login!
 */

import bcrypt from 'bcryptjs';

const DEFAULT_ADMIN = {
  email: 'admin@zedops.local',
  password: 'admin123',
  role: 'admin',
};

async function bootstrapAdmin(db: D1Database) {
  console.log('🚀 Bootstrapping admin user...');

  // Check if admin already exists
  const existing = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(DEFAULT_ADMIN.email)
    .first();

  if (existing) {
    console.log('⚠️  Admin user already exists. Skipping.');
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
  const userId = `admin-bootstrap-${Date.now()}`;
  const now = Date.now();

  // Insert admin user
  await db
    .prepare(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(userId, DEFAULT_ADMIN.email, passwordHash, DEFAULT_ADMIN.role, now, now)
    .run();

  console.log('✅ Admin user created successfully!');
  console.log('');
  console.log('📧 Email:', DEFAULT_ADMIN.email);
  console.log('🔑 Password:', DEFAULT_ADMIN.password);
  console.log('');
  console.log('⚠️  IMPORTANT: Change these credentials after first login!');
}

// This will be called by the manager on startup if needed
export { bootstrapAdmin };
