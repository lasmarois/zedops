# Goal #20: Email Invites via Resend

## Overview
Add email sending to the user invitation flow using Resend's API (plain fetch, no SDK). Graceful degradation — if RESEND_API_KEY isn't set or Resend fails, the invite is still created and the link is returned.

## Phases

### Phase 1: Backend — Email Utility `[complete]`
- [x] Create `manager/src/lib/email.ts` with `sendEmail()` and `buildInvitationEmailHtml()`
- [x] `sendEmail()` uses plain `fetch()` to Resend API, never throws
- [x] HTML email template: dark-themed, matches ZedOps branding

### Phase 2: Backend — Integration `[complete]`
- [x] Add `RESEND_API_KEY?` to Bindings in `manager/src/index.ts` (line 34)
- [x] Add `RESEND_API_KEY?` to local Bindings in `manager/src/routes/invitations.ts`
- [x] After audit log, call `sendEmail()` if API key exists
- [x] Add `emailSent` and `emailError` fields to JSON response
- [x] Update `.dev.vars.example` with placeholder

### Phase 3: Frontend — Email Status UI `[complete]`
- [x] Add `emailSent?` and `emailError?` to `InviteUserResponse` in `api.ts`
- [x] Update `UserList.tsx` to show email status (green check / yellow warning)
- [x] Copy-link always visible regardless of email status

### Phase 4: Verify `[complete]`
- [x] `cd frontend && npm run build` passes with no TS errors
- [x] Review all changes for correctness

## Files Touched
| File | Action |
|------|--------|
| `manager/src/lib/email.ts` | NEW |
| `manager/src/routes/invitations.ts` | MODIFIED |
| `manager/src/index.ts` | MODIFIED (Bindings) |
| `manager/.dev.vars.example` | MODIFIED |
| `frontend/src/lib/api.ts` | MODIFIED (types) |
| `frontend/src/components/UserList.tsx` | MODIFIED (UI) |
