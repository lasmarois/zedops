# Progress Log: M9.8.32 - Separate Image and Tag Fields

**Goal:** Fix rebuild failures by separating image and tag into distinct database fields
**Started:** 2026-01-14
**Status:** Phase 3 - Backend Updates IN PROGRESS

---

## Session 1: 2026-01-14

### Phase 1: Investigation ✅ COMPLETE

**Bug Discovery:**
- User tried to rebuild "bonjour" server after data path migration
- Error: `invalid reference format`
- Root cause: `image_tag` column contains full reference instead of just tag

**Database State (bonjour) - BEFORE:**
```sql
image_tag = "registry.gitlab.nicomarois.com/nicolas/steam-zomboid:latest"
-- Should be: image_tag = "latest"
```

**Code Audit Complete:**
- `agents.ts:1089` - Bug location (stores `result.imageName` which is full reference)
- `agents.ts:1026` - Initial INSERT uses correct tag
- Agent constructs: `registry + ":" + image_tag` → double reference

---

### Phase 2: Database Migration ✅ COMPLETE

**Migration Created:** `manager/migrations/0011_separate_image_tag.sql`
- Added `image TEXT` column (nullable)

**Data Migration Executed:**
```sql
-- Split full references into image and tag
UPDATE servers SET
  image = SUBSTR(image_tag, 1, INSTR(image_tag, ':') - 1),
  image_tag = SUBSTR(image_tag, INSTR(image_tag, ':') + 1)
WHERE image_tag LIKE '%:%' AND image_tag LIKE '%/%';
```

**Database State AFTER:**
```
jeanguy: image_tag="latest", image="registry.gitlab.nicomarois.com/nicolas/steam-zomboid"
build42-testing: image_tag="latest", image="registry.gitlab.nicomarois.com/nicolas/steam-zomboid"
bonjour: image_tag="latest", image="registry.gitlab.nicomarois.com/nicolas/steam-zomboid"
```

---

### Phase 3: Backend Updates ✅ COMPLETE

**Files Modified:**
- [x] `manager/src/types/Server.ts` - Added `image` field to Server and CreateServerRequest
- [x] `agents.ts:1089-1098` - Fixed to NOT overwrite `image_tag` with full reference
- [x] `agents.ts:1025` - Updated INSERT to include `image` column
- [x] `agents.ts:1064` - Updated create forward to use `body.image || agent.steam_zomboid_registry`
- [x] `agents.ts:1378-1388` - Updated rebuild to use `server.image || agent.steam_zomboid_registry`
- [x] `agents.ts:2493-2505` - Updated apply-config to use `server.image || server.steam_zomboid_registry`
- [x] `agents.ts:2274-2279` - Added `image` to body type in PATCH config endpoint
- [x] `agents.ts:2285-2293` - Updated SELECT to include `image` field
- [x] `agents.ts:2314-2331` - Added image change detection and update handling
- [x] `agents.ts:2366` - Added image to audit log

---

### Phase 4: Agent Code Verification ✅ COMPLETE

**Result:** No changes needed. Agent receives `Registry` and `ImageTag` separately and constructs:
```go
fullImage := fmt.Sprintf("%s:%s", config.Registry, config.ImageTag)
```

---

### Phase 5: Frontend Updates ✅ COMPLETE

**Files Modified:**
- [x] `frontend/src/lib/api.ts` - Added `image` and `steam_zomboid_registry` to Server interface
- [x] `frontend/src/lib/api.ts` - Added `image` to CreateServerRequest
- [x] `frontend/src/lib/api.ts` - Updated updateServerConfig to support `image` parameter
- [x] `manager/src/routes/servers.ts` - Updated SELECT queries to include `image` and `steam_zomboid_registry`
- [x] `manager/src/routes/servers.ts` - Updated response mappings
- [x] `frontend/src/components/ConfigurationDisplay.tsx` - Updated to show full image:tag reference

---

### Phase 6: Testing ✅ COMPLETE

**Deployment:**
- [x] Frontend built and deployed
- [x] Manager deployed to Cloudflare

**Verified:**
- [x] Rebuild on bonjour server - **SUCCESS**
- [x] Configuration tab shows full image reference
- [x] Image Registry field available in edit form

---

## M9.8.32 COMPLETE ✅

**Summary:** Fixed rebuild failures by separating image and tag into distinct database fields. Added per-server image registry override capability.

**Root Cause:** `agents.ts:1093` was storing full image reference in `image_tag` column, causing double-reference when rebuilding.

**Solution:**
- Added `image` column to servers table (nullable)
- Fixed backend to not overwrite `image_tag` after creation
- Updated all rebuild/apply-config flows to use `server.image || agent.steam_zomboid_registry`
- Added Image Registry field to Configuration edit form

---
