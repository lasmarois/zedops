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

  return c.json({
    theme: row.theme || 'solar-flare',
  });
});

preferences.patch('/', async (c) => {
  const user = c.get('user') as { id: string };

  let body: { theme?: string };
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

  return c.json({ success: true, theme: body.theme });
});
