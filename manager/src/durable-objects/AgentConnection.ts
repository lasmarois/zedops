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
  AgentLogLine,
  AgentLogSubscriber,
} from "../types/LogMessage";
import { logRconCommand } from "../lib/audit";

export class AgentConnection extends DurableObject {
  private ws: WebSocket | null = null;
  private agentId: string | null = null;
  private agentName: string | null = null;
  private isRegistered: boolean = false;
  private clientIp: string | null = null; // Agent's public IP from CF-Connecting-IP
  private pendingReplies: Map<string, (msg: Message) => void> = new Map();

  // Log streaming pub/sub (container logs)
  private logSubscribers: Map<string, LogSubscriber> = new Map(); // subscriberId -> LogSubscriber
  private logBuffers: Map<string, CircularBuffer<LogLine>> = new Map(); // containerId -> buffer

  // Agent log streaming pub/sub (agent's own logs)
  private agentLogSubscribers: Map<string, AgentLogSubscriber> = new Map(); // subscriberId -> AgentLogSubscriber
  private agentLogBuffer: CircularBuffer<AgentLogLine> = new CircularBuffer<AgentLogLine>(1000);
  private isAgentLogStreaming: boolean = false; // Whether we've requested logs from agent

  // RCON session tracking
  private rconSessions: Map<string, { sessionId: string; serverId: string }> = new Map(); // sessionId -> { sessionId, serverId }

  // Player stats tracking (from agent RCON polling)
  private playerStats: Map<string, {
    serverId: string;
    serverName: string;
    playerCount: number;
    maxPlayers: number;
    players: string[];
    rconConnected: boolean; // P2: RCON health status
    lastUpdate: number;
  }> = new Map(); // serverId -> player stats

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

