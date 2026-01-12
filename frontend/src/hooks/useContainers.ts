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
import { useUser } from '../contexts/UserContext';

/**
 * Hook to fetch containers for a specific agent
 */
export function useContainers(agentId: string | null) {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['containers', agentId],
    queryFn: () => fetchContainers(agentId!),
    enabled: isAuthenticated && !!agentId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}

/**
 * Hook to start a container
 */
export function useStartContainer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      containerId,
    }: {
      agentId: string;
      containerId: string;
    }) => startContainer(agentId, containerId),
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      containerId,
    }: {
      agentId: string;
      containerId: string;
    }) => stopContainer(agentId, containerId),
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      containerId,
    }: {
      agentId: string;
      containerId: string;
    }) => restartContainer(agentId, containerId),
    onSuccess: (_, variables) => {
      // Invalidate containers query to refetch
      queryClient.invalidateQueries({
        queryKey: ['containers', variables.agentId],
      });
    },
  });
}
