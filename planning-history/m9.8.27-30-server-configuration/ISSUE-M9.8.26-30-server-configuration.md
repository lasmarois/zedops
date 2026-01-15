# M9.8.26-30: Server Configuration Management

**Priority:** HIGH (Feature Enhancement)
**Created:** 2026-01-14
**Status:** PLANNED

---

## Overview

Enable post-creation modification of server settings, starting with populating the Configuration tab and progressively adding edit capabilities. The ultimate goal is to allow changing the data path of an existing server, but this requires careful planning around which settings are mutable and how to handle container recreation.

---

## Current State Analysis

### What Exists at Creation Time (ServerForm.tsx)

**Basic Settings:**
- ✅ Server Name (immutable after creation - database constraint)
- ✅ Image Tag (e.g., `latest`)
- ✅ Beta Branch (`BETA_BRANCH` ENV: none, unstable, iwillbackupmysave, build41, legacy40)
- ✅ Server Public Name (`SERVER_PUBLIC_NAME` ENV)
- ✅ Admin Password (`ADMIN_PASSWORD` ENV)
- ✅ Server Password (`SERVER_PASSWORD` ENV)
- ✅ Custom Ports (game_port, udp_port, rcon_port)
- ✅ Custom Data Path (`server_data_path` - M9.8.23)

### What's Available But Not Exposed

**Bootstrap Configuration (from .env.template):**
- ❌ `SERVER_WELCOME_MESSAGE` - Welcome message with RGB colors
- ❌ `SERVER_PUBLIC_DESCRIPTION` - Description in server browser
- ❌ `SERVER_PUBLIC` - Show in public browser (true/false)
- ❌ `SERVER_MAP` - World map (Muldraugh, West Point, etc.) - **IMMUTABLE after world creation**
- ❌ `SERVER_MAX_PLAYERS` - Max players (1-100)
- ❌ `SERVER_OPEN` - Allow join without whitelist (true/false)
- ❌ `SERVER_PVP` - Enable PvP (true/false)
- ❌ `SERVER_PAUSE_EMPTY` - Pause when empty (true/false)
- ❌ `SERVER_GLOBAL_CHAT` - Enable global chat (true/false)

**Mod Management:**
- ❌ `SERVER_MODS` - Semicolon-separated mod IDs
- ❌ `SERVER_WORKSHOP_ITEMS` - Semicolon-separated workshop IDs

**Docker Settings:**
- ❌ `TZ` - Timezone (affects log timestamps)
- ❌ `PUID` - User ID for file permissions

### Configuration Tab (ServerDetail.tsx)

Currently shows placeholder:
> "Docker ENV configuration editor will be available in a future update."

---

## Classification: Mutable vs Immutable Settings

### Immutable (Cannot Change After Creation)

**Database Constraints:**
- ❌ Server Name - Unique constraint, used in container naming
- ❌ Ports (game_port, udp_port, rcon_port) - Unique constraints, container recreation complex

**Game Engine Constraints:**
- ❌ `SERVER_MAP` - World created with specific map, cannot change

**Technical Constraints:**
- ❌ Agent ID - Foreign key

### Mutable (Metadata Only - No Container Restart)

These can be updated in DB without touching the container:
- ✅ Image Tag (affects next rebuild/recreate only)
- ✅ Custom Data Path (affects next start/recreate only)

### Mutable (Requires Container Restart)

These require stopping, updating ENV, and restarting container:
- ✅ Beta Branch (`BETA_BRANCH`)
- ✅ Server Public Name (`SERVER_PUBLIC_NAME`)
- ✅ Admin Password (`ADMIN_PASSWORD`)
- ✅ Server Password (`SERVER_PASSWORD`)
- ✅ Welcome Message (`SERVER_WELCOME_MESSAGE`)
- ✅ Public Description (`SERVER_PUBLIC_DESCRIPTION`)
- ✅ Public Browser (`SERVER_PUBLIC`)
- ✅ Max Players (`SERVER_MAX_PLAYERS`)
- ✅ Open Server (`SERVER_OPEN`)
- ✅ PvP (`SERVER_PVP`)
- ✅ Pause Empty (`SERVER_PAUSE_EMPTY`)
- ✅ Global Chat (`SERVER_GLOBAL_CHAT`)
- ✅ Mods (`SERVER_MODS`, `SERVER_WORKSHOP_ITEMS`)
- ✅ Timezone (`TZ`)
- ✅ PUID (`PUID`)

### Mutable (Requires Container Recreation)

These require destroying container and recreating with new config:
- ✅ Data Path (`server_data_path`) - Changes volume mounts
- ⚠️ Ports - Technically possible but complex (port conflicts, reconnection)

---

## Revised Submilestone Breakdown (Based on User Decisions)

### M9.8.26 - Audit & Design: Configuration Mutability ✅ COMPLETE

**Goal:** Document what's configurable, classify mutability, get user approval on approach

**Deliverables:**
- ✅ This planning document
- ✅ Classification: immutable vs metadata-only vs restart-required vs recreate-required
- ✅ User decisions approved (see above)

