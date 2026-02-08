/**
 * Audit Logs API
 *
 * Provides read-only access to audit logs with filtering and pagination.
 * Only admins can view all audit logs (for now).
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
};

const audit = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/audit/test
 * Test endpoint to check if database is accessible (admin only)
 */
audit.get('/test', requireAuth(), async (c) => {
  const user = c.get('user');

  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

  try {
    const count = await c.env.DB.prepare('SELECT COUNT(*) as count FROM audit_logs').first();

    return c.json({
      tableExists: true,
      count: count?.count || 0,
      message: 'Audit logs table is ready'
    });
  } catch (error) {
    return c.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

/**
 * GET /api/audit
 * Main endpoint - requires authentication
 */
audit.get('/', requireAuth(), async (c) => {
  const user = c.get('user');

  // For now, only admins can view audit logs
  // TODO: Allow users to view their own audit logs
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

  try {
    // Parse query parameters
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50', 10), 100);
    const userId = c.req.query('userId');
    const action = c.req.query('action');
    const targetType = c.req.query('targetType');
    const startDate = c.req.query('startDate') ? parseInt(c.req.query('startDate')!, 10) : undefined;
    const endDate = c.req.query('endDate') ? parseInt(c.req.query('endDate')!, 10) : undefined;

    console.log('[Audit API] Fetching logs with params:', { page, pageSize, userId, action, targetType, startDate, endDate });

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (userId) {
      conditions.push('a.user_id = ?');
      params.push(userId);
    }

    if (action) {
      conditions.push('a.action = ?');
      params.push(action);
    }

    if (targetType) {
      conditions.push('a.resource_type = ?');
      params.push(targetType);
    }

    if (startDate) {
      conditions.push('a.timestamp >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('a.timestamp <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM audit_logs a
      ${whereClause}
    `;

    console.log('[Audit API] Count query:', countQuery, 'params:', params);

    const countResult = await c.env.DB.prepare(countQuery)
      .bind(...params)
      .first<{ count: number }>();

    const total = countResult?.count || 0;

    console.log('[Audit API] Total count:', total);

    // Get paginated results with user email join
    const offset = (page - 1) * pageSize;

    const logsQuery = `
      SELECT
        a.id,
        a.user_id,
        COALESCE(u.email, 'unknown') as user_email,
        a.action,
        a.resource_type as target_type,
        a.resource_id as target_id,
        a.details,
        a.ip_address,
        a.user_agent,
        a.timestamp
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.timestamp DESC
      LIMIT ? OFFSET ?
    `;

    console.log('[Audit API] Logs query:', logsQuery, 'params:', [...params, pageSize, offset]);

    const logsResult = await c.env.DB.prepare(logsQuery)
      .bind(...params, pageSize, offset)
      .all();

    console.log('[Audit API] Query result:', logsResult);

    const logs = logsResult.results || [];

    console.log('[Audit API] Returning', logs.length, 'logs');

    return c.json({
      logs,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[Audit API] Error fetching audit logs:', error);
    console.error('[Audit API] Error details:', error instanceof Error ? error.message : String(error));
    console.error('[Audit API] Error stack:', error instanceof Error ? error.stack : 'no stack');
    return c.json({
      error: 'Failed to fetch audit logs',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

/**
 * POST /api/audit/cleanup
 * Delete audit logs older than specified days (default: 90)
 * Admin only
 */
audit.post('/cleanup', requireAuth(), async (c) => {
  const user = c.get('user');

  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden - requires admin role' }, 403);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const retentionDays = Math.max(1, parseInt(body.retentionDays) || 90);
    const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const result = await c.env.DB.prepare(
      'DELETE FROM audit_logs WHERE timestamp < ?'
    ).bind(cutoffTimestamp).run();

    const deletedCount = result.meta?.changes || 0;

    return c.json({
      success: true,
      deletedCount,
      retentionDays,
      cutoffDate: new Date(cutoffTimestamp).toISOString(),
    });
  } catch (error) {
    console.error('[Audit API] Cleanup error:', error);
    return c.json({ error: 'Failed to cleanup audit logs' }, 500);
  }
});

export { audit };
