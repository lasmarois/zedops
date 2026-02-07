/**
 * M12: Hook for streaming backup/restore progress via WebSocket
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getToken } from '../lib/auth';

export interface BackupProgress {
  backupId: string;
  serverName: string;
  phase: 'calculating' | 'saving' | 'compressing' | 'complete' | 'error' | 'stopping' | 'extracting' | 'starting';
  percent: number;
  error?: string;
}

interface BackupProgressMessage {
  subject: string;
  data: BackupProgress;
  timestamp?: number;
}

export interface UseBackupProgressOptions {
  agentId: string;
  serverName: string;
  enabled?: boolean;
}

export interface UseBackupProgressReturn {
  progress: BackupProgress | null;
  isConnected: boolean;
  error: string | null;
  reset: () => void;
}

export function useBackupProgress({
  agentId,
  serverName,
  enabled = true,
}: UseBackupProgressOptions): UseBackupProgressReturn {
  const [progress, setProgress] = useState<BackupProgress | null>(null);
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
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/agents/${agentId}/logs/ws?token=${encodeURIComponent(token)}`;

      console.log(`[BackupProgress] Connecting to WebSocket for ${serverName}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[BackupProgress] WebSocket connected');
        setIsConnected(true);
        setError(null);

        // Subscribe to receive messages
        const subscribeMsg = {
          subject: 'log.subscribe',
          data: { containerId: 'backup-progress-listener' },
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(subscribeMsg));
      };

      ws.onmessage = (event) => {
        try {
          const message: BackupProgressMessage = JSON.parse(event.data);

          if (message.subject === 'backup.progress') {
            const progressData = message.data;

            // Filter by serverName
            if (progressData.serverName === serverName) {
              console.log(`[BackupProgress] ${serverName}: ${progressData.phase} ${progressData.percent}%`);
              setProgress(progressData);

              if (progressData.phase === 'error' && progressData.error) {
                setError(progressData.error);
              }
            }
          }
        } catch {
          // Ignore parse errors for non-progress messages
        }
      };

      ws.onerror = (event) => {
        console.error('[BackupProgress] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log(`[BackupProgress] WebSocket closed (code: ${event.code})`);
        setIsConnected(false);
        wsRef.current = null;
      };
    } catch (err) {
      console.error('[BackupProgress] Failed to create WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [enabled, agentId, serverName]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log('[BackupProgress] Disconnecting WebSocket');
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
