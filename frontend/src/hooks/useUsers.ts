/**
 * Custom hooks for user management using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUsers,
  inviteUser,
  deleteUser,
  fetchUserPermissions,
  grantPermission,
  revokePermission,
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
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
    enabled: isAuthenticated,
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
    },
  });
}

/**
 * Hook to fetch user permissions
 */
export function useUserPermissions(userId: string | null) {
  const { isAuthenticated } = useUser();

  return useQuery({
    queryKey: ['userPermissions', userId],
    queryFn: () => fetchUserPermissions(userId!),
    enabled: isAuthenticated && !!userId,
  });
}

/**
 * Hook to grant a permission
 */
export function useGrantPermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      resourceType,
      resourceId,
      permission,
    }: {
      userId: string;
      resourceType: 'agent' | 'server' | 'global';
      resourceId: string | null;
      permission: 'view' | 'control' | 'delete' | 'manage_users';
    }) => grantPermission(userId, resourceType, resourceId, permission),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userPermissions', variables.userId] });
    },
  });
}

/**
 * Hook to revoke a permission
 */
export function useRevokePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ permissionId }: { permissionId: string; userId: string }) =>
      revokePermission(permissionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userPermissions', variables.userId] });
    },
  });
}

// ============================================================================
// Role Assignment Hooks (New RBAC System)
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
    },
  });
}
