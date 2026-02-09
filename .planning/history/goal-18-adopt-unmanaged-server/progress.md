# Goal #18: Progress Log

## Session 1 — 2026-02-09

### Setup
- Created goal tracking files
- Registered Goal #18 in GOALS.md
- Read source files to understand existing patterns

### Implementation
- **Phase 1 (Agent inspect)**: Added `InspectContainer()` method + `ServerInspectResponse` type to `server.go`, wired `server.inspect` handler in `main.go`
- **Phase 2 (Agent adopt)**: Added `AdoptServer()` method (modeled on `rebuildWithNewConfig`) + `ServerAdoptRequest` type to `server.go`, wired `server.adopt` handler in `main.go`
- **Phase 3 (Manager DO)**: Added `handleServerInspectRequest()` and `handleServerAdoptRequest()` to `AgentConnection.ts`, with URL routing for `GET /servers/{containerId}/inspect` and `POST /servers/adopt`
- **Phase 4 (Manager API)**: Added `GET /:id/containers/:containerId/inspect` and `POST /:id/servers/adopt` routes to `agents.ts`. Added `server.adopted` to AuditAction type in `audit.ts`
- **Phase 5 (Frontend)**: Added `inspectContainer()` and `adoptServer()` to `api.ts`. Created `AdoptServerDialog.tsx` with inspect-on-open, pre-filled form, and adopt mutation. Integrated "Adopt" button into unmanaged container cards in `AgentServerList.tsx`

### Verification (compile)
- Agent compiles via Docker: `go build` succeeds
- Frontend TypeScript compiles: `tsc --noEmit` succeeds
- Frontend build: `vite build` succeeds

### Testing (Phase 6) — End-to-End on Test VM
- Pushed to dev, CI deployed successfully
- Built agent binary, copied to test VM (zedops-test-agent @ 10.0.13.208)
- Registered agent on dev environment with ephemeral token
- Created manual container: `docker run -d --name steam-zomboid-manual-test ...`
- Verified container shows as "Unmanaged" with "Adopt" button in UI
- Clicked Adopt → dialog opened, inspect extracted correct config:
  - Name: `manual-test` (stripped `steam-zomboid-` prefix)
  - Image: `registry.gitlab.nicomarois.com/nicolas/steam-zomboid:latest`
  - Ports: 16263/16264/27016 (all correct from port bindings + env vars)
- Clicked "Adopt Server" → container recreated with ZedOps labels
- Verified D1 record: status=running, correct ports, image_tag=latest
- Verified container labels: zedops.server.id, zedops.server.name=manual-test
- Audit log: `server.adopted` entry recorded
- Container survives VM reboot (restart policy: unless-stopped)
- Resized test VM: 4GB→8GB RAM, 2→4 vCPU (was OOM-killing due to 2 PZ servers)

### All phases complete — Goal #18 verified
