# ZedOps - Claude Code Instructions

ZedOps is a Cloudflare-based distributed Project Zomboid server management platform.

## Project Structure

- **Manager** (`manager/`): Cloudflare Worker - API (Hono) + Durable Objects + D1
- **Frontend** (`frontend/`): React + Vite + Shadcn UI (builds to static assets)
- **Agent** (`agent/`): Go binary controlling Docker containers on remote hosts

## Key Documentation

| Document | Purpose |
|----------|---------|
| @.planning/GOALS.md | Current work tracking (READ FIRST) |
| @.planning/MILESTONES.md | Project roadmap and status |
| @.planning/ARCHITECTURE.md | System architecture, components, protocol |
| @.planning/SECURITY.md | Security guidelines and auth system |
| @.planning/TECH_DECISIONS.md | Technical decision log |

## Active Planning Files

When a goal is active, these files exist in project root:
- @task_plan.md - Current phases and tasks
- @progress.md - Session log
- @findings.md - Research discoveries

## Quick Commands

```bash
# Frontend
cd frontend && npm run dev

# Manager
cd manager && wrangler dev

# Agent (runs on host, not container)
cd agent && go run main.go --manager-url ws://localhost:8787/ws --name maestroserver

# Deploy
cd frontend && npm run build && cd ../manager && wrangler deploy
```

## Core Principles

- **Goal-based development**: Track work in GOALS.md, roadmap in MILESTONES.md
- **Agent-initiated connections**: Agents behind NAT initiate WebSocket to manager
- **Plan before implementing**: Use `/planning-with-files` for non-trivial work
