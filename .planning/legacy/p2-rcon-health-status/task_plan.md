# P2: RCON Health Status

## Goal
Display RCON connection health in the Health Indicators card (green=connected, red=error, gray=unknown).

## Approach
The PlayerStatsCollector already maintains persistent RCON connections. Add `rconConnected` boolean to track connection status and propagate through the stack.

## Phases

### Phase 1: Agent - Track RCON status
- [ ] Add `RCONConnected bool` to `PlayerStats` struct
- [ ] Set `RCONConnected = true` when stats collected successfully
- [ ] Set `RCONConnected = false` when RCON connection fails
- [ ] Include in `players.update` message

### Phase 2: Manager - Store and expose RCON status
- [ ] Update player stats storage in AgentConnection.ts to include `rconConnected`
- [ ] Return `rconConnected` in `/players/:serverId` endpoint response
- [ ] Include in server API response (already merges player stats)

### Phase 3: Frontend - Display RCON status
- [ ] Update Server interface to include `rcon_connected`
- [ ] Pass to ServerOverview → HealthIndicators
- [ ] HealthIndicators already handles the display logic

### Phase 4: Test & Deploy
- [ ] Build agent and deploy
- [ ] Build frontend and deploy
- [ ] Verify health indicator shows correct status

## Files to Modify
- `agent/playerstats.go` - Add RCONConnected field
- `manager/src/durable-objects/AgentConnection.ts` - Store rconConnected
- `manager/src/routes/servers.ts` - Include in response
- `frontend/src/lib/api.ts` - Update Server interface
- `frontend/src/pages/ServerDetail.tsx` - Pass rconConnected
- `frontend/src/components/server-overview/ServerOverview.tsx` - Pass to HealthIndicators
