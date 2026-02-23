/**
 * Role-Based Permission System Library
 *
 * Implements role-based access control with multi-scope assignments and inheritance.
 *
 * Role Model:
 * - admin (system role, global): Full system access, bypasses all checks
 * - agent-admin (assignment role, agent-scope): Can create/delete servers on assigned agent
 * - operator (assignment role, multi-scope): Control operations + RCON + view
 * - viewer (assignment role, multi-scope): View-only access
 *
 * Scope Hierarchy (most specific wins):
 * - server-level assignment (overrides agent-level)
 * - agent-level assignment (applies to all servers on agent)
 * - global assignment (applies to all agents/servers)
 * - system role (admin only)
 *
 * Capability Hierarchy:
 * - admin > agent-admin > operator > viewer
 * - operator implies viewer (can view what they control)
 * - agent-admin implies operator + viewer for their agent
 */

// ============================================================================
// Types
// ============================================================================

export type SystemRole = 'admin' | null;
export type AssignmentRole = 'agent-admin' | 'operator' | 'viewer';
export type Role = 'admin' | 'agent-admin' | 'operator' | 'viewer';
export type Scope = 'global' | 'agent' | 'server';

export interface RoleAssignment {
  id: string;
  user_id: string;
  role: AssignmentRole;
  scope: Scope;
  resource_id: string | null; // NULL for global, agent_id or server_id
  created_at: number;
}

// ============================================================================
// Core Permission Logic
// ============================================================================

/**
 * Get the effective role for a user on a specific server
 *
 * Logic (most specific to least specific):
 * 1. If user.role === 'admin' → return 'admin' (bypasses everything)
 * 2. Check server-level assignment → return if found
 * 3. Check agent-level assignment → return if found
 * 4. Check global assignment → return if found
 * 5. Return null (no access)
 *
 * @param db - D1 Database instance
 * @param userId - User ID
 * @param systemRole - User's system role ('admin' or null)
 * @param serverId - Server ID to check access for
 * @returns Promise<Role | null> - Effective role or null if no access
 */
export async function getEffectiveRole(
  db: D1Database,
  userId: string,
  systemRole: SystemRole,
  serverId: string
): Promise<Role | null> {
  // Admin bypasses all checks
  if (systemRole === 'admin') {
    return 'admin';
  }

  // Get server's agent ID
  const server = await db
    .prepare('SELECT agent_id FROM servers WHERE id = ?')
    .bind(serverId)
    .first<{ agent_id: string }>();

  if (!server) {
    return null; // Server doesn't exist
  }

  const agentId = server.agent_id;

  // Query for role assignments (most specific to least specific)
  const assignments = await db
    .prepare(
      `SELECT role, scope, resource_id FROM role_assignments
       WHERE user_id = ?
       AND (
         (scope = 'server' AND resource_id = ?) OR
         (scope = 'agent' AND resource_id = ?) OR
         (scope = 'global' AND resource_id IS NULL)
       )
       ORDER BY
         CASE scope
           WHEN 'server' THEN 1  -- Most specific (overrides)
           WHEN 'agent' THEN 2    -- Agent-level (inheritance)
           WHEN 'global' THEN 3   -- Least specific
         END
       LIMIT 1`
    )
    .bind(userId, serverId, agentId)
    .first<{ role: AssignmentRole; scope: Scope; resource_id: string | null }>();

  return assignments ? assignments.role : null;
}

/**
 * Get the effective role for a user on a specific agent
 *
 * Used for agent-level operations (like checking if user can create servers)
 *
 * @param db - D1 Database instance
 * @param userId - User ID
 * @param systemRole - User's system role ('admin' or null)
 * @param agentId - Agent ID to check access for
 * @returns Promise<Role | null> - Effective role or null if no access
 */
export async function getEffectiveRoleForAgent(
  db: D1Database,
  userId: string,
  systemRole: SystemRole,
  agentId: string
): Promise<Role | null> {
  // Admin bypasses all checks
  if (systemRole === 'admin') {
    return 'admin';
  }

  // Query for role assignments (agent or global)
  const assignment = await db
    .prepare(
      `SELECT role FROM role_assignments
       WHERE user_id = ?
       AND (
         (scope = 'agent' AND resource_id = ?) OR
         (scope = 'global' AND resource_id IS NULL)
       )
       ORDER BY
         CASE scope
           WHEN 'agent' THEN 1
           WHEN 'global' THEN 2
         END
       LIMIT 1`
    )
    .bind(userId, agentId)
    .first<{ role: AssignmentRole }>();

  return assignment ? assignment.role : null;
}

