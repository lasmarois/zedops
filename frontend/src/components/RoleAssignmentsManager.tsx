/**
 * Role Assignments Manager Component
 *
 * Manages user role assignments using the new RBAC system.
 * Replaces the old PermissionsManager with role-based assignments.
 */

import { useState } from 'react';
import {
  useUserRoleAssignments,
  useGrantRoleAssignment,
  useRevokeRoleAssignment,
} from '../hooks/useUsers';
import { useAgents } from '../hooks/useAgents';
import type { UserAccount, RoleAssignment } from '../lib/api';

interface RoleAssignmentsManagerProps {
  user: UserAccount;
  onBack: () => void;
}

export function RoleAssignmentsManager({ user, onBack }: RoleAssignmentsManagerProps) {
  const { data, isLoading, error } = useUserRoleAssignments(user.id);
  const { data: agentsData } = useAgents();
  const grantMutation = useGrantRoleAssignment();
  const revokeMutation = useRevokeRoleAssignment();

  const [showGrantForm, setShowGrantForm] = useState(false);
  const [role, setRole] = useState<'agent-admin' | 'operator' | 'viewer'>('viewer');
  const [scope, setScope] = useState<'global' | 'agent' | 'server'>('agent');
  const [resourceId, setResourceId] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGrantRoleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate constraints
    if (role === 'agent-admin' && scope !== 'agent') {
      setMessage({
        type: 'error',
        text: 'agent-admin role can only be assigned at agent scope',
      });
      return;
    }

    if (scope === 'global' && resourceId) {
      setMessage({
        type: 'error',
        text: 'global scope cannot have a resource ID',
      });
      return;
    }

    if (scope !== 'global' && !resourceId) {
      setMessage({
        type: 'error',
        text: `${scope} scope requires a resource ID`,
      });
      return;
    }

    try {
      await grantMutation.mutateAsync({
        userId: user.id,
        role,
        scope,
        resourceId: scope === 'global' ? null : resourceId || null,
      });
      setMessage({ type: 'success', text: 'Role assignment granted successfully' });
      setShowGrantForm(false);
      setResourceId('');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to grant role assignment',
      });
    }
  };

  const handleRevokeRoleAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to revoke this role assignment?')) {
      return;
    }

    try {
      await revokeMutation.mutateAsync({ assignmentId, userId: user.id });
      setMessage({ type: 'success', text: 'Role assignment revoked successfully' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to revoke role assignment',
      });
    }
  };

  const getResourceName = (assignment: RoleAssignment) => {
    if (assignment.scope === 'global') {
      return 'Global (all agents & servers)';
    }
    if (assignment.scope === 'agent' && assignment.resource_id) {
      const agent = agentsData?.agents.find((a) => a.id === assignment.resource_id);
      return agent ? `Agent: ${agent.name}` : `Agent: ${assignment.resource_id}`;
    }
    if (assignment.scope === 'server' && assignment.resource_id) {
      return `Server: ${assignment.resource_id}`;
    }
    return assignment.scope;
  };

  const formatRole = (role: string) => {
    const roleNames: Record<string, string> = {
      'agent-admin': 'Agent Admin',
      'operator': 'Operator',
      'viewer': 'Viewer',
    };
    return roleNames[role] || role;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      'agent-admin': '#28a745',
      'operator': '#007bff',
      'viewer': '#6c757d',
    };
    return colors[role] || '#6c757d';
  };

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading role assignments...</div>;
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
          <h1 style={{ display: 'inline' }}>Role Assignments for {user.email}</h1>
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
          {showGrantForm ? 'Cancel' : '+ Grant Role'}
        </button>
      </div>

      {/* System Role Badge */}
      {data?.user.systemRole === 'admin' && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#d4edda',
            color: '#155724',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
          }}
        >
          <strong>System Admin:</strong> This user has global admin access and bypasses all permission checks.
          Role assignments are not needed.
        </div>
      )}

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
          <h2 style={{ marginTop: 0 }}>Grant New Role Assignment</h2>
          <form onSubmit={handleGrantRoleAssignment}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="role"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ccc',
                }}
              >
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as 'agent-admin' | 'operator' | 'viewer');
                  // Reset scope if agent-admin (must be agent scope)
                  if (e.target.value === 'agent-admin' && scope !== 'agent') {
                    setScope('agent');
                  }
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
                <option value="viewer">Viewer (read-only)</option>
                <option value="operator">Operator (control + RCON)</option>
                <option value="agent-admin">Agent Admin (full control of agent)</option>
              </select>
              <small style={{ color: '#888', display: 'block', marginTop: '0.25rem' }}>
                {role === 'viewer' && 'Can view servers and logs'}
                {role === 'operator' && 'Can start/stop/restart servers and use RCON'}
                {role === 'agent-admin' && 'Can create/delete servers on assigned agent'}
              </small>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="scope"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ccc',
                }}
              >
                Scope
              </label>
              <select
                id="scope"
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value as 'global' | 'agent' | 'server');
                  setResourceId('');
                }}
                disabled={role === 'agent-admin'}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: role === 'agent-admin' ? '#333' : '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: role === 'agent-admin' ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="global">Global (all agents & servers)</option>
                <option value="agent">Agent (all servers on agent)</option>
                <option value="server">Server (specific server only)</option>
              </select>
              {role === 'agent-admin' && (
                <small style={{ color: '#ffc107', display: 'block', marginTop: '0.25rem' }}>
                  agent-admin role can only be assigned at agent scope
                </small>
              )}
            </div>

            {scope !== 'global' && (
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="resourceId"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: '#ccc',
                  }}
                >
                  {scope === 'agent' ? 'Agent' : 'Server ID'}
                </label>
                {scope === 'agent' ? (
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
                    required
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
              {grantMutation.isPending ? 'Granting...' : 'Grant Role'}
            </button>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ color: '#888' }}>
          Total role assignments: {data?.roleAssignments.length || 0}
        </p>
      </div>

      {data?.roleAssignments && data.roleAssignments.length > 0 ? (
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
              <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Role</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Scope</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Resource</th>
              <th style={{ padding: '1rem', textAlign: 'right', color: '#ccc' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.roleAssignments.map((assignment) => (
              <tr key={assignment.id} style={{ borderTop: '1px solid #444' }}>
                <td style={{ padding: '1rem' }}>
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: getRoleBadgeColor(assignment.role),
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                    }}
                  >
                    {formatRole(assignment.role)}
                  </span>
                </td>
                <td style={{ padding: '1rem', color: '#fff', textTransform: 'capitalize' }}>
                  {assignment.scope}
                </td>
                <td style={{ padding: '1rem', color: '#fff' }}>{getResourceName(assignment)}</td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button
                    onClick={() => handleRevokeRoleAssignment(assignment.id)}
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
          No role assignments yet. Click "Grant Role" to add one.
          {data?.user.systemRole !== 'admin' && (
            <>
              <br />
              <br />
              <small style={{ color: '#ffc107' }}>
                This user has no access until roles are assigned.
              </small>
            </>
          )}
        </div>
      )}
    </div>
  );
}
