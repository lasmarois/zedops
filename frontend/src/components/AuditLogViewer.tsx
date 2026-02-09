/**
 * Audit log viewer component
 */

import { useState, useMemo } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { useUsers } from '../hooks/useUsers';
import { useAllServers } from '../hooks/useServers';
import { useAgents } from '../hooks/useAgents';
import type { AuditLogsQuery } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CompactAuditLog, type AuditLogEntry } from '@/components/ui/compact-audit-log';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AuditLogViewerProps {
  onBack: () => void;
}

export function AuditLogViewer({ onBack }: AuditLogViewerProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState<Omit<AuditLogsQuery, 'page' | 'pageSize'>>({});
  const [showFilters, setShowFilters] = useState(false);

  const query: AuditLogsQuery = {
    page,
    pageSize,
    ...filters,
  };

  const { data, isLoading, error } = useAuditLogs(query);
  const { data: usersData } = useUsers();
  const { data: serversData } = useAllServers();
  const { data: agentsData } = useAgents();

  // Create lookup maps for ID -> name resolution
  const nameLookup = useMemo(() => {
    const lookup: Record<string, string> = {};

    // Add servers
    if (serversData?.servers) {
      for (const server of serversData.servers) {
        lookup[server.id] = server.name;
      }
    }

    // Add users
    if (usersData?.users) {
      for (const user of usersData.users) {
        lookup[user.id] = user.email.split('@')[0];
      }
    }

    // Add agents
    if (agentsData?.agents) {
      for (const agent of agentsData.agents) {
        lookup[agent.id] = agent.name;
      }
    }

    return lookup;
  }, [serversData, usersData, agentsData]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value || undefined,
    }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDateRelative = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  // Helper to check if a string looks like a UUID
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  // Helper to resolve IDs in details object
  const resolveDetails = (details: Record<string, unknown>): Record<string, string> => {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === 'string') {
        // If it looks like a UUID, try to resolve it
        if (isUuid(value) && nameLookup[value]) {
          resolved[key] = nameLookup[value];
        } else {
          resolved[key] = value;
        }
      } else if (value !== null && value !== undefined) {
        resolved[key] = String(value);
      }
    }
    return resolved;
  };

  // Transform audit logs to compact entries
  const auditEntries: AuditLogEntry[] = data?.logs.map(log => {
    const rawDetails = log.details
      ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details)
      : {};

    // Resolve target name: try details first, then lookup by ID, fallback to ID
    const targetId = log.target_id || '';

    // Find name from details by checking all keys that might contain a name
    const findNameInDetails = (obj: Record<string, unknown>): string => {
      const nameKeys = ['name', 'servername', 'server_name', 'username', 'user_name', 'agentname', 'agent_name'];
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (nameKeys.includes(lowerKey) && typeof value === 'string' && value) {
          // If the value is a UUID, resolve it through nameLookup
          if (isUuid(value)) {
            return nameLookup[value] || value;
          }
          return value;
        }
      }
      return '';
    };

    const detailsName = findNameInDetails(rawDetails as Record<string, unknown>);
    const targetName = detailsName || nameLookup[targetId] || targetId;

    // Build clean details object with resolved IDs
    const resolvedDetails = resolveDetails(rawDetails);

    return {
      id: log.id,
      timestamp: formatDateRelative(log.timestamp),
      user: log.user_email.split('@')[0],
      action: log.action,
      targetType: log.target_type || '',
      targetName: targetName,
      details: {
        'Timestamp': formatDate(log.timestamp),
        'IP Address': log.ip_address,
        ...resolvedDetails,
      },
    };
  }) || [];

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 md:mb-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-[80px]" />
            <Skeleton className="h-9 w-[200px]" />
          </div>
          <Skeleton className="h-10 w-[120px]" />
        </div>
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-5 w-[200px]" />
          <div className="flex gap-2 items-center">
            <Skeleton className="h-9 w-[80px]" />
            <Skeleton className="h-5 w-[120px]" />
            <Skeleton className="h-9 w-[80px]" />
          </div>
        </div>
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Error: {error.message}</AlertDescription>
        </Alert>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onBack}>
            ← Back
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Audit Logs</h1>
        </div>
        <Button onClick={() => setShowFilters(!showFilters)} className="self-start sm:self-auto">
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      {showFilters && (
        <div className="bg-[#2d2d2d] p-6 rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-4 mt-0">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userId" className="text-gray-300">
                User
              </Label>
              <Select
                value={filters.userId || 'all'}
                onValueChange={(val) => handleFilterChange('userId', val)}
              >
                <SelectTrigger id="userId" className="bg-[#1a1a1a] border-[#444] text-white">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {usersData?.users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="action" className="text-gray-300">
                Action
              </Label>
              <Select
                value={filters.action || 'all'}
                onValueChange={(val) => handleFilterChange('action', val)}
              >
                <SelectTrigger id="action" className="bg-[#1a1a1a] border-[#444] text-white">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="user_login">User Login</SelectItem>
                  <SelectItem value="user_logout">User Logout</SelectItem>
                  <SelectItem value="user_created">User Created</SelectItem>
                  <SelectItem value="user_deleted">User Deleted</SelectItem>
                  <SelectItem value="permission_granted">Permission Granted</SelectItem>
                  <SelectItem value="permission_revoked">Permission Revoked</SelectItem>
                  <SelectItem value="server_created">Server Created</SelectItem>
                  <SelectItem value="server_deleted">Server Deleted</SelectItem>
                  <SelectItem value="server_started">Server Started</SelectItem>
                  <SelectItem value="server_stopped">Server Stopped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetType" className="text-gray-300">
                Target Type
              </Label>
              <Select
                value={filters.targetType || 'all'}
                onValueChange={(val) => handleFilterChange('targetType', val)}
              >
                <SelectTrigger id="targetType" className="bg-[#1a1a1a] border-[#444] text-white">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="server">Server</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="permission">Permission</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button variant="secondary" onClick={clearFilters} className="mt-4">
            Clear Filters
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <p className="text-muted-foreground">
          Showing {data?.logs.length || 0} of {data?.total || 0} logs
        </p>
        {totalPages > 1 && (
          <div className="flex gap-2 items-center">
            <Button
              size="sm"
              className="min-h-[44px] sm:min-h-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              className="min-h-[44px] sm:min-h-0"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {auditEntries.length > 0 ? (
        <CompactAuditLog entries={auditEntries} />
      ) : (
        <div className="text-center p-8 bg-muted rounded-md">
          No audit logs found.
        </div>
      )}
    </div>
  );
}
