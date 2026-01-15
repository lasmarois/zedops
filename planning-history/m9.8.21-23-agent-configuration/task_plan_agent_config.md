# Task Plan: Agent Configuration - Configurable Data Paths

**Goal:** Implement agent configuration system with focus on configurable server data paths

**Priority:** HIGH (M9.8 submilestone)
**Started:** 2026-01-14

---

## User Requirements

1. **Agent Overview "Configure" button** should work
2. **First configuration item:** Configurable host mount path for server data
   - Currently hardcoded: `/var/lib/zedops/servers`
   - Needs to be configurable per-agent
3. **Storage metrics:** Agent should report storage metrics for paths with server data
4. **Server defaults:** This setting is inherited by servers (configurable at server create/edit in future)

---

## Current State Analysis

### What Exists
- [ ] Agent Overview page with Configure button (need to verify)
- [ ] Hardcoded data path in agent/server.go: `/var/lib/zedops/servers`
- [ ] No agent configuration storage in database
- [ ] No agent configuration UI

### What's Missing
- [ ] Database schema for agent configuration
- [ ] Agent configuration API endpoints
- [ ] Agent configuration UI (Configure button functionality)
- [ ] Storage metrics collection for data paths
- [ ] Per-agent data path setting

---

## Phases

### Phase 1: Investigation ✅ complete

**Goal:** Understand current implementation and requirements

**Status:** COMPLETE - See findings_agent_config.md for full details

**Key Findings:**
- ✅ Configure button exists (AgentDetail.tsx:82-84) but disabled/no-op
- ✅ Database field `agents.server_data_path` ALREADY EXISTS (migration 0004)
- ✅ Backend ALREADY reads and passes data path to agent on server creation
- ✅ Agent receives DataPath parameter and uses it in CreateServer
- ❌ Agent DeleteServer function HARDCODES path (BUG)
- ❌ No API endpoints for reading/updating configuration
- ❌ No UI for changing data path
- ❌ No storage metrics collection

**Questions answered:**
- ✅ Configure button: AgentDetail.tsx:82-84, no onClick handler
- ✅ Data path passed: Via server.create message payload
- ✅ Directories created: filepath.Join(config.DataPath, serverName, "bin"|"data")
- ✅ Config storage: `agents.server_data_path` column exists
- ✅ Hardcoded paths: agent/server.go:211, 218 (DeleteServer)

### Phase 2: Database Schema ✅ complete (already exists!)

**Goal:** Add agent configuration storage

**Decision:** USE EXISTING `agents.server_data_path` column

**Current Schema:**
```sql
-- Migration 0004_add_agent_data_path.sql (already applied)
ALTER TABLE agents ADD COLUMN server_data_path TEXT NOT NULL DEFAULT '/var/lib/zedops/servers';
```

**Status:** NO ACTION NEEDED - Database infrastructure already in place

**Storage Metrics:** Will be added to `agents.metadata` JSON column (already exists)

### Phase 2.5: Fix Agent DeleteServer Bug ✅ complete

**Goal:** Fix hardcoded path in agent DeleteServer function

**Problem:**
- agent/server.go:211, 218 hardcoded `/var/lib/zedops/servers`
- Should use configurable path from manager

**Solution Implemented:**

**Changes Made:**
1. ✅ Added `DataPath string` field to `ServerDeleteRequest` struct (agent/server.go:360)
2. ✅ Updated `DeleteServer()` signature to accept `dataPath string` parameter (agent/server.go:170)
3. ✅ Replaced hardcoded path with `filepath.Join(dataPath, serverName)` (agent/server.go:211, 218)
4. ✅ Updated `handleServerDelete()` to pass `req.DataPath` (agent/main.go:778)
5. ✅ Added dataPath validation in DO (AgentConnection.ts:1750-1757)
6. ✅ Forward dataPath in server.delete message (AgentConnection.ts:1784)
7. ✅ Manager soft delete queries `server_data_path` and passes it (agents.ts:1504, 1523)
8. ✅ Manager purge queries `server_data_path` and passes it (agents.ts:1599, 1619)

**Testing:**
- ✅ Agent builds successfully with `./scripts/build.sh`
- ⏳ Needs deployment and runtime testing (Session 3)

### Phase 3: Agent - Storage Metrics Collection 📋 pending

**Goal:** Agent collects storage metrics for data paths

**Tasks:**
1. Add function to get disk usage for a path (df command or syscall)
2. Add storage metrics to agent heartbeat
3. Handle multiple data paths (future-proofing)
4. Report metrics for each server's data location

**Data structure:**
```go
type StorageMetrics struct {
    Path       string  `json:"path"`
    TotalBytes int64   `json:"totalBytes"`
    UsedBytes  int64   `json:"usedBytes"`
    FreeBytes  int64   `json:"freeBytes"`
}
```

