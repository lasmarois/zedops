/**
 * Audit log viewer component
 */

import { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { useUsers } from '../hooks/useUsers';
import type { AuditLogsQuery } from '../lib/api';

interface AuditLogViewerProps {
  onBack: () => void;
}

export function AuditLogViewer({ onBack }: AuditLogViewerProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState<Omit<AuditLogsQuery, 'page' | 'pageSize'>>({});
  const [showFilters, setShowFilters] = useState(false);

  const query: AuditLogsQuery = {
    page,
    pageSize,
    ...filters,
  };

  const { data, isLoading, error } = useAuditLogs(query);
  const { data: usersData } = useUsers();

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('revoke')) return '#dc3545';
    if (action.includes('create') || action.includes('grant')) return '#28a745';
    if (action.includes('update') || action.includes('modify')) return '#ffc107';
    return '#007bff';
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading audit logs...</div>;
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
          <h1 style={{ display: 'inline' }}>Audit Logs</h1>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {showFilters && (
        <div
          style={{
            backgroundColor: '#2d2d2d',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Filters</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <label
                htmlFor="userId"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ccc',
                }}
              >
                User
              </label>
              <select
                id="userId"
                value={filters.userId || ''}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                }}
              >
                <option value="">All Users</option>
                {usersData?.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="action"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ccc',
                }}
              >
                Action
              </label>
              <select
                id="action"
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                }}
              >
                <option value="">All Actions</option>
                <option value="user_login">User Login</option>
                <option value="user_logout">User Logout</option>
                <option value="user_created">User Created</option>
                <option value="user_deleted">User Deleted</option>
                <option value="permission_granted">Permission Granted</option>
                <option value="permission_revoked">Permission Revoked</option>
                <option value="server_created">Server Created</option>
                <option value="server_deleted">Server Deleted</option>
                <option value="server_started">Server Started</option>
                <option value="server_stopped">Server Stopped</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="targetType"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#ccc',
                }}
              >
                Target Type
              </label>
              <select
                id="targetType"
                value={filters.targetType || ''}
                onChange={(e) => handleFilterChange('targetType', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                }}
              >
                <option value="">All Types</option>
                <option value="user">User</option>
                <option value="server">Server</option>
                <option value="agent">Agent</option>
                <option value="permission">Permission</option>
              </select>
            </div>
          </div>

          <button
            onClick={clearFilters}
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
            Clear Filters
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <p style={{ color: '#888' }}>
          Showing {data?.logs.length || 0} of {data?.total || 0} logs
        </p>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: page === 1 ? '#444' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ color: '#ccc' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: page === totalPages ? '#444' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {data?.logs && data.logs.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
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
                <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Timestamp</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>User</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Action</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Target</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>Details</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#ccc' }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.id} style={{ borderTop: '1px solid #444' }}>
                  <td
                    style={{
                      padding: '1rem',
                      color: '#ccc',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(log.timestamp)}
                  </td>
                  <td style={{ padding: '1rem', color: '#fff' }}>{log.user_email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: getActionColor(log.action),
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                      }}
                    >
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#ccc', fontSize: '0.875rem' }}>
                    {log.target_type && log.target_id ? (
                      <>
                        <span style={{ color: '#888' }}>{log.target_type}:</span>{' '}
                        {log.target_id.substring(0, 8)}...
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td
                    style={{
                      padding: '1rem',
                      color: '#ccc',
                      fontSize: '0.875rem',
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {log.details || '-'}
                  </td>
                  <td style={{ padding: '1rem', color: '#888', fontSize: '0.875rem' }}>
                    {log.ip_address}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          No audit logs found.
        </div>
      )}
    </div>
  );
}
