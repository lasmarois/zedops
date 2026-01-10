/**
 * Agent list component
 */

import { useAgents } from '../hooks/useAgents';
import { useAuthStore } from '../stores/authStore';
import type { Agent } from '../lib/api';

interface AgentListProps {
  onSelectAgent: (agent: Agent) => void;
}

export function AgentList({ onSelectAgent }: AgentListProps) {
  const { data, isLoading, error } = useAgents();
  const clearPassword = useAuthStore((state) => state.clearPassword);

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading agents...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#dc3545' }}>
        Error: {error.message}
        <br />
        <button
          onClick={() => clearPassword()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Re-login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
      }}>
        <h1>ZedOps Agents</h1>
        <button
          onClick={() => clearPassword()}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <strong>Total Agents:</strong> {data?.count ?? 0}
      </div>

      {data?.agents.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
        }}>
          No agents registered yet
        </div>
      ) : (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Name
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Status
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Last Seen
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.agents.map((agent) => (
              <tr
                key={agent.id}
                onClick={() => agent.status === 'online' && onSelectAgent(agent)}
                style={{
                  borderBottom: '1px solid #dee2e6',
                  cursor: agent.status === 'online' ? 'pointer' : 'default',
                  backgroundColor: 'white',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (agent.status === 'online') {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <td style={{ padding: '1rem' }}>
                  {agent.name}
                  {agent.status === 'online' && (
                    <span style={{ marginLeft: '0.5rem', color: '#6c757d', fontSize: '0.875rem' }}>
                      →
                    </span>
                  )}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    backgroundColor: agent.status === 'online' ? '#28a745' : '#6c757d',
                    color: 'white',
                  }}>
                    {agent.status === 'online' ? '● Online' : '○ Offline'}
                  </span>
                </td>
                <td style={{ padding: '1rem', color: '#6c757d' }}>
                  {new Date(agent.lastSeen * 1000).toLocaleString()}
                </td>
                <td style={{ padding: '1rem', color: '#6c757d' }}>
                  {new Date(agent.createdAt * 1000).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
