/**
 * Server status display utilities
 *
 * Computes display status by considering both agent connectivity and server state
 */

import type { Server } from './api';

export type DisplayStatus = {
  status: 'running' | 'stopped' | 'failed' | 'agent_offline' | 'creating' | 'deleting' | 'missing' | 'deleted' | 'unknown';
  label: string;
  variant: 'success' | 'muted' | 'error' | 'warning' | 'info';
};

/**
 * Get display status for a server
 *
 * Agent offline takes precedence - if agent is offline, we can't trust
 * the server status since it's stale (last known state).
 */
export function getDisplayStatus(server: Server): DisplayStatus {
  // Agent offline takes precedence
  if (server.agent_status === 'offline') {
    return {
      status: 'agent_offline',
      label: 'Agent Offline',
      variant: 'warning',
    };
  }

  // Agent online - show actual server status
  switch (server.status) {
    case 'running':
      return { status: 'running', label: 'Running', variant: 'success' };
    case 'stopped':
      return { status: 'stopped', label: 'Stopped', variant: 'muted' };
    case 'failed':
      return { status: 'failed', label: 'Failed', variant: 'error' };
    case 'creating':
      return { status: 'creating', label: 'Creating', variant: 'info' };
    case 'deleting':
      return { status: 'deleting', label: 'Deleting', variant: 'warning' };
    case 'missing':
      return { status: 'missing', label: 'Missing', variant: 'warning' };
    case 'deleted':
      return { status: 'deleted', label: 'Deleted', variant: 'muted' };
    default:
      return { status: 'unknown', label: server.status, variant: 'muted' };
  }
}
