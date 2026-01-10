/**
 * AgentConnection Durable Object
 *
 * Manages persistent WebSocket connection for a single agent.
 * Each agent gets its own Durable Object instance identified by agent ID.
 *
 * Implements NATS-inspired message protocol with subject-based routing.
 */

import { DurableObject } from "cloudflare:workers";
import {
  Message,
  validateMessage,
  parseMessage,
  createMessage,
  isInboxSubject,
} from "../types/Message";
import {
  verifyToken,
  generatePermanentToken,
  hashToken,
} from "../lib/tokens";

export class AgentConnection extends DurableObject {
  private ws: WebSocket | null = null;
  private agentId: string | null = null;
  private agentName: string | null = null;
  private isRegistered: boolean = false;
  private pendingReplies: Map<string, (msg: Message) => void> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  /**
   * Handle HTTP requests to this Durable Object
   * Used for WebSocket upgrades and status queries
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade endpoint
    if (url.pathname === "/ws") {
      return this.handleWebSocketUpgrade(request);
    }

    // Status endpoint (for debugging)
    if (url.pathname === "/status") {
      return new Response(JSON.stringify({
        connected: this.ws !== null,
        agentId: this.agentId,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * Upgrade HTTP request to WebSocket connection
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    // Create WebSocket pair (one for client, one for server)
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();
    this.ws = server;

    console.log("[AgentConnection] WebSocket connection established");

    // Set up message handlers
    server.addEventListener("message", (event) => {
      this.handleMessage(event);
    });

    server.addEventListener("close", (event) => {
      this.handleClose(event);
    });

    server.addEventListener("error", (event) => {
      this.handleError(event);
    });

    // Return the client side of the WebSocket to the client
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const data = event.data;

      // Parse and validate message
      const message = parseMessage(data);
      const validation = validateMessage(message);

      if (!validation.valid) {
        console.error(`[AgentConnection] Invalid message: ${validation.error}`);
        this.sendError(validation.error || "Invalid message");
        return;
      }

      console.log(`[AgentConnection] Received: ${message.subject}`, message.data);

      // Route message based on subject
      await this.routeMessage(message);
    } catch (error) {
      console.error("[AgentConnection] Error handling message:", error);
      this.sendError("Failed to process message");
    }
  }

  /**
   * Route message based on subject (NATS-style routing)
   */
  private async routeMessage(message: Message): Promise<void> {
    const { subject } = message;

    // Check if this is a reply to a pending request
    if (isInboxSubject(subject)) {
      this.handleInboxReply(message);
      return;
    }

    // Allow agent.register without registration
    if (subject === "agent.register") {
      await this.handleAgentRegister(message);
      return;
    }

    // All other subjects require registration
    if (!this.isRegistered) {
      this.sendError("Agent must register before sending messages");
      return;
    }

    // Route to appropriate handler based on subject
    switch (subject) {
      case "agent.heartbeat":
        await this.handleAgentHeartbeat(message);
        break;

      case "test.echo":
        // Echo back for testing
        this.send(createMessage("test.echo", message.data));
        break;

      default:
        console.warn(`[AgentConnection] Unknown subject: ${subject}`);
        this.sendError(`Unknown subject: ${subject}`);
    }
  }

  /**
   * Handle inbox reply messages (request/reply pattern)
   */
  private handleInboxReply(message: Message): void {
    const handler = this.pendingReplies.get(message.subject);
    if (handler) {
      handler(message);
      this.pendingReplies.delete(message.subject);
    } else {
      console.warn(`[AgentConnection] No handler for inbox: ${message.subject}`);
    }
  }

