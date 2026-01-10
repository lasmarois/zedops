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
        isRegistered: this.isRegistered,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Container list endpoint
    if (url.pathname === "/containers" && request.method === "GET") {
      return this.handleContainersRequest();
    }

    // Container operation endpoint
    if (url.pathname.startsWith("/containers/") && request.method === "POST") {
      const parts = url.pathname.split("/");
      const containerId = parts[2];
      const operation = parts[3]; // start, stop, restart

      if (containerId && operation) {
        return this.handleContainerOperationRequest(containerId, operation);
      }
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

    // Allow agent.register and agent.auth without registration
    if (subject === "agent.register") {
      await this.handleAgentRegister(message);
      return;
    }

    if (subject === "agent.auth") {
      await this.handleAgentAuth(message);
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

      case "container.list":
        await this.handleContainerList(message);
        break;

      case "container.start":
        await this.handleContainerOperation(message, "start");
        break;

      case "container.stop":
        await this.handleContainerOperation(message, "stop");
        break;

      case "container.restart":
        await this.handleContainerOperation(message, "restart");
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
   * Handle agent.auth message
   * Authenticate agent with permanent token
   */
  private async handleAgentAuth(message: Message): Promise<void> {
    try {
      const { token } = message.data;

      if (!token || typeof token !== 'string') {
        this.sendError("Authentication requires 'token' field");
        return;
      }

      // Verify permanent token
      let payload;
      try {
        payload = await verifyToken(token, this.env.TOKEN_SECRET);
      } catch (error) {
        console.error("[AgentConnection] Token verification failed:", error);
        this.sendError("Invalid or expired token");
        return;
      }

      // Check token type
      if (payload.type !== 'permanent') {
        this.sendError("Authentication requires permanent token");
        return;
      }

      // Extract agent ID from token
      const agentId = payload.agentId as string;
      const agentName = payload.agentName as string;

      if (!agentId || !agentName) {
        this.sendError("Invalid token payload");
        return;
      }

      // Verify token hash matches database
      const tokenHash = await hashToken(token);
      const result = await this.env.DB.prepare(
        `SELECT id, name, token_hash FROM agents WHERE id = ?`
      )
        .bind(agentId)
        .first();

      if (!result) {
        this.sendError("Agent not found");
        return;
      }

      if (result.token_hash !== tokenHash) {
        this.sendError("Invalid token");
        return;
      }

      // Mark as registered
      this.agentId = agentId;
      this.agentName = agentName;
      this.isRegistered = true;

      // Update status to online and last_seen
      const now = Math.floor(Date.now() / 1000);
      await this.env.DB.prepare(
        `UPDATE agents SET status = 'online', last_seen = ? WHERE id = ?`
      )
        .bind(now, agentId)
        .run();

      console.log(`[AgentConnection] Agent authenticated: ${agentName} (${agentId})`);

      // Send success response
      this.send(createMessage("agent.auth.success", {
        agentId,
        agentName,
        message: "Authentication successful",
      }));
    } catch (error) {
      console.error("[AgentConnection] Authentication error:", error);
      this.sendError("Authentication failed");
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

  /**
   * Handle container.list message
   * Request list of containers from agent
   */
  private async handleContainerList(message: Message): Promise<void> {
    console.log(`[AgentConnection] Requesting container list from agent ${this.agentId}`);

    // Simply forward the request to the agent
    // Agent will respond with container.list.response
    this.send(createMessage("container.list", {}));
  }

  /**
   * Handle container operations (start, stop, restart)
   * Forward operation request to agent
   */
  private async handleContainerOperation(message: Message, operation: string): Promise<void> {
    const { containerId } = message.data as { containerId?: string };

    if (!containerId) {
      this.sendError("Container operation requires containerId");
      return;
    }

    console.log(`[AgentConnection] Requesting container.${operation} for ${containerId} on agent ${this.agentId}`);

    // Forward operation to agent
    this.send(createMessage(`container.${operation}`, {
      containerId,
      operation,
    }));
  }

  /**
   * HTTP handler for container list request
   * Implements request/reply pattern with agent
   */
  private async handleContainersRequest(): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({
        error: "Agent not connected",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<Message>((resolve, reject) => {
      // Set timeout (10 seconds)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Request timeout"));
      }, 10000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    // Send request to agent with reply inbox
    this.send({
      subject: "container.list",
      data: {},
      reply: inbox,
    });

    try {
      // Wait for reply
      const reply = await replyPromise;

      return new Response(JSON.stringify(reply.data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Request failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * HTTP handler for container operation request
   * Implements request/reply pattern with agent
   */
  private async handleContainerOperationRequest(
    containerId: string,
    operation: string
  ): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({
        error: "Agent not connected",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate operation
    if (!["start", "stop", "restart"].includes(operation)) {
      return new Response(JSON.stringify({
        error: `Invalid operation: ${operation}`,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<Message>((resolve, reject) => {
      // Set timeout (30 seconds for operations)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Operation timeout"));
      }, 30000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    // Send operation request to agent with reply inbox
    this.send({
      subject: `container.${operation}`,
      data: {
        containerId,
        operation,
      },
      reply: inbox,
    });

    try {
      // Wait for reply
      const reply = await replyPromise;

      // Check if operation succeeded
      const success = reply.data.success !== false;

      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Operation failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
