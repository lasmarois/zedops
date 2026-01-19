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
    const playerStatsMap: Record<string, { playerCount: number; maxPlayers: number; players: string[]; rconConnected: boolean }> = {};

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
          const playersData = await playersResponse.json() as { players?: Array<{ serverId: string; playerCount: number; maxPlayers: number; players: string[]; rconConnected: boolean }> };
          if (playersData.players) {
            for (const stats of playersData.players) {
              playerStatsMap[stats.serverId] = {
                playerCount: stats.playerCount,
                maxPlayers: stats.maxPlayers,
                players: stats.players,
                rconConnected: stats.rconConnected ?? false, // P2: RCON health status
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
      rcon_connected: playerStatsMap[row.id]?.rconConnected ?? null, // P2: RCON health status
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
    // P7: Include agent public_ip for connection card
    const server = await c.env.DB.prepare(
      `SELECT
        s.*,
        a.name as agent_name,
        a.status as agent_status,
        a.server_data_path as agent_server_data_path,
        a.steam_zomboid_registry as steam_zomboid_registry,
        a.public_ip as agent_public_ip,
        a.hostname as agent_hostname
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
    let playerStats: { playerCount: number; maxPlayers: number; players: string[]; rconConnected: boolean } | null = null;
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
          const playersData = await playersResponse.json() as { success: boolean; stats?: { playerCount: number; maxPlayers: number; players: string[]; rconConnected: boolean } };
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
      agent_public_ip: server.agent_public_ip || null, // P7: Agent's public IP for connection card
      agent_hostname: server.agent_hostname || null, // P8: Agent's hostname for connection card
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
      rcon_connected: playerStats?.rconConnected ?? null, // P2: RCON health status
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

/**
 * GET /api/servers/:serverId/metrics/history
 * Get metrics history for Performance tab and sparklines
 *
 * Query params:
 *   - range: '30m' | '3h' | '12h' | '24h' | '3d' (default: '30m')
 *
 * Downsampling strategy:
 *   - 30m, 3h: raw data (10s intervals)
 *   - 12h: 1-minute averages (~720 points)
 *   - 24h: 5-minute averages (~288 points)
 *   - 3d: 15-minute averages (~288 points)
 *
 * Returns: Array of metrics points in chronological order
 * Permission: User must have view access to server
 */
servers.get('/:serverId/metrics/history', async (c) => {
  const user = c.get('user');
  const serverId = c.req.param('serverId');
  const range = c.req.query('range') || '30m';

  // Calculate time range
  const now = Math.floor(Date.now() / 1000);
  let fromTimestamp: number;
  let downsampleInterval: number = 0; // 0 = no downsampling

  switch (range) {
    case '3h':
      fromTimestamp = now - (3 * 60 * 60);
      break;
    case '12h':
      fromTimestamp = now - (12 * 60 * 60);
      downsampleInterval = 60; // 1-minute averages
      break;
    case '24h':
      fromTimestamp = now - (24 * 60 * 60);
      downsampleInterval = 300; // 5-minute averages
      break;
    case '3d':
      fromTimestamp = now - (3 * 24 * 60 * 60);
      downsampleInterval = 900; // 15-minute averages
      break;
    case '30m':
    default:
      fromTimestamp = now - (30 * 60);
      break;
  }

  try {
    // First verify user can view this server
    const server = await c.env.DB.prepare(
      'SELECT id, agent_id FROM servers WHERE id = ?'
    ).bind(serverId).first<{ id: string; agent_id: string }>();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Check user permission (admin can view all, non-admin needs permission)
    if (user.role !== 'admin') {
      const permission = await c.env.DB.prepare(
        'SELECT 1 FROM user_server_permissions WHERE user_id = ? AND server_id = ?'
      ).bind(user.id, serverId).first();

      if (!permission) {
        return c.json({ error: 'Access denied' }, 403);
      }
    }

    // Fetch metrics history
    let points: { timestamp: number; cpu: number | null; memory: number | null; players: number | null }[];

    if (downsampleInterval > 0) {
      // Use SQLite GROUP BY for downsampling (bucket by interval)
      const query = `
        SELECT
          (timestamp / ?) * ? as bucket_timestamp,
          AVG(cpu_percent) as cpu_percent,
          AVG(memory_percent) as memory_percent,
          ROUND(AVG(player_count)) as player_count
        FROM server_metrics_history
        WHERE server_id = ? AND timestamp >= ?
        GROUP BY bucket_timestamp
        ORDER BY bucket_timestamp ASC
      `;

      const result = await c.env.DB.prepare(query)
        .bind(downsampleInterval, downsampleInterval, serverId, fromTimestamp)
        .all<{
          bucket_timestamp: number;
          cpu_percent: number | null;
          memory_percent: number | null;
          player_count: number | null;
        }>();

      points = (result.results || []).map(row => ({
        timestamp: row.bucket_timestamp,
        cpu: row.cpu_percent,
        memory: row.memory_percent,
        players: row.player_count,
      }));
    } else {
      // Raw data for short ranges (30m, 3h)
      const query = `
        SELECT timestamp, cpu_percent, memory_percent, player_count
        FROM server_metrics_history
        WHERE server_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC
        LIMIT 2000
      `;

      const result = await c.env.DB.prepare(query)
        .bind(serverId, fromTimestamp)
        .all<{
          timestamp: number;
          cpu_percent: number | null;
          memory_percent: number | null;
          player_count: number | null;
        }>();

      points = (result.results || []).map(row => ({
        timestamp: row.timestamp,
        cpu: row.cpu_percent,
        memory: row.memory_percent,
        players: row.player_count,
      }));
    }

    return c.json({
      success: true,
      range,
      fromTimestamp,
      toTimestamp: now,
      count: points.length,
      points,
    });
  } catch (error) {
    console.error('[Servers API] Error fetching metrics history:', error);
    return c.json({ error: 'Failed to fetch metrics history' }, 500);
  }
});

export { servers };