  /**
   * Handle agent.register message
   * Token-based registration flow
   */
  private async handleAgentRegister(message: Message): Promise<void> {
    try {
      const { token, agentName } = message.data;

      if (!token || typeof token !== 'string') {
        this.sendError("Registration requires 'token' field");
        return;
      }

      if (!agentName || typeof agentName !== 'string') {
        this.sendError("Registration requires 'agentName' field");
        return;
      }

      // Verify ephemeral token
      let payload;
      try {
        payload = await verifyToken(token, this.env.TOKEN_SECRET);
      } catch (error) {
        console.error("[AgentConnection] Token verification failed:", error);
        this.sendError("Invalid or expired token");
        return;
      }

      // Check token type
      if (payload.type !== 'ephemeral') {
        this.sendError("Registration requires ephemeral token");
        return;
      }

      // Check agent name matches token
      if (payload.agentName !== agentName) {
        this.sendError("Agent name does not match token");
        return;
      }

      // Generate agent ID
      const agentId = crypto.randomUUID();

      // Generate permanent token
      const permanentToken = await generatePermanentToken(
        agentId,
        agentName,
        this.env.TOKEN_SECRET
      );

      // Hash permanent token for storage
      const tokenHash = await hashToken(permanentToken);

      // Store agent in D1
      const now = Math.floor(Date.now() / 1000);
      await this.env.DB.prepare(
        `INSERT INTO agents (id, name, token_hash, status, last_seen, created_at, metadata)
         VALUES (?, ?, ?, 'online', ?, ?, ?)`
      )
        .bind(agentId, agentName, tokenHash, now, now, JSON.stringify({}))
        .run();

      // Mark as registered
      this.agentId = agentId;
      this.agentName = agentName;
      this.isRegistered = true;

      console.log(`[AgentConnection] Agent registered: ${agentName} (${agentId})`);

      // Send permanent token to agent
      this.send(createMessage("agent.register.success", {
        agentId,
        token: permanentToken,
        message: "Registration successful",
      }));
    } catch (error) {
      console.error("[AgentConnection] Registration error:", error);
      this.sendError("Registration failed");
    }
  }

  /**
   * Handle agent.heartbeat message
   * Update last_seen timestamp in D1
   */
  private async handleAgentHeartbeat(message: Message): Promise<void> {
    if (!this.isRegistered || !this.agentId) {
      this.sendError("Agent must be registered to send heartbeat");
      return;
    }

    // Update last_seen in D1
    const now = Math.floor(Date.now() / 1000);
    try {
      await this.env.DB.prepare(
        `UPDATE agents SET last_seen = ? WHERE id = ?`
      )
        .bind(now, this.agentId)
        .run();
    } catch (error) {
      console.error("[AgentConnection] Failed to update last_seen:", error);
    }

    // Acknowledge heartbeat
    this.send(createMessage("agent.heartbeat.ack", {
      timestamp: Date.now(),
    }));
  }

  /**
   * Send a message to the agent
   */
  private send(message: Message): void {
    if (this.ws) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send an error message to the agent
   */
  private sendError(error: string): void {
    this.send(createMessage("error", { message: error }));
  }

  /**
   * Handle WebSocket close event
   */
  private async handleClose(event: CloseEvent): Promise<void> {
    console.log(`[AgentConnection] WebSocket closed: code=${event.code}, reason=${event.reason}`);

    // Update agent status to offline if registered
    if (this.isRegistered && this.agentId) {
      try {
        await this.env.DB.prepare(
          `UPDATE agents SET status = 'offline' WHERE id = ?`
        )
          .bind(this.agentId)
          .run();
      } catch (error) {
        console.error("[AgentConnection] Failed to update agent status:", error);
      }
    }

    this.ws = null;
    this.agentId = null;
    this.agentName = null;
    this.isRegistered = false;
  }

  /**
   * Handle WebSocket error event
   */
  private async handleError(event: Event): Promise<void> {
    console.error("[AgentConnection] WebSocket error:", event);

    // Update agent status to offline if registered
    if (this.isRegistered && this.agentId) {
      try {
        await this.env.DB.prepare(
          `UPDATE agents SET status = 'offline' WHERE id = ?`
        )
          .bind(this.agentId)
          .run();
      } catch (error) {
        console.error("[AgentConnection] Failed to update agent status:", error);
      }
    }

    this.ws = null;
    this.agentId = null;
    this.agentName = null;
    this.isRegistered = false;
  }
}
