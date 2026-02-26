/**
 * User Preferences API
 *
 * GET  /api/preferences     - Get current user's preferences
 * PATCH /api/preferences    - Update preferences (theme, etc.)
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
};

const VALID_THEMES = [
  'solar-flare',
  'cyberpunk-neon',
  'emerald-dark',
  'amber-forge',
  'arctic-frost',
  'solar-flare',
];

export const preferences = new Hono<{ Bindings: Bindings }>();

preferences.use('*', requireAuth());

preferences.get('/', async (c) => {
  const user = c.get('user') as { id: string };

  const row = await c.env.DB.prepare(
    'SELECT theme FROM users WHERE id = ?'
  ).bind(user.id).first();

  if (!row) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get global notification preferences (agent_id IS NULL)
  const notifRow = await c.env.DB.prepare(
    'SELECT alert_offline, alert_recovery, alert_update FROM notification_preferences WHERE user_id = ? AND agent_id IS NULL'
  ).bind(user.id).first<{ alert_offline: number; alert_recovery: number; alert_update: number }>();

  return c.json({
    theme: row.theme || 'solar-flare',
    notifications: {
      alertOffline: notifRow ? notifRow.alert_offline === 1 : true,
      alertRecovery: notifRow ? notifRow.alert_recovery === 1 : true,
      alertUpdate: notifRow ? notifRow.alert_update === 1 : true,
    },
  });
});

preferences.patch('/', async (c) => {
  const user = c.get('user') as { id: string };

  let body: { theme?: string; notifications?: { alertOffline?: boolean; alertRecovery?: boolean; alertUpdate?: boolean } };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (body.theme !== undefined) {
    if (!VALID_THEMES.includes(body.theme)) {
      return c.json({ error: `Invalid theme. Valid themes: ${VALID_THEMES.join(', ')}` }, 400);
    }

    await c.env.DB.prepare(
      'UPDATE users SET theme = ?, updated_at = ? WHERE id = ?'
    ).bind(body.theme, Date.now(), user.id).run();
  }

  if (body.notifications !== undefined) {
    const n = body.notifications;
    const alertOffline = n.alertOffline !== undefined ? (n.alertOffline ? 1 : 0) : null;
    const alertRecovery = n.alertRecovery !== undefined ? (n.alertRecovery ? 1 : 0) : null;
    const alertUpdate = n.alertUpdate !== undefined ? (n.alertUpdate ? 1 : 0) : null;

    const existing = await c.env.DB.prepare(
      'SELECT user_id FROM notification_preferences WHERE user_id = ? AND agent_id IS NULL'
    ).bind(user.id).first();

    if (existing) {
      const sets: string[] = [];
      const vals: (number | string)[] = [];
      if (alertOffline !== null) { sets.push('alert_offline = ?'); vals.push(alertOffline); }
      if (alertRecovery !== null) { sets.push('alert_recovery = ?'); vals.push(alertRecovery); }
      if (alertUpdate !== null) { sets.push('alert_update = ?'); vals.push(alertUpdate); }
      if (sets.length > 0) {
        sets.push('updated_at = ?');
        vals.push(Math.floor(Date.now() / 1000));
        vals.push(user.id);
        await c.env.DB.prepare(
          `UPDATE notification_preferences SET ${sets.join(', ')} WHERE user_id = ? AND agent_id IS NULL`
        ).bind(...vals).run();
      }
    } else {
      await c.env.DB.prepare(
        `INSERT INTO notification_preferences (user_id, agent_id, alert_offline, alert_recovery, alert_update, created_at, updated_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?)`
      ).bind(
        user.id,
        alertOffline ?? 1,
        alertRecovery ?? 1,
        alertUpdate ?? 1,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ).run();
    }
  }

  return c.json({ success: true, theme: body.theme });
});

// --- Per-Agent Notification Preferences ---

preferences.get('/agents', async (c) => {
  const user = c.get('user') as { id: string };

  const rows = await c.env.DB.prepare(
    `SELECT np.agent_id, np.alert_offline, np.alert_recovery, np.alert_update, a.name as agent_name
     FROM notification_preferences np
     JOIN agents a ON np.agent_id = a.id
     WHERE np.user_id = ? AND np.agent_id IS NOT NULL`
  ).bind(user.id).all<{
    agent_id: string;
    alert_offline: number;
    alert_recovery: number;
    alert_update: number;
    agent_name: string;
  }>();

  return c.json({
    overrides: (rows.results || []).map(r => ({
      agentId: r.agent_id,
      agentName: r.agent_name,
      alertOffline: r.alert_offline === 1,
      alertRecovery: r.alert_recovery === 1,
      alertUpdate: r.alert_update === 1,
    })),
  });
});

preferences.put('/agents/:agentId/notifications', async (c) => {
  const user = c.get('user') as { id: string };
  const agentId = c.req.param('agentId');

  let body: { alertOffline?: boolean; alertRecovery?: boolean; alertUpdate?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const agent = await c.env.DB.prepare('SELECT id FROM agents WHERE id = ?')
    .bind(agentId).first();
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  const alertOffline = body.alertOffline !== undefined ? (body.alertOffline ? 1 : 0) : 1;
  const alertRecovery = body.alertRecovery !== undefined ? (body.alertRecovery ? 1 : 0) : 1;
  const alertUpdate = body.alertUpdate !== undefined ? (body.alertUpdate ? 1 : 0) : 1;

  const existing = await c.env.DB.prepare(
    'SELECT user_id FROM notification_preferences WHERE user_id = ? AND agent_id = ?'
  ).bind(user.id, agentId).first();

  if (existing) {
    await c.env.DB.prepare(
      'UPDATE notification_preferences SET alert_offline = ?, alert_recovery = ?, alert_update = ?, updated_at = ? WHERE user_id = ? AND agent_id = ?'
    ).bind(alertOffline, alertRecovery, alertUpdate, now, user.id, agentId).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO notification_preferences (user_id, agent_id, alert_offline, alert_recovery, alert_update, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(user.id, agentId, alertOffline, alertRecovery, alertUpdate, now, now).run();
  }

  return c.json({ success: true, agentId, alertOffline: alertOffline === 1, alertRecovery: alertRecovery === 1, alertUpdate: alertUpdate === 1 });
});

preferences.delete('/agents/:agentId/notifications', async (c) => {
  const user = c.get('user') as { id: string };
  const agentId = c.req.param('agentId');

  await c.env.DB.prepare(
    'DELETE FROM notification_preferences WHERE user_id = ? AND agent_id = ?'
  ).bind(user.id, agentId).run();

  return c.json({ success: true });
});
