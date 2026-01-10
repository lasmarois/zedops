/**
 * Admin API endpoints
 *
 * Protected by hardcoded admin password (MVP).
 * Full RBAC will be implemented in Milestone 6.
 */

import { Hono } from 'hono';
import { generateEphemeralToken } from '../lib/tokens';

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
};

const admin = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/admin/tokens
 * Generate ephemeral token for agent registration
 *
 * Body: { agentName: string }
 * Returns: { token: string, expiresIn: string }
 */
admin.post('/tokens', async (c) => {
  // Check admin password
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const providedPassword = authHeader.substring(7); // Remove "Bearer "
  if (providedPassword !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  // Parse request body
  const body = await c.req.json();
  const { agentName } = body;

  if (!agentName || typeof agentName !== 'string') {
    return c.json({ error: 'agentName is required and must be a string' }, 400);
  }

  // Generate ephemeral token
  const token = await generateEphemeralToken(agentName, c.env.TOKEN_SECRET);

  return c.json({
    token,
    expiresIn: '1h',
    agentName,
  });
});

export { admin };
