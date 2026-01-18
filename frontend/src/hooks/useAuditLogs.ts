/**
 * Custom hook for fetching audit logs using TanStack Query
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs, type AuditLogsQuery } from '../lib/api';
import { useUser } from '../contexts/UserContext';

/**
 * Hook to fetch audit logs with optional filters
 */
export function useAuditLogs(query?: AuditLogsQuery) {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['auditLogs', query],
    queryFn: () => fetchAuditLogs(query),
    enabled: isAuthenticated,
    staleTime: 10000, // Consider data stale after 10 seconds
    // No refetchInterval - audit logs are invalidated by mutations that create them
  });
}
