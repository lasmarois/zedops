# Security Policy

## Secret Management

This project uses Cloudflare Workers secret management:

### ✅ Safe to Commit

- **D1 Database IDs** - These are account-scoped identifiers, not secrets
- **`.dev.vars.example`** - Template file with example values only
- **Configuration files** - `wrangler.toml`, `package.json`, etc.

### ❌ NEVER Commit

- **`.dev.vars`** - Local development secrets (gitignored)
- **Production secrets** - Set via `wrangler secret put`
- **Token values** - JWT secrets, API keys, passwords

## Local Development

1. Copy the example file:
   ```bash
   cp manager/.dev.vars.example manager/.dev.vars
   ```

2. Edit `.dev.vars` with your local development secrets:
   ```
   TOKEN_SECRET=your-local-secret
   ADMIN_PASSWORD=your-local-password
   ```

3. Never commit `.dev.vars` (it's gitignored)

## Production Deployment

Set secrets using Wrangler CLI (never hardcode in config files):

```bash
# Generate a strong random secret
openssl rand -base64 32

# Set the secret
npx wrangler secret put TOKEN_SECRET
npx wrangler secret put ADMIN_PASSWORD
```

## Secrets Required

### Manager (Cloudflare Worker)

- **`TOKEN_SECRET`** (required)
  - Purpose: JWT signing secret for agent authentication
  - Format: Random string (at least 32 characters)
  - Generation: `openssl rand -base64 32`

- **`ADMIN_PASSWORD`** (required)
  - Purpose: Admin API authentication (MVP - replaced with proper auth in Milestone 6)
  - Format: Strong password
  - Note: Will be replaced with proper RBAC in future milestone

## Reporting Security Issues

If you discover a security vulnerability, please email the maintainer directly instead of using the issue tracker.

## Security Best Practices

1. **Never commit `.dev.vars`** - Always gitignored
2. **Use `wrangler secret put` for production** - Never hardcode secrets in `wrangler.toml`
3. **Rotate secrets regularly** - Especially before making repository public
4. **Use strong random strings** - Use `openssl rand -base64 32` or similar
5. **Different secrets per environment** - Development and production should use different values

## Current Security Status (MVP)

⚠️ **Note:** This is an MVP implementation with hardcoded admin authentication.

**Current limitations:**
- Single admin password (no user management)
- No role-based access control (RBAC)
- No password reset functionality

**Planned improvements (Milestone 6):**
- Full RBAC implementation (admin/operator/viewer roles)
- User management with D1 database
- Per-server role assignments
- Proper authentication flow
