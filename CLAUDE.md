# CLAUDE.md

**Purpose:** This file provides guidance for AI assistants (like Claude Code) working on ZedOps, a Cloudflare-based distributed Project Zomboid server management platform.

---

## Overview

ZedOps is a web platform for managing distributed Project Zomboid dedicated servers:
- **Manager**: Single Cloudflare Worker (full-stack deployment)
  - Frontend: React UI (static assets served by Worker)
  - Backend: API (Hono) + Durable Objects (WebSocket) + D1 (database)
- **Agent**: Go binary running on friends' computers, controlling local Docker containers
- **Communication**: NATS-inspired message protocol over WebSocket
- **Goal**: Centralized management UI for servers running across multiple machines

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | System architecture, components, communication protocol, tech stack |
| `MILESTONES.md` | Project roadmap with milestone status (⏳ → 🚧 → ✅) |
| `TECH_DECISIONS.md` | Log of major technical decisions with rationale |
| `planning-history/` | Archived planning sessions (one folder per milestone) |
| `frontend/` | React + Vite + Shadcn UI (builds to static assets) |
| `manager/` | Cloudflare Worker (full-stack: API + static assets + Durable Objects) |
| `agent/` | Go binary for controlling Docker containers |

### Where to Find Information

- **System Architecture** → [ARCHITECTURE.md](ARCHITECTURE.md)
- **Project Roadmap** → [MILESTONES.md](MILESTONES.md)
- **Technical Decisions** → [TECH_DECISIONS.md](TECH_DECISIONS.md)
- **Planning Sessions** → [planning-history/](planning-history/)
- **Original Proposal** → [ZOMBOID-MANAGER-PROPOSAL.md](ZOMBOID-MANAGER-PROPOSAL.md)

### Common Tasks Cheat Sheet

```bash
# Frontend development
cd frontend
npm run dev

# Manager development (Cloudflare Workers)
cd manager
wrangler dev

# Agent development
cd agent
go run main.go

# Deploy (full-stack: frontend + manager)
cd frontend && npm run build
cd ../manager && wrangler deploy
# Single deployment includes static assets + API + Durable Objects
```

---

## How to Work on This Project

### Understanding the Architecture

**Key Concepts:**

1. **Agent-Initiated Communication**: Agents behind NAT/firewalls initiate WebSocket connections to manager. No inbound ports needed on friends' computers.

