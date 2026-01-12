/**
 * Audit Logging Library
 *
 * Provides comprehensive action logging with user attribution.
 * All sensitive operations are logged to the audit_logs table.
 */

import { Context } from 'hono';
// Using crypto.randomUUID() for ID generation

// ============================================================================
// Types
// ============================================================================

export type AuditAction =
  // User management
  | 'user.created'
  | 'user.deleted'
  | 'user.role_changed'
  | 'user.password_changed'
  | 'user.sessions_invalidated'
  // Auth events
  | 'user.login'
  | 'user.logout'
  | 'user.login_failed'
  // Invitations
  | 'invitation.created'
  | 'invitation.accepted'
  | 'invitation.cancelled'
  // Permissions
  | 'permission.granted'
  | 'permission.revoked'
  // Server operations
  | 'server.created'
  | 'server.started'
  | 'server.stopped'
  | 'server.restarted'
  | 'server.deleted'
  | 'server.purged'
  | 'server.restored'
  | 'server.rebuilt'
  // Agent operations
  | 'agent.registered'
  | 'agent.deleted'
  // RCON operations
  | 'rcon.command';

export type ResourceType = 'user' | 'invitation' | 'permission' | 'server' | 'agent' | 'session';

export interface AuditLogEntry {
  userId?: string | null;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract client IP address from request
 * Handles Cloudflare headers and standard headers
 */
function extractIpAddress(c: Context): string | null {
  // Cloudflare provides CF-Connecting-IP
  const cfIp = c.req.header('CF-Connecting-IP');
  if (cfIp) return cfIp;

  // Standard X-Forwarded-For
  const forwardedFor = c.req.header('X-Forwarded-For');
  if (forwardedFor) {
    // X-Forwarded-For can be comma-separated, take first IP
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to X-Real-IP
  const realIp = c.req.header('X-Real-IP');
  if (realIp) return realIp;

  return null;
}

/**
 * Extract user agent from request
 */
function extractUserAgent(c: Context): string | null {
  return c.req.header('User-Agent') || null;
}

// ============================================================================
// Audit Logging
// ============================================================================

/**
 * Log an action to the audit log
 *
 * @param db - D1 Database instance
 * @param c - Hono context (for extracting IP and user-agent)
 * @param entry - Audit log entry details
 */
export async function logAudit(
  db: D1Database,
  c: Context,
  entry: AuditLogEntry
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const ipAddress = extractIpAddress(c);
    const userAgent = extractUserAgent(c);

    // Prepare details as JSON string (if provided)
    const detailsJson = entry.details ? JSON.stringify(entry.details) : null;

    await db
      .prepare(
        `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        entry.userId || null,
        entry.action,
        entry.resourceType,
        entry.resourceId || null,
        detailsJson,
        ipAddress,
        userAgent,
        timestamp
      )
      .run();
  } catch (error) {
    // Log errors but don't fail the request
    console.error('[Audit] Failed to log action:', error);
  }
}

/**
 * Log user login
 */
export async function logUserLogin(
  db: D1Database,
  c: Context,
  userId: string,
  email: string,
  success: boolean
): Promise<void> {
  await logAudit(db, c, {
    userId: success ? userId : null,
    action: success ? 'user.login' : 'user.login_failed',
    resourceType: 'user',
    resourceId: success ? userId : null,
    details: { email, success },
  });
}

/**
 * Log user logout
 */
export async function logUserLogout(
  db: D1Database,
  c: Context,
  userId: string
): Promise<void> {
  await logAudit(db, c, {
    userId,
    action: 'user.logout',
    resourceType: 'session',
  });
}

/**
 * Log user creation
 */
export async function logUserCreated(
  db: D1Database,
  c: Context,
  createdByUserId: string,
  newUserId: string,
  email: string,
  role: string
): Promise<void> {
  await logAudit(db, c, {
    userId: createdByUserId,
    action: 'user.created',
    resourceType: 'user',
    resourceId: newUserId,
    details: { email, role },
  });
}

/**
 * Log user deletion
 */
export async function logUserDeleted(
  db: D1Database,
  c: Context,
  deletedByUserId: string,
  deletedUserId: string,
  email: string
): Promise<void> {
  await logAudit(db, c, {
    userId: deletedByUserId,
    action: 'user.deleted',
    resourceType: 'user',
    resourceId: deletedUserId,
    details: { email },
  });
}

/**
 * Log user role change
 */
export async function logUserRoleChanged(
  db: D1Database,
  c: Context,
  changedByUserId: string,
  targetUserId: string,
  previousRole: string,
  newRole: string
): Promise<void> {
  await logAudit(db, c, {
    userId: changedByUserId,
    action: 'user.role_changed',
    resourceType: 'user',
    resourceId: targetUserId,
    details: { previousRole, newRole },
  });
}

/**
 * Log user password change
 */
export async function logUserPasswordChanged(
  db: D1Database,
  c: Context,
  changedByUserId: string,
  targetUserId: string
): Promise<void> {
  await logAudit(db, c, {
    userId: changedByUserId,
    action: 'user.password_changed',
    resourceType: 'user',
    resourceId: targetUserId,
  });
}

/**
 * Log invitation created
 */
export async function logInvitationCreated(
  db: D1Database,
  c: Context,
  createdByUserId: string,
  invitationId: string,
  email: string,
  role: string
): Promise<void> {
  await logAudit(db, c, {
    userId: createdByUserId,
    action: 'invitation.created',
    resourceType: 'invitation',
    resourceId: invitationId,
    details: { email, role },
  });
}

/**
 * Log invitation accepted
 */
export async function logInvitationAccepted(
  db: D1Database,
  c: Context,
  invitationId: string,
  newUserId: string,
  email: string
): Promise<void> {
  await logAudit(db, c, {
    userId: newUserId,
    action: 'invitation.accepted',
    resourceType: 'invitation',
    resourceId: invitationId,
    details: { email },
  });
}

/**
 * Log permission granted
 */
export async function logPermissionGranted(
  db: D1Database,
  c: Context,
  grantedByUserId: string,
  targetUserId: string,
  resourceType: string,
  resourceId: string | null,
  permission: string
): Promise<void> {
  await logAudit(db, c, {
    userId: grantedByUserId,
    action: 'permission.granted',
    resourceType: 'permission',
    details: { targetUserId, resourceType, resourceId, permission },
  });
}

/**
 * Log permission revoked
 */
export async function logPermissionRevoked(
  db: D1Database,
  c: Context,
  revokedByUserId: string,
  permissionId: string,
  targetUserId: string
): Promise<void> {
  await logAudit(db, c, {
    userId: revokedByUserId,
    action: 'permission.revoked',
    resourceType: 'permission',
    resourceId: permissionId,
    details: { targetUserId },
  });
}

/**
 * Log server operation (start, stop, restart, etc.)
 */
export async function logServerOperation(
  db: D1Database,
  c: Context,
  userId: string,
  action: AuditAction,
  serverId: string,
  serverName: string,
  agentId?: string
): Promise<void> {
  await logAudit(db, c, {
    userId,
    action,
    resourceType: 'server',
    resourceId: serverId,
    details: { serverName, agentId },
  });
}

/**
 * Log server created
 */
export async function logServerCreated(
  db: D1Database,
  c: Context,
  userId: string,
  serverId: string,
  serverName: string,
  agentId: string
): Promise<void> {
  await logServerOperation(db, c, userId, 'server.created', serverId, serverName, agentId);
}

/**
 * Log RCON command execution
 */
export async function logRconCommand(
  db: D1Database,
  c: Context,
  userId: string,
  serverId: string,
  serverName: string,
  command: string
): Promise<void> {
  await logAudit(db, c, {
    userId,
    action: 'rcon.command',
    resourceType: 'server',
    resourceId: serverId,
    details: {
      serverName,
      command,
      // Don't log full response (could contain sensitive data)
    },
  });
}
