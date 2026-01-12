/**
 * Authentication Middleware
 *
 * Provides middleware functions to protect routes and enforce role-based access control.
 */

import { Context, Next } from 'hono';
import { verifySessionToken, hashToken } from '../lib/auth';

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
};

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Require authentication - verify JWT token and load user into context
 *
 * Usage:
 *   app.get('/api/protected', requireAuth(), async (c) => {
 *     const user = c.get('user'); // AuthUser
 *     return c.json({ message: `Hello ${user.email}` });
 *   });
 */
export function requireAuth() {
  return async (c: Context<{ Bindings: Bindings; Variables: { user: AuthUser } }>, next: Next) => {
    // Extract token from Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized - Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verify JWT signature and decode payload
    let payload;
    try {
      payload = await verifySessionToken(token, c.env.TOKEN_SECRET);
    } catch (error) {
      return c.json({ error: 'Unauthorized - Invalid or expired token' }, 401);
    }

    // Verify session exists in database and is not expired
    const tokenHash = await hashToken(token);
    const now = Date.now();

    const session = await c.env.DB.prepare(
      'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?'
    )
      .bind(tokenHash, now)
      .first();

    if (!session) {
      return c.json({ error: 'Unauthorized - Session expired or invalid' }, 401);
    }

    // Update last_login timestamp for user (asynchronous, non-blocking)
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?')
        .bind(now, payload.userId)
        .run()
    );

    // Attach user to context for downstream handlers
    c.set('user', {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    await next();
  };
}

// ============================================================================
// Role-Based Access Control Middleware
// ============================================================================

/**
 * Require a specific role (admins always pass)
 *
 * Usage:
 *   app.delete('/api/users/:id', requireAuth(), requireRole('admin'), async (c) => {
 *     // Only admins can delete users
 *   });
 */
export function requireRole(requiredRole: string) {
  return async (c: Context<{ Bindings: Bindings; Variables: { user: AuthUser } }>, next: Next) => {
    const user = c.get('user');

    // Admin role bypasses all role checks
    if (user.role === 'admin') {
      await next();
      return;
    }

    // Check if user has required role
    if (user.role !== requiredRole) {
      return c.json(
        {
          error: `Forbidden - Requires '${requiredRole}' role`,
          userRole: user.role,
        },
        403
      );
    }

    await next();
  };
}

// ============================================================================
// Optional Authentication (for endpoints that work with or without auth)
// ============================================================================

/**
 * Optional authentication - load user if token is present, but don't require it
 *
 * Usage:
 *   app.get('/api/public', optionalAuth(), async (c) => {
 *     const user = c.get('user'); // AuthUser | undefined
 *     if (user) {
 *       return c.json({ message: `Hello ${user.email}` });
 *     } else {
 *       return c.json({ message: 'Hello anonymous user' });
 *     }
 *   });
 */
export function optionalAuth() {
  return async (c: Context<{ Bindings: Bindings; Variables: { user?: AuthUser } }>, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      await next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = await verifySessionToken(token, c.env.TOKEN_SECRET);
      const tokenHash = await hashToken(token);
      const now = Date.now();

      const session = await c.env.DB.prepare(
        'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?'
      )
        .bind(tokenHash, now)
        .first();

      if (session) {
        c.set('user', {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
        });
      }
    } catch (error) {
      // Invalid token, but we don't fail - just continue without user
    }

    await next();
  };
}
