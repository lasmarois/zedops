# Findings: Agent Configuration Investigation

**Date:** 2026-01-14
**Phase:** Investigation (Phase 1)

---

## Key Discoveries

### 1. Database Schema - ALREADY EXISTS! ✅

**Migration 0004_add_agent_data_path.sql:**
```sql
ALTER TABLE agents ADD COLUMN server_data_path TEXT NOT NULL DEFAULT '/var/lib/zedops/servers';
```

**Also exists:** `steam_zomboid_registry` column (from migration 0002)

**Implication:** Database infrastructure is already in place. No schema migration needed for basic data path storage.

---

### 2. Configure Button - EXISTS BUT DISABLED

**Location:** `frontend/src/pages/AgentDetail.tsx:82-84`

```typescript
<Button variant="outline" disabled={agent.status !== 'online'}>
  Configure
</Button>
```

**Current State:**
- Button is visible in UI header
- Disabled when agent is offline
- **No onClick handler** - does nothing when clicked
- Located next to "Disconnect" button

---

### 3. Configuration Tab - PLACEHOLDER ONLY

**Location:** `frontend/src/pages/AgentDetail.tsx:233-245`

```typescript
<TabsContent value="config" className="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>Agent Configuration</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">
        Agent configuration settings will be available in a future update.
      </p>
    </CardContent>
  </Card>
</TabsContent>
```

**Current State:**
- Tab exists but shows placeholder message
- No actual configuration form/fields

---

### 4. Backend - DATA PATH ALREADY INTEGRATED! ✅

**Server Creation Flow** (`manager/src/routes/agents.ts:753-893`):

```typescript
// Line 755: Read server_data_path from database
const agent = await c.env.DB.prepare(
  `SELECT id, name, steam_zomboid_registry, server_data_path FROM agents WHERE id = ?`
)
  .bind(agentId)
  .first();

// Line 893: Pass to agent
dataPath: agent.server_data_path,
```

**Start Server Flow** (`agents.ts:1102-1207`):
- Also reads `server_data_path` from database
- Passes to agent when recreating container

**Current State:**
- Backend ALREADY reads data path from DB
- Backend ALREADY passes it to agent on server creation
- Backend ALREADY passes it to agent on container recreation

---

### 5. Agent - PARTIAL IMPLEMENTATION

**CreateServer - CORRECT** (`agent/server.go:76-87`):
```go
// Uses configured data path (received from manager)
basePath := filepath.Join(config.DataPath, config.Name)
binPath := filepath.Join(basePath, "bin")
dataPath := filepath.Join(basePath, "data")
```

**DeleteServer - HARDCODED** (`agent/server.go:211, 218`):
```go
// Line 211 - HARDCODED PATH!
basePath := fmt.Sprintf("/var/lib/zedops/servers/%s", serverName)

// Line 218 - HARDCODED PATH!
log.Printf("Volumes preserved at: /var/lib/zedops/servers/%s", serverName)
```

**CheckServerData - Uses parameter correctly** (`agent/server.go:401-417`):
```go
func (dc *DockerClient) CheckServerData(serverName, dataPath string) ServerDataStatus {
  binPath := filepath.Join(dataPath, serverName, "bin")
  dataFolderPath := filepath.Join(dataPath, serverName, "data")
  // ...
}
```

**Current State:**
- CreateServer ✅ - Uses DataPath parameter from manager
- DeleteServer ❌ - Hardcoded `/var/lib/zedops/servers`
- CheckServerData ✅ - Uses dataPath parameter

---

### 6. Missing Functionality

| Feature | Status | Notes |
|---------|--------|-------|
| Database field | ✅ Exists | `agents.server_data_path` |
| Backend reads field | ✅ Working | Used in server creation/start |
| Agent receives path | ✅ Working | Via ServerConfig.DataPath |
| Agent uses path | ⚠️ Partial | CreateServer ✅, DeleteServer ❌ |
| Configure button handler | ❌ Missing | No onClick |
| Configuration UI | ❌ Missing | Placeholder only |
| API to update config | ❌ Missing | No PUT/POST endpoint |
| Storage metrics | ❌ Missing | No collection/reporting |

---

## Current Data Flow

### Server Creation (WORKING):
```
1. Frontend: POST /api/agents/:id/servers
2. Backend: Read agent.server_data_path from DB
3. Backend: Pass to AgentConnection DO
4. DO: Forward to agent via server.create message
5. Agent: Receive config.DataPath
6. Agent: Create directories using config.DataPath ✅
```

### Server Deletion (BUG):
```
1. Frontend: DELETE /api/agents/:id/servers/:id
2. Backend: Forward to agent via server.delete
3. Agent: DeleteServer() function
4. Agent: HARDCODES /var/lib/zedops/servers ❌
   - Should use configured path from DB
```

### Configuration Update (NOT IMPLEMENTED):
```
❌ No API endpoint exists
❌ No UI to change value
❌ Configure button does nothing
```

---

## What Needs to Be Built

### Phase 2: Fix Agent DeleteServer
- Update `agent/server.go:DeleteServer()` to accept dataPath parameter
- Pass dataPath from manager when calling server.delete
- Remove hardcoded paths

### Phase 3: API for Agent Configuration
- `GET /api/agents/:id/config` - Get current configuration
- `PUT /api/agents/:id/config` - Update configuration
- Validation: Path must be absolute, writable

### Phase 4: Storage Metrics
- Agent: Collect disk usage for configured data path
- Agent: Include in heartbeat metadata
- Backend: Store in agents.metadata
- Frontend: Display in UI

### Phase 5: Configuration UI
- Wire Configure button to modal
- Form field for server_data_path
- Save button calls PUT /api/agents/:id/config
- Display storage metrics

---

## Questions Answered

✅ **Where is Configure button?**
- AgentDetail.tsx:82-84, currently disabled/no-op

✅ **How is data path passed to agent?**
- Via server.create message payload, DataPath field

✅ **How does agent create directories?**
- Uses filepath.Join(config.DataPath, serverName, "bin"|"data")

✅ **Is there agent.config column?**
- No dedicated config column, but `server_data_path` exists
- Could use `agents.metadata` JSON column for future config

✅ **Where are hardcoded paths?**
- agent/server.go:211, 218 in DeleteServer function

---

## Implementation Progress

### ✅ Completed:
1. ✅ **Fix DeleteServer bug** - dataPath parameter now passed correctly
2. ✅ **Add GET /api/agents/:id/config endpoint** - Returns server_data_path and steam_zomboid_registry
3. ✅ **Add PUT /api/agents/:id/config endpoint** - Updates configuration with validation

### ⏳ Remaining:
4. **Wire Configure button** - Open modal with current data_path (Phase 5)
5. **Add storage metrics collection** - df command or syscall (Phase 3)
6. **Display metrics in UI** - Show disk usage on Agent Overview (Phase 5)

---

## Architecture Notes

**Current Design:**
- Manager is source of truth for configuration
- Agent receives config per-operation (server.create, server.delete)
- No agent-side configuration file

**Good:**
- Centralized configuration management
- Agent is stateless (except Docker state)
- Easy to change config without restarting agent

**Consideration:**
- Agent must receive dataPath on EVERY operation
- DeleteServer currently doesn't receive it (BUG)
- Need to ensure all operations receive necessary config
