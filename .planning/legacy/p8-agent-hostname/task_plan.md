# Task: P8 - Agent Hostname Configuration

## Goal
Allow agents to have a configurable hostname for users who set up DNS (like DuckDNS) to point to their public IP. Connection Card should display hostname if set, otherwise fall back to public IP.

## Use Case
Users with dynamic IPs can set up DDNS (e.g., `myserver.duckdns.org`) and configure it in ZedOps, so players always have a stable address to connect to.

## Current State
- Connection Card shows agent's public IP (captured from CF-Connecting-IP header)
- IP is auto-detected on each connection
- No hostname configuration exists

## Phases

### Phase 1: Database Migration
**Status:** `complete`
- [x] Create migration `0013_add_agent_hostname.sql`
- [x] Add `hostname` column to agents table (nullable VARCHAR)
- [x] Deploy migration

### Phase 2: Backend API
**Status:** `complete`
- [x] Updated existing PUT config endpoint to handle hostname
- [x] Include hostname in agent list/detail responses
- [x] Pass hostname through to servers API for ConnectionCard

### Phase 3: Frontend - Agent Settings UI
**Status:** `complete`
- [x] Add hostname field to AgentConfigModal
- [x] Input with placeholder showing DuckDNS example
- [x] Save via existing config PUT endpoint

### Phase 4: Frontend - ConnectionCard Update
**Status:** `complete`
- [x] Update ConnectionCard to prefer hostname over publicIp
- [x] Display: hostname if set, else publicIp
- [x] Update ServerOverview to pass hostname prop
- [x] Update ServerDetail to pass agentHostname

### Phase 5: Build, Deploy, Test
**Status:** `complete`
- [x] Build frontend
- [x] Update asset hash in index.ts
- [x] Deploy to Cloudflare
- [ ] Test: Set hostname on agent, verify it shows in ConnectionCard

## Files Modified
- `manager/migrations/0013_add_agent_hostname.sql` - Created
- `manager/src/routes/agents.ts` - Config endpoints + list/detail include hostname
- `manager/src/routes/servers.ts` - Include agent_hostname in server responses
- `frontend/src/lib/api.ts` - Added hostname to AgentConfig and Server interfaces
- `frontend/src/components/AgentConfigModal.tsx` - Added hostname field
- `frontend/src/components/server-overview/ConnectionCard.tsx` - Use hostname if available
- `frontend/src/components/server-overview/ServerOverview.tsx` - Added agentHostname prop
- `frontend/src/pages/ServerDetail.tsx` - Pass agentHostname prop
- `manager/src/index.ts` - Updated asset hash

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none) | | |
