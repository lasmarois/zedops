/**
 * Custom hook for server management using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchServers,
  createServer,
  deleteServer,
  rebuildServer,
  cleanupFailedServers,
  startServer,
  stopServer,
  purgeServer,
  restoreServer,
  syncServers,
  fetchServerMetrics,
  fetchServerMetricsHistory,
  updateServerConfig,
  applyServerConfig,
  fetchImageDefaults,
  getServerStorage,
  type CreateServerRequest,
  type MetricsTimeRange,
} from '../lib/api';
import { getToken } from '../lib/auth';
import { useUser } from '../contexts/UserContext';

/**
 * Hook to fetch ALL servers across all agents (global view)
 */
export function useAllServers() {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['servers', 'all'],
    queryFn: async () => {
      const token = getToken();
      const response = await fetch('/api/servers', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch servers');
      }

      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}

/**
 * Hook to fetch a single server by ID (global endpoint)
 */
export function useServerById(serverId: string | null) {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['server', serverId],
    queryFn: async () => {
      const token = getToken();
      const response = await fetch(`/api/servers/${serverId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Server not found');
        }
        throw new Error('Failed to fetch server');
      }

      return response.json();
    },
    enabled: isAuthenticated && !!serverId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}

/**
 * Hook to fetch servers for a specific agent
 */
export function useServers(agentId: string | null) {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['servers', agentId],
    queryFn: () => fetchServers(agentId!),
    enabled: isAuthenticated && !!agentId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}

/**
 * Hook to create a server
 */
export function useCreateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      request,
    }: {
      agentId: string;
      request: CreateServerRequest;
    }) => createServer(agentId, request),
    onSuccess: (_, variables) => {
      // Invalidate both servers and containers queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to delete a server
 */
export function useDeleteServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
      removeVolumes,
    }: {
      agentId: string;
      serverId: string;
      removeVolumes: boolean;
    }) => deleteServer(agentId, serverId, removeVolumes),
    onSuccess: (_, variables) => {
      // Invalidate both servers and containers queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to rebuild a server (pull latest image, recreate container)
 */
export function useRebuildServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
    }: {
      agentId: string;
      serverId: string;
    }) => rebuildServer(agentId, serverId),
    onSuccess: (_, variables) => {
      // Invalidate both servers and containers queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to cleanup all failed servers for an agent
 */
export function useCleanupFailedServers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      removeVolumes,
    }: {
      agentId: string;
      removeVolumes: boolean;
    }) => cleanupFailedServers(agentId, removeVolumes),
    onSuccess: (_, variables) => {
      // Invalidate both servers and containers queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to start a server (with container recreation if missing)
 */
export function useStartServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
    }: {
      agentId: string;
      serverId: string;
    }) => startServer(agentId, serverId),
    onSuccess: (_, variables) => {
      // Invalidate both servers and containers queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to stop a server
 */
export function useStopServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
    }: {
      agentId: string;
      serverId: string;
    }) => stopServer(agentId, serverId),
    onSuccess: (_, variables) => {
      // Invalidate both servers and containers queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to purge a server (hard delete)
 */
export function usePurgeServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
      removeData,
    }: {
      agentId: string;
      serverId: string;
      removeData: boolean;
    }) => purgeServer(agentId, serverId, removeData),
    onSuccess: (_, variables) => {
      // Invalidate all server queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['servers', 'all'], // IMPORTANT: For global server list (ServerList page)
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to restore a soft-deleted server
 */
export function useRestoreServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
    }: {
      agentId: string;
      serverId: string;
    }) => restoreServer(agentId, serverId),
    onSuccess: (_, variables) => {
      // Invalidate both servers and containers queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to sync server statuses with agent
 */
export function useSyncServers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId }: { agentId: string }) => syncServers(agentId),
    onSuccess: (_, variables) => {
      // Invalidate both servers and containers queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to fetch server metrics (CPU, memory, disk, uptime)
 */
export function useServerMetrics(
  agentId: string | null,
  serverId: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['server-metrics', agentId, serverId],
    queryFn: () => {
      if (!agentId || !serverId) {
        throw new Error('Agent ID and Server ID are required');
      }
      return fetchServerMetrics(agentId, serverId);
    },
    enabled: enabled && !!agentId && !!serverId,
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: 1, // Only retry once on failure
    staleTime: 4000, // Consider data stale after 4 seconds
  });
}

/**
 * Hook to update server configuration (Save step - no restart)
 * M9.8.32: Added image parameter for per-server registry override
 */
export function useUpdateServerConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
      config,
      imageTag,
      serverDataPath,
      image,  // M9.8.32: Per-server registry override
    }: {
      agentId: string;
      serverId: string;
      config: Record<string, string>;
      imageTag?: string;
      serverDataPath?: string | null;
      image?: string | null;  // M9.8.32
    }) => updateServerConfig(agentId, serverId, config, imageTag, serverDataPath, image),
    onSuccess: (_, variables) => {
      // Invalidate server queries to refetch updated data
      queryClient.invalidateQueries({
        queryKey: ['server', variables.serverId],
      });
      queryClient.invalidateQueries({
        queryKey: ['servers', 'all'],
      });
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to apply server configuration changes (restart container with new config)
 */
export function useApplyServerConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
      oldDataPath,
    }: {
      agentId: string;
      serverId: string;
      oldDataPath?: string; // M9.8.29: For data migration
    }) => applyServerConfig(agentId, serverId, oldDataPath),
    onSuccess: (_, variables) => {
      // Invalidate all relevant queries to refetch updated data
      queryClient.invalidateQueries({
        queryKey: ['server', variables.serverId],
      });
      queryClient.invalidateQueries({
        queryKey: ['servers', 'all'],
      });
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to fetch Docker image default ENV variables
 * Queries agent to inspect image and return default values
 * Results are cached for 1 hour (image defaults rarely change)
 */
export function useImageDefaults(agentId: string | null, imageTag: string | null) {
  return useQuery({
    queryKey: ['image-defaults', agentId, imageTag],
    queryFn: () => {
      if (!agentId || !imageTag) {
        throw new Error('Agent ID and image tag are required');
      }
      return fetchImageDefaults(agentId, imageTag);
    },
    enabled: !!agentId && !!imageTag,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: 1, // Only retry once (agent might be offline)
  });
}

/**
 * Hook to fetch storage consumption for a server's bin/ and data/ directories
 * Results are cached for 5 minutes (matches agent-side cache TTL)
 */
export function useServerStorage(
  agentId: string | null,
  serverId: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['server-storage', agentId, serverId],
    queryFn: async () => {
      if (!agentId || !serverId) {
        throw new Error('Agent ID and server ID are required');
      }
      console.log(`[useServerStorage] Fetching storage for agent=${agentId}, server=${serverId}`);
      try {
        const result = await getServerStorage(agentId, serverId);
        console.log(`[useServerStorage] Result:`, result);
        return result;
      } catch (err) {
        console.error(`[useServerStorage] Error:`, err);
        throw err;
      }
    },
    enabled: enabled && !!agentId && !!serverId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes (matches agent cache)
    retry: 1, // Only retry once (agent might be offline)
  });
}

/**
 * Hook to fetch metrics history for sparkline display and Performance tab
 * @param serverId - Server ID to fetch history for
 * @param range - Time range: '30m' | '3h' | '12h' | '24h' | '3d'
 * @param enabled - Whether to enable the query (e.g., only for running servers)
 */
export function useServerMetricsHistory(
  serverId: string | null,
  range: MetricsTimeRange = '30m',
  enabled: boolean = true
) {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['server-metrics-history', serverId, range],
    queryFn: () => {
      if (!serverId) {
        throw new Error('Server ID is required');
      }
      return fetchServerMetricsHistory(serverId, range);
    },
    enabled: isAuthenticated && enabled && !!serverId,
    refetchInterval: 10000, // Refresh every 10 seconds (matches agent collection)
    staleTime: 9000, // Consider stale after 9 seconds
    retry: 1,
  });
}
