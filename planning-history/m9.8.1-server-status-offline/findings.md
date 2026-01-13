# M9.8.1 Findings - Server Status & Agent Connectivity

**Milestone:** M9.8.1 - Fix Server Status When Agent Offline
**Started:** 2026-01-13
**Status:** 🔍 Investigation

---

## Problem Description

**User Report:**
"Server status shows as running everywhere in the UI even if the agent is offline. This doesn't make sense."

**Impact:**
- Misleading information: Users see "running" servers but agent is unreachable
- Cannot trust status: If agent is offline, we don't know actual container state
- Operational confusion: Users may try to connect to "running" servers that aren't accessible

---

## Investigation Results

### Finding #1: API Doesn't Include Agent Status ✅ CONFIRMED
**Severity:** CRITICAL
**Impact:** Frontend cannot determine if agent is online when displaying server status

**Evidence:**

**Backend Query (servers.ts line 37-43):**
```sql
SELECT
  s.*,
  a.name as agent_name
FROM servers s
LEFT JOIN agents a ON s.agent_id = a.id
```

**Returns:**
- `agent_name` from agents table ✅
- `status` from servers table ✅
- **Missing:** `agent.status` (online/offline) ❌

**Similar issue in agents.ts line 974-978:**
```sql
SELECT * FROM servers WHERE agent_id = ?
```
- Only returns server data
- Doesn't include agent status at all

**Result:**
Frontend receives server status ("running", "stopped") but has no way to know if the agent is online or offline.

### Finding #2: Database Schema is Correct ✅
**Status:** No Changes Needed

**Agents Table (schema.sql):**
- Has `status` field: 'online' | 'offline'
- Has `last_seen` timestamp
- Properly indexed

**Servers Table (0003_create_servers_table.sql):**
- Has `agent_id` foreign key to agents table
- Has its own `status` field for container state
- Foreign key constraint: `FOREIGN KEY (agent_id) REFERENCES agents(id)`

**Data model is good** - just need to include agent status in queries.

### Finding #3: Frontend Has No Agent Status Context ✅
**Files Checked:**
- `frontend/src/hooks/useServers.ts` - Fetches server data
- `frontend/src/components/AgentServerList.tsx` - Displays servers
- `frontend/src/pages/ServerList.tsx` - Global server list
- `frontend/src/pages/ServerDetail.tsx` - Single server view

**Current Status Display:**
All components show `server.status` directly without considering agent connectivity.

Example (ServerList.tsx):
```tsx
<StatusBadge variant={server.status === 'running' ? 'success' : 'muted'}>
  {server.status}
</StatusBadge>
```

**Problem:**
No logic to check if agent is offline before displaying server status.

---

## Root Cause Analysis

**Root Cause:**
Server status is stored and displayed independently of agent connectivity status.

**Flow:**
1. Agent goes offline (agent.status = 'offline')
2. Server status in database remains "running" (last known state)
3. API queries return server.status without agent.status
4. Frontend displays "running" without knowing agent is offline
5. **Result:** Misleading status shown to users

**Why This Happens:**
- Server status is a snapshot of container state
- No automatic sync when agent goes offline
- No computed field combining agent + server status
- Frontend has no way to determine if status is stale

---

## Proposed Solution

### Approach: Include Agent Status in Server Queries

**Backend Changes:**

1. **Update `/api/servers` query** (servers.ts):
   ```sql
   SELECT
     s.*,
     a.name as agent_name,
     a.status as agent_status  -- ADD THIS
   FROM servers s
   LEFT JOIN agents a ON s.agent_id = a.id
   ```

2. **Update `/api/servers/:id` query** (servers.ts):
   Same change - include `a.status as agent_status`

3. **Update `/api/agents/:id/servers` query** (agents.ts):
   ```sql
   SELECT
     s.*,
     a.status as agent_status
   FROM servers s
   JOIN agents a ON s.agent_id = a.id
   WHERE s.agent_id = ?
   ```

4. **Add to response mapping:**
   ```typescript
   {
     ...server_fields,
     agent_status: row.agent_status, // 'online' | 'offline'
   }
   ```

**Frontend Changes:**

1. **Update TypeScript interface** (api.ts or useServers.ts):
   ```typescript
   interface Server {
     // ... existing fields
     agent_status: 'online' | 'offline';
   }
   ```

2. **Add computed status helper** (new utility function):
   ```typescript
   function getDisplayStatus(server: Server) {
     if (server.agent_status === 'offline') {
       return { status: 'agent_offline', label: 'Agent Offline' };
     }
     return { status: server.status, label: server.status };
   }
   ```

3. **Update status display components:**
   - AgentServerList.tsx
   - ServerList.tsx
   - ServerDetail.tsx

   Use computed status instead of raw server.status

4. **Update StatusBadge variants:**
   Add support for 'agent_offline' variant (gray/warning color)

### Alternative Approach: Computed Status Field

Could add a computed_status field in backend that combines agent + server status before returning to frontend. More processing on backend but simpler frontend logic.

**Recommendation:** Approach 1 (include agent_status)
- More flexible for frontend to make UX decisions
- Frontend can show additional info (e.g., "Last seen: 5m ago")
- Backend remains simple data provider
- Frontend controls presentation logic

---

## Architecture Impact

**Backend:**
- Minor: Add one field to SQL queries (agent.status)
- Minor: Add one field to response mapping
- No schema changes needed
- No breaking changes (additive only)

**Frontend:**
- Minor: Add agent_status to Server interface
- Minor: Create status display helper function
- Moderate: Update 3-4 components to use computed status
- Minor: Add new StatusBadge variant

**Testing:**
- Backend: Verify agent_status included in all server endpoints
- Frontend: Test status display for online/offline agents
- Integration: Agent disconnect → status updates correctly
