/**
 * AgentConnection Durable Object
 *
 * Manages persistent WebSocket connection for a single agent.
 * Each agent gets its own Durable Object instance identified by agent ID.
 *
 * Uses the Hibernatable WebSocket API (ctx.acceptWebSocket) to minimize
 * DO duration — the DO sleeps between messages instead of staying awake 24/7.
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
  CircularBuffer,
  AgentLogLine,
} from "../types/LogMessage";
import { logRconCommand } from "../lib/audit";
import { getAlertRecipientsForAgent } from "../lib/permissions";
import { sendEmail, buildAgentOfflineEmailHtml, buildAgentRecoveredEmailHtml } from "../lib/email";

export class AgentConnection extends DurableObject {
  // Core agent state (restored from storage after hibernation)
  private agentId: string | null = null;
  private agentName: string | null = null;
  private isRegistered: boolean = false;
  private clientIp: string | null = null;
  private stateRestored: boolean = false;

  // In-memory ephemeral state (lost on hibernation — acceptable)
  private pendingReplies: Map<string, (msg: Message) => void> = new Map();
  private logBuffers: Map<string, CircularBuffer<LogLine>> = new Map();
  private agentLogBuffer: CircularBuffer<AgentLogLine> = new CircularBuffer<AgentLogLine>(1000);
  private isAgentLogStreaming: boolean = false;
  private rconSessions: Map<string, { sessionId: string; serverId: string }> = new Map();
  private playerStats: Map<string, {
    serverId: string;
    serverName: string;
    playerCount: number;
    maxPlayers: number;
    players: string[];
    rconConnected: boolean;
    lastUpdate: number;
  }> = new Map();

  // In-memory cache for subscription lookups (invalidated on subscribe/unsubscribe)
  private containerSubCache: Map<string, string> | null = null; // subscriberId -> containerId
  private agentSubCache: Set<string> | null = null; // subscriberIds

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  // ─── State Recovery ───────────────────────────────────────────────

  /**
   * Restore agent state from storage after hibernation wake-up.
   * Called lazily on first message/request after wake.
   */
  private async restoreState(): Promise<void> {
    if (this.stateRestored) return;
    this.stateRestored = true;

    const [agentId, agentName, clientIp, isStreaming] = await Promise.all([
      this.ctx.storage.get<string>('agentId'),
      this.ctx.storage.get<string>('agentName'),
      this.ctx.storage.get<string>('clientIp'),
      this.ctx.storage.get<boolean>('isAgentLogStreaming'),
    ]);

    if (agentId && agentName) {
      this.agentId = agentId;
      this.agentName = agentName;
      this.isRegistered = true;
    }
    if (clientIp) this.clientIp = clientIp;
    if (isStreaming) this.isAgentLogStreaming = isStreaming;

    console.log(`[AgentConnection] State restored: agentId=${agentId}, agentName=${agentName}, isStreaming=${isStreaming}`);
  }

  /**
   * Get the agent's WebSocket using hibernation-aware tag lookup.
   */
  private getAgentWebSocket(): WebSocket | null {
    const sockets = this.ctx.getWebSockets("agent");
    return sockets.length > 0 ? sockets[0] : null;
  }

  /**
   * Get container log subscription map from storage (with in-memory cache).
   * Returns Map<subscriberId, containerId>
   */
  private async getContainerSubscriptions(): Promise<Map<string, string>> {
    if (this.containerSubCache) return this.containerSubCache;

    const entries = await this.ctx.storage.list<string>({ prefix: 'sub:' });
    const map = new Map<string, string>();
    for (const [key, containerId] of entries) {
      const subscriberId = key.slice(4); // Remove 'sub:' prefix
      map.set(subscriberId, containerId);
    }
    this.containerSubCache = map;
    return map;
  }

  /**
   * Get agent log subscription set from storage (with in-memory cache).
   * Returns Set<subscriberId>
   */
  private async getAgentLogSubscriptions(): Promise<Set<string>> {
    if (this.agentSubCache) return this.agentSubCache;

    const entries = await this.ctx.storage.list({ prefix: 'agentsub:' });
    const set = new Set<string>();
    for (const key of entries.keys()) {
      set.add(key.slice(9)); // Remove 'agentsub:' prefix
    }
    this.agentSubCache = set;
    return set;
  }

  /**
   * Extract subscriberId from WebSocket tags.
   * Tags: ["ui", "sub:<id>", "user:<userId>"]
   */
  private getSubscriberId(ws: WebSocket): string | null {
    const tags = this.ctx.getTags(ws);
    for (const tag of tags) {
      if (tag.startsWith("sub:")) return tag.slice(4);
    }
    return null;
  }

  /**
   * Extract userId from WebSocket tags.
   */
  private getUserId(ws: WebSocket): string | null {
    const tags = this.ctx.getTags(ws);
    for (const tag of tags) {
      if (tag.startsWith("user:")) return tag.slice(5);
    }
    return null;
  }

  // ─── Hibernation Handlers ─────────────────────────────────────────

  /**
   * Class-level WebSocket message handler (Hibernatable API).
   * Routes to agent or UI handler based on tags.
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.restoreState();

    const tags = this.ctx.getTags(ws);

    if (tags.includes("agent")) {
      await this.handleAgentMessage(ws, message);
    } else if (tags.includes("ui")) {
      const subscriberId = this.getSubscriberId(ws);
      if (subscriberId) {
        await this.handleUIMessageFromHibernation(subscriberId, ws, message);
      } else {
        console.error("[AgentConnection] UI WebSocket missing subscriber tag");
      }
    } else {
      console.warn("[AgentConnection] WebSocket message from unknown type, tags:", tags);
    }
  }

  /**
   * Class-level WebSocket close handler (Hibernatable API).
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    await this.restoreState();

    const tags = this.ctx.getTags(ws);

    if (tags.includes("agent")) {
      await this.handleAgentClose(code, reason);
    } else if (tags.includes("ui")) {
      const subscriberId = this.getSubscriberId(ws);
      if (subscriberId) {
        await this.handleUIClose(subscriberId);
      }
    }
  }

  /**
   * Class-level WebSocket error handler (Hibernatable API).
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    await this.restoreState();

    const tags = this.ctx.getTags(ws);

    if (tags.includes("agent")) {
      console.error("[AgentConnection] Agent WebSocket error:", error);
      await this.handleAgentClose(1006, "WebSocket error");
    } else if (tags.includes("ui")) {
      const subscriberId = this.getSubscriberId(ws);
      console.error(`[AgentConnection] UI WebSocket error (${subscriberId}):`, error);
      if (subscriberId) {
        await this.handleUIClose(subscriberId);
      }
    }
  }

  // ─── HTTP Fetch Handler ───────────────────────────────────────────

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
    if (url.pathname === "/logs/ws" || url.pathname.endsWith("/logs/ws")) {
      return this.handleUIWebSocketUpgrade(request);
    }

    // Restore state for all non-WebSocket endpoints
    await this.restoreState();

    // Status endpoint (for debugging)
    if (url.pathname === "/status") {
      const agentSockets = this.ctx.getWebSockets("agent");
      const uiSockets = this.ctx.getWebSockets("ui");
      return new Response(JSON.stringify({
        connected: agentSockets.length > 0,
        agentId: this.agentId,
        isRegistered: this.isRegistered,
        agentWebSockets: agentSockets.length,
        uiWebSockets: uiSockets.length,
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

    // Registry tags endpoint
    if (url.pathname === "/registry/tags" && request.method === "GET") {
      return this.handleRegistryTagsRequest(request);
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
      const operation = parts[3];

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

    // Notify agent of available update
    if (url.pathname === "/notify-update" && request.method === "POST") {
      return this.handleNotifyUpdate(request);
    }

    // Container inspect endpoint (for adopt flow)
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/inspect") && request.method === "GET") {
      const parts = url.pathname.split("/");
      // /servers/{containerId}/inspect
      const containerId = parts[2];
      if (containerId) {
        return this.handleServerInspectRequest(containerId);
      }
    }

    // Server adopt endpoint
    if (url.pathname === "/servers/adopt" && request.method === "POST") {
      return this.handleServerAdoptRequest(request);
    }

    // Server create endpoint
    if (url.pathname === "/servers" && request.method === "POST") {
      return this.handleServerCreateRequest(request);
    }

    // Server sync endpoint
    if (url.pathname === "/servers/sync" && request.method === "POST") {
      return this.handleServerSyncRequest(request);
    }

    // Internal endpoint: Check data existence
    if (url.pathname === "/check-data" && request.method === "POST") {
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

    // Server move data endpoint
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/move") && request.method === "POST") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      if (serverId) {
        return this.handleServerMoveDataRequest(request, serverId);
      }
    }

    // Server get data path endpoint
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/datapath") && request.method === "GET") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      if (serverId) {
        return this.handleServerGetDataPathRequest(serverId);
      }
    }

    // Server storage endpoint
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/storage") && request.method === "POST") {
      const parts = url.pathname.split("/");
      const serverName = parts[2];
      if (serverName) {
        return this.handleServerStorageRequest(request, serverName);
      }
    }

    // Image defaults endpoint
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

    // P4: One-shot RCON command endpoint
    if (url.pathname === "/rcon/command" && request.method === "POST") {
      return this.handleOneShotRconCommand(request);
    }

    // M12: Backup create endpoint
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/backup") && request.method === "POST") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      if (serverId) {
        return this.handleBackupCreateRequest(request, serverId);
      }
    }

    // M12: Backup sync endpoint
    if (url.pathname.startsWith("/servers/") && url.pathname.endsWith("/backups/sync") && request.method === "POST") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      if (serverId) {
        return this.handleBackupSyncRequest(request, serverId);
      }
    }

    // M12: Backup delete endpoint
    if (url.pathname.match(/^\/servers\/[^/]+\/backups\/[^/]+$/) && request.method === "DELETE") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      const filename = parts[4];
      if (serverId && filename) {
        return this.handleBackupDeleteRequest(request, serverId, filename);
      }
    }

    // M12: Backup restore endpoint
    if (url.pathname.match(/^\/servers\/[^/]+\/backups\/[^/]+\/restore$/) && request.method === "POST") {
      const parts = url.pathname.split("/");
      const serverId = parts[2];
      const filename = parts[4];
      if (serverId && filename) {
        return this.handleBackupRestoreRequest(request, serverId, filename);
      }
    }

    // Force disconnect agent (called during agent removal)
    if (url.pathname === "/force-disconnect" && request.method === "POST") {
      const agentSocket = this.getAgentWebSocket();
      if (agentSocket) {
        try {
          agentSocket.close(1000, "Agent removed by admin");
        } catch (e) {
          console.error("[AgentConnection] Error closing agent socket:", e);
        }
      }

      // Close all UI WebSockets too
      const uiSockets = this.ctx.getWebSockets("ui");
      for (const ws of uiSockets) {
        try {
          ws.close(1000, "Agent removed");
        } catch (e) {
          // Ignore close errors
        }
      }

      // Clear all persistent storage
      await this.ctx.storage.deleteAll();

      this.agentId = null;
      this.agentName = null;
      this.isRegistered = false;
      this.clientIp = null;
      this.isAgentLogStreaming = false;
      this.containerSubCache = null;
      this.agentSubCache = null;

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  // ─── WebSocket Upgrade Handlers ───────────────────────────────────

  /**
   * Upgrade HTTP request to agent WebSocket connection (Hibernatable API).
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept with hibernation support — tag as "agent"
    this.ctx.acceptWebSocket(server, ["agent"]);

    // Capture client IP from Cloudflare headers
    this.clientIp = request.headers.get("CF-Connecting-IP") || null;
    // Persist clientIp for hibernation recovery
    if (this.clientIp) {
      await this.ctx.storage.put('clientIp', this.clientIp);
    }

    console.log(`[AgentConnection] Agent WebSocket connection established from IP: ${this.clientIp}`);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Upgrade HTTP request to UI WebSocket connection (Hibernatable API).
   */
  private async handleUIWebSocketUpgrade(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    // Extract user ID from header (set by Worker after JWT validation)
    const userId = request.headers.get("X-User-Id") || undefined;

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Generate unique subscriber ID
    const subscriberId = crypto.randomUUID();

    // Build tags: ["ui", "sub:<id>", optional "user:<userId>"]
    const tags: string[] = ["ui", `sub:${subscriberId}`];
    if (userId) {
      tags.push(`user:${userId}`);
    }

    // Accept with hibernation support
    this.ctx.acceptWebSocket(server, tags);

    console.log(`[AgentConnection] UI subscriber connected: ${subscriberId}${userId ? ` (user: ${userId})` : ''}`);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // ─── Agent Message Handling ───────────────────────────────────────

  /**
   * Handle incoming agent WebSocket messages (from hibernation handler).
   */
  private async handleAgentMessage(ws: WebSocket, rawData: string | ArrayBuffer): Promise<void> {
    try {
      const data = typeof rawData === 'string' ? rawData : new TextDecoder().decode(rawData);
      const message = parseMessage(data);
      const validation = validateMessage(message);

      if (!validation.valid) {
        console.error(`[AgentConnection] Invalid message: ${validation.error}`);
        this.sendError(validation.error || "Invalid message");
        return;
      }

      console.log(`[AgentConnection] Received: ${message.subject}`, message.data);

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
        this.send(createMessage("test.echo", message.data));
        break;

      case "move.progress":
        await this.handleMoveProgress(message);
        break;

      case "backup.progress":
        await this.handleBackupProgress(message);
        break;

      case "adopt.progress":
        await this.handleAdoptProgress(message);
        break;

      case "players.update":
        this.handlePlayersUpdate(message);
        break;

      case "server.metrics.batch":
        await this.handleMetricsBatch(message);
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
   * Handle agent close — update DB status, clear storage
   */
  private async handleAgentClose(code: number, reason: string): Promise<void> {
    console.log(`[AgentConnection] Agent WebSocket closed: code=${code}, reason=${reason}`);

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

      // Set DO alarm for offline alert (5 minutes)
      // If agent reconnects before alarm fires, it will be cancelled in handleAgentAuth
      try {
        await this.ctx.storage.put('disconnectedAgentId', this.agentId);
        await this.ctx.storage.put('disconnectedAgentName', this.agentName);
        await this.ctx.storage.put('disconnectedAt', Date.now());
        await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000);
        console.log(`[AgentConnection] Offline alert alarm set for 5 minutes (agent: ${this.agentName})`);
      } catch (error) {
        console.error("[AgentConnection] Failed to set offline alert alarm:", error);
      }
    }

    // Clear persistent state
    await this.ctx.storage.delete('agentId');
    await this.ctx.storage.delete('agentName');
    await this.ctx.storage.delete('clientIp');
    await this.ctx.storage.delete('isAgentLogStreaming');

    this.agentId = null;
    this.agentName = null;
    this.isRegistered = false;
    this.clientIp = null;
    this.isAgentLogStreaming = false;
  }

  /**
   * Handle UI WebSocket close — clean up subscriptions from storage
   */
  private async handleUIClose(subscriberId: string): Promise<void> {
    console.log(`[AgentConnection] UI subscriber disconnected: ${subscriberId}`);

    // Clean up container log subscription
    const containerId = await this.ctx.storage.get<string>(`sub:${subscriberId}`);
    if (containerId) {
      await this.ctx.storage.delete(`sub:${subscriberId}`);
      this.containerSubCache = null; // Invalidate cache

      // Check if there are remaining subscribers for this container
      const subs = await this.getContainerSubscriptions();
      const remaining = Array.from(subs.values()).filter(cid => cid === containerId);
      if (remaining.length === 0) {
        // No more subscribers, stop streaming from agent
        console.log(`[AgentConnection] Stopping log stream for container ${containerId} on agent`);
        this.send(createMessage("log.stream.stop", { containerId }));
      }
    }

    // Clean up agent log subscription
    const isAgentSub = await this.ctx.storage.get(`agentsub:${subscriberId}`);
    if (isAgentSub) {
      await this.ctx.storage.delete(`agentsub:${subscriberId}`);
      this.agentSubCache = null; // Invalidate cache

      // Check if there are remaining agent log subscribers
      const agentSubs = await this.getAgentLogSubscriptions();
      if (agentSubs.size === 0 && this.isAgentLogStreaming) {
        console.log(`[AgentConnection] Stopping agent log stream (no more subscribers)`);
        const agentWs = this.getAgentWebSocket();
        if (agentWs) {
          await this.send(createMessage("agent.logs.unsubscribe", {}));
        }
        this.isAgentLogStreaming = false;
        await this.ctx.storage.put('isAgentLogStreaming', false);
      }
    }
  }

  // ─── UI Message Handling ──────────────────────────────────────────

  /**
   * Handle messages from UI clients (from hibernation handler).
   */
  private async handleUIMessageFromHibernation(
    subscriberId: string,
    ws: WebSocket,
    rawData: string | ArrayBuffer
  ): Promise<void> {
    try {
      const data = typeof rawData === 'string' ? rawData : new TextDecoder().decode(rawData);
      const message = parseMessage(data);
      const validation = validateMessage(message);

      if (!validation.valid) {
        ws.send(JSON.stringify(createMessage("error", { message: validation.error })));
        return;
      }

      console.log(`[AgentConnection] UI message from ${subscriberId}: ${message.subject}`);

      switch (message.subject) {
        case "log.subscribe":
          await this.handleLogSubscribe(subscriberId, ws, message);
          break;

        case "log.unsubscribe":
          await this.handleLogUnsubscribe(subscriberId, ws);
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

  // ─── Agent Registration & Auth ────────────────────────────────────

  /**
   * Handle agent.register message — token-based registration flow
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

      if (payload.type !== 'ephemeral') {
        this.sendError("Registration requires ephemeral token");
        return;
      }

      if (payload.agentName !== agentName) {
        this.sendError("Agent name does not match token");
        return;
      }

      const agentId = (payload.agentId as string) || crypto.randomUUID();

      // Generate permanent token
      const permanentToken = await generatePermanentToken(
        agentId,
        agentName,
        this.env.TOKEN_SECRET
      );

      const tokenHash = await hashToken(permanentToken);

      const now = Math.floor(Date.now() / 1000);
      const existingAgent = await this.env.DB.prepare(
        'SELECT id, status FROM agents WHERE id = ?'
      ).bind(agentId).first();

      if (existingAgent && existingAgent.status === 'pending') {
        await this.env.DB.prepare(
          `UPDATE agents SET token_hash = ?, status = 'online', last_seen = ?, public_ip = ? WHERE id = ?`
        ).bind(tokenHash, now, this.clientIp, agentId).run();
        console.log(`[AgentConnection] Pending agent activated: ${agentName} (${agentId})`);
      } else if (!existingAgent) {
        await this.env.DB.prepare(
          `INSERT INTO agents (id, name, token_hash, status, last_seen, created_at, metadata, public_ip)
           VALUES (?, ?, ?, 'online', ?, ?, ?, ?)`
        ).bind(agentId, agentName, tokenHash, now, now, JSON.stringify({}), this.clientIp).run();
        console.log(`[AgentConnection] New agent registered: ${agentName} (${agentId})`);
      } else {
        this.sendError("Agent already registered. Use permanent token to reconnect.");
        return;
      }

      // Mark as registered
      this.agentId = agentId;
      this.agentName = agentName;
      this.isRegistered = true;

      // Persist to storage for hibernation recovery
      await this.ctx.storage.put('agentId', agentId);
      await this.ctx.storage.put('agentName', agentName);

      console.log(`[AgentConnection] Agent registered: ${agentName} (${agentId})`);

      await this.send(createMessage("agent.register.success", {
        agentId,
        token: permanentToken,
        message: "Registration successful",
      }));

      // Trigger initial server status sync in background
      this.ctx.waitUntil(this.triggerServerSync());

      // Subscribe to agent logs for caching
      if (!this.isAgentLogStreaming) {
        console.log(`[AgentConnection] Subscribing to agent logs for caching`);
        await this.send(createMessage("agent.logs.subscribe", { tail: 1000 }));
        this.isAgentLogStreaming = true;
        await this.ctx.storage.put('isAgentLogStreaming', true);
      }
    } catch (error) {
      console.error("[AgentConnection] Registration error:", error);
      this.sendError("Registration failed");
    }
  }

  /**
   * Handle agent.auth message — authenticate with permanent token
   */
  private async handleAgentAuth(message: Message): Promise<void> {
    try {
      const { token } = message.data;

      if (!token || typeof token !== 'string') {
        this.sendError("Authentication requires 'token' field");
        return;
      }

      let payload;
      try {
        payload = await verifyToken(token, this.env.TOKEN_SECRET);
      } catch (error) {
        console.error("[AgentConnection] Token verification failed:", error);
        this.sendError("Invalid or expired token");
        return;
      }

      if (payload.type !== 'permanent') {
        this.sendError("Authentication requires permanent token");
        return;
      }

      const agentId = payload.agentId as string;
      const agentName = payload.agentName as string;

      if (!agentId || !agentName) {
        this.sendError("Invalid token payload");
        return;
      }

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

      // Cancel any pending offline alert alarm (agent reconnected in time)
      const disconnectedAt = await this.ctx.storage.get<number>('disconnectedAt');
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.delete('disconnectedAgentId');
      await this.ctx.storage.delete('disconnectedAgentName');
      await this.ctx.storage.delete('disconnectedAt');

      // If there was a disconnect and an alert was already sent, send recovery email
      const alertSentAt = await this.ctx.storage.get<number>('alertSentAt');
      if (alertSentAt && disconnectedAt && this.env.RESEND_API_KEY) {
        const downtimeMs = Date.now() - disconnectedAt;
        const downtimeMinutes = Math.round(downtimeMs / 60000);
        const recipients = await getAlertRecipientsForAgent(this.env.DB, agentId);
        this.ctx.waitUntil(this.sendRecoveryEmails(agentName, downtimeMinutes, recipients));
        await this.ctx.storage.delete('alertSentAt');
      }

      // Persist to storage for hibernation recovery
      await this.ctx.storage.put('agentId', agentId);
      await this.ctx.storage.put('agentName', agentName);

      // Update status to online
      const now = Math.floor(Date.now() / 1000);
      await this.env.DB.prepare(
        `UPDATE agents SET status = 'online', last_seen = ?, public_ip = ? WHERE id = ?`
      )
        .bind(now, this.clientIp, agentId)
        .run();

      console.log(`[AgentConnection] Agent authenticated: ${agentName} (${agentId})`);

      // Gather alert config for the agent (email recipients + API key)
      const alertRecipients = await getAlertRecipientsForAgent(this.env.DB, agentId);
      const resendApiKey = this.env.RESEND_API_KEY || null;
      const resendFromEmail = this.env.RESEND_FROM_EMAIL
        ? `ZedOps Alerts <${this.env.RESEND_FROM_EMAIL}>`
        : null;

      this.send(createMessage("agent.auth.success", {
        agentId,
        agentName,
        message: "Authentication successful",
        alertRecipients,
        resendApiKey,
        resendFromEmail,
      }));

      // Trigger initial server status sync in background
      this.ctx.waitUntil(this.triggerServerSync());

      // Subscribe to agent logs for caching
      if (!this.isAgentLogStreaming) {
        console.log(`[AgentConnection] Subscribing to agent logs for caching`);
        await this.send(createMessage("agent.logs.subscribe", { tail: 1000 }));
        this.isAgentLogStreaming = true;
        await this.ctx.storage.put('isAgentLogStreaming', true);
      }
    } catch (error) {
      console.error("[AgentConnection] Authentication error:", error);
      this.sendError("Authentication failed");
    }
  }

  // ─── Agent Heartbeat ──────────────────────────────────────────────

  private async handleAgentHeartbeat(message: Message): Promise<void> {
    if (!this.isRegistered || !this.agentId) {
      this.sendError("Agent must be registered to send heartbeat");
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const metrics = message.data.metrics || null;

    try {
      if (metrics) {
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

    this.send(createMessage("agent.heartbeat.ack", {
      timestamp: Date.now(),
    }));
  }

  // ─── Player Stats ─────────────────────────────────────────────────

  private handlePlayersUpdate(message: Message): void {
    const servers = message.data?.servers || [];

    for (const stats of servers) {
      this.playerStats.set(stats.serverId, {
        serverId: stats.serverId,
        serverName: stats.serverName,
        playerCount: stats.playerCount || 0,
        maxPlayers: stats.maxPlayers || 32,
        players: stats.players || [],
        rconConnected: stats.rconConnected ?? false,
        lastUpdate: stats.lastUpdate || Math.floor(Date.now() / 1000),
      });
    }

    // Broadcast to all connected UI WebSockets
    const updateMessage = JSON.stringify(createMessage("players.update", { servers }));
    const uiSockets = this.ctx.getWebSockets("ui");
    for (const ws of uiSockets) {
      try {
        ws.send(updateMessage);
      } catch (err) {
        console.error("[AgentConnection] Failed to send player update to UI:", err);
      }
    }

    const totalPlayers = servers.reduce((sum: number, s: any) => sum + (s.playerCount || 0), 0);
    console.log(`[AgentConnection] Player stats update: ${servers.length} servers, ${totalPlayers} total players`);
  }

  /**
   * Handle server.metrics.batch message from agent
   */
  private async handleMetricsBatch(message: Message): Promise<void> {
    const points = message.data?.points || [];
    if (points.length === 0) return;

    const DB = (this.env as any).DB;
    if (!DB) {
      console.error("[AgentConnection] D1 database not available for metrics storage");
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const threesDaysAgo = now - (3 * 24 * 60 * 60);

    try {
      const insertStmt = DB.prepare(`
        INSERT INTO server_metrics_history (id, server_id, timestamp, cpu_percent, memory_percent, memory_used_mb, memory_limit_mb, player_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertBatch: D1PreparedStatement[] = [];
      for (const point of points) {
        const id = crypto.randomUUID();
        insertBatch.push(
          insertStmt.bind(
            id,
            point.serverId,
            point.timestamp,
            point.cpuPercent,
            point.memoryPercent,
            point.memoryUsedMB,
            point.memoryLimitMB,
            point.playerCount ?? null,
            now
          )
        );
      }

      await DB.batch(insertBatch);

      if (Math.random() < 0.01) {
        await DB.prepare(`DELETE FROM server_metrics_history WHERE timestamp < ?`)
          .bind(threesDaysAgo)
          .run();
        console.log("[AgentConnection] Cleaned up old metrics records");
      }

      console.log(`[AgentConnection] Stored ${points.length} metrics points`);
    } catch (err) {
      console.error("[AgentConnection] Failed to store metrics batch:", err);
    }
  }

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

  // ─── Offline Alert Alarm ─────────────────────────────────────────

  /**
   * DO alarm handler — fires 5 minutes after agent disconnect.
   * If agent is still offline, sends alert emails to assigned users + admins.
   */
  async alarm(): Promise<void> {
    const agentId = await this.ctx.storage.get<string>('disconnectedAgentId');
    const agentName = await this.ctx.storage.get<string>('disconnectedAgentName');
    const disconnectedAt = await this.ctx.storage.get<number>('disconnectedAt');

    if (!agentId || !agentName) {
      console.log('[AgentConnection] Alarm fired but no disconnect info — ignoring');
      return;
    }

    // Verify agent is still offline in DB
    const agent = await this.env.DB.prepare('SELECT status FROM agents WHERE id = ?')
      .bind(agentId)
      .first<{ status: string }>();

    if (agent && agent.status === 'online') {
      console.log(`[AgentConnection] Alarm fired but agent ${agentName} is back online — skipping alert`);
      await this.ctx.storage.delete('disconnectedAgentId');
      await this.ctx.storage.delete('disconnectedAgentName');
      await this.ctx.storage.delete('disconnectedAt');
      return;
    }

    // Agent is still offline — send alert emails
    const apiKey = this.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log(`[AgentConnection] No RESEND_API_KEY configured — skipping offline alert for ${agentName}`);
      return;
    }

    const recipients = await getAlertRecipientsForAgent(this.env.DB, agentId);
    if (recipients.length === 0) {
      console.log(`[AgentConnection] No alert recipients for agent ${agentName} — skipping`);
      return;
    }

    const disconnectedDate = disconnectedAt
      ? new Date(disconnectedAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
      : 'Unknown';

    const html = buildAgentOfflineEmailHtml(agentName, disconnectedDate);

    console.log(`[AgentConnection] Sending offline alert for ${agentName} to ${recipients.length} recipient(s)`);

    const fromEmail = this.env.RESEND_FROM_EMAIL
      ? `ZedOps Alerts <${this.env.RESEND_FROM_EMAIL}>`
      : undefined;

    for (const email of recipients) {
      const result = await sendEmail(apiKey, {
        to: email,
        subject: `[ZedOps] Agent "${agentName}" is offline`,
        html,
        from: fromEmail,
      });

      if (!result.success) {
        console.error(`[AgentConnection] Failed to send offline alert to ${email}: ${result.error}`);
      }
    }

    // Mark that alert was sent (so we can send recovery email later)
    await this.ctx.storage.put('alertSentAt', Date.now());
  }

  /**
   * Send recovery emails to all alert recipients (called via waitUntil on reconnect)
   */
  private async sendRecoveryEmails(agentName: string, downtimeMinutes: number, recipients: string[]): Promise<void> {
    const apiKey = this.env.RESEND_API_KEY;
    if (!apiKey || recipients.length === 0) return;

    const html = buildAgentRecoveredEmailHtml(agentName, downtimeMinutes);
    const fromEmail = this.env.RESEND_FROM_EMAIL
      ? `ZedOps Alerts <${this.env.RESEND_FROM_EMAIL}>`
      : undefined;

    console.log(`[AgentConnection] Sending recovery email for ${agentName} to ${recipients.length} recipient(s)`);

    for (const email of recipients) {
      const result = await sendEmail(apiKey, {
        to: email,
        subject: `[ZedOps] Agent "${agentName}" is back online`,
        html,
        from: fromEmail,
      });

      if (!result.success) {
        console.error(`[AgentConnection] Failed to send recovery email to ${email}: ${result.error}`);
      }
    }
  }

  // ─── Send Helpers ─────────────────────────────────────────────────

  /**
   * Send a message to the agent
   */
  private async send(message: Message): Promise<void> {
    const ws = this.getAgentWebSocket();
    if (ws) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send a message to the agent and wait for a reply
   */
  private async sendMessageWithReply(message: { subject: string; data: any }, timeout: number = 10000): Promise<Message> {
    const ws = this.getAgentWebSocket();
    if (!ws || !this.isRegistered) {
      throw new Error("Agent not connected");
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeoutId);
        resolve(msg);
      });
    });

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

  // ─── Container Operations ─────────────────────────────────────────

  private async handleContainerList(message: Message): Promise<void> {
    console.log(`[AgentConnection] Requesting container list from agent ${this.agentId}`);
    this.send(createMessage("container.list", {}));
  }

  private async handleContainerOperation(message: Message, operation: string): Promise<void> {
    const { containerId } = message.data as { containerId?: string };

    if (!containerId) {
      this.sendError("Container operation requires containerId");
      return;
    }

    console.log(`[AgentConnection] Requesting container.${operation} for ${containerId} on agent ${this.agentId}`);

    this.send(createMessage(`container.${operation}`, {
      containerId,
      operation,
    }));
  }

  private async handleContainersRequest(): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Request timeout"));
      }, 10000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "container.list",
      data: {},
      reply: inbox,
    });

    try {
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

  private async handleRegistryTagsRequest(request: Request): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const registry = url.searchParams.get("registry") || "";

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Request timeout"));
      }, 15000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "registry.tags",
      data: { registry },
      reply: inbox,
    });

    try {
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

  private async handleNotifyUpdate(request: Request): Promise<Response> {
    const agentWs = this.getAgentWebSocket();
    if (!this.isRegistered || !agentWs) {
      return new Response(JSON.stringify({
        success: false,
        error: "Agent not connected",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: { version: string };
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid JSON body",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body.version) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing version",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const message = createMessage("agent.update.available", {
        version: body.version,
      });
      agentWs.send(JSON.stringify(message));

      console.log(`[AgentConnection] Sent update notification (version ${body.version}) to agent ${this.agentName}`);

      return new Response(JSON.stringify({
        success: true,
        agentName: this.agentName,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(`[AgentConnection] Failed to send update notification:`, error);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to send notification",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handlePortCheckRequest(request: Request): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: { ports: number[] };
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body.ports || !Array.isArray(body.ports)) {
      return new Response(JSON.stringify({ error: "Missing or invalid ports array" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Request timeout"));
      }, 10000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "port.check",
      data: { ports: body.ports },
      reply: inbox,
    });

    try {
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

  private async handleContainerOperationRequest(
    containerId: string,
    operation: string
  ): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!["start", "stop", "restart"].includes(operation)) {
      return new Response(JSON.stringify({ error: `Invalid operation: ${operation}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Operation timeout"));
      }, 30000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: `container.${operation}`,
      data: { containerId, operation },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
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

  private async handleContainerMetricsRequest(containerId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Metrics request timeout"));
      }, 10000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: 'container.metrics',
      data: { containerId },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
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

  // ─── Log Subscription (Container Logs) ────────────────────────────

  /**
   * Handle log.subscribe from UI client.
   * Stores subscription in ctx.storage (survives hibernation).
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

      // Store subscription in persistent storage
      await this.ctx.storage.put(`sub:${subscriberId}`, containerId);
      this.containerSubCache = null; // Invalidate cache

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
      }

      // Check if we need to start log streaming from agent
      const subs = await this.getContainerSubscriptions();
      const subscribersForContainer = Array.from(subs.values()).filter(cid => cid === containerId);

      if (subscribersForContainer.length === 1) {
        // First subscriber for this container, start streaming
        console.log(`[AgentConnection] Starting log stream for container ${containerId} on agent`);

        const agentWs = this.getAgentWebSocket();
        if (!agentWs) {
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
   * Handle log.unsubscribe from UI client.
   */
  private async handleLogUnsubscribe(subscriberId: string, ws: WebSocket): Promise<void> {
    const containerId = await this.ctx.storage.get<string>(`sub:${subscriberId}`);
    if (!containerId) return; // Already unsubscribed

    // Remove subscription
    await this.ctx.storage.delete(`sub:${subscriberId}`);
    this.containerSubCache = null; // Invalidate cache

    console.log(`[AgentConnection] Subscriber ${subscriberId} unsubscribed from container ${containerId}`);

    // Check remaining subscribers
    const subs = await this.getContainerSubscriptions();
    const remaining = Array.from(subs.values()).filter(cid => cid === containerId);

    if (remaining.length === 0) {
      console.log(`[AgentConnection] Stopping log stream for container ${containerId} on agent`);
      this.send(createMessage("log.stream.stop", { containerId }));
    }

    ws.send(JSON.stringify(createMessage("log.unsubscribed", {
      containerId,
      message: "Unsubscribed from log stream",
    })));
  }

  /**
   * Handle log.line from agent — broadcast to subscribers and cache
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

    // Find UI WebSockets subscribed to this container
    const subs = await this.getContainerSubscriptions();
    const broadcastMessage = JSON.stringify(createMessage("log.line", logLine));

    for (const [subscriberId, cid] of subs) {
      if (cid !== containerId) continue;
      // Find the WebSocket for this subscriber
      const wsList = this.ctx.getWebSockets(`sub:${subscriberId}`);
      for (const ws of wsList) {
        try {
          ws.send(broadcastMessage);
        } catch (error) {
          console.error(`[AgentConnection] Failed to send log to subscriber ${subscriberId}:`, error);
          // Clean up dead subscriber
          await this.ctx.storage.delete(`sub:${subscriberId}`);
          this.containerSubCache = null;
        }
      }
    }
  }

  /**
   * Handle log.stream.error from agent
   */
  private async handleLogStreamError(message: Message): Promise<void> {
    const { containerId, error, errorCode } = message.data as {
      containerId?: string;
      error?: string;
      errorCode?: string;
    };

    console.error(`[AgentConnection] Log stream error for ${containerId}: ${error} (${errorCode})`);

    if (!containerId) return;

    const subs = await this.getContainerSubscriptions();
    const errorMessage = JSON.stringify(createMessage("log.stream.error", {
      containerId,
      error,
      errorCode,
    }));

    for (const [subscriberId, cid] of subs) {
      if (cid !== containerId) continue;
      const wsList = this.ctx.getWebSockets(`sub:${subscriberId}`);
      for (const ws of wsList) {
        try {
          ws.send(errorMessage);
        } catch (err) {
          console.error(`[AgentConnection] Failed to send error to subscriber ${subscriberId}:`, err);
          await this.ctx.storage.delete(`sub:${subscriberId}`);
          this.containerSubCache = null;
        }
      }
    }
  }

  // ─── Agent Log Subscription ───────────────────────────────────────

  /**
   * Handle agent.logs.subscribe from UI client
   */
  private async handleAgentLogSubscribe(
    subscriberId: string,
    ws: WebSocket,
    message: Message
  ): Promise<void> {
    try {
      const { tail = 500 } = (message.data || {}) as { tail?: number };

      // Store in persistent storage
      await this.ctx.storage.put(`agentsub:${subscriberId}`, true);
      this.agentSubCache = null; // Invalidate cache

      console.log(`[AgentConnection] Subscriber ${subscriberId} subscribed to agent logs`);

      const agentWs = this.getAgentWebSocket();
      const isAgentOnline = !!agentWs;

      // Send cached logs with online status
      const cachedLogs = this.agentLogBuffer.getAll();
      ws.send(JSON.stringify(createMessage("agent.logs.history", {
        lines: cachedLogs,
        agentOnline: isAgentOnline,
        cachedCount: cachedLogs.length,
      })));

      if (cachedLogs.length > 0) {
        console.log(`[AgentConnection] Sent ${cachedLogs.length} cached agent logs to ${subscriberId} (agent ${isAgentOnline ? 'online' : 'offline'})`);
      }

      // Start streaming from agent if online
      if (isAgentOnline) {
        await this.send(createMessage("agent.logs.subscribe", { tail }));
        this.isAgentLogStreaming = true;
        await this.ctx.storage.put('isAgentLogStreaming', true);
      }

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
   * Handle agent.logs.unsubscribe from UI client
   */
  private async handleAgentLogUnsubscribe(subscriberId: string): Promise<void> {
    const exists = await this.ctx.storage.get(`agentsub:${subscriberId}`);
    if (!exists) return;

    await this.ctx.storage.delete(`agentsub:${subscriberId}`);
    this.agentSubCache = null; // Invalidate cache

    console.log(`[AgentConnection] Subscriber ${subscriberId} unsubscribed from agent logs`);

    // Stop streaming if no more subscribers
    const agentSubs = await this.getAgentLogSubscriptions();
    if (agentSubs.size === 0 && this.isAgentLogStreaming) {
      console.log(`[AgentConnection] Stopping agent log stream (no more subscribers)`);
      const agentWs = this.getAgentWebSocket();
      if (agentWs) {
        await this.send(createMessage("agent.logs.unsubscribe", {}));
      }
      this.isAgentLogStreaming = false;
      await this.ctx.storage.put('isAgentLogStreaming', false);
    }
  }

  /**
   * Handle agent.logs.line from agent — broadcast and cache
   */
  private async handleAgentLogLine(message: Message): Promise<void> {
    const logLine = message.data as AgentLogLine;
    this.agentLogBuffer.append(logLine);

    const agentSubs = await this.getAgentLogSubscriptions();
    if (agentSubs.size > 0) {
      const broadcastMessage = JSON.stringify(createMessage("agent.logs.line", logLine));
      for (const subscriberId of agentSubs) {
        const wsList = this.ctx.getWebSockets(`sub:${subscriberId}`);
        for (const ws of wsList) {
          try {
            ws.send(broadcastMessage);
          } catch (error) {
            console.error(`[AgentConnection] Failed to send agent log to subscriber ${subscriberId}:`, error);
            await this.ctx.storage.delete(`agentsub:${subscriberId}`);
            this.agentSubCache = null;
          }
        }
      }
    }
  }

  /**
   * Handle agent.logs.history from agent
   */
  private async handleAgentLogHistory(message: Message): Promise<void> {
    const { lines } = message.data as { lines: AgentLogLine[] };

    console.log(`[AgentConnection] Received ${lines?.length || 0} agent log history lines`);

    if (!lines || lines.length === 0) return;

    for (const line of lines) {
      this.agentLogBuffer.append(line);
    }

    const agentSubs = await this.getAgentLogSubscriptions();
    if (agentSubs.size > 0) {
      const historyMessage = JSON.stringify(createMessage("agent.logs.history", { lines }));
      for (const subscriberId of agentSubs) {
        const wsList = this.ctx.getWebSockets(`sub:${subscriberId}`);
        for (const ws of wsList) {
          try {
            ws.send(historyMessage);
          } catch (error) {
            console.error(`[AgentConnection] Failed to send agent log history to subscriber ${subscriberId}:`, error);
            await this.ctx.storage.delete(`agentsub:${subscriberId}`);
            this.agentSubCache = null;
          }
        }
      }
    }
  }

  // ─── Progress Broadcasting ────────────────────────────────────────

  /**
   * Handle move.progress from agent — broadcast to all UI WebSockets
   */
  private async handleMoveProgress(message: Message): Promise<void> {
    const progress = message.data;
    console.log(`[AgentConnection] Move progress: ${progress.serverName} - ${progress.phase} ${progress.percent}%`);

    const broadcastMessage = JSON.stringify(createMessage("move.progress", progress));
    const uiSockets = this.ctx.getWebSockets("ui");
    for (const ws of uiSockets) {
      try {
        ws.send(broadcastMessage);
      } catch (error) {
        console.error("[AgentConnection] Failed to send move progress to UI:", error);
      }
    }
  }

  /**
   * Handle backup.progress from agent — broadcast to all UI WebSockets
   */
  private async handleBackupProgress(message: Message): Promise<void> {
    const progress = message.data;
    console.log(`[AgentConnection] Backup progress: ${progress.serverName} - ${progress.phase} ${progress.percent}%`);

    const broadcastMessage = JSON.stringify(createMessage("backup.progress", progress));
    const uiSockets = this.ctx.getWebSockets("ui");
    for (const ws of uiSockets) {
      try {
        ws.send(broadcastMessage);
      } catch (error) {
        console.error("[AgentConnection] Failed to send backup progress to UI:", error);
      }
    }
  }

  /**
   * Handle adopt.progress from agent — broadcast to all UI WebSockets
   */
  private async handleAdoptProgress(message: Message): Promise<void> {
    const progress = message.data;
    console.log(`[AgentConnection] Adopt progress: ${progress.serverName} - ${progress.phase} ${progress.percent}%`);

    const broadcastMessage = JSON.stringify(createMessage("adopt.progress", progress));
    const uiSockets = this.ctx.getWebSockets("ui");
    for (const ws of uiSockets) {
      try {
        ws.send(broadcastMessage);
      } catch (error) {
        console.error("[AgentConnection] Failed to send adopt progress to UI:", error);
      }
    }
  }

  // ─── RCON ─────────────────────────────────────────────────────────

  /**
   * Handle RCON messages from UI client
   */
  private async handleUIRCONMessage(ws: WebSocket, message: Message): Promise<void> {
    try {
      const agentWs = this.getAgentWebSocket();
      if (!agentWs) {
        if (message.reply) {
          ws.send(JSON.stringify(createMessage(message.reply, {
            success: false,
            error: "Agent not connected",
            errorCode: "AGENT_OFFLINE",
          })));
        }
        return;
      }

      try {
        const reply = await this.sendMessageWithReply({
          subject: message.subject,
          data: message.data,
        }, 30000);

        if (message.reply) {
          ws.send(JSON.stringify(createMessage(message.reply, reply.data)));
        }

        // Store RCON session mapping if this was a successful connect
        if (message.subject === "rcon.connect" && reply.data.success) {
          const sessionId = reply.data.sessionId;
          const serverId = (message.data as any).serverId;
          if (sessionId && serverId) {
            this.rconSessions.set(sessionId, { sessionId, serverId });
          }
        }

        // Audit log RCON commands
        if (message.subject === "rcon.command" && reply.data.success) {
          const sessionId = (message.data as any).sessionId;
          const command = (message.data as any).command;
          const userId = this.getUserId(ws);

          if (sessionId && command && userId) {
            const session = this.rconSessions.get(sessionId);
            if (session) {
              try {
                const server = await this.env.DB.prepare(
                  'SELECT name FROM servers WHERE id = ?'
                )
                  .bind(session.serverId)
                  .first<{ name: string }>();

                if (server) {
                  const mockContext = {
                    req: { header: () => null },
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
              }
            }
          }
        }

        // Clean up RCON session on disconnect
        if (message.subject === "rcon.disconnect" && reply.data.success) {
          const sessionId = (message.data as any).sessionId;
          if (sessionId) {
            this.rconSessions.delete(sessionId);
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

      const agentWs = this.getAgentWebSocket();
      if (!agentWs) {
        if (message.reply) {
          this.send(createMessage(message.reply, {
            success: false,
            error: "Agent not connected",
            errorCode: "AGENT_OFFLINE",
          }));
        }
        return;
      }

      try {
        const reply = await this.sendMessageWithReply({
          subject: "rcon.connect",
          data: { serverId, containerId: containerID, port, password },
        }, 30000);

        if (reply.data.success) {
          const sessionId = reply.data.sessionId;
          this.rconSessions.set(sessionId, { sessionId, serverId });

          if (message.reply) {
            this.send(createMessage(message.reply, {
              success: true,
              sessionId,
            }));
          }
        } else {
          if (message.reply) {
            this.send(createMessage(message.reply, reply.data));
          }
        }
      } catch (error) {
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

      const agentWs = this.getAgentWebSocket();
      if (!agentWs) {
        if (message.reply) {
          this.send(createMessage(message.reply, {
            success: false,
            error: "Agent not connected",
            errorCode: "AGENT_OFFLINE",
          }));
        }
        return;
      }

      try {
        const reply = await this.sendMessageWithReply({
          subject: "rcon.command",
          data: { sessionId, command },
        }, 30000);

        if (message.reply) {
          this.send(createMessage(message.reply, reply.data));
        }
      } catch (error) {
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

  private async handleRCONDisconnect(message: Message): Promise<void> {
    try {
      const { sessionId } = message.data as { sessionId?: string };

      if (!sessionId) {
        this.sendError("RCON disconnect requires sessionId");
        return;
      }

      const agentWs = this.getAgentWebSocket();
      if (!agentWs) {
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

      try {
        const reply = await this.sendMessageWithReply({
          subject: "rcon.disconnect",
          data: { sessionId },
        }, 10000);

        this.rconSessions.delete(sessionId);

        if (message.reply) {
          this.send(createMessage(message.reply, reply.data));
        }
      } catch (error) {
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

  // ─── Server Operations ────────────────────────────────────────────

  private async handleServerCreateRequest(request: Request): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { serverId, name, registry, imageTag, config, gamePort, udpPort, rconPort, dataPath } = body;
    if (!serverId || !name || !registry || !imageTag || !config || !gamePort || !udpPort || !rconPort || !dataPath) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server creation timeout"));
      }, 60000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "server.create",
      data: { serverId, name, registry, imageTag, config, gamePort, udpPort, rconPort, dataPath },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
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

  private async handleServerDeleteRequest(request: Request, serverId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { containerId, serverName, removeVolumes, dataPath } = body;
    if (!containerId && !serverName) {
      return new Response(JSON.stringify({ error: "Missing containerId or serverName" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!dataPath) {
      return new Response(JSON.stringify({ error: "Missing dataPath - required for data directory operations" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server deletion timeout"));
      }, 30000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

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
      const reply = await replyPromise;
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

  private async handleServerRebuildRequest(request: Request, serverId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { containerId, name, registry, imageTag, config, gamePort, udpPort, rconPort, dataPath } = body;
    if (!containerId) {
      return new Response(JSON.stringify({ error: "Missing containerId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server rebuild timeout"));
      }, 60000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

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
      const reply = await replyPromise;
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

  private async handleServerMoveDataRequest(request: Request, serverId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { serverName, oldPath, newPath } = body;
    if (!serverName || !oldPath || !newPath) {
      return new Response(JSON.stringify({ error: "Missing required fields: serverName, oldPath, newPath" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[AgentConnection] Moving server data: ${serverName} from ${oldPath} to ${newPath}`);

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server data move timeout - operation took longer than 5 minutes"));
      }, 300000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "server.movedata",
      data: { serverName, oldPath, newPath },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
      const success = reply.data.success !== false;
      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Server data move failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleServerGetDataPathRequest(serverId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const server = await this.env.DB.prepare(
      "SELECT container_id FROM servers WHERE id = ?"
    ).bind(serverId).first();

    if (!server || !server.container_id) {
      return new Response(JSON.stringify({ error: "Server not found or has no container" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const containerId = server.container_id as string;

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Get data path timeout"));
      }, 30000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "server.getdatapath",
      data: { containerId },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
      const success = reply.data.success !== false;
      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Get data path failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleServerInspectRequest(containerId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server inspect timeout"));
      }, 30000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "server.inspect",
      data: { containerId },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
      const success = reply.data.success !== false;
      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Server inspect failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleServerAdoptRequest(request: Request): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { serverId, name, containerId, registry, imageTag, config, gamePort, udpPort, rconPort, dataPath } = body;
    if (!serverId || !name || !containerId || !registry || !imageTag || !gamePort || !udpPort || !rconPort || !dataPath) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Server adopt timeout"));
      }, 60000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "server.adopt",
      data: { serverId, name, containerId, registry, imageTag, config: config || {}, gamePort, udpPort, rconPort, dataPath },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
      const success = reply.data.success !== false;
      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Server adopt failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleServerStorageRequest(request: Request, serverName: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let dataPath: string;
    try {
      const body = await request.json() as { dataPath?: string };
      if (!body.dataPath) {
        return new Response(JSON.stringify({ error: "Missing dataPath in request body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      dataPath = body.dataPath;
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Get storage timeout"));
      }, 30000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        this.pendingReplies.delete(inbox);
        resolve(msg);
      });
    });

    this.send(
      createMessage("server.volumesizes", {
        serverName: serverName,
        dataPath: dataPath,
      }, inbox)
    );

    try {
      const reply = await replyPromise;
      const success = reply.data.success !== false;
      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Get storage failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleServerSyncRequest(request: Request): Promise<Response> {
    try {
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

  private async handleCheckDataRequest(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { serverName, dataPath } = body;

      if (!serverName || !dataPath) {
        return new Response(JSON.stringify({ error: "Missing serverName or dataPath" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const agentWs = this.getAgentWebSocket();
      if (!agentWs) {
        return new Response(JSON.stringify({
          dataExists: false,
          error: "Agent offline",
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      const checkResponse = await this.sendMessageWithReply({
        subject: 'server.checkdata',
        data: { servers: [serverName], dataPath: dataPath },
      }, 10000);

      const status = checkResponse.data.statuses?.[0];
      const dataExists = status?.dataExists || false;

      return new Response(JSON.stringify({ dataExists, serverName, dataPath }), {
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

  // ─── Server Sync ──────────────────────────────────────────────────

  private async syncServers(agentId: string | null = null): Promise<any> {
    const effectiveAgentId = agentId || this.agentId;

    if (!effectiveAgentId) {
      throw new Error("Cannot sync: no agent ID");
    }

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

    const agentResult = await this.env.DB.prepare(
      `SELECT server_data_path FROM agents WHERE id = ?`
    )
      .bind(effectiveAgentId)
      .first();

    const agentDefaultPath = agentResult?.server_data_path || '/var/lib/zedops/servers';

    const containersResponse = await this.sendMessageWithReply({
      subject: 'container.list',
      data: {},
    }, 10000);

    const containers = containersResponse.data.containers || [];

    const serversByPath = new Map<string, any[]>();
    for (const server of servers) {
      const effectivePath = server.server_data_path || agentDefaultPath;
      if (!serversByPath.has(effectivePath)) {
        serversByPath.set(effectivePath, []);
      }
      serversByPath.get(effectivePath)!.push(server);
    }

    const dataByName = new Map();
    for (const [dataPath, pathServers] of serversByPath) {
      const serverNames = pathServers.map((s: any) => s.name);

      const dataCheckResponse = await this.sendMessageWithReply({
        subject: 'server.checkdata',
        data: { servers: serverNames, dataPath: dataPath },
      }, 10000);

      const statuses = dataCheckResponse.data.statuses || [];
      for (const status of statuses) {
        dataByName.set(status.serverName, status);
      }
    }

    const containerByName = new Map();
    for (const container of containers) {
      const labels = container.labels || {};
      const serverName = labels['zedops.server.name'];
      if (serverName) {
        containerByName.set(serverName, container);
      }
    }

    let syncedCount = 0;
    for (const server of servers) {
      const serverName = server.name;
      const container = containerByName.get(serverName);
      const dataStatus = dataByName.get(serverName);

      let newStatus = server.status;
      let newDataExists = server.data_exists === 1;

      if (dataStatus) {
        newDataExists = dataStatus.dataExists;
      }

      if (container) {
        if (container.state === 'running') {
          newStatus = 'running';
        } else if (container.state === 'exited' || container.state === 'stopped') {
          newStatus = 'stopped';
        }
      } else {
        if (server.status !== 'creating' && server.status !== 'deleting' && server.status !== 'deleted') {
          newStatus = 'missing';
        }
      }

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
    }
  }

  // ─── Image Inspect ────────────────────────────────────────────────

  private async handleImageInspectRequest(imageTag: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not registered" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Image inspect timeout"));
      }, 10000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        this.pendingReplies.delete(inbox);
        resolve(msg.data);
      });
    });

    this.send({
      subject: "images.inspect",
      data: { imageTag },
      reply: inbox,
    });

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
      return new Response(JSON.stringify({
        error: "Timeout waiting for agent response",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ─── One-Shot RCON ────────────────────────────────────────────────

  private async handleOneShotRconCommand(request: Request): Promise<Response> {
    // Ensure state is restored
    await this.restoreState();

    const ws = this.getAgentWebSocket();

    if (!this.isRegistered || !this.agentId || !ws) {
      return new Response(JSON.stringify({
        success: false,
        error: "Agent not registered or not connected",
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: { serverId: string; containerId: string; port: number; password: string; command: string };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid JSON body",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { serverId, containerId, port, password, command } = body;
    if (!serverId || !containerId || !port || !password || !command) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required fields: serverId, containerId, port, password, command",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[AgentConnection] One-shot RCON command for server ${serverId}: ${command}`);

    try {
      const connectReply = await this.sendMessageWithReply({
        subject: "rcon.connect",
        data: { serverId, containerId, port, password },
      }, 30000);

      if (!connectReply.data.success) {
        return new Response(JSON.stringify({
          success: false,
          error: connectReply.data.error || "RCON connect failed",
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const sessionId = connectReply.data.sessionId;

      try {
        const commandReply = await this.sendMessageWithReply({
          subject: "rcon.command",
          data: { sessionId, command },
        }, 30000);

        // Disconnect (fire and forget)
        this.send({
          subject: "rcon.disconnect",
          data: { sessionId },
        });

        if (!commandReply.data.success) {
          return new Response(JSON.stringify({
            success: false,
            error: commandReply.data.error || "RCON command failed",
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          response: commandReply.data.response || "",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (commandError) {
        this.send({
          subject: "rcon.disconnect",
          data: { sessionId },
        });
        throw commandError;
      }
    } catch (error) {
      console.error(`[AgentConnection] One-shot RCON command failed:`, error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "RCON command failed",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ─── Backup Operations ────────────────────────────────────────────

  private async handleBackupCreateRequest(request: Request, serverId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { serverName, dataPath, backupId, notes, containerId, rconPort, rconPassword } = body;
    if (!serverName || !dataPath || !backupId) {
      return new Response(JSON.stringify({ error: "Missing required fields: serverName, dataPath, backupId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Backup creation timeout - operation took longer than 5 minutes"));
      }, 300000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "backup.create",
      data: { serverName, dataPath, backupId, notes, containerId: containerId || "", rconPort: rconPort || 0, rconPassword: rconPassword || "" },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
      const success = reply.data.success !== false;
      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Backup creation failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleBackupSyncRequest(request: Request, serverId: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { serverName, dataPath } = body;
    if (!serverName || !dataPath) {
      return new Response(JSON.stringify({ error: "Missing required fields: serverName, dataPath" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Backup sync timeout"));
      }, 30000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "backup.list",
      data: { serverName, dataPath },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
      const success = reply.data.success !== false;
      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Backup sync failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleBackupDeleteRequest(request: Request, serverId: string, filename: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { serverName, dataPath } = body;
    if (!serverName || !dataPath) {
      return new Response(JSON.stringify({ error: "Missing required fields: serverName, dataPath" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Backup delete timeout"));
      }, 30000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "backup.delete",
      data: { serverName, dataPath, filename: decodeURIComponent(filename) },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
      const success = reply.data.success !== false;
      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Backup delete failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private async handleBackupRestoreRequest(request: Request, serverId: string, filename: string): Promise<Response> {
    if (!this.isRegistered || !this.agentId) {
      return new Response(JSON.stringify({ error: "Agent not connected" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { serverName, dataPath, backupId, containerId } = body;
    if (!serverName || !dataPath || !backupId) {
      return new Response(JSON.stringify({ error: "Missing required fields: serverName, dataPath, backupId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const inbox = `_INBOX.${crypto.randomUUID()}`;

    const replyPromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(inbox);
        reject(new Error("Backup restore timeout - operation took longer than 10 minutes"));
      }, 600000);

      this.pendingReplies.set(inbox, (msg: Message) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });

    this.send({
      subject: "backup.restore",
      data: { serverName, dataPath, filename: decodeURIComponent(filename), backupId, containerId: containerId || "" },
      reply: inbox,
    });

    try {
      const reply = await replyPromise;
      const success = reply.data.success !== false;
      return new Response(JSON.stringify(reply.data), {
        status: success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "Backup restore failed",
      }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
