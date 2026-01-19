/**
 * Admin API endpoints
 *
 * Protected by JWT auth with admin role requirement.
 */

import { Hono } from 'hono';
import { generateEphemeralToken } from '../lib/tokens';
import { requireAuth, requireRole, AuthUser } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
};

type Variables = {
  user: AuthUser;
};

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * POST /api/admin/tokens
 * Generate ephemeral token for agent registration
 * Also creates a pending agent record in the database
 *
 * Requires: admin role
 * Body: { agentName: string }
 * Returns: { token: string, expiresIn: string, agentName: string, agentId: string }
 */
admin.post('/tokens', requireAuth(), requireRole('admin'), async (c) => {
  // Parse request body
  const body = await c.req.json();
  const { agentName } = body;

  if (!agentName || typeof agentName !== 'string') {
    return c.json({ error: 'agentName is required and must be a string' }, 400);
  }

  // Check if agent with this name already exists
  const existingAgent = await c.env.DB.prepare(
    'SELECT id, status FROM agents WHERE name = ?'
  ).bind(agentName).first();

  if (existingAgent) {
    return c.json({
      error: 'Agent with this name already exists',
      existingStatus: existingAgent.status
    }, 409);
  }

  // Generate agent ID
  const agentId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Create pending agent record
  // token_hash is empty for pending agents - will be set when agent connects
  await c.env.DB.prepare(
    `INSERT INTO agents (id, name, token_hash, status, created_at, metadata)
     VALUES (?, ?, '', 'pending', ?, ?)`
  ).bind(agentId, agentName, now, JSON.stringify({})).run();

  // Generate ephemeral token with agentId
  const token = await generateEphemeralToken(agentId, agentName, c.env.TOKEN_SECRET);

  return c.json({
    token,
    expiresIn: '1h',
    agentName,
    agentId,
  });
});

/**
 * DELETE /api/admin/pending-agents/:id
 * Delete a pending agent (cancel registration)
 *
 * Requires: admin role
 */
admin.delete('/pending-agents/:id', requireAuth(), requireRole('admin'), async (c) => {
  const agentId = c.req.param('id');

  // Check if agent exists and is pending
  const agent = await c.env.DB.prepare(
    'SELECT id, status FROM agents WHERE id = ?'
  ).bind(agentId).first();

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  if (agent.status !== 'pending') {
    return c.json({ error: 'Can only delete pending agents' }, 400);
  }

  // Delete the pending agent
  await c.env.DB.prepare('DELETE FROM agents WHERE id = ?').bind(agentId).run();

  return c.json({ success: true });
});

export { admin };
