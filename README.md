# ZedOps

**Cloudflare-powered web platform for managing distributed Project Zomboid dedicated servers with agent-based orchestration, real-time monitoring, and RBAC.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is ZedOps?

ZedOps lets you and your friends manage Project Zomboid servers running on different computers from a single web interface. No port forwarding, no VPS costs, just a lightweight agent on each machine and a globally-deployed manager hosted on Cloudflare (for free).

**Key Features:**
- 🌐 **Centralized Web UI** - Manage all servers from one place
- 🔌 **NAT-Friendly** - Works through firewalls (agents connect outbound)
- 💰 **Free Hosting** - Runs on Cloudflare free tier ($0/month)
- 📊 **Real-Time Monitoring** - Live logs, server status, player counts
- 🎮 **RCON Console** - Built-in terminal for server administration
- 👥 **Multi-User RBAC** - Role-based access (admin, operator, reader)
- 📝 **Audit Logs** - Track who did what, when

---

## Architecture

```
┌──────────────────────────────┐
│  Cloudflare (Manager)        │
│  - React UI (Pages)          │
│  - API (Workers)             │
│  - WebSocket Hub (Durable)   │
│  - Database (D1)             │
└──────────────┬───────────────┘
               │ WebSocket
         ──────┼─────────────
         │     │            │
    ┌────▼──┐ ┌▼─────┐ ┌───▼───┐
    │Agent 1│ │Agent 2│ │Agent N│
    │(Go)   │ │(Go)   │ │(Go)   │
    └───┬───┘ └───┬──┘ └───┬───┘
        │         │         │
    ┌───▼───┐ ┌───▼──┐ ┌───▼───┐
    │Docker │ │Docker│ │Docker │
    │Server │ │Server│ │Server │
    └───────┘ └──────┘ └───────┘
```

- **Manager**: TypeScript (Cloudflare Workers + Durable Objects + D1 + Pages)
- **Agent**: Go binary (controls local Docker containers)
- **Communication**: NATS-inspired message protocol over WebSocket

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design.

---

## Quick Start

> **Note:** Project is currently in development. These instructions will work once Milestone 1 is complete.

### 1. Deploy Manager (Cloudflare)

```bash
# Clone repository
git clone https://github.com/yourusername/zedops.git
cd zedops

# Deploy manager
cd manager
npm install
wrangler deploy

# Deploy frontend
cd ../frontend
npm install
npm run build
wrangler pages deploy dist
```

### 2. Install Agent (On Each Friend's Computer)

```bash
# Get installation token from manager UI
curl -sSL https://your-manager.pages.dev/install.sh | \
  TOKEN=your-token-here bash
```

### 3. Manage Servers

1. Visit manager UI: `https://your-manager.pages.dev`
2. See connected agents
3. Add servers, configure settings, view logs
4. Use RCON console for administration

---

## Development

### Prerequisites

- Node.js 18+
- Go 1.21+
- Docker
- Cloudflare account (free tier)

### Local Setup

```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173

# Manager
cd manager
npm install
wrangler dev         # http://localhost:8787

# Agent
cd agent
go mod download
go run main.go
```

See [CLAUDE.md](CLAUDE.md) for development guide.

---

## Project Status

**Current Phase:** Initial planning and setup

**Completed Milestones:** None yet

**Next Milestone:** M1 - Agent Connection (⏳ Planned)

See [MILESTONES.md](MILESTONES.md) for roadmap.

---

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design
- **[MILESTONES.md](MILESTONES.md)** - Project roadmap
- **[TECH_DECISIONS.md](TECH_DECISIONS.md)** - Technical decision log
- **[CLAUDE.md](CLAUDE.md)** - AI assistant development guide
- **[planning-history/](planning-history/)** - Archived planning sessions

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React, TypeScript, Vite, Shadcn UI, TanStack Query |
| **Manager API** | Cloudflare Workers, Hono, TypeScript |
| **WebSocket Hub** | Cloudflare Durable Objects |
| **Database** | Cloudflare D1 (SQLite) |
| **Agent** | Go, gorilla/websocket, Docker SDK |
| **Deployment** | Cloudflare Pages (frontend), Workers (API) |

See [TECH_DECISIONS.md](TECH_DECISIONS.md) for rationale.

---

## Why ZedOps?

**Problem:** You and your friends run Project Zomboid servers on different computers. Managing them separately is tedious (SSH to each machine, edit configs manually, restart containers).

**Solution:** ZedOps provides a centralized web UI. Agents on each computer connect to the manager (hosted on Cloudflare). You control everything from one place.

**Benefits:**
- ✅ No port forwarding needed (agents connect outbound)
- ✅ Free to host (Cloudflare free tier)
- ✅ Real-time logs and monitoring
- ✅ RCON console built-in
- ✅ Role-based access for friends
- ✅ Audit logs (accountability)

---

## Contributing

This project is currently in early development. Contributions welcome once Milestone 1 is complete!

**Development Workflow:**
1. Read [CLAUDE.md](CLAUDE.md) for development guide
2. Check [MILESTONES.md](MILESTONES.md) for current work
3. Each milestone uses planning-with-files pattern (see [planning-history/](planning-history/))

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built for the Project Zomboid community
- Inspired by Pterodactyl Panel and Portainer
- Uses [steam-zomboid](https://github.com/yourusername/steam-zomboid) Docker image for servers

---

## Project Name

**Zed** = British slang for zombies
**Ops** = Operations/DevOps

**ZedOps** = Zombie server operations made easy 🧟‍♂️