/**
 * Check if a role has a specific capability
 *
 * Capability hierarchy:
 * - admin: All capabilities
 * - agent-admin: create_server + operator + viewer capabilities
 * - operator: control_server + use_rcon + view capabilities
 * - viewer: view capabilities only
 */
export function roleHasCapability(role: Role | null, capability: string): boolean {
  if (!role) return false;

  // Admin has all capabilities
  if (role === 'admin') return true;

  // Define capability hierarchy
  const capabilities: Record<Role, string[]> = {
    'admin': ['*'], // All capabilities
    'agent-admin': ['create_server', 'delete_server', 'control_server', 'use_rcon', 'view_server', 'view_logs'],
    'operator': ['control_server', 'use_rcon', 'view_server', 'view_logs'],
    'viewer': ['view_server', 'view_logs'],
  };

  const roleCapabilities = capabilities[role] || [];
  return roleCapabilities.includes('*') || roleCapabilities.includes(capability);
}

// ============================================================================
// Convenience Functions for Common Checks
// ============================================================================

/**
 * Check if user can view a server
 */
export async function canViewServer(
  db: D1Database,
  userId: string,
  systemRole: SystemRole,
  serverId: string
): Promise<boolean> {
  const role = await getEffectiveRole(db, userId, systemRole, serverId);
  return roleHasCapability(role, 'view_server');
}

/**
 * Check if user can control a server (start, stop, restart, rebuild)
 */
export async function canControlServer(
  db: D1Database,
  userId: string,
  systemRole: SystemRole,
  serverId: string
): Promise<boolean> {
  const role = await getEffectiveRole(db, userId, systemRole, serverId);
  return roleHasCapability(role, 'control_server');
}

/**
 * Check if user can delete a server
 */
export async function canDeleteServer(
  db: D1Database,
  userId: string,
  systemRole: SystemRole,
  serverId: string
): Promise<boolean> {
  const role = await getEffectiveRole(db, userId, systemRole, serverId);
  return roleHasCapability(role, 'delete_server');
}

/**
 * Check if user can use RCON on a server
 */
export async function canUseRcon(
  db: D1Database,
  userId: string,
  systemRole: SystemRole,
  serverId: string
): Promise<boolean> {
  const role = await getEffectiveRole(db, userId, systemRole, serverId);
  return roleHasCapability(role, 'use_rcon');
}

/**
 * Check if user can create servers on an agent
 */
export async function canCreateServer(
  db: D1Database,
  userId: string,
  systemRole: SystemRole,
  agentId: string
): Promise<boolean> {
  const role = await getEffectiveRoleForAgent(db, userId, systemRole, agentId);
  return roleHasCapability(role, 'create_server');
}

/**
 * Get all servers that a user has permission to view
 *
 * Returns list of server IDs that user can access
 * Admins get all servers, non-admins get filtered list based on role assignments
 */
export async function getUserVisibleServers(
  db: D1Database,
  userId: string,
  systemRole: SystemRole
): Promise<string[]> {
  // Admins see all servers
  if (systemRole === 'admin') {
    const servers = await db.prepare('SELECT id FROM servers').all();
    return (servers.results || []).map((s: any) => s.id);
  }

  // Non-admins: get all servers they have access to via role assignments
  // Need to expand agent-level and global assignments to server IDs

  const assignments = await db
    .prepare(
      `SELECT role, scope, resource_id FROM role_assignments
       WHERE user_id = ?`
    )
    .bind(userId)
    .all<{ role: AssignmentRole; scope: Scope; resource_id: string | null }>();

  if (!assignments.results || assignments.results.length === 0) {
    return []; // No assignments = no access
  }

  const visibleServerIds = new Set<string>();

  for (const assignment of assignments.results) {
    if (assignment.scope === 'server' && assignment.resource_id) {
      // Direct server access
      visibleServerIds.add(assignment.resource_id);
    } else if (assignment.scope === 'agent' && assignment.resource_id) {
      // Agent-level access: get all servers on this agent
      const agentServers = await db
        .prepare('SELECT id FROM servers WHERE agent_id = ?')
        .bind(assignment.resource_id)
        .all<{ id: string }>();

      for (const server of agentServers.results || []) {
        visibleServerIds.add(server.id);
      }
    } else if (assignment.scope === 'global') {
      // Global access: get all servers
      const allServers = await db
        .prepare('SELECT id FROM servers')
        .all<{ id: string }>();

      for (const server of allServers.results || []) {
        visibleServerIds.add(server.id);
      }
    }
  }

  return Array.from(visibleServerIds);
}

