/**
 * Custom hook for fetching agents using TanStack Query
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAgents } from '../lib/api';
import { useUser } from '../contexts/UserContext';

export function useAgents() {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['agents'],
    queryFn: () => fetchAgents(),
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}
