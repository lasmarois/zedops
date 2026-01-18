/**
 * API client for ZedOps manager
 *
 * All API calls go through this client to ensure consistent error handling
 * and authentication.
 */

import { getToken } from './auth';

const API_BASE = window.location.origin;

/**
 * Get authentication headers with JWT token
 */
function getAuthHeaders(): HeadersInit {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Handle authentication errors
 */
function handleAuthError(response: Response): void {
  if (response.status === 401) {
    // Clear invalid token and reload to show login
    localStorage.removeItem('zedops_token');
    localStorage.removeItem('zedops_user');
    window.location.href = '/';
  }
}

export interface DiskMetric {
  path: string;
  mountPoint: string;
  label: string;
  usedGB: number;
  totalGB: number;
  percent: number;
}

export interface HostMetrics {
  cpuPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  disks?: DiskMetric[];  // New format (array of volumes)
  // Legacy fields for backward compatibility with old agent
  diskUsedGB?: number;
  diskTotalGB?: number;
  diskPercent?: number;
  timestamp?: number;
  lastUpdate?: number;
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
export async function fetchAgents(): Promise<AgentsResponse> {
  const response = await fetch(`${API_BASE}/api/agents`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    throw new Error('Failed to fetch agents');
  }

  return response.json();
}

/**
 * Fetch single agent by ID
 */
export async function fetchAgent(id: string): Promise<Agent> {
  const response = await fetch(`${API_BASE}/api/agents/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    throw new Error('Failed to fetch agent');
  }

  return response.json();
}

/**
 * Fetch agent configuration
 */
export interface AgentConfig {
  server_data_path: string;
  steam_zomboid_registry: string;
}

export async function fetchAgentConfig(agentId: string): Promise<AgentConfig> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/config`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    if (response.status === 403) {
      throw new Error('Insufficient permissions - admin role required');
    }
    throw new Error('Failed to fetch agent configuration');
  }

  const data = await response.json();
  return data.config;
}

/**
 * Update agent configuration
 */
export async function updateAgentConfig(
  agentId: string,
  config: Partial<AgentConfig>
): Promise<AgentConfig> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/config`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    handleAuthError(response);
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    if (response.status === 403) {
      throw new Error('Insufficient permissions - admin role required');
    }
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Invalid configuration');
    }
    throw new Error('Failed to update agent configuration');
  }

  const data = await response.json();
  return data.config;
}

/**
 * Generate ephemeral token for agent registration
 */
export async function generateEphemeralToken(
  agentName: string
): Promise<{ token: string; expiresIn: string; agentName: string }> {
  const response = await fetch(`${API_BASE}/api/admin/tokens`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ agentName }),
  });

  if (!response.ok) {
    handleAuthError(response);
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
  health?: string; // health check status: "starting", "healthy", "unhealthy", or undefined (no healthcheck)
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
 * Server metrics types
 */
export interface ServerMetrics {
  containerId: string;
  cpuPercent: number;
  memoryUsedMB: number;
  memoryLimitMB: number;
  diskReadMB: number;
  diskWriteMB: number;
  uptime: string;        // Human-readable: "2h 34m"
  uptimeSeconds: number; // Raw seconds
}

export interface ServerMetricsResponse {
  success: boolean;
  metrics: ServerMetrics;
  error?: string;
  message?: string;
}

/**
 * Fetch containers for a specific agent
 */
export async function fetchContainers(
  agentId: string
): Promise<ContainersResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/containers`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
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
  containerId: string
): Promise<ContainerOperationResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/containers/${containerId}/start`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
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
  containerId: string
): Promise<ContainerOperationResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/containers/${containerId}/stop`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
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
  containerId: string
): Promise<ContainerOperationResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/containers/${containerId}/restart`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
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
  agent_name: string;
  agent_status: 'online' | 'offline';
  agent_server_data_path: string | null; // Agent's default data path
  steam_zomboid_registry: string | null; // M9.8.32: Agent's default registry
  name: string;
  container_id: string | null;
  config: string; // JSON string of ENV variables
  image: string | null; // M9.8.32: Per-server image override (NULL = use agent default)
  image_tag: string;
  game_port: number;
  udp_port: number;
  rcon_port: number;
  server_data_path: string | null; // M9.8.23: Per-server data path override (NULL = use agent default)
  status: 'creating' | 'running' | 'stopped' | 'failed' | 'deleting' | 'missing' | 'deleted';
  health?: string; // Container health check status: "starting", "healthy", "unhealthy", or undefined
  // M9.8.41: Player stats from RCON polling
  player_count: number | null;
  max_players: number | null;
  players: string[] | null;
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
  image?: string; // M9.8.32: Custom registry override (optional, NULL = use agent default)
  imageTag: string;
  config: ServerConfig;
  gamePort?: number;
  udpPort?: number;
  rconPort?: number;
  server_data_path?: string; // M9.8.23: Optional per-server data path override
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
  agentId: string
): Promise<ServersResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/servers`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
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
  request: CreateServerRequest
): Promise<CreateServerResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/servers`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    handleAuthError(response);
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
  removeVolumes: boolean
): Promise<DeleteServerResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/servers/${serverId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ removeVolumes }),
  });

  if (!response.ok) {
    handleAuthError(response);
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
  serverId: string
): Promise<{ success: boolean; message: string; server: Server }> {
  const response = await fetch(`${API_BASE}/api/agents/${agentId}/servers/${serverId}/rebuild`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    handleAuthError(response);
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
 * Update server configuration (Save step - no restart)
 * M9.8.32: Added image parameter for custom registry override
 */
export async function updateServerConfig(
  agentId: string,
  serverId: string,
  config: Record<string, string>,
  imageTag?: string,
  serverDataPath?: string | null,
  image?: string | null  // M9.8.32: Custom registry override
): Promise<{
  success: boolean;
  message: string;
  pendingRestart: boolean;
  dataPathChanged: boolean;
  configChanged: boolean;
  imageTagChanged: boolean;
  imageChanged?: boolean;  // M9.8.32
  oldDataPath?: string; // M9.8.29: Returned when dataPathChanged is true
}> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/config`,
    {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config, image, imageTag, serverDataPath }),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    if (response.status === 400) {
      const data = await response.json();
      throw new Error(data.error || 'Invalid configuration');
    }
    const data = await response.json();
    throw new Error(data.error || 'Failed to update configuration');
  }

  return response.json();
}

