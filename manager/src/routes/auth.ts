/**
 * Authentication API Routes
 *
 * Handles user login, logout, and session management.
 */

import { Hono } from 'hono';
// Using crypto.randomUUID() for ID generation
import {
  verifyPassword,
  hashPassword,
  validatePasswordStrength,
  generateSessionToken,
  hashToken,
} from '../lib/auth';
import { requireAuth } from '../middleware/auth';
import { logUserLogin, logUserLogout, logUserPasswordChanged } from '../lib/audit';

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
};

const auth = new Hono<{ Bindings: Bindings }>();

// ============================================================================
// POST /api/auth/login
// Login with email and password, returns JWT session token
// ============================================================================

auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Find user by email
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (!user) {
      // Log failed login attempt
      await logUserLogin(c.env.DB, c, '', email, false);
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash as string);
    if (!passwordValid) {
      // Log failed login attempt
      await logUserLogin(c.env.DB, c, user.id as string, email, false);
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Generate session token
    const token = await generateSessionToken(
      user.id as string,
      user.email as string,
      user.role as string,
      c.env.TOKEN_SECRET
    );

    // Store session in database
    const sessionId = crypto.randomUUID();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(sessionId, user.id, tokenHash, expiresAt, now)
      .run();

    // Update last_login timestamp (non-blocking)
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?')
        .bind(now, user.id)
        .run()
    );

    // Log successful login
    await logUserLogin(c.env.DB, c, user.id as string, email, true);

    // Return token and user info
    return c.json({
      token,
      expiresIn: '7d',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// POST /api/auth/logout
// Invalidate current session token
// ============================================================================

auth.post('/logout', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const authHeader = c.req.header('Authorization');
    const token = authHeader!.substring(7); // Remove "Bearer "

    // Hash token to find session
    const tokenHash = await hashToken(token);

    // Delete session from database
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run();

    // Log logout
    await logUserLogout(c.env.DB, c, user.id);

    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// GET /api/auth/me
// Get current user info from session
// ============================================================================

auth.get('/me', requireAuth(), async (c) => {
  try {
    const user = c.get('user');

    // Fetch full user details from database
    const userDetails = await c.env.DB.prepare(
      'SELECT id, email, role, created_at, updated_at, last_login FROM users WHERE id = ?'
    )
      .bind(user.id)
      .first();

    if (!userDetails) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: userDetails });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// POST /api/auth/refresh
// Refresh session token (extend expiry)
// Note: This is optional - for MVP, users just re-login when token expires
// ============================================================================

auth.post('/refresh', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const authHeader = c.req.header('Authorization');
    const oldToken = authHeader!.substring(7);
    const oldTokenHash = await hashToken(oldToken);

    // Generate new token
    const newToken = await generateSessionToken(
      user.id,
      user.email,
      user.role,
      c.env.TOKEN_SECRET
    );

    // Update session in database
    const newTokenHash = await hashToken(newToken);
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    await c.env.DB.prepare(
      'UPDATE sessions SET token_hash = ?, expires_at = ? WHERE token_hash = ?'
    )
      .bind(newTokenHash, expiresAt, oldTokenHash)
      .run();

    return c.json({
      token: newToken,
      expiresIn: '7d',
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// PATCH /api/auth/password
// Change own password (requires current password verification)
// ============================================================================

auth.patch('/password', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Current password and new password are required' }, 400);
    }

    // Validate new password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return c.json({ error: validation.errors[0] }, 400);
    }

    // Fetch current password hash
    const dbUser = await c.env.DB.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    ).bind(user.id).first<{ password_hash: string }>();

    if (!dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, dbUser.password_hash);
    if (!isValid) {
      return c.json({ error: 'Current password is incorrect' }, 401);
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
    ).bind(newHash, Date.now(), user.id).run();

    // Log the password change
    await logUserPasswordChanged(c.env.DB, c, user.id, user.id);

    return c.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { auth };
