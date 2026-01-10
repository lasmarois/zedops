/**
 * Container list component for a specific agent
 */

import { useState } from 'react';
import {
  useContainers,
  useStartContainer,
  useStopContainer,
  useRestartContainer,
} from '../hooks/useContainers';
import { useServers, useCreateServer, useDeleteServer } from '../hooks/useServers';
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

  const [operationStatus, setOperationStatus] = useState<{
    containerId: string;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const [showServerForm, setShowServerForm] = useState(false);
  const [serverMessage, setServerMessage] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

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

  const handleCreateServer = async (request: CreateServerRequest) => {
    try {
      const result = await createServerMutation.mutateAsync({ agentId, request });
      if (result.success) {
        setServerMessage({
          message: `Server "${request.name}" created successfully! Starting container...`,
          type: 'success',
        });
        setShowServerForm(false);
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

      {showServerForm && (
        <ServerForm
          onSubmit={handleCreateServer}
          onCancel={() => setShowServerForm(false)}
          isSubmitting={createServerMutation.isPending}
        />
      )}
    </div>
  );
}
