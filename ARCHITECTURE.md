# Zomboid Manager - Cloudflare-Based Fleet Management Platform

**Date:** 2026-01-09
**Type:** Feature Proposal / Architecture Design
**Status:** Planning Phase

---

## What We're Building

**Centralized Zomboid Fleet Manager**
- Manager hosted on Cloudflare Workers (free, scalable, zero-ops)
- Agents run on friends' computers (Windows/Mac/Linux)
- Each friend controls their own server, you all manage from one UI
- Zomboid-specific features (RCON, mods, player management)

This is **perfect** because:
- ✅ Solves YOUR real use case (distributed friend servers)
- ✅ Agent architecture is NECESSARY (not over-engineering)
- ✅ Still focused (Zomboid-only)
- ✅ Free to host (CF Workers free tier: 100k requests/day)
- ✅ No infrastructure to maintain
- ✅ Actually achievable (2-3 months to MVP)

---

## Architecture

### High-Level Flow

```
┌──────────────────────────────────────────────────┐
│  Cloudflare Workers (Manager)                    │
│  ┌────────────────────────────────────────────┐  │
│  │ React UI (Cloudflare Pages)                │  │
│  │ - Server list                              │  │
│  │ - Real-time logs                           │  │
│  │ - RCON console                             │  │
│  │ - Config editor                            │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ API (Workers)                              │  │
│  │ - Auth (email/password or OAuth)           │  │
│  │ - Agent registration                       │  │
│  │ - Server management endpoints              │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ Durable Objects (WebSocket hub)            │  │
│  │ - Agent connections (persistent WS)        │  │
│  │ - Log streaming                            │  │
│  │ - Real-time status updates                 │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ D1 Database (SQLite)                       │  │
│  │ - Users, agents, servers                   │  │
│  │ - RBAC (roles per server)                  │  │
│  │ - Audit logs                               │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
                      ▲
                      │ HTTPS + WebSocket
                      │ (outbound from agents)
        ──────────────┼──────────────────────
        │             │                     │
   ┌────▼─────┐  ┌────▼─────┐        ┌─────▼────┐
   │ Agent 1  │  │ Agent 2  │        │ Agent 3  │
   │ Friend A │  │ Friend B │  ...   │ Friend N │
   │ (Windows)│  │ (Linux)  │        │ (Mac)    │
   └──────────┘  └──────────┘        └──────────┘
        │             │                     │
   ┌────▼─────┐  ┌────▼─────┐        ┌─────▼────┐
   │ Docker   │  │ Docker   │        │ Docker   │
   │ Zomboid  │  │ Zomboid  │        │ Zomboid  │
   │ Server   │  │ Server   │        │ Server   │
   └──────────┘  └──────────┘        └──────────┘
```

---

## Key Architectural Decisions

### 1. Agent → Manager Communication (Critical!)

Friends' computers are behind NAT/firewalls. **Agent initiates all connections:**

**Agent connects TO manager** (not vice versa):
```
Agent → CF Workers Durable Object (WebSocket)
  - Agent opens persistent WebSocket connection
  - Manager sends commands via this WS
  - Agent responds with results
  - If WS drops, agent reconnects automatically
```

**Why this works:**
- No inbound ports needed on friends' computers
- Works through NAT/firewall (outbound HTTPS/WSS)
- Manager doesn't need to know agent IPs

**Command Flow:**
```
User clicks "Restart Server" in UI
  ↓
React → CF Workers API → Durable Object
  ↓
Durable Object sends message to Agent via WebSocket
  ↓
Agent receives command, restarts container
  ↓
Agent sends response back via WebSocket
  ↓
Durable Object notifies UI (via UI's WebSocket)
  ↓
UI shows "Server restarted ✓"
```

### 2. Cloudflare Stack

**Frontend: Cloudflare Pages**
- React + Vite + Shadcn UI
- Deployed via `wrangler pages deploy`
- Served from edge globally
- Free tier: Unlimited requests

**Backend: Cloudflare Workers**
- Hono framework (lightweight, fast)
- REST API for CRUD operations
- Routes: `/api/servers`, `/api/agents`, `/api/auth`, etc.

**WebSocket Hub: Durable Objects**
- One Durable Object per agent (persistent connection)
- Handles real-time bidirectional communication
- Stores ephemeral state (agent connection status)

