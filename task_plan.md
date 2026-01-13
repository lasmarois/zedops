# M9.5 Implementation Plan - Bridge Design to Functionality

**Milestone:** M9.5 - Connect New UI to Real Data
**Duration:** 1-2 days estimated
**Started:** 2026-01-13
**Status:** 🚧 Planning

---

## Overview

M9 created beautiful new pages (Dashboard, ServerList, AgentDetail, ServerDetail), but they're not fully integrated with real data and the old navigation patterns are still active. This milestone bridges that gap.

---

## Problem Analysis

### What's Working ✅
1. **Routes exist** - All routes defined in App.tsx
2. **AgentDetail navigation** - AgentsPage.tsx line 20 navigates to `/agents/:id` correctly
3. **Dashboard** - Partially working (agent stats + activity timeline work, server/player stats are placeholders)
4. **Design components** - All new components (StatusBadge, ActivityTimeline, tabs, etc.) work beautifully

### What's Broken ❌
1. **AgentsPage still uses old state-based navigation** (lines 56-65):
   - Has `selectedAgent` state and shows `ContainerList` in same view
   - This bypasses the new AgentDetail page entirely
   - Old pattern from M1-M7 still active

2. **ServerList page is empty placeholder** (line 32-36):
   - Hardcoded `allServers = []`
   - No API integration
   - Can't see any servers in global view

3. **ServerDetail page uses placeholder data**:
   - Hardcoded server ID, name, agent, ports
   - No real metrics
   - Action buttons don't work

4. **No server API endpoints**:
   - No global "list all servers" endpoint
   - No "get server by ID" endpoint
   - Frontend can't fetch server data

5. **Dashboard server/player stats are placeholders**:
   - Server count shows "0"
   - Player count shows "0 / 0"

### User Impact 🎯
**Current behavior:** Click Agents → Click an agent → See old ContainerList (not new AgentDetail)
**Expected behavior:** Click Agents → Click an agent → See new AgentDetail with tabs, metrics, etc.

---

## Implementation Phases

### Phase 1: Backend - Server API Endpoints

**Goal:** Create API endpoints to fetch server data

**Tasks:**

#### 1.1 Global Server List Endpoint
- [ ] Create `GET /api/servers` endpoint in `manager/src/routes/agents.ts`
- [ ] Query all servers across all agents from D1
- [ ] Join with agents table to get agent names
- [ ] Return array of servers with agent info
- [ ] Add pagination support (optional)
- [ ] Test with existing servers

**API Response Format:**
```typescript
{
  servers: [
    {
      id: string
      name: string
      agent_id: string
      agent_name: string
      container_id: string | null
      status: string
      game_port: number
      udp_port: number
      rcon_port: number
      image_tag: string
      created_at: number
      updated_at: number
    }
  ]
}
```

#### 1.2 Single Server Endpoint
- [ ] Create `GET /api/servers/:id` endpoint
- [ ] Fetch server by ID from D1
- [ ] Join with agent to get agent info
- [ ] Return server details
- [ ] Handle 404 if server not found
- [ ] Test with existing server

**API Response Format:**
```typescript
{
  server: {
    id: string
    name: string
    agent_id: string
    agent_name: string
    container_id: string | null
    config: Record<string, string>  // ENV vars
    status: string
    game_port: number
    udp_port: number
    rcon_port: number
    image_tag: string
    created_at: number
    updated_at: number
  }
}
```

---

### Phase 2: Frontend - Server API Hooks

**Goal:** Create React hooks to fetch server data

**Tasks:**

#### 2.1 Create `useServers` Hook
- [ ] Create `frontend/src/hooks/useServers.ts`
- [ ] Use TanStack Query to fetch from `/api/servers`
- [ ] 5 second refetch interval (like useAgents)
- [ ] Handle loading/error states
- [ ] Export typed hook

**Hook Interface:**
```typescript
export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await fetch('/api/servers', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.json()
    },
    refetchInterval: 5000
  })
}
```

#### 2.2 Create `useServer` Hook
- [ ] Create single server hook in `useServers.ts`
- [ ] Fetch from `/api/servers/:id`
- [ ] Pass server ID as parameter
- [ ] Handle 404 errors gracefully

