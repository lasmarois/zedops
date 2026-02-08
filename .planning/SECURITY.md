# Security Policy

## Secret Management

This project uses Cloudflare Workers secret management:

### Safe to Commit

- **D1 Database IDs** - Account-scoped identifiers, not secrets
- **`.dev.vars.example`** - Template file with example values only
- **Configuration files** - `wrangler.toml`, `package.json`, etc.

### NEVER Commit

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
openssl rand -base64 32
npx wrangler secret put TOKEN_SECRET
npx wrangler secret put ADMIN_PASSWORD
```

## Secrets Required

### Manager (Cloudflare Worker)

- **`TOKEN_SECRET`** (required)
  - Purpose: JWT signing secret for agent and user session tokens
  - Format: Random string (at least 32 characters)
  - Generation: `openssl rand -base64 32`

- **`ADMIN_PASSWORD`** (required)
  - Purpose: Bootstrap admin account creation (`POST /api/bootstrap`)
  - Note: Only used once during initial setup; all subsequent auth uses JWT sessions

---

## User Authentication & RBAC

### Role Model (4 roles)

| Role | Scope | Capabilities |
|------|-------|-------------|
| **admin** | System (users.role column) | Full system access, user management, all servers |
| **agent-admin** | Assignment (per-agent) | Create/delete servers on assigned agent + operator capabilities |
| **operator** | Assignment (per-agent/server) | Start/stop/restart servers, RCON, view |
| **viewer** | Assignment (per-agent/server) | View-only access to assigned servers |

### Scope Hierarchy (most specific wins)

1. **Server-level** assignment (overrides agent-level)
2. **Agent-level** assignment (applies to all servers on that agent)
3. **Global** assignment (applies to all agents/servers)
4. **System role** (admin only — bypasses all checks)

### Capability Hierarchy

- admin > agent-admin > operator > viewer
- operator implies viewer (can view what they control)
- agent-admin implies operator + viewer for their assigned agent

### User Session Flow

1. User logs in with email + password (`POST /api/auth/login`)
2. Server generates JWT session token (HS256, 7-day expiry)
3. Session stored in D1 `sessions` table (token hash only)
4. Client stores JWT in localStorage, sends as `Authorization: Bearer <token>`
5. `requireAuth()` middleware validates JWT signature + session existence on each request

### Session Management

- **Token format**: JWT (HS256) with `type: 'user_session'`, `userId`, `email`, `role`
- **Expiry**: 7 days from issuance
- **Storage**: SHA-256 hash in D1 `sessions` table
- **Refresh**: `POST /api/auth/refresh` generates new token, updates session
- **Logout**: Deletes session from D1
- **Password change**: Self-service via `PATCH /api/auth/password` (requires current password)

### Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- Hashed with bcrypt (10 rounds) before storage

### User Invitation Flow

1. Admin creates invitation with email + role (`POST /api/users/invite`)
2. System generates invitation token (24-hour expiry)
3. Admin shares invitation link with user
4. User accepts invitation, sets password (`POST /api/invite/accept/:token`)
5. User account created with specified role

### Audit Logging

All sensitive operations are logged to `audit_logs` table:
- User login/logout (success and failure)
- User creation, deletion, role changes
- Server operations (create, start, stop, delete, rebuild)
- RCON command execution
- Role assignment changes
- Invitation lifecycle

Retention: 90-day default (configurable via `POST /api/audit/cleanup`)

---

## Agent Authentication

### Token Types

**1. Ephemeral Tokens**
- Purpose: One-time registration of new agents
- Lifetime: 1 hour
- Generation: Admin API (`POST /api/admin/tokens`)
- Payload: `{ type: "ephemeral", agentName, iat, exp }`

**2. Permanent Tokens**
- Purpose: Ongoing agent authentication (reconnection)
- Lifetime: No expiry (valid until agent deleted)
- Storage: Agent saves to `~/.zedops-agent/token` (plaintext); manager stores SHA-256 hash in D1
- Payload: `{ type: "permanent", agentId, agentName, iat }`

### Registration Flow

1. Admin generates ephemeral token via API
2. Agent connects to WebSocket with ephemeral token
3. Manager verifies JWT signature, type, expiry, agent name match
4. Manager issues permanent token, stores hash in D1
5. Agent saves permanent token to disk

### Authentication Flow (reconnection)

1. Agent reads permanent token from `~/.zedops-agent/token`
2. Agent connects to WebSocket, sends `agent.auth` with token
3. Manager verifies JWT signature, type, agent ID existence, hash match
4. Manager sets agent status to "online"

### Worker-to-DO Trust Boundary

The `X-User-Id` header passed from the Worker to Durable Objects is set after JWT validation in the Worker layer. Worker-to-DO communication is internal to the Cloudflare runtime and cannot be spoofed by external requests.

### Security Properties

| Layer | Mechanism |
|-------|-----------|
| Transport | TLS encryption (`wss://`) |
| Token integrity | JWT HS256 signature |
| Database protection | SHA-256 token hashing (raw tokens never stored) |
| Token scope | Type checking prevents cross-purpose use |
| Ephemeral expiry | 1-hour strict time limit |
| Brute force | Token secret is 256+ bits of entropy |

### Known Limitations

- No token refresh mechanism for permanent agent tokens
- No rate limiting on login endpoint (acceptable for small user base)
- Agent token stored in plaintext on disk (agent host responsibility)

---

## Security Best Practices

1. **Never commit `.dev.vars`** — Always gitignored
2. **Use `wrangler secret put` for production** — Never hardcode secrets
3. **Rotate secrets regularly** — Especially before making repository public
4. **Use strong random strings** — `openssl rand -base64 32`
5. **Different secrets per environment** — Dev and production use separate values

## Reporting Security Issues

If you discover a security vulnerability, please email the maintainer directly instead of using the issue tracker.
