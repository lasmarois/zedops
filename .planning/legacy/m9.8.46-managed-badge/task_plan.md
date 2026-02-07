# Task: M9.8.46 - Restore Managed Badge on Server Cards

## Goal
Ensure the "Managed" badge is visible on server cards in all layouts, alongside the player count display.

## Current State Analysis

### ServerCard.tsx Layouts

**Expandable Layout** (lines 364-429):
- ✅ Shows "Managed" badge (lines 385-393)
- ✅ Shows player count in info line (lines 398-400)
- Working correctly

**Compact Layout** (lines 431-471):
- ❌ Does NOT show "Managed" badge
- ✅ Shows player count in info line (lines 452-454)
- Missing the badge!

### Where Badge Should Appear
Both layouts should show "Managed" or "Unmanaged" badge next to the server name.

## Phases

### Phase 1: Add Managed Badge to Compact Layout
**Status:** `complete`
- [x] Add Managed/Unmanaged badge after server name in compact layout
- [x] Match styling from expandable layout
- [x] Ensure badge doesn't break responsive layout (added shrink-0)

### Phase 2: Build & Deploy
**Status:** `complete`
- [x] Build frontend
- [x] Update asset hash in index.ts
- [x] Deploy to Cloudflare

### Phase 3: Update Milestone Tracker
**Status:** `complete`
- [x] Update MILESTONE-M98.md to mark this as complete
- [x] Archive planning files

## Files to Modify
- `frontend/src/components/ServerCard.tsx` - Add badge to compact layout

## Implementation Notes

### Expandable Layout Badge (reference)
```tsx
{isManaged ? (
  <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
    Managed
  </Badge>
) : (
  <Badge variant="outline" className="text-xs border-2 text-muted-foreground">
    Unmanaged
  </Badge>
)}
```

### Compact Layout - Target Location
After `<span className="font-semibold truncate">{server.name}</span>` on line 448

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
