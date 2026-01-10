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
import type { Container } from '../lib/api';

interface ContainerListProps {
  agentId: string;
  agentName: string;
  onBack: () => void;
}

export function ContainerList({ agentId, agentName, onBack }: ContainerListProps) {
  const { data, isLoading, error } = useContainers(agentId);
  const startMutation = useStartContainer();
  const stopMutation = useStopContainer();
  const restartMutation = useRestartContainer();

  const [operationStatus, setOperationStatus] = useState<{
    containerId: string;
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

  const isOperationPending = (containerId: string): boolean => {
    return (
      startMutation.isPending ||
      stopMutation.isPending ||
      restartMutation.isPending
    );
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
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <strong>Total Containers:</strong> {data?.count ?? 0}
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
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {container.state.toLowerCase() !== 'running' && (
                      <button
                        onClick={() => handleStart(container.id)}
                        disabled={isOperationPending(container.id)}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isOperationPending(container.id) ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          opacity: isOperationPending(container.id) ? 0.6 : 1,
                        }}
                      >
                        {isOperationPending(container.id) ? 'Working...' : 'Start'}
                      </button>
                    )}
                    {container.state.toLowerCase() === 'running' && (
                      <>
                        <button
                          onClick={() => handleStop(container.id)}
                          disabled={isOperationPending(container.id)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isOperationPending(container.id) ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                            opacity: isOperationPending(container.id) ? 0.6 : 1,
                          }}
                        >
                          {isOperationPending(container.id) ? 'Working...' : 'Stop'}
                        </button>
                        <button
                          onClick={() => handleRestart(container.id)}
                          disabled={isOperationPending(container.id)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isOperationPending(container.id) ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                            opacity: isOperationPending(container.id) ? 0.6 : 1,
                          }}
                        >
                          {isOperationPending(container.id) ? 'Working...' : 'Restart'}
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
    </div>
  );
}
