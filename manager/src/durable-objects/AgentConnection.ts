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
import {
  LogLine,
  LogSubscriber,
  CircularBuffer,
} from "../types/LogMessage";
import { logRconCommand } from "../lib/audit";

export class AgentConnection extends DurableObject {
  private ws: WebSocket | null = null;
  private agentId: string | null = null;
  private agentName: string | null = null;
  private isRegistered: boolean = false;
  private pendingReplies: Map<string, (msg: Message) => void> = new Map();

  // Log streaming pub/sub
  private logSubscribers: Map<string, LogSubscriber> = new Map(); // subscriberId -> LogSubscriber
  private logBuffers: Map<string, CircularBuffer<LogLine>> = new Map(); // containerId -> buffer

  // RCON session tracking
  private rconSessions: Map<string, { sessionId: string; serverId: string }> = new Map(); // sessionId -> { sessionId, serverId }

  // UI WebSocket tracking (for audit logging)
  private uiWebSockets: Map<WebSocket, string> = new Map(); // UI WebSocket -> userId

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  /**
   * Handle HTTP requests to this Durable Object
   * Used for WebSocket upgrades and status queries
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    console.log(`[AgentConnection] fetch() called with URL: ${url.pathname}`);

    // WebSocket upgrade endpoint (for agent)
    if (url.pathname === "/ws") {
      return this.handleWebSocketUpgrade(request);
    }

    // WebSocket upgrade endpoint (for UI log subscribers)
    // Support both /logs/ws and /api/agents/{id}/logs/ws
    if (url.pathname === "/logs/ws" || url.pathname.endsWith("/logs/ws")) {
      return this.handleUIWebSocketUpgrade(request);
    }

    // Status endpoint (for debugging)
    if (url.pathname === "/status") {
      return new Response(JSON.stringify({
        connected: this.ws !== null,
        agentId: this.agentId,
        isRegistered: this.isRegistered,
        logSubscribers: this.logSubscribers.size,
        logBuffers: this.logBuffers.size,
        rconSessions: this.rconSessions.size,
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

    // Port availability check endpoint
    if (url.pathname === "/ports/check" && request.method === "POST") {
      return this.handlePortCheckRequest(request);
    }

    // Server create endpoint
    if (url.pathname === "/servers" && request.method === "POST") {
      return this.handleServerCreateRequest(request);
    }

    // Server sync endpoint
    if (url.pathname === "/servers/sync" && request.method === "POST") {
      return this.handleServerSyncRequest(request);
    }

    // Server delete endpoint
    if (url.pathname.startsWith("/servers/") && request.method === "DELETE") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      if (serverId) {
        return this.handleServerDeleteRequest(request, serverId);
      }
    }

    // Server rebuild endpoint
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/rebuild") && request.method === "POST") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      if (serverId) {
        return this.handleServerRebuildRequest(request, serverId);
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

      case "log.line":
        await this.handleLogLine(message);
        break;

      case "log.stream.error":
        await this.handleLogStreamError(message);
        break;

      case "rcon.connect":
        await this.handleRCONConnect(message);
        break;

      case "rcon.command":
        await this.handleRCONCommand(message);
        break;

      case "rcon.disconnect":
        await this.handleRCONDisconnect(message);
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

      // Persist agentId to storage for hibernation recovery
      await this.ctx.storage.put('agentId', agentId);
      await this.ctx.storage.put('agentName', agentName);

      console.log(`[AgentConnection] Agent registered: ${agentName} (${agentId})`);

      // Send permanent token to agent
      await this.send(createMessage("agent.register.success", {
        agentId,
        token: permanentToken,
        message: "Registration successful",
      }));

      // Trigger initial server status sync in background
      this.ctx.waitUntil(this.triggerServerSync());
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

      // Persist agentId to storage for hibernation recovery
      await this.ctx.storage.put('agentId', agentId);
      await this.ctx.storage.put('agentName', agentName);

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

      // Trigger initial server status sync in background
      this.ctx.waitUntil(this.triggerServerSync());
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

    const now = Math.floor(Date.now() / 1000);

    // Extract metrics if present (backward compatible)
    const metrics = message.data.metrics || null;

    try {
      if (metrics) {
        // Update with metrics in metadata
        const metadataJson = JSON.stringify({
          metrics: {
            ...metrics,
            lastUpdate: now,
          }
        });

        await this.env.DB.prepare(
          `UPDATE agents SET last_seen = ?, metadata = ? WHERE id = ?`
        )
          .bind(now, metadataJson, this.agentId)
          .run();

        console.log(`[AgentConnection] Agent ${this.agentName} heartbeat with metrics: CPU ${metrics.cpuPercent}%, Mem ${metrics.memoryUsedMB}/${metrics.memoryTotalMB}MB`);
      } else {
        // Update without metrics (backward compatible)
        await this.env.DB.prepare(
          `UPDATE agents SET last_seen = ? WHERE id = ?`
        )
          .bind(now, this.agentId)
          .run();

        console.log(`[AgentConnection] Agent ${this.agentName} heartbeat (no metrics)`);
      }
    } catch (error) {
      console.error("[AgentConnection] Failed to update agent:", error);
    }

    // Acknowledge heartbeat
    this.send(createMessage("agent.heartbeat.ack", {
      timestamp: Date.now(),
    }));
  }

  /**
   * Get the active WebSocket connection (handles hibernation)
   * Also restores agent state from storage if needed
   */
  private async getActiveWebSocket(): Promise<WebSocket | null> {
    // Try instance variable first (performance optimization)
    if (this.ws && this.isRegistered) {
      return this.ws;
    }

    console.log(`[AgentConnection] getActiveWebSocket: ws=${!!this.ws}, isRegistered=${this.isRegistered}, agentId=${this.agentId}`);

    // Fallback to ctx.getWebSockets() for hibernation scenarios
    const sockets = this.ctx.getWebSockets();
    console.log(`[AgentConnection] getActiveWebSocket: found ${sockets.length} sockets`);

    if (sockets.length > 0) {
      // Update instance variable for future calls
      this.ws = sockets[0];

      // Restore agent state from storage if not already registered
      if (!this.isRegistered) {
        console.log(`[AgentConnection] Attempting to restore state from storage...`);
        const storedAgentId = await this.ctx.storage.get<string>('agentId');
        const storedAgentName = await this.ctx.storage.get<string>('agentName');
        console.log(`[AgentConnection] Storage read: agentId=${storedAgentId}, agentName=${storedAgentName}`);

        if (storedAgentId && storedAgentName) {
          this.agentId = storedAgentId;
          this.agentName = storedAgentName;
          this.isRegistered = true;
          console.log(`[AgentConnection] Restored agent state from storage: ${storedAgentName} (${storedAgentId})`);
        } else {
          console.error(`[AgentConnection] Failed to restore state: agentId or agentName not found in storage`);
        }
      }

      return sockets[0];
    }

    console.log(`[AgentConnection] No WebSocket found`);
    return null;
  }

