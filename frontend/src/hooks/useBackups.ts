/**
 * M12: Hooks for backup management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBackups,
  createBackup,
  deleteBackup,
  restoreBackup,
  syncBackups,
} from '../lib/api';

/**
 * Hook to list backups for a server (from D1)
 */
export function useBackups(agentId: string | null, serverId: string | null) {
  return useQuery({
    queryKey: ['backups', agentId, serverId],
    queryFn: () => listBackups(agentId!, serverId!),
    enabled: !!agentId && !!serverId,
    refetchInterval: 10000,
    select: (data) => data.backups,
  });
}

/**
 * Hook to create a backup
 */
export function useCreateBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
      notes,
    }: {
      agentId: string;
      serverId: string;
      notes?: string;
    }) => createBackup(agentId, serverId, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backups', variables.agentId, variables.serverId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to delete a backup
 */
export function useDeleteBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
      backupId,
    }: {
      agentId: string;
      serverId: string;
      backupId: string;
    }) => deleteBackup(agentId, serverId, backupId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backups', variables.agentId, variables.serverId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to restore from a backup
 */
export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
      backupId,
    }: {
      agentId: string;
      serverId: string;
      backupId: string;
    }) => restoreBackup(agentId, serverId, backupId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backups', variables.agentId, variables.serverId],
      });
      queryClient.invalidateQueries({
        queryKey: ['servers', variables.agentId],
      });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to sync backups with agent disk
 */
export function useSyncBackups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      serverId,
    }: {
      agentId: string;
      serverId: string;
    }) => syncBackups(agentId, serverId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backups', variables.agentId, variables.serverId],
      });
    },
  });
}
