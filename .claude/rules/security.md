# Security Rules

## Never Commit

- `.dev.vars` - Local secrets (gitignored)
- Token values, JWT secrets, API keys, passwords
- Hardcoded credentials in code

## Safe to Commit

- D1 Database IDs (account-scoped identifiers)
- `.dev.vars.example` (template with placeholder values)
- Configuration files (`wrangler.toml`, `package.json`)

## When Writing Code

- Never hardcode secrets - use environment variables
- Use `wrangler secret put` for production secrets
- Hash tokens before storing in database (SHA-256)
- Validate JWT signatures on all auth endpoints
- Enforce token type checking (ephemeral vs permanent)

## Auth System Overview

See @SECURITY.md for full details. Key points:

- **Ephemeral tokens**: 1-hour, one-time registration
- **Permanent tokens**: No expiry, stored as SHA-256 hash in D1
- **Agent token storage**: `~/.zedops-agent/token` on host

## Security Checks Before PR

- No secrets in committed code
- Auth endpoints validate JWT signatures
- Database stores hashes, not raw tokens
- TLS required for WebSocket (`wss://`)
