/**
 * User Management API Routes
 *
 * Handles user CRUD operations, role management, and permissions.
 * All endpoints require admin authentication.
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth';
import { hashPassword, validatePasswordStrength } from '../lib/auth';
import {
  logUserCreated,
  logUserDeleted,
  logUserRoleChanged,
  logUserPasswordChanged,
} from '../lib/audit';

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
};

const users = new Hono<{ Bindings: Bindings }>();

// All routes require admin authentication
users.use('*', requireAuth(), requireRole('admin'));

// ============================================================================
// GET /api/users
// List all users
// ============================================================================

users.get('/', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT id, email, role, created_at, updated_at, last_login FROM users ORDER BY created_at DESC'
    ).all();

    return c.json({ users: result.results || [] });
  } catch (error) {
    console.error('List users error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// GET /api/users/:id
// Get user details by ID
// ============================================================================

users.get('/:id', async (c) => {
  try {
    const userId = c.req.param('id');

    const user = await c.env.DB.prepare(
      'SELECT id, email, role, created_at, updated_at, last_login FROM users WHERE id = ?'
    )
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get user's permissions
    const permissions = await c.env.DB.prepare(
      'SELECT id, resource_type, resource_id, permission, created_at FROM permissions WHERE user_id = ?'
    )
      .bind(userId)
      .all();

    // Get user's active sessions
    const sessions = await c.env.DB.prepare(
      'SELECT id, expires_at, created_at FROM sessions WHERE user_id = ? AND expires_at > ?'
    )
      .bind(userId, Date.now())
      .all();

    return c.json({
      user,
      permissions: permissions.results || [],
      activeSessions: sessions.results || [],
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// POST /api/users
// Create a new user directly (without invitation)
// ============================================================================

users.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, role } = body;

    // Validate input
    if (!email || !password || !role) {
      return c.json({ error: 'Email, password, and role are required' }, 400);
    }

    // Validate role
    if (!['admin', 'operator', 'viewer'].includes(role)) {
      return c.json({ error: 'Invalid role - must be admin, operator, or viewer' }, 400);
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return c.json({ error: 'Password validation failed', errors: passwordValidation.errors }, 400);
    }

    // Check if email already exists
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    // Create user
    const userId = uuidv4();
    const passwordHash = await hashPassword(password);
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(userId, email, passwordHash, role, now, now)
      .run();

    // Log user creation
    const currentUser = c.get('user');
    await logUserCreated(c.env.DB, c, currentUser.id, userId, email, role);

    // Return user info (without password hash)
    return c.json(
      {
        message: 'User created successfully',
        user: {
          id: userId,
          email,
          role,
          created_at: now,
        },
      },
      201
    );
  } catch (error) {
    console.error('Create user error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// PATCH /api/users/:id/role
// Change user role
// ============================================================================

users.patch('/:id/role', async (c) => {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();
    const { role } = body;

    // Validate role
    if (!['admin', 'operator', 'viewer'].includes(role)) {
      return c.json({ error: 'Invalid role - must be admin, operator, or viewer' }, 400);
    }

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Update role
    const now = Date.now();
    await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
      .bind(role, now, userId)
      .run();

    // Log role change
    const currentUser = c.get('user');
    await logUserRoleChanged(c.env.DB, c, currentUser.id, userId, user.role as string, role);

    return c.json({
      message: 'User role updated successfully',
      user: {
        id: userId,
        previousRole: user.role,
        newRole: role,
      },
    });
  } catch (error) {
    console.error('Update role error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// PATCH /api/users/:id/password
// Change user password (admin can reset any user's password)
// ============================================================================

users.patch('/:id/password', async (c) => {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();
    const { password } = body;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return c.json({ error: 'Password validation failed', errors: passwordValidation.errors }, 400);
    }

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Update password
    const passwordHash = await hashPassword(password);
    const now = Date.now();
    await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(passwordHash, now, userId)
      .run();

    // Invalidate all existing sessions for this user (force re-login)
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

    // Log password change
    const currentUser = c.get('user');
    await logUserPasswordChanged(c.env.DB, c, currentUser.id, userId);

    return c.json({
      message: 'Password updated successfully - all sessions invalidated',
    });
  } catch (error) {
    console.error('Update password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// DELETE /api/users/:id
// Delete a user (soft delete - invalidate sessions, can recreate with same email)
// ============================================================================

users.delete('/:id', async (c) => {
  try {
    const userId = c.req.param('id');
    const currentUser = c.get('user');

    // Prevent self-deletion
    if (userId === currentUser.id) {
      return c.json({ error: 'Cannot delete your own user account' }, 400);
    }

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id, email, role FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Delete user (cascade will delete sessions and permissions via foreign keys)
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

    // Log user deletion
    const currentUser = c.get('user');
    await logUserDeleted(c.env.DB, c, currentUser.id, userId, user.email as string);

    return c.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: userId,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// DELETE /api/users/:id/sessions
// Invalidate all sessions for a user (force logout)
// ============================================================================

users.delete('/:id/sessions', async (c) => {
  try {
    const userId = c.req.param('id');

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Delete all sessions
    const result = await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?')
      .bind(userId)
      .run();

    return c.json({
      message: 'All sessions invalidated successfully',
      sessionsDeleted: result.meta?.changes || 0,
    });
  } catch (error) {
    console.error('Delete sessions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { users };
