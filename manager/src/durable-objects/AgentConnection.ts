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

export class AgentConnection extends DurableObject {
  private ws: WebSocket | null = null;
  private agentId: string | null = null;
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
  private handleMessage(event: MessageEvent): void {
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
      this.routeMessage(message);
    } catch (error) {
      console.error("[AgentConnection] Error handling message:", error);
      this.sendError("Failed to process message");
    }
  }

  /**
   * Route message based on subject (NATS-style routing)
   */
  private routeMessage(message: Message): void {
    const { subject } = message;

    // Check if this is a reply to a pending request
    if (isInboxSubject(subject)) {
      this.handleInboxReply(message);
      return;
    }

    // Route to appropriate handler based on subject
    switch (subject) {
      case "agent.register":
        this.handleAgentRegister(message);
        break;

      case "agent.heartbeat":
        this.handleAgentHeartbeat(message);
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
   * (Will be fully implemented in Phase 4 with token validation)
   */
  private handleAgentRegister(message: Message): void {
    console.log("[AgentConnection] Agent registration request:", message.data);

    // For now, just acknowledge (full implementation in Phase 4)
    this.send(createMessage("agent.register.ack", {
      message: "Registration acknowledged (stub - Phase 4 will implement token flow)",
    }));
  }

  /**
   * Handle agent.heartbeat message
   * (Will be fully implemented in Phase 6 with D1 updates)
   */
  private handleAgentHeartbeat(message: Message): void {
    console.log("[AgentConnection] Heartbeat received");

    // For now, just acknowledge (full implementation in Phase 6)
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
  private handleClose(event: CloseEvent): void {
    console.log(`[AgentConnection] WebSocket closed: code=${event.code}, reason=${event.reason}`);
    this.ws = null;
    this.agentId = null;
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error("[AgentConnection] WebSocket error:", event);
    this.ws = null;
    this.agentId = null;
  }
}
