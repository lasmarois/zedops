/**
 * Permission System Library
 *
 * Provides permission checking logic for role-based access control.
 *
 * Permission Model:
 * - Admins: Have all permissions globally (bypass checks)
 * - Operators: Per-server permissions (view, control)
 * - Viewers: Per-server permissions (view only)
 */

// ============================================================================
// Types
// ============================================================================

export type ResourceType = 'agent' | 'server' | 'global';
export type Permission = 'view' | 'control' | 'delete' | 'manage_users';

export interface PermissionCheck {
  userId: string;
  userRole: string;
  action: Permission;
  resourceType: ResourceType;
  resourceId?: string | null;
}

// ============================================================================
// Permission Checking
// ============================================================================

/**
 * Check if a user has permission to perform an action on a resource
 *
 * Logic:
 * 1. Admins always have permission (global access)
 * 2. Non-admins must have explicit permission grant in database
 * 3. Resource ID can be null for global permissions
 *
 * @param db - D1 Database instance
 * @param check - Permission check parameters
 * @returns Promise<boolean> - True if user has permission
 */
export async function checkPermission(
  db: D1Database,
  check: PermissionCheck
): Promise<boolean> {
  const { userId, userRole, action, resourceType, resourceId } = check;

  // Admins have all permissions globally
  if (userRole === 'admin') {
    return true;
  }

  // Non-admins need explicit permission grant
  // Query for permission in database
  const permission = await db
    .prepare(
      `SELECT id FROM permissions
       WHERE user_id = ?
       AND resource_type = ?
       AND (resource_id = ? OR resource_id IS NULL)
       AND permission = ?`
    )
    .bind(userId, resourceType, resourceId || null, action)
    .first();

  return !!permission;
}

/**
 * Check if user has permission to view a server
 *
 * Convenience function for common "view server" permission check
 */
export async function canViewServer(
  db: D1Database,
  userId: string,
  userRole: string,
  serverId: string
): Promise<boolean> {
  return checkPermission(db, {
    userId,
    userRole,
    action: 'view',
    resourceType: 'server',
    resourceId: serverId,
  });
}

/**
 * Check if user has permission to control a server (start, stop, restart)
 *
 * Convenience function for common "control server" permission check
 */
export async function canControlServer(
  db: D1Database,
  userId: string,
  userRole: string,
  serverId: string
): Promise<boolean> {
  return checkPermission(db, {
    userId,
    userRole,
    action: 'control',
    resourceType: 'server',
    resourceId: serverId,
  });
}

/**
 * Check if user has permission to delete a server
 *
 * Convenience function for common "delete server" permission check
 */
export async function canDeleteServer(
  db: D1Database,
  userId: string,
  userRole: string,
  serverId: string
): Promise<boolean> {
  return checkPermission(db, {
    userId,
    userRole,
    action: 'delete',
    resourceType: 'server',
    resourceId: serverId,
  });
}

/**
 * Get all servers that a user has permission to view
 *
 * Returns list of server IDs that user can access
 * Admins get all servers, non-admins get filtered list
 */
export async function getUserVisibleServers(
  db: D1Database,
  userId: string,
  userRole: string
): Promise<string[]> {
  // Admins see all servers
  if (userRole === 'admin') {
    const servers = await db.prepare('SELECT id FROM servers').all();
    return (servers.results || []).map((s: any) => s.id);
  }

  // Non-admins see only servers with view permission
  const permissions = await db
    .prepare(
      `SELECT DISTINCT resource_id FROM permissions
       WHERE user_id = ?
       AND resource_type = 'server'
       AND permission IN ('view', 'control', 'delete')
       AND resource_id IS NOT NULL`
    )
    .bind(userId)
    .all();

  return (permissions.results || []).map((p: any) => p.resource_id);
}

/**
 * Get all permissions for a user
 *
 * Returns detailed list of all permission grants
 */
export async function getUserPermissions(
  db: D1Database,
  userId: string
): Promise<any[]> {
  const result = await db
    .prepare(
      `SELECT id, resource_type, resource_id, permission, created_at
       FROM permissions
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all();

  return result.results || [];
}

/**
 * Grant permission to a user
 *
 * Creates a new permission grant in the database
 * Idempotent - won't create duplicate permissions
 */
export async function grantPermission(
  db: D1Database,
  userId: string,
  resourceType: ResourceType,
  resourceId: string | null,
  permission: Permission
): Promise<{ id: string; created: boolean }> {
  // Check if permission already exists
  const existing = await db
    .prepare(
      `SELECT id FROM permissions
       WHERE user_id = ?
       AND resource_type = ?
       AND (resource_id = ? OR (resource_id IS NULL AND ? IS NULL))
       AND permission = ?`
    )
    .bind(userId, resourceType, resourceId, resourceId, permission)
    .first();

  if (existing) {
    return { id: existing.id as string, created: false };
  }

  // Create new permission
  const { v4: uuidv4 } = await import('uuid');
  const permissionId = uuidv4();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO permissions (id, user_id, resource_type, resource_id, permission, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(permissionId, userId, resourceType, resourceId, permission, now)
    .run();

  return { id: permissionId, created: true };
}

/**
 * Revoke permission from a user
 *
 * Removes a permission grant from the database
 */
export async function revokePermission(
  db: D1Database,
  permissionId: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM permissions WHERE id = ?')
    .bind(permissionId)
    .run();

  return (result.meta?.changes || 0) > 0;
}

/**
 * Revoke all permissions for a user on a specific resource
 *
 * Useful when removing user access to a server
 */
export async function revokeAllPermissionsForResource(
  db: D1Database,
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM permissions
       WHERE user_id = ?
       AND resource_type = ?
       AND resource_id = ?`
    )
    .bind(userId, resourceType, resourceId)
    .run();

  return result.meta?.changes || 0;
}

/**
 * Grant standard operator permissions to a user for a server
 *
 * Operators get: view + control permissions
 */
export async function grantOperatorPermissions(
  db: D1Database,
  userId: string,
  serverId: string
): Promise<{ view: string; control: string }> {
  const viewPerm = await grantPermission(db, userId, 'server', serverId, 'view');
  const controlPerm = await grantPermission(db, userId, 'server', serverId, 'control');

  return {
    view: viewPerm.id,
    control: controlPerm.id,
  };
}

/**
 * Grant standard viewer permissions to a user for a server
 *
 * Viewers get: view permission only
 */
export async function grantViewerPermissions(
  db: D1Database,
  userId: string,
  serverId: string
): Promise<{ view: string }> {
  const viewPerm = await grantPermission(db, userId, 'server', serverId, 'view');

  return {
    view: viewPerm.id,
  };
}
