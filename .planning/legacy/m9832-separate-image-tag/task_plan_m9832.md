# Task Plan: M9.8.32 - Separate Image and Tag Fields

**Goal:** Fix rebuild failures by separating image and tag into distinct database fields
**Started:** 2026-01-14
**Status:** Phase 1 - Investigation

---

## Problem Statement

Servers fail to rebuild with error: `invalid reference format`

**Root Cause:** After server creation, `agents.ts:1093` stores the full resolved image name (e.g., `registry.gitlab.nicomarois.com/nicolas/steam-zomboid:latest`) in the `image_tag` column. When rebuilding, the code constructs:
```
registry + ":" + image_tag
= registry.gitlab.../steam-zomboid:registry.gitlab.../steam-zomboid:latest
```
This is an invalid Docker reference.

**User Request:** Separate into two fields - `image` (registry+repository) and `tag` (version tag)

---

## Phases

### Phase 1: Investigation
- [ ] Audit all places where `image_tag` is read/written
- [ ] Identify all code paths that construct image references
- [ ] Document current data in database (what format is stored)
- [ ] Determine migration strategy

### Phase 2: Database Schema Migration
- [ ] Create migration file `0006_separate_image_tag.sql`
- [ ] Add `image` column (nullable, for per-server override)
- [ ] Rename `image_tag` to `tag` (or add new `tag` column)
- [ ] Migrate existing data
- [ ] Run migration on D1

### Phase 3: Backend Updates (Manager)
- [ ] Update server creation to store image and tag separately
- [ ] Update server queries to return both fields
- [ ] Update rebuild/recreate logic to construct reference correctly
- [ ] Update PATCH config endpoint for tag changes

### Phase 4: Backend Updates (Agent)
- [ ] Update server.create handler to use image + tag
- [ ] Update server.rebuild handler
- [ ] Ensure backward compatibility during transition

### Phase 5: Frontend Updates
- [ ] Update TypeScript Server interface
- [ ] Update ConfigurationEdit to show/edit tag field
- [ ] Optionally add image override field (advanced)
- [ ] Update any display components

### Phase 6: Testing & Deployment
- [ ] Test server creation with new schema
- [ ] Test rebuild with correct image reference
- [ ] Test configuration editing
- [ ] Deploy all components
- [ ] Verify fix on bonjour server

---

## Key Files to Modify

**Database:**
- `manager/migrations/0006_separate_image_tag.sql` (NEW)

**Manager:**
- `manager/src/routes/agents.ts` - Server CRUD operations
- `manager/src/types.ts` - Server interface (if exists)

**Agent:**
- `agent/main.go` - handleServerCreate, handleServerRebuild
- `agent/server.go` - CreateServer, RebuildServerWithConfig

**Frontend:**
- `frontend/src/types.ts` or inline interfaces
- `frontend/src/components/ConfigurationEdit.tsx`
- `frontend/src/components/ConfigurationDisplay.tsx`

---

## Success Criteria

- [ ] Rebuild bonjour server succeeds
- [ ] New servers created with separate image/tag fields
- [ ] Existing servers migrated correctly
- [ ] Configuration tab shows tag field
- [ ] No regressions in server operations

---

## Notes

- Origin: User suggestion during M9.8.30 (progress_m9830.md line 452)
- Bug discovered: 2026-01-14 during M9.8.31 testing
- Blocking: Cannot rebuild any server that was created before fix
