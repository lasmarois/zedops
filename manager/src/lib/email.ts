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
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#080604;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e0d6;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#080604" style="background-color:#080604;padding:40px 20px;">
    <tr>
      <td align="center" bgcolor="#080604">
        <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#121010" style="max-width:520px;background-color:#121010;border-radius:12px;border:1px solid #2a1f17;">
          <!-- Header -->
          <tr>
            <td bgcolor="#121010" style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid #2a1f17;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#f58b07;letter-spacing:-0.5px;">ZedOps</h1>
              <p style="margin:6px 0 0;font-size:12px;color:#6b5d52;letter-spacing:1px;text-transform:uppercase;">Infrastructure Manager</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td bgcolor="#121010" style="padding:24px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#e8e0d6;line-height:1.5;">
                You've been invited to join ZedOps as <strong style="color:#f58b07;">${role}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b5d52;line-height:1.5;">
                Click the button below to create your account. This invitation expires in 24 hours.
              </p>
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${invitationUrl}" style="display:inline-block;padding:14px 36px;background-color:#f58b07;color:#080604;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- URL fallback -->
          <tr>
            <td bgcolor="#121010" style="padding:0 32px 24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#6b5d52;">
                Or copy this link:
              </p>
              <p style="margin:0;font-size:12px;color:#f58b07;word-break:break-all;">
                ${invitationUrl}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td bgcolor="#121010" style="padding:16px 32px;border-top:1px solid #2a1f17;">
              <p style="margin:0;font-size:12px;color:#6b5d52;text-align:center;">
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
