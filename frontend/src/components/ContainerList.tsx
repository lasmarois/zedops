/**
 * Container list component for a specific agent
 */

import { useState, useEffect, useRef } from 'react';
import {
  useContainers,
  useStartContainer,
  useStopContainer,
  useRestartContainer,
} from '../hooks/useContainers';
import { useServers, useCreateServer, useDeleteServer, useRebuildServer, useCleanupFailedServers, useStartServer, useStopServer, usePurgeServer, useRestoreServer, useSyncServers } from '../hooks/useServers';
import { ServerForm } from './ServerForm';
import type { Container, CreateServerRequest, Server } from '../lib/api';

interface ContainerListProps {
  agentId: string;
  agentName: string;
  onBack: () => void;
  onViewLogs: (containerId: string, containerName: string) => void;
}

export function ContainerList({ agentId, agentName, onBack, onViewLogs }: ContainerListProps) {
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

  const getStateColor = (state: string): string => {
    switch (state.toLowerCase()) {
      case 'running':
        return '#28a745';
      case 'exited':
        return '#dc3545';
      case 'paused':
        return '#ffc107';
      case 'restarting':
        return '#17a2b8';
      default:
        return '#6c757d';
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

  const getServerStatusBadge = (server: Server) => {
    const { status, data_exists } = server;

    const badgeStyles: Record<string, { bg: string; text: string }> = {
      running: { bg: '#28a745', text: '✓ Running' },
      stopped: { bg: '#6c757d', text: '⏸ Stopped' },
      creating: { bg: '#17a2b8', text: '⏳ Creating' },
      deleting: { bg: '#fd7e14', text: '⏳ Deleting' },
      failed: { bg: '#dc3545', text: '❌ Failed' },
      deleted: { bg: '#fd7e14', text: '🗑️ Deleted' },
    };

    if (status === 'missing') {
      return data_exists
        ? { bg: '#ffc107', text: '⚠️ Missing (Recoverable)' }
        : { bg: '#dc3545', text: '⚠️ Orphaned' };
    }

    return badgeStyles[status] || { bg: '#6c757d', text: status };
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
      <div style={{ padding: '2rem' }}>
        <button
          onClick={onBack}
          style={{
            marginBottom: '2rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← Back to Agents
        </button>
        <div>Loading containers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <button
          onClick={onBack}
          style={{
            marginBottom: '2rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← Back to Agents
        </button>
        <div style={{ color: '#dc3545' }}>
          Error: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div>
          <button
            onClick={onBack}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '1rem',
            }}
          >
            ← Back to Agents
          </button>
          <h1>Containers on {agentName}</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setShowServerForm(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            + Create Server
          </button>
          {serversData && serversData.servers.some(s => s.status === 'failed') && (
            <button
              onClick={handleCleanupFailedServers}
              disabled={cleanupFailedServersMutation.isPending}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: cleanupFailedServersMutation.isPending ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                opacity: cleanupFailedServersMutation.isPending ? 0.6 : 1,
              }}
            >
              {cleanupFailedServersMutation.isPending
                ? 'Cleaning...'
                : `🧹 Clean Up Failed Servers (${serversData.servers.filter(s => s.status === 'failed').length})`}
            </button>
          )}
        </div>
      </div>

      {serverMessage && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '4px',
            backgroundColor: serverMessage.type === 'success' ? '#d4edda' : '#f8d7da',
            color: serverMessage.type === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${serverMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          }}
        >
          {serverMessage.message}
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <strong>Total Containers:</strong> {data?.count ?? 0}
        {serversData && serversData.servers.length > 0 && (
          <span style={{ marginLeft: '1rem', color: '#6c757d' }}>
            (Managed Servers: {serversData.servers.length})
          </span>
        )}
      </div>

      {data?.containers.length === 0 ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
          }}
        >
          No containers found on this agent
        </div>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Name
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Image
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                State
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Status
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.containers.map((container) => (
              <tr key={container.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '1rem' }}>
                  {getContainerName(container)}
                </td>
                <td style={{ padding: '1rem', color: '#6c757d', fontSize: '0.875rem' }}>
                  {container.image}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      backgroundColor: getStateColor(container.state),
                      color: 'white',
                    }}
                  >
                    {container.state}
                  </span>
                </td>
                <td style={{ padding: '1rem', color: '#6c757d', fontSize: '0.875rem' }}>
                  {container.status}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {container.state.toLowerCase() !== 'running' && (
                      <button
                        onClick={() => handleStart(container.id)}
                        disabled={isOperationPending()}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isOperationPending() ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          opacity: isOperationPending() ? 0.6 : 1,
                        }}
                      >
                        {isOperationPending() ? 'Working...' : 'Start'}
                      </button>
                    )}
                    {container.state.toLowerCase() === 'running' && (
                      <>
                        <button
                          onClick={() => handleStop(container.id)}
                          disabled={isOperationPending()}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isOperationPending() ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                            opacity: isOperationPending() ? 0.6 : 1,
                          }}
                        >
                          {isOperationPending() ? 'Working...' : 'Stop'}
                        </button>
                        <button
                          onClick={() => handleRestart(container.id)}
                          disabled={isOperationPending()}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isOperationPending() ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                            opacity: isOperationPending() ? 0.6 : 1,
                          }}
                        >
                          {isOperationPending() ? 'Working...' : 'Restart'}
                        </button>
                        <button
                          onClick={() => onViewLogs(container.id, getContainerName(container))}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#6f42c1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          View Logs
                        </button>
                      </>
                    )}
                    {getServerFromContainerId(container.id) && (
                      <>
                        {getServerFromContainerId(container.id)?.status === 'failed' && (
                          <button
                            onClick={() => {
                              const server = getServerFromContainerId(container.id);
                              if (server) {
                                handleEditServer(server);
                              }
                            }}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#ffc107',
                              color: '#000',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: 'bold',
                            }}
                          >
                            Edit & Retry
                          </button>
                        )}
                        {getServerFromContainerId(container.id)?.status === 'running' && (
                          <button
                            onClick={() => {
                              const server = getServerFromContainerId(container.id);
                              if (server) {
                                handleRebuildServer(server.id, server.name);
                              }
                            }}
                            disabled={rebuildServerMutation.isPending}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: rebuildServerMutation.isPending ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem',
                              opacity: rebuildServerMutation.isPending ? 0.6 : 1,
                            }}
                          >
                            {rebuildServerMutation.isPending ? 'Rebuilding...' : 'Rebuild'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const server = getServerFromContainerId(container.id);
                            if (server) {
                              handleDeleteServer(server.id, server.name);
                            }
                          }}
                          disabled={deleteServerMutation.isPending}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: deleteServerMutation.isPending ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                            opacity: deleteServerMutation.isPending ? 0.6 : 1,
                          }}
                        >
                          {deleteServerMutation.isPending ? 'Deleting...' : 'Delete Server'}
                        </button>
                      </>
                    )}
                  </div>
                  {operationStatus && operationStatus.containerId === container.id && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        backgroundColor:
                          operationStatus.type === 'success' ? '#d4edda' : '#f8d7da',
                        color: operationStatus.type === 'success' ? '#155724' : '#721c24',
                      }}
                    >
                      {operationStatus.message}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* All Servers Section */}
      {serversData && serversData.servers.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>All Servers (Manager Database)</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showDeletedServers}
                  onChange={(e) => setShowDeletedServers(e.target.checked)}
                />
                Show Deleted Servers
              </label>
              <button
                onClick={handleSyncServers}
                disabled={syncServersMutation.isPending}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: syncServersMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: syncServersMutation.isPending ? 0.6 : 1,
                }}
              >
                {syncServersMutation.isPending ? '🔄 Syncing...' : '🔄 Sync Status'}
              </button>
            </div>
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '1rem',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                  Server Name
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                  Status
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                  Ports (Game/UDP)
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {serversData.servers
                .filter((server) => showDeletedServers || server.status !== 'deleted')
                .map((server) => {
                  const badge = getServerStatusBadge(server);
                  return (
                    <tr key={server.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '1rem' }}>
                        <strong>{server.name}</strong>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '4px',
                            backgroundColor: badge.bg,
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: 'bold',
                          }}
                        >
                          {badge.text}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {server.game_port}/{server.udp_port}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {/* Running: Stop, Rebuild, Delete */}
                          {server.status === 'running' && (
                            <>
                              <button
                                onClick={() => handleServerStop(server.id, server.name)}
                                disabled={stopServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#ffc107',
                                  color: '#000',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: stopServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                Stop
                              </button>
                              <button
                                onClick={() => handleRebuildServer(server.id, server.name)}
                                disabled={rebuildServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#17a2b8',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: rebuildServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                Rebuild
                              </button>
                              <button
                                onClick={() => handleDeleteServer(server.id, server.name)}
                                disabled={deleteServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: deleteServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}

                          {/* Stopped: Start, Delete */}
                          {server.status === 'stopped' && (
                            <>
                              <button
                                onClick={() => handleServerStart(server.id, server.name)}
                                disabled={startServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: startServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                Start
                              </button>
                              <button
                                onClick={() => handleDeleteServer(server.id, server.name)}
                                disabled={deleteServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: deleteServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}

                          {/* Missing + Data Exists: Start (Recovery), Purge */}
                          {server.status === 'missing' && server.data_exists && (
                            <>
                              <button
                                onClick={() => handleServerStart(server.id, server.name)}
                                disabled={startServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: startServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                  fontWeight: 'bold',
                                }}
                              >
                                ▶️ Start (Recovery)
                              </button>
                              <button
                                onClick={() => setConfirmPurge({ serverId: server.id, serverName: server.name })}
                                disabled={purgeServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#6c757d',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: purgeServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                🗑️ Purge
                              </button>
                            </>
                          )}

                          {/* Missing + No Data: Purge Only */}
                          {server.status === 'missing' && !server.data_exists && (
                            <button
                              onClick={() => handleServerPurge(server.id, server.name, false)}
                              disabled={purgeServerMutation.isPending}
                              style={{
                                padding: '0.375rem 0.75rem',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: purgeServerMutation.isPending ? 'not-allowed' : 'pointer',
                                fontSize: '0.875rem',
                              }}
                            >
                              🗑️ Purge (Orphaned)
                            </button>
                          )}

                          {/* Deleted: Restore, Purge Now */}
                          {server.status === 'deleted' && (
                            <>
                              <button
                                onClick={() => handleServerRestore(server.id, server.name)}
                                disabled={restoreServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#17a2b8',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: restoreServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                ↩️ Restore
                              </button>
                              <button
                                onClick={() => setConfirmPurge({ serverId: server.id, serverName: server.name })}
                                disabled={purgeServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: purgeServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                🗑️ Purge Now
                              </button>
                            </>
                          )}

                          {/* Failed: Edit & Retry, Purge */}
                          {server.status === 'failed' && (
                            <>
                              <button
                                onClick={() => {
                                  setEditServer(server);
                                  setShowServerForm(true);
                                }}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#007bff',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                Edit & Retry
                              </button>
                              <button
                                onClick={() => handleServerPurge(server.id, server.name, true)}
                                disabled={purgeServerMutation.isPending}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: purgeServerMutation.isPending ? 'not-allowed' : 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                🗑️ Purge
                              </button>
                            </>
                          )}

                          {/* Creating/Deleting: No actions */}
                          {(server.status === 'creating' || server.status === 'deleting') && (
                            <span style={{ color: '#6c757d', fontSize: '0.875rem', fontStyle: 'italic' }}>
                              Operation in progress...
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {serversData.servers.filter((s) => s.status === 'deleted').length > 0 && !showDeletedServers && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '0.875rem', color: '#6c757d' }}>
              💡 {serversData.servers.filter((s) => s.status === 'deleted').length} deleted server(s) hidden. Check "Show Deleted Servers" to view them.
            </div>
          )}
        </div>
      )}

      {/* Purge Confirmation Modal */}
      {confirmPurge && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ marginTop: 0, color: '#dc3545' }}>⚠️ Permanent Deletion</h3>
            <p>
              You are about to permanently delete server <strong>"{confirmPurge.serverName}"</strong>.
            </p>
            <p style={{ marginBottom: '1.5rem' }}>
              This action cannot be undone. The server record will be removed from the database.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmPurge(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleServerPurge(confirmPurge.serverId, confirmPurge.serverName, false)}
                disabled={purgeServerMutation.isPending}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#ffc107',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: purgeServerMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                Keep Data & Purge
              </button>
              <button
                onClick={() => handleServerPurge(confirmPurge.serverId, confirmPurge.serverName, true)}
                disabled={purgeServerMutation.isPending}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: purgeServerMutation.isPending ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {purgeServerMutation.isPending ? 'Purging...' : 'Remove Data & Purge'}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
