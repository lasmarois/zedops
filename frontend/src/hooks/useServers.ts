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
import { useAuthStore } from '../stores/authStore';

/**
 * Hook to fetch servers for a specific agent
 */
export function useServers(agentId: string | null) {
  const password = useAuthStore((state) => state.password);

  return useQuery({
    queryKey: ['servers', agentId],
    queryFn: () => fetchServers(agentId!, password!),
    enabled: !!password && !!agentId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}

/**
 * Hook to create a server
 */
export function useCreateServer() {
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      request,
    }: {
      agentId: string;
      request: CreateServerRequest;
    }) => createServer(agentId, request, password!),
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
  const password = useAuthStore((state) => state.password);
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
    }) => deleteServer(agentId, serverId, removeVolumes, password!),
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
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
    }: {
      agentId: string;
      serverId: string;
    }) => rebuildServer(agentId, serverId, password!),
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
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      removeVolumes,
    }: {
      agentId: string;
      removeVolumes: boolean;
    }) => cleanupFailedServers(agentId, removeVolumes, password!),
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
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
    }: {
      agentId: string;
      serverId: string;
    }) => startServer(agentId, serverId, password!),
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
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
    }: {
      agentId: string;
      serverId: string;
    }) => stopServer(agentId, serverId, password!),
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
  const password = useAuthStore((state) => state.password);
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
    }) => purgeServer(agentId, serverId, removeData, password!),
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
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
    }: {
      agentId: string;
      serverId: string;
    }) => restoreServer(agentId, serverId, password!),
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
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId }: { agentId: string }) => syncServers(agentId, password!),
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
