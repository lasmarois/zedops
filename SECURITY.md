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

## Agent Authentication

The agent authentication system uses a two-token flow with JWT signatures and SHA-256 hashing.

### Token Types

**1. Ephemeral Tokens**
- **Purpose**: One-time registration of new agents
- **Lifetime**: 1 hour
- **Generation**: Admin API (`POST /api/admin/tokens`)
- **Usage**: First-time agent registration only
- **Payload**:
  ```json
  {
    "type": "ephemeral",
    "agentName": "agent-name",
    "iat": 1768028645,
    "exp": 1768032245
  }
  ```

**2. Permanent Tokens**
- **Purpose**: Ongoing agent authentication (reconnection)
- **Lifetime**: No expiry (valid until revoked)
- **Generation**: Issued by manager during registration
- **Storage**:
  - Agent: `~/.zedops-agent/token` (plaintext file)
  - Manager: SHA-256 hash in D1 database
- **Payload**:
  ```json
  {
    "type": "permanent",
    "agentId": "uuid",
    "agentName": "agent-name",
    "iat": 1768028668
  }
  ```

### Registration Flow (agent.register)

**Step 1: Admin generates ephemeral token**
```bash
curl -X POST https://manager/api/admin/tokens \
  -H "Authorization: Bearer admin" \
  -d '{"agentName":"my-agent"}'
```

**Step 2: Agent connects with ephemeral token**
- Agent connects to WebSocket: `wss://manager/ws`
- Sends `agent.register` message with ephemeral token
- Manager verifies:
  - JWT signature (using `TOKEN_SECRET`)
  - Token type is "ephemeral"
  - Token not expired
  - Agent name matches token payload

**Step 3: Manager issues permanent token**
- Generates new permanent token (no expiry)
- Hashes token with SHA-256
- Stores hash in D1 database (NOT the raw token)
- Returns permanent token to agent
- Agent saves to `~/.zedops-agent/token`

### Authentication Flow (agent.auth)

**Used when agent reconnects with permanent token**

**Step 1: Agent loads permanent token**
- Reads token from `~/.zedops-agent/token`
- Connects to WebSocket: `wss://manager/ws`

**Step 2: Agent sends authentication request**
- Sends `agent.auth` message with permanent token
- Manager verifies:
  - JWT signature (using `TOKEN_SECRET`)
  - Token type is "permanent"
  - Agent ID exists in database
  - Token hash matches stored hash

**Step 3: Manager authenticates agent**
- Calculates SHA-256 hash of received token
- Compares with stored hash in database
- If match: Sets agent status to "online", updates `last_seen`
- Returns `agent.auth.success` message

### Security Properties

**Token Signing**
- Algorithm: HS256 (HMAC-SHA256)
- Secret: `TOKEN_SECRET` environment variable
- Signature prevents token forgery

**Token Hashing**
- Algorithm: SHA-256
- Purpose: Prevent token exposure if database is compromised
- Only hash is stored, never the raw permanent token

**Token Rotation**
- Ephemeral tokens auto-expire (1 hour)
- Permanent tokens never expire (stateless)
- Revocation: Delete agent from database (hash no longer matches)

**Defense in Depth**
1. **TLS encryption**: All WebSocket traffic uses `wss://` (TLS)
2. **Signature verification**: JWT prevents token tampering
3. **Hash matching**: Database compromise doesn't leak tokens
4. **Expiry enforcement**: Ephemeral tokens have strict time limits
5. **Type checking**: Tokens can't be used for wrong purpose

**Attack Scenarios**

| Attack | Mitigation |
|--------|------------|
| Token forgery | JWT signature verification with `TOKEN_SECRET` |
| Token reuse | Ephemeral tokens expire after 1 hour |
| Database breach | Only SHA-256 hashes stored, not raw tokens |
| Man-in-the-middle | TLS encryption (`wss://`) required |
| Token theft from agent | File system security (agent responsibility) |
| Brute force | Token secret is 256+ bits of entropy |

**Known Limitations (MVP)**
- No token refresh mechanism (permanent tokens never expire)
- No rate limiting on authentication attempts
- No audit log of authentication events
- Agent token stored in plaintext on disk

**Planned Improvements (Future Milestones)**
- Token refresh with sliding expiry
- Rate limiting and brute force protection
- Audit logging to D1 database
- Agent-side token encryption at rest
- Multi-factor authentication for agents

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