/**
 * Apply server configuration changes (restart container with new config)
 * M9.8.29: Optional oldDataPath triggers data migration before rebuild
 */
export async function applyServerConfig(
  agentId: string,
  serverId: string,
  oldDataPath?: string
): Promise<{ success: boolean; message: string; server: Server }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/apply-config`,
    {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      // M9.8.29: Include oldDataPath in body if provided (for data migration)
      body: oldDataPath ? JSON.stringify({ oldDataPath }) : undefined,
    }
  );

  if (!response.ok) {
    handleAuthError(response);
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    if (response.status === 400) {
      const data = await response.json();
      throw new Error(data.error || 'Cannot apply configuration');
    }
    const data = await response.json();
    throw new Error(data.error || 'Failed to apply configuration');
  }

  return response.json();
}

/**
 * Fetch default ENV variables from Docker image
 * Queries the agent to inspect the image and return default values
 */
export async function fetchImageDefaults(
  agentId: string,
  imageTag: string
): Promise<Record<string, string>> {
  // Use query parameter to avoid issues with slashes in image names
  const encodedTag = encodeURIComponent(imageTag);
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/images/defaults?tag=${encodedTag}`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    if (response.status === 503) {
      throw new Error('Agent not connected');
    }
    const data = await response.json();
    throw new Error(data.error || 'Failed to fetch image defaults');
  }

  const data = await response.json();
  return data.defaults || {};
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
  count: number
): Promise<PortAvailabilityResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/ports/availability?count=${count}`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
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
  removeVolumes: boolean
): Promise<{ success: boolean; message: string; deletedCount: number; errors?: string[] }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/failed?removeVolumes=${removeVolumes}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
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
  serverId: string
): Promise<{ success: boolean; message: string; serverId: string; containerId: string; recovered?: boolean }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/start`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
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
  serverId: string
): Promise<{ success: boolean; message: string; serverId: string; containerId: string }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/stop`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
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
  removeData: boolean
): Promise<{ success: boolean; message: string; serverId: string; serverName: string }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/purge`,
    {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ removeData }),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
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
  serverId: string
): Promise<{ success: boolean; message: string; serverId: string; serverName: string }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/restore`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
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
  agentId: string
): Promise<{ success: boolean; servers: Server[]; synced: number }> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/sync`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
    if (response.status === 404) {
      throw new Error('Agent not found');
    }
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to sync servers');
  }

  return response.json();
}

