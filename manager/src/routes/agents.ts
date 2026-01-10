/**
 * Agent management API endpoints
 *
 * Public endpoints for querying agent status.
 * Protected by admin authentication (MVP).
 */

import { Hono } from 'hono';
import { CreateServerRequest, DeleteServerRequest } from '../types/Server';

type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  AGENT_CONNECTION: DurableObjectNamespace;
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

    // Get Durable Object for this agent using agent name (not ID)
    // This matches the WebSocket connection which uses ?name=<agent-name>
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

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

  // Verify agent exists and get name
  try {
    const agent = await c.env.DB.prepare(
      `SELECT id, name FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get Durable Object for this agent using agent name
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

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

  // Verify agent exists and get name
  try {
    const agent = await c.env.DB.prepare(
      `SELECT id, name FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get Durable Object for this agent using agent name
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

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

  // Verify agent exists and get name
  try {
    const agent = await c.env.DB.prepare(
      `SELECT id, name FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get Durable Object for this agent using agent name
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

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

/**
 * GET /api/agents/:id/logs/ws
 * WebSocket endpoint for log streaming
 *
 * UI clients connect here to receive container logs
 * Password authentication via query parameter (since WebSocket doesn't support headers)
 */
agents.get('/:id/logs/ws', async (c) => {
  const agentId = c.req.param('id');

  // Check admin password from query parameter
  const password = c.req.query('password');
  if (!password || password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid or missing password' }, 401);
  }

  // Verify agent exists and get name
  try {
    const agent = await c.env.DB.prepare(
      `SELECT id, name FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get Durable Object for this agent using agent name
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

    // Forward WebSocket upgrade request to Durable Object
    return stub.fetch(`http://do/logs/ws`, {
      method: 'GET',
      headers: c.req.raw.headers,
    });
  } catch (error) {
    console.error('[Agents API] Error establishing log WebSocket:', error);
    return c.json({ error: 'Failed to connect to agent' }, 500);
  }
});

/**
 * POST /api/agents/:id/servers
 * Create a new server on a specific agent
 *
 * Body: { name, imageTag, config, gamePort?, udpPort?, rconPort? }
 * Returns: Created server object
 */
agents.post('/:id/servers', async (c) => {
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

  // Parse request body
  let body: CreateServerRequest;
  try {
    body = await c.req.json();
  } catch (error) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  // Validate required fields
  if (!body.name || !body.imageTag || !body.config) {
    return c.json({ error: 'Missing required fields: name, imageTag, config' }, 400);
  }

  // Validate server name (DNS-safe: lowercase, alphanumeric, hyphens, 3-32 chars)
  const nameRegex = /^[a-z][a-z0-9-]{2,31}$/;
  if (!nameRegex.test(body.name)) {
    return c.json({
      error: 'Invalid server name. Must be 3-32 characters, start with letter, lowercase alphanumeric and hyphens only.',
    }, 400);
  }

  try {
    // Verify agent exists and get registry + data path
    const agent = await c.env.DB.prepare(
      `SELECT id, name, steam_zomboid_registry, server_data_path FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Check for name conflict
    const existingName = await c.env.DB.prepare(
      `SELECT id FROM servers WHERE agent_id = ? AND name = ?`
    )
      .bind(agentId, body.name)
      .first();

    if (existingName) {
      return c.json({ error: `Server with name '${body.name}' already exists on this agent` }, 409);
    }

    // Auto-suggest ports if not provided
    let gamePort = body.gamePort;
    let udpPort = body.udpPort;
    let rconPort = body.rconPort;

    if (!gamePort) {
      // Find highest game_port and add 2
      const maxPortResult = await c.env.DB.prepare(
        `SELECT MAX(game_port) as max_port FROM servers WHERE agent_id = ?`
      )
        .bind(agentId)
        .first();

      const maxPort = maxPortResult?.max_port as number | null;
      gamePort = maxPort ? maxPort + 2 : 16261;
    }

    if (!udpPort) {
      udpPort = gamePort + 1;
    }

    if (!rconPort) {
      // Find highest rcon_port and add 1
      const maxRconResult = await c.env.DB.prepare(
        `SELECT MAX(rcon_port) as max_rcon FROM servers WHERE agent_id = ?`
      )
        .bind(agentId)
        .first();

      const maxRcon = maxRconResult?.max_rcon as number | null;
      rconPort = maxRcon ? maxRcon + 1 : 27015;
    }

    // Check for port conflicts
    const portConflict = await c.env.DB.prepare(
      `SELECT id FROM servers WHERE agent_id = ? AND (game_port = ? OR rcon_port = ?)`
    )
      .bind(agentId, gamePort, rconPort)
      .first();

    if (portConflict) {
      return c.json({ error: `Port conflict: game_port ${gamePort} or rcon_port ${rconPort} already in use` }, 409);
    }

    // Generate server ID
    const serverId = crypto.randomUUID();
    const now = Date.now();

    // Store in D1 with status='creating'
    await c.env.DB.prepare(
      `INSERT INTO servers (id, agent_id, name, container_id, config, image_tag, game_port, udp_port, rcon_port, status, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'creating', ?, ?)`
    )
      .bind(
        serverId,
        agentId,
        body.name,
        JSON.stringify(body.config),
        body.imageTag,
        gamePort,
        udpPort,
        rconPort,
        now,
        now
      )
      .run();

    // Get Durable Object for this agent
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

    // Forward server.create message to Durable Object
    const response = await stub.fetch(`http://do/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId,
        name: body.name,
        registry: agent.steam_zomboid_registry,
        imageTag: body.imageTag,
        config: body.config,
        gamePort,
        udpPort,
        rconPort,
        dataPath: agent.server_data_path,
      }),
    });

    if (!response.ok) {
      // Update status to failed
      await c.env.DB.prepare(
        `UPDATE servers SET status = 'failed', updated_at = ? WHERE id = ?`
      )
        .bind(Date.now(), serverId)
        .run();

      const errorData = await response.json();
      return c.json({ error: errorData.error || 'Failed to create server on agent' }, response.status);
    }

    const result = await response.json();

    // Update container_id and status
    await c.env.DB.prepare(
      `UPDATE servers SET container_id = ?, status = 'running', updated_at = ? WHERE id = ?`
    )
      .bind(result.containerId, Date.now(), serverId)
      .run();

    // Return created server
    const server = await c.env.DB.prepare(
      `SELECT * FROM servers WHERE id = ?`
    )
      .bind(serverId)
      .first();

    return c.json({
      success: true,
      server: {
        id: server!.id,
        agent_id: server!.agent_id,
        name: server!.name,
        container_id: server!.container_id,
        config: server!.config,
        image_tag: server!.image_tag,
        game_port: server!.game_port,
        udp_port: server!.udp_port,
        rcon_port: server!.rcon_port,
        status: server!.status,
        created_at: server!.created_at,
        updated_at: server!.updated_at,
      },
    }, 201);
  } catch (error) {
    console.error('[Agents API] Error creating server:', error);
    return c.json({ error: 'Failed to create server' }, 500);
  }
});

