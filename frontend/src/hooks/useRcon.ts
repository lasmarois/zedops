/**
 * Hook for RCON console via WebSocket
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getToken } from '../lib/auth';

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
  rconPassword: string;   // Server's RCON_PASSWORD for RCON connection
  enabled?: boolean;
}

export interface UseRconReturn {
  isConnected: boolean;
  sessionId: string | null;
  error: string | null;
  isRetrying: boolean;
  retryAttempt: number;
  maxRetries: number;
  sendCommand: (command: string) => Promise<string>;
  disconnect: () => void;
  manualRetry: () => void;
}

export function useRcon({
  agentId,
  serverId,
  containerID,
  port,
  rconPassword,
  enabled = true,
}: UseRconOptions): UseRconReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Retry logic for network resilience and server restart scenarios
  // NOTE: This is NOT for container initialization bugs (fixed in steam-zomboid v2.1.1)
  // Use cases: PZ server restarts (30-60s downtime), network glitches, temporary RCON unavailability
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const maxRetries = 5;
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const pendingRepliesRef = useRef<Map<string, (response: any) => void>>(new Map());

  // Keep ref in sync with state
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Helper to check if error is retryable (connection refused = server not ready yet)
  const isRetryableError = (errorMessage: string): boolean => {
    return errorMessage.includes('connection refused') ||
           errorMessage.includes('connect: connection refused') ||
           errorMessage.includes('ECONNREFUSED');
  };

  // Retry with exponential backoff
  const scheduleRetry = useCallback((attempt: number) => {
    if (attempt >= maxRetries) {
      setIsRetrying(false);
      console.log(`[RCON] Max retries (${maxRetries}) reached, giving up`);
      return;
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, 30s
    const delays = [2000, 4000, 8000, 16000, 30000];
    const delay = delays[attempt] || 30000;

    setIsRetrying(true);
    setRetryAttempt(attempt + 1);
    console.log(`[RCON] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);

    retryTimeoutRef.current = window.setTimeout(() => {
      connect();
    }, delay);
  }, [maxRetries]);

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
      // Build WebSocket URL - use JWT token for manager authentication
      const token = getToken();
      if (!token) {
        throw new Error('Not authenticated - no JWT token');
      }

      console.log('[RCON] JWT token found:', token ? `${token.substring(0, 20)}...` : 'null');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${protocol}//${wsHost}/api/agents/${agentId}/logs/ws?token=${encodeURIComponent(token)}`;

      console.log(`[RCON] Connecting to WebSocket...`);
      console.log(`[RCON] - Protocol: ${protocol}`);
      console.log(`[RCON] - Host: ${wsHost}`);
      console.log(`[RCON] - Agent ID: ${agentId}`);
      console.log(`[RCON] - Full URL: ${wsUrl.split('?')[0]}?token=<redacted>`);

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
            // Connection successful - reset retry state
            setSessionId(response.sessionId);
            setIsConnected(true);
            setError(null);
            setIsRetrying(false);
            setRetryAttempt(0);
            console.log(`[RCON] Connected with session ${response.sessionId}`);
          } else {
            const errorMsg = response.error || 'RCON connection failed';
            console.error('[RCON] Connection failed:', errorMsg);

            // Check if error is retryable (connection refused = server unavailable)
            // Common scenarios: server restarting, network hiccup, RCON service slow to start
            if (isRetryableError(errorMsg) && retryAttempt < maxRetries) {
              // Don't show error to user yet, we're retrying
              console.log(`[RCON] Connection refused, will retry...`);
              scheduleRetry(retryAttempt);
            } else {
              // Non-retryable error or max retries reached
              setError(errorMsg);
              setIsRetrying(false);
            }
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
        console.log(`[RCON] WebSocket closed (code: ${event.code}, reason: ${event.reason})`);

        // Provide more specific error messages based on close code
        if (event.code === 1008) {
          setError('Authentication failed - please try logging in again');
        } else if (event.code === 1003) {
          setError('Unsupported WebSocket message');
        } else if (event.code !== 1000 && event.code !== 1006) {
          // 1000 = normal close, 1006 = abnormal close (connection lost)
          setError(`Connection closed with code ${event.code}: ${event.reason || 'Unknown reason'}`);
        }

        setIsConnected(false);
        setSessionId(null);
        wsRef.current = null;
      };
    } catch (err) {
      console.error('[RCON] Failed to create WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [enabled, agentId, serverId, containerID, port, rconPassword]);

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
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

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
    setIsRetrying(false);
    setRetryAttempt(0);
    sessionIdRef.current = null;
  }, []); // No dependencies - uses refs

  // Manual retry function for user
  const manualRetry = useCallback(() => {
    console.log('[RCON] Manual retry requested');
    setRetryAttempt(0);
    setIsRetrying(false);
    setError(null);
    connect();
  }, [connect]);

  // Connect on mount/enable, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, agentId, serverId, containerID, port, rconPassword]); // Only primitives

  return {
    isConnected,
    sessionId,
    error,
    isRetrying,
    retryAttempt,
    maxRetries,
    sendCommand,
    disconnect,
    manualRetry,
  };
}
