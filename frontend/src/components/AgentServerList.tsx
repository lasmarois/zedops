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
import { checkServerData } from '../lib/api';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Play, Square, RotateCw, Trash2, Terminal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ServerCard } from '@/components/ServerCard';
import { ServerCardLayoutToggle } from '@/components/ServerCardLayoutToggle';
import { useServerCardLayout } from '@/contexts/ServerCardLayoutContext';

interface AgentServerListProps {
  agentId: string;
  agentName: string;
  onBack: () => void;
  onViewLogs: (containerId: string, containerName: string) => void;
}

export function AgentServerList({ agentId, agentName, onBack, onViewLogs }: AgentServerListProps) {
  const { data, isLoading, error } = useContainers(agentId);
  const { data: serversData } = useServers(agentId);
  const { layout } = useServerCardLayout();
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
  const [showIssues, setShowIssues] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState<{ serverId: string; serverName: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ serverId: string; serverName: string } | null>(null);
  const [confirmRebuild, setConfirmRebuild] = useState<{ serverId: string; serverName: string } | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState<number | null>(null); // Number of failed servers to clean
  const [confirmRecover, setConfirmRecover] = useState<{ serverId: string; serverName: string } | null>(null); // Missing server without data
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

  // Get container status display considering health check status
  // Returns variant, label, and icon for StatusBadge
  type StatusIcon = 'dot' | 'pulse' | 'loader' | 'check' | 'alert' | 'cross' | 'info';
  const getContainerStatusDisplay = (container: Container): { variant: 'success' | 'error' | 'warning' | 'info' | 'muted' | 'starting'; label: string; icon: StatusIcon } => {
    const state = container.state.toLowerCase();

    // For running containers, check health status
    if (state === 'running') {
      switch (container.health) {
        case 'starting':
          return { variant: 'starting', label: 'Starting', icon: 'loader' };
        case 'healthy':
          return { variant: 'success', label: 'Running', icon: 'pulse' };
        case 'unhealthy':
          return { variant: 'error', label: 'Unhealthy', icon: 'alert' };
        default:
          // No health check configured - show as running
          return { variant: 'success', label: 'Running', icon: 'pulse' };
      }
    }

    // For non-running states, use existing logic
    return { variant: getStateVariant(state), label: container.state, icon: 'dot' };
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

  const handleCleanupFailedServers = () => {
    const failedCount = serversData?.servers.filter(s => s.status === 'failed').length || 0;
    if (failedCount === 0) {
      setServerMessage({
        message: 'No failed servers to clean up',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 3000);
      return;
    }
    setConfirmCleanup(failedCount);
  };

  const confirmCleanupServers = async () => {
    // Capture count before closing dialog
    const count = confirmCleanup;
    setConfirmCleanup(null);

    if (!count) return;

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


  const handleDeleteServer = (serverId: string, serverName: string) => {
    setConfirmDelete({ serverId, serverName });
  };

  const confirmDeleteServer = async () => {
    // Capture values immediately before any state changes
    const serverToDelete = confirmDelete;
    if (!serverToDelete) return;
    const { serverId } = serverToDelete;

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

  const handleRebuildServer = (serverId: string, serverName: string) => {
    setConfirmRebuild({ serverId, serverName });
  };

  const confirmRebuildServer = async () => {
    // Capture values immediately before any state changes
    const serverToRebuild = confirmRebuild;
    if (!serverToRebuild) return;
    const { serverId } = serverToRebuild;

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

  // Recovery for missing servers: live-check data on disk, confirm if no data
  const handleRecoverMissing = async (server: Server) => {
    try {
      const check = await checkServerData(agentId, server.id);
      if (!check.dataExists) {
        setConfirmRecover({ serverId: server.id, serverName: server.name });
        return;
      }
    } catch {
      // Agent offline — fall through using cached data_exists
      if (!server.data_exists) {
        setConfirmRecover({ serverId: server.id, serverName: server.name });
        return;
      }
    }
    handleServerStart(server.id, server.name);
  };

  const confirmRecoverServer = () => {
    if (!confirmRecover) return;
    const { serverId, serverName } = confirmRecover;
    setConfirmRecover(null);
    handleServerStart(serverId, serverName);
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
          ? (result.freshStart
            ? `Server "${serverName}" recreated with fresh data (previous data was not found)`
            : `Server "${serverName}" container recreated and started successfully`)
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

  const handleServerPurge = async (removeData: boolean) => {
    // Capture values immediately before any state changes
    const serverToPurge = confirmPurge;
    if (!serverToPurge) return;
    const { serverId, serverName } = serverToPurge;

    // Close the dialog immediately
    setConfirmPurge(null);

    try {
      await purgeServerMutation.mutateAsync({ agentId, serverId, removeData });
      setServerMessage({
        message: removeData
          ? `Server "${serverName}" permanently deleted (data removed)`
          : `Server "${serverName}" permanently deleted (data preserved on host)`,
        type: 'success',
      });
      setTimeout(() => setServerMessage(null), 5000);
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to purge server',
        type: 'error',
      });
      setTimeout(() => setServerMessage(null), 5000);
    }
  };

  const handleServerRestore = async (serverId: string, serverName: string) => {
    try {
      const result = await restoreServerMutation.mutateAsync({ agentId, serverId });
      if (result.recreated) {
        setServerMessage({
          message: result.dataExists
            ? `Server "${serverName}" restored and started successfully`
            : `Server "${serverName}" restored with fresh data (previous data was not found on disk)`,
          type: 'success',
        });
        // Navigate to server detail to see the running server
        setTimeout(() => navigate(`/servers/${serverId}`), 1500);
      } else {
        setServerMessage({
          message: `Server "${serverName}" restored. Container could not be recreated — use Start to bring it online.`,
          type: 'success',
        });
      }
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

  const getServerStatusBadge = (server: Server): { variant: 'success' | 'muted' | 'info' | 'warning' | 'error' | 'starting'; text: string; icon: StatusIcon } => {
    // Use shared status display logic that considers agent connectivity
    const displayStatus = getDisplayStatus(server);

    // Map our display variant types to StatusBadge variant types
    const variantMap: Record<string, 'success' | 'muted' | 'info' | 'warning' | 'error' | 'starting'> = {
      success: 'success',
      muted: 'muted',
      info: 'info',
      warning: 'warning',
      error: 'error',
      starting: 'starting',
    };

    // Map status to StatusBadge icons
    const iconMap: Record<string, StatusIcon> = {
      running: 'pulse',
      starting: 'loader',
      stopped: 'dot',
      creating: 'loader',
      deleting: 'loader',
      failed: 'cross',
      deleted: 'cross',
      agent_offline: 'alert',
      missing: 'alert',
    };

    return {
      variant: variantMap[displayStatus.variant] || 'muted',
      text: displayStatus.label,
      icon: iconMap[displayStatus.status] || 'dot',
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
      if (server.status === 'missing' || server.status === 'deleted') {
        issues.push({
          id: server.id,
          type: 'managed',
          name: server.name,
          status: server.status,
          server,
          isIssue: true,
        });
      } else {
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
        <div className="flex gap-4 items-center">
          <ServerCardLayoutToggle />
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

                  // Use ServerCard for managed servers
                  if (isManaged && server) {
                    return (
                      <ServerCard
                        key={item.id}
                        server={server}
                        container={container}
                        layout={layout}
                        isManaged={true}
                        onStart={() => {
                          if (container) {
                            handleStart(container.id);
                          } else if (server.status === 'missing') {
                            handleRecoverMissing(server);
                          } else {
                            handleServerStart(server.id, server.name);
                          }
                        }}
                        onStop={() => container && handleStop(container.id)}
                        onRestart={() => container && handleRestart(container.id)}
                        onDelete={() => handleDeleteServer(server.id, server.name)}
                        onRebuild={() => handleRebuildServer(server.id, server.name)}
                        onRcon={() => setRconServer(server)}
                        onEdit={() => handleEditServer(server)}
                        isStarting={
                          (container && startMutation.isPending && startMutation.variables?.containerId === container.id) ||
                          (!container && startServerMutation.isPending && startServerMutation.variables?.serverId === server.id)
                        }
                        isStopping={container && stopMutation.isPending && stopMutation.variables?.containerId === container.id}
                        isRestarting={container && restartMutation.isPending && restartMutation.variables?.containerId === container.id}
                      />
                    );
                  }

                  // Unmanaged containers - keep simple card
                  const getUnmanagedBorderColor = () => {
                    if (!container) return '#6b7280';
                    switch (container.state.toLowerCase()) {
                      case 'running': return '#22c55e';
                      case 'exited': return '#ef4444';
                      case 'paused': return '#f59e0b';
                      case 'restarting': return '#3b82f6';
                      default: return '#6b7280';
                    }
                  };

                  return (
                    <Card
                      key={item.id}
                      className="transition-all duration-200 border-l-4 hover:shadow-md"
                      style={{ borderLeftColor: getUnmanagedBorderColor() }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {container && (
                              <StatusBadge
                                variant={getContainerStatusDisplay(container).variant}
                                icon={getContainerStatusDisplay(container).icon}
                                iconOnly
                              >
                                {getContainerStatusDisplay(container).label}
                              </StatusBadge>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-lg truncate">{item.name}</div>
                                <Badge variant="outline" className="text-xs border-2 text-muted-foreground">
                                  Unmanaged
                                </Badge>
                              </div>
                              {container && (
                                <>
                                  <div className="text-sm text-muted-foreground truncate">{container.image}</div>
                                  <div className="text-xs text-muted-foreground mt-1">{container.status}</div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 items-center flex-shrink-0">
                            {container && (
                              <>
                                {/* Segmented action buttons for unmanaged containers */}
                                <div className="flex items-center rounded-lg overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-sm">
                                  {!isRunning && (
                                    <button
                                      onClick={() => handleStart(container.id)}
                                      disabled={startMutation.isPending && startMutation.variables?.containerId === container.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 text-success hover:bg-success/20 hover:shadow-[inset_0_0_15px_rgba(61,220,151,0.2)] disabled:opacity-50"
                                    >
                                      <Play className={`h-3.5 w-3.5 ${startMutation.isPending && startMutation.variables?.containerId === container.id ? 'animate-spin' : ''}`} />
                                      <span>{startMutation.isPending && startMutation.variables?.containerId === container.id ? 'Starting...' : 'Start'}</span>
                                    </button>
                                  )}
                                  {isRunning && (
                                    <>
                                      <button
                                        onClick={() => handleStop(container.id)}
                                        disabled={stopMutation.isPending && stopMutation.variables?.containerId === container.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 text-warning hover:bg-warning/20 hover:shadow-[inset_0_0_15px_rgba(255,201,82,0.2)] disabled:opacity-50"
                                      >
                                        <Square className={`h-3.5 w-3.5 ${stopMutation.isPending && stopMutation.variables?.containerId === container.id ? 'animate-pulse' : ''}`} />
                                        <span>{stopMutation.isPending && stopMutation.variables?.containerId === container.id ? 'Stopping...' : 'Stop'}</span>
                                      </button>
                                      <div className="w-px h-5 bg-white/10" />
                                      <button
                                        onClick={() => handleRestart(container.id)}
                                        disabled={restartMutation.isPending && restartMutation.variables?.containerId === container.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 text-info hover:bg-info/20 hover:shadow-[inset_0_0_15px_rgba(51,225,255,0.2)] disabled:opacity-50"
                                      >
                                        <RotateCw className={`h-3.5 w-3.5 ${restartMutation.isPending && restartMutation.variables?.containerId === container.id ? 'animate-spin' : ''}`} />
                                        <span>{restartMutation.isPending && restartMutation.variables?.containerId === container.id ? 'Restarting...' : 'Restart'}</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => onViewLogs(container.id, item.name)}>
                                      <Terminal className="h-4 w-4 mr-2" />
                                      View Logs
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            )}
                          </div>
                        </div>

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
                            case 'starting': return '#a78bbd'; // purple-500
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
                                  {/* Recovery Actions Group */}
                                  {server.status === 'missing' || server.status === 'deleted' ? (
                                    <div className="flex items-center rounded-lg overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-sm">
                                      {server.status === 'missing' && (
                                        <button
                                          onClick={() => handleRecoverMissing(server)}
                                          disabled={startServerMutation.isPending && startServerMutation.variables?.serverId === server.id}
                                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 text-success hover:bg-success/20 hover:shadow-[inset_0_0_15px_rgba(61,220,151,0.2)] disabled:opacity-50"
                                        >
                                          <Play className={`h-3.5 w-3.5 ${startServerMutation.isPending && startServerMutation.variables?.serverId === server.id ? 'animate-spin' : ''}`} />
                                          <span>{startServerMutation.isPending && startServerMutation.variables?.serverId === server.id ? 'Recovering...' : 'Recover'}</span>
                                        </button>
                                      )}
                                      {server.status === 'deleted' && (
                                        <button
                                          onClick={() => handleServerRestore(server.id, server.name)}
                                          disabled={restoreServerMutation.isPending && restoreServerMutation.variables?.serverId === server.id}
                                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 text-info hover:bg-info/20 hover:shadow-[inset_0_0_15px_rgba(51,225,255,0.2)] disabled:opacity-50"
                                        >
                                          <RotateCw className={`h-3.5 w-3.5 ${restoreServerMutation.isPending && restoreServerMutation.variables?.serverId === server.id ? 'animate-spin' : ''}`} />
                                          <span>{restoreServerMutation.isPending && restoreServerMutation.variables?.serverId === server.id ? 'Restoring...' : 'Restore'}</span>
                                        </button>
                                      )}
                                    </div>
                                  ) : null}

                                  {/* Destructive Actions Group */}
                                  <div className="flex items-center rounded-lg overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-sm">
                                    <button
                                      onClick={() => setConfirmPurge({ serverId: server.id, serverName: server.name })}
                                      disabled={purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 text-destructive hover:bg-destructive/20 hover:shadow-[inset_0_0_15px_rgba(220,38,38,0.2)] disabled:opacity-50"
                                    >
                                      <Trash2 className={`h-3.5 w-3.5 ${purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id ? 'animate-pulse' : ''}`} />
                                      <span>{purgeServerMutation.isPending && purgeServerMutation.variables?.serverId === server.id ? 'Purging...' : 'Purge'}</span>
                                    </button>
                                  </div>
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
      <Dialog open={!!confirmPurge} onOpenChange={(open) => !open && setConfirmPurge(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl">Permanently Delete Server?</DialogTitle>
            <DialogDescription className="pt-2">
              <span className="font-semibold text-foreground">{confirmPurge?.serverName}</span> will be permanently removed from the database.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={() => handleServerPurge(false)}
              disabled={purgeServerMutation.isPending}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">Keep server data on disk</span>
                <span className="text-xs text-muted-foreground">Remove record only, preserve saves & configs</span>
              </div>
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start h-auto py-3 px-4"
              onClick={() => handleServerPurge(true)}
              disabled={purgeServerMutation.isPending}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{purgeServerMutation.isPending ? 'Purging...' : 'Delete everything'}</span>
                <span className="text-xs text-destructive-foreground/70">Remove record AND all server data</span>
              </div>
            </Button>
          </div>
          <DialogFooter className="mt-4 sm:justify-center">
            <Button variant="ghost" onClick={() => setConfirmPurge(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Server Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete Server"
        description={`Delete server "${confirmDelete?.serverName}"? Container will be removed but data will be preserved.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={confirmDeleteServer}
      />

      {/* Rebuild Server Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmRebuild}
        onOpenChange={(open) => !open && setConfirmRebuild(null)}
        title="Rebuild Server"
        description={`Rebuild server "${confirmRebuild?.serverName}"? This will pull the latest image and recreate the container. Game data will be preserved.`}
        confirmText="Rebuild"
        onConfirm={confirmRebuildServer}
      />

      {/* Recover Missing Server (No Data) Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmRecover}
        onOpenChange={(open) => !open && setConfirmRecover(null)}
        title="Recreate Server — Fresh Start"
        description={`Server data for "${confirmRecover?.serverName}" was not found on disk. This will create a fresh server with the same configuration (ports, mods, settings). World saves and player progress will NOT be restored. Continue?`}
        confirmText="Recreate (Fresh Start)"
        variant="destructive"
        onConfirm={confirmRecoverServer}
      />

      {/* Cleanup Failed Servers Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmCleanup}
        onOpenChange={(open) => !open && setConfirmCleanup(null)}
        title="Cleanup Failed Servers"
        description={`Clean up ${confirmCleanup} failed server(s)? Containers will be removed but data will be preserved.`}
        confirmText="Cleanup"
        variant="destructive"
        onConfirm={confirmCleanupServers}
      />

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