  /**
   * Send a message to the agent
   */
  private async send(message: Message): Promise<void> {
    const ws = await this.getActiveWebSocket();
    if (ws) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send a message to the agent and wait for a reply
   * Returns a promise that resolves with the reply message
   */
  private async sendMessageWithReply(message: { subject: string; data: any }, timeout: number = 10000): Promise<Message> {
    const ws = await this.getActiveWebSocket();
    if (!ws || !this.isRegistered) {
      throw new Error("Agent not connected");
    }

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<Message>((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeoutId);
        resolve(msg);
      });
    });

    // Send request to agent with reply inbox
    this.send({
      subject: message.subject,
      data: message.data,
      reply: inbox,
      timestamp: Date.now(),
    });

    return replyPromise;
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
   * HTTP handler for port availability check request
   * Implements request/reply pattern with agent
   */
  private async handlePortCheckRequest(request: Request): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({
        error: "Agent not connected",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    let body: { ports: number[] };
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Invalid JSON body",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body.ports || !Array.isArray(body.ports)) {
      return new Response(JSON.stringify({
        error: "Missing or invalid ports array",
      }), {
        status: 400,
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
      subject: "port.check",
      data: {
        ports: body.ports,
      },
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

  /**
   * Handle UI WebSocket upgrade (for log subscribers)
   */
  private async handleUIWebSocketUpgrade(request: Request): Promise<Response> {
    console.log(`[AgentConnection] handleUIWebSocketUpgrade called`);
    console.log(`[AgentConnection] Request URL: ${request.url}`);
    console.log(`[AgentConnection] Request method: ${request.method}`);
    console.log(`[AgentConnection] Upgrade header: ${request.headers.get("Upgrade")}`);
    console.log(`[AgentConnection] Connection header: ${request.headers.get("Connection")}`);

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      console.error(`[AgentConnection] Invalid upgrade header: ${upgradeHeader}`);
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    // Extract user ID from header (passed by agents.ts for audit logging)
    const userId = request.headers.get("X-User-Id") || undefined;
    if (userId) {
      console.log(`[AgentConnection] UI connection with user ID: ${userId}`);
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Generate unique subscriber ID
    const subscriberId = crypto.randomUUID();

    // Store user ID for audit logging
    if (userId) {
      this.uiWebSockets.set(server, userId);
    }

    console.log(`[AgentConnection] UI subscriber connected: ${subscriberId}`);

    // Set up message handlers for UI client
    server.addEventListener("message", (event) => {
      this.handleUIMessage(subscriberId, server, event);
    });

    server.addEventListener("close", () => {
      console.log(`[AgentConnection] UI subscriber disconnected: ${subscriberId}`);
      this.logSubscribers.delete(subscriberId);
      this.uiWebSockets.delete(server);
    });

    server.addEventListener("error", (event) => {
      console.error(`[AgentConnection] UI subscriber error: ${subscriberId}`, event);
      this.logSubscribers.delete(subscriberId);
      this.uiWebSockets.delete(server);
    });

    // Return the client side to the UI
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle messages from UI clients
   */
  private async handleUIMessage(
    subscriberId: string,
    ws: WebSocket,
    event: MessageEvent
  ): Promise<void> {
    try {
      const message = parseMessage(event.data);
      const validation = validateMessage(message);

      if (!validation.valid) {
        ws.send(JSON.stringify(createMessage("error", { message: validation.error })));
        return;
      }

      console.log(`[AgentConnection] UI message from ${subscriberId}: ${message.subject}`);

      // Route UI messages
      switch (message.subject) {
        case "log.subscribe":
          await this.handleLogSubscribe(subscriberId, ws, message);
          break;

        case "log.unsubscribe":
          await this.handleLogUnsubscribe(subscriberId, message);
          break;

        case "rcon.connect":
        case "rcon.command":
        case "rcon.disconnect":
          // Forward RCON messages to agent and send reply back to UI
          await this.handleUIRCONMessage(ws, message);
          break;

        default:
          ws.send(JSON.stringify(createMessage("error", { message: `Unknown subject: ${message.subject}` })));
      }
    } catch (error) {
      console.error(`[AgentConnection] Error handling UI message:`, error);
      ws.send(JSON.stringify(createMessage("error", { message: "Failed to process message" })));
    }
  }

  /**
   * Handle RCON messages from UI client
   * Forward to agent and send reply back to UI WebSocket
   */
  private async handleUIRCONMessage(ws: WebSocket, message: Message): Promise<void> {
    try {
      console.log(`[AgentConnection] UI RCON message: ${message.subject}`);

      // Check if agent is connected
      const agentWs = await this.getActiveWebSocket();
      if (!agentWs) {
        console.error(`[AgentConnection] Cannot forward RCON message: agent not connected`);
        if (message.reply) {
          ws.send(JSON.stringify(createMessage(message.reply, {
            success: false,
            error: "Agent not connected",
            errorCode: "AGENT_OFFLINE",
          })));
        }
        return;
      }

      // Forward message to agent and wait for reply
      try {
        const reply = await this.sendMessageWithReply({
          subject: message.subject,
          data: message.data,
        }, 30000);

        // Send reply back to UI WebSocket
        if (message.reply) {
          ws.send(JSON.stringify(createMessage(message.reply, reply.data)));
        }

        // Store RCON session mapping if this was a successful connect
        if (message.subject === "rcon.connect" && reply.data.success) {
          const sessionId = reply.data.sessionId;
          const serverId = (message.data as any).serverId;
          if (sessionId && serverId) {
            this.rconSessions.set(sessionId, { sessionId, serverId });
            console.log(`[AgentConnection] RCON session created: ${sessionId} for server ${serverId}`);
          }
        }

        // Audit log RCON commands
        if (message.subject === "rcon.command" && reply.data.success) {
          const sessionId = (message.data as any).sessionId;
          const command = (message.data as any).command;
          const userId = this.uiWebSockets.get(ws);

          if (sessionId && command && userId) {
            const session = this.rconSessions.get(sessionId);
            if (session) {
              // Fetch server name from database for audit log
              try {
                const server = await this.env.DB.prepare(
                  'SELECT name FROM servers WHERE id = ?'
                )
                  .bind(session.serverId)
                  .first<{ name: string }>();

                if (server) {
                  // Create minimal context for audit logging (WebSocket has no IP/user-agent)
                  const mockContext = {
                    req: {
                      header: () => null,
                    },
                  } as any;

                  await logRconCommand(
                    this.env.DB,
                    mockContext,
                    userId,
                    session.serverId,
                    server.name,
                    command
                  );
                }
              } catch (error) {
                console.error('[AgentConnection] Failed to log RCON command:', error);
                // Don't fail the request if audit logging fails
              }
            }
          }
        }

        // Clean up RCON session if this was a disconnect
        if (message.subject === "rcon.disconnect" && reply.data.success) {
          const sessionId = (message.data as any).sessionId;
          if (sessionId && this.rconSessions.has(sessionId)) {
            this.rconSessions.delete(sessionId);
            console.log(`[AgentConnection] RCON session closed: ${sessionId}`);
          }
        }
      } catch (error) {
        console.error(`[AgentConnection] RCON message failed:`, error);
        if (message.reply) {
          ws.send(JSON.stringify(createMessage(message.reply, {
            success: false,
            error: error instanceof Error ? error.message : "RCON operation failed",
            errorCode: "RCON_FAILED",
          })));
        }
      }
    } catch (error) {
      console.error(`[AgentConnection] Error in handleUIRCONMessage:`, error);
      if (message.reply) {
        ws.send(JSON.stringify(createMessage(message.reply, {
          success: false,
          error: "Failed to process RCON message",
          errorCode: "INTERNAL_ERROR",
        })));
      }
    }
  }

  /**
   * Handle log.subscribe from UI client
   */
  private async handleLogSubscribe(
    subscriberId: string,
    ws: WebSocket,
    message: Message
  ): Promise<void> {
    try {
      const { containerId } = message.data as { containerId?: string };

      if (!containerId) {
        ws.send(JSON.stringify(createMessage("error", { message: "Missing containerId" })));
        return;
      }

      // Add subscriber
      this.logSubscribers.set(subscriberId, {
        id: subscriberId,
        ws,
        containerId,
      });

      console.log(`[AgentConnection] Subscriber ${subscriberId} subscribed to container ${containerId}`);

      // Create log buffer for this container if it doesn't exist
      if (!this.logBuffers.has(containerId)) {
        this.logBuffers.set(containerId, new CircularBuffer<LogLine>(1000));
      }

      // Send cached logs to new subscriber
      const buffer = this.logBuffers.get(containerId)!;
      const cachedLogs = buffer.getAll();

      if (cachedLogs.length > 0) {
        ws.send(JSON.stringify(createMessage("log.history", {
          containerId,
          lines: cachedLogs,
        })));
        console.log(`[AgentConnection] Sent ${cachedLogs.length} cached logs to ${subscriberId}`);
      } else {
        console.log(`[AgentConnection] No cached logs for container ${containerId}`);
      }

      // Check if we need to start log streaming from agent
      const subscribersForContainer = Array.from(this.logSubscribers.values())
        .filter(sub => sub.containerId === containerId);

      if (subscribersForContainer.length === 1) {
        // First subscriber for this container, start streaming from agent
        console.log(`[AgentConnection] Starting log stream for container ${containerId} on agent`);

        // Check if agent is connected
        const agentWs = await this.getActiveWebSocket();
        if (!agentWs) {
          console.error(`[AgentConnection] Cannot start log stream: agent not connected`);
          ws.send(JSON.stringify(createMessage("log.stream.error", {
            containerId,
            error: "Agent not connected",
          })));
        } else {
          await this.send(createMessage("log.stream.start", {
            containerId,
            tail: 1000,
            follow: true,
            timestamps: true,
          }));
        }
      }

      // Send acknowledgment
      ws.send(JSON.stringify(createMessage("log.subscribed", {
        containerId,
        message: "Subscribed to log stream",
      })));
    } catch (error) {
      console.error(`[AgentConnection] Error in handleLogSubscribe:`, error);
      ws.send(JSON.stringify(createMessage("error", {
        message: error instanceof Error ? error.message : "Failed to subscribe to logs",
      })));
    }
  }

  /**
   * Handle log.unsubscribe from UI client
   */
  private async handleLogUnsubscribe(
    subscriberId: string,
    message: Message
  ): Promise<void> {
    const subscriber = this.logSubscribers.get(subscriberId);
    if (!subscriber) {
      return; // Already unsubscribed
    }

    const { containerId } = subscriber;

    // Remove subscriber
    this.logSubscribers.delete(subscriberId);

    console.log(`[AgentConnection] Subscriber ${subscriberId} unsubscribed from container ${containerId}`);

    // Check if there are any remaining subscribers for this container
    const subscribersForContainer = Array.from(this.logSubscribers.values())
      .filter(sub => sub.containerId === containerId);

    if (subscribersForContainer.length === 0) {
      // No more subscribers, stop streaming from agent
      console.log(`[AgentConnection] Stopping log stream for container ${containerId} on agent`);
      this.send(createMessage("log.stream.stop", {
        containerId,
      }));
    }

    // Send acknowledgment
    subscriber.ws.send(JSON.stringify(createMessage("log.unsubscribed", {
      containerId,
      message: "Unsubscribed from log stream",
    })));
  }

  /**
   * Handle log.line from agent
   * Broadcast to all subscribers and cache
   */
  private async handleLogLine(message: Message): Promise<void> {
    const logLine = message.data as LogLine;
    const { containerId } = logLine;

    // Add to buffer
    let buffer = this.logBuffers.get(containerId);
    if (!buffer) {
      buffer = new CircularBuffer<LogLine>(1000);
      this.logBuffers.set(containerId, buffer);
    }
    buffer.append(logLine);

    // Broadcast to all subscribers watching this container
    const subscribers = Array.from(this.logSubscribers.values())
      .filter(sub => sub.containerId === containerId);

    if (subscribers.length > 0) {
      const broadcastMessage = JSON.stringify(createMessage("log.line", logLine));
      for (const subscriber of subscribers) {
        try {
          subscriber.ws.send(broadcastMessage);
        } catch (error) {
          console.error(`[AgentConnection] Failed to send log to subscriber ${subscriber.id}:`, error);
          // Remove dead subscriber
          this.logSubscribers.delete(subscriber.id);
        }
      }
    }
  }

  /**
   * Handle log.stream.error from agent
   * Forward error to all subscribers
   */
  private async handleLogStreamError(message: Message): Promise<void> {
    const { containerId, error, errorCode } = message.data as {
      containerId?: string;
      error?: string;
      errorCode?: string;
    };

    console.error(`[AgentConnection] Log stream error for ${containerId}: ${error} (${errorCode})`);

    if (!containerId) return;

    // Forward error to all subscribers watching this container
    const subscribers = Array.from(this.logSubscribers.values())
      .filter(sub => sub.containerId === containerId);

    const errorMessage = JSON.stringify(createMessage("log.stream.error", {
      containerId,
      error,
      errorCode,
    }));

    for (const subscriber of subscribers) {
      try {
        subscriber.ws.send(errorMessage);
      } catch (err) {
        console.error(`[AgentConnection] Failed to send error to subscriber ${subscriber.id}:`, err);
        this.logSubscribers.delete(subscriber.id);
      }
    }
  }

  /**
   * Handle rcon.connect from UI
   * Forward to agent and store session mapping
   * Agent will connect via Docker network (no host exposure)
   */
  private async handleRCONConnect(message: Message): Promise<void> {
    try {
      const { serverId, containerID, port, password } = message.data as {
        serverId?: string;
        containerID?: string;
        port?: number;
        password?: string;
      };

      if (!serverId || !containerID || !port || !password) {
        this.sendError("RCON connect requires serverId, containerID, port, and password");
        return;
      }

      console.log(`[AgentConnection] RCON connect request for server ${serverId} (container: ${containerID.substring(0, 12)}, port: ${port})`);

      // Check if agent is connected
      const agentWs = await this.getActiveWebSocket();
      if (!agentWs) {
        console.error(`[AgentConnection] Cannot connect RCON: agent not connected`);
        if (message.reply) {
          this.send(createMessage(message.reply, {
            success: false,
            error: "Agent not connected",
            errorCode: "AGENT_OFFLINE",
          }));
        }
        return;
      }

      // Forward to agent using request/reply pattern (agent connects via Docker network)
      try {
        const reply = await this.sendMessageWithReply({
          subject: "rcon.connect",
          data: { serverId, containerId: containerID, port, password },
        }, 30000);

        // Check if connection succeeded
        if (reply.data.success) {
          const sessionId = reply.data.sessionId;

          // Store session mapping
          this.rconSessions.set(sessionId, { sessionId, serverId });
          console.log(`[AgentConnection] RCON session created: ${sessionId} for server ${serverId}`);

          // Send success response to UI
          if (message.reply) {
            this.send(createMessage(message.reply, {
              success: true,
              sessionId,
            }));
          }
        } else {
          // Forward error to UI
          if (message.reply) {
            this.send(createMessage(message.reply, reply.data));
          }
        }
      } catch (error) {
        console.error(`[AgentConnection] RCON connect failed:`, error);
        if (message.reply) {
          this.send(createMessage(message.reply, {
            success: false,
            error: error instanceof Error ? error.message : "RCON connect failed",
            errorCode: "RCON_CONNECT_FAILED",
          }));
        }
      }
    } catch (error) {
      console.error(`[AgentConnection] Error in handleRCONConnect:`, error);
      this.sendError("Failed to process RCON connect request");
    }
  }

  /**
   * Handle rcon.command from UI
   * Forward to agent and return response
   */
  private async handleRCONCommand(message: Message): Promise<void> {
    try {
      const { sessionId, command } = message.data as {
        sessionId?: string;
        command?: string;
      };

      if (!sessionId || !command) {
        this.sendError("RCON command requires sessionId and command");
        return;
      }

      console.log(`[AgentConnection] RCON command: ${command} (session: ${sessionId})`);

      // Check if agent is connected
      const agentWs = await this.getActiveWebSocket();
      if (!agentWs) {
        console.error(`[AgentConnection] Cannot execute RCON command: agent not connected`);
        if (message.reply) {
          this.send(createMessage(message.reply, {
            success: false,
            error: "Agent not connected",
            errorCode: "AGENT_OFFLINE",
          }));
        }
        return;
      }

      // Forward to agent using request/reply pattern
      try {
        const reply = await this.sendMessageWithReply({
          subject: "rcon.command",
          data: { sessionId, command },
        }, 30000);

        // Forward response to UI
        if (message.reply) {
          this.send(createMessage(message.reply, reply.data));
        }
      } catch (error) {
        console.error(`[AgentConnection] RCON command failed:`, error);
        if (message.reply) {
          this.send(createMessage(message.reply, {
            success: false,
            error: error instanceof Error ? error.message : "RCON command failed",
            errorCode: "RCON_COMMAND_FAILED",
          }));
        }
      }
    } catch (error) {
      console.error(`[AgentConnection] Error in handleRCONCommand:`, error);
      this.sendError("Failed to process RCON command request");
    }
  }

  /**
   * Handle rcon.disconnect from UI
   * Forward to agent and remove session mapping
   */
  private async handleRCONDisconnect(message: Message): Promise<void> {
    try {
      const { sessionId } = message.data as { sessionId?: string };

      if (!sessionId) {
        this.sendError("RCON disconnect requires sessionId");
        return;
      }

      console.log(`[AgentConnection] RCON disconnect request for session ${sessionId}`);

      // Check if agent is connected
      const agentWs = await this.getActiveWebSocket();
      if (!agentWs) {
        console.error(`[AgentConnection] Cannot disconnect RCON: agent not connected`);
        // Remove session from map even if agent is offline
        this.rconSessions.delete(sessionId);

        if (message.reply) {
          this.send(createMessage(message.reply, {
            success: false,
            error: "Agent not connected",
            errorCode: "AGENT_OFFLINE",
          }));
        }
        return;
      }

      // Forward to agent using request/reply pattern
      try {
        const reply = await this.sendMessageWithReply({
          subject: "rcon.disconnect",
          data: { sessionId },
        }, 10000);

        // Remove session from map
        this.rconSessions.delete(sessionId);
        console.log(`[AgentConnection] RCON session removed: ${sessionId}`);

        // Forward response to UI
        if (message.reply) {
          this.send(createMessage(message.reply, reply.data));
        }
      } catch (error) {
        console.error(`[AgentConnection] RCON disconnect failed:`, error);
        // Remove session from map even if disconnect failed
        this.rconSessions.delete(sessionId);

        if (message.reply) {
          this.send(createMessage(message.reply, {
            success: false,
            error: error instanceof Error ? error.message : "RCON disconnect failed",
            errorCode: "RCON_DISCONNECT_FAILED",
          }));
        }
      }
    } catch (error) {
      console.error(`[AgentConnection] Error in handleRCONDisconnect:`, error);
      this.sendError("Failed to process RCON disconnect request");
    }
  }

  /**
   * HTTP handler for server create request
   * Implements request/reply pattern with agent
   */
  private async handleServerCreateRequest(request: Request): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({
        error: "Agent not connected",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Invalid JSON body",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    const { serverId, name, registry, imageTag, config, gamePort, udpPort, rconPort, dataPath } = body;
    if (!serverId || !name || !registry || !imageTag || !config || !gamePort || !udpPort || !rconPort || !dataPath) {
      return new Response(JSON.stringify({
        error: "Missing required fields",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<Message>((resolve, reject) => {
      // Set timeout (60 seconds for server creation)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server creation timeout"));
      }, 60000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    // Send server.create request to agent with reply inbox
    this.send({
      subject: "server.create",
      data: {
        serverId,
        name,
        registry,
        imageTag,
        config,
        gamePort,
        udpPort,
        rconPort,
        dataPath,
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
        error: error instanceof Error ? error.message : "Server creation failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * HTTP handler for server delete request
   * Implements request/reply pattern with agent
   */
  private async handleServerDeleteRequest(request: Request, serverId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({
        error: "Agent not connected",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Invalid JSON body",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { containerId, serverName, removeVolumes } = body;
    // containerId and serverName are both optional now
    // - If containerId exists, try to remove container first
    // - If serverName exists and removeVolumes=true, remove data directories
    if (!containerId && !serverName) {
      return new Response(JSON.stringify({
        error: "Missing containerId or serverName",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<Message>((resolve, reject) => {
      // Set timeout (30 seconds for server deletion)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server deletion timeout"));
      }, 30000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    // Send server.delete request to agent with reply inbox
    this.send({
      subject: "server.delete",
      data: {
        containerId: containerId || '',
        serverName: serverName || '',
        removeVolumes: removeVolumes ?? false,
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
        error: error instanceof Error ? error.message : "Server deletion failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * HTTP handler for server rebuild request
   * Implements request/reply pattern with agent
   */
  private async handleServerRebuildRequest(request: Request, serverId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({
        error: "Agent not connected",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Invalid JSON body",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { containerId } = body;
    if (!containerId) {
      return new Response(JSON.stringify({
        error: "Missing containerId",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<Message>((resolve, reject) => {
      // Set timeout (60 seconds for server rebuild - includes image pull)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server rebuild timeout"));
      }, 60000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    // Send server.rebuild request to agent with reply inbox
    this.send({
      subject: "server.rebuild",
      data: {
        containerId,
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
        error: error instanceof Error ? error.message : "Server rebuild failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * Handle server sync request from API
   */
  private async handleServerSyncRequest(request: Request): Promise<Response> {
    try {
      // Get agentId from header (passed from agents.ts route)
      const agentId = request.headers.get('X-Agent-Id');
      const result = await this.syncServers(agentId);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[AgentConnection] Server sync error:", error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Server sync failed",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * Sync server statuses with actual container and data existence
   * Returns: { success: boolean, servers: Server[], synced: number }
   */
  private async syncServers(agentId: string | null = null): Promise<any> {
    // Use provided agentId (from header) or fall back to instance state
    const effectiveAgentId = agentId || this.agentId;

    if (!effectiveAgentId) {
      throw new Error("Cannot sync: no agent ID");
    }

    // Note: We don't check this.ws here because during deployments,
    // the HTTP request might hit a different DO instance than the one
    // with the WebSocket. The sendMessageWithReply will fail gracefully if not connected.

    // Query all servers for this agent
    const serversResult = await this.env.DB.prepare(
      `SELECT * FROM servers WHERE agent_id = ?`
    )
      .bind(effectiveAgentId)
      .all();

    const servers = serversResult.results;
    if (servers.length === 0) {
      return { success: true, servers: [], synced: 0 };
    }

    console.log(`[Sync] Syncing ${servers.length} servers for agent ${effectiveAgentId}`);

    // Query agent for container list
    const containersResponse = await this.sendMessageWithReply({
      subject: 'container.list',  // Note: singular "container" not "containers"
      data: {},
    }, 10000);

    const containers = containersResponse.data.containers || [];
    console.log(`[Sync] Found ${containers.length} containers on agent`);

    // Query agent for data existence (batch check all server names)
    const serverNames = servers.map((s: any) => s.name);
    const dataCheckResponse = await this.sendMessageWithReply({
      subject: 'server.checkdata',
      data: {
        servers: serverNames,
        dataPath: '/var/lib/zedops/servers',
      },
    }, 10000);

    const dataStatuses = dataCheckResponse.data.statuses || [];
    console.log(`[Sync] Checked data existence for ${dataStatuses.length} servers`);

    // Build lookup maps
    const containerByName = new Map();
    for (const container of containers) {
      const labels = container.labels || {};
      const serverName = labels['zedops.server.name'];
      if (serverName) {
        containerByName.set(serverName, container);
      }
    }

    const dataByName = new Map();
    for (const dataStatus of dataStatuses) {
      dataByName.set(dataStatus.serverName, dataStatus);
    }

    // Update each server's status
    let syncedCount = 0;
    for (const server of servers) {
      const serverName = server.name;
      const container = containerByName.get(serverName);
      const dataStatus = dataByName.get(serverName);

      let newStatus = server.status;
      let newDataExists = server.data_exists === 1;

      // Update data_exists from actual check
      if (dataStatus) {
        newDataExists = dataStatus.dataExists;
      }

      // Determine status based on container and data existence
      if (container) {
        // Container exists
        if (container.state === 'running') {
          newStatus = 'running';
        } else if (container.state === 'exited' || container.state === 'stopped') {
          newStatus = 'stopped';
        }
      } else {
        // Container missing
        if (server.status !== 'creating' && server.status !== 'deleting' && server.status !== 'deleted') {
          newStatus = 'missing';
        }
      }

      // Only update if something changed
      if (newStatus !== server.status || newDataExists !== (server.data_exists === 1)) {
        await this.env.DB.prepare(
          `UPDATE servers SET status = ?, data_exists = ?, updated_at = ? WHERE id = ?`
        )
          .bind(newStatus, newDataExists ? 1 : 0, Date.now(), server.id)
          .run();

        console.log(`[Sync] Updated server ${serverName}: status=${newStatus}, data_exists=${newDataExists}`);
        syncedCount++;
      }
    }

    // Query updated servers
    const updatedServersResult = await this.env.DB.prepare(
      `SELECT * FROM servers WHERE agent_id = ? ORDER BY created_at DESC`
    )
      .bind(effectiveAgentId)
      .all();

    const updatedServers = updatedServersResult.results.map((row: any) => ({
      id: row.id,
      agent_id: row.agent_id,
      name: row.name,
      container_id: row.container_id,
      config: row.config,
      image_tag: row.image_tag,
      game_port: row.game_port,
      udp_port: row.udp_port,
      rcon_port: row.rcon_port,
      status: row.status,
      data_exists: row.data_exists === 1,
      deleted_at: row.deleted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return {
      success: true,
      servers: updatedServers,
      synced: syncedCount,
    };
  }

  /**
   * Trigger server status sync
   * Called on agent connection to sync server statuses with actual container/data state
   */
  private async triggerServerSync(): Promise<void> {
    if (!this.agentId) {
      console.error("[AgentConnection] Cannot trigger sync: no agent ID");
      return;
    }

    try {
      console.log(`[AgentConnection] Triggering server status sync for agent ${this.agentId}`);
      const result = await this.syncServers();
      console.log(`[AgentConnection] Sync completed: ${result.synced || 0} servers updated`);
    } catch (error) {
      console.error("[AgentConnection] Error triggering sync:", error);
      // Don't throw - sync failure shouldn't prevent agent connection
    }
  }
}