2. **NATS-Inspired Messaging**: Subject-based routing (`server.start`, `logs.servertest`, `docker.list`) with request/reply and pub/sub patterns over WebSocket. See [ARCHITECTURE.md](ARCHITECTURE.md#communication-protocol) for details.

3. **Cloudflare Stack (Single Worker Deployment)**:
   - **Workers**: Full-stack deployment (static assets + API handlers via Hono)
   - **Durable Objects**: Stateful WebSocket hubs (one per agent)
   - **D1**: SQLite database (users, agents, servers, audit logs)
   - **Static Assets**: React build served directly from Worker (free)

4. **Milestone-Based Development**: Project is broken into independent milestones. Each milestone is a complete, testable deliverable. See [MILESTONES.md](MILESTONES.md).

5. **Monorepo Structure**: Frontend, manager, and agent in one repository for coordinated changes and shared documentation.

**Entry Points:**

- `manager/src/index.ts` - Workers API routes
- `manager/src/durable-objects/AgentConnection.ts` - WebSocket hub
- `agent/main.go` - Agent entrypoint
- `frontend/src/App.tsx` - React UI

---

## Development Workflow

### Milestone-Based Planning

This project uses **milestone-based planning** with the `planning-with-files` skill (plugin: `planning-with-files@planning-with-files`). See the plugin's README for full details on the Manus-style pattern.

**Milestones:**
- Each milestone is a complete, testable feature (e.g., "Agent Connection", "Container Control")
- Milestones are independent and build on each other
- Status tracked in [MILESTONES.md](MILESTONES.md): ⏳ Planned → 🚧 In Progress → ✅ Complete

**Workflow:**

1. **Start Milestone Planning**
   ```bash
   # Use planning-with-files skill for current milestone
   /planning-with-files
   # Creates: task_plan.md, findings.md, progress.md in root
   ```

2. **Plan & Implement**
   - Break milestone into phases (3-5 phases typically)
   - Research unknowns, document in findings.md
   - Implement phase by phase
   - Update progress.md as work progresses

3. **Complete & Archive**
   ```bash
   # When milestone complete:
   mkdir -p planning-history/milestone-N-name/
   mv task_plan.md findings.md progress.md planning-history/milestone-N-name/

   # Update MILESTONES.md status (🚧 → ✅)
   # Commit everything
   git add .
   git commit -m "Complete Milestone N: Name"
   ```

4. **Start Next Milestone**
   - Root directory is clean
   - Begin new planning-with-files session
   - Reference previous milestones in planning-history/ as needed

**Planning Structure:**
```
Root: (clean between milestones)
├── task_plan.md          # Current milestone only
├── findings.md           # Current milestone only
└── progress.md           # Current milestone only

planning-history/
├── milestone-1-agent-connection/
│   ├── task_plan.md
│   ├── findings.md
│   └── progress.md
├── milestone-2-container-control/
│   └── ...
└── ...
```

### Making Changes

**Coding Patterns to Follow:**

1. **TypeScript (Manager)**:
   - Use Hono framework for API routes
   - Durable Objects for WebSocket handling
   - D1 for database queries
   - Zod for request validation
   - Keep Workers stateless (state in Durable Objects or D1)

2. **Go (Agent)**:
   - Use `gorilla/websocket` for WebSocket client
   - Use `docker/docker` SDK for container control
   - Implement reconnection logic (agents may lose connection)
   - NATS-inspired message protocol (see [ARCHITECTURE.md](ARCHITECTURE.md#message-protocol))
   - Graceful shutdown on SIGTERM/SIGINT

3. **React (Frontend)**:
   - Shadcn UI components
   - TanStack Query for server state
   - Zustand for client state
   - xterm.js for RCON terminal
   - WebSocket for real-time updates

**When to Update Which Files:**

| Change Type | Files to Update |
|-------------|-----------------|
| New architecture decision | `TECH_DECISIONS.md`, `ARCHITECTURE.md` (if needed) |
| New milestone started | `MILESTONES.md` (update status) |
| Milestone completed | Move planning files to `planning-history/`, update `MILESTONES.md` |
| Add API endpoint | `manager/src/index.ts`, update API docs |
| Change message protocol | `ARCHITECTURE.md`, agent + manager code |
| Add database table | D1 migration file, `ARCHITECTURE.md` schema section |

### Local Development Setup

**Prerequisites:**
- Node.js 18+ (for Wrangler and React)
- Go 1.21+ (for agent)
- Docker (for testing agent functionality)
- Cloudflare account (free tier)

**Initial Setup:**
```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173

# Manager
cd manager
npm install
wrangler dev         # http://localhost:8787

# D1 Database (local)
cd manager
wrangler d1 execute zedops-db --local --file=schema.sql

# Agent
cd agent
go mod download
go run main.go
```

**Testing Changes:**

| Component | Test Method |
|-----------|-------------|
| Manager API | `wrangler dev` + curl/Postman |
| Durable Object | `wrangler dev` + WebSocket client |
| Frontend | `npm run dev` (Vite hot reload) |
| Agent | `go run main.go` (connect to local manager) |
| End-to-end | All running, test full flow |

---

## Documentation Structure

This project uses layered documentation:

- **[CLAUDE.md](CLAUDE.md)** - This file (AI assistant guide)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design
- **[MILESTONES.md](MILESTONES.md)** - Project roadmap
- **[TECH_DECISIONS.md](TECH_DECISIONS.md)** - Technical decision log
- **[ZOMBOID-MANAGER-PROPOSAL.md](ZOMBOID-MANAGER-PROPOSAL.md)** - Original proposal (reference only)
- **[planning-history/](planning-history/)** - Archived planning sessions
  - One folder per completed milestone
  - Contains task_plan.md, findings.md, progress.md
  - Indexed in planning-history/README.md

**Root directory documents:**
- `CLAUDE.md` - Development guide for AI assistants
- `ARCHITECTURE.md` - Technical architecture (stable reference)
- `MILESTONES.md` - Roadmap and progress tracking
- `TECH_DECISIONS.md` - Decision log
- `README.md` - User-facing project introduction

**planning-history/ directory:**
- Archived planning sessions (one folder per milestone)
- Historical context and design decisions
- Reference for understanding past work

---

## Key Technical Decisions

### TD-001: NATS-Inspired WebSocket Protocol

**Why:** Cloudflare Workers can't run NATS server, but we want clean message routing. WebSocket with subject-based routing (`server.start`, `logs.servertest`) provides:
- Request/reply pattern (agent asks, manager responds)
- Pub/sub for logs (agent publishes, UI subscribes)
- No external infrastructure (free to host)

See [TECH_DECISIONS.md](TECH_DECISIONS.md) for full rationale.

### TD-002: Agent-Initiated Connections

**Why:** Friends' computers are behind NAT/firewalls. Agent initiates outbound WebSocket connection to manager (Cloudflare Durable Object). No inbound ports needed.

### TD-003: Milestone-Based Development

**Why:** Clear deliverables, easier to track progress, prevents scope creep. Each milestone is independently testable.

**For all decisions:** See [TECH_DECISIONS.md](TECH_DECISIONS.md)

---

## Project Principles

### 1. Milestone Deliverables Must Be Complete

Each milestone should produce a working, demonstrable feature:
- ✅ Milestone 1: Agent connects → See "Agent online ✓" in UI
- ✅ Milestone 2: Container control → Click "Start" in UI, server starts
- ❌ Bad: "Add database schema" (not user-visible)

### 2. Reference Over Duplication

If detailed information exists in another doc, reference it:
- ✅ "See [ARCHITECTURE.md](ARCHITECTURE.md#message-protocol) for protocol details"
- ❌ Copying entire protocol spec into multiple files

### 3. Plan Before Implementing

Use planning-with-files for any non-trivial milestone:
- Break into phases
- Document unknowns
- Track progress
- Archive when complete

### 4. Keep Root Clean

Between milestones:
- Move planning files to planning-history/
- Only foundation docs (ARCHITECTURE.md, MILESTONES.md, etc.) in root
- Makes it easy to start next milestone

---

## Extensibility

### How to Add New Milestones

1. **Add to MILESTONES.md** with brief description and status (⏳ Planned)

2. **When ready to start:**
   - Use planning-with-files skill
   - Creates task_plan.md, findings.md, progress.md in root

3. **When complete:**
   - Move planning files to planning-history/milestone-N-name/
   - Update MILESTONES.md (⏳ → ✅)
   - Commit

4. **Clean slate for next milestone**

### How to Add New Components

If adding a major component (e.g., CLI tool, mobile app):

1. **Update ARCHITECTURE.md** - Add component diagram and responsibilities
2. **Create directory** - `cli/` or `mobile/` in monorepo
3. **Log decision** - Add to TECH_DECISIONS.md
4. **Update this file** - Add to Quick Reference and Common Tasks

### Future Milestones (Ideas)

- Milestone 7: Multi-tenancy (multiple admin users, teams)
- Milestone 8: Server metrics and monitoring
- Milestone 9: Automated backups
- Milestone 10: Agent auto-update mechanism

When adding, follow the principles above and update relevant docs.

---

## Getting Help

**For AI assistants working on this project:**

1. **Architecture questions** → Read [ARCHITECTURE.md](ARCHITECTURE.md)
2. **What to work on next** → Check [MILESTONES.md](MILESTONES.md)
3. **Why was X chosen** → Check [TECH_DECISIONS.md](TECH_DECISIONS.md)
4. **How was Y implemented** → Check [planning-history/milestone-N/](planning-history/)
5. **Complex milestone** → Use planning-with-files skill

**Always:**
- Read existing docs before asking questions
- Update docs when making significant changes
- Follow the milestone-based workflow
- Keep planning artifacts organized

---

## Project Status

**Current Phase:** Initial setup and planning
**Active Milestone:** Not started (see [MILESTONES.md](MILESTONES.md))
**Next Milestone:** Milestone 1 - Agent Connection

**To begin work:**
1. Read [ARCHITECTURE.md](ARCHITECTURE.md)
2. Review [MILESTONES.md](MILESTONES.md)
3. Start Milestone 1 with planning-with-files skill
