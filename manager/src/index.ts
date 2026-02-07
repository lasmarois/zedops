/**
 * ZedOps Manager - Cloudflare Worker
 *
 * Full-stack deployment:
 * - Static assets (React frontend) served from ../frontend/dist
 * - API endpoints for admin and agent management
 * - WebSocket hub via Durable Objects for agent connections
 * - D1 database for persistent storage
 */

import { Hono } from 'hono';
import { AgentConnection } from './durable-objects/AgentConnection';
import { admin } from './routes/admin';
import { agents } from './routes/agents';
import { servers } from './routes/servers';
import { auth } from './routes/auth';
import { users } from './routes/users';
import { invitations } from './routes/invitations';
// import { permissions } from './routes/permissions'; // DEPRECATED - Removed (incompatible with role-based system)
import { roleAssignments } from './routes/role-assignments';
import { audit } from './routes/audit';
import { hashPassword } from './lib/auth';

// Export Durable Object class
export { AgentConnection };

// Type for environment bindings
type Bindings = {
  AGENT_CONNECTION: DurableObjectNamespace;
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
  BROADCAST_WEBHOOK_SECRET?: string;
};

// Create Hono app with bindings
const app = new Hono<{ Bindings: Bindings }>();

// Mount API routes
app.route('/api/auth', auth);
app.route('/api/users', users);
app.route('/api/users/invite', invitations);
app.route('/api/invite', invitations); // Public invitation endpoints
// app.route('/api/permissions', permissions); // DEPRECATED - Removed (incompatible with role-based system)
app.route('/api/role-assignments', roleAssignments); // New role-based system
app.route('/api/audit', audit); // Audit logs
app.route('/api/admin', admin);
app.route('/api/agents', agents);
app.route('/api/servers', servers); // Global server endpoints

/**
 * GET /api/agent/version
 * Returns the latest agent version for auto-update checks
 * Fetches from GitHub releases API with 1-hour cache
 * No auth required - agents need to check before authenticating
 */
app.get('/api/agent/version', async (c) => {
  const GITHUB_REPO = 'lasmarois/zedops';
  const CACHE_KEY = 'agent-version-info';
  const CACHE_TTL = 3600; // 1 hour in seconds

  // Try to get from Cloudflare Cache
  const cache = caches.default;
  const cacheUrl = new URL(c.req.url);
  cacheUrl.pathname = `/__cache/${CACHE_KEY}`;
  const cacheRequest = new Request(cacheUrl.toString());

  let cachedResponse = await cache.match(cacheRequest);
  if (cachedResponse) {
    // Return cached response
    const data = await cachedResponse.json();
    return c.json(data);
  }

  // Fetch from GitHub releases API
  try {
    const githubResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ZedOps-Manager',
        },
      }
    );

    if (!githubResponse.ok) {
      console.error(`GitHub API error: ${githubResponse.status}`);
      // Fallback to hardcoded version if GitHub API fails
      return c.json({
        version: '1.0.1',
        downloadUrls: {
          'linux-amd64': `https://github.com/${GITHUB_REPO}/releases/download/agent-v1.0.1/zedops-agent-linux-amd64`,
          'linux-arm64': `https://github.com/${GITHUB_REPO}/releases/download/agent-v1.0.1/zedops-agent-linux-arm64`,
        },
      });
    }

    const releases = await githubResponse.json() as Array<{
      tag_name: string;
      draft: boolean;
      prerelease: boolean;
    }>;

    // Find latest agent release (tag starts with 'agent-v')
    const agentRelease = releases.find(
      (r) => r.tag_name.startsWith('agent-v') && !r.draft && !r.prerelease
    );

    if (!agentRelease) {
      return c.json({ error: 'No agent release found' }, 404);
    }

    // Extract version from tag (agent-v1.0.1 -> 1.0.1)
    const version = agentRelease.tag_name.replace('agent-v', '');

    const responseData = {
      version,
      downloadUrls: {
        'linux-amd64': `https://github.com/${GITHUB_REPO}/releases/download/${agentRelease.tag_name}/zedops-agent-linux-amd64`,
        'linux-arm64': `https://github.com/${GITHUB_REPO}/releases/download/${agentRelease.tag_name}/zedops-agent-linux-arm64`,
      },
    };

    // Cache the response
    const responseToCache = new Response(JSON.stringify(responseData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
      },
    });
    c.executionCtx.waitUntil(cache.put(cacheRequest, responseToCache));

    return c.json(responseData);
  } catch (error) {
    console.error('Failed to fetch from GitHub:', error);
    // Fallback to hardcoded version
    return c.json({
      version: '1.0.1',
      downloadUrls: {
        'linux-amd64': `https://github.com/${GITHUB_REPO}/releases/download/agent-v1.0.1/zedops-agent-linux-amd64`,
        'linux-arm64': `https://github.com/${GITHUB_REPO}/releases/download/agent-v1.0.1/zedops-agent-linux-arm64`,
      },
    });
  }
});

