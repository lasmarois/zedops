# Progress Log: Milestone 1 - Agent Connection

**Purpose:** Session tracking, test results, and implementation notes as work progresses.

**Session Started:** 2026-01-10

---

## Session 1: Planning Phase (2026-01-10)

**Time:** ~30 minutes
**Phase:** Phase 0 - Planning
**Actions:**
- ✅ Created task_plan.md with 9 phases
- ✅ Created findings.md with architecture research
- ✅ Created progress.md (this file)

**Decisions Made:**
- Use Vite for frontend (fast, modern)
- Use Hono for manager API (lightweight, Workers-optimized)
- Hardcode admin password for MVP auth
- Store agent token in `~/.zedops-agent/token` file
- 30-second heartbeat interval
- Exponential backoff for reconnection (1s → 60s cap)

**Key Design Choices:**
- Agent ID used as Durable Object ID (deterministic routing)
- Token in WebSocket URL query parameter (simplest)
- Reject non-registration messages before agent registers
- NATS-inspired message protocol (subject-based routing)

**Next:** Phase 1 - Project Structure Setup

---

## Session 2: Phase 1 - Project Structure Setup (2026-01-10)

**Time:** ~20 minutes
**Phase:** Phase 1 - Project Structure Setup
**Actions:**
- ✅ Created frontend/ directory with Vite + React + TypeScript template
- ✅ Created manager/ directory with Wrangler template
- ✅ Created agent/ directory with Go module
- ✅ Configured manager/wrangler.toml (Durable Objects, D1, static assets)
- ✅ Added dependencies to manager/package.json (hono, jose)
- ✅ Added dependencies to frontend/package.json (@tanstack/react-query, zustand)
- ✅ Created manager/schema.sql with agents table
- ✅ Created agent/go.mod with dependencies
- ✅ Created agent/.gitignore
- ✅ Created manager/README.md
- ✅ Created agent/README.md
- ✅ Updated frontend/README.md

**Files Created:**
- frontend/ (React app structure)
- manager/ (Cloudflare Worker structure)
- agent/ (Go module structure)
- manager/wrangler.toml (full-stack Workers config)
- manager/schema.sql (D1 database schema)
- manager/README.md (manager documentation)
- agent/README.md (agent documentation)
- agent/.gitignore (Go ignores)

**Errors Encountered:**
- GLIBC version error during `wrangler types` (non-blocking, system limitation)
- Go not installed (worked around by creating go.mod manually)

**Validation:**
- ✅ All directories created
- ✅ All configuration files in place
- ⏳ Dependencies not installed (GLIBC limitation on this system - user will install on their machine)

**Next:** Phase 2 - Manager - Durable Object WebSocket Handler

---

## Files Created

| File | Purpose | Status |
|------|---------|--------|
| task_plan.md | Phase tracking and planning | ✅ Created |
| findings.md | Research and design decisions | ✅ Created |
| progress.md | Session log (this file) | ✅ Created |
| frontend/* | React UI structure | ✅ Created |
| manager/* | Cloudflare Worker structure | ✅ Created |
| agent/* | Go agent structure | ✅ Created |
| manager/wrangler.toml | Workers configuration | ✅ Created |
| manager/schema.sql | D1 database schema | ✅ Created |
| manager/README.md | Manager documentation | ✅ Created |
| agent/README.md | Agent documentation | ✅ Created |

---

## Dependencies Identified

**Development Tools:**
- Node.js 18+ (for Vite, Wrangler)
- Go 1.21+ (for agent)
- Cloudflare account (free tier)
- wrangler CLI (npm install -g wrangler)

**NPM Packages (Manager):**
- hono (API framework)
- jose (JWT library for Workers)

**NPM Packages (Frontend):**
- @tanstack/react-query (server state)
- zustand (client state)
- Shadcn UI components (manual copy)

**Go Packages (Agent):**
- github.com/google/uuid (UUID generation)
- github.com/gorilla/websocket (WebSocket client)

---

## Test Scenarios Planned

### Scenario 1: Fresh Agent Registration
1. Generate ephemeral token: `POST /api/admin/tokens`
2. Start agent: `go run main.go --token=<ephemeral>`
3. Verify agent registers and receives permanent token
4. Verify permanent token saved to `~/.zedops-agent/token`
5. Verify UI shows "Agent online ✓"

### Scenario 2: Agent Reconnection
1. Start agent with permanent token
2. Stop manager (simulate network loss)
3. Verify agent attempts reconnection (exponential backoff)
4. Restart manager
5. Verify agent reconnects successfully
6. Verify UI updates to "online"

### Scenario 3: Bidirectional Messaging
1. Agent sends message: `{"subject":"test.echo","data":"hello"}`
2. Manager echoes back: `{"subject":"test.echo","data":"hello"}`
3. Agent receives echo
4. Log success

### Scenario 4: Multiple Agents
1. Start agent 1: "agent-1"
2. Start agent 2: "agent-2"
3. Start agent 3: "agent-3"
4. Verify UI shows 3 agents online
5. Stop agent 2
6. Verify UI shows 2 online, 1 offline

---

## Questions & Blockers

**Questions:**
- _(none yet - just started planning)_

**Blockers:**
- _(none yet)_

---

## Notes

- This is Milestone 1 - ONLY agent connection, no server control yet
- Stay focused on deliverables: agent connects, UI shows status, reconnection works
- Don't build features for future milestones (e.g., server control, mod management)
- Test frequently after each phase
- Commit after each phase completion
