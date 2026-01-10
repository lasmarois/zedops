/**
 * AgentConnection Durable Object
 *
 * Manages persistent WebSocket connection for a single agent.
 * Each agent gets its own Durable Object instance identified by agent ID.
 */

import { DurableObject } from "cloudflare:workers";

export class AgentConnection extends DurableObject {
  private ws: WebSocket | null = null;
  private agentId: string | null = null;

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
      console.log("[AgentConnection] Received message:", data);

      // Parse message as JSON
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      console.log("[AgentConnection] Parsed message:", message);

      // Basic echo for now (will be replaced with NATS-style routing in Phase 3)
      if (this.ws) {
        this.ws.send(JSON.stringify({
          subject: "echo",
          data: message,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error("[AgentConnection] Error handling message:", error);
      if (this.ws) {
        this.ws.send(JSON.stringify({
          subject: "error",
          data: { message: "Invalid message format" },
          timestamp: Date.now(),
        }));
      }
    }
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
