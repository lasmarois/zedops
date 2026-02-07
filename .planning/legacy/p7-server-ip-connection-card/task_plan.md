# P7: Server IP in Connection Card

## Goal
Display actual server IP in the ConnectionCard component instead of "your-server-ip" placeholder.

## Approach
Capture agent's public IP from WebSocket connection headers (`CF-Connecting-IP`) and store it in the database. Pass it through the component chain to ConnectionCard.

## Phases

### Phase 1: Database Migration
- [ ] Create migration `0012_add_agent_public_ip.sql`
- [ ] Add `public_ip TEXT` column to agents table

### Phase 2: Backend - Capture IP on Connection
- [ ] In `AgentConnection.ts`, extract IP from `CF-Connecting-IP` header during registration
- [ ] Update agent record in D1 with public_ip
- [ ] Include public_ip in agent API responses

### Phase 3: Frontend - Pass IP to Components
- [ ] Update Agent interface in `api.ts` to include `public_ip`
- [ ] Update ServerDetail to pass agent's public_ip to ServerOverview
- [ ] Update ServerOverview props to accept agentPublicIp
- [ ] Pass serverIp to ConnectionCard

### Phase 4: Test & Deploy
- [ ] Build frontend
- [ ] Deploy to Cloudflare
- [ ] Rebuild agent to trigger reconnection (IP capture)
- [ ] Verify IP displays in Connection Card

## Files to Modify
- `manager/migrations/0012_add_agent_public_ip.sql` (new)
- `manager/src/durable-objects/AgentConnection.ts`
- `manager/src/routes/agents.ts` (API responses)
- `frontend/src/lib/api.ts` (types)
- `frontend/src/pages/ServerDetail.tsx`
- `frontend/src/components/server-overview/ServerOverview.tsx`

## Notes
- CF-Connecting-IP is automatically populated by Cloudflare for all requests
- IP will update each time agent reconnects
- Manual override could be added later if needed
