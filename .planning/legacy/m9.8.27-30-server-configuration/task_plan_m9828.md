# Task Plan: M9.8.28 - Configuration Editing

**Goal:** Enable editing of all mutable server settings with two-step Save → Apply workflow
**Priority:** HIGH (Core Feature)
**Started:** 2026-01-14
**Completed:** 2026-01-14
**Status:** ✅ COMPLETE

---

## Overview

Allow users to modify server configuration post-creation with clear two-step workflow:
1. **Save Changes** - Update config in database (no server impact)
2. **Apply Changes** - Restart container with new config (with impact warning)

This enables changing ENV variables, image tag, and data path (data path migration is M9.8.29).

---

## Implementation Phases

### Phase 1: Investigation ✅ COMPLETE

**Goals:**
1. Understand current config structure in database
2. Identify which fields need validation
3. Design API contracts for PATCH and POST endpoints
4. Plan frontend component structure

**Files to Review:**
- `manager/src/routes/agents.ts` - Existing server endpoints
- `frontend/src/components/ConfigurationDisplay.tsx` - Current display
- `frontend/src/components/ServerForm.tsx` - Creation form (reference)

---

### Phase 2: Backend Implementation ✅ COMPLETE

**Tasks:**

1. **PATCH /api/agents/:id/servers/:serverId/config**
   - Validate: Immutable fields cannot change (name, ports, map)
   - Update: `config` JSON blob in database
   - Update: `image_tag`, `server_data_path` (metadata fields)
   - Return: Success + flags (pendingRestart, dataPathChanged)

2. **POST /api/agents/:id/servers/:serverId/apply-config**
   - Check: Server status (must be running or stopped)
   - Stop: Container (if running)
   - Update: Container ENV variables (recreate container)
   - Start: Container with new config
   - Return: Success/error

**Special Cases:**
- Data path change: Defer to M9.8.29 (just update DB for now)
- Image tag change: Only affects next rebuild (no immediate action)

---

### Phase 3: Frontend Edit Component ✅ COMPLETE

**Tasks:**

1. **Create ConfigurationEdit.tsx**
   - Form with sections matching ConfigurationDisplay
   - Input types: text, number, checkbox, select
   - Validation: Client-side + server-side errors
   - Disable immutable fields (grayed out with tooltip)

2. **Edit Mode Integration in ServerDetail.tsx**
   - Toggle: Display mode ↔ Edit mode
   - Buttons: "Edit" → "Save Changes" / "Cancel"

3. **Two-Step Flow:**
   ```
   Display Mode → Click "Edit"
   ↓
   Edit Mode → Modify fields → Click "Save Changes"
   ↓
   PATCH request → Success banner
   ↓
   Show "Apply Changes" button with warning
   ↓
   Click "Apply Changes" → Confirmation dialog
   ↓
   POST request → Progress indicator → Success/Error
   ```

---

### Phase 4: Testing & Validation ✅ COMPLETE

**Test Cases:**
1. Save valid config changes (all fields)
2. Try to modify immutable fields (should reject)
3. Apply changes (restart container)
4. Verify container has new ENV variables
5. Cancel edit (discard changes)
6. Handle errors gracefully (validation, network, agent offline)

---

### Phase 5: Build & Deploy ✅ COMPLETE

**Tasks:**
1. Build frontend
2. Update asset hash
3. Deploy to Cloudflare Workers
4. Test in production

---

## Key Decisions

### Two-Step Workflow
**Why:** Prevents accidental restarts. User can review changes before applying.

**Flow:**
- Step 1 (Save): Fast, non-destructive, updates DB only
- Step 2 (Apply): Slow, destructive, requires confirmation

### Data Path Migration
**Scope:** M9.8.28 allows changing data path in DB, but actual migration is M9.8.29
**Reason:** Migration is complex (progress tracking, error handling)

### Immutable Fields
**Behavior:** Disabled in edit mode (not hidden, shows with lock icon)
**Reason:** User sees what cannot be changed and why

---

## Success Criteria

- [x] PATCH endpoint updates config in database
- [x] POST endpoint restarts container with new config
- [x] Frontend shows edit form with all mutable fields
- [x] Immutable fields are disabled with explanation
- [x] Two-step flow works (Save → Apply)
- [x] Impact warnings are clear ("restart required")
- [x] Validation errors are shown inline
- [x] Changes are applied successfully
- [x] Container has new ENV variables after apply
- [x] No data loss during restart

---

## Files to Create/Modify

**Backend:**
- `manager/src/routes/agents.ts` (add PATCH + POST endpoints)

**Frontend:**
- `frontend/src/components/ConfigurationEdit.tsx` (NEW - edit form)
- `frontend/src/components/ConfigurationDisplay.tsx` (add edit button handler)
- `frontend/src/pages/ServerDetail.tsx` (edit mode state)
- `frontend/src/lib/api.ts` (add API functions)
- `frontend/src/hooks/useServers.ts` (add mutation hooks)

---

## Estimated Time

**Total:** 3-4 hours

- Phase 1: Investigation - 30 min
- Phase 2: Backend - 1 hour
- Phase 3: Frontend - 1.5 hours
- Phase 4: Testing - 30 min
- Phase 5: Build & Deploy - 30 min
