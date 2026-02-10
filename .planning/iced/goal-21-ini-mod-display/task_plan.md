# Goal #21: Display Server Mods from INI File in Config Tab

## Context

The config tab shows mods from ENV vars (`SERVER_MODS`, `SERVER_WORKSHOP_ITEMS`) stored in D1. But Project Zomboid servers configure mods in their `.ini` file on disk (`Mods=` and `WorkshopItems=`). When mods are set directly in the INI (not via ENV), the config tab shows "No mods installed" even though mods are active.

## Approach

Add a `server.readini` message handler on the agent that reads the server's `.ini` file and extracts `Mods` and `WorkshopItems`. Surface this to the frontend via a new DO route and API endpoint. The config tab fetches INI mods alongside the existing config and displays them.

## Phase 1: Agent — `ReadServerINI()` + handler
- [ ] Add `ReadServerINI(ctx, containerID, serverName)` to `agent/server.go` (~after line 893)
  - Inspect container to find data mount (`/home/steam/Zomboid` target → host source path)
  - Read `{dataSource}/Server/{serverName}.ini`
  - Parse lines for `Mods=` and `WorkshopItems=`
  - Return `ServerINIResponse { Mods string, WorkshopItems string }`
- [ ] Add `case "server.readini":` to `receiveMessages` switch in `agent/main.go` (~line 417)
- [ ] Add `handleServerReadINI(msg)` handler in `agent/main.go`

## Phase 2: Manager DO — New route
- [ ] Add `GET /servers/{containerId}/ini?serverName={name}` DO route in `AgentConnection.ts` (~line 327)
- [ ] Use `sendMessageWithReply` to send `server.readini` to agent
- [ ] Return `{ mods, workshopItems }`

## Phase 3: Manager API — Extend server detail
- [ ] In `GET /api/servers/:id` (`servers.ts` line 172), add INI fetch to `Promise.all`
- [ ] Call DO route: `stub.fetch('http://do/servers/{containerId}/ini?serverName={name}')`
- [ ] Add `ini_mods` and `ini_workshop_items` to response object

## Phase 4: Frontend — Display INI mods
- [ ] Add `ini_mods?: string` and `ini_workshop_items?: string` to `Server` type in `frontend/src/lib/api.ts`
- [ ] Update Mods card in `ConfigurationDisplay.tsx` (lines 120-147):
  - Use `server.ini_mods` (from INI) as primary source, fall back to `config.SERVER_MODS` (from ENV)
  - Same for workshop items

## Phase 5: Verification
- [ ] Build agent, deploy with `--no-update` to maestroserver
- [ ] Deploy manager to dev
- [ ] Open server config tab — mods should appear from INI file
- [ ] Test with server that has mods and without mods

## Files to Modify

| File | Change |
|------|--------|
| `agent/server.go` | New `ReadServerINI()` function |
| `agent/main.go` | New `server.readini` handler + case in switch |
| `manager/src/durable-objects/AgentConnection.ts` | New `GET /servers/{containerId}/ini` DO route |
| `manager/src/routes/servers.ts` | Fetch INI mods in server detail endpoint |
| `frontend/src/lib/api.ts` | Add fields to `Server` type |
| `frontend/src/components/ConfigurationDisplay.tsx` | Display INI mods |