**User Decisions:**
- Keep creation form minimal (defer redesign to future submilestone)
- Two-step restart: Save → Apply Changes (with impact warning)
- Data path change: Auto-migrate with progress tracking
- Backend handles: Stop → Move data → Start with new mounts

---

### M9.8.27 - Configuration Tab: Display Current Settings

**Goal:** Populate Configuration tab with read-only display of all current server settings

**Tasks:**
1. Fetch server config from DB (already available in serverData)
2. Parse `config` JSON blob (ServerConfig type)
3. Create ConfigurationDisplay component:
   - Section: Server Identity (name, public name, description)
   - Section: Network (ports - immutable, show badges)
   - Section: Gameplay (map, max players, PvP, etc.)
   - Section: Access Control (passwords, open server)
   - Section: Mods (mod list, workshop IDs)
   - Section: Advanced (image tag, beta branch, data path, timezone, PUID)
4. Show immutable fields with lock icon and explanation
5. Add "Edit Configuration" button (prepares for M9.8.28)

**Files:**
- `frontend/src/pages/ServerDetail.tsx` (Configuration tab)
- `frontend/src/components/ConfigurationDisplay.tsx` (new component)

**Outcome:** Users can see all current server settings in one place

**Estimated Time:** 1-2 hours

---

### M9.8.28 - Configuration Tab: Enable Editing (All Mutable Settings)

**Goal:** Allow editing of all mutable settings with two-step apply flow

**Tasks:**

**Backend:**
1. Add `PATCH /api/agents/:id/servers/:serverId/config` endpoint
   - Validate changes (immutable fields rejected)
   - Update `config` JSON blob in database
   - Update `image_tag`, `server_data_path` if changed
   - Return: { success, pendingRestart: boolean, dataPathChanged: boolean }

2. Add `POST /api/agents/:id/servers/:serverId/apply-config` endpoint
   - Stop container
   - If data path changed: Move data with progress updates (see M9.8.29)
   - Recreate container with new config
   - Start container
   - Update server status

**Frontend:**
1. Add ConfigurationEdit component (form with all mutable fields)
2. Toggle between display and edit mode ("Edit" / "Cancel" buttons)
3. Show validation errors inline
4. **Save flow:**
   - Click "Save Changes" → PATCH request → changes saved to DB
   - Show banner: "Configuration updated" with details of what changed
   - Show "Apply Changes" button with impact warning:
     - "⚠️ Requires server restart (X minutes downtime)"
     - If data path changed: "⚠️ Data will be moved (may take several minutes)"
5. **Apply flow:**
   - Click "Apply Changes" → confirmation dialog
   - POST to apply-config endpoint
   - Show progress: "Stopping server..." → "Moving data..." (if applicable) → "Starting server..."
   - Show success/error feedback

**Impact Warnings:**
- Normal config change: "Server will restart (~30 seconds downtime)"
- Data path change: "Server will restart + data migration (time depends on data size)"

**Files:**
- `manager/src/routes/agents.ts` (PATCH + POST endpoints)
- `frontend/src/components/ConfigurationEdit.tsx` (new component)
- `frontend/src/pages/ServerDetail.tsx` (edit mode integration)
- `frontend/src/lib/api.ts` (patchServerConfig, applyServerConfig functions)

**Outcome:** Users can edit server settings including data path with clear two-step workflow

**Estimated Time:** 3-4 hours (backend + frontend + testing)

---

### M9.8.29 - Data Path Migration with Progress Tracking

**Goal:** Implement backend data migration logic with progress updates

**Tasks:**

**Agent:**
1. Add `MoveServerData()` function in `agent/docker.go`:
   ```go
   func (dc *DockerClient) MoveServerData(serverName, oldPath, newPath string) error {
     srcDir := filepath.Join(oldPath, serverName)
     dstDir := filepath.Join(newPath, serverName)

     // Check source exists
     if !dirExists(srcDir) {
       return fmt.Errorf("source data not found: %s", srcDir)
     }

     // Create destination parent
     os.MkdirAll(dstDir, 0755)

     // Copy recursively with progress updates
     return copyDirWithProgress(srcDir, dstDir)
   }
   ```

2. Add `server.movedata` message handler in `agent/main.go`:
   - Accepts: serverName, oldPath, newPath
   - Streams progress updates via WebSocket
   - Returns success/error

3. Add progress reporting:
   - Send progress messages during copy: { percent: 45, currentFile: "..." }
   - Frontend can display progress bar

**Manager:**
1. Update `POST /api/agents/:id/servers/:serverId/apply-config`:
   - If data path changed:
     - Stop container
     - Call agent's `server.movedata` message
     - Listen for progress updates
     - Stream progress to frontend via HTTP chunked response or WebSocket
     - On completion: recreate container with new path
     - Start container

**Frontend:**
1. Update apply-config flow to show progress:
   - Progress bar for data migration
   - Current file being copied (optional)
   - Estimated time remaining (optional)

