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
  type CreateServerRequest,
} from '../lib/api';
import { useUser } from '../contexts/UserContext';

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
