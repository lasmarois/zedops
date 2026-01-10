/**
 * Server creation form component
 */

import { useState } from 'react';
import type { CreateServerRequest, ServerConfig, PortSet, Server } from '../lib/api';
import { usePortAvailability } from '../hooks/usePortAvailability';

interface ServerFormProps {
  agentId: string;
  onSubmit: (request: CreateServerRequest, serverIdToDelete?: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  editServer?: Server; // Optional: Pre-fill form for editing failed server
}

export function ServerForm({ agentId, onSubmit, onCancel, isSubmitting, editServer }: ServerFormProps) {
  // Parse config from editServer if editing
  const editConfig = editServer ? (JSON.parse(editServer.config) as ServerConfig) : null;

  const [serverName, setServerName] = useState(editServer?.name || '');
  const [imageTag, setImageTag] = useState(editServer?.image_tag || 'latest');
  const [serverPublicName, setServerPublicName] = useState(editConfig?.SERVER_PUBLIC_NAME || '');
  const [adminPassword, setAdminPassword] = useState(editConfig?.ADMIN_PASSWORD || '');
  const [serverPassword, setServerPassword] = useState(editConfig?.SERVER_PASSWORD || '');
  const [nameError, setNameError] = useState('');

  // Port configuration
  const [showPortConfig, setShowPortConfig] = useState(!!editServer); // Auto-expand if editing
  const [checkPorts, setCheckPorts] = useState(false);
  const [useCustomPorts, setUseCustomPorts] = useState(!!editServer); // Auto-enable if editing
  const [customGamePort, setCustomGamePort] = useState(editServer?.game_port?.toString() || '');
  const [customUdpPort, setCustomUdpPort] = useState(editServer?.udp_port?.toString() || '');
  const [customRconPort, setCustomRconPort] = useState(editServer?.rcon_port?.toString() || '');

  // Port availability query (manual trigger via checkPorts state)
  const portAvailability = usePortAvailability(agentId, 3, checkPorts);

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

    // Add custom ports if specified
    if (useCustomPorts && customGamePort && customUdpPort && customRconPort) {
      request.gamePort = parseInt(customGamePort);
      request.udpPort = parseInt(customUdpPort);
      request.rconPort = parseInt(customRconPort);
    }

    // Pass serverIdToDelete if editing (to remove old failed server)
    onSubmit(request, editServer?.id);
  };

  const handleCheckAvailability = () => {
    setCheckPorts(true);
    // Reset after a short delay to allow re-checking
    setTimeout(() => setCheckPorts(false), 100);
  };

  const getPortStatus = (port: number): 'available' | 'unavailable' | 'unknown' => {
    if (!portAvailability.data) return 'unknown';
    if (portAvailability.data.hostBoundPorts.includes(port)) return 'unavailable';

    // Check if port is in any allocated server
    const isAllocated = portAvailability.data.allocatedPorts.some(
      (p) => p.gamePort === port || p.udpPort === port || p.rconPort === port
    );
    if (isAllocated) return 'unavailable';

    return 'available';
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
        <h2 style={{ marginTop: 0 }}>{editServer ? 'Edit & Retry Server' : 'Create New Server'}</h2>
        {editServer && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <strong>Editing failed server:</strong> {editServer.name} - Adjust configuration and retry. The old failed entry will be removed.
          </div>
        )}

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

          {/* Port Configuration Section */}
          <div style={{ marginBottom: '1.5rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
            <button
              type="button"
              onClick={() => setShowPortConfig(!showPortConfig)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#f8f9fa',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 'bold',
                fontSize: '1rem',
              }}
            >
              <span>Port Configuration (Optional)</span>
              <span>{showPortConfig ? '▼' : '▶'}</span>
            </button>

            {showPortConfig && (
              <div style={{ padding: '1rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleCheckAvailability}
                    disabled={portAvailability.isFetching}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: portAvailability.isFetching ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      opacity: portAvailability.isFetching ? 0.6 : 1,
                    }}
                  >
                    {portAvailability.isFetching ? 'Checking...' : 'Check Port Availability'}
                  </button>
                </div>

                {portAvailability.isError && (
                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#f8d7da',
                      color: '#721c24',
                      borderRadius: '4px',
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    Failed to check port availability. The agent may be offline.
                  </div>
                )}

                {portAvailability.data && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 'bold',
                        marginBottom: '0.5rem',
                        color: '#495057',
                      }}
                    >
                      Suggested Available Ports:
                    </div>
                    {portAvailability.data.suggestedPorts.map((portSet: PortSet, index: number) => (
                      <div
                        key={index}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#d4edda',
                          border: '1px solid #c3e6cb',
                          borderRadius: '4px',
                          marginBottom: '0.5rem',
                          fontSize: '0.875rem',
                        }}
                      >
                        <div>
                          <strong>Option {index + 1}:</strong> Game Port: {portSet.gamePort}, UDP
                          Port: {portSet.udpPort}, RCON Port: {portSet.rconPort}
                        </div>
                      </div>
                    ))}

