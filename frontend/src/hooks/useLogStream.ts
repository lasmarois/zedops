/**
 * Hook for streaming container logs via WebSocket
 */

import { useEffect, useState, useRef, useCallback } from 'react';

export interface LogLine {
  containerId: string;
  timestamp: number;
  stream: 'stdout' | 'stderr' | 'unknown';
  message: string;
}

interface LogMessage {
  subject: string;
  data: unknown;
  timestamp?: number;
}

export interface UseLogStreamOptions {
  agentId: string;
  containerId: string;
  password: string;
  enabled?: boolean;
}

export interface UseLogStreamReturn {
  logs: LogLine[];
  isConnected: boolean;
  error: string | null;
  clearLogs: () => void;
}

export function useLogStream({
  agentId,
  containerId,
  password,
  enabled = true,
}: UseLogStreamOptions): UseLogStreamReturn {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !agentId || !containerId) {
      return;
    }

    try {
      // Build WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/agents/${agentId}/logs/ws?password=${encodeURIComponent(password)}`;

      console.log(`[LogStream] Connecting to ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[LogStream] WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to logs
        const subscribeMsg = {
          subject: 'log.subscribe',
          data: { containerId },
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(subscribeMsg));
        console.log(`[LogStream] Subscribed to container ${containerId}`);
      };

      ws.onmessage = (event) => {
        try {
          const message: LogMessage = JSON.parse(event.data);

          switch (message.subject) {
            case 'log.history': {
              // Cached logs received
              const { lines } = message.data as { containerId: string; lines: LogLine[] };
              console.log(`[LogStream] Received ${lines.length} cached logs`);
              setLogs(lines);
              break;
            }

            case 'log.line': {
              // New log line
              const logLine = message.data as LogLine;
              setLogs((prev) => [...prev, logLine]);
              break;
            }

            case 'log.subscribed': {
              const { containerId: cid, message: msg } = message.data as {
                containerId: string;
                message: string;
              };
              console.log(`[LogStream] ${msg} for ${cid}`);
              break;
            }

            case 'log.stream.error': {
              const errorData = message.data as { error?: string };
              console.error('[LogStream] Stream error:', errorData.error);
              setError(errorData.error || 'Unknown stream error');
              break;
            }

            default:
              console.log('[LogStream] Unknown message:', message);
          }
        } catch (err) {
          console.error('[LogStream] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[LogStream] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log(`[LogStream] WebSocket closed (code: ${event.code})`);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnect with exponential backoff
        if (enabled && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          console.log(`[LogStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error('[LogStream] Failed to create WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [enabled, agentId, containerId, password]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      console.log('[LogStream] Disconnecting WebSocket');

      // Send unsubscribe before closing
      try {
        const unsubscribeMsg = {
          subject: 'log.unsubscribe',
          data: { containerId },
          timestamp: Date.now(),
        };
        wsRef.current.send(JSON.stringify(unsubscribeMsg));
      } catch (err) {
        // Ignore errors when sending unsubscribe
      }

      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [containerId]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    logs,
    isConnected,
    error,
    clearLogs,
  };
}
