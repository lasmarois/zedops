/**
 * API client for ZedOps manager
 *
 * All API calls go through this client to ensure consistent error handling
 * and authentication.
 */

const API_BASE = window.location.origin;

export interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: number;
  createdAt: number;
  metadata: Record<string, unknown>;
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
