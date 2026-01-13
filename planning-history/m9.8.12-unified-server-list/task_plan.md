# Task Plan: M9.8.12 - Unified Container/Server List

**Goal:** Unify container and server lists into single view with clear managed/unmanaged distinction

**Status:** COMPLETE

**Priority:** HIGH

**Started:** 2026-01-13 17:05
**Completed:** 2026-01-13 17:30

---

## Objective

Unify container and server lists into single view with clear managed/unmanaged distinction

**User Request:** "I think I like option 2" (unified view with managed/unmanaged badges)

## Requirements

- [x] Single "Zomboid Servers" section combining all containers and servers
- [x] Badge terminology: Managed vs Unmanaged
- [x] Sort managed servers first, then unmanaged containers
- [x] Separate "Issues & Recovery" section (collapsible) for missing/deleted servers
- [x] Different actions based on type (managed = full controls, unmanaged = basic only)
- [x] Better badge visual distinction (Option 3: solid vs outline with contrast)
- [x] Hover feedback for clickable cards (managed servers only)

## Implementation

1. Created unified data structure combining containers and servers
2. Added getUnifiedList() function sorting managed first, unmanaged second
3. Separated normal items vs issues (missing/deleted)
4. Replaced dual sections with single "Zomboid Servers" list
5. Added collapsible "Issues & Recovery" section with badge count
6. Badge styling: Managed (bg-primary/10 filled) vs Unmanaged (border-2 outlined)
7. Hover feedback: Managed cards get cursor-pointer, shadow-lg, bg-accent/5, scale-[1.01]

## Card Actions

- **Managed servers:** Start, Stop, Restart, RCON, Rebuild, Delete Server
- **Unmanaged containers:** Start, Stop, Restart, View Logs (no RCON, no Rebuild, no Delete Server)

## Visual Improvements

- Stats line: "Total: X servers (Y managed, Z unmanaged)"
- Managed badge: Subtle primary color fill with matching border
- Unmanaged badge: Bold 2px outline with muted text
- Clickable cards: Cursor pointer + lift effect on hover
- Non-clickable cards: Regular cursor, basic shadow

## Tasks

- [x] Create unified data structure
- [x] Add Managed/Unmanaged badge logic
- [x] Sort managed first, unmanaged second
- [x] Replace main section with unified list
- [x] Create collapsible "Issues & Recovery" section
- [x] Adjust actions based on managed vs unmanaged type
- [x] Improve badge visual distinction (Option 3)
- [x] Add hover feedback for clickable cards
- [x] Build and deploy (Version: bd4eed41-76ad-41d0-a6d4-95ac2b7a5de0)
- [x] User testing and confirmation

## Result

Clean unified view with clear distinction between managed/unmanaged, proper hover feedback

**User Feedback:** "good this is perfect! completed!" ✓

## Key Decisions

1. **Unified view approach:** Option 2 chosen - single list with Managed/Unmanaged badges instead of separate sections
2. **Badge styling:** Option 3 chosen - solid primary fill for Managed, bold outline for Unmanaged for better visual distinction
3. **Hover feedback:** Only managed servers get clickable indicators (pointer cursor, lift effect) since unmanaged containers aren't clickable

## Files Modified

- `frontend/src/components/AgentServerList.tsx` - Created unified view, added getUnifiedList() function, separated issues section, improved badges and hover states
- `manager/src/index.ts` - Updated asset filenames (index-DdfgkZV3.js, index-DkkO4Rlb.css)
