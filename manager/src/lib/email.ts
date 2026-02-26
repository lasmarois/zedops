/**
 * Email sending via Resend API
 *
 * Uses plain fetch() — no SDK, zero dependencies.
 * Never throws — returns { success, emailId?, error? } for graceful degradation.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'ZedOps <noreply@example.com>';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

interface SendEmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

export type EmailThemeColors = {
  bg: string;
  card: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
  success: string;
  error: string;
};

export const EMAIL_THEME_COLORS: Record<string, EmailThemeColors> = {
  'solar-flare':    { bg: '#080604', card: '#121010', border: '#2a1f17', accent: '#f58b07', text: '#e8e0d6', muted: '#6b5d52', success: '#22c55e', error: '#ef4444' },
  'midnight-blue':  { bg: '#0a0f1a', card: '#101827', border: '#1e2d4a', accent: '#3b82f6', text: '#e2e8f0', muted: '#64748b', success: '#4ade80', error: '#f87171' },
  'cyberpunk-neon': { bg: '#0d0515', card: '#150a20', border: '#2d1b3d', accent: '#e91e9c', text: '#f0e4f5', muted: '#8b6fa0', success: '#22d67a', error: '#f43f5e' },
  'emerald-dark':   { bg: '#060f0b', card: '#0c1a15', border: '#1a3028', accent: '#22c55e', text: '#e4f0eb', muted: '#5f8a76', success: '#34d880', error: '#ef4444' },
  'amber-forge':    { bg: '#110c05', card: '#1a1208', border: '#33261a', accent: '#f59e0b', text: '#ede4d6', muted: '#8a7560', success: '#22c55e', error: '#ef4444' },
  'arctic-frost':   { bg: '#0c1014', card: '#131a21', border: '#243040', accent: '#38bdf8', text: '#e8edf2', muted: '#7a8a9e', success: '#34d399', error: '#f87171' },
};

export const DEFAULT_EMAIL_THEME = EMAIL_THEME_COLORS['solar-flare'];

export function getEmailThemeColors(themeName: string | null | undefined): EmailThemeColors {
  return EMAIL_THEME_COLORS[themeName || 'solar-flare'] || DEFAULT_EMAIL_THEME;
}

export async function sendEmail(apiKey: string, options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || DEFAULT_FROM,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      const message = (data as { message?: string }).message || `Resend API returned ${response.status}`;
      console.error('Resend API error:', message);
      return { success: false, error: message };
    }

    const data = await response.json() as { id?: string };
    return { success: true, emailId: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error';
    console.error('Email send failed:', message);
    return { success: false, error: message };
  }
}

export function buildAgentOfflineEmailHtml(agentName: string, disconnectedAt: string, c: EmailThemeColors = DEFAULT_EMAIL_THEME): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:${c.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${c.text};">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.bg}" style="background-color:${c.bg};padding:40px 20px;">
    <tr>
      <td align="center" bgcolor="${c.bg}">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.card}" style="max-width:520px;background-color:${c.card};border-radius:12px;border:1px solid ${c.border};">
          <tr>
            <td bgcolor="${c.card}" style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid ${c.border};">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:${c.accent};letter-spacing:-0.5px;">ZedOps</h1>
              <p style="margin:6px 0 0;font-size:12px;color:${c.muted};letter-spacing:1px;text-transform:uppercase;">Agent Alert</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${c.card}" style="padding:24px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:${c.text};line-height:1.5;">
                Agent <strong style="color:${c.accent};">${agentName}</strong> has been <strong style="color:${c.error};">offline</strong> for 5 minutes.
              </p>
              <p style="margin:0 0 8px;font-size:14px;color:${c.muted};line-height:1.5;">
                Disconnected at: <strong style="color:${c.text};">${disconnectedAt}</strong>
              </p>
              <p style="margin:16px 0 0;font-size:14px;color:${c.muted};line-height:1.5;">
                The agent may have crashed, the host may be down, or there may be a network issue. Check the agent host and restart if needed.
              </p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${c.card}" style="padding:16px 32px;border-top:1px solid ${c.border};">
              <p style="margin:0;font-size:12px;color:${c.muted};text-align:center;">
                You received this because you are assigned to this agent on ZedOps.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildAgentRecoveredEmailHtml(agentName: string, downtimeMinutes: number, c: EmailThemeColors = DEFAULT_EMAIL_THEME): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:${c.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${c.text};">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.bg}" style="background-color:${c.bg};padding:40px 20px;">
    <tr>
      <td align="center" bgcolor="${c.bg}">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.card}" style="max-width:520px;background-color:${c.card};border-radius:12px;border:1px solid ${c.border};">
          <tr>
            <td bgcolor="${c.card}" style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid ${c.border};">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:${c.accent};letter-spacing:-0.5px;">ZedOps</h1>
              <p style="margin:6px 0 0;font-size:12px;color:${c.muted};letter-spacing:1px;text-transform:uppercase;">Agent Recovery</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${c.card}" style="padding:24px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:${c.text};line-height:1.5;">
                Agent <strong style="color:${c.accent};">${agentName}</strong> is back <strong style="color:${c.success};">online</strong>.
              </p>
              <p style="margin:0;font-size:14px;color:${c.muted};line-height:1.5;">
                Total downtime: <strong style="color:${c.text};">${downtimeMinutes} minute${downtimeMinutes !== 1 ? 's' : ''}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${c.card}" style="padding:16px 32px;border-top:1px solid ${c.border};">
              <p style="margin:0;font-size:12px;color:${c.muted};text-align:center;">
                You received this because you are assigned to this agent on ZedOps.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildAgentUpdatedEmailHtml(agentName: string, oldVersion: string, newVersion: string, c: EmailThemeColors = DEFAULT_EMAIL_THEME): string {
  const updatedAt = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' });
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:${c.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${c.text};">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.bg}" style="background-color:${c.bg};padding:40px 20px;">
    <tr>
      <td align="center" bgcolor="${c.bg}">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.card}" style="max-width:520px;background-color:${c.card};border-radius:12px;border:1px solid ${c.border};">
          <tr>
            <td bgcolor="${c.card}" style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid ${c.border};">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:${c.accent};letter-spacing:-0.5px;">ZedOps</h1>
              <p style="margin:6px 0 0;font-size:12px;color:${c.muted};letter-spacing:1px;text-transform:uppercase;">Agent Update</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${c.card}" style="padding:24px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:${c.text};line-height:1.5;">
                Agent <strong style="color:${c.accent};">${agentName}</strong> updated successfully.
              </p>
              <p style="margin:0 0 8px;font-size:14px;color:${c.muted};line-height:1.5;">
                Version: <strong style="color:${c.text};">v${oldVersion}</strong> &rarr; <strong style="color:${c.success};">v${newVersion}</strong>
              </p>
              <p style="margin:8px 0 0;font-size:14px;color:${c.muted};line-height:1.5;">
                Updated at: <strong style="color:${c.text};">${updatedAt}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${c.card}" style="padding:16px 32px;border-top:1px solid ${c.border};">
              <p style="margin:0;font-size:12px;color:${c.muted};text-align:center;">
                You received this because you are assigned to this agent on ZedOps.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildInvitationEmailHtml(invitationUrl: string, role: string, c: EmailThemeColors = DEFAULT_EMAIL_THEME): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:${c.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${c.text};">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.bg}" style="background-color:${c.bg};padding:40px 20px;">
    <tr>
      <td align="center" bgcolor="${c.bg}">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.card}" style="max-width:520px;background-color:${c.card};border-radius:12px;border:1px solid ${c.border};">
          <!-- Header -->
          <tr>
            <td bgcolor="${c.card}" style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid ${c.border};">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:${c.accent};letter-spacing:-0.5px;">ZedOps</h1>
              <p style="margin:6px 0 0;font-size:12px;color:${c.muted};letter-spacing:1px;text-transform:uppercase;">Infrastructure Manager</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td bgcolor="${c.card}" style="padding:24px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:${c.text};line-height:1.5;">
                You've been invited to join ZedOps as <strong style="color:${c.accent};">${role}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:${c.muted};line-height:1.5;">
                Click the button below to create your account. This invitation expires in 24 hours.
              </p>
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${invitationUrl}" style="display:inline-block;padding:14px 36px;background-color:${c.accent};color:${c.bg};text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- URL fallback -->
          <tr>
            <td bgcolor="${c.card}" style="padding:0 32px 24px;">
              <p style="margin:0 0 8px;font-size:12px;color:${c.muted};">
                Or copy this link:
              </p>
              <p style="margin:0;font-size:12px;color:${c.accent};word-break:break-all;">
                ${invitationUrl}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td bgcolor="${c.card}" style="padding:16px 32px;border-top:1px solid ${c.border};">
              <p style="margin:0;font-size:12px;color:${c.muted};text-align:center;">
                If you didn't expect this invitation, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
