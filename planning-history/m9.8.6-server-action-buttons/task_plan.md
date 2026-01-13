# Task Plan: M9.8.6 - Fix Server Action Buttons

**Goal:** Fix non-functional action buttons in ServerDetail page

**Status:** COMPLETE

**Started:** 2026-01-13 15:00
**Completed:** 2026-01-13 15:10

---

## Objective

Fix non-functional action buttons in ServerDetail page

## Tasks

- [x] Add imports for mutation hooks (useStartServer, useStopServer, etc.)
- [x] Initialize mutation hooks in component
- [x] Create handler functions with validation
- [x] Wire up onClick handlers to top buttons (Start, Stop, Restart, Rebuild, Delete)
- [x] Wire up onClick handlers to bottom quick actions
- [x] Add loading states and confirmation dialogs
- [x] Build and deploy frontend
- [x] User testing and confirmation

## Result

All 7 critical server action buttons now functional

## Files Modified

- `frontend/src/pages/ServerDetail.tsx` - Added mutation hooks and handler functions
- `frontend/src/hooks/useServers.ts` - Read only (verified hooks exist)
- `frontend/src/hooks/useContainers.ts` - Read only (verified hooks exist)
