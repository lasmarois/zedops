/**
 * User Invitation API Routes
 *
 * Handles user invitation flow:
 * 1. Admin invites user (creates invitation with 24h token)
 * 2. User accepts invitation (creates account with password)
 * 3. Invitation marked as used
 */

import { Hono } from 'hono';
// Using crypto.randomUUID() for ID generation
import * as jose from 'jose';
import { requireAuth, requireRole } from '../middleware/auth';
import { hashPassword, validatePasswordStrength, hashToken } from '../lib/auth';
import { logInvitationCreated, logInvitationAccepted } from '../lib/audit';
import { sendEmail, buildInvitationEmailHtml, DEFAULT_EMAIL_THEME } from '../lib/email';

type Bindings = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ADMIN_PASSWORD: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
};

const invitations = new Hono<{ Bindings: Bindings }>();

// ============================================================================
// POST /api/users/invite
// Create a new user invitation (admin only)
// ============================================================================

invitations.post('/', requireAuth(), requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json();
    const { email, role } = body;
    const currentUser = c.get('user');

    // Validate input
    if (!email || !role) {
      return c.json({ error: 'Email and role are required' }, 400);
    }

    // Validate role (invitation system does NOT support NULL role - must invite to specific role)
    if (!['admin', 'agent-admin', 'operator', 'viewer'].includes(role)) {
      return c.json({ error: 'Invalid role - must be admin, agent-admin, operator, or viewer' }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    // Check for pending invitation
    const pendingInvitation = await c.env.DB.prepare(
      'SELECT id FROM invitations WHERE email = ? AND used_at IS NULL AND expires_at > ?'
    )
      .bind(email, Date.now())
      .first();

    if (pendingInvitation) {
      return c.json({ error: 'A pending invitation for this email already exists' }, 409);
    }

    // Generate invitation token (24h expiry)
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(c.env.TOKEN_SECRET);

    const token = await new jose.SignJWT({
      type: 'user_invitation',
      email,
      role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secretKey);

    // Store invitation in database
    const invitationId = crypto.randomUUID();
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    await c.env.DB.prepare(
      'INSERT INTO invitations (id, email, role, token_hash, invited_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(invitationId, email, role, tokenHash, currentUser.id, now, expiresAt)
      .run();

    // Log invitation creation
    await logInvitationCreated(c.env.DB, c, currentUser.id, invitationId, email, role);

    // Generate invitation URL (frontend will handle the /register?token= route)
    const baseUrl = new URL(c.req.url).origin;
    const invitationUrl = `${baseUrl}/register?token=${token}`;

    // Send invitation email (best-effort — invite succeeds regardless)
    let emailSent = false;
    let emailError: string | undefined;

    if (c.env.RESEND_API_KEY) {
      const html = buildInvitationEmailHtml(invitationUrl, role, DEFAULT_EMAIL_THEME);
      const from = c.env.RESEND_FROM_EMAIL
        ? `ZedOps <${c.env.RESEND_FROM_EMAIL}>`
        : undefined;
      const result = await sendEmail(c.env.RESEND_API_KEY, {
        to: email,
        subject: 'You\'ve been invited to ZedOps',
        html,
        from,
      });
      emailSent = result.success;
      if (!result.success) {
        emailError = result.error;
      }
    }

    return c.json(
      {
        success: true,
        message: emailSent
          ? 'Invitation created and email sent'
          : 'Invitation created successfully',
        invitation: {
          id: invitationId,
          email,
          role,
          token,  // Include token so frontend can construct URL
          expiresAt,
        },
        invitationUrl,
        emailSent,
        emailError,
        instructions: [
          'Share this invitation URL with the user:',
          invitationUrl,
          '',
          'The invitation expires in 24 hours.',
          'The user will be prompted to create a password when accepting the invitation.',
        ],
      },
      201
    );
  } catch (error) {
    console.error('Create invitation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// GET /api/users/invitations
// List all invitations (admin only)
// ============================================================================

invitations.get('/', requireAuth(), requireRole('admin'), async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT
        i.id,
        i.email,
        i.role,
        i.created_at,
        i.expires_at,
        i.used_at,
        u.email as invited_by_email
      FROM invitations i
      JOIN users u ON i.invited_by = u.id
      ORDER BY i.created_at DESC
    `).all();

    // Categorize invitations
    const now = Date.now();
    const invitations = (result.results || []).map((inv: any) => ({
      ...inv,
      status: inv.used_at
        ? 'accepted'
        : inv.expires_at < now
        ? 'expired'
        : 'pending',
    }));

    return c.json({ invitations });
  } catch (error) {
    console.error('List invitations error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// DELETE /api/users/invitations/:id
// Cancel an invitation (admin only)
// ============================================================================

invitations.delete('/:id', requireAuth(), requireRole('admin'), async (c) => {
  try {
    const invitationId = c.req.param('id');

    // Check if invitation exists and is not used
    const invitation = await c.env.DB.prepare(
      'SELECT id, email, used_at FROM invitations WHERE id = ?'
    )
      .bind(invitationId)
      .first();

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    if (invitation.used_at) {
      return c.json({ error: 'Cannot cancel an already-accepted invitation' }, 400);
    }

    // Delete invitation
    await c.env.DB.prepare('DELETE FROM invitations WHERE id = ?').bind(invitationId).run();

    return c.json({
      message: 'Invitation cancelled successfully',
      invitation: {
        id: invitationId,
        email: invitation.email,
      },
    });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// POST /api/users/invitations/:id/resend
// Resend an invitation with a fresh 24h token (admin only)
// ============================================================================

invitations.post('/:id/resend', requireAuth(), requireRole('admin'), async (c) => {
  try {
    const invitationId = c.req.param('id');
    const currentUser = c.get('user');

    // Find the invitation
    const invitation = await c.env.DB.prepare(
      'SELECT id, email, role, used_at FROM invitations WHERE id = ?'
    )
      .bind(invitationId)
      .first();

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    if (invitation.used_at) {
      return c.json({ error: 'Cannot resend an already-accepted invitation' }, 400);
    }

    // Check if user already exists (may have registered via another path)
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(invitation.email)
      .first();

    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    // Generate a fresh token (24h expiry)
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(c.env.TOKEN_SECRET);
    const email = invitation.email as string;
    const role = invitation.role as string;

    const token = await new jose.SignJWT({
      type: 'user_invitation',
      email,
      role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secretKey);

    // Update invitation with new token and expiry
    const tokenHash = await hashToken(token);
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;

    await c.env.DB.prepare(
      'UPDATE invitations SET token_hash = ?, expires_at = ?, invited_by = ? WHERE id = ?'
    )
      .bind(tokenHash, expiresAt, currentUser.id, invitationId)
      .run();

    // Generate invitation URL and send email
    const baseUrl = new URL(c.req.url).origin;
    const invitationUrl = `${baseUrl}/register?token=${token}`;

    let emailSent = false;
    let emailError: string | undefined;

    if (c.env.RESEND_API_KEY) {
      const html = buildInvitationEmailHtml(invitationUrl, role, DEFAULT_EMAIL_THEME);
      const from = c.env.RESEND_FROM_EMAIL
        ? `ZedOps <${c.env.RESEND_FROM_EMAIL}>`
        : undefined;
      const result = await sendEmail(c.env.RESEND_API_KEY, {
        to: email,
        subject: 'You\'ve been invited to ZedOps',
        html,
        from,
      });
      emailSent = result.success;
      if (!result.success) {
        emailError = result.error;
      }
    }

    // Log resend
    await logInvitationCreated(c.env.DB, c, currentUser.id, invitationId, email, role);

    return c.json({
      success: true,
      message: emailSent
        ? 'Invitation resent and email sent'
        : 'Invitation resent successfully',
      invitation: {
        id: invitationId,
        email,
        role,
        token,
        expiresAt,
      },
      invitationUrl,
      emailSent,
      emailError,
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// GET /api/invite/:token
// Verify invitation token (public endpoint)
// ============================================================================

invitations.get('/verify/:token', async (c) => {
  try {
    const token = c.req.param('token');

    // Verify JWT token
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(c.env.TOKEN_SECRET);

    let payload;
    try {
      const { payload: decoded } = await jose.jwtVerify(token, secretKey);
      payload = decoded;
    } catch (error) {
      return c.json({ error: 'Invalid or expired invitation token' }, 401);
    }

    // Validate token type
    if (payload.type !== 'user_invitation') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    // Check if invitation exists in database and is not used
    const tokenHash = await hashToken(token);
    const now = Date.now();

    const invitation = await c.env.DB.prepare(
      'SELECT id, email, role, expires_at, used_at FROM invitations WHERE token_hash = ?'
    )
      .bind(tokenHash)
      .first();

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    if (invitation.used_at) {
      return c.json({ error: 'This invitation has already been used' }, 400);
    }

    if ((invitation.expires_at as number) < now) {
      return c.json({ error: 'This invitation has expired' }, 400);
    }

    // Return invitation details (for UI to display)
    return c.json({
      valid: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error('Verify invitation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// POST /api/invite/:token/accept
// Accept invitation and create user account (public endpoint)
// ============================================================================

invitations.post('/accept/:token', async (c) => {
  try {
    const token = c.req.param('token');
    const body = await c.req.json();
    const { password } = body;

    // Validate password
    if (!password) {
      return c.json({ error: 'Password is required' }, 400);
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return c.json({ error: 'Password validation failed', errors: passwordValidation.errors }, 400);
    }

    // Verify JWT token
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(c.env.TOKEN_SECRET);

    let payload;
    try {
      const { payload: decoded } = await jose.jwtVerify(token, secretKey);
      payload = decoded;
    } catch (error) {
      return c.json({ error: 'Invalid or expired invitation token' }, 401);
    }

    if (payload.type !== 'user_invitation') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    // Check invitation in database
    const tokenHash = await hashToken(token);
    const now = Date.now();

    const invitation = await c.env.DB.prepare(
      'SELECT id, email, role, expires_at, used_at FROM invitations WHERE token_hash = ?'
    )
      .bind(tokenHash)
      .first();

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404);
    }

    if (invitation.used_at) {
      return c.json({ error: 'This invitation has already been used' }, 400);
    }

    if ((invitation.expires_at as number) < now) {
      return c.json({ error: 'This invitation has expired' }, 400);
    }

    // Check if user already exists (edge case - created between invitation and acceptance)
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(invitation.email)
      .first();

    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    // Create user account
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    // Determine system role: only 'admin' gets system admin role, others get NULL
    const systemRole = invitation.role === 'admin' ? 'admin' : null;

    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(userId, invitation.email, passwordHash, systemRole, now, now)
      .run();

    // Mark invitation as used
    await c.env.DB.prepare('UPDATE invitations SET used_at = ? WHERE id = ?')
      .bind(now, invitation.id)
      .run();

    // Log invitation acceptance
    await logInvitationAccepted(c.env.DB, c, invitation.id as string, userId, invitation.email as string);

    // Prepare response message based on role
    const instructions = systemRole === 'admin'
      ? [
          'Your admin account has been created successfully!',
          `Email: ${invitation.email}`,
          '',
          'You can now login with your email and password. You have full system access.',
        ]
      : [
          'Your account has been created successfully!',
          `Email: ${invitation.email}`,
          '',
          'You can now login with your email and password.',
          `Your invitation role was "${invitation.role}".`,
          'An administrator needs to assign you access to specific agents or servers.',
          'Until then, you will see a message asking you to contact your admin.',
        ];

    return c.json(
      {
        message: 'Account created successfully',
        user: {
          id: userId,
          email: invitation.email,
          systemRole,
          invitationRole: invitation.role,
        },
        instructions,
      },
      201
    );
  } catch (error) {
    console.error('Accept invitation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { invitations };
