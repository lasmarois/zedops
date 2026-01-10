/**
 * Custom hook for server management using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchServers,
  createServer,
  deleteServer,
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
