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
import { logServerCreated, logServerOperation } from '../lib/audit';

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
 * GET /api/agents/:id/config
 * Get agent configuration
 *
 * Returns: Agent configuration (server_data_path, steam_zomboid_registry)
 * Permission: Admin only
 */
agents.get('/:id/config', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');

  // Only admins can view agent configuration
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

  try {
    // Query agent configuration from database
    const agent = await c.env.DB.prepare(
      `SELECT id, name, server_data_path, steam_zomboid_registry FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    return c.json({
      success: true,
      config: {
        server_data_path: agent.server_data_path,
        steam_zomboid_registry: agent.steam_zomboid_registry,
      },
    });
  } catch (error) {
    console.error('[Agents API] Error getting agent config:', error);
    return c.json({ error: 'Failed to get agent configuration' }, 500);
  }
});

/**
 * PUT /api/agents/:id/config
 * Update agent configuration
 *
 * Body: { server_data_path?: string, steam_zomboid_registry?: string }
 * Returns: Updated configuration
 * Permission: Admin only
 */
agents.put('/:id/config', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');

  // Only admins can update agent configuration
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

  // Parse request body
  let body: { server_data_path?: string; steam_zomboid_registry?: string };
  try {
    body = await c.req.json();
  } catch (error) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  // Validate at least one field is provided
  if (!body.server_data_path && !body.steam_zomboid_registry) {
    return c.json({ error: 'Must provide at least one configuration field to update' }, 400);
  }

  // Validate server_data_path if provided
  if (body.server_data_path) {
    // Must be an absolute path
    if (!body.server_data_path.startsWith('/')) {
      return c.json({ error: 'server_data_path must be an absolute path (start with /)' }, 400);
    }

    // Prevent setting to system directories
    const forbiddenPaths = ['/etc', '/var', '/usr', '/bin', '/sbin', '/boot', '/sys', '/proc', '/dev'];
    if (forbiddenPaths.some(p => body.server_data_path === p || body.server_data_path?.startsWith(p + '/'))) {
      return c.json({ error: 'Cannot use system directories as server data path' }, 400);
    }

    // Must not be root
    if (body.server_data_path === '/') {
      return c.json({ error: 'Cannot use root directory as server data path' }, 400);
    }
  }

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

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (body.server_data_path) {
      updates.push('server_data_path = ?');
      values.push(body.server_data_path);
    }

    if (body.steam_zomboid_registry) {
      updates.push('steam_zomboid_registry = ?');
      values.push(body.steam_zomboid_registry);
    }

    // Add agentId for WHERE clause
    values.push(agentId);

    // Execute update
    await c.env.DB.prepare(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    // Fetch updated configuration
    const updatedAgent = await c.env.DB.prepare(
      `SELECT server_data_path, steam_zomboid_registry FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    console.log(`[Agents API] Configuration updated for agent ${agentId}`);

    return c.json({
      success: true,
      message: 'Agent configuration updated successfully',
      config: {
        server_data_path: updatedAgent!.server_data_path,
        steam_zomboid_registry: updatedAgent!.steam_zomboid_registry,
      },
    });
  } catch (error) {
    console.error('[Agents API] Error updating agent config:', error);
    return c.json({ error: 'Failed to update agent configuration' }, 500);
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
      'SELECT id, name FROM servers WHERE container_id = ? AND agent_id = ?'
    )
      .bind(containerId, agentId)
      .first<{ id: string; name: string }>();

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

    // Audit log if successful
    if (response.ok) {
      await logServerOperation(c.env.DB, c, user.id, 'server.restarted', server.id, server.name, agentId);
    }

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

    // Clone the request and add user ID header for audit logging in DO
    // (WebSocket connections can't be easily re-authenticated in DO, so we pass user info here)
    const headers = new Headers(c.req.raw.headers);
    const { verifySessionToken, hashToken } = await import('../lib/auth');
    const payload = await verifySessionToken(token, c.env.TOKEN_SECRET);
    const tokenHash = await hashToken(token);
    const session = await c.env.DB.prepare(
      'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?'
    )
      .bind(tokenHash, Date.now())
      .first<{ user_id: string }>();

    if (session) {
      headers.set('X-User-Id', session.user_id);
    }

    const modifiedRequest = new Request(c.req.raw, { headers });

    // Forward the WebSocket request with user ID to Durable Object
    console.log(`[Agents API] Calling stub.fetch() with modified request`);
    console.log(`[Agents API] Original URL: ${c.req.raw.url}`);
    const response = await stub.fetch(modifiedRequest);
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

  // Validate server_data_path if provided (M9.8.23: Per-Server Path Override)
  if (body.server_data_path) {
    // Must be absolute path
    if (!body.server_data_path.startsWith('/')) {
      return c.json({ error: 'server_data_path must be an absolute path (start with /)' }, 400);
    }

    // Must not be root
    if (body.server_data_path === '/') {
      return c.json({ error: 'Cannot use root directory as server data path' }, 400);
    }

    // Prevent system directories
    const forbiddenPaths = ['/etc', '/var', '/usr', '/bin', '/sbin', '/boot', '/sys', '/proc', '/dev'];
    if (forbiddenPaths.some(p => body.server_data_path === p || body.server_data_path?.startsWith(p + '/'))) {
      return c.json({ error: 'Cannot use system directories as server data path' }, 400);
    }
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

    // Determine data path: custom override or agent default
    const dataPath = body.server_data_path || agent.server_data_path;

    // Store in D1 with status='creating'
    // M9.8.23: Include server_data_path (NULL = inherit from agent, Non-NULL = custom)
    // M9.8.32: Include image (NULL = use agent's steam_zomboid_registry, Non-NULL = custom)
    await c.env.DB.prepare(
      `INSERT INTO servers (id, agent_id, name, container_id, config, image, image_tag, game_port, udp_port, rcon_port, status, created_at, updated_at, server_data_path)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'creating', ?, ?, ?)`
    )
      .bind(
        serverId,
        agentId,
        body.name,
        JSON.stringify(body.config),
        body.image || null,  // M9.8.32: Store custom image or NULL (use agent's registry)
        body.imageTag,
        gamePort,
        udpPort,
        rconPort,
        now,
        now,
        body.server_data_path || null  // Store custom path or NULL (inherit from agent)
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
    // M9.8.23: Use determined dataPath (custom override or agent default)
    // M9.8.32: Use custom image if provided, otherwise use agent's registry
    const response = await stub.fetch(`http://do/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId,
        name: body.name,
        registry: body.image || agent.steam_zomboid_registry,
        imageTag: body.imageTag,
        config: configWithRconPort,
        gamePort,
        udpPort,
        rconPort,
        dataPath: dataPath,  // Use custom override or agent default
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
    // M9.8.32: Don't overwrite image_tag with result.imageName (full reference)
    // Keep image_tag as just the tag the user provided
    await c.env.DB.prepare(
      `UPDATE servers SET container_id = ?, status = 'running', updated_at = ? WHERE id = ?`
    )
      .bind(
        result.containerId,
        Date.now(),
        serverId
      )
      .run();

    // Return created server
    const server = await c.env.DB.prepare(
      `SELECT * FROM servers WHERE id = ?`
    )
      .bind(serverId)
      .first();

    // Audit log
    await logServerCreated(c.env.DB, c, user.id, serverId, body.name, agentId);

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
 * Returns: Array of servers with health status from containers
 */
agents.get('/:id/servers', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');

  try {
    // Verify agent exists and get name for DO lookup
    const agent = await c.env.DB.prepare(
      `SELECT id, name, status FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Query all servers for this agent with agent status
    const result = await c.env.DB.prepare(
      `SELECT
        s.*,
        a.status as agent_status
      FROM servers s
      JOIN agents a ON s.agent_id = a.id
      WHERE s.agent_id = ?
      ORDER BY s.created_at DESC`
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

    // Fetch container health from agent (if online)
    let containerHealthMap: Record<string, string> = {};
    if (agent.status === 'online') {
      try {
        const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
        const stub = c.env.AGENT_CONNECTION.get(id);
        const containerResponse = await stub.fetch(`http://do/containers`, { method: 'GET' });

        if (containerResponse.ok) {
          const containerData = await containerResponse.json() as { containers?: Array<{ id: string; health?: string }> };
          if (containerData.containers) {
            for (const container of containerData.containers) {
              if (container.health) {
                containerHealthMap[container.id] = container.health;
              }
            }
          }
        }
      } catch (err) {
        // If container fetch fails, continue without health data
        console.log('[Agents API] Could not fetch container health:', err);
      }
    }

    const servers = serverRows.map((row: any) => ({
      id: row.id,
      agent_id: row.agent_id,
      agent_status: row.agent_status || 'offline', // Agent connectivity status
      name: row.name,
      container_id: row.container_id,
      config: row.config,
      image_tag: row.image_tag,
      game_port: row.game_port,
      udp_port: row.udp_port,
      rcon_port: row.rcon_port,
      status: row.status,
      health: row.container_id ? containerHealthMap[row.container_id] : undefined, // Container health status
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

      // Audit log
      await logServerOperation(c.env.DB, c, user.id, 'server.started', serverId, server.name as string, agentId);

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
      // M9.8.23: Use server's custom path if set, otherwise use agent default
      const dataPath = server.server_data_path || agent.server_data_path;

      // M9.8.32: Use server's custom image if set, otherwise use agent's registry
      const imageRef = server.image || agent.steam_zomboid_registry;

      const createResponse = await stub.fetch(`http://do/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: server.id,
          name: server.name,
          registry: imageRef,
          imageTag: server.image_tag,
          config: configWithRconPort,
          gamePort: server.game_port,
          udpPort: server.udp_port,
          rconPort: server.rcon_port,
          dataPath: dataPath,
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

      // Audit log (container recreation + start)
      await logServerOperation(c.env.DB, c, user.id, 'server.started', serverId, server.name as string, agentId);

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

    // Audit log
    await logServerOperation(c.env.DB, c, user.id, 'server.stopped', serverId, server.name as string, agentId);

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
    // M9.8.23: Include server_data_path for custom path support
    const server = await c.env.DB.prepare(
      `SELECT id, container_id, status, name, server_data_path FROM servers WHERE id = ? AND agent_id = ?`
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
      // Get agent name and data path for Durable Object
      const agent = await c.env.DB.prepare(
        `SELECT name, server_data_path FROM agents WHERE id = ?`
      )
        .bind(agentId)
        .first();

      if (agent) {
        // Get Durable Object for this agent
        const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
        const stub = c.env.AGENT_CONNECTION.get(id);

        // M9.8.23: Use server's custom path if set, otherwise use agent default
        const dataPath = server.server_data_path || agent.server_data_path;

        // Forward server.delete message to Durable Object (preserve volumes)
        try {
          await stub.fetch(`http://do/servers/${serverId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              containerId: server.container_id,
              serverName: server.name as string,
              removeVolumes: false, // Always preserve data on soft delete
              dataPath: dataPath as string,
            }),
          });
          console.log(`[Soft Delete] Container removed for server ${serverId}`);
        } catch (error) {
          console.error(`[Soft Delete] Failed to remove container for server ${serverId}:`, error);
          // Don't fail the soft delete if container removal fails
        }
      }
    }

    // Audit log
    await logServerOperation(c.env.DB, c, user.id, 'server.deleted', serverId, serverName?.name || 'unknown', agentId);

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
    // M9.8.23: Include server_data_path to check for custom path override
    const server = await c.env.DB.prepare(
      `SELECT id, container_id, name, server_data_path FROM servers WHERE id = ? AND agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Remove container and/or data from agent (if agent is online)
    // Get agent info
    const agent = await c.env.DB.prepare(
      `SELECT name, status, server_data_path FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (agent && agent.status === 'online') {
      // Get Durable Object for this agent
      const id = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
      const stub = c.env.AGENT_CONNECTION.get(id);

      // M9.8.23: Use server's custom path if set, otherwise use agent default
      const dataPath = server.server_data_path || agent.server_data_path;

      // Forward server.delete message to Durable Object
      // IMPORTANT: Always send if removeData=true, even if container doesn't exist
      try {
        const response = await stub.fetch(`http://do/servers/${serverId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            containerId: server.container_id || '', // Empty string if no container
            serverName: server.name, // Pass server name so agent can remove data without container
            removeVolumes: removeData, // Remove data if requested
            dataPath: dataPath as string,
          }),
        });

        if (!response.ok) {
          console.error(`[Purge] Failed to remove container/data for server ${serverId}`);
          // Continue with DB deletion even if removal fails
        } else {
          console.log(`[Purge] Server ${server.name} removed (container: ${!!server.container_id}, data: ${removeData})`);
        }
      } catch (error) {
        console.error(`[Purge] Error removing container/data for server ${serverId}:`, error);
        // Continue with DB deletion
      }
    } else {
      if (removeData) {
        console.warn(`[Purge] Agent offline - cannot remove data for server ${server.name}. Data will remain on host.`);
      }
    }

    // Delete from database (hard delete)
    await c.env.DB.prepare(
      `DELETE FROM servers WHERE id = ?`
    )
      .bind(serverId)
      .run();

    console.log(`[Purge] Server ${server.name} (${serverId}) permanently deleted`);

    // Audit log (before DB record is deleted)
    await logServerOperation(c.env.DB, c, user.id, 'server.purged', serverId, server.name as string, agentId);

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
    // Verify server exists and belongs to agent (include server_data_path for checking)
    const server = await c.env.DB.prepare(
      `SELECT id, status, deleted_at, name, server_data_path FROM servers WHERE id = ? AND agent_id = ?`
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

    // Get agent config to determine data path
    const agent = await c.env.DB.prepare(
      `SELECT name, server_data_path FROM agents WHERE id = ?`
    )
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Determine effective data path (server custom path || agent default path)
    const effectiveDataPath = server.server_data_path || agent.server_data_path || '/var/lib/zedops/servers';

    // Get AgentConnection DO to check if data exists
    const doId = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(doId);

    // Check if data actually exists on filesystem
    let dataExists = false;
    try {
      const checkResponse = await stub.fetch('http://internal/check-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName: server.name,
          dataPath: effectiveDataPath,
        }),
      });

      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        dataExists = checkResult.dataExists || false;
        console.log(`[Restore] Data exists check for ${server.name}: ${dataExists} (path: ${effectiveDataPath})`);
      } else {
        console.warn(`[Restore] Data check failed, assuming data doesn't exist`);
      }
    } catch (error) {
      console.error(`[Restore] Error checking data existence:`, error);
      // If agent is offline or check fails, assume data doesn't exist (safe default)
    }

    // Restore: clear deleted_at, set status to 'missing', set data_exists based on actual check
    const now = Date.now();
    await c.env.DB.prepare(
      `UPDATE servers SET status = 'missing', deleted_at = NULL, data_exists = ?, updated_at = ? WHERE id = ?`
    )
      .bind(dataExists ? 1 : 0, now, serverId)
      .run();

    console.log(`[Restore] Server ${server.name} (${serverId}) restored with data_exists=${dataExists}`);

    // Audit log
    await logServerOperation(c.env.DB, c, user.id, 'server.restored', serverId, server.name as string, agentId);

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

    // Audit log
    await logServerOperation(c.env.DB, c, user.id, 'server.rebuilt', serverId, server.name as string, agentId);

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

/**
 * GET /api/agents/:id/servers/:serverId/metrics
 * Get container metrics for a specific server
 *
 * Returns: Container resource usage (CPU, memory, disk I/O, uptime)
 * Permission: User must be able to view the server
 */
agents.get('/:id/servers/:serverId/metrics', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');

  try {
    // Check permission to view server
    const hasPermission = await canViewServer(c.env.DB, user.id, user.role, serverId);
    if (!hasPermission) {
      return c.json({ error: 'Forbidden - you do not have permission to view this server' }, 403);
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

    // Query server from DB to get container_id
    const server = await c.env.DB.prepare(
      `SELECT id, name, container_id, status FROM servers WHERE id = ? AND agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Check if server has a container
    if (!server.container_id) {
      return c.json({
        error: 'Server has no container',
        message: 'Server container is missing or not yet created',
      }, 400);
    }

    // Check if container is running (metrics only available for running containers)
    if (server.status !== 'running') {
      return c.json({
        error: 'Server not running',
        message: `Cannot collect metrics - server status is ${server.status}`,
      }, 400);
    }

    // Get AgentConnection DO
    const doId = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const stub = c.env.AGENT_CONNECTION.get(doId);

    console.log(`[Server Metrics] Requesting metrics for container: ${server.container_id}`);

    // Forward metrics request to agent via DO
    const metricsResponse = await stub.fetch(
      `http://do/containers/${server.container_id}/metrics`,
      { method: 'GET' }
    );

    if (!metricsResponse.ok) {
      const errorData = await metricsResponse.json();
      return c.json({ error: errorData.error || 'Failed to collect metrics' }, metricsResponse.status);
    }

    const metricsData = await metricsResponse.json();

    console.log(`[Server Metrics] Collected metrics for ${server.name}: CPU=${metricsData.cpuPercent}%, Memory=${metricsData.memoryUsedMB}MB`);

    return c.json({
      success: true,
      metrics: metricsData,
    });
  } catch (error) {
    console.error('[Server Metrics API] Error collecting metrics:', error);
    return c.json({ error: 'Failed to collect server metrics' }, 500);
  }
});

/**
 * GET /api/agents/:id/servers/:serverId/storage
 * Get storage consumption for a server's bin/ and data/ directories
 *
 * Returns: { success, sizes: { binBytes, dataBytes, totalBytes, mountPoint } }
 * Permission: View access required
 *
 * Agent caches results for 5 minutes to avoid expensive disk scans
 */
agents.get('/:id/servers/:serverId/storage', async (c) => {
  console.log('[Server Storage] Request received for storage endpoint');
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');
  console.log(`[Server Storage] agentId=${agentId}, serverId=${serverId}, userId=${user.id}`);

  // Check permission to view server
  const hasPermission = await canViewServer(c.env.DB, user.id, user.role, serverId);
  if (!hasPermission) {
    return c.json({ error: 'Forbidden - you do not have permission to view this server' }, 403);
  }

  try {
    // Get server and agent details
    const server = await c.env.DB.prepare(
      `SELECT s.id, s.name, s.status, s.agent_id, s.server_data_path,
              a.name as agent_name, a.status as agent_status, a.server_data_path as agent_server_data_path
       FROM servers s
       LEFT JOIN agents a ON s.agent_id = a.id
       WHERE s.id = ? AND s.agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Check if agent is online
    if (server.agent_status !== 'online') {
      return c.json({
        error: 'Agent offline',
        message: 'Cannot retrieve storage info - agent is not connected',
      }, 503);
    }

    // Get AgentConnection DO
    const doId = c.env.AGENT_CONNECTION.idFromName(server.agent_name as string);
    const stub = c.env.AGENT_CONNECTION.get(doId);

    // Use server's custom path if set, otherwise use agent default
    const dataPath = server.server_data_path || server.agent_server_data_path;

    console.log(`[Server Storage] Requesting storage for ${server.name} (dataPath: ${dataPath})`);

    // Forward storage request to agent via DO
    const storageResponse = await stub.fetch(
      `http://do/servers/${server.name}/storage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataPath }),
      }
    );

    if (!storageResponse.ok) {
      const errorData = await storageResponse.json() as { error?: string };
      return c.json({ error: errorData.error || 'Failed to get storage info' }, storageResponse.status);
    }

    const storageData = await storageResponse.json() as {
      success: boolean;
      sizes?: { binBytes: number; dataBytes: number; totalBytes: number; mountPoint?: string };
      error?: string;
    };

    if (!storageData.success) {
      return c.json({ error: storageData.error || 'Failed to get storage info' }, 500);
    }

    console.log(`[Server Storage] ${server.name}: bin=${storageData.sizes?.binBytes}, data=${storageData.sizes?.dataBytes}, total=${storageData.sizes?.totalBytes}`);

    return c.json({
      success: true,
      sizes: storageData.sizes,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Server Storage API] Error getting storage:', errorMessage, error);
    return c.json({ error: `Failed to get server storage info: ${errorMessage}` }, 500);
  }
});

/**
 * PATCH /api/agents/:id/servers/:serverId/config
 * Update server configuration (Save step - no container restart)
 *
 * Body: { config: {...}, imageTag?: string, serverDataPath?: string }
 * Returns: { success, pendingRestart, dataPathChanged }
 */
agents.patch('/:id/servers/:serverId/config', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');

  // Check permission to control server
  const hasPermission = await canControlServer(c.env.DB, user.id, user.role, serverId);
  if (!hasPermission) {
    return c.json({ error: 'Forbidden - you do not have permission to modify this server' }, 403);
  }

  try {
    // Parse request body
    // M9.8.32: Added image field for custom registry override
    const body = await c.req.json() as {
      config: Record<string, string>;
      image?: string | null;  // M9.8.32: Custom registry (NULL = use agent default)
      imageTag?: string;
      serverDataPath?: string | null;
    };

    // Trim serverDataPath to prevent leading/trailing whitespace issues
    if (body.serverDataPath) {
      body.serverDataPath = body.serverDataPath.trim();
    }

    // Verify server exists and belongs to agent, also get agent's default data path
    // M9.8.32: Include image field
    const server = await c.env.DB.prepare(
      `SELECT s.id, s.config, s.image, s.image_tag, s.server_data_path, a.server_data_path as agent_server_data_path
       FROM servers s
       LEFT JOIN agents a ON s.agent_id = a.id
       WHERE s.id = ? AND s.agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Parse existing config
    const existingConfig = server.config ? JSON.parse(server.config as string) : {};

    // Validation: Immutable fields
    // SERVER_MAP cannot be changed after world creation (game engine constraint)
    if (body.config.SERVER_MAP && existingConfig.SERVER_MAP && body.config.SERVER_MAP !== existingConfig.SERVER_MAP) {
      return c.json({
        error: 'Cannot change SERVER_MAP after world creation. This is a game engine constraint.',
        field: 'SERVER_MAP'
      }, 400);
    }

    // Determine what changed
    const configChanged = JSON.stringify(body.config) !== JSON.stringify(existingConfig);
    // M9.8.32: Track image and imageTag changes separately
    const imageChanged = body.image !== undefined && body.image !== server.image;
    const imageTagChanged = body.imageTag !== undefined && body.imageTag !== server.image_tag;
    const dataPathChanged = body.serverDataPath !== undefined && body.serverDataPath !== server.server_data_path;

    // Build update query
    const updates: string[] = [];
    const bindings: any[] = [];

    if (configChanged) {
      updates.push('config = ?');
      bindings.push(JSON.stringify(body.config));
    }

    // M9.8.32: Support updating image (registry) separately from tag
    if (imageChanged) {
      updates.push('image = ?');
      bindings.push(body.image || null);  // Allow clearing to fall back to agent default
    }

    if (imageTagChanged) {
      updates.push('image_tag = ?');
      bindings.push(body.imageTag);
    }

    if (dataPathChanged) {
      updates.push('server_data_path = ?');
      bindings.push(body.serverDataPath);
    }

    if (updates.length === 0) {
      return c.json({
        success: true,
        message: 'No changes detected',
        pendingRestart: false,
        dataPathChanged: false,
      });
    }

    // Update database
    updates.push('updated_at = ?');
    bindings.push(Date.now());
    bindings.push(serverId);

    await c.env.DB.prepare(
      `UPDATE servers SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...bindings)
      .run();

    // Audit log
    const changes = [];
    if (configChanged) changes.push('config');
    if (imageChanged) changes.push('image');  // M9.8.32
    if (imageTagChanged) changes.push('image_tag');
    if (dataPathChanged) changes.push('server_data_path');

    await logServerOperation(
      c.env.DB,
      c,
      user.id,
      'server.config.updated',
      serverId,
      server.name as string || serverId,
      agentId,
      { changes }
    );

    // Determine if restart is needed
    // Config changes require restart, image tag only affects next rebuild, data path requires recreation
    const pendingRestart = configChanged || dataPathChanged;

    // M9.8.29: Compute effective old path (server's custom OR agent's default)
    const effectiveOldPath = server.server_data_path || server.agent_server_data_path;

    return c.json({
      success: true,
      message: 'Configuration updated successfully',
      pendingRestart,
      dataPathChanged,
      configChanged,
      imageTagChanged,
      // M9.8.29: Return effective old data path so frontend can pass it to apply-config for data migration
      oldDataPath: dataPathChanged ? effectiveOldPath : undefined,
    });
  } catch (error) {
    console.error('[Agents API] Error updating server config:', error);
    return c.json({ error: 'Failed to update server configuration' }, 500);
  }
});

/**
 * POST /api/agents/:id/servers/:serverId/apply-config
 * Apply configuration changes (restart container with new config)
 *
 * Returns: { success, server }
 */
agents.post('/:id/servers/:serverId/apply-config', async (c) => {
  const user = c.get('user');
  const agentId = c.req.param('id');
  const serverId = c.req.param('serverId');

  // Check permission to control server
  const hasPermission = await canControlServer(c.env.DB, user.id, user.role, serverId);
  if (!hasPermission) {
    return c.json({ error: 'Forbidden - you do not have permission to control this server' }, 403);
  }

  // M9.8.29: Parse optional oldDataPath from request body (may be stale, will verify from container)
  let oldDataPath: string | undefined;
  try {
    const body = await c.req.json();
    oldDataPath = body.oldDataPath;
  } catch {
    // No body or invalid JSON is fine - oldDataPath is optional
  }

  try {
    // Verify server exists and get current config
    const server = await c.env.DB.prepare(
      `SELECT s.*, a.name as agent_name, a.steam_zomboid_registry, a.server_data_path as agent_server_data_path
       FROM servers s
       LEFT JOIN agents a ON s.agent_id = a.id
       WHERE s.id = ? AND s.agent_id = ?`
    )
      .bind(serverId, agentId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    if (!server.container_id) {
      return c.json({ error: 'Server has no container (never started)' }, 400);
    }

    // Check if status allows apply
    if (server.status === 'creating' || server.status === 'deleting') {
      return c.json({ error: `Cannot apply config while server is ${server.status}` }, 400);
    }

    // Update status to indicate restart in progress
    await c.env.DB.prepare(
      `UPDATE servers SET status = 'restarting', updated_at = ? WHERE id = ?`
    )
      .bind(Date.now(), serverId)
      .run();

    // Get Durable Object for this agent
    const doId = c.env.AGENT_CONNECTION.idFromName(server.agent_name as string);
    const agentStub = c.env.AGENT_CONNECTION.get(doId);

    // Parse config and add RCON_PORT
    const config = server.config ? JSON.parse(server.config as string) : {};
    const configWithRconPort = {
      ...config,
      RCON_PORT: server.rcon_port.toString(),
    };

    // Determine target data path (custom override or agent default)
    const dataPath = server.server_data_path || server.agent_server_data_path;

    // M9.8.36: Query ACTUAL data path from container mounts (DB config may be stale)
    // This handles cases where agent path changed after server was created
    if (oldDataPath && dataPath && oldDataPath !== dataPath) {
      console.log(`[Agents API] Data path change requested: ${oldDataPath} -> ${dataPath}`);
      console.log(`[Agents API] Querying actual data path from container mounts...`);

      try {
        const dataPathResponse = await agentStub.fetch(`http://do/servers/${serverId}/datapath`, {
          method: 'GET',
        });

        if (dataPathResponse.ok) {
          const dataPathResult = await dataPathResponse.json() as { success: boolean; dataPath?: string; error?: string };
          if (dataPathResult.success && dataPathResult.dataPath) {
            const actualOldPath = dataPathResult.dataPath;
            console.log(`[Agents API] Actual data path from container: ${actualOldPath}`);

            // Use actual path if different from what frontend provided
            if (actualOldPath !== oldDataPath) {
              console.log(`[Agents API] Correcting oldDataPath: ${oldDataPath} -> ${actualOldPath}`);
              oldDataPath = actualOldPath;
            }
          }
        } else {
          console.warn(`[Agents API] Could not query container data path, using provided value: ${oldDataPath}`);
        }
      } catch (err) {
        console.warn(`[Agents API] Error querying container data path:`, err);
        // Continue with provided oldDataPath
      }

      console.log(`[Agents API] Moving server data from ${oldDataPath} to ${dataPath}`);

      const moveResponse = await agentStub.fetch(`http://do/servers/${serverId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName: server.name,
          oldPath: oldDataPath,
          newPath: dataPath,
        }),
      });

      if (!moveResponse.ok) {
        // Move failed - restore status and return error
        await c.env.DB.prepare(
          `UPDATE servers SET status = 'failed', updated_at = ? WHERE id = ?`
        )
          .bind(Date.now(), serverId)
          .run();

        const errorData = await moveResponse.json() as { error?: string };
        return c.json({
          error: `Failed to move server data: ${errorData.error || 'Unknown error'}`
        }, moveResponse.status);
      }

      console.log(`[Agents API] Server data move completed for ${server.name}`);
    }

    // Forward rebuild request with new config
    // M9.8.32: Use server's custom image if set, otherwise use agent's registry
    const imageRef = server.image || server.steam_zomboid_registry;

    let response = await agentStub.fetch(`http://do/servers/${serverId}/rebuild`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerId: server.container_id,
        // Include full config for recreation
        name: server.name,
        registry: imageRef,
        imageTag: server.image_tag,
        config: configWithRconPort,
        gamePort: server.game_port,
        udpPort: server.udp_port,
        rconPort: server.rcon_port,
        dataPath: dataPath,
      }),
    });

    // M9.8.36: Auto-recovery for missing containers
    // If rebuild fails because container doesn't exist, try to create a new one
    if (!response.ok) {
      const errorData = await response.json() as { error?: string };
      const errorMsg = errorData.error || '';

      // Check if this is a "no such container" error
      if (errorMsg.toLowerCase().includes('no such container') ||
          errorMsg.toLowerCase().includes('container not found')) {
        console.log(`[Agents API] Container missing, attempting auto-recovery by creating new container`);

        // Check if data exists on disk to determine the correct source path
        let actualDataPath = dataPath;
        try {
          const checkDataResponse = await agentStub.fetch(`http://do/servers/checkdata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              servers: [server.name],
              dataPath: dataPath,
            }),
          });

          if (checkDataResponse.ok) {
            const checkResult = await checkDataResponse.json() as { success: boolean; statuses?: Array<{ dataExists: boolean }> };
            if (checkResult.success && checkResult.statuses?.[0]?.dataExists) {
              console.log(`[Agents API] Data exists at target path: ${dataPath}`);
            } else if (oldDataPath) {
              // Check if data exists at old path
              const checkOldResponse = await agentStub.fetch(`http://do/servers/checkdata`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  servers: [server.name],
                  dataPath: oldDataPath,
                }),
              });

              if (checkOldResponse.ok) {
                const checkOldResult = await checkOldResponse.json() as { success: boolean; statuses?: Array<{ dataExists: boolean }> };
                if (checkOldResult.success && checkOldResult.statuses?.[0]?.dataExists) {
                  console.log(`[Agents API] Data exists at old path: ${oldDataPath}, using that for container`);
                  actualDataPath = oldDataPath;

                  // Also update server's data path in DB to match where data actually is
                  await c.env.DB.prepare(
                    `UPDATE servers SET server_data_path = ?, updated_at = ? WHERE id = ?`
                  )
                    .bind(actualDataPath, Date.now(), serverId)
                    .run();
                }
              }
            }
          }
        } catch (err) {
          console.warn(`[Agents API] Error checking data existence:`, err);
        }

        // Try to create a new container
        response = await agentStub.fetch(`http://do/servers/${serverId}/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverId: serverId,
            name: server.name,
            registry: imageRef,
            imageTag: server.image_tag,
            config: configWithRconPort,
            gamePort: server.game_port,
            udpPort: server.udp_port,
            rconPort: server.rcon_port,
            dataPath: actualDataPath,
          }),
        });

        if (response.ok) {
          console.log(`[Agents API] Auto-recovery successful - new container created for ${server.name}`);
        }
      }
    }

    if (!response.ok) {
      // Update status back to failed
      await c.env.DB.prepare(
        `UPDATE servers SET status = 'failed', updated_at = ? WHERE id = ?`
      )
        .bind(Date.now(), serverId)
        .run();

      const errorData = await response.json() as { error?: string };
      return c.json({ error: errorData.error || 'Failed to apply configuration' }, response.status);
    }

    const result = await response.json() as { success: boolean; newContainerID?: string; containerId?: string };

    // Get container ID from either rebuild response (newContainerID) or create response (containerId)
    const newContainerId = result.newContainerID || result.containerId;

    // Update database with new container_id and running status
    const now = Date.now();
    await c.env.DB.prepare(
      `UPDATE servers SET container_id = ?, status = 'running', updated_at = ? WHERE id = ?`
    )
      .bind(newContainerId, now, serverId)
      .run();

    // Fetch updated server
    const updatedServer = await c.env.DB.prepare(
      `SELECT s.*, a.name as agent_name, a.status as agent_status, a.server_data_path as agent_server_data_path
       FROM servers s
       LEFT JOIN agents a ON s.agent_id = a.id
       WHERE s.id = ?`
    )
      .bind(serverId)
      .first();

    // Audit log
    await logServerOperation(c.env.DB, c, user.id, 'server.config.applied', serverId, server.name as string, agentId);

    return c.json({
      success: true,
      message: 'Configuration applied successfully',
      server: {
        ...updatedServer,
        data_exists: updatedServer.data_exists === 1,
      },
    });
  } catch (error) {
    console.error('[Agents API] Error applying server config:', error);

    // Try to restore status
    try {
      await c.env.DB.prepare(
        `UPDATE servers SET status = 'failed', updated_at = ? WHERE id = ?`
      )
        .bind(Date.now(), serverId)
        .run();
    } catch (dbError) {
      console.error('[Agents API] Failed to update status after error:', dbError);
    }

    return c.json({ error: 'Failed to apply configuration' }, 500);
  }
});

/**
 * GET /api/agents/:id/images/defaults?tag=<image-tag>
 * Query Docker image for default ENV variables
 *
 * Returns: { defaults: { PUID: "1430", TZ: "UTC", ... } }
 */
agents.get('/:id/images/defaults', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const agentId = c.req.param('id');
  const imageTag = c.req.query('tag');

  if (!imageTag) {
    return c.json({ error: 'Image tag is required (use ?tag=<image-tag> query parameter)' }, 400);
  }

  // Image tag already decoded by query parser
  const decodedImageTag = imageTag;

  try {
    // Query database to get agent name (needed for Durable Object lookup)
    const agent = await c.env.DB.prepare('SELECT name FROM agents WHERE id = ?')
      .bind(agentId)
      .first();

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Get agent's Durable Object using agent NAME (not ID)
    const doId = c.env.AGENT_CONNECTION.idFromName(agent.name as string);
    const agentStub = c.env.AGENT_CONNECTION.get(doId);

    // Forward request to Durable Object (which proxies to agent)
    // Use query parameter to avoid path encoding issues
    const response = await agentStub.fetch(
      `http://do/images/defaults?tag=${encodeURIComponent(decodedImageTag)}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const errorData = await response.json() as { error?: string };
      return c.json({
        error: errorData.error || 'Failed to fetch image defaults',
      }, response.status);
    }

    const data = await response.json() as { defaults: Record<string, string> };
    return c.json(data);
  } catch (error) {
    console.error('[Agents API] Error fetching image defaults:', error);
    return c.json({ error: 'Failed to fetch image defaults' }, 500);
  }
});

export { agents };
