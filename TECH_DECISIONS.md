# Technical Decisions Log

This document tracks major technical decisions with rationale, alternatives considered, and current status.

---

## TD-001: NATS-Inspired WebSocket Protocol (2026-01-10)

**Decision:** Use WebSocket with NATS-inspired message protocol instead of actual NATS server

**Rationale:**
- Cloudflare Workers can't run external NATS server
- WebSocket with subject-based routing achieves same goals
- Zero external infrastructure (free to host)
- Clean pub/sub and request/reply patterns
- Familiar to developers who know NATS

**Message Protocol:**
```typescript
interface Message {
  subject: string;      // e.g., "server.start", "logs.servertest"
  reply?: string;       // Reply inbox for request/reply pattern
  data: any;            // Payload
  timestamp?: number;   // Optional
}
```

**Subject Namespaces:**
- `agent.*` - Agent-initiated messages
- `server.*` - Server lifecycle commands
- `docker.*` - Docker operations
- `logs.*` - Real-time log streaming (pub/sub)
- `rcon.*` - RCON commands
- `inbox.*` - Reply subjects (internal)

**Alternatives Considered:**
- Actual NATS server (rejected: needs external infrastructure, costs money)
- Plain WebSocket JSON-RPC (rejected: less elegant routing, tight coupling)
- gRPC (rejected: Cloudflare Workers don't support HTTP/2 bidirectional streaming well)

**Status:** ✅ Accepted

**References:** [ARCHITECTURE.md - Communication Protocol](ARCHITECTURE.md#communication-protocol)

---

## TD-002: Agent-Initiated Connections (2026-01-10)

**Decision:** Agents initiate outbound WebSocket connections to manager (not vice versa)

**Rationale:**
- Friends' computers are behind NAT/firewalls
- Outbound HTTPS/WSS connections work through firewalls
- No inbound port forwarding needed on friends' routers
- Manager doesn't need to know agent IPs (they can change)
- Agent identifies via token (not IP address)

**Flow:**
1. Agent starts, connects to `wss://manager.example.com`
2. Durable Object receives connection
3. Agent authenticates with permanent token
4. Connection stays open for bidirectional communication
5. If disconnected, agent reconnects automatically

**Alternatives Considered:**
- Manager-initiated connections (rejected: requires port forwarding, dynamic DNS, complex firewall setup)
- HTTP polling (rejected: inefficient, high latency, higher costs on Cloudflare)

**Status:** ✅ Accepted

**References:** [ARCHITECTURE.md - Agent Design](ARCHITECTURE.md#agent-design)

---

## TD-003: Go for Agent Binary (2026-01-10)

**Decision:** Use Go for the agent binary

**Rationale:**
- Single binary deployment (easy distribution to friends)
- Excellent Docker SDK (`docker/docker` library)
- Cross-platform compilation (Windows, macOS, Linux)
- Low memory footprint (~20 MB)
- Strong concurrency primitives for WebSocket handling
- Fast compile times for iteration
- `gorilla/websocket` is battle-tested

**Cross-Compilation:**
```bash
GOOS=windows GOARCH=amd64 go build -o agent.exe
GOOS=darwin GOARCH=amd64 go build -o agent-mac
GOOS=linux GOARCH=amd64 go build -o agent-linux
```

**Alternatives Considered:**
- Node.js (rejected: harder single-binary distribution, higher memory usage)
- Rust (rejected: slower development, steeper learning curve, overkill for this use case)
- Python (rejected: requires interpreter, harder to distribute)

**Status:** ✅ Accepted

---

## TD-004: TypeScript for Manager and Frontend (2026-01-10)

**Decision:** Use TypeScript for manager (Cloudflare Workers) and frontend (React)

**Rationale:**
- **Type safety**: Prevents runtime errors in production
- **Better IDE support**: Autocomplete, refactoring, inline documentation
- **Cloudflare Workers examples**: Official docs use TypeScript
- **React ecosystem**: TypeScript is standard practice in modern React
- **Validation**: Zod (TypeScript-first validation) works beautifully
- **Maintainability**: Easier to refactor and catch bugs early
- **Shared types**: Can share type definitions between frontend and manager

**Tech Stack:**
- Manager: TypeScript + Hono + Durable Objects + D1
- Frontend: TypeScript + React + Vite + Shadcn UI

**Important Clarification - Node.js vs Cloudflare Workers:**
- **Development**: Node.js 18+ required for tooling (Wrangler CLI, Vite, npm)
- **Production Manager Runtime**: Cloudflare Workers (V8 isolates, NOT Node.js)
- **Production Frontend**: Static files (Cloudflare Pages, no runtime needed)

Cloudflare Workers use the V8 JavaScript engine (same as Node.js) but in isolated environments, not full Node.js runtime. Some Node.js APIs are unavailable (fs, net, etc.), but this doesn't affect our use case.

**Alternatives Considered:**
- Plain JavaScript (rejected: lose type safety, harder to maintain as project grows)

**Status:** ✅ Accepted

---

## TD-005: Monorepo Structure (2026-01-10)

**Decision:** Use monorepo with frontend, manager, and agent in one repository

**Structure:**
```
zedops/
├── frontend/          # React + TypeScript
├── manager/           # Cloudflare Workers + TypeScript
├── agent/             # Go binary
├── docs/              # Documentation
└── planning-history/  # Planning sessions
```

**Rationale:**
- Single source of truth for all components
- Easier to coordinate changes across frontend/manager/agent
- Shared documentation and planning artifacts
- Simpler CI/CD (one pipeline)
- Atomic commits across components
- Easier for contributors (clone once)

**Tooling:**
- No monorepo tool needed (simple structure)
- Each component has own package.json / go.mod
- Root-level scripts for common tasks (optional)

**Alternatives Considered:**
- Multi-repo (rejected: harder to coordinate changes, duplicated docs, more complex CI/CD)
- Monorepo with Turborepo/Nx (rejected: overkill for this project size)

**Status:** ✅ Accepted

---

## TD-006: Cloudflare Free Tier (2026-01-10)

**Decision:** Build entire platform to run on Cloudflare free tier

**Rationale:**
- Zero hosting costs for hobby use (you + ~5 friends)
- Global edge deployment (low latency worldwide)
- No server infrastructure to maintain
- Auto-scaling (serverless)
- Workers, D1, Durable Objects, Pages all have generous free tiers

**Free Tier Limits:**
- Workers: 100k requests/day
- D1: 5 GB storage, 5M reads/day
- Durable Objects: 1M requests/month
- Pages: Unlimited requests

**Cost Estimate for 10 servers, 5 users:**
- API requests: ~1,000/day (well under 100k limit)
- D1 storage: <100 MB (well under 5 GB)
- Durable Objects: ~100k messages/month (well under 1M)
- **Total: $0/month**

**Alternatives Considered:**
- Traditional VPS (rejected: monthly cost, requires ops, single point of failure)
- Vercel (rejected: less suitable for WebSocket, Durable Objects unique to CF)
- AWS (rejected: expensive, complex, overkill)

**Status:** ✅ Accepted

**Note:** If usage grows beyond free tier, Cloudflare paid plan is $5/month for 10M requests (still very cheap).

---

## TD-007: Milestone-Based Development (2026-01-10)

**Decision:** Use milestone-based planning with planning-with-files skill

**Rationale:**
- Clear deliverables (each milestone is testable)
- Prevents scope creep (focused goals)
- Easier to track progress (⏳ → 🚧 → ✅)
- Independent milestones (can pause/resume)
- Historical context preserved (planning-history/)
- Proven pattern from steam-zomboid project

**Workflow:**
1. Start milestone with planning-with-files
2. Implement phases iteratively
3. Complete and archive to planning-history/
4. Update MILESTONES.md status
5. Start next milestone with clean slate

**Alternatives Considered:**
- Ad-hoc development (rejected: easy to lose track, forget requirements)
- Agile sprints (rejected: overkill for solo/small team, requires ceremonies)
- Waterfall (rejected: too rigid, doesn't allow iteration)

**Status:** ✅ Accepted

**References:** [CLAUDE.md - Development Workflow](CLAUDE.md#development-workflow)

---

## TD-008: Hardcoded Admin for MVP (2026-01-10)

**Decision:** Start with single hardcoded admin user, add proper auth in Milestone 6

**Rationale:**
- Faster to iterate on core features (Agent connection, container control)
- Authentication is well-understood (add later without risk)
- MVP validation doesn't require multi-user support
- Reduces initial complexity

**MVP Auth:**
- Single admin password in environment variable
- No signup/login UI needed initially
- JWT token for session management (still implemented)

**Migration Plan:**
- Milestone 6: Add user table, email/password, roles
- Migrate hardcoded admin to D1 user table
- Add invitation flow

**Alternatives Considered:**
- Build auth from day 1 (rejected: slows down initial progress)
- No auth at all (rejected: unsafe even for testing)

**Status:** ✅ Accepted (temporary, will be replaced in M6)

---

## Future Decisions (To Be Documented)

- **TD-009:** Agent installation mechanism (curl script vs downloadable installer)
- **TD-010:** RCON protocol handling (direct TCP vs proxy through agent WebSocket)
- **TD-011:** Backup storage strategy (local vs cloud storage)
- **TD-012:** Agent auto-update mechanism
- **TD-013:** Multi-tenancy architecture (if needed)

---

## Decision Template

```markdown
## TD-XXX: Decision Name (YYYY-MM-DD)

**Decision:** Brief statement of what was decided

**Rationale:**
- Key reason 1
- Key reason 2
- Key reason 3

**Alternatives Considered:**
- Alternative 1 (rejected: reason)
- Alternative 2 (rejected: reason)

**Status:** ✅ Accepted / 🚧 Proposed / ❌ Rejected / 🔄 Superseded by TD-YYY

**References:** [Link to relevant docs]
```
