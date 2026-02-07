# M9.8.34 - AlertDialog Mobile Fix

## Completed: 2026-01-15

## Summary
Replaced native `confirm()` dialogs with shadcn AlertDialog components throughout the application to fix mobile browser compatibility issues.

## Problem
Native `confirm()` dialogs don't work properly on mobile browsers, causing delete/rebuild/purge buttons to fail silently.

## Solution
Created a reusable `ConfirmDialog` component and replaced all `confirm()` calls with proper AlertDialog modals.

## Changes Made

### New Components
- `frontend/src/components/ui/alert-dialog.tsx` - Base AlertDialog from shadcn
- `frontend/src/components/ui/confirm-dialog.tsx` - Reusable confirmation wrapper

### Updated Files
1. **AgentServerList.tsx**
   - Delete server confirmation
   - Rebuild server confirmation
   - Purge server confirmation (slick design with stacked buttons)
   - Changed dropdown `onClick` to `onSelect` for mobile compatibility
   - Fixed Issues & Recovery section to always show deleted servers

2. **ServerDetail.tsx**
   - Delete server confirmation
   - Rebuild server confirmation

3. **ServerList.tsx (All Servers page)**
   - Purge server confirmation (same slick design)
   - Restore server confirmation

### Key Fixes
- **Race condition fix**: Capture state values at start of async handlers before dialog closes
- **Dropdown mobile fix**: Use `onSelect` instead of `onClick` for DropdownMenuItem
- **Dialog close timing**: Close dialog immediately, then execute async operation

## Design
The purge modal features a slick centered design with:
- Trash icon in red circle at top
- Two full-width stacked option buttons with descriptions
- "Keep server data on disk" (outline) - preserves saves & configs
- "Delete everything" (red) - removes record AND data
- Ghost cancel button at bottom

## Files in this Archive
- COMPLETE.md (this file)
