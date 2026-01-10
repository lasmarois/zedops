/**
 * Custom hook for fetching containers for a specific agent using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchContainers,
  startContainer,
  stopContainer,
  restartContainer,
} from '../lib/api';
import { useAuthStore } from '../stores/authStore';

/**
 * Hook to fetch containers for a specific agent
 */
export function useContainers(agentId: string | null) {
  const password = useAuthStore((state) => state.password);

  return useQuery({
    queryKey: ['containers', agentId],
    queryFn: () => fetchContainers(agentId!, password!),
    enabled: !!password && !!agentId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}

/**
 * Hook to start a container
 */
export function useStartContainer() {
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      containerId,
    }: {
      agentId: string;
      containerId: string;
    }) => startContainer(agentId, containerId, password!),
    onSuccess: (_, variables) => {
      // Invalidate containers query to refetch
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
    },
  });
}

/**
 * Hook to stop a container
 */
export function useStopContainer() {
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      containerId,
    }: {
      agentId: string;
      containerId: string;
    }) => stopContainer(agentId, containerId, password!),
    onSuccess: (_, variables) => {
      // Invalidate containers query to refetch
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
    },
  });
}

/**
 * Hook to restart a container
 */
export function useRestartContainer() {
  const password = useAuthStore((state) => state.password);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      containerId,
    }: {
      agentId: string;
      containerId: string;
    }) => restartContainer(agentId, containerId, password!),
    onSuccess: (_, variables) => {
      // Invalidate containers query to refetch
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
    },
  });
}
