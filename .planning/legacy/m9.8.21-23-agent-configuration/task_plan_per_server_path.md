# Task Plan: Per-Server Path Override at Creation (M9.8.23)

**Goal:** Allow per-server data path override when creating a new server

**Priority:** MEDIUM (Feature enhancement)
**Started:** 2026-01-14
**References:** M9.8.21 (Agent Configuration - Configure Button)

---

## User Requirements

1. **Server creation form** should have optional data path field
2. **Default to agent's path** if not specified
3. **Store per-server path** in database
4. **Agent uses server-specific path** when creating server
5. **Validation** - same rules as agent config (absolute, not system dirs)

---

## Current State Analysis

### What Works Now (from M9.8.21)

From agent configuration work:
- ✅ Agent's `CreateServer()` accepts DataPath parameter
- ✅ Manager passes agent's `server_data_path` when creating servers
- ✅ Backend validates paths (absolute, not root, not system dirs)
- ❌ No per-server override - always uses agent's path

### Database Schema Check

**servers table** (from migration 0003):
```sql
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  container_id TEXT,
  config TEXT NOT NULL,
  image_tag TEXT NOT NULL,
  game_port INTEGER NOT NULL,
  udp_port INTEGER NOT NULL,
  rcon_port INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ...
);
```

**Question:** Does servers table have `server_data_path` column?
- Need to check existing migrations
- If not, need to add new column

### Current Server Creation Flow

**Location:** `manager/src/routes/agents.ts:753-893` (POST /api/agents/:id/servers)

**Current Code (line 755):**
```typescript
const agent = await c.env.DB.prepare(
  `SELECT id, name, steam_zomboid_registry, server_data_path FROM agents WHERE id = ?`
)
  .bind(agentId)
  .first();
```

**Line 893:**
```typescript
dataPath: agent.server_data_path,
```

**Behavior:** Always uses agent's path, no override possible

---

## Implementation Plan

### Phase 1: Database Schema Investigation

**Check if servers.server_data_path column exists:**
1. Check all migrations in `manager/migrations/`
2. Check server creation/update queries

**Decision:**
- If column exists: Use it
- If not: Create migration 0010_add_server_data_path.sql

**Proposed Schema:**
```sql
ALTER TABLE servers ADD COLUMN server_data_path TEXT DEFAULT NULL;
```

**Note:** NULL means "inherit from agent" (not stored if using default)

### Phase 2: Update Server Creation API

**File:** `manager/src/routes/agents.ts`

**Update Request Body Interface:**
```typescript
interface CreateServerRequest {
  name: string;
  imageTag: string;
  gamePort: number;
  udpPort: number;
  rconPort: number;
  config: Record<string, string>;
  server_data_path?: string; // NEW: Optional override
}
```

**Update Creation Logic (line 753+):**
```typescript
// Parse request body
const body = await c.req.json();
const { server_data_path: customDataPath, ...restBody } = body;

// Get agent info
const agent = await c.env.DB.prepare(
  `SELECT id, name, steam_zomboid_registry, server_data_path FROM agents WHERE id = ?`
)
  .bind(agentId)
  .first();

// Determine data path: custom override or agent default
const dataPath = customDataPath || agent.server_data_path;

// Validate custom path if provided
if (customDataPath) {
  if (!customDataPath.startsWith('/')) {
    return c.json({ error: 'server_data_path must be absolute' }, 400);
  }
  if (customDataPath === '/') {
    return c.json({ error: 'Cannot use root directory' }, 400);
  }
  const forbiddenPaths = ['/etc', '/var', '/usr', '/bin', '/sbin', '/boot', '/sys', '/proc', '/dev'];
  if (forbiddenPaths.some(p => customDataPath === p || customDataPath.startsWith(p + '/'))) {
    return c.json({ error: 'Cannot use system directories' }, 400);
  }
}

// Insert into database
await c.env.DB.prepare(
  `INSERT INTO servers (id, agent_id, name, container_id, config, image_tag,
   game_port, udp_port, rcon_port, status, created_at, updated_at, server_data_path)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
)
  .bind(
    serverId, agentId, name, null, configJson, imageTag,
    gamePort, udpPort, rconPort, 'creating', now, now,
    customDataPath || null // Store custom path or NULL (inherits)
  )
  .run();

// Pass to agent
dataPath: dataPath, // Use determined path
```

### Phase 3: Update Frontend - Server Creation Form

**File:** `frontend/src/components/CreateServerModal.tsx`

**Current Form Fields:**
- Server Name
- Image Tag
- Game Port
- UDP Port
- RCON Port
- Environment Variables

**Add New Field:**
```typescript
// State
const [customDataPath, setCustomDataPath] = useState('')

// Form field
<div className="space-y-2">
  <Label htmlFor="dataPath">
    Server Data Path <span className="text-muted-foreground">(Optional)</span>
  </Label>
  <Input
    id="dataPath"
    type="text"
    value={customDataPath}
    onChange={(e) => setCustomDataPath(e.target.value)}
    placeholder={`Default: ${agentConfig?.server_data_path || '/var/lib/zedops/servers'}`}
  />
  <p className="text-xs text-muted-foreground">
    Override the agent's default data path for this server only. Leave blank to use agent default.
  </p>
