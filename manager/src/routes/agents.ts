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
 * POST /api/agents/:id/ports/check
 * Check port availability on a specific agent
 *
 * Body: { ports: [16261, 16262, 27015] }
 * Returns: { available: [...], unavailable: [{port, reason, source}] }
 */
agents.post('/:id/ports/check', async (c) => {
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
  const body = await c.req.json();
  if (!body.ports || !Array.isArray(body.ports)) {
    return c.json({ error: 'Missing or invalid ports array' }, 400);
  }

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

    // Get Durable Object for this agent using agent name
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

    // Forward request to Durable Object
    const response = await stub.fetch(`http://do/ports/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ports: body.ports }),
    });

    return new Response(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Agents API] Error checking ports:', error);
    return c.json({ error: 'Failed to check ports' }, 500);
  }
});

/**
 * GET /api/agents/:id/ports/availability
 * Check port availability and suggest next available ports for server creation
 *
 * Query params:
 *   - count (optional): Number of servers to suggest ports for (default: 1)
 *
 * Returns:
 *   - suggestedPorts: { gamePort, udpPort, rconPort }[]
 *   - allocatedPorts: { gamePort, udpPort, rconPort }[] (from DB)
 *   - hostBoundPorts: number[] (from agent)
 */
agents.get('/:id/ports/availability', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const providedPassword = authHeader.substring(7);
  if (providedPassword !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  const agentId = c.req.param('id');
  const count = parseInt(c.req.query('count') || '1', 10);

  if (count < 1 || count > 10) {
    return c.json({ error: 'Count must be between 1 and 10' }, 400);
  }

  try {
    // 1. Get agent info
    const agent = await c.env.DB.prepare(
      `SELECT id, name, status FROM agents WHERE id = ?`
    ).bind(agentId).first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // 2. Get all allocated ports from DB
    const allocatedServers = await c.env.DB.prepare(
      `SELECT game_port, udp_port, rcon_port, name, status FROM servers WHERE agent_id = ? ORDER BY game_port`
    ).bind(agentId).all();

    const allocatedPorts = (allocatedServers.results || []).map((s: any) => ({
      gamePort: s.game_port,
      udpPort: s.udp_port,
      rconPort: s.rcon_port,
      serverName: s.name,
      status: s.status,
    }));

    // Collect all allocated port numbers
    const dbPorts = new Set<number>();
    for (const server of allocatedPorts) {
      dbPorts.add(server.gamePort);
      dbPorts.add(server.udpPort);
      dbPorts.add(server.rconPort);
    }

    // 3. Query agent for host-level port bindings
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

    // Build port range to check (16261-16400, 27015-27100)
    const portsToCheck: number[] = [];
    for (let p = 16261; p <= 16400; p++) {
      portsToCheck.push(p);
    }
    for (let p = 27015; p <= 27100; p++) {
      portsToCheck.push(p);
    }

    const hostCheckResponse = await stub.fetch(`http://do/ports/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ports: portsToCheck }),
    });

    if (!hostCheckResponse.ok) {
      return c.json({ error: 'Failed to check host ports' }, 503);
    }

    const hostCheck: { available: number[]; unavailable: { port: number }[] } =
      await hostCheckResponse.json();

    const hostBoundPorts = new Set(hostCheck.unavailable.map(u => u.port));

    // 4. Find next available port ranges
    const suggestedPorts: { gamePort: number; udpPort: number; rconPort: number }[] = [];
    let currentGamePort = 16261;
    let currentRconPort = 27015;

    while (suggestedPorts.length < count && currentGamePort <= 16400) {
      const gamePort = currentGamePort;
      const udpPort = currentGamePort + 1;
      const rconPort = currentRconPort;

      // Check if all three ports are available
      const allAvailable =
        !dbPorts.has(gamePort) && !hostBoundPorts.has(gamePort) &&
        !dbPorts.has(udpPort) && !hostBoundPorts.has(udpPort) &&
        !dbPorts.has(rconPort) && !hostBoundPorts.has(rconPort);

      if (allAvailable) {
        suggestedPorts.push({ gamePort, udpPort, rconPort });
        // Reserve these ports for next iteration
        dbPorts.add(gamePort);
        dbPorts.add(udpPort);
        dbPorts.add(rconPort);
      }

      currentGamePort += 2;  // Increment by 2 (game + udp are sequential)
      currentRconPort += 1;  // RCON increments by 1
    }

    if (suggestedPorts.length === 0) {
      return c.json({ error: 'No available ports found in range 16261-16400' }, 503);
    }

    return c.json({
      suggestedPorts,
      allocatedPorts,
      hostBoundPorts: Array.from(hostBoundPorts),
      agentStatus: agent.status,
    });

  } catch (error) {
    console.error('[Agents API] Error getting port availability:', error);
    return c.json({ error: 'Failed to get port availability' }, 500);
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

    // Check for port conflicts (DB + host-level)
    // 1. Database check
    const dbConflict = await c.env.DB.prepare(
      `SELECT id, name FROM servers WHERE agent_id = ? AND (game_port = ? OR udp_port = ? OR rcon_port = ?)`
    )
      .bind(agentId, gamePort, udpPort, rconPort)
      .first();

    if (dbConflict) {
      return c.json({
        error: `Port conflict in database: One or more ports (${gamePort}, ${udpPort}, ${rconPort}) already allocated to server '${dbConflict.name}'`,
      }, 409);
    }

    // 2. Host-level check (query agent)
    const doId = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const agentStub = c.env.AGENT_CONNECTION.get(doId);

    const hostCheckResponse = await agentStub.fetch(`http://do/ports/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ports: [gamePort, udpPort, rconPort] }),
    });

    if (!hostCheckResponse.ok) {
      return c.json({ error: 'Failed to verify port availability with agent' }, 503);
    }

    const hostCheck: { available: number[]; unavailable: { port: number; reason: string; source: string }[] } =
      await hostCheckResponse.json();

    if (hostCheck.unavailable.length > 0) {
      const conflicts = hostCheck.unavailable.map(u => `${u.port} (${u.reason})`).join(', ');
      return c.json({
        error: `Port conflict detected on host: ${conflicts}`,
        suggestion: 'Use GET /api/agents/:id/ports/availability to find available ports',
      }, 409);
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
      data_exists: row.data_exists === 1, // Convert SQLite integer to boolean
      deleted_at: row.deleted_at,
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
 * POST /api/agents/:id/servers/sync
 * Sync server statuses with actual container and data existence
 *
 * Queries agent for container list and data existence, then updates DB
 * Returns: Updated server list
 *
 * NOTE: This route must be defined BEFORE /:id/servers/:serverId to avoid matching "sync" as a serverId
 */
agents.post('/:id/servers/sync', async (c) => {
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

    // Get AgentConnection DO and call its sync endpoint
    const doId = c.env.AGENT_CONNECTION.idFromName(agentId);
    const stub = c.env.AGENT_CONNECTION.get(doId);

    const syncResponse = await stub.fetch('http://internal/servers/sync', {
      method: 'POST',
    });

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      console.error(`[Agents API] Sync failed: ${errorText}`);
      return c.json({ error: 'Failed to sync servers' }, syncResponse.status);
    }

    const result = await syncResponse.json();
    return c.json(result);
  } catch (error) {
    console.error('[Agents API] Error syncing servers:', error);
    return c.json({ error: 'Failed to sync servers' }, 500);
  }
});

/**
 * POST /api/agents/:id/servers/:serverId/start
 * Start a server (with container recreation if missing)
 *
 * Handles three scenarios:
 * 1. Container exists and stopped → start it
 * 2. Container missing + data exists → recreate container from DB config
 * 3. Container missing + no data → error
 *
 * NOTE: This route must be defined BEFORE /:id/servers/:serverId to avoid matching "start" as a full serverId
 */
agents.post('/:id/servers/:serverId/start', async (c) => {
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

  try {
    // Verify agent exists
    const agent = await c.env.DB.prepare(
      `SELECT id, name, steam_zomboid_registry, server_data_path FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Query server from DB
    const server = await c.env.DB.prepare(
      `SELECT * FROM servers WHERE id = ? AND agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Get AgentConnection DO
    const doId = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(doId);

    // Check current server status
    if (server.status === 'running') {
      return c.json({ error: 'Server is already running' }, 400);
    }

    if (server.status === 'creating' || server.status === 'deleting') {
      return c.json({ error: `Server is currently ${server.status}` }, 400);
    }

    // Scenario 1: Container exists (status='stopped') → start it
    if (server.container_id && server.status === 'stopped') {
      console.log(`[Server Start] Starting existing container: ${server.container_id}`);

      const startResponse = await stub.fetch(
        `http://do/containers/${server.container_id}/start`,
        { method: 'POST' }
      );

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        return c.json({ error: errorData.error || 'Failed to start container' }, startResponse.status);
      }

      // Update status to running
      await c.env.DB.prepare(
        `UPDATE servers SET status = 'running', updated_at = ? WHERE id = ?`
      )
        .bind(Date.now(), serverId)
        .run();

      return c.json({
        success: true,
        message: 'Server started successfully',
        serverId,
        containerId: server.container_id,
      });
    }

    // Scenario 2 & 3: Container missing (status='missing')
    if (server.status === 'missing') {
      // Check if data exists
      if (!server.data_exists) {
        return c.json({
          error: 'Cannot start server: no container or data found',
          suggestion: 'This server is orphaned. Use DELETE to purge it.',
        }, 400);
      }

      // Data exists → recreate container from DB config
      console.log(`[Server Start] Recreating container for server: ${server.name}`);

      // Update status to creating
      await c.env.DB.prepare(
        `UPDATE servers SET status = 'creating', updated_at = ? WHERE id = ?`
      )
        .bind(Date.now(), serverId)
        .run();

      // Parse config from DB
      const config = JSON.parse(server.config as string);

      // Call server.create on agent
      const createResponse = await stub.fetch(`http://do/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: server.id,
          name: server.name,
          registry: agent.steam_zomboid_registry,
          imageTag: server.image_tag,
          config,
          gamePort: server.game_port,
          udpPort: server.udp_port,
          rconPort: server.rcon_port,
          dataPath: agent.server_data_path,
        }),
      });

      if (!createResponse.ok) {
        // Update status back to missing (failed to recreate)
        await c.env.DB.prepare(
          `UPDATE servers SET status = 'missing', updated_at = ? WHERE id = ?`
        )
          .bind(Date.now(), serverId)
          .run();

        const errorData = await createResponse.json();
        return c.json({
          error: errorData.error || 'Failed to recreate container',
        }, createResponse.status);
      }

      const result = await createResponse.json();

      // Update container_id and status to running
      await c.env.DB.prepare(
        `UPDATE servers SET container_id = ?, status = 'running', updated_at = ? WHERE id = ?`
      )
        .bind(result.containerId, Date.now(), serverId)
        .run();

      return c.json({
        success: true,
        message: 'Server container recreated and started successfully',
        serverId,
        containerId: result.containerId,
        recovered: true,
      });
    }

    // Unexpected status
    return c.json({
      error: `Cannot start server with status: ${server.status}`,
    }, 400);
  } catch (error) {
    console.error('[Agents API] Error starting server:', error);
    return c.json({ error: 'Failed to start server' }, 500);
  }
});

/**
 * POST /api/agents/:id/servers/:serverId/stop
 * Stop a server
 *
 * NOTE: This route must be defined BEFORE /:id/servers/:serverId to avoid matching "stop" as a full serverId
 */
agents.post('/:id/servers/:serverId/stop', async (c) => {
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

  try {
    // Verify agent exists
    const agent = await c.env.DB.prepare(
      `SELECT id, name FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Query server from DB
    const server = await c.env.DB.prepare(
      `SELECT * FROM servers WHERE id = ? AND agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Check if server has a container
    if (!server.container_id) {
      return c.json({ error: 'Server has no container to stop' }, 400);
    }

    // Check current status
    if (server.status === 'stopped') {
      return c.json({ error: 'Server is already stopped' }, 400);
    }

    if (server.status !== 'running') {
      return c.json({ error: `Cannot stop server with status: ${server.status}` }, 400);
    }

    // Get AgentConnection DO
    const doId = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(doId);

    // Stop the container
    const stopResponse = await stub.fetch(
      `http://do/containers/${server.container_id}/stop`,
      { method: 'POST' }
    );

    if (!stopResponse.ok) {
      const errorData = await stopResponse.json();
      return c.json({ error: errorData.error || 'Failed to stop container' }, stopResponse.status);
    }

    // Update status to stopped
    await c.env.DB.prepare(
      `UPDATE servers SET status = 'stopped', updated_at = ? WHERE id = ?`
    )
      .bind(Date.now(), serverId)
      .run();

    return c.json({
      success: true,
      message: 'Server stopped successfully',
      serverId,
      containerId: server.container_id,
    });
  } catch (error) {
    console.error('[Agents API] Error stopping server:', error);
    return c.json({ error: 'Failed to stop server' }, 500);
  }
});

