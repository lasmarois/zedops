/**
 * Server creation form component
 */

import { useState } from 'react';
import type { CreateServerRequest, ServerConfig } from '../lib/api';

interface ServerFormProps {
  onSubmit: (request: CreateServerRequest) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ServerForm({ onSubmit, onCancel, isSubmitting }: ServerFormProps) {
  const [serverName, setServerName] = useState('');
  const [imageTag, setImageTag] = useState('latest');
  const [serverPublicName, setServerPublicName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [serverPassword, setServerPassword] = useState('');
  const [nameError, setNameError] = useState('');

  const validateServerName = (name: string): boolean => {
    const nameRegex = /^[a-z][a-z0-9-]{2,31}$/;
    if (!name) {
      setNameError('Server name is required');
      return false;
    }
    if (!nameRegex.test(name)) {
      setNameError('Must be 3-32 chars, start with letter, lowercase alphanumeric and hyphens only');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateServerName(serverName)) {
      return;
    }

    if (!adminPassword) {
      alert('Admin password is required');
      return;
    }

    const config: ServerConfig = {
      SERVER_NAME: serverName,
      SERVER_PUBLIC_NAME: serverPublicName || `${serverName} Server`,
      ADMIN_PASSWORD: adminPassword,
      SERVER_PASSWORD: serverPassword,
    };

    const request: CreateServerRequest = {
      name: serverName,
      imageTag,
      config,
    };

    onSubmit(request);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Create New Server</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="serverName"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
            >
              Server Name *
            </label>
            <input
              id="serverName"
              type="text"
              value={serverName}
              onChange={(e) => {
                setServerName(e.target.value.toLowerCase());
                validateServerName(e.target.value.toLowerCase());
              }}
              placeholder="myserver"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: nameError ? '1px solid #dc3545' : '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
            {nameError && (
              <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {nameError}
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem' }}>
              Used for container name and data directories
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="imageTag"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
            >
              Image Tag
            </label>
            <select
              id="imageTag"
              value={imageTag}
              onChange={(e) => setImageTag(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            >
              <option value="latest">latest (v2.1.0)</option>
              <option value="2.1.0">2.1.0</option>
              <option value="2.1">2.1</option>
              <option value="2.0.1">2.0.1</option>
              <option value="2.0.0">2.0.0</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="serverPublicName"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
            >
              Public Server Name
            </label>
            <input
              id="serverPublicName"
              type="text"
              value={serverPublicName}
              onChange={(e) => setServerPublicName(e.target.value)}
              placeholder="My Project Zomboid Server"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
            <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem' }}>
              Displayed in server browser
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="adminPassword"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
            >
              Admin Password *
            </label>
            <input
              id="adminPassword"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin password for server management"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="serverPassword"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
            >
              Server Password
            </label>
            <input
              id="serverPassword"
              type="password"
              value={serverPassword}
              onChange={(e) => setServerPassword(e.target.value)}
              placeholder="Leave empty for public server"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
            <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem' }}>
              Optional: Password required to join server
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