**Database: D1 (Cloudflare's SQLite)**
- Tables: `users`, `agents`, `servers`, `roles`, `audit_logs`
- Automatic replication
- SQL-based (familiar, powerful)

**Session Storage: Workers KV** (optional)
- Auth tokens/sessions
- Or use D1 for everything (simpler)

**Free Tier Limits:**
- Workers: 100k requests/day
- D1: 5 GB storage, 5 million reads/day
- Durable Objects: 1 GB storage, 1 million requests/month
- Pages: Unlimited

For your use case (you + ~5 friends), **everything is free**.

### 3. Agent Design

**Technology: Go**
- Single binary (cross-platform: Windows, Mac, Linux)
- Embeds Docker SDK
- Small memory footprint (~20 MB)
- Auto-update capability

**Agent Responsibilities:**
- Maintain WebSocket connection to manager
- Listen for commands (start, stop, restart, logs, exec RCON)
- Stream logs to manager in real-time
- Report server status (health checks)
- Control local Docker containers

**Installation:**
```bash
# On friend's computer
curl -sSL https://manager.example.com/install.sh | bash
# Prompts for registration token (from UI)
# Installs agent as systemd service / Windows Service / launchd
```

**Agent Configuration:**
```yaml
# ~/.zomboid-agent/config.yml
manager_url: wss://manager.example.com
agent_token: eyJhbGc...  # Permanent token after registration
host_name: friend-a-pc
```

### 4. Authentication & RBAC

**User Authentication:**
- Email/password (stored in D1, bcrypt hashed)
- Or: OAuth via GitHub/Discord (Cloudflare Workers supports this)

**RBAC Model:**
```
Admin (global)
  - Invite users
  - Manage all servers
  - View all audit logs

Operator (per-server)
  - Start/stop/restart server
  - Change server config
  - Use RCON console
  - View logs

Reader (per-server)
  - View server status
  - View logs (read-only)
  - No control
```

**D1 Schema:**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  role TEXT DEFAULT 'reader', -- admin, operator, reader
  created_at INTEGER
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT,
  token_hash TEXT, -- Agent's permanent token
  last_seen INTEGER,
  status TEXT, -- online, offline
  metadata JSON -- OS, Docker version, etc.
);

CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  name TEXT,
  config JSON, -- ENV vars, ports, etc.
  status TEXT -- running, stopped, error
);