    // Player stats endpoint (all servers)
    if (url.pathname === "/players" && request.method === "GET") {
      return new Response(JSON.stringify({
        success: true,
        players: this.getPlayerStats(),
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Player stats endpoint (single server)
    if (url.pathname.startsWith("/players/") && request.method === "GET") {
      const serverId = url.pathname.split("/")[2];
      if (serverId) {
        const stats = this.getServerPlayerStats(serverId);
        return new Response(JSON.stringify({
          success: true,
          stats: stats,
        }), {
          headers: { "Content-Type": "application/json" },
        });
      }
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

    // Container metrics endpoint
    if (url.pathname.startsWith("/containers/") && url.pathname.endsWith("/metrics") && request.method === "GET") {
      const parts = url.pathname.split("/");
      const containerId = parts[2];

      if (containerId) {
        return this.handleContainerMetricsRequest(containerId);
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

    // Internal endpoint: Check data existence for a single server
    if (url.pathname === "/internal/check-data" && request.method === "POST") {
      return this.handleCheckDataRequest(request);
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

    // Server move data endpoint (M9.8.29: Data path migration)
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/move") && request.method === "POST") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      if (serverId) {
        return this.handleServerMoveDataRequest(request, serverId);
      }
    }

    // Server get data path endpoint (M9.8.36: Query actual container mounts)
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/datapath") && request.method === "GET") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      if (serverId) {
        return this.handleServerGetDataPathRequest(serverId);
      }
    }

    // Server storage endpoint (M9.8.38: Query volume sizes)
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/storage") && request.method === "POST") {
      const parts = url.pathname.split("/");
      const serverName = parts[2];
      if (serverName) {
        return this.handleServerStorageRequest(request, serverName);
      }
    }

    // Image defaults endpoint (inspect Docker image for ENV defaults)
    if (url.pathname === "/images/defaults" && request.method === "GET") {
      const imageTag = url.searchParams.get("tag");
      if (imageTag) {
        return this.handleImageInspectRequest(imageTag);
      } else {
        return new Response(JSON.stringify({ error: "Missing tag query parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
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

    // Capture client IP from Cloudflare headers
    this.clientIp = request.headers.get("CF-Connecting-IP") || null;

    console.log(`[AgentConnection] WebSocket connection established from IP: ${this.clientIp}`);

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

      case "agent.logs.line":
        await this.handleAgentLogLine(message);
        break;

      case "agent.logs.history":
        await this.handleAgentLogHistory(message);
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

      case "move.progress":
        // M9.8.31: Forward data move progress to all connected frontends
        await this.handleMoveProgress(message);
        break;

      case "players.update":
        // M9.8.41: Handle player stats update from agent
        this.handlePlayersUpdate(message);
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
        `INSERT INTO agents (id, name, token_hash, status, last_seen, created_at, metadata, public_ip)
         VALUES (?, ?, ?, 'online', ?, ?, ?, ?)`
      )
        .bind(agentId, agentName, tokenHash, now, now, JSON.stringify({}), this.clientIp)
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

      // Always subscribe to agent logs on connect to populate cache
      if (!this.isAgentLogStreaming) {
        console.log(`[AgentConnection] Subscribing to agent logs for caching`);
        await this.send(createMessage("agent.logs.subscribe", { tail: 1000 }));
        this.isAgentLogStreaming = true;
      }
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

      // Update status to online, last_seen, and public_ip
      const now = Math.floor(Date.now() / 1000);
      await this.env.DB.prepare(
        `UPDATE agents SET status = 'online', last_seen = ?, public_ip = ? WHERE id = ?`
      )
        .bind(now, this.clientIp, agentId)
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

      // Always subscribe to agent logs on connect to populate cache
      // This ensures we have logs cached even if no UI is viewing them
      if (!this.isAgentLogStreaming) {
        console.log(`[AgentConnection] Subscribing to agent logs for caching`);
        await this.send(createMessage("agent.logs.subscribe", { tail: 1000 }));
        this.isAgentLogStreaming = true;
      }
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
   * Handle players.update message from agent
   * Store player stats for serving via API
   */
  private handlePlayersUpdate(message: Message): void {
    const servers = message.data?.servers || [];

    // Update player stats for each server
    for (const stats of servers) {
      this.playerStats.set(stats.serverId, {
        serverId: stats.serverId,
        serverName: stats.serverName,
        playerCount: stats.playerCount || 0,
        maxPlayers: stats.maxPlayers || 32,
        players: stats.players || [],
        rconConnected: stats.rconConnected ?? false, // P2: RCON health status
        lastUpdate: stats.lastUpdate || Math.floor(Date.now() / 1000),
      });
    }

    // Broadcast to connected UI WebSockets
    const updateMessage = createMessage("players.update", { servers });
    for (const [ws] of this.uiWebSockets) {
      try {
        ws.send(JSON.stringify(updateMessage));
      } catch (err) {
        console.error("[AgentConnection] Failed to send player update to UI:", err);
      }
    }

    // Log summary
    const totalPlayers = servers.reduce((sum: number, s: any) => sum + (s.playerCount || 0), 0);
    console.log(`[AgentConnection] Player stats update: ${servers.length} servers, ${totalPlayers} total players`);
  }

  /**
   * Get current player stats for all servers
   * Used by API endpoints
   */
  public getPlayerStats(): Array<{
    serverId: string;
    serverName: string;
    playerCount: number;
    maxPlayers: number;
    players: string[];
    rconConnected: boolean;
    lastUpdate: number;
  }> {
    return Array.from(this.playerStats.values());
  }

  /**
   * Get player stats for a specific server
   */
  public getServerPlayerStats(serverId: string): {
    serverId: string;
    serverName: string;
    playerCount: number;
    maxPlayers: number;
    players: string[];
    rconConnected: boolean;
    lastUpdate: number;
  } | null {
    return this.playerStats.get(serverId) || null;
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

    // Reset agent log streaming state so we re-subscribe when agent reconnects
    this.isAgentLogStreaming = false;
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
   * Handle container metrics request
   */
  private async handleContainerMetricsRequest(
    containerId: string
  ): Promise<Response> {
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
      // Set timeout (10 seconds for metrics)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Metrics request timeout"));
      }, 10000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    // Send metrics request to agent with reply inbox
    this.send({
      subject: 'container.metrics',
      data: {
        containerId,
      },
      reply: inbox,
    });

    try {
      // Wait for reply
      const reply = await replyPromise;

      // Return metrics data
      return new Response(JSON.stringify(reply.data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to collect metrics",
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

        case "agent.logs.subscribe":
          await this.handleAgentLogSubscribe(subscriberId, ws, message);
          break;

        case "agent.logs.unsubscribe":
          await this.handleAgentLogUnsubscribe(subscriberId);
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
   * M9.8.33: Handle agent.logs.subscribe from UI client
   * Subscribe to agent's own logs (not container logs)
   */
  private async handleAgentLogSubscribe(
    subscriberId: string,
    ws: WebSocket,
    message: Message
  ): Promise<void> {
    console.log(`[AgentConnection] ========== handleAgentLogSubscribe START ==========`);
    console.log(`[AgentConnection] subscriberId: ${subscriberId}`);
    console.log(`[AgentConnection] this.ws: ${!!this.ws}`);
    console.log(`[AgentConnection] this.isRegistered: ${this.isRegistered}`);
    console.log(`[AgentConnection] this.agentId: ${this.agentId}`);
    console.log(`[AgentConnection] this.isAgentLogStreaming: ${this.isAgentLogStreaming}`);
    console.log(`[AgentConnection] agentLogSubscribers.size (before): ${this.agentLogSubscribers.size}`);

    try {
      const { tail = 500 } = (message.data || {}) as { tail?: number };

      // Add subscriber
      this.agentLogSubscribers.set(subscriberId, {
        id: subscriberId,
        ws,
      });

      console.log(`[AgentConnection] Subscriber ${subscriberId} subscribed to agent logs`);
      console.log(`[AgentConnection] agentLogSubscribers.size (after): ${this.agentLogSubscribers.size}`);

      // Check if agent is connected
      const agentWs = await this.getActiveWebSocket();
      console.log(`[AgentConnection] getActiveWebSocket returned: ${!!agentWs}`);
      const isAgentOnline = !!agentWs;

      // Send cached logs to new subscriber with online status
      const cachedLogs = this.agentLogBuffer.getAll();

      // Always send history (even if empty) with agent status
      ws.send(JSON.stringify(createMessage("agent.logs.history", {
        lines: cachedLogs,
        agentOnline: isAgentOnline,
        cachedCount: cachedLogs.length,
      })));

      if (cachedLogs.length > 0) {
        console.log(`[AgentConnection] Sent ${cachedLogs.length} cached agent logs to ${subscriberId} (agent ${isAgentOnline ? 'online' : 'offline'})`);
      }

      // Start streaming from agent if agent is online
      // Always send subscribe - agent handles duplicates gracefully
      console.log(`[AgentConnection] Checking if should start stream: size=${this.agentLogSubscribers.size}, isStreaming=${this.isAgentLogStreaming}, isOnline=${isAgentOnline}`);
      if (isAgentOnline) {
        console.log(`[AgentConnection] Agent online - sending agent.logs.subscribe to agent`);
        await this.send(createMessage("agent.logs.subscribe", {
          tail,
        }));
        this.isAgentLogStreaming = true;
        console.log(`[AgentConnection] agent.logs.subscribe sent`);
      } else {
        console.log(`[AgentConnection] Agent offline - not starting stream`);
      }

      // Send acknowledgment
      ws.send(JSON.stringify(createMessage("agent.logs.subscribed", {
        message: "Subscribed to agent logs",
      })));
    } catch (error) {
      console.error(`[AgentConnection] Error in handleAgentLogSubscribe:`, error);
      ws.send(JSON.stringify(createMessage("error", {
        message: error instanceof Error ? error.message : "Failed to subscribe to agent logs",
      })));
    }
  }

  /**
   * M9.8.33: Handle agent.logs.unsubscribe from UI client
   */
  private async handleAgentLogUnsubscribe(subscriberId: string): Promise<void> {
    const subscriber = this.agentLogSubscribers.get(subscriberId);
    if (!subscriber) {
      return; // Already unsubscribed
    }

    this.agentLogSubscribers.delete(subscriberId);
    console.log(`[AgentConnection] Subscriber ${subscriberId} unsubscribed from agent logs`);

    // Stop streaming if no more subscribers
    if (this.agentLogSubscribers.size === 0 && this.isAgentLogStreaming) {
      console.log(`[AgentConnection] Stopping agent log stream (no more subscribers)`);
      const agentWs = await this.getActiveWebSocket();
      if (agentWs) {
        await this.send(createMessage("agent.logs.unsubscribe", {}));
      }
      this.isAgentLogStreaming = false;
    }
  }

  /**
   * M9.8.33: Handle agent.logs.line from agent
   * Broadcast to all agent log subscribers and cache
   */
  private async handleAgentLogLine(message: Message): Promise<void> {
    const logLine = message.data as AgentLogLine;

    // Add to buffer
    this.agentLogBuffer.append(logLine);

    // Broadcast to all agent log subscribers
    if (this.agentLogSubscribers.size > 0) {
      const broadcastMessage = JSON.stringify(createMessage("agent.logs.line", logLine));
      for (const subscriber of this.agentLogSubscribers.values()) {
        try {
          subscriber.ws.send(broadcastMessage);
        } catch (error) {
          console.error(`[AgentConnection] Failed to send agent log to subscriber ${subscriber.id}:`, error);
          this.agentLogSubscribers.delete(subscriber.id);
        }
      }
    }
  }

  /**
   * M9.8.33: Handle agent.logs.history from agent
   * Forward to all agent log subscribers (initial history on subscribe)
   */
  private async handleAgentLogHistory(message: Message): Promise<void> {
    const { lines } = message.data as { lines: AgentLogLine[] };

    console.log(`[AgentConnection] Received ${lines?.length || 0} agent log history lines`);

    if (!lines || lines.length === 0) return;

    // Add to buffer
    for (const line of lines) {
      this.agentLogBuffer.append(line);
    }

    // Forward to all subscribers
    if (this.agentLogSubscribers.size > 0) {
      const historyMessage = JSON.stringify(createMessage("agent.logs.history", { lines }));
      for (const subscriber of this.agentLogSubscribers.values()) {
        try {
          subscriber.ws.send(historyMessage);
        } catch (error) {
          console.error(`[AgentConnection] Failed to send agent log history to subscriber ${subscriber.id}:`, error);
          this.agentLogSubscribers.delete(subscriber.id);
        }
      }
    }
  }

  /**
   * M9.8.31: Handle move.progress from agent
   * Broadcast to all connected frontends (they filter by serverName)
   */
  private async handleMoveProgress(message: Message): Promise<void> {
    const progress = message.data as {
      serverName: string;
      phase: string;
      percent: number;
      bytesTotal: number;
      bytesCopied: number;
      filesTotal: number;
      filesCopied: number;
      currentFile?: string;
      error?: string;
    };

    console.log(`[AgentConnection] Move progress: ${progress.serverName} - ${progress.phase} ${progress.percent}%`);

    // Broadcast to ALL connected frontends (they filter by serverName)
    const broadcastMessage = JSON.stringify(createMessage("move.progress", progress));

    for (const subscriber of this.logSubscribers.values()) {
      try {
        subscriber.ws.send(broadcastMessage);
      } catch (error) {
        console.error(`[AgentConnection] Failed to send move progress to subscriber ${subscriber.id}:`, error);
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

    const { containerId, serverName, removeVolumes, dataPath } = body;
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

    // dataPath is required for proper cleanup
    if (!dataPath) {
      return new Response(JSON.stringify({
        error: "Missing dataPath - required for data directory operations",
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
        dataPath: dataPath,
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

    const { containerId, name, registry, imageTag, config, gamePort, udpPort, rconPort, dataPath } = body;
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
    // Include full config if provided (for config updates), otherwise just containerId (simple rebuild)
    const rebuildData: any = { containerId };
    if (name && registry && imageTag && config) {
      rebuildData.name = name;
      rebuildData.registry = registry;
      rebuildData.imageTag = imageTag;
      rebuildData.config = config;
      rebuildData.gamePort = gamePort;
      rebuildData.udpPort = udpPort;
      rebuildData.rconPort = rconPort;
      rebuildData.dataPath = dataPath;
    }

    this.send({
      subject: "server.rebuild",
      data: rebuildData,
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
   * M9.8.29: HTTP handler for server data move request
   * Moves server data from old path to new path before rebuild
   */
  private async handleServerMoveDataRequest(request: Request, serverId: string): Promise<Response> {
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

    const { serverName, oldPath, newPath } = body;
    if (!serverName || !oldPath || !newPath) {
      return new Response(JSON.stringify({
        error: "Missing required fields: serverName, oldPath, newPath",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[AgentConnection] Moving server data: ${serverName} from ${oldPath} to ${newPath}`);

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<Message>((resolve, reject) => {
      // Set timeout (5 minutes for large data moves)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server data move timeout - operation took longer than 5 minutes"));
      }, 300000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    // Send server.movedata request to agent
    this.send({
      subject: "server.movedata",
      data: {
        serverName,
        oldPath,
        newPath,
      },
      reply: inbox,
    });

    try {
      // Wait for reply
      const reply = await replyPromise;

      // Check if operation succeeded
      const success = reply.data.success !== false;

      if (success) {
        console.log(`[AgentConnection] Server data move completed: ${serverName}`);
      } else {
        console.error(`[AgentConnection] Server data move failed: ${reply.data.error}`);
      }

      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(`[AgentConnection] Server data move error:`, error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Server data move failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * M9.8.36: HTTP handler for getting server data path from container mounts
   * Inspects the container to determine actual bind mount paths
   * This is used when DB config might be stale (e.g., agent path changed after server creation)
   */
  private async handleServerGetDataPathRequest(serverId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({
        error: "Agent not connected",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get container ID from DB for this server
    const server = await this.env.DB.prepare(
      "SELECT container_id FROM servers WHERE id = ?"
    ).bind(serverId).first();

    if (!server || !server.container_id) {
      return new Response(JSON.stringify({
        error: "Server not found or has no container",
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const containerId = server.container_id as string;
    console.log(`[AgentConnection] Getting data path from container: ${containerId}`);

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<Message>((resolve, reject) => {
      // Set timeout (30 seconds should be plenty for container inspect)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Get data path timeout"));
      }, 30000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    // Send server.getdatapath request to agent
    this.send({
      subject: "server.getdatapath",
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

      if (success) {
        console.log(`[AgentConnection] Got data path: ${reply.data.dataPath}`);
      } else {
        console.error(`[AgentConnection] Get data path failed: ${reply.data.error}`);
      }

      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(`[AgentConnection] Get data path error:`, error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Get data path failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * Handle server storage request (M9.8.38: Volume sizes)
   * Returns bin/ and data/ directory sizes for a server
   */
  private async handleServerStorageRequest(request: Request, serverName: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({
        error: "Agent not connected",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body to get dataPath
    let dataPath: string;
    try {
      const body = await request.json() as { dataPath?: string };
      if (!body.dataPath) {
        return new Response(JSON.stringify({
          error: "Missing dataPath in request body",
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      dataPath = body.dataPath;
    } catch (e) {
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[AgentConnection] Getting storage for server: ${serverName} (dataPath: ${dataPath})`);

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<Message>((resolve, reject) => {
      // Set timeout (30 seconds - disk scan can take time for large directories)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Get storage timeout"));
      }, 30000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        this.pendingReplies.delete(inbox);
        resolve(msg);
      });
    });

    // Send volume sizes request to agent
    this.send(
      createMessage("server.volumesizes", {
        serverName: serverName,
        dataPath: dataPath,
      }, inbox)
    );

    try {
      // Wait for reply
      const reply = await replyPromise;

      // Check if operation succeeded
      const success = reply.data.success !== false;

      if (success) {
        console.log(`[AgentConnection] Storage for ${serverName}: bin=${reply.data.sizes?.binBytes}, data=${reply.data.sizes?.dataBytes}, total=${reply.data.sizes?.totalBytes}`);
      } else {
        console.error(`[AgentConnection] Get storage failed: ${reply.data.error}`);
      }

      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(`[AgentConnection] Get storage error:`, error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Get storage failed",
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
   * Handle check data request for a single server (used by restore endpoint)
   */
  private async handleCheckDataRequest(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { serverName, dataPath } = body;

      if (!serverName || !dataPath) {
        return new Response(JSON.stringify({
          error: "Missing serverName or dataPath",
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if agent is connected
      if (!this.ws) {
        return new Response(JSON.stringify({
          dataExists: false,
          error: "Agent offline",
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Call agent to check data existence
      const checkResponse = await this.sendMessageWithReply({
        subject: 'server.checkdata',
        data: {
          servers: [serverName],
          dataPath: dataPath,
        },
      }, 10000);

      const status = checkResponse.data.statuses?.[0];
      const dataExists = status?.dataExists || false;

      console.log(`[CheckData] Server ${serverName}: data_exists=${dataExists} (path: ${dataPath})`);

      return new Response(JSON.stringify({
        dataExists,
        serverName,
        dataPath,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[AgentConnection] Check data error:", error);
      return new Response(JSON.stringify({
        dataExists: false,
        error: error instanceof Error ? error.message : "Data check failed",
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

    // Query agent config to get default data path
    const agentResult = await this.env.DB.prepare(
      `SELECT server_data_path FROM agents WHERE id = ?`
    )
      .bind(effectiveAgentId)
      .first();

    const agentDefaultPath = agentResult?.server_data_path || '/var/lib/zedops/servers';
    console.log(`[Sync] Agent default data path: ${agentDefaultPath}`);

    // Query agent for container list
    const containersResponse = await this.sendMessageWithReply({
      subject: 'container.list',  // Note: singular "container" not "containers"
      data: {},
    }, 10000);

    const containers = containersResponse.data.containers || [];
    console.log(`[Sync] Found ${containers.length} containers on agent`);

    // Group servers by data path (server custom path || agent default path)
    // This allows us to batch checkdata calls by unique paths
    const serversByPath = new Map<string, any[]>();
    for (const server of servers) {
      const effectivePath = server.server_data_path || agentDefaultPath;
      if (!serversByPath.has(effectivePath)) {
        serversByPath.set(effectivePath, []);
      }
      serversByPath.get(effectivePath)!.push(server);
    }

    console.log(`[Sync] Grouped ${servers.length} servers into ${serversByPath.size} unique data path(s)`);

    // Check data existence for each unique path
    const dataByName = new Map();
    for (const [dataPath, pathServers] of serversByPath) {
      const serverNames = pathServers.map((s: any) => s.name);
      console.log(`[Sync] Checking ${serverNames.length} servers at path: ${dataPath}`);

      const dataCheckResponse = await this.sendMessageWithReply({
        subject: 'server.checkdata',
        data: {
          servers: serverNames,
          dataPath: dataPath,
        },
      }, 10000);

      const statuses = dataCheckResponse.data.statuses || [];
      for (const status of statuses) {
        dataByName.set(status.serverName, status);
      }
    }

    console.log(`[Sync] Checked data existence for ${dataByName.size} servers`);

    // Build container lookup map
    const containerByName = new Map();
    for (const container of containers) {
      const labels = container.labels || {};
      const serverName = labels['zedops.server.name'];
      if (serverName) {
        containerByName.set(serverName, container);
      }
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

  /**
   * Handle image inspect request - Query Docker image for default ENV variables
   * Implements request/reply pattern with agent
   */
  private async handleImageInspectRequest(imageTag: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({
        error: "Agent not registered",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique inbox for reply
    const inbox = `_INBOX.${crypto.randomUUID()}`;

    // Create promise to wait for reply
    const replyPromise = new Promise<any>((resolve, reject) => {
      // Set timeout (10 seconds)
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Image inspect timeout"));
      }, 10000);

      // Store reply handler
      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        this.pendingReplies.delete(inbox);
        resolve(msg.data);
      });
    });

    // Send request to agent
    this.send({
      subject: "images.inspect",
      data: { imageTag },
      reply: inbox,
    });

    console.log(`[AgentConnection] Sent images.inspect request to agent ${this.agentId} for image: ${imageTag}`);

    // Wait for reply
    try {
      const response = await replyPromise;

      if (!response.success) {
        return new Response(JSON.stringify({
          error: response.error || "Failed to inspect image",
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        defaults: response.defaults || {},
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(`[AgentConnection] Error waiting for image inspect response:`, error);
      return new Response(JSON.stringify({
        error: "Timeout waiting for agent response",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
