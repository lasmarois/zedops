# M9.8.1 Implementation Plan - Fix Server Status When Agent Offline

**Milestone:** M9.8.1 - Server Status Should Reflect Agent Connectivity
**Parent:** M9.8 - Polish & Production Readiness
**Priority:** CRITICAL
**Status:** 📋 Planning

---

## Problem Statement

**Current Behavior:**
- Servers show status as "running" even when the agent is offline
- Misleading: Cannot know actual container state without agent connectivity
- Confusing for users: They see "running" servers but agent is offline

**Expected Behavior:**
- Agent offline → Server status should show "Agent Offline" or "Unknown"
- Agent online + container running → Show "Running"
- Agent online + container stopped → Show "Stopped"
- Visual indication that agent connectivity affects server status accuracy

---

## Investigation Needed

### 1. Data Flow Analysis
- [ ] How is server status stored in database? (D1 servers table)
- [ ] How is agent connectivity tracked? (agents table, last_seen timestamp)
- [ ] How is status retrieved by frontend? (API endpoints)
- [ ] When/how is server status updated?

### 2. Current Implementation Review
- [ ] Backend: Where is server status returned? (agents.ts, servers.ts)
- [ ] Frontend: Where is status displayed? (ServerList, AgentServerList, ServerDetail)
- [ ] Status Badge: How does StatusBadge component work?
- [ ] Agent status logic: How do we determine if agent is online?

### 3. Sync Mechanism
- [ ] Is there a status sync endpoint?
- [ ] How often is status refreshed?
- [ ] What happens when agent reconnects?

---

## Implementation Phases

### Phase 1: Backend - Add Agent Status to Server Queries ✅ Ready to Implement

**Goal:** Include `agent.status` in all server API responses

**Tasks:**

1.1. Update `GET /api/servers` query (servers.ts line 37-43)
```sql
SELECT
  s.*,
  a.name as agent_name,
  a.status as agent_status  -- ADD THIS LINE
FROM servers s
LEFT JOIN agents a ON s.agent_id = a.id
ORDER BY s.created_at DESC
```

1.2. Add agent_status to response mapping (servers.ts line 55-71)
```typescript
const servers = serverRows.map((row: any) => ({
  // ... existing fields
  agent_status: row.agent_status, // ADD THIS LINE
}));
```

1.3. Update `GET /api/servers/:id` query (servers.ts line ~99)
- Same SQL change: add `a.status as agent_status`
- Same response mapping change

1.4. Update `GET /api/agents/:id/servers` query (agents.ts line 974-978)
```sql
SELECT
  s.*,
  a.status as agent_status
FROM servers s
JOIN agents a ON s.agent_id = a.id
WHERE s.agent_id = ?
ORDER BY s.created_at DESC
```

1.5. Add agent_status to response mapping in agents.ts

**Files to Modify:**
- `manager/src/routes/servers.ts` - 2 endpoints
- `manager/src/routes/agents.ts` - 1 endpoint

**Testing:**
- [ ] `GET /api/servers` returns agent_status field
- [ ] `GET /api/servers/:id` returns agent_status field
- [ ] `GET /api/agents/:id/servers` returns agent_status field
- [ ] agent_status is 'online' or 'offline'
- [ ] Deploy backend changes

---

### Phase 2: Frontend - Update Server Interface & Add Status Helper ✅ Ready to Implement

**Goal:** Prepare frontend to consume agent_status

**Tasks:**

2.1. Update Server interface in api.ts (line ~50)
```typescript
export interface Server {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_status: 'online' | 'offline';  // ADD THIS LINE
  name: string;
  container_id: string | null;
  // ... rest of fields
}
```

2.2. Create status utility file: `frontend/src/lib/server-status.ts`
```typescript
import type { Server } from './api';

export type DisplayStatus = {
  status: 'running' | 'stopped' | 'failed' | 'agent_offline' | 'unknown';
  label: string;
  variant: 'success' | 'muted' | 'error' | 'warning';
};

export function getDisplayStatus(server: Server): DisplayStatus {
  // Agent offline takes precedence
  if (server.agent_status === 'offline') {
    return {
      status: 'agent_offline',
      label: 'Agent Offline',
      variant: 'warning',
    };
  }

  // Agent online - show actual server status
  switch (server.status) {
    case 'running':
      return { status: 'running', label: 'Running', variant: 'success' };
    case 'stopped':
      return { status: 'stopped', label: 'Stopped', variant: 'muted' };
    case 'failed':
      return { status: 'failed', label: 'Failed', variant: 'error' };
    default:
      return { status: 'unknown', label: server.status, variant: 'muted' };
  }
}
```

