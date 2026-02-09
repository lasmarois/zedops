/**
 * Custom hooks for user management using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUsers,
  inviteUser,
  deleteUser,
  fetchInvitations,
  resendInvitation,
  cancelInvitation,
  updateUserSystemRole,
  fetchUserRoleAssignments,
  grantRoleAssignment,
  revokeRoleAssignment,
  type InviteUserRequest,
} from '../lib/api';
import { useUser } from '../contexts/UserContext';

/**
 * Hook to fetch all users
 */
export function useUsers() {
  const { isAuthenticated, user } = useUser();

  return useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
    enabled: isAuthenticated && user?.role === 'admin',
  });
}

/**
 * Hook to invite a user
 */
export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: InviteUserRequest) => inviteUser(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to fetch all invitations
 */
export function useInvitations() {
  const { isAuthenticated, user } = useUser();

  return useQuery({
    queryKey: ['invitations'],
    queryFn: () => fetchInvitations(),
    enabled: isAuthenticated && user?.role === 'admin',
  });
}

/**
 * Hook to resend an invitation
 */
export function useResendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => resendInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to cancel an invitation
 */
export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => cancelInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to delete a user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to update a user's system role (promote/demote admin)
 */
export function useUpdateUserSystemRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | null }) =>
      updateUserSystemRole(userId, role),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userRoleAssignments', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

// ============================================================================
// Role Assignment Hooks (RBAC System)
// ============================================================================

/**
 * Hook to fetch user role assignments
 */
export function useUserRoleAssignments(userId: string | null) {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['userRoleAssignments', userId],
    queryFn: () => fetchUserRoleAssignments(userId!),
    enabled: isAuthenticated && !!userId,
  });
}

/**
 * Hook to grant a role assignment
 */
export function useGrantRoleAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      role,
      scope,
      resourceId,
    }: {
      userId: string;
      role: 'agent-admin' | 'operator' | 'viewer';
      scope: 'global' | 'agent' | 'server';
      resourceId: string | null;
    }) => grantRoleAssignment(userId, role, scope, resourceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userRoleAssignments', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}

/**
 * Hook to revoke a role assignment
 */
export function useRevokeRoleAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assignmentId }: { assignmentId: string; userId: string }) =>
      revokeRoleAssignment(assignmentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userRoleAssignments', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
    },
  });
}
