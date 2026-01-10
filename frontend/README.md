# ZedOps Frontend

React + TypeScript frontend for ZedOps manager UI.

## Tech Stack

- **Framework:** React 19 + Vite
- **Language:** TypeScript
- **State Management:**
  - TanStack Query (server state)
  - Zustand (client state)
- **UI:** Shadcn UI (to be added)
- **Deployment:** Served as static assets from Cloudflare Worker

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:5173

# Build for production
npm run build
# → Output: dist/
```

## Project Structure

```
src/
├── components/       # React components
├── lib/              # Utils, API client
├── hooks/            # Custom hooks
├── stores/           # Zustand stores
└── App.tsx           # Main app component
```

## Building

Frontend is built and deployed with the manager Worker:

```bash
# From frontend/
npm run build

# From manager/
wrangler deploy  # Includes frontend/dist/ as static assets
```

## Environment

Frontend communicates with manager API at the same origin (Worker serves both).

No environment variables needed (API is same-origin).