**Hook Interface:**
```typescript
export function useServer(serverId: string) {
  return useQuery({
    queryKey: ['server', serverId],
    queryFn: async () => {
      const res = await fetch(`/api/servers/${serverId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Server not found')
      return res.json()
    },
    refetchInterval: 5000
  })
}
```

---

### Phase 3: Frontend - Wire Up ServerList Page

**Goal:** Replace placeholder with real data

**Tasks:**

#### 3.1 Integrate `useServers` Hook
- [ ] Import `useServers` in `ServerList.tsx`
- [ ] Replace `allServers = []` with hook data
- [ ] Map server data to `ServerWithAgent[]` format
- [ ] Keep search/filter logic working
- [ ] Test with multiple servers

#### 3.2 Add Server Count to Dashboard
- [ ] Import `useServers` in `Dashboard.tsx`
- [ ] Replace placeholder "0" with `serversData.servers.length`
- [ ] Count running servers: `servers.filter(s => s.status === 'running').length`
- [ ] Update card to show "X running / Y total"

---

### Phase 4: Frontend - Wire Up ServerDetail Page

**Goal:** Replace placeholder data with real server data

**Tasks:**

#### 4.1 Integrate `useServer` Hook
- [ ] Import `useServer` in `ServerDetail.tsx`
- [ ] Get server ID from URL params: `const { id } = useParams()`
- [ ] Fetch server data: `const { data, isLoading } = useServer(id)`
- [ ] Replace all placeholder variables with real data
- [ ] Handle loading state (skeleton)
- [ ] Handle 404 state (server not found page)

#### 4.2 Fix ContainerList Integration
- [ ] Pass real `agentId` and `containerId` to ContainerList
- [ ] ContainerList already filters by these IDs
- [ ] Ensure server actions (start/stop/restart) work
- [ ] Test navigation from ServerDetail → Logs/RCON tabs

#### 4.3 Update Metrics Display
- [ ] Show real uptime (calculate from created_at or container start time)
- [ ] CPU/Memory/Disk: Get from agent metrics (agent-level for now)
- [ ] Player count: Placeholder for now (needs RCON query - future M10+)
- [ ] Status badge with real server status

---

### Phase 5: Frontend - Remove Old Navigation Pattern

**Goal:** Clean up state-based navigation in AgentsPage

**Tasks:**

#### 5.1 Simplify AgentsPage
- [ ] Remove `selectedAgent` state (line 15)
- [ ] Remove `selectedContainer` state (line 16)
- [ ] Remove `handleBackToAgents` (line 23-26)
- [ ] Remove `handleViewLogs` (line 28-30)
- [ ] Remove `handleBackToContainers` (line 32-34)
- [ ] Remove conditional rendering (lines 45-65)
- [ ] Keep only `AgentList` render (lines 67-73)
- [ ] Navigation now goes through routes (AgentDetail page)

**New AgentsPage (simplified):**
```typescript
export function AgentsPage() {
  const navigate = useNavigate();

  return (
    <AgentList
      onSelectAgent={(agent) => navigate(`/agents/${agent.id}`)}
      onViewUsers={() => navigate('/users')}
      onViewAuditLogs={() => navigate('/audit-logs')}
    />
  );
}
```

#### 5.2 Update ContainerList Component
- [ ] Keep ContainerList as reusable component
- [ ] Used in AgentDetail page (Servers tab)
- [ ] Navigation from ContainerList → ServerDetail (click row)
- [ ] Add server row click handler: `navigate(/servers/${serverId})`

---

### Phase 6: Testing & Validation

**Goal:** Verify all navigation flows work

**Tasks:**

#### 6.1 Test Navigation Flows
- [ ] **Dashboard → Agents:** Click agent card → AgentDetail page
- [ ] **Dashboard → Activity:** Shows recent actions
- [ ] **Agents List → Agent Detail:** Click agent row → AgentDetail tabs
- [ ] **Agent Detail → Server:** Click server row → ServerDetail page
- [ ] **Servers List → Server Detail:** Click server card → ServerDetail tabs
- [ ] **Server Detail → Logs Tab:** Embedded LogViewer works
- [ ] **Server Detail → RCON Tab:** Embedded RconTerminal works

#### 6.2 Test Data Display
- [ ] ServerList shows all servers across agents
- [ ] Dashboard shows correct server/agent counts
- [ ] ServerDetail shows real server data (not placeholders)
- [ ] AgentDetail shows servers for that agent only
- [ ] Search/filter works on ServerList

#### 6.3 Test Actions
- [ ] Start/Stop/Restart buttons work on ServerDetail
- [ ] Delete server button works
- [ ] Create server button navigates correctly
- [ ] Log viewer works from ServerDetail
- [ ] RCON terminal works from ServerDetail

---

## Success Criteria

**M9.5 Complete When:**
- [ ] Global server list API endpoint works
- [ ] Single server API endpoint works
- [ ] ServerList page shows all servers (real data)
- [ ] ServerDetail page shows real server data
- [ ] Dashboard shows real server counts
- [ ] AgentsPage uses new navigation (no more state-based ContainerList)
- [ ] All navigation flows work correctly
- [ ] No regressions (existing features still work)
- [ ] Deployed to production
- [ ] User approval ✓

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| *(none yet)* | - | - |

---

## Notes

- **Backward compatibility:** Keep ContainerList component for reuse in AgentDetail
- **No backend changes required for actions:** Start/stop/restart endpoints already exist
- **Player count:** Leave as placeholder (needs RCON integration - future work)
- **Historical metrics:** Not needed yet (graphs are future M10+)
- **Server metrics:** Use agent-level metrics for now (per-container metrics = future)

---

## Files to Modify

### Backend (Manager)
- `manager/src/routes/agents.ts` - Add server list endpoints

### Frontend
- `frontend/src/hooks/useServers.ts` (NEW) - Server data hooks
- `frontend/src/pages/ServerList.tsx` - Wire up real data
- `frontend/src/pages/ServerDetail.tsx` - Wire up real data
- `frontend/src/pages/Dashboard.tsx` - Add server counts
- `frontend/src/pages/AgentsPage.tsx` - Remove old navigation
- `frontend/src/components/ContainerList.tsx` - Add server navigation

---

## Timeline Estimate

| Phase | Tasks | Estimated |
|-------|-------|-----------|
| Phase 1: Backend - Server API | 2 endpoints | 1-2 hours |
| Phase 2: Frontend - Hooks | 2 hooks | 30 min |
| Phase 3: ServerList Integration | Wire up page | 30 min |
| Phase 4: ServerDetail Integration | Wire up page | 1 hour |
| Phase 5: Remove Old Navigation | Clean up | 30 min |
| Phase 6: Testing | Full validation | 1 hour |
| **Total** | 6 phases | **4-6 hours** |

---

## Quick Reference

**Current Navigation (Broken):**
```
Agents Page → State (selectedAgent) → ContainerList component → State (selectedContainer) → LogViewer
```

**New Navigation (Fixed):**
```
Agents Page → /agents/:id (AgentDetail) → /servers/:id (ServerDetail) → Tabs (Logs/RCON)
```

**API Endpoints to Create:**
- `GET /api/servers` - All servers across agents
- `GET /api/servers/:id` - Single server details