/**
 * POST /api/webhook/broadcast-update
 * Webhook endpoint for CI/CD to broadcast update notification to all agents
 *
 * Auth: X-Webhook-Secret header must match BROADCAST_WEBHOOK_SECRET
 * Body: { version: string }
 * Returns: { success: boolean, version: string, notified: string[], failed: string[] }
 */
app.post('/api/webhook/broadcast-update', async (c) => {
  // Check webhook secret
  const secret = c.req.header('X-Webhook-Secret');
  const expectedSecret = c.env.BROADCAST_WEBHOOK_SECRET;

  if (!expectedSecret) {
    return c.json({ error: 'Webhook not configured' }, 503);
  }

  if (!secret || secret !== expectedSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get version from body
  let version: string;
  try {
    const body = await c.req.json();
    version = body.version;
  } catch {
    return c.json({ error: 'Invalid body - expected { version: string }' }, 400);
  }

  if (!version) {
    return c.json({ error: 'version is required' }, 400);
  }

  // Get all connected agents from database
  const agents = await c.env.DB.prepare(
    "SELECT id, name FROM agents WHERE status = 'online'"
  ).all();

  const notified: string[] = [];
  const failed: string[] = [];

  // Send notification to each agent's Durable Object
  for (const agent of agents.results || []) {
    try {
      const agentName = agent.name as string;
      const doId = c.env.AGENT_CONNECTION.idFromName(agentName);
      const stub = c.env.AGENT_CONNECTION.get(doId);

      const response = await stub.fetch(new Request('http://internal/notify-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      }));

      const result = await response.json() as { success: boolean; error?: string };

      if (result.success) {
        notified.push(agentName);
      } else {
        failed.push(agentName);
      }
    } catch (error) {
      console.error(`Failed to notify agent ${agent.name}:`, error);
      failed.push(agent.name as string);
    }
  }

  return c.json({
    success: true,
    version,
    notified,
    failed,
    total: (agents.results || []).length,
  });
});

/**
 * WebSocket endpoint - Routes to AgentConnection Durable Object
 *
 * Agent connects to: ws://manager-url/ws?name=<agent-name>
 * Each agent gets its own Durable Object instance based on agent name
 */
app.get('/ws', async (c) => {
  // Get agent name from query parameter
  const agentName = c.req.query('name');

  if (!agentName) {
    return c.json({ error: 'Missing agent name in query parameter' }, 400);
  }

  // Use agent name to get consistent Durable Object instance
  // This ensures the same agent always connects to the same Durable Object
  const id = c.env.AGENT_CONNECTION.idFromName(agentName);
  const stub = c.env.AGENT_CONNECTION.get(id);

  // Forward request to Durable Object
  return stub.fetch(c.req.raw);
});

/**
 * Bootstrap endpoint - Create initial admin user
 *
 * This endpoint should be called once after deployment to create the
 * bootstrap admin user. It checks if the users table is empty and creates
 * a default admin account using the ADMIN_PASSWORD environment variable.
 *
 * Call with: POST /api/bootstrap
 * Protected by ADMIN_PASSWORD (same as current auth mechanism)
 */
app.post('/api/bootstrap', async (c) => {
  try {
    // Verify ADMIN_PASSWORD to protect this endpoint
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const providedPassword = authHeader.substring(7);
    if (providedPassword !== c.env.ADMIN_PASSWORD) {
      return c.json({ error: 'Invalid admin password' }, 401);
    }

    // Check if users table is empty
    const existingUsers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();

    if (existingUsers && (existingUsers.count as number) > 0) {
      return c.json({
        message: 'Bootstrap already completed - users table is not empty',
        userCount: existingUsers.count,
      });
    }

    // Create bootstrap admin user
    const userId = crypto.randomUUID();
    const email = 'admin@zedops.local';
    const passwordHash = await hashPassword(c.env.ADMIN_PASSWORD);
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(userId, email, passwordHash, 'admin', now, now)
      .run();

    return c.json({
      message: 'Bootstrap admin user created successfully',
      user: {
        id: userId,
        email,
        role: 'admin',
      },
      instructions: [
        'You can now login with:',
        `  Email: ${email}`,
        `  Password: <value of ADMIN_PASSWORD>`,
        '',
        'After logging in, you should:',
        '1. Create a new admin user with your email',
        '2. Delete or change the password for admin@zedops.local',
      ],
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return c.json({ error: 'Internal server error', details: (error as Error).message }, 500);
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// SPA routing is handled by Cloudflare's asset handler via
// not_found_handling = "single-page-application" in wrangler.toml.
// No catch-all needed — navigation requests to non-asset paths
// automatically serve dist/index.html with correct hashed filenames.

export default app;

