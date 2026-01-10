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

/**
 * WebSocket endpoint - Routes to AgentConnection Durable Object
 *
 * Agent connects to: ws://manager-url/ws
 * Each agent gets its own Durable Object instance
 */
app.get('/ws', async (c) => {
  // For MVP, use random ID (will be replaced with agent ID from token in Phase 4)
  const agentId = crypto.randomUUID();

  // Get Durable Object instance for this agent
  const id = c.env.AGENT_CONNECTION.idFromName(agentId);
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
