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
  AGENT_CONNECTIONS: DurableObjectNamespace;
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

/**
 * GET /api/agents/:id/containers
 * List containers for a specific agent
 *
 * Returns: Array of containers with their status
 */
agents.get('/:id/containers', async (c) => {
  // Check admin password
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const providedPassword = authHeader.substring(7);
  if (providedPassword !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  const agentId = c.req.param('id');

  // Verify agent exists
  try {
    const agent = await c.env.DB.prepare(
      `SELECT id, name, status FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get Durable Object for this agent
    const id = c.env.AGENT_CONNECTIONS.idFromName(agentId);
    const stub = c.env.AGENT_CONNECTIONS.get(id);

    // Forward request to Durable Object
    const response = await stub.fetch(`http://do/containers`, {
      method: 'GET',
    });

    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Agents API] Error fetching containers:', error);
    return c.json({ error: 'Failed to fetch containers' }, 500);
  }
});

/**
 * POST /api/agents/:id/containers/:containerId/start
 * Start a container on a specific agent
 */
agents.post('/:id/containers/:containerId/start', async (c) => {
  // Check admin password
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const providedPassword = authHeader.substring(7);
  if (providedPassword !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  const agentId = c.req.param('id');
  const containerId = c.req.param('containerId');

  // Get Durable Object for this agent
  try {
    const id = c.env.AGENT_CONNECTIONS.idFromName(agentId);
    const stub = c.env.AGENT_CONNECTIONS.get(id);

    // Forward request to Durable Object
    const response = await stub.fetch(
      `http://do/containers/${containerId}/start`,
      {
        method: 'POST',
      }
    );

    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Agents API] Error starting container:', error);
    return c.json({ error: 'Failed to start container' }, 500);
  }
});

/**
 * POST /api/agents/:id/containers/:containerId/stop
 * Stop a container on a specific agent
 */
agents.post('/:id/containers/:containerId/stop', async (c) => {
  // Check admin password
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const providedPassword = authHeader.substring(7);
  if (providedPassword !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  const agentId = c.req.param('id');
  const containerId = c.req.param('containerId');

  // Get Durable Object for this agent
  try {
    const id = c.env.AGENT_CONNECTIONS.idFromName(agentId);
    const stub = c.env.AGENT_CONNECTIONS.get(id);

    // Forward request to Durable Object
    const response = await stub.fetch(
      `http://do/containers/${containerId}/stop`,
      {
        method: 'POST',
      }
    );

    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Agents API] Error stopping container:', error);
    return c.json({ error: 'Failed to stop container' }, 500);
  }
});

/**
 * POST /api/agents/:id/containers/:containerId/restart
 * Restart a container on a specific agent
 */
agents.post('/:id/containers/:containerId/restart', async (c) => {
  // Check admin password
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const providedPassword = authHeader.substring(7);
  if (providedPassword !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  const agentId = c.req.param('id');
  const containerId = c.req.param('containerId');

  // Get Durable Object for this agent
  try {
    const id = c.env.AGENT_CONNECTIONS.idFromName(agentId);
    const stub = c.env.AGENT_CONNECTIONS.get(id);

    // Forward request to Durable Object
    const response = await stub.fetch(
      `http://do/containers/${containerId}/restart`,
      {
        method: 'POST',
      }
    );

    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Agents API] Error restarting container:', error);
    return c.json({ error: 'Failed to restart container' }, 500);
  }
});

export { agents };
