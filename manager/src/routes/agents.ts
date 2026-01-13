/**
 * Agent management API endpoints
 *
 * All endpoints require authentication.
 * Permission checks applied per-endpoint based on operation type.
 */

import { Hono } from 'hono';
import { CreateServerRequest, DeleteServerRequest } from '../types/Server';
import { requireAuth } from '../middleware/auth';
import {
  canViewServer,
  canControlServer,
  canDeleteServer,
  canCreateServer,
  canUseRcon,
  getUserVisibleServers,
  getUserRoleAssignments,
  getEffectiveRoleForAgent,
} from '../lib/permissions';

type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  AGENT_CONNECTION: DurableObjectNamespace;
  TOKEN_SECRET: string;
};

const agents = new Hono<{ Bindings: Bindings }>();

// Apply authentication middleware to all routes EXCEPT WebSocket endpoint
// WebSocket endpoint (/logs/ws) handles its own auth via query parameter
agents.use('*', async (c, next) => {
  // Skip middleware for WebSocket endpoint (it does its own JWT auth from query param)
  if (c.req.path.endsWith('/logs/ws')) {
    await next();
    return;
  }
  // All other routes use standard JWT auth from Authorization header
  return requireAuth()(c, next);
});

/**
 * GET /api/agents
 * List registered agents (filtered by user access)
 *
 * Returns: Array of agents user has access to
 * Permission:
 *   - Admin: All agents
 *   - Non-admin: Agents where user has role assignments (global/agent/server scope)
 */
