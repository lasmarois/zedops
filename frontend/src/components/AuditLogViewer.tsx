/**
 * Audit log viewer component
 */

import { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { useUsers } from '../hooks/useUsers';
import type { AuditLogsQuery } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getActionVariant = (action: string): 'destructive' | 'success' | 'warning' | 'default' => {
    if (action.includes('delete') || action.includes('revoke')) return 'destructive';
    if (action.includes('create') || action.includes('grant')) return 'success';
    if (action.includes('update') || action.includes('modify')) return 'warning';
    return 'default';
  };

  // Badge color styling for better contrast (matching AgentList improvements)
  const getActionBadgeStyle = (action: string): string => {
    const variant = getActionVariant(action);
    switch (variant) {
      case 'success':
        return 'bg-green-600 text-white border-green-700';
      case 'warning':
        return 'bg-orange-600 text-white border-orange-700';
      case 'destructive':
        return 'bg-red-700 text-white border-red-800';
      default:
        return ''; // Default variant unchanged
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

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
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-[140px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[110px]" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      {data?.logs && data.logs.length > 0 ? (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </TableCell>
                  <TableCell>{log.user_email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={getActionVariant(log.action) === 'default' ? 'default' : undefined}
                      className={getActionBadgeStyle(log.action)}
                    >
                      {formatAction(log.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {log.target_type && log.target_id ? (
                      <>
                        <span className="text-muted-foreground">{log.target_type}:</span>{' '}
                        {log.target_id.substring(0, 8)}...
                      </>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[300px] overflow-hidden overflow-ellipsis">
                    {log.details || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {log.ip_address}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center p-8 bg-muted rounded-md">
          No audit logs found.
        </div>
      )}
    </div>
  );
}