**Error Handling:**
- If move fails: Keep old data intact, don't update DB
- If move succeeds but container start fails: Data at new location, retry start
- If disk full: Abort move, show clear error

**Files:**
- `agent/docker.go` (MoveServerData function)
- `agent/main.go` (handleServerMoveData handler)
- `manager/src/routes/agents.ts` (apply-config with progress)
- `frontend/src/components/ConfigurationEdit.tsx` (progress display)

**Outcome:** Data migration works smoothly with clear progress indication

**Estimated Time:** 2-3 hours (agent + manager + frontend progress UI)

---

### DEFERRED: Server Creation Form Redesign

**Goal:** Professional UX redesign of ServerForm with all available settings

**Status:** Deferred to future milestone (post M9.8)

**Reason:** Current minimal form is sufficient, focus on post-creation editing first

**Scope when implemented:**
- Tabbed form or accordion sections
- Add all ~15 available ENV variables
- Better visual organization
- Field descriptions and examples
- Validation feedback improvements

---

## Implementation Order (Revised)

**Sequence:**
1. **M9.8.26** ✅ COMPLETE - Audit & design approved by user
2. **M9.8.27** - Display configuration (read-only, foundation)
3. **M9.8.28** - Enable editing (two-step save/apply flow)
4. **M9.8.29** - Data migration with progress tracking
5. **DEFERRED** - Server creation form redesign (future milestone)

**Estimated Time:**
- M9.8.26: ✅ Complete (planning document)
- M9.8.27: 1-2 hours (display component)
- M9.8.28: 3-4 hours (backend endpoints + frontend edit UI + apply flow)
- M9.8.29: 2-3 hours (agent data move + progress tracking)

**Total:** 6-9 hours for full configuration editing with data path migration

---

## User Decisions ✅ APPROVED (M9.8.26)

### 1. Creation Time Options
- [x] **Minimal (keep as-is)** - Defer comprehensive form redesign to future submilestone
- [ ] Note for later: Professional UX redesign of creation form

**Decision:** Keep ServerForm minimal, focus on post-creation editing

### 2. Restart Behavior
- [x] **Two-step: Save → Apply Changes**
- [x] Show clear impact warning on/near Apply button when restart required
- [x] User controls timing (no auto-restart)

**Decision:** Save changes to DB → show "Apply Changes" button with impact warning → user triggers restart

### 3. Data Path Change Approach
- [x] **Treat as restart-required operation** (not separate)
- [x] Backend handles complexity:
  - Stop container
  - Move data from old path to new path
  - Show progress indicator (file copy can be slow)
  - Start container with new mount paths

**Decision:** Data path is in Configuration tab like other settings, but backend does full data migration

### 4. Data Migration Strategy
- [x] **Auto-migrate** - Agent moves the data
- [x] Show progress during migration
- [x] Stop → Move → Start workflow

**Decision:** Backend handles data migration automatically with progress tracking

---

## Known Bugs (To Fix Before/During Implementation)

### BUG: image_tag Stored as Full Image Reference

**Discovered:** 2026-01-14 (during M9.8.31 testing)

**Symptom:** Rebuild fails with `invalid reference format`

**Root Cause:** In `agents.ts` line 1093, after server creation:
```typescript
result.imageName || body.imageTag, // Use resolved name or fall back to requested tag
```

The agent returns `result.imageName` which is the full resolved image (e.g., `registry.gitlab.nicomarois.com/nicolas/steam-zomboid:latest`). This gets stored in the `image_tag` column, overwriting the original tag (`latest`).

**Problem:** When rebuilding, the code constructs:
```
registry + ":" + image_tag
= registry.gitlab.../steam-zomboid:registry.gitlab.../steam-zomboid:latest
```
This is an invalid Docker reference format.

**Fix Options:**
1. **Extract tag from resolved name:** Parse `result.imageName` to extract just the tag portion
2. **Don't overwrite image_tag:** Keep original tag, store resolved name in separate field
3. **Store both:** Add `resolved_image` column for the full reference, keep `image_tag` for just the tag

**Recommended Fix:** Option 1 - Extract tag from resolved image name:
```typescript
// Extract tag from resolved image name (e.g., "registry/.../image:v1.2.3" → "v1.2.3")
const resolvedTag = result.imageName?.split(':').pop() || body.imageTag;
```

**Affected Servers:** Any server that was created and then rebuilt. New servers after fix will work correctly.

**Workaround (Manual DB Fix):**
```sql
UPDATE servers SET image_tag = 'latest' WHERE image_tag LIKE '%:%';
```

---

## Future Enhancements

**Post M9.8.30:**
- Mod management UI (add/remove mods via UI instead of semicolon lists)
- Port change support (complex due to uniqueness constraints)
- Bulk configuration templates (apply preset configs to multiple servers)
- Configuration history (track changes over time)
- Import/export configuration (JSON/YAML)

---

## Notes

- All changes respect RBAC (operators can edit, viewers cannot)
- Immutable fields always show with clear explanation
- Restart-required changes show prominent warning
- Data path change is treated as high-risk operation
- All operations audited via audit log system
