/**
 * API client for ZedOps manager
 *
 * All API calls go through this client to ensure consistent error handling
 * and authentication.
 */

const API_BASE = window.location.origin;

export interface HostMetrics {
  cpuPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  diskUsedGB: number;
  diskTotalGB: number;
  diskPercent: number;
  lastUpdate: number;
}

export interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: number;
  createdAt: number;
  metadata: {
    metrics?: HostMetrics;
  };
}

export interface AgentsResponse {
  agents: Agent[];
  count: number;
}

/**
 * Fetch all agents
 */
export async function fetchAgents(password: string): Promise<AgentsResponse> {
  const response = await fetch(`${API_BASE}/api/agents`, {
    headers: {
      'Authorization': `Bearer ${password}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    throw new Error('Failed to fetch agents');
  }

  return response.json();
}

/**
 * Fetch single agent by ID
 */
export async function fetchAgent(id: string, password: string): Promise<Agent> {
  const response = await fetch(`${API_BASE}/api/agents/${id}`, {
    headers: {
      'Authorization': `Bearer ${password}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    throw new Error('Failed to fetch agent');
  }

  return response.json();
}

/**
 * Generate ephemeral token for agent registration
 */
export async function generateEphemeralToken(
  agentName: string,
  password: string
): Promise<{ token: string; expiresIn: string; agentName: string }> {
  const response = await fetch(`${API_BASE}/api/admin/tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${password}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ agentName }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    throw new Error('Failed to generate token');
  }

  return response.json();
}

/**
 * Container types
 */
export interface PortMapping {
  privatePort: number;
  publicPort: number;
  type: string; // tcp, udp
}

export interface Container {
  id: string;
  names: string[];
  image: string;
  state: string; // running, exited, created, paused, etc.
  status: string; // human-readable status
  created: number; // unix timestamp
  ports: PortMapping[];
}

export interface ContainersResponse {
  containers: Container[];
  count: number;
}

export interface ContainerOperationResponse {
  success: boolean;
  containerId: string;
  operation: string;
  error?: string;
  errorCode?: string;
}

/**
 * Fetch containers for a specific agent
 */
export async function fetchContainers(
  agentId: string,
  password: string
): Promise<ContainersResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/containers`, {
    headers: {
      'Authorization': `Bearer ${password}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    if (response.status === 503) {
      throw new Error('Agent not connected');
    }
    throw new Error('Failed to fetch containers');
  }

  return response.json();
}

/**
 * Start a container
 */
export async function startContainer(
  agentId: string,
  containerId: string,
  password: string
): Promise<ContainerOperationResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/containers/${containerId}/start`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${password}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 503) {
      throw new Error('Agent not connected');
    }
    // For 500 errors, still parse the response to get error details
    const data = await response.json();
    return data;
  }

  return response.json();
}

/**
 * Stop a container
 */
export async function stopContainer(
  agentId: string,
  containerId: string,
  password: string
): Promise<ContainerOperationResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/containers/${containerId}/stop`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${password}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 503) {
      throw new Error('Agent not connected');
    }
    const data = await response.json();
    return data;
  }

  return response.json();
}

/**
 * Restart a container
 */
export async function restartContainer(
  agentId: string,
  containerId: string,
  password: string
): Promise<ContainerOperationResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/containers/${containerId}/restart`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${password}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 503) {
      throw new Error('Agent not connected');
    }
    const data = await response.json();
    return data;
  }

  return response.json();
}

/**
 * Server types
 */
export interface Server {
  id: string;
  agent_id: string;
  name: string;
  container_id: string | null;
  config: string; // JSON string of ENV variables
  image_tag: string;
  game_port: number;
  udp_port: number;
  rcon_port: number;
  status: 'creating' | 'running' | 'stopped' | 'failed' | 'deleting' | 'missing' | 'deleted';
  data_exists: boolean;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface ServerConfig {
  [key: string]: string; // ENV variables as key-value pairs
}

export interface CreateServerRequest {
  name: string;
  imageTag: string;
  config: ServerConfig;
  gamePort?: number;
  udpPort?: number;
  rconPort?: number;
}

export interface ServersResponse {
  success: boolean;
  servers: Server[];
}

export interface CreateServerResponse {
  success: boolean;
  server?: Server;
  error?: string;
}

export interface DeleteServerResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Fetch servers for a specific agent
 */
export async function fetchServers(
  agentId: string,
  password: string
): Promise<ServersResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/servers`, {
    headers: {
      'Authorization': `Bearer ${password}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    throw new Error('Failed to fetch servers');
  }

  return response.json();
}