CREATE TABLE user_server_roles (
  user_id TEXT REFERENCES users(id),
  server_id TEXT REFERENCES servers(id),
  role TEXT, -- operator, reader
  PRIMARY KEY (user_id, server_id)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT, -- 'restart_server', 'update_config', 'rcon_command'
  target_server_id TEXT,
  details JSON,
  timestamp INTEGER
);
```

### 5. Real-Time Features

**Logs Streaming:**
```
Agent streams logs → Durable Object → UI client (WebSocket)
```

**Status Updates:**
```
Agent sends heartbeat every 30s → Durable Object updates D1 → UI polls or WS
```

**RCON Console:**
```
User types command in UI → API → Durable Object → Agent
Agent executes via RCON → Response → Durable Object → UI
```

---

## Technology Stack (Final Recommendation)

### Frontend
- **React** (Vite for build)
- **Shadcn UI** (components)
- **TanStack Query** (server state, caching)
- **Zustand** (client state)
- **xterm.js** (RCON terminal)
- **Deployed on**: Cloudflare Pages

### Backend (Manager)
- **Cloudflare Workers** (API)
- **Hono** (web framework for Workers)
- **Durable Objects** (WebSocket hub)
- **D1** (database)
- **TypeScript** (Workers are JS-based)

### Agent
- **Go** (single binary)
- **gorilla/websocket** (WS client)
- **docker/docker** (Docker SDK)
- **Cross-compile** for Windows/Mac/Linux

---

## MVP Feature Set

### Phase 1 (Core - 4 weeks)
- ✅ Agent registration (ephemeral token → permanent token)
- ✅ View all agents and their status (online/offline)
- ✅ View servers on each agent
- ✅ Start/stop/restart server
- ✅ Real-time logs (streamed to UI)
- ✅ Basic auth (email/password)

### Phase 2 (Zomboid-Specific - 4 weeks)
- ✅ Server config UI (edit ENV vars from .env.template)
- ✅ Add new server to agent
- ✅ Remove server
- ✅ RCON console (terminal UI)
- ✅ Basic RBAC (admin/operator/reader)

### Phase 3 (Polish - 2 weeks)
- ✅ Audit logs (who did what, when)
- ✅ Player list (via RCON)
- ✅ Quick actions (kick player, send broadcast)
- ✅ Server metrics (CPU, memory - if agent reports)

### Phase 4 (Advanced - optional)
- ⏳ Mod management UI
- ⏳ Backup/restore configs
- ⏳ Agent auto-update
- ⏳ Email notifications (server down)

---

## Project Structure

```
zomboid-manager/
├── frontend/                    # React app
│   ├── src/
│   │   ├── components/         # Shadcn components
│   │   ├── pages/              # Server list, logs, RCON, config
│   │   ├── api/                # TanStack Query hooks
│   │   └── lib/                # Utils, WS client
│   └── package.json
│
├── manager/                     # Cloudflare Workers backend
│   ├── src/
│   │   ├── index.ts            # Main Worker (API routes)
│   │   ├── durable-objects/
│   │   │   └── AgentConnection.ts  # WebSocket hub
│   │   ├── db/                 # D1 queries
│   │   └── auth/               # JWT, bcrypt
│   ├── wrangler.toml           # CF config
│   └── schema.sql              # D1 migrations
│
├── agent/                       # Go agent binary
│   ├── main.go
│   ├── docker/                 # Docker SDK wrapper
│   ├── websocket/              # WS client
│   └── commands/               # Handle manager commands
│
├── docs/
│   ├── architecture.md
│   ├── agent-installation.md
│   └── api.md
│
└── docker-compose.dev.yml      # For local testing (mock agent)
```

---

## Development Workflow

### Local Development
1. **Frontend**: `npm run dev` (Vite dev server)
2. **Manager**: `wrangler dev` (local Workers runtime)
3. **Agent**: `go run main.go` (connect to local manager)
4. **D1**: `wrangler d1 execute DB --local --file=schema.sql` (local SQLite)

### Deployment
1. **Frontend**: `wrangler pages deploy frontend/dist`
2. **Manager**: `wrangler deploy` (publishes Workers + Durable Objects)
3. **D1**: `wrangler d1 execute DB --remote --file=migrations/001.sql`
4. **Agent**: Cross-compile and release binaries via GitHub Releases

---

## Agent Installation Experience

### From User Perspective

1. User logs into manager UI
2. Clicks "Add Agent"
3. UI generates ephemeral token (expires in 1 hour)
4. UI shows installation command:
   ```bash
   curl -sSL https://manager.example.com/install.sh | \
     TOKEN=eyJhbGc... bash
   ```
5. Friend copies command, runs on their computer
6. Script:
   - Downloads agent binary (detects OS/arch)
   - Prompts for agent name ("friend-a-pc")
   - Registers with manager using token → gets permanent token
   - Installs as system service
   - Starts agent
7. Agent connects to manager via WebSocket
8. UI shows "friend-a-pc - Online ✓"

---

## Challenges & Solutions

### Challenge 1: Friends' Dynamic IPs

**Problem**: Agents reconnect from different IPs (residential internet, DHCP)

**Solution**:
- Agent identifies via permanent token (not IP)
- Manager doesn't care about agent IP
- WebSocket connection is outbound from agent

### Challenge 2: Cloudflare Workers CPU Limits

**Problem**: Workers have 10ms CPU time per request (can be extended to 50ms on paid plan, but still limited)

**Solution**:
- Offload heavy work to agents (they do the Docker operations)
- Manager just routes commands and stores state
- Durable Objects can run longer for WebSocket handling

### Challenge 3: Real-Time Logs at Scale

**Problem**: Streaming logs from multiple servers to multiple users

**Solution**:
- Agent sends logs to Durable Object (one per agent)
- Durable Object fans out to connected UI clients
- Logs NOT stored in D1 (too much data)
- Optional: Store last 1000 lines in Durable Object storage for "catch-up"

### Challenge 4: Agent Updates

**Problem**: How to update agent binary on friends' computers?

**Solution** (Phase 4):
- Agent checks manager for latest version on startup
- If outdated, downloads new binary, replaces itself, restarts
- Graceful: Waits for idle state before update

---

## Costs

### Cloudflare Free Tier
- Workers: 100k requests/day ✅
- D1: 5 GB, 5M reads/day ✅
- Durable Objects: 1M requests/month ✅
- Pages: Unlimited ✅

### For 5 friends, ~10 servers
- API calls: ~1000/day (well under limit)
- Durable Objects: ~100k messages/month (under limit)
- D1: <100 MB (under limit)

**Cost: $0/month** (stays free indefinitely)

**If you grow:**
- Workers Paid ($5/month): 10M requests
- Still very cheap for hobby use

---

## Open Questions

1. **Do you want to build this?** (It's ~2-3 months of focused work for MVP)

2. **Who's the admin?** Just you, or do you want friends to invite other friends?

3. **Auth preference:**
   - Email/password (simpler, I can help build)
   - OAuth via GitHub/Discord (cooler, friends might already have accounts)

4. **Agent installation:**
   - curl script (Unix-style, I'll write it)
   - Or download installer (Windows .exe, Mac .pkg)?

5. **Do you want to use planning-with-files for this?** (I highly recommend it - this is complex!)

---

## Why This Project is Great

- ✅ Real use case (you and friends need this)
- ✅ Achievable scope (Zomboid-only, not generic)
- ✅ Modern stack (React + Cloudflare = fun to build)
- ✅ Free to host (no ongoing costs)
- ✅ Useful learning (distributed systems, WebSockets, Go)

---

## Next Steps

1. Create new repo: `zomboid-manager`
2. Use planning-with-files skill
3. Design D1 schema
4. Build agent registration flow (first deliverable)
5. Iterate from there

---

**Estimated Timeline:** 2-3 months to usable MVP
**Estimated Cost:** $0/month on Cloudflare free tier
**Project Complexity:** Medium-High (distributed system, real-time features)
**Learning Value:** High (modern serverless, WebSockets, Go, Docker SDK)