**Files to Create:**
- `frontend/src/lib/server-status.ts` - New utility file

**Files to Modify:**
- `frontend/src/lib/api.ts` - Update Server interface

**Testing:**
- [ ] TypeScript compiles without errors
- [ ] getDisplayStatus returns correct values for all combinations

---

### Phase 3: Frontend - Update Status Display Components ✅ Ready to Implement

**Goal:** Use computed status in all UI components

**Tasks:**

3.1. Update ServerList.tsx (line ~120-140)
```typescript
import { getDisplayStatus } from '@/lib/server-status';

// In render:
const displayStatus = getDisplayStatus(server);

<StatusBadge variant={displayStatus.variant}>
  {displayStatus.label}
</StatusBadge>
```

3.2. Update AgentServerList.tsx (line ~750-850)
- Same pattern: import getDisplayStatus
- Use computed status for badge display
- Update action button logic if needed (disable actions when agent offline?)

3.3. Update ServerDetail.tsx (line ~80-90)
- Import getDisplayStatus
- Use computed status in header display
- Show warning message if agent offline

3.4. Update StatusBadge component if needed
- May need to add 'warning' variant styling
- Verify existing variants cover all cases

**Files to Modify:**
- `frontend/src/pages/ServerList.tsx`
- `frontend/src/components/AgentServerList.tsx`
- `frontend/src/pages/ServerDetail.tsx`
- `frontend/src/components/ui/status-badge.tsx` (if needed)

**Testing:**
- [ ] Server status shows "Agent Offline" when agent is offline
- [ ] Server status shows actual status when agent is online
- [ ] StatusBadge colors correct for all statuses
- [ ] No TypeScript errors

---

### Phase 4: Build, Test, Deploy ✅ Ready to Execute

**Goal:** Validate and deploy changes

**Tasks:**

4.1. Build frontend
```bash
cd frontend && npm run build
```

4.2. Deploy backend and frontend
```bash
cd manager && npx wrangler deploy
```

4.3. Test with real agent
- [ ] Agent online → servers show correct status
- [ ] Stop agent → servers show "Agent Offline"
- [ ] Start agent → servers return to correct status
- [ ] All views (ServerList, AgentServerList, ServerDetail) work correctly

4.4. Update documentation if needed

**Files to Modify:**
- None (deployment only)

**Testing:**
- [ ] Build succeeds
- [ ] Deploy succeeds
- [ ] Production validation complete

---

## Open Questions

1. **Data Model:**
   - Do we need a new field in servers table? (e.g., `computed_status`)
   - Or compute status on-the-fly based on agent.status + server.status?

2. **Status Values:**
   - What should the status be when agent is offline?
   - "agent_offline", "unknown", or keep server status but add flag?

3. **UI Design:**
   - How should we visually indicate agent is offline?
   - Gray out the entire server row?
   - Show warning icon next to status?
   - Change badge color?

4. **Sync Strategy:**
   - Should we update all server statuses when agent goes offline?
   - Or compute status dynamically on read?
   - What about performance?

---

## Success Criteria

M9.8.1 complete when:
- [ ] Server status never shows "running" when agent is offline
- [ ] Users can clearly see which servers are affected by agent downtime
- [ ] Status updates correctly when agent reconnects
- [ ] No performance degradation
- [ ] All views (ServerList, AgentServerList, ServerDetail) show correct status
- [ ] Status Badge component handles agent offline state
- [ ] Deployed to production
- [ ] User validates fix ✓

---

## Files to Investigate

**Backend:**
- `manager/src/routes/agents.ts` - Agent status, server listing
- `manager/src/routes/servers.ts` - Global server endpoints
- `manager/src/durable-objects/AgentConnection.ts` - Agent connectivity

**Frontend:**
- `frontend/src/components/AgentServerList.tsx` - Agent-scoped server list
- `frontend/src/pages/ServerList.tsx` - Global server list
- `frontend/src/pages/ServerDetail.tsx` - Single server view
- `frontend/src/components/ui/status-badge.tsx` - Status display component
- `frontend/src/hooks/useServers.ts` - Server data fetching
- `frontend/src/hooks/useAgents.ts` - Agent data fetching

**Database:**
- `manager/migrations/*.sql` - Schema definition (agents, servers tables)

---

## Next Step

Start investigation phase - read code to understand current implementation before planning solution.