// ============================================================================
// Role Assignment Management
// ============================================================================

/**
 * Grant a role assignment to a user
 *
 * Creates a new role assignment in the database
 * Idempotent - won't create duplicate assignments
 */
export async function grantRoleAssignment(
  db: D1Database,
  userId: string,
  role: AssignmentRole,
  scope: Scope,
  resourceId: string | null
): Promise<{ id: string; created: boolean }> {
  // Check if assignment already exists
  const existing = await db
    .prepare(
      `SELECT id FROM role_assignments
       WHERE user_id = ?
       AND role = ?
       AND scope = ?
       AND (resource_id = ? OR (resource_id IS NULL AND ? IS NULL))`
    )
    .bind(userId, role, scope, resourceId, resourceId)
    .first<{ id: string }>();

  if (existing) {
    return { id: existing.id, created: false };
  }

  // Create new assignment
  const assignmentId = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO role_assignments (id, user_id, role, scope, resource_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(assignmentId, userId, role, scope, resourceId, now)
    .run();

  return { id: assignmentId, created: true };
}

/**
 * Revoke a role assignment from a user
 *
 * Removes a role assignment from the database
 */
export async function revokeRoleAssignment(
  db: D1Database,
  assignmentId: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM role_assignments WHERE id = ?')
    .bind(assignmentId)
    .run();

  return (result.meta?.changes || 0) > 0;
}

/**
 * Revoke all role assignments for a user on a specific resource
 *
 * Useful when removing user access to a server or agent
 */
export async function revokeAllRoleAssignmentsForResource(
  db: D1Database,
  userId: string,
  scope: Scope,
  resourceId: string
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM role_assignments
       WHERE user_id = ?
       AND scope = ?
       AND resource_id = ?`
    )
    .bind(userId, scope, resourceId)
    .run();

  return result.meta?.changes || 0;
}

/**
 * Get all role assignments for a user
 *
 * Returns detailed list of all role assignments
 */
export async function getUserRoleAssignments(
  db: D1Database,
  userId: string
): Promise<RoleAssignment[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, role, scope, resource_id, created_at
       FROM role_assignments
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<RoleAssignment>();

  return result.results || [];
}

/**
 * Get alert recipients for a specific agent (with theme preferences)
 *
 * Returns deduplicated list of recipients who should be notified
 * when this agent goes offline:
 * - All admin users (system role)
 * - Users with agent-level assignments for this agent
 * - Users with global-level assignments
 */
export async function getAlertRecipientsForAgent(
  db: D1Database,
  agentId: string
): Promise<Array<{ email: string; theme: string | null }>> {
  const recipients = new Map<string, string | null>();

  // 1. All admin users
  const admins = await db
    .prepare('SELECT email, theme FROM users WHERE role = ?')
    .bind('admin')
    .all<{ email: string; theme: string | null }>();

  for (const admin of admins.results || []) {
    recipients.set(admin.email, admin.theme);
  }

  // 2. Users with agent-level or global assignments
  const assigned = await db
    .prepare(
      `SELECT DISTINCT u.email, u.theme
       FROM role_assignments ra
       JOIN users u ON ra.user_id = u.id
       WHERE (ra.scope = 'agent' AND ra.resource_id = ?)
          OR (ra.scope = 'global' AND ra.resource_id IS NULL)`
    )
    .bind(agentId)
    .all<{ email: string; theme: string | null }>();

  for (const user of assigned.results || []) {
    recipients.set(user.email, user.theme);
  }

  return Array.from(recipients.entries()).map(([email, theme]) => ({ email, theme }));
}

/**
 * Get all role assignments for a specific resource
 *
 * Useful for showing "who has access to this server/agent"
 */
export async function getRoleAssignmentsForResource(
  db: D1Database,
  scope: Scope,
  resourceId: string
): Promise<Array<RoleAssignment & { email: string }>> {
  const result = await db
    .prepare(
      `SELECT ra.id, ra.user_id, ra.role, ra.scope, ra.resource_id, ra.created_at, u.email
       FROM role_assignments ra
       JOIN users u ON ra.user_id = u.id
       WHERE ra.scope = ? AND ra.resource_id = ?
       ORDER BY ra.created_at DESC`
    )
    .bind(scope, resourceId)
    .all<RoleAssignment & { email: string }>();

  return result.results || [];
}