/**
 * DELETE /api/agents/:id/servers/failed
 * Bulk cleanup of all failed servers for a specific agent
 *
 * Query params: removeVolumes=true|false (default: false)
 * Returns: Count of deleted servers
 *
 * NOTE: This route must be defined BEFORE /:id/servers/:serverId to avoid matching "failed" as a serverId
 */
agents.delete('/:id/servers/failed', async (c) => {
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
  const removeVolumes = c.req.query('removeVolumes') === 'true';

  try {
    // Verify agent exists
    const agent = await c.env.DB.prepare(
      `SELECT id, name FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get all failed servers for this agent
    const failedServers = await c.env.DB.prepare(
      `SELECT id, name, container_id FROM servers WHERE agent_id = ? AND status = 'failed'`
    )
      .bind(agentId)
      .all();

    if (!failedServers.results || failedServers.results.length === 0) {
      return c.json({
        success: true,
        message: 'No failed servers to clean up',
        deletedCount: 0,
      });
    }

    // Get Durable Object for this agent (for container cleanup)
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete each failed server
    for (const server of failedServers.results) {
      try {
        // Try to delete container if it exists
        if (server.container_id) {
          await stub.fetch(`http://do/servers/${server.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              containerId: server.container_id,
              removeVolumes,
            }),
          });
        }

        // Delete from database
        await c.env.DB.prepare(
          `DELETE FROM servers WHERE id = ?`
        )
          .bind(server.id)
          .run();

        deletedCount++;
      } catch (error) {
        console.error(`[Agents API] Error deleting failed server ${server.name}:`, error);
        errors.push(`Failed to delete ${server.name}`);
      }
    }

    if (errors.length > 0) {
      return c.json({
        success: true,
        message: `Cleaned up ${deletedCount} of ${failedServers.results.length} failed servers`,
        deletedCount,
        errors,
      });
    }

    return c.json({
      success: true,
      message: `Cleaned up ${deletedCount} failed server(s)`,
      deletedCount,
    });
  } catch (error) {
    console.error('[Agents API] Error bulk cleaning failed servers:', error);
    return c.json({ error: 'Failed to cleanup failed servers' }, 500);
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

/**
 * POST /api/agents/:id/servers/:serverId/rebuild
 * Rebuild a server with latest image (pulls fresh image, recreates container, preserves volumes)
 *
 * Returns: Updated server object with new container_id
 */
agents.post('/:id/servers/:serverId/rebuild', async (c) => {
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

  try {
    // Verify server exists and belongs to agent
    const server = await c.env.DB.prepare(
      `SELECT id, container_id, name FROM servers WHERE id = ? AND agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    if (!server.container_id) {
      return c.json({ error: 'Server has no container to rebuild (never started)' }, 400);
    }

    // Update status to rebuilding
    await c.env.DB.prepare(
      `UPDATE servers SET status = 'rebuilding', updated_at = ? WHERE id = ?`
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
    const doId = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const agentStub = c.env.AGENT_CONNECTION.get(doId);

    // Forward server.rebuild message to Durable Object
    const response = await agentStub.fetch(`http://do/servers/${serverId}/rebuild`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerId: server.container_id,
      }),
    });

    if (!response.ok) {
      // Update status back to failed
      await c.env.DB.prepare(
        `UPDATE servers SET status = 'failed', updated_at = ? WHERE id = ?`
      )
        .bind(Date.now(), serverId)
        .run();

      const errorData = await response.json();
      return c.json({ error: errorData.error || 'Failed to rebuild server on agent' }, response.status);
    }

    const result = await response.json() as { success: boolean; newContainerID: string };

    // Update database with new container_id
    const now = Date.now();
    await c.env.DB.prepare(
      `UPDATE servers SET container_id = ?, status = 'running', updated_at = ? WHERE id = ?`
    )
      .bind(result.newContainerID, now, serverId)
      .run();

    // Fetch updated server
    const updatedServer = await c.env.DB.prepare(
      `SELECT * FROM servers WHERE id = ?`
    )
      .bind(serverId)
      .first();

    return c.json({
      success: true,
      message: `Server '${server.name}' rebuilt successfully`,
      server: updatedServer,
    });
  } catch (error) {
    console.error('[Agents API] Error rebuilding server:', error);
    return c.json({ error: 'Failed to rebuild server' }, 500);
  }
});

