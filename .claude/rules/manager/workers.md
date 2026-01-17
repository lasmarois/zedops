---
paths:
  - "manager/**"
---

# Manager Development Rules (Cloudflare Workers)

## Tech Stack

- **Framework**: Hono for API routes
- **State**: Durable Objects for WebSocket hubs
- **Database**: D1 (SQLite)
- **Validation**: Zod for request schemas

## Architecture

- Workers are stateless - state lives in Durable Objects or D1
- One Durable Object per agent (WebSocket hub)
- Single deployment serves: static assets + API + Durable Objects

## Key Files

- `src/index.ts` - API route definitions
- `src/durable-objects/AgentConnection.ts` - WebSocket hub per agent
- `wrangler.toml` - Worker configuration
- `schema.sql` - D1 database schema

## Commands

```bash
wrangler dev                                    # Local dev server
wrangler d1 execute zedops-db --local --file=schema.sql  # Init local DB
wrangler deploy                                 # Deploy to production
```

## D1 Database

```bash
# Query remote database
npx wrangler d1 execute zedops-db --remote --command "SELECT * FROM agents"
```
