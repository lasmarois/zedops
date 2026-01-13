/**
 * Role Assignment Management API Routes
 *
 * Handles role assignment grants and revocations for users.
 * All endpoints require admin authentication.
 *
 * Replaces old permissions.ts with role-based assignments
 */

import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  grantRoleAssignment,
  revokeRoleAssignment,
  revokeAllRoleAssignmentsForResource,
  getUserRoleAssignments,
  getRoleAssignmentsForResource,
  type AssignmentRole,
  type Scope,
} from '../lib/permissions';
import { logRoleAssignmentGranted, logRoleAssignmentRevoked } from '../lib/audit';

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
};

const roleAssignments = new Hono<{ Bindings: Bindings }>();

// All routes require admin authentication
roleAssignments.use('*', requireAuth(), requireRole('admin'));

// ============================================================================
// GET /api/users/:userId/role-assignments
// Get all role assignments for a user
// ============================================================================

roleAssignments.get('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id, email, role FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get all role assignments for user
    const assignments = await getUserRoleAssignments(c.env.DB, userId);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        systemRole: user.role, // 'admin' or null
      },
      roleAssignments: assignments,
    });
  } catch (error) {
    console.error('Get user role assignments error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// POST /api/users/:userId/role-assignments
// Grant a role assignment to a user
// ============================================================================

roleAssignments.post('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { role, scope, resourceId } = body;

    // Validate input
    if (!role || !scope) {
      return c.json({ error: 'role and scope are required' }, 400);
    }

    // Validate role
    if (!['agent-admin', 'operator', 'viewer'].includes(role)) {
      return c.json({ error: 'Invalid role - must be agent-admin, operator, or viewer' }, 400);
    }

    // Validate scope
    if (!['global', 'agent', 'server'].includes(scope)) {
      return c.json({ error: 'Invalid scope - must be global, agent, or server' }, 400);
    }

    // Validate constraints
    if (role === 'agent-admin' && scope !== 'agent') {
      return c.json({ error: 'agent-admin role can only be assigned at agent scope' }, 400);
    }

    if (scope === 'global' && resourceId) {
      return c.json({ error: 'global scope cannot have a resource_id' }, 400);
    }

    if (scope !== 'global' && !resourceId) {
      return c.json({ error: `${scope} scope requires a resource_id` }, 400);
    }

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id, email, role FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Prevent granting assignments to admins (they have global access already)
    if (user.role === 'admin') {
      return c.json({ error: 'Cannot grant role assignments to admin users (they have global admin access)' }, 400);
    }

    // If resource_id provided, verify resource exists
    if (resourceId) {
      if (scope === 'server') {
        const server = await c.env.DB.prepare('SELECT id FROM servers WHERE id = ?')
          .bind(resourceId)
          .first();
        if (!server) {
          return c.json({ error: 'Server not found' }, 404);
        }
      } else if (scope === 'agent') {
        const agent = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ?')
          .bind(resourceId)
          .first();
        if (!agent) {
          return c.json({ error: 'Agent not found' }, 404);
        }
      }
    }

    // Grant role assignment
    const result = await grantRoleAssignment(
      c.env.DB,
      userId,
      role as AssignmentRole,
      scope as Scope,
      resourceId || null
    );

    // Audit log the grant operation
    const currentUser = c.get('user');
    await logRoleAssignmentGranted(
      c.env.DB,
      c,
      currentUser.id, // Admin who granted the role
      result.id, // Assignment ID
      userId, // Target user
      role,
      scope,
      resourceId || null
    );

    return c.json(
      {
        message: result.created ? 'Role assignment granted successfully' : 'Role assignment already exists',
        roleAssignment: {
          id: result.id,
          userId,
          role,
          scope,
          resourceId: resourceId || null,
          created: result.created,
        },
      },
      result.created ? 201 : 200
    );
  } catch (error) {
    console.error('Grant role assignment error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// DELETE /api/role-assignments/:assignmentId
// Revoke a specific role assignment
// ============================================================================

roleAssignments.delete('/:assignmentId', async (c) => {
  try {
    const assignmentId = c.req.param('assignmentId');

    // Check if assignment exists
    const assignment = await c.env.DB.prepare(
      'SELECT id, user_id, role, scope, resource_id FROM role_assignments WHERE id = ?'
    )
      .bind(assignmentId)
      .first<{
        id: string;
        user_id: string;
        role: string;
        scope: string;
        resource_id: string | null;
      }>();

    if (!assignment) {
      return c.json({ error: 'Role assignment not found' }, 404);
    }

    // Revoke assignment
    const revoked = await revokeRoleAssignment(c.env.DB, assignmentId);

    if (!revoked) {
      return c.json({ error: 'Failed to revoke role assignment' }, 500);
    }

    // Audit log the revoke operation
    const currentUser = c.get('user');
    await logRoleAssignmentRevoked(
      c.env.DB,
      c,
      currentUser.id, // Admin who revoked the role
      assignment.id, // Assignment ID
      assignment.user_id, // Target user
      assignment.role,
      assignment.scope,
      assignment.resource_id
    );

    return c.json({
      message: 'Role assignment revoked successfully',
      roleAssignment: {
        id: assignment.id,
        userId: assignment.user_id,
        role: assignment.role,
        scope: assignment.scope,
        resourceId: assignment.resource_id,
      },
    });
  } catch (error) {
    console.error('Revoke role assignment error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// DELETE /api/users/:userId/role-assignments/:scope/:resourceId
// Revoke all role assignments for a user on a specific resource
// ============================================================================

roleAssignments.delete('/:userId/:scope/:resourceId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const scope = c.req.param('scope');
    const resourceId = c.req.param('resourceId');

    // Validate scope
    if (!['agent', 'server'].includes(scope)) {
      return c.json({ error: 'Invalid scope - must be agent or server' }, 400);
    }

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Revoke all assignments for resource
    const count = await revokeAllRoleAssignmentsForResource(
      c.env.DB,
      userId,
      scope as Scope,
      resourceId
    );

    return c.json({
      message: `${count} role assignment(s) revoked successfully`,
      count,
      userId,
      scope,
      resourceId,
    });
  } catch (error) {
    console.error('Revoke all role assignments error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// GET /api/role-assignments/:scope/:resourceId
// Get all role assignments for a specific resource (who has access)
// ============================================================================

roleAssignments.get('/:scope/:resourceId', async (c) => {
  try {
    const scope = c.req.param('scope');
    const resourceId = c.req.param('resourceId');

    // Validate scope
    if (!['agent', 'server'].includes(scope)) {
      return c.json({ error: 'Invalid scope - must be agent or server' }, 400);
    }

    // Get all assignments for resource
    const assignments = await getRoleAssignmentsForResource(
      c.env.DB,
      scope as Scope,
      resourceId
    );

    return c.json({
      scope,
      resourceId,
      roleAssignments: assignments,
    });
  } catch (error) {
    console.error('Get resource role assignments error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { roleAssignments };
