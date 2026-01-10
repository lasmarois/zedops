/**
 * Agent management API endpoints
 *
 * Public endpoints for querying agent status.
 * Protected by admin authentication (MVP).
 */

import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
};

const agents = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/agents
 * List all registered agents with their status
 *
 * Returns: Array of agents with status information
 */
agents.get('/', async (c) => {
  // Check admin password
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const providedPassword = authHeader.substring(7); // Remove "Bearer "
  if (providedPassword !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  // Query all agents from D1
  try {
    const result = await c.env.DB.prepare(
      `SELECT id, name, status, last_seen, created_at, metadata FROM agents ORDER BY created_at DESC`
    ).all();

    // Transform results
    const agents = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      lastSeen: row.last_seen,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    }));

    return c.json({
      agents,
      count: agents.length,
    });
  } catch (error) {
    console.error('[Agents API] Error querying agents:', error);
    return c.json({ error: 'Failed to query agents' }, 500);
  }
});

/**
 * GET /api/agents/:id
 * Get details for a specific agent
 *
 * Returns: Agent details with status information
 */
agents.get('/:id', async (c) => {
  // Check admin password
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const providedPassword = authHeader.substring(7); // Remove "Bearer "
  if (providedPassword !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  const agentId = c.req.param('id');

  // Query agent from D1
  try {
    const result = await c.env.DB.prepare(
      `SELECT id, name, status, last_seen, created_at, metadata FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!result) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const agent = {
      id: result.id,
      name: result.name,
      status: result.status,
      lastSeen: result.last_seen,
      createdAt: result.created_at,
      metadata: result.metadata ? JSON.parse(result.metadata as string) : {},
    };

    return c.json(agent);
  } catch (error) {
    console.error('[Agents API] Error querying agent:', error);
    return c.json({ error: 'Failed to query agent' }, 500);
  }
});

export { agents };