agents.get('/', async (c) => {
  const user = c.get('user');

  try {
    let agentIds: Set<string> | null = null;

    // Non-admin users: Filter agents by role assignments
    if (user.role !== 'admin') {
      const assignments = await getUserRoleAssignments(c.env.DB, user.id);
      agentIds = new Set<string>();

      for (const assignment of assignments) {
        // Global scope: User has access to all agents
        if (assignment.scope === 'global') {
          agentIds = null; // Signal to fetch all agents
          break;
        }

        // Agent scope: User has access to this specific agent
        if (assignment.scope === 'agent' && assignment.resource_id) {
          agentIds.add(assignment.resource_id);
        }

        // Server scope: Find which agent this server belongs to
        if (assignment.scope === 'server' && assignment.resource_id) {
          const server = await c.env.DB.prepare(
            'SELECT agent_id FROM servers WHERE id = ?'
          )
            .bind(assignment.resource_id)
            .first<{ agent_id: string }>();

          if (server && server.agent_id) {
            agentIds.add(server.agent_id);
          }
        }
      }

      // If user has no assignments and no global access, return empty list
      if (agentIds && agentIds.size === 0) {
        return c.json({ agents: [], count: 0 });
      }
    }

    // Build query based on access level
    let query: string;
    let params: string[] = [];

    if (agentIds === null) {
      // Admin or global access: Fetch all agents
      query = `SELECT id, name, status, last_seen, created_at, metadata FROM agents ORDER BY created_at DESC`;
    } else {
      // Specific agent access: Fetch only accessible agents
      const placeholders = Array.from(agentIds).map(() => '?').join(',');
      query = `SELECT id, name, status, last_seen, created_at, metadata FROM agents WHERE id IN (${placeholders}) ORDER BY created_at DESC`;
      params = Array.from(agentIds);
    }

    const result = await c.env.DB.prepare(query).bind(...params).all();

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
 * Permission: Admin only
 */
agents.get('/:id', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');

  // Only admins can view agent details (for now)
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

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
 * Permission: User must have any role assignment on this agent (global, agent, or server scope)
 */
agents.get('/:id/containers', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');

  // Check if user has access to this agent
  if (user.role !== 'admin') {
    // Check for agent-level or global role assignment
    const effectiveRole = await getEffectiveRoleForAgent(c.env.DB, user.id, user.role, agentId);

    if (!effectiveRole) {
      // No agent-level role, check if user has any server-level access on this agent
      const visibleServerIds = await getUserVisibleServers(c.env.DB, user.id, user.role);

      // Check if any visible server belongs to this agent
      const serversOnAgent = await c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM servers WHERE agent_id = ? AND id IN (' +
          visibleServerIds.map(() => '?').join(',') +
          ')'
      )
        .bind(agentId, ...visibleServerIds)
        .first<{ count: number }>();

      if (!serversOnAgent || serversOnAgent.count === 0) {
        return c.json(
          { error: 'Forbidden - no access to this agent or any servers on it' },
          403
        );
      }
    }
  }

  // Verify agent exists
  try {
    const agent = await c.env.DB.prepare(`SELECT id, name, status FROM agents WHERE id = ?`)
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
  const user = c.get('user');
  const agentId = c.req.param('id');

  // Only admins can check ports (administrative operation)
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

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
  const user = c.get('user');
  const agentId = c.req.param('id');
  const count = parseInt(c.req.query('count') || '1', 10);

  // Only admins can check port availability (administrative operation)
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

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
  const user = c.get('user');
  const agentId = c.req.param('id');
  const containerId = c.req.param('containerId');

  // Only admins can control containers directly (administrative operation)
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
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
  const user = c.get('user');
  const agentId = c.req.param('id');
  const containerId = c.req.param('containerId');

  // Find server by container_id to check permissions
  try {
    const server = await c.env.DB.prepare(
      'SELECT id FROM servers WHERE container_id = ? AND agent_id = ?'
    )
      .bind(containerId, agentId)
      .first<{ id: string }>();

    if (!server) {
      return c.json({ error: 'Server not found for this container' }, 404);
    }

    // Check if user has control permission on this server
    const hasPermission = await canControlServer(c.env.DB, user.id, user.role, server.id);
    if (!hasPermission) {
      return c.json({ error: 'Forbidden - requires operator or higher role for this server' }, 403);
    }

    // Verify agent exists and get name
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
  const user = c.get('user');
  const agentId = c.req.param('id');
  const containerId = c.req.param('containerId');

  // Find server by container_id to check permissions
  try {
    const server = await c.env.DB.prepare(
      'SELECT id FROM servers WHERE container_id = ? AND agent_id = ?'
    )
      .bind(containerId, agentId)
      .first<{ id: string }>();

    if (!server) {
      return c.json({ error: 'Server not found for this container' }, 404);
    }

    // Check if user has control permission on this server
    const hasPermission = await canControlServer(c.env.DB, user.id, user.role, server.id);
    if (!hasPermission) {
      return c.json({ error: 'Forbidden - requires operator or higher role for this server' }, 403);
    }

    // Verify agent exists and get name
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
 * JWT authentication via query parameter (since WebSocket doesn't support custom headers in browser)
 */
agents.get('/:id/logs/ws', async (c) => {
  console.log('[Agents API] ===== WEBSOCKET ENDPOINT CALLED =====');
  const agentId = c.req.param('id');
  console.log(`[Agents API] Agent ID: ${agentId}`);

  // Authenticate via JWT token in query parameter
  const token = c.req.query('token');
  console.log(`[Agents API] Token present: ${!!token}`);
  if (!token) {
    console.log('[Agents API] No token, returning 401');
    return c.json({ error: 'Unauthorized - Missing token parameter' }, 401);
  }

  // Verify JWT token and session
  try {
    const { verifySessionToken, hashToken } = await import('../lib/auth');

    // Verify JWT signature
    const payload = await verifySessionToken(token, c.env.TOKEN_SECRET);

    // Verify session exists in database
    const tokenHash = await hashToken(token);
    const now = Date.now();

    const session = await c.env.DB.prepare(
      'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?'
    )
      .bind(tokenHash, now)
      .first<{ user_id: string }>();

    if (!session) {
      return c.json({ error: 'Unauthorized - Session expired or invalid' }, 401);
    }

    // Get user to verify they exist (permissions will be checked per-server in Durable Object)
    const user = await c.env.DB.prepare(
      'SELECT id, email, role FROM users WHERE id = ?'
    )
      .bind(session.user_id)
      .first<{ id: string; email: string; role: string | null }>();

    if (!user) {
      console.log('[Agents API] User not found in DB');
      return c.json({ error: 'Unauthorized - User not found' }, 401);
    }

    console.log(`[Agents API] Auth successful for user: ${user.email}`);
  } catch (error) {
    console.error('[Agents API] WebSocket auth error:', error);
    return c.json({ error: 'Unauthorized - Invalid or expired token' }, 401);
  }

  console.log('[Agents API] Starting agent lookup...');

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

    console.log(`[Agents API] Forwarding WebSocket to DO for agent: ${agent.name}`);

    // Get Durable Object for this agent using agent name
    const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(id);

    console.log(`[Agents API] DO stub obtained, forwarding request`);

    // Forward the ORIGINAL WebSocket request to Durable Object
    // The DO will handle routing based on the pathname
    console.log(`[Agents API] Calling stub.fetch() with original request`);
    console.log(`[Agents API] Original URL: ${c.req.raw.url}`);
    const response = await stub.fetch(c.req.raw);
    console.log(`[Agents API] stub.fetch() returned, status: ${response.status}`);

    return response;
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
  const user = c.get('user');
  const agentId = c.req.param('id');

  // Check if user can create servers on this agent (admin or agent-admin)
  const hasPermission = await canCreateServer(c.env.DB, user.id, user.role, agentId);
  if (!hasPermission) {
    return c.json({ error: 'Forbidden - requires admin or agent-admin role for this agent' }, 403);
  }

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

    // Add RCON_PORT to config so container knows what port to listen on
    const configWithRconPort = {
      ...body.config,
      RCON_PORT: rconPort.toString(),
    };

    // Forward server.create message to Durable Object
    const response = await stub.fetch(`http://do/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId,
        name: body.name,
        registry: agent.steam_zomboid_registry,
        imageTag: body.imageTag,
        config: configWithRconPort,
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
  const user = c.get('user');
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

    // Filter servers based on user permissions
    let serverRows = result.results || [];

    if (user.role !== 'admin') {
      // Non-admins only see servers they have permission to view
      const visibleServerIds = await getUserVisibleServers(c.env.DB, user.id, user.role);
      serverRows = serverRows.filter((server: any) => visibleServerIds.includes(server.id));
    }

    const servers = serverRows.map((row: any) => ({
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
  const user = c.get('user');
  const agentId = c.req.param('id');

  // Only admins can sync server statuses (administrative operation)
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

  try {
    // Verify agent exists and get name
    const agent = await c.env.DB.prepare(
      `SELECT id, name FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get AgentConnection DO using agent NAME (not ID)
    const doId = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(doId);

    const syncResponse = await stub.fetch('http://internal/servers/sync', {
      method: 'POST',
      headers: {
        'X-Agent-Id': agentId, // Pass agentId via header
      },
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
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');

  try {
    // Check permission to control server
    const hasPermission = await canControlServer(c.env.DB, user.id, user.role, serverId);
    if (!hasPermission) {
      return c.json({ error: 'Forbidden - you do not have permission to control this server' }, 403);
    }
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

      // Parse config from DB and add RCON_PORT
      const config = JSON.parse(server.config as string);
      const configWithRconPort = {
        ...config,
        RCON_PORT: (server.rcon_port as number).toString(),
      };

      // Call server.create on agent
      const createResponse = await stub.fetch(`http://do/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: server.id,
          name: server.name,
          registry: agent.steam_zomboid_registry,
          imageTag: server.image_tag,
          config: configWithRconPort,
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
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');

  try {
    // Check permission to control server
    const hasPermission = await canControlServer(c.env.DB, user.id, user.role, serverId);
    if (!hasPermission) {
      return c.json({ error: 'Forbidden - you do not have permission to control this server' }, 403);
    }
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
  const user = c.get('user');
  const agentId = c.req.param('id');

  // Only admins can bulk cleanup failed servers
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }
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
 * Soft delete a server (removes container, preserves data and DB record)
 *
 * Sets deleted_at timestamp and status='deleted'
 * Container is removed but data is preserved for 24 hours
 * Use RESTORE to recover or PURGE to permanently delete
 *
 * Returns: Success message with deletedAt timestamp
 */
agents.delete('/:id/servers/:serverId', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');

  try {
    // Check permission to delete server
    const hasPermission = await canDeleteServer(c.env.DB, user.id, user.role, serverId);
    if (!hasPermission) {
      return c.json({ error: 'Forbidden - you do not have permission to delete this server' }, 403);
    }
    // Verify server exists and belongs to agent
    const server = await c.env.DB.prepare(
      `SELECT id, container_id, status FROM servers WHERE id = ? AND agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Check if already deleted
    if (server.status === 'deleted') {
      return c.json({ error: 'Server is already deleted. Use PURGE to permanently remove.' }, 400);
    }

    // Soft delete: set deleted_at and status='deleted'
    const now = Date.now();
    await c.env.DB.prepare(
      `UPDATE servers SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?`
    )
      .bind(now, now, serverId)
      .run();

    // If server has a container, remove it (but preserve data)
    if (server.container_id) {
      // Get agent name for Durable Object
      const agent = await c.env.DB.prepare(
        `SELECT name FROM agents WHERE id = ?`
      )
        .bind(agentId)
        .first();

      if (agent) {
        // Get Durable Object for this agent
        const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
        const stub = c.env.AGENT_CONNECTION.get(id);

        // Forward server.delete message to Durable Object (preserve volumes)
        try {
          await stub.fetch(`http://do/servers/${serverId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              containerId: server.container_id,
              removeVolumes: false, // Always preserve data on soft delete
            }),
          });
          console.log(`[Soft Delete] Container removed for server ${serverId}`);
        } catch (error) {
          console.error(`[Soft Delete] Failed to remove container for server ${serverId}:`, error);
          // Don't fail the soft delete if container removal fails
        }
      }
    }

    return c.json({
      success: true,
      message: 'Server soft deleted. Data preserved for 24 hours. Use RESTORE to recover or PURGE to permanently delete.',
      serverId,
      deletedAt: now,
    });
  } catch (error) {
    console.error('[Agents API] Error soft deleting server:', error);
    return c.json({ error: 'Failed to delete server' }, 500);
  }
});

/**
 * DELETE /api/agents/:id/servers/:serverId/purge
 * Permanently delete a server (hard delete)
 *
 * Removes:
 * - Container (if exists)
 * - Data directories (optional, via removeData query param or body)
 * - Database record
 *
 * Query params: removeData=true|false (default: false)
 * Body (optional): { removeData?: boolean }
 *
 * NOTE: This route must be defined BEFORE /:id/servers/:serverId/rebuild
 */
agents.delete('/:id/servers/:serverId/purge', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');

  // Only admins can permanently purge servers (destructive operation)
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

  // Get removeData from query param or body
  const queryRemoveData = c.req.query('removeData') === 'true';
  let removeData = queryRemoveData;

  try {
    const body = await c.req.json() as { removeData?: boolean };
    removeData = body.removeData ?? removeData;
  } catch {
    // No body is fine, use query param or default
  }

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

    // If server has a container, remove it
    if (server.container_id) {
      // Get agent name for Durable Object
      const agent = await c.env.DB.prepare(
        `SELECT name FROM agents WHERE id = ?`
      )
        .bind(agentId)
        .first();

      if (agent) {
        // Get Durable Object for this agent
        const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
        const stub = c.env.AGENT_CONNECTION.get(id);

        // Forward server.delete message to Durable Object
        try {
          const response = await stub.fetch(`http://do/servers/${serverId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              containerId: server.container_id,
              removeVolumes: removeData, // Remove data if requested
            }),
          });

          if (!response.ok) {
            console.error(`[Purge] Failed to remove container for server ${serverId}`);
            // Continue with DB deletion even if container removal fails
          } else {
            console.log(`[Purge] Container removed for server ${serverId} (data removed: ${removeData})`);
          }
        } catch (error) {
          console.error(`[Purge] Error removing container for server ${serverId}:`, error);
          // Continue with DB deletion
        }
      }
    }

    // Delete from database (hard delete)
    await c.env.DB.prepare(
      `DELETE FROM servers WHERE id = ?`
    )
      .bind(serverId)
      .run();

    console.log(`[Purge] Server ${server.name} (${serverId}) permanently deleted`);

    return c.json({
      success: true,
      message: removeData
        ? 'Server permanently deleted (container and data removed)'
        : 'Server permanently deleted (container removed, data preserved on host)',
      serverId,
      serverName: server.name,
    });
  } catch (error) {
    console.error('[Agents API] Error purging server:', error);
    return c.json({ error: 'Failed to purge server' }, 500);
  }
});

/**
 * POST /api/agents/:id/servers/:serverId/restore
 * Restore a soft-deleted server
 *
 * Sets deleted_at=NULL and status='missing'
 * User can then start the server to recreate container
 *
 * NOTE: This route must be defined BEFORE /:id/servers/:serverId/rebuild
 */
agents.post('/:id/servers/:serverId/restore', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');

  // Only admins can restore deleted servers
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

  try {
    // Verify server exists and belongs to agent
    const server = await c.env.DB.prepare(
      `SELECT id, status, deleted_at, name FROM servers WHERE id = ? AND agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Check if server is deleted
    if (server.status !== 'deleted' || !server.deleted_at) {
      return c.json({ error: 'Server is not deleted. Only deleted servers can be restored.' }, 400);
    }

    // Restore: clear deleted_at and set status to 'missing'
    const now = Date.now();
    await c.env.DB.prepare(
      `UPDATE servers SET status = 'missing', deleted_at = NULL, updated_at = ? WHERE id = ?`
    )
      .bind(now, serverId)
      .run();

    console.log(`[Restore] Server ${server.name} (${serverId}) restored`);

    return c.json({
      success: true,
      message: 'Server restored successfully. Use START to recreate container.',
      serverId,
      serverName: server.name,
    });
  } catch (error) {
    console.error('[Agents API] Error restoring server:', error);
    return c.json({ error: 'Failed to restore server' }, 500);
  }
});

/**
 * POST /api/agents/:id/servers/:serverId/rebuild
 * Rebuild a server with latest image (pulls fresh image, recreates container, preserves volumes)
 *
 * Returns: Updated server object with new container_id
 */
agents.post('/:id/servers/:serverId/rebuild', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');

  // Check if user has control permission on this server (rebuild = stop + remove + recreate)
  const hasPermission = await canControlServer(c.env.DB, user.id, user.role, serverId);
  if (!hasPermission) {
    return c.json({ error: 'Forbidden - requires operator or higher role for this server' }, 403);
  }

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
  const user = c.get('user');
  const agentId = c.req.param('id');

  // Only admins can bulk cleanup failed servers
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }
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