### Phase 4: Backend - Agent Configuration API ✅ complete

**Goal:** CRUD endpoints for agent configuration

**Endpoints Implemented:**
- ✅ `GET /api/agents/:id/config` (agents.ts:183-215)
- ✅ `PUT /api/agents/:id/config` (agents.ts:225-327)

**API Response Format:**
```typescript
// GET /api/agents/:id/config - Response
{
  "success": true,
  "config": {
    "server_data_path": "/var/lib/zedops/servers",
    "steam_zomboid_registry": "registry.gitlab.nicomarois.com/nicolas/steam-zomboid"
  }
}

// PUT /api/agents/:id/config - Request
{
  "server_data_path": "/mnt/storage/zomboid-servers",  // Optional
  "steam_zomboid_registry": "registry.example.com"     // Optional
}

// PUT /api/agents/:id/config - Response
{
  "success": true,
  "message": "Agent configuration updated successfully",
  "config": {
    "server_data_path": "/mnt/storage/zomboid-servers",
    "steam_zomboid_registry": "registry.example.com"
  }
}
```

**Validation Implemented:**
- ✅ Path must be absolute (start with /)
- ✅ Path must not be root (/)
- ✅ Path must not be system directories (/etc, /var, /usr, /bin, /sbin, /boot, /sys, /proc, /dev)
- ✅ At least one field must be provided in PUT request
- ✅ Admin-only access

**Important Note:** Changing data path does not move existing server data - that's a manual operation

### Phase 5: Frontend - Configuration Modal ✅ complete

**Goal:** Wire up Configure button to show configuration modal

**Implementation Complete:**

**Files Created:**
1. ✅ `frontend/src/components/AgentConfigModal.tsx` (177 lines)
   - Modal dialog with form fields
   - Server Data Path input with validation
   - Steam Zomboid Registry input
   - Loading skeleton while fetching config
   - Success/error alerts
   - Auto-close on success (1.5s delay)

**Files Modified:**
2. ✅ `frontend/src/lib/api.ts` (+64 lines)
   - `fetchAgentConfig()` function
   - `updateAgentConfig()` function
   - `AgentConfig` TypeScript interface
   - Error handling for 400/403/404

3. ✅ `frontend/src/pages/AgentDetail.tsx` (+32 lines)
   - useState for modal visibility
   - useQuery for config (lazy-loaded)
   - useMutation for updates
   - onClick handler on Configure button
   - Modal component rendered

**Features:**
- ✅ Configure button opens modal (line 109-115)
- ✅ Form pre-fills with current config
- ✅ Client-side path validation
- ✅ Server-side validation via API
- ✅ Success feedback with auto-close
- ✅ Error messages displayed in alerts
- ✅ Query invalidation refreshes UI after save
- ✅ Disabled state while saving
- ✅ Only enabled when agent is online

**UI Design:**
```
┌─────────────────────────────────────────┐
│ Configure Agent: maestroserver          │
├─────────────────────────────────────────┤
│                                         │
│ DEFAULT SERVER SETTINGS                 │
│                                         │
│ Server Data Path                        │
│ ┌─────────────────────────────────────┐ │
│ │ /var/lib/zedops/servers             │ │
│ └─────────────────────────────────────┘ │
│ ℹ️ This path will be used for new      │
│    servers unless overridden           │
│                                         │
│ Storage: 120GB / 500GB used (24%)      │
│                                         │
│ [Cancel] [Save Changes]                │
└─────────────────────────────────────────┘
```

### Phase 6: Server Creation Inheritance 📋 pending

**Goal:** New servers inherit agent's data path setting

**Tasks:**
1. When creating server, read agent config
2. Use agent's data path as default
3. Allow override at server creation (future milestone)
4. Update server.go to use configurable path

### Phase 7: Testing & Documentation 📋 pending

**Tasks:**
1. Test agent config update
2. Test storage metrics reporting
3. Test server creation with custom path
4. Update documentation
5. Commit and deploy

---

## Status Legend
- ⏳ in_progress
- ✅ complete
- 📋 pending
- ❌ blocked

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | - | - |

---

## Open Questions

1. Should storage metrics be real-time or periodic?
2. Should we validate path exists before saving config?
3. How to handle path change when servers already exist?
4. Should path be changeable per-server at edit time?
5. Do we need migration for existing agents/servers?

---

## Notes

**Scope for this milestone:**
- Agent-level configuration (Configure button)
- Configurable data path
- Storage metrics for data paths
- Server creation inherits from agent

**Future milestones:**
- Per-server path override at creation
- Per-server path edit (requires data migration!)
- Multiple data paths per agent
- Automatic storage cleanup/alerts
