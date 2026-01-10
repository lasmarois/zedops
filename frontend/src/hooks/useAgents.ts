/**
 * Custom hook for fetching agents using TanStack Query
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAgents } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export function useAgents() {
  const password = useAuthStore((state) => state.password);

  return useQuery({
    queryKey: ['agents'],
    queryFn: () => fetchAgents(password!),
    enabled: !!password,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}
