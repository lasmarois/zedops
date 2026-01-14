/**
 * Agent Server List component - displays and manages servers for a specific agent
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useContainers,
  useStartContainer,
  useStopContainer,
  useRestartContainer,
} from '../hooks/useContainers';
import { useServers, useCreateServer, useDeleteServer, useRebuildServer, useCleanupFailedServers, useStartServer, usePurgeServer, useRestoreServer, useSyncServers } from '../hooks/useServers';
import { ServerForm } from './ServerForm';
import { RconTerminal } from './RconTerminal';
import type { Container, CreateServerRequest, Server } from '../lib/api';
import { getDisplayStatus } from '../lib/server-status';
import { Button } from '@/components/ui/button';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Play, Square, RotateCw, Wrench, Trash2, Terminal, Gamepad2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AgentServerListProps {
  agentId: string;
  agentName: string;
  onBack: () => void;
  onViewLogs: (containerId: string, containerName: string) => void;
}

export function AgentServerList({ agentId, agentName, onBack, onViewLogs }: AgentServerListProps) {
  const { data, isLoading, error } = useContainers(agentId);
  const { data: serversData } = useServers(agentId);
  const startMutation = useStartContainer();
  const stopMutation = useStopContainer();
  const restartMutation = useRestartContainer();
  const createServerMutation = useCreateServer();
  const deleteServerMutation = useDeleteServer();
  const rebuildServerMutation = useRebuildServer();
  const cleanupFailedServersMutation = useCleanupFailedServers();
  const startServerMutation = useStartServer();
  const purgeServerMutation = usePurgeServer();
  const restoreServerMutation = useRestoreServer();
  const syncServersMutation = useSyncServers();
  const navigate = useNavigate();

  const [operationStatus, setOperationStatus] = useState<{
    containerId: string;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const [showServerForm, setShowServerForm] = useState(false);
  const [editServer, setEditServer] = useState<Server | undefined>(undefined);
  const [serverMessage, setServerMessage] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [showDeletedServers, setShowDeletedServers] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState<{ serverId: string; serverName: string } | null>(null);
  const [rconServer, setRconServer] = useState<Server | null>(null);

  // Automatic sync detection - detects when containers are deleted via docker rm
  const lastSyncRef = useRef<{ [serverId: string]: number }>({});

  useEffect(() => {
    if (!data || !serversData || syncServersMutation.isPending) return;

    const now = Date.now();
    const containers = data.containers;
    const servers = serversData.servers;

    console.log('[Auto-sync] Checking for mismatches...', {
      containerCount: containers.length,
      serverCount: servers.length,
      containerIds: containers.map(c => c.id.substring(0, 12)),
      servers: servers.map(s => ({ name: s.name, status: s.status, containerId: s.container_id?.substring(0, 12) }))
    });

    // Find servers with container state mismatches
    const missingContainers = servers.filter(server => {
      // Skip transient states
      if (['creating', 'deleting', 'deleted'].includes(server.status)) {
        return false;
      }

      if (!server.container_id) {
        return false; // Server never had a container
      }

      const container = containers.find(c => c.id === server.container_id);

      // Case 1: Container deleted (missing from list)
      if (!container) {
        console.log(`[Auto-sync] Server ${server.name}: container DELETED (status=${server.status}, containerId=${server.container_id.substring(0, 12)})`);
        return true;
      }

      // Case 2: Status mismatch (e.g., server='running' but container='exited')
      if (server.status === 'running' && (container.state === 'exited' || container.state === 'stopped')) {
        console.log(`[Auto-sync] Server ${server.name}: status mismatch (server='running', container='${container.state}')`);
        return true;
      }

      if (server.status === 'stopped' && container.state === 'running') {
        console.log(`[Auto-sync] Server ${server.name}: status mismatch (server='stopped', container='running')`);
        return true;
      }

      return false;
    });

    // Trigger sync if discrepancies found
    if (missingContainers.length > 0) {
      // Check if we recently synced for these servers (within 10s)
      const needsSync = missingContainers.some(server => {
        const lastSync = lastSyncRef.current[server.id] || 0;
        return now - lastSync > 10000; // 10 second debounce
      });

      if (needsSync) {
        console.log('Auto-sync triggered for', missingContainers.length, 'servers');
        syncServersMutation.mutateAsync({ agentId }).then(() => {
          // Mark all as synced
          missingContainers.forEach(server => {
            lastSyncRef.current[server.id] = now;
          });
        }).catch(err => {
          console.error('Auto-sync failed:', err);
        });
      }
    }
  }, [data, serversData, agentId, syncServersMutation]);

  const handleStart = async (containerId: string) => {
    try {
      const result = await startMutation.mutateAsync({ agentId, containerId });
      if (result.success) {
        setOperationStatus({
          containerId,
          message: 'Container started successfully',
          type: 'success',
        });
      } else {
        setOperationStatus({
          containerId,
          message: result.error || 'Failed to start container',
          type: 'error',
        });
      }
      setTimeout(() => setOperationStatus(null), 3000);
    } catch (error) {
      setOperationStatus({
        containerId,
        message: error instanceof Error ? error.message : 'Failed to start container',
        type: 'error',
      });
      setTimeout(() => setOperationStatus(null), 3000);
    }
  };

  const handleStop = async (containerId: string) => {
    try {
      const result = await stopMutation.mutateAsync({ agentId, containerId });
      if (result.success) {
        setOperationStatus({
          containerId,
          message: 'Container stopped successfully',
          type: 'success',
        });
      } else {
        setOperationStatus({
          containerId,
          message: result.error || 'Failed to stop container',
          type: 'error',
        });
      }
      setTimeout(() => setOperationStatus(null), 3000);
    } catch (error) {
      setOperationStatus({
        containerId,
        message: error instanceof Error ? error.message : 'Failed to stop container',
        type: 'error',
      });
      setTimeout(() => setOperationStatus(null), 3000);
    }
  };

  const handleRestart = async (containerId: string) => {
    try {
      const result = await restartMutation.mutateAsync({ agentId, containerId });
      if (result.success) {
        setOperationStatus({
          containerId,
          message: 'Container restarted successfully',
          type: 'success',
        });
      } else {
        setOperationStatus({
          containerId,
          message: result.error || 'Failed to restart container',
          type: 'error',
        });
      }
      setTimeout(() => setOperationStatus(null), 3000);
    } catch (error) {
      setOperationStatus({
        containerId,
        message: error instanceof Error ? error.message : 'Failed to restart container',
        type: 'error',
      });
      setTimeout(() => setOperationStatus(null), 3000);
    }
  };

  const getContainerName = (container: Container): string => {
    if (container.names.length > 0) {
      // Remove leading "/" from Docker container names
      return container.names[0].replace(/^\//, '');
    }
    return container.id.substring(0, 12);
  };

  const getStateVariant = (state: string): 'success' | 'error' | 'warning' | 'info' | 'muted' => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'success';
      case 'exited':
        return 'error';
      case 'paused':
        return 'warning';
      case 'restarting':
        return 'info';
      default:
        return 'muted';
    }
  };

  const handleCreateServer = async (request: CreateServerRequest, serverIdToDelete?: string) => {
    try {
      // If editing (retrying a failed server), delete the old failed entry first
      if (serverIdToDelete) {
        await deleteServerMutation.mutateAsync({
          agentId,
          serverId: serverIdToDelete,
          removeVolumes: false, // Keep volumes for retry
        });
      }

      const result = await createServerMutation.mutateAsync({ agentId, request });
      if (result.success) {
        setServerMessage({
          message: serverIdToDelete
            ? `Server "${request.name}" retried successfully! Starting container...`
            : `Server "${request.name}" created successfully! Starting container...`,
          type: 'success',
        });
        setShowServerForm(false);
        setEditServer(undefined);
        setTimeout(() => setServerMessage(null), 5000);
      } else {
        setServerMessage({
          message: result.error || 'Failed to create server',
          type: 'error',
        });
        setTimeout(() => setServerMessage(null), 5000);
      }
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to create server',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 5000);
    }
  };

  const handleEditServer = (server: Server) => {
    setEditServer(server);
    setShowServerForm(true);
  };

  const handleCleanupFailedServers = async () => {
    const failedCount = serversData?.servers.filter(s => s.status === 'failed').length || 0;
    if (failedCount === 0) {
      alert('No failed servers to clean up');
      return;
    }

    if (!confirm(`Clean up ${failedCount} failed server(s)? Containers will be removed but data will be preserved.`)) {
      return;
    }

    try {
      const result = await cleanupFailedServersMutation.mutateAsync({
        agentId,
        removeVolumes: false,
      });

      setServerMessage({
        message: result.message,
        type: 'success',
      });
      setTimeout(() => setServerMessage(null), 5000);
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to cleanup failed servers',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 5000);
    }
  };


  const handleDeleteServer = async (serverId: string, serverName: string) => {
    if (!confirm(`Delete server "${serverName}"? Container will be removed but data will be preserved.`)) {
      return;
    }

    try {
      const result = await deleteServerMutation.mutateAsync({
        agentId,
        serverId,
        removeVolumes: false,
      });
      if (result.success) {
        setServerMessage({
          message: result.message || 'Server deleted successfully',
          type: 'success',
        });
        setTimeout(() => setServerMessage(null), 5000);
      } else {
        setServerMessage({
          message: result.error || 'Failed to delete server',
          type: 'error',
        });
        setTimeout(() => setServerMessage(null), 5000);
      }
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to delete server',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 5000);
    }
  };

  const handleRebuildServer = async (serverId: string, serverName: string) => {
    if (!confirm(`Rebuild server "${serverName}"? This will pull the latest image and recreate the container. Game data will be preserved.`)) {
      return;
    }

    try {
      const result = await rebuildServerMutation.mutateAsync({
        agentId,
        serverId,
      });
      if (result.success) {
        setServerMessage({
          message: result.message || 'Server rebuilt successfully',
          type: 'success',
        });
        setTimeout(() => setServerMessage(null), 5000);
      } else {
        setServerMessage({
          message: 'Failed to rebuild server',
          type: 'error',
        });
        setTimeout(() => setServerMessage(null), 5000);
      }
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to rebuild server',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 5000);
    }
  };

  const handleServerStart = async (serverId: string, serverName: string) => {
    try {
      const result = await startServerMutation.mutateAsync({ agentId, serverId });

      // Trigger a sync to update server status immediately
      try {
        await syncServersMutation.mutateAsync({ agentId });
      } catch (syncError) {
        console.warn('Failed to sync after server start:', syncError);
        // Don't fail the whole operation if sync fails
      }

      setServerMessage({
        message: result.recovered
          ? `Server "${serverName}" container recreated and started successfully`
          : `Server "${serverName}" started successfully`,
        type: 'success',
      });
      setTimeout(() => setServerMessage(null), 5000);
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to start server',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 5000);
    }
  };

  const handleServerPurge = async (serverId: string, serverName: string, removeData: boolean) => {
    try {
      await purgeServerMutation.mutateAsync({ agentId, serverId, removeData });
      setServerMessage({
        message: removeData
          ? `Server "${serverName}" permanently deleted (data removed)`
          : `Server "${serverName}" permanently deleted (data preserved on host)`,
        type: 'success',
      });
      setTimeout(() => setServerMessage(null), 5000);
      setConfirmPurge(null);
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to purge server',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 5000);
      setConfirmPurge(null);
    }
  };

  const handleServerRestore = async (serverId: string, serverName: string) => {
    try {
      await restoreServerMutation.mutateAsync({ agentId, serverId });
      setServerMessage({
        message: `Server "${serverName}" restored successfully. Click Start to recreate container.`,
        type: 'success',
      });
      setTimeout(() => setServerMessage(null), 5000);
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to restore server',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 5000);
    }
  };

  const handleSyncServers = async () => {
    try {
      const result = await syncServersMutation.mutateAsync({ agentId });
      setServerMessage({
        message: `Synced ${result.synced} server(s) successfully`,
        type: 'success',
      });
      setTimeout(() => setServerMessage(null), 3000);
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to sync servers',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 5000);
    }
  };

  const getServerStatusBadge = (server: Server): { variant: 'success' | 'muted' | 'info' | 'warning' | 'error'; text: string } => {
    // Use shared status display logic that considers agent connectivity
    const displayStatus = getDisplayStatus(server);

    // Map our display variant types to StatusBadge variant types
    const variantMap: Record<string, 'success' | 'muted' | 'info' | 'warning' | 'error'> = {
      success: 'success',
      muted: 'muted',
      info: 'info',
      warning: 'warning',
      error: 'error',
    };

    // Add icons based on status
    const iconMap: Record<string, string> = {
      running: '✓ ',
      stopped: '⏸ ',
      creating: '⏳ ',
      deleting: '⏳ ',
      failed: '❌ ',
      deleted: '🗑️ ',
      agent_offline: '⚠️ ',
      missing: '⚠️ ',
    };

    const icon = iconMap[displayStatus.status] || '';

    return {
      variant: variantMap[displayStatus.variant] || 'muted',
      text: `${icon}${displayStatus.label}`,
    };
  };

  // Removed isOperationPending() - now using per-container scoped checks
  // e.g., startMutation.isPending && startMutation.variables?.containerId === container.id

  const getServerFromContainerId = (containerId: string): Server | undefined => {
    return serversData?.servers.find((s) => s.container_id === containerId);
  };

  // Unified data structure for containers and servers
  type UnifiedItem = {
    id: string;
    type: 'managed' | 'unmanaged';
    name: string;
    status: string;
    container?: Container;
    server?: Server;
    isIssue: boolean; // true for missing/deleted servers
  };

  const getUnifiedList = (): { normal: UnifiedItem[]; issues: UnifiedItem[] } => {
    const unified: UnifiedItem[] = [];
    const issues: UnifiedItem[] = [];

    // Add all containers (both managed and unmanaged)
    data?.containers.forEach((container) => {
      const server = getServerFromContainerId(container.id);

      if (server) {
        // Managed server with container
        // Only include if not in issue state (missing, deleted)
        if (server.status !== 'missing' && server.status !== 'deleted') {
          unified.push({
            id: server.id,
            type: 'managed',
            name: server.name,
            status: server.status,
            container,
            server,
            isIssue: false,
          });
        }
      } else {
        // Unmanaged container
        unified.push({
          id: container.id,
          type: 'unmanaged',
          name: getContainerName(container),
          status: container.state,
          container,
          isIssue: false,
        });
      }
    });

    // Add managed servers without containers (missing, deleted, creating, failed)
    serversData?.servers.forEach((server) => {
      // Skip if already added (has container)
      const hasContainer = data?.containers.some((c) => c.id === server.container_id);
      if (hasContainer && server.status !== 'missing' && server.status !== 'deleted') {
        return; // Already in the list
      }

      // Separate missing and deleted into issues
      if (server.status === 'missing' || (server.status === 'deleted' && showDeletedServers)) {
        issues.push({
          id: server.id,
          type: 'managed',
          name: server.name,
          status: server.status,
          server,
          isIssue: true,
        });
      } else if (server.status !== 'deleted') {
        // Normal managed server without container (creating, failed, etc.)
        unified.push({
          id: server.id,
          type: 'managed',
          name: server.name,
          status: server.status,
          server,
          isIssue: false,
        });
      }
    });

    // Sort: managed first, then unmanaged
    unified.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'managed' ? -1 : 1;
    });

    return { normal: unified, issues };
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Button variant="secondary" onClick={onBack} className="mb-4">
              ← Back to Agents
            </Button>
            <Skeleton className="h-9 w-[300px]" />
          </div>
          <Skeleton className="h-12 w-[150px]" />
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Skeleton className="h-9 w-[60px]" />
                      <Skeleton className="h-9 w-[80px]" />
                      <Skeleton className="h-9 w-[70px]" />
                    </div>
                  </TableCell>
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
        <Button variant="secondary" onClick={onBack} className="mb-8">
          ← Back to Agents
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            Error: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Button variant="secondary" onClick={onBack} className="mb-4">
            ← Back to Agents
          </Button>
          <h1 className="text-3xl font-bold">Zomboid Servers on {agentName}</h1>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setShowServerForm(true)} size="lg">
            + Create Server
          </Button>
          {serversData && serversData.servers.some(s => s.status === 'failed') && (
            <Button
              variant="warning"
              onClick={handleCleanupFailedServers}
              disabled={cleanupFailedServersMutation.isPending}
              size="lg"
            >
              {cleanupFailedServersMutation.isPending
                ? 'Cleaning...'
                : `🧹 Clean Up Failed Servers (${serversData.servers.filter(s => s.status === 'failed').length})`}
            </Button>
          )}
        </div>
      </div>

      {serverMessage && (
        <Alert variant={serverMessage.type === 'success' ? 'success' : 'destructive'} className="mb-4">
          <AlertDescription>{serverMessage.message}</AlertDescription>
        </Alert>
      )}

      {(() => {
        const { normal, issues } = getUnifiedList();
        const managedCount = normal.filter(item => item.type === 'managed').length;
        const unmanagedCount = normal.filter(item => item.type === 'unmanaged').length;

        return (
          <>
            <div className="mb-4 flex items-center gap-2">
              <div>
                <strong>Total:</strong> {normal.length} servers
                <span className="ml-4 text-muted-foreground">
                  ({managedCount} managed, {unmanagedCount} unmanaged)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSyncServers}
                disabled={syncServersMutation.isPending}
                className="h-8 w-8 p-0"
                title="Sync server status"
              >
                <RotateCw className={`h-4 w-4 ${syncServersMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {normal.length === 0 ? (
              <div className="p-8 text-center bg-muted rounded-md">
                No servers or containers found on this agent
              </div>
            ) : (
              <div className="space-y-3">
                {normal.map((item) => {
                  const isManaged = item.type === 'managed';
                  const container = item.container;
                  const server = item.server;
                  const isRunning = container ? container.state.toLowerCase() === 'running' : server?.status === 'running';

                  // Get border color
                  const getBorderColor = () => {
                    if (container) {
                      switch (container.state.toLowerCase()) {
                        case 'running': return '#22c55e';
                        case 'exited': return '#ef4444';
                        case 'paused': return '#f59e0b';
                        case 'restarting': return '#3b82f6';
                        default: return '#6b7280';
                      }
                    }
                    if (server) {
                      const displayStatus = getDisplayStatus(server);
                      switch (displayStatus.variant) {
                        case 'success': return '#22c55e';
                        case 'error': return '#ef4444';
                        case 'warning': return '#f59e0b';
                        case 'info': return '#3b82f6';
                        default: return '#6b7280';
                      }
                    }
                    return '#6b7280';
                  };

                  // Get status badge
                  const getStatusBadge = () => {
                    if (container) {
                      return <StatusBadge variant={getStateVariant(container.state)} iconOnly>{container.state}</StatusBadge>;
                    }
                    if (server) {
                      const badge = getServerStatusBadge(server);
                      return <StatusBadge variant={badge.variant} iconOnly>{badge.text}</StatusBadge>;
                    }
                    return null;
                  };

                  return (
                    <Card
                      key={item.id}
                      className={`transition-all duration-200 border-l-4 ${
                        isManaged && server
                          ? 'cursor-pointer hover:shadow-lg hover:bg-accent/5 hover:scale-[1.01]'
                          : 'hover:shadow-md'
                      }`}
                      style={{ borderLeftColor: getBorderColor() }}
                      onClick={() => server && navigate(`/servers/${server.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          {/* Left: Badge + Info */}
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {getStatusBadge()}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-lg truncate">{item.name}</div>
                                {isManaged ? (
                                  <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                                    Managed
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-2 text-muted-foreground">
                                    Unmanaged
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {container && container.image}
                                {server && !container && `Game: ${server.game_port} | UDP: ${server.udp_port} | RCON: ${server.rcon_port}`}
                              </div>
                              {container && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {container.status}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Quick Actions + Dropdown */}
                          <div className="flex gap-2 items-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Quick action buttons for containers */}
                            {container && !isRunning && (
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => handleStart(container.id)}
                                disabled={startMutation.isPending && startMutation.variables?.containerId === container.id}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Start
                              </Button>
                            )}
                            {container && isRunning && (
                              <>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleStop(container.id)}
                                  disabled={stopMutation.isPending && stopMutation.variables?.containerId === container.id}
                                >
                                  <Square className="h-4 w-4 mr-1" />
                                  Stop
                                </Button>
                                <Button
                                  size="sm"
                                  variant="info"
                                  onClick={() => handleRestart(container.id)}
                                  disabled={restartMutation.isPending && restartMutation.variables?.containerId === container.id}
                                >
                                  <RotateCw className="h-4 w-4 mr-1" />
                                  Restart
                                </Button>
                              </>
                            )}

                            {/* Quick action buttons for servers without containers */}
                            {server && !container && (
                              <>
                                {server.status === 'stopped' && (
                                  <Button
                                    size="sm"
                                    variant="success"
                                    onClick={() => handleServerStart(server.id, server.name)}
                                    disabled={startServerMutation.isPending && startServerMutation.variables?.serverId === server.id}
                                  >
                                    <Play className="h-4 w-4 mr-1" />
                                    Start
                                  </Button>
                                )}
                                {server.status === 'failed' && (
                                  <Button
                                    size="sm"
                                    variant="warning"
                                    onClick={() => {
                                      setEditServer(server);
                                      setShowServerForm(true);
                                    }}
                                  >
                                    <Wrench className="h-4 w-4 mr-1" />
                                    Edit & Retry
                                  </Button>
                                )}
                              </>
                            )}

                            {/* More Actions Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {/* View Logs - always available if container exists */}
                                {container && (
                                  <DropdownMenuItem onClick={() => onViewLogs(container.id, item.name)}>
                                    <Terminal className="h-4 w-4 mr-2" />
                                    View Logs
                                  </DropdownMenuItem>
                                )}

                                {/* Managed server actions */}
                                {isManaged && server && (
                                  <>
                                    {isRunning && container && (
                                      <DropdownMenuItem onClick={() => setRconServer(server)}>
                                        <Gamepad2 className="h-4 w-4 mr-2" />
                                        RCON
                                      </DropdownMenuItem>
                                    )}
                                    {server.status === 'running' && (
                                      <DropdownMenuItem
                                        onClick={() => handleRebuildServer(server.id, server.name)}
                                        disabled={rebuildServerMutation.isPending && rebuildServerMutation.variables?.serverId === server.id}
                                      >
                                        <Wrench className="h-4 w-4 mr-2" />
                                        Rebuild
                                      </DropdownMenuItem>
                                    )}
                                    {server.status === 'failed' && !container && (
                                      <DropdownMenuItem onClick={() => handleEditServer(server)}>
                                        <Wrench className="h-4 w-4 mr-2" />
                                        Edit & Retry
                                      </DropdownMenuItem>
                                    )}

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDeleteServer(server.id, server.name)}
                                      disabled={deleteServerMutation.isPending && deleteServerMutation.variables?.serverId === server.id}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Server
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Operation status feedback */}
                        {container && operationStatus && operationStatus.containerId === container.id && (
                          <Alert variant={operationStatus.type === 'success' ? 'success' : 'destructive'} className="mt-3">
                            <AlertDescription className="text-xs">{operationStatus.message}</AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
        </div>
      )}

            {/* Issues & Recovery Section */}
            {issues.length > 0 && (
              <div className="mt-12">
                <div
                  className="flex justify-between items-center mb-4 cursor-pointer"
                  onClick={() => setShowIssues(!showIssues)}
                >
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    Issues & Recovery
                    <Badge variant="destructive" className="text-xs">
                      {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
                    </Badge>
                  </h2>
                  <Button variant="ghost" size="sm">
                    {showIssues ? '▼ Collapse' : '▶ Expand'}
                  </Button>
                </div>

                {showIssues && (
                  <>
                    <div className="mb-4 flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showDeletedServers}
                          onChange={(e) => setShowDeletedServers(e.target.checked)}
                        />
                        <span className="text-sm">Show Deleted Servers</span>
                      </label>
                    </div>

                    <div className="space-y-3">
                      {issues.map((item) => {
                        const server = item.server!;
                        const badge = getServerStatusBadge(server);

                        const getBorderColor = () => {
                          const displayStatus = getDisplayStatus(server);
                          switch (displayStatus.variant) {
                            case 'success': return '#22c55e';
                            case 'error': return '#ef4444';
                            case 'warning': return '#f59e0b';
                            case 'info': return '#3b82f6';
                            default: return '#6b7280';
                          }
                        };

                        return (
                          <Card
                            key={server.id}
                            className="transition-all duration-200 border-l-4 cursor-pointer hover:shadow-lg hover:bg-accent/5 hover:scale-[1.01]"
                            style={{ borderLeftColor: getBorderColor() }}
                            onClick={() => navigate(`/servers/${server.id}`)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <StatusBadge variant={badge.variant} iconOnly>
                                    {badge.text}
                                  </StatusBadge>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="font-semibold text-lg truncate">{server.name}</div>
                                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                                        Managed
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      Game: {server.game_port} | UDP: {server.udp_port} | RCON: {server.rcon_port}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2 items-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {server.status === 'missing' && server.data_exists && (
                                    <Button
                                      size="sm"
                                      variant="success"
                                      onClick={() => handleServerStart(server.id, server.name)}
                                      disabled={startServerMutation.isPending && startServerMutation.variables?.serverId === server.id}
                                      className="font-bold"
                                    >
                                      <Play className="h-4 w-4 mr-1" />
                                      Start (Recovery)
                                    </Button>
                                  )}

                                  {server.status === 'deleted' && (
                                    <Button
                                      size="sm"
                                      variant="info"
                                      onClick={() => handleServerRestore(server.id, server.name)}
                                      disabled={restoreServerMutation.isPending && restoreServerMutation.variables?.serverId === server.id}
                                    >
                                      Restore
                                    </Button>
                                  )}

                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="ghost">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setConfirmPurge({ serverId: server.id, serverName: server.name })}
                                        disabled={purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Purge Server
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        );
      })()}

      {/* Purge Confirmation Dialog */}
      <Dialog open={!!confirmPurge} onOpenChange={() => setConfirmPurge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">⚠️ Permanent Deletion</DialogTitle>
            <DialogDescription>
              You are about to permanently delete server <strong>"{confirmPurge?.serverName}"</strong>.
              <br /><br />
              This action cannot be undone. The server record will be removed from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmPurge(null)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={() => confirmPurge && handleServerPurge(confirmPurge.serverId, confirmPurge.serverName, false)}
              disabled={purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === confirmPurge?.serverId}
            >
              Keep Data & Purge
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmPurge && handleServerPurge(confirmPurge.serverId, confirmPurge.serverName, true)}
              disabled={purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === confirmPurge?.serverId}
            >
              {purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === confirmPurge?.serverId ? 'Purging...' : 'Remove Data & Purge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showServerForm && (
        <ServerForm
          agentId={agentId}
          onSubmit={handleCreateServer}
          onCancel={() => {
            setShowServerForm(false);
            setEditServer(undefined);
          }}
          isSubmitting={createServerMutation.isPending}
          editServer={editServer}
        />
      )}

      {rconServer && (() => {
        // Parse RCON_PASSWORD from server config
        let rconPassword = '';
        try {
          const config = JSON.parse(rconServer.config);
          rconPassword = config.RCON_PASSWORD || config.ADMIN_PASSWORD || '';
        } catch (err) {
          console.error('Failed to parse server config:', err);
        }

        return (
          <RconTerminal
            agentId={agentId}
            serverId={rconServer.id}
            serverName={rconServer.name}
            containerID={rconServer.container_id || ''}
            rconPort={rconServer.rcon_port}
            rconPassword={rconPassword}
            onClose={() => setRconServer(null)}
          />
        );
      })()}
    </div>
  );
}