/**
 * Fetch server metrics (CPU, memory, disk, uptime)
 */
export async function fetchServerMetrics(
  agentId: string,
  serverId: string
): Promise<ServerMetricsResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/metrics`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || 'Cannot collect metrics');
    }
    if (response.status === 503) {
      throw new Error('Agent not connected');
    }
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch server metrics');
  }

  return response.json();
}

// ============================================================================
// User Management
// ============================================================================

export interface UserAccount {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: number;
}

export interface UsersResponse {
  users: UserAccount[];
}

export interface InviteUserRequest {
  email: string;
  role: 'admin' | 'user';
}

export interface InviteUserResponse {
  success: boolean;
  invitation?: {
    id: string;
    email: string;
    role: string;
    token: string;
    expiresAt: number;
  };
  error?: string;
}

export interface Permission {
  id: string;
  user_id: string;
  resource_type: 'agent' | 'server' | 'global';
  resource_id: string | null;
  permission: 'view' | 'control' | 'delete' | 'manage_users';
  created_at: number;
}

export interface UserPermissionsResponse {
  user: UserAccount;
  permissions: Permission[];
}

/**
 * Fetch all users
 */
export async function fetchUsers(): Promise<UsersResponse> {
  const response = await fetch(`${API_BASE}/api/users`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

/**
 * Invite a new user
 */
export async function inviteUser(request: InviteUserRequest): Promise<InviteUserResponse> {
  const response = await fetch(`${API_BASE}/api/users/invite`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    handleAuthError(response);
    const data = await response.json();
    throw new Error(data.error || 'Failed to invite user');
  }

  return response.json();
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete user');
  }

  return response.json();
}

/**
 * Get user permissions
 */
export async function fetchUserPermissions(userId: string): Promise<UserPermissionsResponse> {
  const response = await fetch(`${API_BASE}/api/permissions/${userId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    throw new Error('Failed to fetch user permissions');
  }

  return response.json();
}

/**
 * Grant a permission to a user
 */
