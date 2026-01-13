/**
 * User list component for managing users
 */

import { useState } from 'react';
import { useUsers, useDeleteUser, useInviteUser } from '../hooks/useUsers';
import { useUser } from '../contexts/UserContext';
import type { UserAccount } from '../lib/api';

interface UserListProps {
  onBack: () => void;
  onManagePermissions: (user: UserAccount) => void;
}

export function UserList({ onBack, onManagePermissions }: UserListProps) {
  const { data, isLoading, error } = useUsers();
  const { user: currentUser } = useUser();
  const deleteUserMutation = useDeleteUser();
  const inviteUserMutation = useInviteUser();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const result = await inviteUserMutation.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
      });

      if (result.success && result.invitation) {
        const inviteUrl = `${window.location.origin}/register?token=${result.invitation.token}`;
        setInviteToken(inviteUrl);
        setMessage({
          type: 'success',
          text: 'User invited successfully! Share the invitation link below.',
        });
        setInviteEmail('');
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to invite user',
      });
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}?`)) {
      return;
    }

    try {
      await deleteUserMutation.mutateAsync(userId);
      setMessage({ type: 'success', text: 'User deleted successfully' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete user',
      });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading users...</div>;
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

  const isAdmin = currentUser?.role === 'admin';

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
          <h1 style={{ display: 'inline' }}>User Management</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setShowInviteForm(!showInviteForm);
              setInviteToken(null);
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
            {showInviteForm ? 'Cancel' : '+ Invite User'}
          </button>
        )}
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

      {showInviteForm && (
        <div
          style={{
            backgroundColor: '#2d2d2d',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Invite New User</h2>
          <form onSubmit={handleInviteUser}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ccc',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
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
            </div>

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
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'user')}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={inviteUserMutation.isPending}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: inviteUserMutation.isPending ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: inviteUserMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {inviteUserMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>

          {inviteToken && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
              <p style={{ color: '#ccc', marginBottom: '0.5rem' }}>Invitation Link:</p>
              <code
                style={{
                  display: 'block',
                  padding: '0.5rem',
                  backgroundColor: '#000',
                  color: '#0f0',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  fontSize: '0.875rem',
                }}
              >
                {inviteToken}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteToken);
                  setMessage({ type: 'success', text: 'Link copied to clipboard!' });
                }}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Copy Link
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ color: '#888' }}>Total users: {data?.users.length || 0}</p>
      </div>

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
            <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Email</th>
            <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Role</th>
            <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Created</th>
            <th style={{ padding: '1rem', textAlign: 'right', color: '#ccc' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.users.map((user) => (
            <tr
              key={user.id}
              style={{
                borderTop: '1px solid #444',
              }}
            >
              <td style={{ padding: '1rem', color: '#fff' }}>
                {user.email}
                {user.id === currentUser?.id && (
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                    }}
                  >
                    You
                  </span>
                )}
              </td>
              <td style={{ padding: '1rem' }}>
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: user.role === 'admin' ? '#dc3545' : '#6c757d',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                >
                  {user.role === 'admin' ? 'admin' : 'user'}
                </span>
                {!user.role && (
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#888',
                    }}
                  >
                    (role assignments)
                  </span>
                )}
              </td>
              <td style={{ padding: '1rem', color: '#ccc', fontSize: '0.875rem' }}>
                {formatDate(user.created_at)}
              </td>
              <td style={{ padding: '1rem', textAlign: 'right' }}>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => onManagePermissions(user)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginRight: '0.5rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      Permissions
                    </button>
                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={deleteUserMutation.isPending}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: deleteUserMutation.isPending ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data?.users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
          No users found.
        </div>
      )}
    </div>
  );
}