/**
 * GET /api/agents/:id/servers
 * List all servers for a specific agent
 *
 * Returns: Array of servers
 */
agents.get('/:id/servers', async (c) => {
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

  try {
    // Verify agent exists
    const agent = await c.env.DB.prepare(
      `SELECT id FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Query all servers for this agent
    const result = await c.env.DB.prepare(
      `SELECT * FROM servers WHERE agent_id = ? ORDER BY created_at DESC`
    )
      .bind(agentId)
      .all();

    const servers = result.results.map((row: any) => ({
      id: row.id,
      agent_id: row.agent_id,
      name: row.name,
      container_id: row.container_id,
      config: row.config,
      image_tag: row.image_tag,
      game_port: row.game_port,
      udp_port: row.udp_port,
      rcon_port: row.rcon_port,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return c.json({
      success: true,
      servers,
    });
  } catch (error) {
    console.error('[Agents API] Error listing servers:', error);
    return c.json({ error: 'Failed to list servers' }, 500);
  }
});

/**
 * DELETE /api/agents/:id/servers/:serverId
 * Delete a server from a specific agent
 *
 * Body (optional): { removeVolumes?: boolean }
 * Returns: Success message
 */
agents.delete('/:id/servers/:serverId', async (c) => {
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
  const serverId = c.req.param('serverId');

  // Parse optional body
  let removeVolumes = false;
  try {
    const body = await c.req.json() as DeleteServerRequest;
    removeVolumes = body.removeVolumes ?? false;
  } catch {
    // No body is fine, use defaults
  }

  try {
    // Verify server exists and belongs to agent
    const server = await c.env.DB.prepare(
      `SELECT id, container_id FROM servers WHERE id = ? AND agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    if (!server.container_id) {
      // Server never started, just delete from DB
      await c.env.DB.prepare(
        `DELETE FROM servers WHERE id = ?`
      )
        .bind(serverId)
        .run();

      return c.json({
        success: true,
        message: 'Server deleted (never started)',
      });
    }

    // Update status to deleting
    await c.env.DB.prepare(
      `UPDATE servers SET status = 'deleting', updated_at = ? WHERE id = ?`
    )
      .bind(Date.now(), serverId)
      .run();

    // Get agent name for Durable Object
    const agent = await c.env.DB.prepare(
      `SELECT name FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get Durable Object for this agent
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

    // Forward server.delete message to Durable Object
    const response = await stub.fetch(`http://do/servers/${serverId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerId: server.container_id,
        removeVolumes,
      }),
    });

    if (!response.ok) {
      // Update status back to previous state (failed)
      await c.env.DB.prepare(
        `UPDATE servers SET status = 'failed', updated_at = ? WHERE id = ?`
      )
        .bind(Date.now(), serverId)
        .run();

      const errorData = await response.json();
      return c.json({ error: errorData.error || 'Failed to delete server on agent' }, response.status);
    }

    // Delete from database
    await c.env.DB.prepare(
      `DELETE FROM servers WHERE id = ?`
    )
      .bind(serverId)
      .run();

    return c.json({
      success: true,
      message: removeVolumes ? 'Server and volumes deleted' : 'Server deleted (volumes preserved)',
    });
  } catch (error) {
    console.error('[Agents API] Error deleting server:', error);
    return c.json({ error: 'Failed to delete server' }, 500);
  }
});

export { agents };
