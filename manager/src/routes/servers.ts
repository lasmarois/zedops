/**
 * Global server management API endpoints
 *
 * All endpoints require authentication.
 * Provides global views of servers across all agents.
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { getUserVisibleServers } from '../lib/permissions';

type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  AGENT_CONNECTION: DurableObjectNamespace;
  TOKEN_SECRET: string;
};

const servers = new Hono<{ Bindings: Bindings }>();

// Apply authentication middleware to all routes
servers.use('*', requireAuth());

/**
 * GET /api/servers
 * List all servers across all agents (filtered by user access)
 *
 * Returns: Array of servers with agent information
 * Permission:
 *   - Admin: All servers
 *   - Non-admin: Only servers user has permission to view
 */
servers.get('/', async (c) => {
  const user = c.get('user');

  try {
    // Query all servers with agent information (JOIN)
    const result = await c.env.DB.prepare(
      `SELECT
        s.*,
        a.name as agent_name,
        a.status as agent_status
      FROM servers s
      LEFT JOIN agents a ON s.agent_id = a.id
      ORDER BY s.created_at DESC`
    ).all();

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
      agent_name: row.agent_name || 'Unknown', // Fallback if agent deleted
      agent_status: row.agent_status || 'offline', // Agent connectivity status
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
      count: servers.length,
    });
  } catch (error) {
    console.error('[Servers API] Error listing all servers:', error);
    return c.json({ error: 'Failed to list servers' }, 500);
  }
});

/**
 * GET /api/servers/:id
 * Get single server details by ID (with permission check)
 *
 * Returns: Server details with agent information
 * Permission:
 *   - Admin: Any server
 *   - Non-admin: Only servers user has permission to view
 */
servers.get('/:id', async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('id');

  try {
    // Query server with agent information (JOIN)
    const server = await c.env.DB.prepare(
      `SELECT
        s.*,
        a.name as agent_name,
        a.status as agent_status
      FROM servers s
      LEFT JOIN agents a ON s.agent_id = a.id
      WHERE s.id = ?`
    )
      .bind(serverId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Permission check: Non-admins must have access to this server
    if (user.role !== 'admin') {
      const visibleServerIds = await getUserVisibleServers(c.env.DB, user.id, user.role);
      if (!visibleServerIds.includes(serverId)) {
        return c.json({ error: 'Access denied' }, 403);
      }
    }

    const serverData = {
      id: server.id,
      agent_id: server.agent_id,
      agent_name: server.agent_name || 'Unknown', // Fallback if agent deleted
      agent_status: server.agent_status || 'offline', // Agent connectivity status
      name: server.name,
      container_id: server.container_id,
      config: server.config, // Full config (ENV vars)
      image_tag: server.image_tag,
      game_port: server.game_port,
      udp_port: server.udp_port,
      rcon_port: server.rcon_port,
      status: server.status,
      data_exists: server.data_exists === 1, // Convert SQLite integer to boolean
      deleted_at: server.deleted_at,
      created_at: server.created_at,
      updated_at: server.updated_at,
    };

    return c.json({
      success: true,
      server: serverData,
    });
  } catch (error) {
    console.error('[Servers API] Error fetching server:', error);
    return c.json({ error: 'Failed to fetch server' }, 500);
  }
});

export { servers };
