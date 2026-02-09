# Goal #18: Adopt Unmanaged Server as Managed

## Phase 1: Agent — `server.inspect` message handler
- [x] Add `InspectContainer()` method to DockerClient in `server.go`
- [x] Add `ServerInspectResponse` type
- [x] Wire `server.inspect` handler in `main.go`

## Phase 2: Agent — `server.adopt` message handler
- [x] Add `AdoptServer()` method modeled on `rebuildWithNewConfig`
- [x] Wire `server.adopt` handler in `main.go`

## Phase 3: Manager DO — Internal endpoints
- [x] Add `GET /servers/{containerId}/inspect` DO route
- [x] Add `POST /servers/adopt` DO route

## Phase 4: Manager API — Routes
- [x] Add `GET /:id/containers/:containerId/inspect` API route
- [x] Add `POST /:id/servers/adopt` API route
- [x] Add `server.adopted` audit action type

## Phase 5: Frontend — API + Adopt Dialog + Integration
- [x] Add `inspectContainer()` and `adoptServer()` API functions
- [x] Create `AdoptServerDialog.tsx` component
- [x] Integrate Adopt button into `AgentServerList.tsx`

## Phase 6: Testing & Verification
- [x] Build agent, deploy to test VM with --no-update
- [x] Create manual container (docker run) on test VM
- [x] Verify shows as "Unmanaged" with "Adopt" button
- [x] Click Adopt → inspect extracts correct config (name, image, ports, env)
- [x] Confirm → container recreated with ZedOps labels
- [x] Server appears as "Managed" with full controls (version, storage, players)
- [x] D1 record created with correct ports and status=running
- [x] Audit log records `server.adopted` event
- [x] Container survives VM reboot (restart policy preserved)
