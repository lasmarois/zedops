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
import { useServers, useCreateServer, useDeleteServer, useRebuildServer, useCleanupFailedServers, useStartServer, useStopServer, usePurgeServer, useRestoreServer, useSyncServers } from '../hooks/useServers';
import { ServerForm } from './ServerForm';
import { RconTerminal } from './RconTerminal';
import type { Container, CreateServerRequest, Server } from '../lib/api';
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
  const stopServerMutation = useStopServer();
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

  const getStateVariant = (state: string): 'success' | 'destructive' | 'warning' | 'info' | 'secondary' => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'success';
      case 'exited':
        return 'destructive';
      case 'paused':
        return 'warning';
      case 'restarting':
        return 'info';
      default:
        return 'secondary';
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

  const handleServerStop = async (serverId: string, serverName: string) => {
    try {
      await stopServerMutation.mutateAsync({ agentId, serverId });
      setServerMessage({
        message: `Server "${serverName}" stopped successfully`,
        type: 'success',
      });
      setTimeout(() => setServerMessage(null), 5000);
    } catch (error) {
      setServerMessage({
        message: error instanceof Error ? error.message : 'Failed to stop server',
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

  const getServerStatusBadge = (server: Server): { variant: 'success' | 'secondary' | 'info' | 'warning' | 'destructive'; text: string } => {
    const { status, data_exists } = server;

    const badgeMap: Record<string, { variant: 'success' | 'secondary' | 'info' | 'warning' | 'destructive'; text: string }> = {
      running: { variant: 'success', text: '✓ Running' },
      stopped: { variant: 'secondary', text: '⏸ Stopped' },
      creating: { variant: 'info', text: '⏳ Creating' },
      deleting: { variant: 'warning', text: '⏳ Deleting' },
      failed: { variant: 'destructive', text: '❌ Failed' },
      deleted: { variant: 'warning', text: '🗑️ Deleted' },
    };

    if (status === 'missing') {
      return data_exists
        ? { variant: 'warning', text: '⚠️ Missing (Recoverable)' }
        : { variant: 'destructive', text: '⚠️ Orphaned' };
    }

    return badgeMap[status] || { variant: 'secondary', text: status };
  };

  const isOperationPending = (): boolean => {
    return (
      startMutation.isPending ||
      stopMutation.isPending ||
      restartMutation.isPending
    );
  };

  const getServerFromContainerId = (containerId: string): Server | undefined => {
    return serversData?.servers.find((s) => s.container_id === containerId);
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
          <h1 className="text-3xl font-bold">Containers on {agentName}</h1>
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

      <div className="mb-4">
        <strong>Total Containers:</strong> {data?.count ?? 0}
        {serversData && serversData.servers.length > 0 && (
          <span className="ml-4 text-muted-foreground">
            (Managed Servers: {serversData.servers.length})
          </span>
        )}
      </div>

      {data?.containers.length === 0 ? (
        <div className="p-8 text-center bg-muted rounded-md">
          No containers found on this agent
        </div>
      ) : (
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
              {data?.containers.map((container) => (
                <TableRow key={container.id}>
                  <TableCell>{getContainerName(container)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {container.image}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStateVariant(container.state)}>
                      {container.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {container.status}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      {container.state.toLowerCase() !== 'running' && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleStart(container.id)}
                          disabled={isOperationPending()}
                        >
                          {isOperationPending() ? 'Working...' : 'Start'}
                        </Button>
                      )}
                      {container.state.toLowerCase() === 'running' && (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleStop(container.id)}
                            disabled={isOperationPending()}
                          >
                            {isOperationPending() ? 'Working...' : 'Stop'}
                          </Button>
                          <Button
                            size="sm"
                            variant="info"
                            onClick={() => handleRestart(container.id)}
                            disabled={isOperationPending()}
                          >
                            {isOperationPending() ? 'Working...' : 'Restart'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onViewLogs(container.id, getContainerName(container))}
                          >
                            View Logs
                          </Button>
                          {getServerFromContainerId(container.id) && (
                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => {
                                const server = getServerFromContainerId(container.id);
                                if (server) {
                                  setRconServer(server);
                                }
                              }}
                            >
                              🎮 RCON
                            </Button>
                          )}
                        </>
                      )}
                      {getServerFromContainerId(container.id) && (
                        <>
                          {getServerFromContainerId(container.id)?.status === 'failed' && (
                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => {
                                const server = getServerFromContainerId(container.id);
                                if (server) {
                                  handleEditServer(server);
                                }
                              }}
                            >
                              Edit & Retry
                            </Button>
                          )}
                          {getServerFromContainerId(container.id)?.status === 'running' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                const server = getServerFromContainerId(container.id);
                                if (server) {
                                  handleRebuildServer(server.id, server.name);
                                }
                              }}
                              disabled={rebuildServerMutation.isPending}
                            >
                              {rebuildServerMutation.isPending ? 'Rebuilding...' : 'Rebuild'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const server = getServerFromContainerId(container.id);
                              if (server) {
                                handleDeleteServer(server.id, server.name);
                              }
                            }}
                            disabled={deleteServerMutation.isPending}
                          >
                            {deleteServerMutation.isPending ? 'Deleting...' : 'Delete Server'}
                          </Button>
                        </>
                      )}
                    </div>
                    {operationStatus && operationStatus.containerId === container.id && (
                      <Alert variant={operationStatus.type === 'success' ? 'success' : 'destructive'} className="mt-2">
                        <AlertDescription className="text-xs">{operationStatus.message}</AlertDescription>
                      </Alert>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* All Servers Section */}
      {serversData && serversData.servers.length > 0 && (
        <div className="mt-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">All Servers (Manager Database)</h2>
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDeletedServers}
                  onChange={(e) => setShowDeletedServers(e.target.checked)}
                />
                Show Deleted Servers
              </label>
              <Button
                variant="info"
                onClick={handleSyncServers}
                disabled={syncServersMutation.isPending}
              >
                {syncServersMutation.isPending ? '🔄 Syncing...' : '🔄 Sync Status'}
              </Button>
            </div>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Server Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ports (Game/UDP)</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serversData.servers
                  .filter((server) => showDeletedServers || server.status !== 'deleted')
                  .map((server) => {
                    const badge = getServerStatusBadge(server);
                    return (
                      <TableRow
                        key={server.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/servers/${server.id}`)}
                      >
                        <TableCell className="font-semibold">{server.name}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.text}</Badge>
                        </TableCell>
                        <TableCell>
                          {server.game_port}/{server.udp_port}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 flex-wrap">
                            {/* Running: Stop, Rebuild, Delete */}
                            {server.status === 'running' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="warning"
                                  onClick={() => handleServerStop(server.id, server.name)}
                                  disabled={stopServerMutation.isPending}
                                >
                                  Stop
                                </Button>
                                <Button
                                  size="sm"
                                  variant="info"
                                  onClick={() => handleRebuildServer(server.id, server.name)}
                                  disabled={rebuildServerMutation.isPending}
                                >
                                  Rebuild
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteServer(server.id, server.name)}
                                  disabled={deleteServerMutation.isPending}
                                >
                                  Delete
                                </Button>
                              </>
                            )}

                            {/* Stopped: Start, Delete */}
                            {server.status === 'stopped' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => handleServerStart(server.id, server.name)}
                                  disabled={startServerMutation.isPending}
                                >
                                  Start
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteServer(server.id, server.name)}
                                  disabled={deleteServerMutation.isPending}
                                >
                                  Delete
                                </Button>
                              </>
                            )}

                            {/* Missing + Data Exists: Start (Recovery), Purge */}
                            {server.status === 'missing' && server.data_exists && (
                              <>
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => handleServerStart(server.id, server.name)}
                                  disabled={startServerMutation.isPending}
                                  className="font-bold"
                                >
                                  ▶️ Start (Recovery)
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setConfirmPurge({ serverId: server.id, serverName: server.name })}
                                  disabled={purgeServerMutation.isPending}
                                >
                                  🗑️ Purge
                                </Button>
                              </>
                            )}

                            {/* Missing + No Data: Purge Only */}
                            {server.status === 'missing' && !server.data_exists && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleServerPurge(server.id, server.name, false)}
                                disabled={purgeServerMutation.isPending}
                              >
                                🗑️ Purge (Orphaned)
                              </Button>
                            )}

                            {/* Deleted: Restore, Purge Now */}
                            {server.status === 'deleted' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="info"
                                  onClick={() => handleServerRestore(server.id, server.name)}
                                  disabled={restoreServerMutation.isPending}
                                >
                                  ↩️ Restore
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setConfirmPurge({ serverId: server.id, serverName: server.name })}
                                  disabled={purgeServerMutation.isPending}
                                >
                                  🗑️ Purge Now
                                </Button>
                              </>
                            )}

                            {/* Failed: Edit & Retry, Purge */}
                            {server.status === 'failed' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setEditServer(server);
                                    setShowServerForm(true);
                                  }}
                                >
                                  Edit & Retry
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleServerPurge(server.id, server.name, true)}
                                  disabled={purgeServerMutation.isPending}
                                >
                                  🗑️ Purge
                                </Button>
                              </>
                            )}

                            {/* Creating/Deleting: No actions */}
                            {(server.status === 'creating' || server.status === 'deleting') && (
                              <span className="text-sm text-muted-foreground italic">
                                Operation in progress...
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

          {serversData.servers.filter((s) => s.status === 'deleted').length > 0 && !showDeletedServers && (
            <div className="mt-4 p-3 bg-muted rounded-md text-sm text-muted-foreground">
              💡 {serversData.servers.filter((s) => s.status === 'deleted').length} deleted server(s) hidden. Check "Show Deleted Servers" to view them.
            </div>
          )}
        </div>
      )}

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
              disabled={purgeServerMutation.isPending}
            >
              Keep Data & Purge
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmPurge && handleServerPurge(confirmPurge.serverId, confirmPurge.serverName, true)}
              disabled={purgeServerMutation.isPending}
            >
              {purgeServerMutation.isPending ? 'Purging...' : 'Remove Data & Purge'}
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
