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

export function buildInvitationEmailHtml(invitationUrl: string, role: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#1a1a1a;border-radius:12px;border:1px solid #2d2d2d;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 16px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">ZedOps</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:8px 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#e0e0e0;line-height:1.5;">
                You've been invited to join ZedOps as <strong style="color:#ffffff;">${role}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#999999;line-height:1.5;">
                Click the button below to create your account. This invitation expires in 24 hours.
              </p>
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${invitationUrl}" style="display:inline-block;padding:12px 32px;background-color:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- URL fallback -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#666666;">
                Or copy this link:
              </p>
              <p style="margin:0;font-size:12px;color:#3b82f6;word-break:break-all;">
                ${invitationUrl}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #2d2d2d;">
              <p style="margin:0;font-size:12px;color:#555555;text-align:center;">
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
