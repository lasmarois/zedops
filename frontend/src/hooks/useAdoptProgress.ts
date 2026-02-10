/**
 * Hook for streaming adoption progress via WebSocket
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getToken } from '../lib/auth';

export interface AdoptProgress {
  serverName: string;
  phase: 'stopping' | 'copying-bin' | 'copying-data' | 'creating-container' | 'complete' | 'error';
  percent: number;
  totalBytes: number;
  bytesCopied: number;
  error?: string;
}

interface AdoptProgressMessage {
  subject: string;
  data: AdoptProgress;
}

export interface UseAdoptProgressOptions {
  agentId: string;
  serverName: string;
  enabled?: boolean;
}

export function useAdoptProgress({
  agentId,
  serverName,
  enabled = true,
}: UseAdoptProgressOptions) {
  const [progress, setProgress] = useState<AdoptProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const reset = useCallback(() => {
    setProgress(null);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !agentId || !serverName) return;

    const token = getToken();
    if (!token) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/agents/${agentId}/logs/ws?token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Subscribe to receive messages (required by the WS protocol)
        ws.send(JSON.stringify({
          subject: 'log.subscribe',
          data: { containerId: 'adopt-progress-listener' },
          timestamp: Date.now(),
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: AdoptProgressMessage = JSON.parse(event.data);
          if (message.subject === 'adopt.progress' && message.data.serverName === serverName) {
            setProgress(message.data);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
      };
    } catch {
      // Connection failed
    }
  }, [enabled, agentId, serverName]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
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

  return { progress, isConnected, reset };
}
