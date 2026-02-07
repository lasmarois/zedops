# Project Architecture Overview

## Component Responsibilities

### Manager (Cloudflare Worker)
- Single deployment: static assets + API + Durable Objects
- Hono framework for API routes
- Durable Objects for WebSocket hubs (one per agent)
- D1 SQLite for persistence

### Frontend (React)
- Shadcn UI component library
- TanStack Query for server state
- WebSocket for real-time updates

### Agent (Go)
- Runs directly on host (not containerized)
- Controls local Docker containers
- Initiates WebSocket connection to manager
- NATS-inspired message protocol

## Entry Points

- `manager/src/index.ts` - API routes
- `manager/src/durable-objects/AgentConnection.ts` - WebSocket hub
- `agent/main.go` - Agent entrypoint
- `frontend/src/App.tsx` - React UI

## Communication Protocol

NATS-inspired subject-based routing over WebSocket:
- Request/reply pattern: `server.start`, `docker.list`
- Pub/sub for logs: `logs.{serverName}`
- See @.planning/ARCHITECTURE.md#communication-protocol for full spec