/**
 * Create a new server
 */
export async function createServer(
  agentId: string,
  request: CreateServerRequest,
  password: string
): Promise<CreateServerResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/servers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${password}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    if (response.status === 409) {
      const data = await response.json();
      throw new Error(data.error || 'Conflict');
    }
    const data = await response.json();
    throw new Error(data.error || 'Failed to create server');
  }

  return response.json();
}

/**
 * Delete a server
 */
export async function deleteServer(
  agentId: string,
  serverId: string,
  removeVolumes: boolean,
  password: string
): Promise<DeleteServerResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/servers/${serverId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${password}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ removeVolumes }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    const data = await response.json();
    return data;
  }

  return response.json();
}

/**
 * Rebuild a server (pull latest image, recreate container, preserve volumes)
 */
export async function rebuildServer(
  agentId: string,
  serverId: string,
  password: string
): Promise<{ success: boolean; message: string; server: Server }> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/servers/${serverId}/rebuild`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${password}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    if (response.status === 400) {
      const data = await response.json();
      throw new Error(data.error || 'Bad request');
    }
    const data = await response.json();
    throw new Error(data.error || 'Failed to rebuild server');
  }

  return response.json();
}

/**
 * Port availability types
 */
export interface PortSet {
  gamePort: number;
  udpPort: number;
  rconPort: number;
}

export interface AllocatedPort {
  gamePort: number;
  udpPort: number;
  rconPort: number;
  serverName: string;
  status: string;
}

export interface PortAvailabilityResponse {
  suggestedPorts: PortSet[];
  allocatedPorts: AllocatedPort[];
  hostBoundPorts: number[];
  agentStatus: string;
}

/**
 * Check port availability for an agent
 */
export async function checkPortAvailability(
  agentId: string,
  count: number,
  password: string
): Promise<PortAvailabilityResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/ports/availability?count=${count}`,
    {
      headers: {
        'Authorization': `Bearer ${password}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    if (response.status === 503) {
      throw new Error('Agent not connected');
    }
    throw new Error('Failed to check port availability');
  }

  return response.json();
}

/**
 * Cleanup all failed servers for an agent
 */
export async function cleanupFailedServers(
  agentId: string,
  removeVolumes: boolean,
  password: string
): Promise<{ success: boolean; message: string; deletedCount: number; errors?: string[] }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/failed?removeVolumes=${removeVolumes}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${password}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    throw new Error('Failed to cleanup failed servers');
  }

  return response.json();
}

/**
 * Start a server (with container recreation if missing)
 */
export async function startServer(
  agentId: string,
  serverId: string,
  password: string
): Promise<{ success: boolean; message: string; serverId: string; containerId: string; recovered?: boolean }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/start`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${password}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to start server');
  }

  return response.json();
}

/**
 * Stop a server
 */
export async function stopServer(
  agentId: string,
  serverId: string,
  password: string
): Promise<{ success: boolean; message: string; serverId: string; containerId: string }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/stop`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${password}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to stop server');
  }

  return response.json();
}

/**
 * Purge a server (hard delete)
 */
export async function purgeServer(
  agentId: string,
  serverId: string,
  removeData: boolean,
  password: string
): Promise<{ success: boolean; message: string; serverId: string; serverName: string }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/purge`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${password}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ removeData }),
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to purge server');
  }

  return response.json();
}

/**
 * Restore a soft-deleted server
 */
export async function restoreServer(
  agentId: string,
  serverId: string,
  password: string
): Promise<{ success: boolean; message: string; serverId: string; serverName: string }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/restore`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${password}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to restore server');
  }

  return response.json();
}

/**
 * Sync server statuses with agent
 */
export async function syncServers(
  agentId: string,
  password: string
): Promise<{ success: boolean; servers: Server[]; synced: number }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/sync`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${password}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid admin password');
    }
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to sync servers');
  }

  return response.json();
}
