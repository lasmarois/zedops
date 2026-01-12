/**
 * Permissions manager component for managing user permissions
 */

import { useState } from 'react';
import {
  useUserPermissions,
  useGrantPermission,
  useRevokePermission,
} from '../hooks/useUsers';
import { useAgents } from '../hooks/useAgents';
import type { UserAccount, Permission } from '../lib/api';

interface PermissionsManagerProps {
  user: UserAccount;
  onBack: () => void;
}

export function PermissionsManager({ user, onBack }: PermissionsManagerProps) {
  const { data, isLoading, error } = useUserPermissions(user.id);
  const { data: agentsData } = useAgents();
  const grantMutation = useGrantPermission();
  const revokeMutation = useRevokePermission();

  const [showGrantForm, setShowGrantForm] = useState(false);
  const [resourceType, setResourceType] = useState<'agent' | 'server' | 'global'>('agent');
  const [resourceId, setResourceId] = useState<string>('');
  const [permission, setPermission] = useState<'view' | 'control' | 'delete' | 'manage_users'>(
    'view'
  );
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      await grantMutation.mutateAsync({
        userId: user.id,
        resourceType,
        resourceId: resourceType === 'global' ? null : resourceId || null,
        permission,
      });
      setMessage({ type: 'success', text: 'Permission granted successfully' });
      setShowGrantForm(false);
      setResourceId('');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to grant permission',
      });
    }
  };

  const handleRevokePermission = async (permissionId: string) => {
    if (!confirm('Are you sure you want to revoke this permission?')) {
      return;
    }

    try {
      await revokeMutation.mutateAsync({ permissionId, userId: user.id });
      setMessage({ type: 'success', text: 'Permission revoked successfully' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to revoke permission',
      });
    }
  };

  const getResourceName = (perm: Permission) => {
    if (perm.resource_type === 'global') {
      return 'Global';
    }
    if (perm.resource_type === 'agent' && perm.resource_id) {
      const agent = agentsData?.agents.find((a) => a.id === perm.resource_id);
      return agent ? `Agent: ${agent.name}` : `Agent: ${perm.resource_id}`;
    }
    if (perm.resource_type === 'server' && perm.resource_id) {
      return `Server: ${perm.resource_id}`;
    }
    return perm.resource_type;
  };

  const formatPermission = (perm: string) => {
    return perm.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading permissions...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#dc3545' }}>
        Error: {error.message}
        <br />
        <button
          onClick={onBack}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
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
              marginRight: '1rem',
            }}
          >
            ← Back
          </button>
          <h1 style={{ display: 'inline' }}>Permissions for {user.email}</h1>
        </div>
        <button
          onClick={() => {
            setShowGrantForm(!showGrantForm);
            setMessage(null);
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {showGrantForm ? 'Cancel' : '+ Grant Permission'}
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
          }}
        >
          {message.text}
        </div>
      )}

      {showGrantForm && (
        <div
          style={{
            backgroundColor: '#2d2d2d',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Grant New Permission</h2>
          <form onSubmit={handleGrantPermission}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="resourceType"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ccc',
                }}
              >
                Resource Type
              </label>
              <select
                id="resourceType"
                value={resourceType}
                onChange={(e) => {
                  setResourceType(e.target.value as 'agent' | 'server' | 'global');
                  setResourceId('');
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                }}
              >
                <option value="agent">Agent</option>
                <option value="server">Server</option>
                <option value="global">Global</option>
              </select>
            </div>

            {resourceType !== 'global' && (
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="resourceId"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: '#ccc',
                  }}
                >
                  Resource ID {resourceType === 'agent' ? '(Agent)' : '(Server)'}
                </label>
                {resourceType === 'agent' ? (
                  <select
                    id="resourceId"
                    value={resourceId}
                    onChange={(e) => setResourceId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                    }}
                  >
                    <option value="">Select an agent...</option>
                    {agentsData?.agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="resourceId"
                    type="text"
                    value={resourceId}
                    onChange={(e) => setResourceId(e.target.value)}
                    placeholder="Enter server ID"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                    }}
                  />
                )}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="permission"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ccc',
                }}
              >
                Permission
              </label>
              <select
                id="permission"
                value={permission}
                onChange={(e) =>
                  setPermission(
                    e.target.value as 'view' | 'control' | 'delete' | 'manage_users'
                  )
                }
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                }}
              >
                <option value="view">View</option>
                <option value="control">Control</option>
                <option value="delete">Delete</option>
                {resourceType === 'global' && <option value="manage_users">Manage Users</option>}
              </select>
            </div>

            <button
              type="submit"
              disabled={grantMutation.isPending}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: grantMutation.isPending ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: grantMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {grantMutation.isPending ? 'Granting...' : 'Grant Permission'}
            </button>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ color: '#888' }}>
          Total permissions: {data?.permissions.length || 0}
        </p>
      </div>

      {data?.permissions && data.permissions.length > 0 ? (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: '#2d2d2d',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#1a1a1a' }}>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Resource</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Permission</th>
              <th style={{ padding: '1rem', textAlign: 'right', color: '#ccc' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.permissions.map((perm) => (
              <tr key={perm.id} style={{ borderTop: '1px solid #444' }}>
                <td style={{ padding: '1rem', color: '#fff' }}>{getResourceName(perm)}</td>
                <td style={{ padding: '1rem' }}>
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                    }}
                  >
                    {formatPermission(perm.permission)}
                  </span>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button
                    onClick={() => handleRevokePermission(perm.id)}
                    disabled={revokeMutation.isPending}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: revokeMutation.isPending ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#888',
            backgroundColor: '#2d2d2d',
            borderRadius: '8px',
          }}
        >
          No permissions granted yet. Click "Grant Permission" to add one.
        </div>
      )}
    </div>
  );
}
