/**
 * Audit log viewer component
 */

import { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { useUsers } from '../hooks/useUsers';
import type { AuditLogsQuery } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuditActionColor } from '@/lib/audit-colors';
import { ActivityTimeline, type ActivityEvent } from '@/components/ui/activity-timeline';
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

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
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

  // Transform audit logs to activity events
  const activityEvents: ActivityEvent[] = data?.logs.map(log => {
    const details = log.details
      ? (typeof log.details === 'string' ? JSON.parse(log.details) : log.details)
      : {};
    const targetName = details.name || details.serverName || log.target_id;

    return {
      id: log.id,
      timestamp: formatDateRelative(log.timestamp),
      user: log.user_email.split('@')[0],
      action: log.action.replace(/\./g, ' ').replace(/_/g, ' '),
      target: log.target_type ? `${log.target_type} ${targetName || ''}`.trim() : '',
      actionColor: getAuditActionColor(log.action),
      details: {
        'IP Address': log.ip_address,
        'Full Timestamp': formatDate(log.timestamp),
        ...details,
      },
    };
  }) || [];

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
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
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-20 w-1 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-[60%]" />
                <Skeleton className="h-4 w-[40%]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
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
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onBack}>
            ← Back
          </Button>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
        </div>
        <Button onClick={() => setShowFilters(!showFilters)}>
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
                value={filters.userId || ''}
                onValueChange={(val) => handleFilterChange('userId', val)}
              >
                <SelectTrigger id="userId" className="bg-[#1a1a1a] border-[#444] text-white">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Users</SelectItem>
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
                value={filters.action || ''}
                onValueChange={(val) => handleFilterChange('action', val)}
              >
                <SelectTrigger id="action" className="bg-[#1a1a1a] border-[#444] text-white">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
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
                value={filters.targetType || ''}
                onValueChange={(val) => handleFilterChange('targetType', val)}
              >
                <SelectTrigger id="targetType" className="bg-[#1a1a1a] border-[#444] text-white">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
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

      <div className="flex justify-between items-center mb-4">
        <p className="text-muted-foreground">
          Showing {data?.logs.length || 0} of {data?.total || 0} logs
        </p>
        {totalPages > 1 && (
          <div className="flex gap-2 items-center">
            <Button
              size="sm"
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {activityEvents.length > 0 ? (
        <ActivityTimeline events={activityEvents} />
      ) : (
        <div className="text-center p-8 bg-muted rounded-md">
          No audit logs found.
        </div>
      )}
    </div>
  );
}
