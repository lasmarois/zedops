# Goal #20: Findings

## Research (from previous session)
- MailChannels (Cloudflare free integration) terminated August 2024
- Cloudflare native Email Service in private beta, no GA date
- **Resend** chosen: 3,000 emails/month free, simple REST API
- Resend API: `POST https://api.resend.com/emails` with `Authorization: Bearer <key>`
- No SDK needed — single `fetch()` call

## Codebase Analysis
- `invitations.ts` POST handler creates invite, generates JWT token (24h expiry), stores hash in D1
- Invitation URL constructed: `${baseUrl}/register?token=${token}`
- Bindings type duplicated in `index.ts` (global) and `invitations.ts` (local)
- `InviteUserResponse` in `api.ts` at line 1104 — added `emailSent?` and `emailError?`
- `UserList.tsx` invite form at line 189-252 — updated with email status display

## Email Template Learnings
- Email clients (ProtonMail, Gmail) may ignore CSS `background-color` — use `bgcolor` HTML attribute on every `<td>` and `<table>`
- Add `<meta name="color-scheme" content="dark">` to prevent email clients from applying light-mode overrides
- Inline styles only — email clients strip `<style>` blocks
- Solar Flare palette: bg `#080604`, card `#121010`, border `#2a1f17`, primary `#f58b07`, text `#e8e0d6`, muted `#6b5d52`

## Configuration
- `RESEND_API_KEY` — Cloudflare secret (both envs), optional for graceful degradation
- `RESEND_FROM_EMAIL` — Cloudflare secret (both envs), sender address (must match verified Resend domain)
- `nicomarois.com` verified in Resend with DKIM/SPF
