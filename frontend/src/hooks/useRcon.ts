/**
 * Hook for RCON console via WebSocket
 */

import { useEffect, useState, useRef, useCallback } from 'react';

interface RconMessage {
  subject: string;
  data: unknown;
  timestamp?: number;
  reply?: string;
}

export interface UseRconOptions {
  agentId: string;
  serverId: string;
  containerID: string;
  port: number;
  adminPassword: string;  // Manager's ADMIN_PASSWORD for WebSocket authentication
  rconPassword: string;   // Server's RCON_PASSWORD for RCON connection
  enabled?: boolean;
}

export interface UseRconReturn {
  isConnected: boolean;
  sessionId: string | null;
  error: string | null;
  sendCommand: (command: string) => Promise<string>;
  disconnect: () => void;
}

export function useRcon({
  agentId,
  serverId,
  containerID,
  port,
  adminPassword,
  rconPassword,
  enabled = true,
}: UseRconOptions): UseRconReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingRepliesRef = useRef<Map<string, (response: any) => void>>(new Map());

  // Keep ref in sync with state
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const connect = useCallback(async () => {
    if (!enabled || !agentId || !serverId) {
      return;
    }

    // Don't reconnect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[RCON] Already connected, skipping reconnect');
      return;
    }

    try {
      // Build WebSocket URL - use adminPassword for manager authentication
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${protocol}//${wsHost}/api/agents/${agentId}/logs/ws?password=${encodeURIComponent(adminPassword)}`;

      console.log(`[RCON] Connecting to ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[RCON] WebSocket connected');

        // Send RCON connect request (agent connects via Docker network)
        // Use rconPassword for actual RCON authentication
        const inbox = `_INBOX.${crypto.randomUUID()}`;
        const connectMsg: RconMessage = {
          subject: 'rcon.connect',
          data: { serverId, containerID, port, password: rconPassword },
          reply: inbox,
          timestamp: Date.now(),
        };

        // Store reply handler
        pendingRepliesRef.current.set(inbox, (response: any) => {
          if (response.success) {
            setSessionId(response.sessionId);
            setIsConnected(true);
            setError(null);
            console.log(`[RCON] Connected with session ${response.sessionId}`);
          } else {
            setError(response.error || 'RCON connection failed');
            console.error('[RCON] Connection failed:', response.error);
          }
        });

        ws.send(JSON.stringify(connectMsg));
      };

      ws.onmessage = (event) => {
        try {
          const message: RconMessage = JSON.parse(event.data);

          // Handle inbox replies
          if (message.subject.startsWith('_INBOX.')) {
            const handler = pendingRepliesRef.current.get(message.subject);
            if (handler) {
              handler(message.data);
              pendingRepliesRef.current.delete(message.subject);
            }
          }

          // Handle errors
          if (message.subject === 'error') {
            const errorData = message.data as { message?: string };
            console.error('[RCON] Error:', errorData.message);
            setError(errorData.message || 'Unknown error');
          }
        } catch (err) {
          console.error('[RCON] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[RCON] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log(`[RCON] WebSocket closed (code: ${event.code})`);
        setIsConnected(false);
        setSessionId(null);
        wsRef.current = null;
      };
    } catch (err) {
      console.error('[RCON] Failed to create WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [enabled, agentId, serverId, containerID, port, adminPassword, rconPassword]);

  const sendCommand = useCallback(async (command: string): Promise<string> => {
    if (!wsRef.current || !sessionIdRef.current) {
      throw new Error('RCON not connected');
    }

    return new Promise((resolve, reject) => {
      const inbox = `_INBOX.${crypto.randomUUID()}`;
      const commandMsg: RconMessage = {
        subject: 'rcon.command',
        data: { sessionId: sessionIdRef.current, command },
        reply: inbox,
        timestamp: Date.now(),
      };

      // Set timeout
      const timeout = setTimeout(() => {
        pendingRepliesRef.current.delete(inbox);
        reject(new Error('Command timeout'));
      }, 30000);

      // Store reply handler
      pendingRepliesRef.current.set(inbox, (response: any) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve(response.response || '');
        } else {
          reject(new Error(response.error || 'Command failed'));
        }
      });

      wsRef.current!.send(JSON.stringify(commandMsg));
    });
  }, []); // No dependencies - uses refs

  const disconnect = useCallback(() => {
    if (wsRef.current && sessionIdRef.current) {
      console.log('[RCON] Disconnecting');

      // Send disconnect message
      try {
        const disconnectMsg: RconMessage = {
          subject: 'rcon.disconnect',
          data: { sessionId: sessionIdRef.current },
          timestamp: Date.now(),
        };
        wsRef.current.send(JSON.stringify(disconnectMsg));
      } catch (err) {
        // Ignore errors when sending disconnect
      }

      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setSessionId(null);
    sessionIdRef.current = null;
  }, []); // No dependencies - uses refs

  // Connect on mount/enable, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]); // Safe now - these callbacks are stable

  return {
    isConnected,
    sessionId,
    error,
    sendCommand,
    disconnect,
  };
}
