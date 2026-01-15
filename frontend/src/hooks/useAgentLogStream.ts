/**
 * Hook for streaming agent logs via WebSocket
 * M9.8.33: Real-time agent logs
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getToken } from '../lib/auth';

export interface AgentLogLine {
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | string;
  message: string;
}

interface LogMessage {
  subject: string;
  data: unknown;
  timestamp?: number;
}

export interface UseAgentLogStreamOptions {
  agentId: string;
  enabled?: boolean;
  tail?: number;
}

export interface UseAgentLogStreamReturn {
  logs: AgentLogLine[];
  isConnected: boolean;
  isAgentOnline: boolean | null; // null = unknown, true = online, false = offline
  error: string | null;
  clearLogs: () => void;
}

export function useAgentLogStream({
  agentId,
  enabled = true,
  tail = 500,
}: UseAgentLogStreamOptions): UseAgentLogStreamReturn {
  const [logs, setLogs] = useState<AgentLogLine[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAgentOnline, setIsAgentOnline] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !agentId) {
      return;
    }

    const token = getToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    try {
      // Build WebSocket URL with JWT token
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/agents/${agentId}/logs/ws?token=${encodeURIComponent(token)}`;

      console.log(`[AgentLogStream] Connecting to WebSocket`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[AgentLogStream] WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to agent logs
        const subscribeMsg = {
          subject: 'agent.logs.subscribe',
          data: { tail },
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(subscribeMsg));
        console.log(`[AgentLogStream] Subscribed to agent logs`);
      };

      ws.onmessage = (event) => {
        try {
          const message: LogMessage = JSON.parse(event.data);

          switch (message.subject) {
            case 'agent.logs.history': {
              // Cached logs received with agent status
              const { lines, agentOnline } = message.data as {
                lines: AgentLogLine[];
                agentOnline?: boolean;
              };
              console.log(`[AgentLogStream] Received ${lines.length} cached logs (agent ${agentOnline ? 'online' : 'offline'})`);
              setLogs(lines);
              setIsAgentOnline(agentOnline ?? null);
              // Clear any previous error if we got cached logs
              if (lines.length > 0) {
                setError(null);
              }
              break;
            }

            case 'agent.logs.line': {
              // New log line
              const logLine = message.data as AgentLogLine;
              setLogs((prev) => [...prev, logLine]);
              break;
            }

            case 'agent.logs.subscribed': {
              const { message: msg } = message.data as { message: string };
              console.log(`[AgentLogStream] ${msg}`);
              break;
            }

            case 'agent.logs.error': {
              const errorData = message.data as { error?: string };
              console.error('[AgentLogStream] Error:', errorData.error);
              setError(errorData.error || 'Unknown error');
              break;
            }

            case 'error': {
              const errorData = message.data as { message?: string };
              console.error('[AgentLogStream] Error:', errorData.message);
              setError(errorData.message || 'Unknown error');
              break;
            }

            default:
              // Ignore other messages (like move.progress, log.line for containers)
              break;
          }
        } catch (err) {
          console.error('[AgentLogStream] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[AgentLogStream] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log(`[AgentLogStream] WebSocket closed (code: ${event.code})`);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnect with exponential backoff
        if (enabled && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          console.log(`[AgentLogStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error('[AgentLogStream] Failed to create WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [enabled, agentId, tail]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      console.log('[AgentLogStream] Disconnecting WebSocket');

      // Send unsubscribe before closing
      try {
        const unsubscribeMsg = {
          subject: 'agent.logs.unsubscribe',
          data: {},
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
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, agentId]);

  return {
    logs,
    isConnected,
    isAgentOnline,
    error,
    clearLogs,
  };
}
