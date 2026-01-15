/**
 * M9.8.31: Hook for streaming data move progress via WebSocket
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getToken } from '../lib/auth';

export interface MoveProgress {
  serverName: string;
  phase: 'calculating' | 'copying' | 'verifying' | 'cleaning' | 'complete' | 'error';
  percent: number;
  bytesTotal: number;
  bytesCopied: number;
  filesTotal: number;
  filesCopied: number;
  currentFile?: string;
  error?: string;
}

interface MoveProgressMessage {
  subject: string;
  data: MoveProgress;
  timestamp?: number;
}

export interface UseMoveProgressOptions {
  agentId: string;
  serverName: string;
  enabled?: boolean;
}

export interface UseMoveProgressReturn {
  progress: MoveProgress | null;
  isConnected: boolean;
  error: string | null;
  reset: () => void;
}

export function useMoveProgress({
  agentId,
  serverName,
  enabled = true,
}: UseMoveProgressOptions): UseMoveProgressReturn {
  const [progress, setProgress] = useState<MoveProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const reset = useCallback(() => {
    setProgress(null);
    setError(null);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !agentId || !serverName) {
      return;
    }

    const token = getToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    try {
      // Build WebSocket URL (reuse logs endpoint which forwards move.progress)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/agents/${agentId}/logs/ws?token=${encodeURIComponent(token)}`;

      console.log(`[MoveProgress] Connecting to WebSocket for ${serverName}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[MoveProgress] WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Subscribe to logs (required to receive any messages including move.progress)
        // We use a dummy container ID since we only care about move.progress
        const subscribeMsg = {
          subject: 'log.subscribe',
          data: { containerId: 'move-progress-listener' },
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(subscribeMsg));
      };

      ws.onmessage = (event) => {
        try {
          const message: MoveProgressMessage = JSON.parse(event.data);

          if (message.subject === 'move.progress') {
            const progressData = message.data;

            // Filter by serverName
            if (progressData.serverName === serverName) {
              console.log(`[MoveProgress] ${serverName}: ${progressData.phase} ${progressData.percent}%`);
              setProgress(progressData);

              // Check for error
              if (progressData.phase === 'error' && progressData.error) {
                setError(progressData.error);
              }
            }
          }
        } catch (err) {
          // Ignore parse errors for non-progress messages
        }
      };

      ws.onerror = (event) => {
        console.error('[MoveProgress] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log(`[MoveProgress] WebSocket closed (code: ${event.code})`);
        setIsConnected(false);
        wsRef.current = null;
      };
    } catch (err) {
      console.error('[MoveProgress] Failed to create WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [enabled, agentId, serverName]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log('[MoveProgress] Disconnecting WebSocket');
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
  }, [enabled, agentId, serverName]);

  return {
    progress,
    isConnected,
    error,
    reset,
  };
}
