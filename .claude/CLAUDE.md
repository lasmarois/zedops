# ZedOps - Claude Code Instructions

ZedOps is a Cloudflare-based distributed Project Zomboid server management platform.

## Project Structure

- **Manager** (`manager/`): Cloudflare Worker — API (Hono) + Durable Objects + D1
- **Frontend** (`frontend/`): React + Vite + Shadcn UI (builds to static assets)
- **Agent** (`agent/`): Go binary controlling Docker containers on remote hosts

## Planning & Context

All planning, goals, milestones, and context documents live in the **zedops-planning** repo at `/Volumes/Data/git/zedops-planning`. This repo is code-only.

## Quick Commands

```bash
# Frontend
cd frontend && npm run dev -- --host 0.0.0.0

# Agent (runs on host, not container)
cd agent && go run main.go --manager-url ws://localhost:8787/ws --name maestroserver

# Deploy (CI preferred — just push to dev/main)
cd frontend && npm run build && cd ../manager && wrangler deploy
```

## Core Principles

- **Agent-initiated connections**: Agents behind NAT initiate WebSocket to manager
- **Dev-first workflow**: Work on `dev` branch, push to deploy to dev, merge to `main` for production
