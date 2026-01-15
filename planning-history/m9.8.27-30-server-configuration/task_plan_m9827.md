# Task Plan: M9.8.27 - Configuration Tab: Display Current Settings

**Goal:** Populate Configuration tab with read-only display of all current server settings
**Priority:** HIGH (Foundation for M9.8.28 editing)
**Started:** 2026-01-14

---

## Implementation Phases

### Phase 1: Investigation ⏳ PENDING

**Tasks:**
1. Check current ServerDetail data structure
2. Parse config JSON blob structure (ServerConfig type)
3. Identify all fields available in config
4. Check what's in database vs what's in config JSON
5. Document field mapping

**Questions:**
- What fields are in the config JSON?
- What fields are at the server table level (ports, image_tag, server_data_path)?
- Are there fields that exist but aren't populated?

---

### Phase 2: Component Design ⏳ PENDING

**Tasks:**
1. Create ConfigurationDisplay component structure
2. Design sections:
   - Server Identity (name, public name, description)
   - Network (ports - immutable badges)
   - Gameplay (map, max players, PvP, pause empty, global chat)
   - Access Control (passwords - masked)
   - Mods (mod list, workshop IDs)
   - Advanced (image tag, beta branch, data path, timezone, PUID)
3. Design immutable field indicators (lock icon + tooltip)
4. Design empty/not-set field display

---

### Phase 3: Implementation ⏳ PENDING

**Tasks:**
1. Create ConfigurationDisplay.tsx component
2. Parse config JSON in ServerDetail
3. Pass parsed config to display component
4. Render all sections with proper formatting
5. Add lock icons to immutable fields
6. Add "Edit Configuration" button (disabled for now)

**Files:**
- `frontend/src/components/ConfigurationDisplay.tsx` (NEW)
- `frontend/src/pages/ServerDetail.tsx` (MODIFY - Configuration tab)

---

### Phase 4: Build & Deploy ⏳ PENDING

**Tasks:**
1. Build frontend
2. Update asset hash in manager
3. Deploy to Cloudflare Workers
4. Test display with various server configs

---

## Success Criteria

- [ ] Configuration tab shows all current settings
- [ ] Settings organized into logical sections
- [ ] Immutable fields clearly marked
- [ ] Empty/not-set fields handled gracefully
- [ ] Passwords masked appropriately
- [ ] "Edit Configuration" button present (disabled)
- [ ] Clean, professional UI layout
