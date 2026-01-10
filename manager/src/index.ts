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
app.route('/api/admin', admin);
app.route('/api/agents', agents);

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
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * Root endpoint (will serve static frontend in production)
 */
app.get('/', (c) => {
  return c.text('ZedOps Manager - Use /health for health check, /ws for WebSocket connection');
});

export default app;
