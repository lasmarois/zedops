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
    // M9.8.32: Include steam_zomboid_registry for image reference display
    const result = await c.env.DB.prepare(
      `SELECT
        s.*,
        a.name as agent_name,
        a.status as agent_status,
        a.server_data_path as agent_server_data_path,
        a.steam_zomboid_registry as steam_zomboid_registry
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

    // Fetch container health from each unique online agent
    const containerHealthMap: Record<string, string> = {};
    const onlineAgents = new Map<string, string>(); // agentName -> agentId

    // Collect unique online agents
    for (const row of serverRows) {
      if (row.agent_status === 'online' && row.agent_name && row.container_id) {
        onlineAgents.set(row.agent_name, row.agent_id);
      }
    }

    // Player stats map (serverId -> stats)
    const playerStatsMap: Record<string, { playerCount: number; maxPlayers: number; players: string[] }> = {};

    // Fetch containers and player stats from each online agent in parallel
    const fetchPromises = Array.from(onlineAgents.entries()).map(async ([agentName]) => {
      try {
        const id = c.env.AGENT_CONNECTION.idFromName(agentName);
        const stub = c.env.AGENT_CONNECTION.get(id);

        // Fetch containers and players in parallel
        const [containerResponse, playersResponse] = await Promise.all([
          stub.fetch(`http://do/containers`, { method: 'GET' }),
          stub.fetch(`http://do/players`, { method: 'GET' }),
        ]);

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

        if (playersResponse.ok) {
          const playersData = await playersResponse.json() as { players?: Array<{ serverId: string; playerCount: number; maxPlayers: number; players: string[] }> };
          if (playersData.players) {
            for (const stats of playersData.players) {
              playerStatsMap[stats.serverId] = {
                playerCount: stats.playerCount,
                maxPlayers: stats.maxPlayers,
                players: stats.players,
              };
            }
          }
        }
      } catch (err) {
        // If fetch fails for this agent, continue without data
        console.log(`[Servers API] Could not fetch data from ${agentName}:`, err);
      }
    });

    await Promise.all(fetchPromises);

    const servers = serverRows.map((row: any) => ({
      id: row.id,
      agent_id: row.agent_id,
      agent_name: row.agent_name || 'Unknown', // Fallback if agent deleted
      agent_status: row.agent_status || 'offline', // Agent connectivity status
      agent_server_data_path: row.agent_server_data_path, // Agent's default data path
      steam_zomboid_registry: row.steam_zomboid_registry, // M9.8.32: Agent's default registry
      name: row.name,
      container_id: row.container_id,
      config: row.config,
      image: row.image, // M9.8.32: Per-server image override
      image_tag: row.image_tag,
      game_port: row.game_port,
      udp_port: row.udp_port,
      rcon_port: row.rcon_port,
      server_data_path: row.server_data_path, // Per-server override (NULL = use agent default)
      status: row.status,
      health: row.container_id ? containerHealthMap[row.container_id] : undefined, // Container health status
      // Player stats from RCON polling
      player_count: playerStatsMap[row.id]?.playerCount ?? null,
      max_players: playerStatsMap[row.id]?.maxPlayers ?? null,
      players: playerStatsMap[row.id]?.players ?? null,
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
 * Returns: Server details with agent information and container health
 * Permission:
 *   - Admin: Any server
 *   - Non-admin: Only servers user has permission to view
 */
servers.get('/:id', async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('id');

  try {
    // Query server with agent information (JOIN)
    // M9.8.32: Include steam_zomboid_registry for image reference display
    const server = await c.env.DB.prepare(
      `SELECT
        s.*,
        a.name as agent_name,
        a.status as agent_status,
        a.server_data_path as agent_server_data_path,
        a.steam_zomboid_registry as steam_zomboid_registry
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

    // Fetch container health and player stats if agent is online
    let health: string | undefined;
    let playerStats: { playerCount: number; maxPlayers: number; players: string[] } | null = null;
    if (server.agent_status === 'online' && server.agent_name) {
      try {
        const id = c.env.AGENT_CONNECTION.idFromName(server.agent_name as string);
        const stub = c.env.AGENT_CONNECTION.get(id);

        // Fetch containers and player stats in parallel
        const [containerResponse, playersResponse] = await Promise.all([
          stub.fetch(`http://do/containers`, { method: 'GET' }),
          stub.fetch(`http://do/players/${serverId}`, { method: 'GET' }),
        ]);

        if (containerResponse.ok && server.container_id) {
          const containerData = await containerResponse.json() as { containers?: Array<{ id: string; health?: string }> };
          if (containerData.containers) {
            const container = containerData.containers.find(c => c.id === server.container_id);
            if (container?.health) {
              health = container.health;
            }
          }
        }

        // M9.8.41: Fetch player stats for this server
        if (playersResponse.ok) {
          const playersData = await playersResponse.json() as { success: boolean; stats?: { playerCount: number; maxPlayers: number; players: string[] } };
          if (playersData.stats) {
            playerStats = playersData.stats;
          }
        }
      } catch (err) {
        // If fetch fails, continue without health/player data
        console.log('[Servers API] Could not fetch container health/players:', err);
      }
    }

    const serverData = {
      id: server.id,
      agent_id: server.agent_id,
      agent_name: server.agent_name || 'Unknown', // Fallback if agent deleted
      agent_status: server.agent_status || 'offline', // Agent connectivity status
      agent_server_data_path: server.agent_server_data_path, // Agent's default data path
      steam_zomboid_registry: server.steam_zomboid_registry, // M9.8.32: Agent's default registry
      name: server.name,
      container_id: server.container_id,
      config: server.config, // Full config (ENV vars)
      image: server.image, // M9.8.32: Per-server image override
      image_tag: server.image_tag,
      game_port: server.game_port,
      udp_port: server.udp_port,
      rcon_port: server.rcon_port,
      server_data_path: server.server_data_path, // Per-server override (NULL = use agent default)
      status: server.status,
      health, // Container health status
      // M9.8.41: Player stats from RCON polling
      player_count: playerStats?.playerCount ?? null,
      max_players: playerStats?.maxPlayers ?? null,
      players: playerStats?.players ?? null,
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
