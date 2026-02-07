# Container Health Visual Feedback - Task Plan

## Goal
Add visual feedback when containers are starting but not yet healthy, showing different colors/states for:
- **Starting** (container running, health check pending) → Yellow/Amber
- **Running/Healthy** (container running, health check passed) → Green
- **Unhealthy** (container running, health check failed) → Red/Orange

## Current State Analysis

### What We Have
- Agent collects: `State` (running/exited/etc), `Status` (human-readable string)
- Frontend StatusBadge: success (green), warning (orange), error (red), info (blue), muted (gray)
- Docker health states exist but NOT collected: `starting`, `healthy`, `unhealthy`, `none`

### What's Missing
- Agent doesn't collect Docker health check status
- Manager doesn't pass health status
- Frontend shows "Running" (green) regardless of health state

---

## Implementation Phases

### Phase 1: Agent - Collect Health Status
**Status:** `complete` ✅
**Files:** `agent/docker.go`

**Tasks:**
- [x] Update `ContainerInfo` struct to include `Health` field
- [x] Modify `ListContainers()` to extract health status from Docker API
- [x] Health values: `""` (no healthcheck), `"starting"`, `"healthy"`, `"unhealthy"`

**Docker API Reference:**
```go
// container.State.Health.Status contains health state
// Possible values: "starting", "healthy", "unhealthy"
// If nil, container has no health check
```

---

### Phase 2: Manager - Pass Health Through
**Status:** `complete` ✅ (No changes needed)
**Files:** `manager/src/durable-objects/AgentConnection.ts`

**Notes:**
- Manager already passes through all container fields as JSON
- Health field automatically included - no code changes needed

---

### Phase 3: Frontend - Update Types
**Status:** `complete` ✅
**Files:** `frontend/src/lib/api.ts`

**Tasks:**
- [x] Add `health?: string` to Container interface
- [x] Values: undefined (no healthcheck), "starting", "healthy", "unhealthy"

---

### Phase 4: Frontend - Visual Display
**Status:** `complete` ✅
**Files:**
- `frontend/src/components/AgentServerList.tsx`

**Tasks:**
- [x] Created `getContainerStatusDisplay()` function for health-aware display
- [x] Display states implemented:
  - `running` + health=`starting` → "Starting" (warning/amber)
  - `running` + health=`healthy` → "Running" (success/green)
  - `running` + health=`unhealthy` → "Unhealthy" (error/red)
  - `running` + health=undefined → "Running" (success/green, no health check)
- [x] Updated StatusBadge usage in AgentServerList

**Note:** ServerList.tsx uses Server objects from DB with `getDisplayStatus()` - that's separate from real-time container health. No changes needed there.

---

### Phase 5: Testing & Deploy
**Status:** `complete` ✅

**Tasks:**
- [x] Test with container that has health check (steam-zomboid image has one)
- [x] Verify "Starting" shows during container startup
- [x] Verify transitions: Starting → Running
- [x] Deploy to production

---

## Success Criteria
- [x] Container starting up shows "Starting" with yellow/amber badge
- [x] Container healthy shows "Running" with green badge
- [x] Container unhealthy shows "Unhealthy" with red badge
- [x] Smooth visual transition as container becomes healthy
- [x] No regression for containers without health checks

---

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
