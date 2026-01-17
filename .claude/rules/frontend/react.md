---
paths:
  - "frontend/**"
---

# Frontend Development Rules (React + TypeScript)

## Tech Stack

- **UI**: Shadcn UI components (Radix primitives + Tailwind)
- **State**: TanStack Query (server), Zustand (client)
- **Terminal**: xterm.js for RCON
- **Build**: Vite

## Patterns

- Use Shadcn components from `frontend/src/components/ui/`
- Server state via TanStack Query hooks
- WebSocket for real-time agent updates
- Follow existing component patterns in `frontend/src/components/`

## Commands

```bash
npm run dev      # http://localhost:5173
npm run build    # Build to dist/
npm run lint     # ESLint check
```

## Build Output

Frontend builds to static assets served by the Cloudflare Worker.
After build, deploy via `cd ../manager && wrangler deploy`.
