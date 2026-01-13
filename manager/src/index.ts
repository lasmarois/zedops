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

/**
 * Catch-all route for SPA - serve index.html for client-side routes
 *
 * For non-API, non-asset routes, serve index.html to enable React Router.
 * NOTE: This HTML content must be kept in sync with frontend/dist/index.html
 * after each build. Consider automating this with a build script if it becomes
 * an issue.
 */
app.get('*', async (c) => {
  const path = new URL(c.req.url).pathname;

  // If it's a static asset, let Cloudflare's asset handler serve it
  if (path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/) || path.startsWith('/assets/')) {
    return c.notFound();
  }

  // For all other routes, serve index.html (copied from frontend/dist/index.html)
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ZedOps</title>
    <!-- Google Fonts - Multiple options for testing -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Archivo:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <script type="module" crossorigin src="/assets/index-CE2ViLk5.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-CG2o4jqB.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`);
});

export default app;
