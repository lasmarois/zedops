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
  type CreateServerRequest,
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