</div>
```

**Update API Call:**
```typescript
await createServer(agentId, {
  name: serverName,
  imageTag: selectedImageTag,
  gamePort: parseInt(gamePort),
  udpPort: parseInt(udpPort),
  rconPort: parseInt(rconPort),
  config: envVars,
  ...(customDataPath && { server_data_path: customDataPath }), // Only include if set
});
```

### Phase 4: Frontend - Fetch Agent Config for Placeholder

**Update CreateServerModal to fetch agent config:**
```typescript
// Fetch agent config for default path display
const { data: agentConfig } = useQuery({
  queryKey: ['agentConfig', agentId],
  queryFn: () => fetchAgentConfig(agentId),
  enabled: !!agentId && open,
});
```

**Show agent's default in placeholder:**
```typescript
placeholder={`Default: ${agentConfig?.server_data_path || 'Loading...'}`}
```

### Phase 5: Display Per-Server Path in UI

**Server Detail Page:**
Show server's data path (if overridden from agent default)

**Server List:**
Optional badge/indicator if using custom path

---

## Validation Rules

**Same as Agent Configuration:**
- Must be absolute path (starts with `/`)
- Cannot be root (`/`)
- Cannot be system directories (`/etc`, `/var`, `/usr`, `/bin`, `/sbin`, `/boot`, `/sys`, `/proc`, `/dev`)

**Client-Side + Server-Side validation**

---

## Testing Checklist

### Backend
- [ ] Create server without custom path (uses agent default)
- [ ] Create server with custom path (stores in database)
- [ ] Custom path validation rejects invalid paths
- [ ] NULL in database means "inherit from agent"
- [ ] Agent receives correct path in server.create message

### Frontend
- [ ] Form shows agent's default path as placeholder
- [ ] Can leave field blank (uses default)
- [ ] Can provide custom path
- [ ] Client-side validation works
- [ ] Server creation succeeds with both scenarios

### Integration
- [ ] Server created at custom path (verify on host)
- [ ] Server created at agent default (verify on host)
- [ ] Existing servers unaffected (backward compatible)

---

## Files to Modify

### Backend
1. **manager/migrations/0010_add_server_data_path.sql** (NEW - if needed)
2. **manager/src/routes/agents.ts** - Update server creation endpoint (~50 lines)

### Frontend
1. **frontend/src/components/CreateServerModal.tsx** - Add data path field (~30 lines)
2. **frontend/src/lib/api.ts** - Update createServer interface (~5 lines)

---

## Database Migration

**If column doesn't exist, create:**

```sql
-- Migration: 0010_add_server_data_path.sql
-- Date: 2026-01-14
-- Purpose: Allow per-server data path override

ALTER TABLE servers ADD COLUMN server_data_path TEXT DEFAULT NULL;

-- NULL means "inherit from agent"
-- Non-NULL means custom path for this server
```

**Apply via:**
```bash
npx wrangler d1 execute zedops-db --local --file=./migrations/0010_add_server_data_path.sql
npx wrangler d1 execute zedops-db --remote --file=./migrations/0010_add_server_data_path.sql
```

---

## Important Notes

### Data Management

**Changing Agent Path:**
- Existing servers with NULL path: Will use NEW agent path on next operation
- Existing servers with custom path: Unaffected (still use their custom path)

**Server Edit:**
- NOT implemented in this submilestone (future: M9.8.25)
- Editing path requires data migration (complex!)

**Display Strategy:**
```
Server A: (uses agent default)
  Path: /var/lib/zedops/servers (from agent)

Server B: (custom override)
  Path: /mnt/storage/server-b (custom)
```

### Backward Compatibility

- Existing servers (no server_data_path column): Will be NULL after migration
- NULL = inherit from agent (current behavior)
- No breaking changes

---

## Success Criteria

- [x] Database schema supports per-server path (column exists or added)
- [x] Server creation API accepts optional server_data_path
- [x] Path validation works (client + server)
- [x] Form shows agent's default as placeholder
- [x] Can create server with custom path
- [x] Can create server with default path (blank field)
- [x] Agent receives correct path
- [x] Server created at correct location on host

---

## Future Work (Not in This Submilestone)

**M9.8.25 - Edit Server Data Path:**
- Allow editing path after creation
- Requires data migration tool
- Show warning about moving data
- Complex feature (deferred)

**M9.8.26 - Bulk Path Update:**
- Update multiple servers at once
- Useful when changing agent default

---

**Status:** ✅ IMPLEMENTED AND DEPLOYED
**Actual Time:** ~2 hours
**Complexity:** MEDIUM (migration + validation + frontend)
**Deployed:** 2026-01-14
**Version:** b4bd87de-9956-46b5-b85e-0d3b2e85a8e7
**URL:** https://zedops.mail-bcf.workers.dev