export async function grantPermission(
  userId: string,
  resourceType: 'agent' | 'server' | 'global',
  resourceId: string | null,
  permission: 'view' | 'control' | 'delete' | 'manage_users'
): Promise<{ success: boolean; permission: Permission }> {
  const response = await fetch(`${API_BASE}/api/permissions/${userId}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resourceType, resourceId, permission }),
  });

  if (!response.ok) {
    handleAuthError(response);
    const data = await response.json();
    throw new Error(data.error || 'Failed to grant permission');
  }

  return response.json();
}

/**
 * Revoke a permission
 */
export async function revokePermission(permissionId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/permissions/${permissionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    const data = await response.json();
    throw new Error(data.error || 'Failed to revoke permission');
  }

  return response.json();
}

// ============================================================================
// Role Assignments (New RBAC System)
// ============================================================================

export interface RoleAssignment {
  id: string;
  user_id: string;
  role: 'agent-admin' | 'operator' | 'viewer';
  scope: 'global' | 'agent' | 'server';
  resource_id: string | null;
  created_at: number;
}

export interface UserRoleAssignmentsResponse {
  user: {
    id: string;
    email: string;
    systemRole: 'admin' | null;
  };
  roleAssignments: RoleAssignment[];
}

/**
 * Get user role assignments
 */
export async function fetchUserRoleAssignments(userId: string): Promise<UserRoleAssignmentsResponse> {
  const response = await fetch(`${API_BASE}/api/role-assignments/${userId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    throw new Error('Failed to fetch user role assignments');
  }

  return response.json();
}

/**
 * Grant a role assignment to a user
 */
export async function grantRoleAssignment(
  userId: string,
  role: 'agent-admin' | 'operator' | 'viewer',
  scope: 'global' | 'agent' | 'server',
  resourceId: string | null
): Promise<{ success: boolean; roleAssignment: RoleAssignment }> {
  const response = await fetch(`${API_BASE}/api/role-assignments/${userId}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role, scope, resourceId }),
  });

  if (!response.ok) {
    handleAuthError(response);
    const data = await response.json();
    throw new Error(data.error || 'Failed to grant role assignment');
  }

  return response.json();
}

/**
 * Revoke a role assignment
 */
export async function revokeRoleAssignment(assignmentId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/role-assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    const data = await response.json();
    throw new Error(data.error || 'Failed to revoke role assignment');
  }

  return response.json();
}

// ============================================================================
// Audit Logs
// ============================================================================

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string;
  user_agent: string;
  timestamp: number;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogsQuery {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: string;
  targetType?: string;
  startDate?: number;
  endDate?: number;
}

/**
 * Fetch audit logs with optional filters
 */
export async function fetchAuditLogs(query?: AuditLogsQuery): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();

  if (query?.page) params.append('page', query.page.toString());
  if (query?.pageSize) params.append('pageSize', query.pageSize.toString());
  if (query?.userId) params.append('userId', query.userId);
  if (query?.action) params.append('action', query.action);
  if (query?.targetType) params.append('targetType', query.targetType);
  if (query?.startDate) params.append('startDate', query.startDate.toString());
  if (query?.endDate) params.append('endDate', query.endDate.toString());

  const queryString = params.toString();
  const url = `${API_BASE}/api/audit${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    handleAuthError(response);
    throw new Error('Failed to fetch audit logs');
  }

  return response.json();
}

// ============================================================================
// Invitation Acceptance API
// ============================================================================

export interface VerifyInvitationResponse {
  valid: boolean;
  invitation?: {
    email: string;
    role: string;
    expiresAt: number;
  };
  error?: string;
}

export interface AcceptInvitationRequest {
  password: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  error?: string;
}

/**
 * Verify an invitation token
 */
export async function verifyInvitationToken(token: string): Promise<VerifyInvitationResponse> {
  const response = await fetch(`${API_BASE}/api/invite/verify/${token}`);

  if (!response.ok) {
    const data = await response.json();
    return {
      valid: false,
      error: data.error || 'Invalid or expired invitation',
    };
  }

  return response.json();
}

/**
 * Accept an invitation and create account
 */
export async function acceptInvitation(token: string, password: string): Promise<AcceptInvitationResponse> {
  const response = await fetch(`${API_BASE}/api/invite/accept/${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to accept invitation');
  }

  return response.json();
}

// ==================== Server Storage ====================

/**
 * Server storage sizes response
 */
export interface ServerStorageSizes {
  binBytes: number;
  dataBytes: number;
  totalBytes: number;
  mountPoint?: string;
}

export interface ServerStorageResponse {
  success: boolean;
  sizes?: ServerStorageSizes;
  error?: string;
}

/**
 * Get storage consumption for a server's bin/ and data/ directories
 * Returns sizes in bytes; agent caches results for 5 minutes
 */
export async function getServerStorage(
  agentId: string,
  serverId: string
): Promise<ServerStorageResponse> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/servers/${serverId}/storage`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    handleAuthError(response);
    if (response.status === 404) {
      throw new Error('Server not found');
    }
    if (response.status === 503) {
      throw new Error('Agent not connected');
    }
    const data = await response.json();
    throw new Error(data.error || 'Failed to get server storage');
  }

  return response.json();
}
