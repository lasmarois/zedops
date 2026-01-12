/**
 * Permission Management API Routes
 *
 * Handles permission grants and revocations for users.
 * All endpoints require admin authentication.
 */

import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  grantPermission,
  revokePermission,
  revokeAllPermissionsForResource,
  getUserPermissions,
  grantOperatorPermissions,
  grantViewerPermissions,
  ResourceType,
  Permission,
} from '../lib/permissions';

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
};

const permissions = new Hono<{ Bindings: Bindings }>();

// All routes require admin authentication
permissions.use('*', requireAuth(), requireRole('admin'));

// ============================================================================
// GET /api/users/:userId/permissions
// Get all permissions for a user
// ============================================================================

permissions.get('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id, email, role FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get all permissions for user
    const userPermissions = await getUserPermissions(c.env.DB, userId);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      permissions: userPermissions,
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// POST /api/users/:userId/permissions
// Grant a permission to a user
// ============================================================================

permissions.post('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { resourceType, resourceId, permission } = body;

    // Validate input
    if (!resourceType || !permission) {
      return c.json({ error: 'resourceType and permission are required' }, 400);
    }

    // Validate resourceType
    if (!['agent', 'server', 'global'].includes(resourceType)) {
      return c.json({ error: 'Invalid resourceType - must be agent, server, or global' }, 400);
    }

    // Validate permission
    if (!['view', 'control', 'delete', 'manage_users'].includes(permission)) {
      return c.json(
        { error: 'Invalid permission - must be view, control, delete, or manage_users' },
        400
      );
    }

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id, email, role FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Prevent granting permissions to admins (they have all permissions already)
    if (user.role === 'admin') {
      return c.json({ error: 'Cannot grant permissions to admin users (they have all permissions)' }, 400);
    }

    // If resource_id provided, verify resource exists
    if (resourceId) {
      if (resourceType === 'server') {
        const server = await c.env.DB.prepare('SELECT id FROM servers WHERE id = ?')
          .bind(resourceId)
          .first();
        if (!server) {
          return c.json({ error: 'Server not found' }, 404);
        }
      } else if (resourceType === 'agent') {
        const agent = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ?')
          .bind(resourceId)
          .first();
        if (!agent) {
          return c.json({ error: 'Agent not found' }, 404);
        }
      }
    }

    // Grant permission
    const result = await grantPermission(
      c.env.DB,
      userId,
      resourceType as ResourceType,
      resourceId || null,
      permission as Permission
    );

    return c.json(
      {
        message: result.created ? 'Permission granted successfully' : 'Permission already exists',
        permission: {
          id: result.id,
          userId,
          resourceType,
          resourceId: resourceId || null,
          permission,
          created: result.created,
        },
      },
      result.created ? 201 : 200
    );
  } catch (error) {
    console.error('Grant permission error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// POST /api/users/:userId/permissions/operator/:serverId
// Grant standard operator permissions (view + control) for a server
// ============================================================================

permissions.post('/:userId/operator/:serverId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const serverId = c.req.param('serverId');

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.role === 'admin') {
      return c.json({ error: 'Cannot grant permissions to admin users' }, 400);
    }

    // Check if server exists
    const server = await c.env.DB.prepare('SELECT id, name FROM servers WHERE id = ?')
      .bind(serverId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Grant operator permissions
    const result = await grantOperatorPermissions(c.env.DB, userId, serverId);

    return c.json({
      message: 'Operator permissions granted successfully',
      permissions: result,
      server: {
        id: server.id,
        name: server.name,
      },
    });
  } catch (error) {
    console.error('Grant operator permissions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// POST /api/users/:userId/permissions/viewer/:serverId
// Grant standard viewer permissions (view only) for a server
// ============================================================================

permissions.post('/:userId/viewer/:serverId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const serverId = c.req.param('serverId');

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.role === 'admin') {
      return c.json({ error: 'Cannot grant permissions to admin users' }, 400);
    }

    // Check if server exists
    const server = await c.env.DB.prepare('SELECT id, name FROM servers WHERE id = ?')
      .bind(serverId)
      .first();

    if (!server) {
      return c.json({ error: 'Server not found' }, 404);
    }

    // Grant viewer permissions
    const result = await grantViewerPermissions(c.env.DB, userId, serverId);

    return c.json({
      message: 'Viewer permissions granted successfully',
      permissions: result,
      server: {
        id: server.id,
        name: server.name,
      },
    });
  } catch (error) {
    console.error('Grant viewer permissions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// DELETE /api/permissions/:permissionId
// Revoke a specific permission
// ============================================================================

permissions.delete('/:permissionId', async (c) => {
  try {
    const permissionId = c.req.param('permissionId');

    // Check if permission exists
    const permission = await c.env.DB.prepare(
      'SELECT id, user_id, resource_type, resource_id, permission FROM permissions WHERE id = ?'
    )
      .bind(permissionId)
      .first();

    if (!permission) {
      return c.json({ error: 'Permission not found' }, 404);
    }

    // Revoke permission
    const revoked = await revokePermission(c.env.DB, permissionId);

    if (!revoked) {
      return c.json({ error: 'Failed to revoke permission' }, 500);
    }

    return c.json({
      message: 'Permission revoked successfully',
      permission: {
        id: permission.id,
        userId: permission.user_id,
        resourceType: permission.resource_type,
        resourceId: permission.resource_id,
        permission: permission.permission,
      },
    });
  } catch (error) {
    console.error('Revoke permission error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// DELETE /api/users/:userId/permissions/:resourceType/:resourceId
// Revoke all permissions for a user on a specific resource
// ============================================================================

permissions.delete('/:userId/:resourceType/:resourceId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const resourceType = c.req.param('resourceType');
    const resourceId = c.req.param('resourceId');

    // Validate resourceType
    if (!['agent', 'server', 'global'].includes(resourceType)) {
      return c.json({ error: 'Invalid resourceType' }, 400);
    }

    // Check if user exists
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Revoke all permissions for resource
    const count = await revokeAllPermissionsForResource(
      c.env.DB,
      userId,
      resourceType as ResourceType,
      resourceId
    );

    return c.json({
      message: `${count} permission(s) revoked successfully`,
      count,
      userId,
      resourceType,
      resourceId,
    });
  } catch (error) {
    console.error('Revoke all permissions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { permissions };
