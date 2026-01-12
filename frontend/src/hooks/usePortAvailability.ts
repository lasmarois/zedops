/**
 * Custom hook for checking port availability using TanStack Query
 */

import { useQuery } from '@tanstack/react-query';
import { checkPortAvailability } from '../lib/api';
import { useUser } from '../contexts/UserContext';

/**
 * Hook to check port availability for a specific agent
 *
 * @param agentId - Agent ID to check ports for
 * @param count - Number of suggested port sets to return (default: 3)
 * @param enabled - Whether to automatically fetch (default: false, requires manual trigger)
 */
export function usePortAvailability(
  agentId: string | null,
  count: number = 3,
  enabled: boolean = false
) {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['portAvailability', agentId, count],
    queryFn: () => checkPortAvailability(agentId!, count),
    enabled: isAuthenticated && !!agentId && enabled,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  });
}
