# ZedOps Manager

Cloudflare Worker that serves as the control plane for ZedOps.

## Components

- **API (Hono)**: REST endpoints for admin operations and agent management
- **Durable Objects**: WebSocket hubs for persistent agent connections
- **D1 Database**: SQLite database for agents, servers, users, audit logs
- **Static Assets**: Serves React frontend (built from ../frontend/dist)

## Tech Stack

- **Framework:** Hono (lightweight API framework for Workers)
- **Runtime:** Cloudflare Workers (V8 isolate)
- **Database:** Cloudflare D1 (SQLite)
- **Authentication:** Jose (JWT library for Workers)
- **WebSocket:** Cloudflare Durable Objects

## Development

```bash
# Install dependencies
npm install

# Run local dev server
npm run dev
# → http://localhost:8787

# Deploy to Cloudflare
npm run deploy
```

## Configuration

See `wrangler.toml` for:
- Durable Objects bindings
- D1 database bindings
- Static asset serving
- Environment variables

## Database Setup

```bash
# Create D1 database (first time only)
npx wrangler d1 create zedops-db

# Copy database_id from output to wrangler.toml

# Run migrations
npx wrangler d1 execute zedops-db --file=./schema.sql --local
npx wrangler d1 execute zedops-db --file=./schema.sql --remote
```

## Project Structure

```
src/
├── index.ts                    # Main Worker entrypoint
├── durable-objects/
│   └── AgentConnection.ts      # WebSocket hub for agents
├── middleware/
│   └── auth.ts                 # Admin authentication
├── routes/
│   ├── admin.ts                # Admin endpoints
│   └── agents.ts               # Agent management API
└── types/
    └── Message.ts              # NATS-inspired message protocol
```

## Environment Variables

Set in `wrangler.toml` (development) or via `wrangler secret put` (production):

- `TOKEN_SECRET` - Secret for signing JWTs
- `ADMIN_PASSWORD` - Hardcoded admin password (MVP only, replaced in M6)

## API Endpoints

**Admin:**
- `POST /api/admin/tokens` - Generate ephemeral agent token

**Agents:**
- `GET /api/agents` - List all agents with status
- `GET /ws` - WebSocket endpoint (upgraded to Durable Object)

## Testing

```bash
# Run tests
npm test
```