/**
 * DELETE /api/agents/:id/servers/failed
 * Bulk cleanup of all failed servers for a specific agent
 *
 * Query params: removeVolumes=true|false (default: false)
 * Returns: Count of deleted servers
 */
agents.delete(':id/servers/failed', async (c) => {
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
  const removeVolumes = c.req.query('removeVolumes') === 'true';

  try {
    // Verify agent exists
    const agent = await c.env.DB.prepare(
      `SELECT id, name FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get all failed servers for this agent
    const failedServers = await c.env.DB.prepare(
      `SELECT id, name, container_id FROM servers WHERE agent_id = ? AND status = 'failed'`
    )
      .bind(agentId)
      .all();

    if (!failedServers.results || failedServers.results.length === 0) {
      return c.json({
        success: true,
        message: 'No failed servers to clean up',
        deletedCount: 0,
      });
    }

    // Get Durable Object for this agent (for container cleanup)
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete each failed server
    for (const server of failedServers.results) {
      try {
        // Try to delete container if it exists
        if (server.container_id) {
          await stub.fetch(`http://do/servers/${server.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              containerId: server.container_id,
              removeVolumes,
            }),
          });
        }

        // Delete from database
        await c.env.DB.prepare(
          `DELETE FROM servers WHERE id = ?`
        )
          .bind(server.id)
          .run();

        deletedCount++;
      } catch (error) {
        console.error(`[Agents API] Error deleting failed server ${server.name}:`, error);
        errors.push(`Failed to delete ${server.name}`);
      }
    }

    if (errors.length > 0) {
      return c.json({
        success: true,
        message: `Cleaned up ${deletedCount} of ${failedServers.results.length} failed servers`,
        deletedCount,
        errors,
      });
    }

    return c.json({
      success: true,
      message: `Cleaned up ${deletedCount} failed server(s)`,
      deletedCount,
    });
  } catch (error) {
    console.error('[Agents API] Error bulk cleaning failed servers:', error);
    return c.json({ error: 'Failed to cleanup failed servers' }, 500);
  }
});

export { agents };
