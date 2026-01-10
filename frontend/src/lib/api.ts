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