                    {portAvailability.data.allocatedPorts.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 'bold',
                            marginBottom: '0.5rem',
                            color: '#495057',
                          }}
                        >
                          Currently Allocated Ports:
                        </div>
                        {portAvailability.data.allocatedPorts.map((port, index) => (
                          <div
                            key={index}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#fff3cd',
                              border: '1px solid #ffeaa7',
                              borderRadius: '4px',
                              marginBottom: '0.5rem',
                              fontSize: '0.875rem',
                            }}
                          >
                            <strong>{port.serverName}</strong> ({port.status}): {port.gamePort}-
                            {port.udpPort}, RCON: {port.rconPort}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={useCustomPorts}
                      onChange={(e) => setUseCustomPorts(e.target.checked)}
                      style={{ marginRight: '0.5rem', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                      Specify Custom Ports
                    </span>
                  </label>
                </div>

                {useCustomPorts && (
                  <div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label
                        htmlFor="customGamePort"
                        style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}
                      >
                        Game Port (UDP)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          id="customGamePort"
                          type="number"
                          value={customGamePort}
                          onChange={(e) => setCustomGamePort(e.target.value)}
                          placeholder="16261"
                          min="1024"
                          max="65535"
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                          }}
                        />
                        {customGamePort && (
                          <span style={{ fontSize: '0.875rem' }}>
                            {getPortStatus(parseInt(customGamePort)) === 'available' && (
                              <span style={{ color: '#28a745' }}>✓ Available</span>
                            )}
                            {getPortStatus(parseInt(customGamePort)) === 'unavailable' && (
                              <span style={{ color: '#dc3545' }}>✗ In Use</span>
                            )}
                            {getPortStatus(parseInt(customGamePort)) === 'unknown' && (
                              <span style={{ color: '#6c757d' }}>? Unknown</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: '0.75rem' }}>
                      <label
                        htmlFor="customUdpPort"
                        style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}
                      >
                        UDP Port (Game Port + 1)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          id="customUdpPort"
                          type="number"
                          value={customUdpPort}
                          onChange={(e) => setCustomUdpPort(e.target.value)}
                          placeholder="16262"
                          min="1024"
                          max="65535"
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                          }}
                        />
                        {customUdpPort && (
                          <span style={{ fontSize: '0.875rem' }}>
                            {getPortStatus(parseInt(customUdpPort)) === 'available' && (
                              <span style={{ color: '#28a745' }}>✓ Available</span>
                            )}
                            {getPortStatus(parseInt(customUdpPort)) === 'unavailable' && (
                              <span style={{ color: '#dc3545' }}>✗ In Use</span>
                            )}
                            {getPortStatus(parseInt(customUdpPort)) === 'unknown' && (
                              <span style={{ color: '#6c757d' }}>? Unknown</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: '0.75rem' }}>
                      <label
                        htmlFor="customRconPort"
                        style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}
                      >
                        RCON Port (TCP, Internal)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          id="customRconPort"
                          type="number"
                          value={customRconPort}
                          onChange={(e) => setCustomRconPort(e.target.value)}
                          placeholder="27015"
                          min="1024"
                          max="65535"
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                          }}
                        />
                        {customRconPort && (
                          <span style={{ fontSize: '0.875rem' }}>
                            {getPortStatus(parseInt(customRconPort)) === 'available' && (
                              <span style={{ color: '#28a745' }}>✓ Available</span>
                            )}
                            {getPortStatus(parseInt(customRconPort)) === 'unavailable' && (
                              <span style={{ color: '#dc3545' }}>✗ In Use</span>
                            )}
                            {getPortStatus(parseInt(customRconPort)) === 'unknown' && (
                              <span style={{ color: '#6c757d' }}>? Unknown</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#6c757d',
                        marginTop: '0.5rem',
                        lineHeight: 1.4,
                      }}
                    >
                      <strong>Note:</strong> If no ports are specified, the system will automatically
                      assign the next available ports.
                    </div>
                  </div>
                )}
              </div>
            )}
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
              {isSubmitting
                ? editServer
                  ? 'Retrying...'
                  : 'Creating...'
                : editServer
                ? 'Retry Server'
                : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
