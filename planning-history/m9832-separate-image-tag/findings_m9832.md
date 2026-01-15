# Findings: M9.8.32 - Separate Image and Tag Fields

**Goal:** Document current state and design decisions for image/tag separation
**Updated:** 2026-01-14

---

## Current Database Schema

```sql
-- From servers table
image_tag TEXT NOT NULL  -- Currently stores EITHER just tag OR full reference
```

**Problem:** No consistent format - some servers have:
- Just tag: `latest`
- Full reference: `registry.gitlab.nicomarois.com/nicolas/steam-zomboid:latest`

---

## Current Data (bonjour example)

```sql
SELECT name, image_tag FROM servers WHERE name = 'bonjour';
-- Result: image_tag = "registry.gitlab.nicomarois.com/nicolas/steam-zomboid:latest"
```

This was caused by `agents.ts:1093`:
```typescript
result.imageName || body.imageTag, // Use resolved name or fall back to requested tag
```

---

## Code Audit: Where image_tag is Used

### agents.ts (Manager)

**Line 1026:** INSERT on server creation
```typescript
`INSERT INTO servers (id, agent_id, name, container_id, config, image_tag, ...)`
```

**Line 1089:** UPDATE after creation (THE BUG)
```typescript
`UPDATE servers SET container_id = ?, image_tag = ?, status = 'running', ...`
.bind(result.containerId, result.imageName || body.imageTag, ...)
```
- `result.imageName` is full resolved reference from agent
- This overwrites the original tag with full reference

**Line 2320:** UPDATE on config change
```typescript
updates.push('image_tag = ?');
bindings.push(body.imageTag);
```

**Line 2453:** Read for apply-config
```typescript
const dataPath = server.server_data_path || server.agent_server_data_path;
// image_tag is read from server record
```

### Agent (main.go + server.go)

**handleServerCreate:** Receives `imageTag` from manager, constructs reference
```go
imageName := fmt.Sprintf("%s:%s", req.Registry, req.ImageTag)
```

**handleServerRebuild:** Same pattern
```go
imageName := fmt.Sprintf("%s:%s", req.Registry, req.ImageTag)
```

---

## Proposed Schema Change

### Option A: Add `image` column, keep `image_tag` as `tag`

```sql
ALTER TABLE servers ADD COLUMN image TEXT;  -- Full image path (optional override)
ALTER TABLE servers RENAME COLUMN image_tag TO tag;  -- Just the tag
```

**Pros:**
- Minimal changes to column name
- `tag` is clear and concise

**Cons:**
- Renaming columns in SQLite requires table recreation

### Option B: Add both `image` and `tag`, deprecate `image_tag`

```sql
ALTER TABLE servers ADD COLUMN image TEXT;
ALTER TABLE servers ADD COLUMN tag TEXT DEFAULT 'latest';
-- Keep image_tag for backward compatibility during transition
```

**Pros:**
- No column rename needed
- Backward compatible during transition
- Can drop `image_tag` later

**Cons:**
- Temporary redundancy

### Recommendation: Option B

Safer migration path, allows gradual transition.

---

## Image Reference Construction

### Current (Broken)
```typescript
// Manager sends to agent:
registry: agent.steam_zomboid_registry,  // "registry.gitlab.../steam-zomboid"
imageTag: server.image_tag,              // "registry.gitlab.../steam-zomboid:latest" (WRONG!)

// Agent constructs:
imageName := fmt.Sprintf("%s:%s", req.Registry, req.ImageTag)
// = "registry.gitlab.../steam-zomboid:registry.gitlab.../steam-zomboid:latest" (INVALID)
```

### Proposed (Fixed)
```typescript
// Manager sends to agent:
image: server.image || agent.steam_zomboid_registry,  // "registry.gitlab.../steam-zomboid"
tag: server.tag,                                       // "latest"

// Agent constructs:
imageName := fmt.Sprintf("%s:%s", req.Image, req.Tag)
// = "registry.gitlab.../steam-zomboid:latest" (CORRECT)
```

---

## Migration Strategy

1. **Add new columns** (non-breaking)
2. **Migrate existing data:**
   - If `image_tag` contains `:` → split into image and tag
   - If `image_tag` is just a tag → use agent's registry for image
3. **Update code** to use new columns
4. **Deploy and test**
5. **Drop `image_tag`** column (future cleanup)

---

## Affected Servers Query

```sql
SELECT id, name, image_tag,
  CASE
    WHEN image_tag LIKE '%:%' THEN 'full_reference'
    ELSE 'tag_only'
  END as format
FROM servers;
```

---

## Questions to Resolve

1. Should `image` column be nullable (inherit from agent) or required?
   - **Recommendation:** Nullable (NULL = use agent's `steam_zomboid_registry`)

2. Should we allow per-server image override in UI?
   - **Recommendation:** Yes, but as "advanced" option (collapsed by default)

3. What about existing `image_tag` values with full references?
   - **Recommendation:** Extract tag portion, set image from agent's registry

---

## Full Code Audit Results

### Manager (agents.ts)
| Line | Operation | Notes |
|------|-----------|-------|
| 1025 | INSERT | Stores `body.imageTag` |
| 1089-1093 | UPDATE | **BUG** - stores `result.imageName` (full reference) |
| 1117, 1183, 1386, 2500 | SELECT | Reads `image_tag` |
| 2307, 2319-2321 | UPDATE | Config change updates `image_tag` |

### Manager (AgentConnection.ts)
| Line | Operation | Notes |
|------|-----------|-------|
| 1707-1742 | server.create | Sends `imageTag` to agent |
| 1901-1935 | server.rebuild | Sends `imageTag` to agent |
| 2301 | sync | Returns `image_tag` |

### Manager (servers.ts)
| Line | Operation | Notes |
|------|-----------|-------|
| 67, 139 | SELECT | Returns `image_tag` |

### Manager (types/Server.ts)
| Line | Field | Notes |
|------|-------|-------|
| 9 | `image_tag: string` | DB field name |
| 28 | `imageTag: string` | API field name |

### Agent (server.go)
| Line | Struct/Field | Notes |
|------|--------------|-------|
| 24 | `ServerConfig.ImageTag` | Used in CreateServer |
| 533 | `RebuildServerWithConfigRequest.ImageTag` | Used in rebuild |
| 555 | Response struct | Returns imageTag |

### Agent (main.go)
| Line | Handler | Notes |
|------|---------|-------|
| 1285 | images.inspect | Uses imageTag for inspection |

### Frontend Components
- `ConfigurationEdit.tsx` - Edit form with imageTag field
- `ConfigurationDisplay.tsx` - Shows image_tag
- `ServerForm.tsx` - Creation form with imageTag
- `ServerList.tsx` - Displays imageTag
- `api.ts` - API types and functions
- `useServers.ts` - Hooks including useImageDefaults

---

## Implementation Plan (Refined)

### Minimal Fix Approach
Instead of full schema refactor, we can fix the immediate bug by:
1. **Don't overwrite image_tag after creation** - Remove line 1089-1093 update
2. **Extract tag from resolved name** if needed for display

### Full Fix Approach (Recommended)
1. Add `image` column (nullable)
2. Keep `image_tag` as-is (just the tag, not full reference)
3. Fix line 1093 to only store the tag portion
4. Update agent to receive both `image` and `tag`

**Decision:** Full fix is cleaner and aligns with user's architectural preference
