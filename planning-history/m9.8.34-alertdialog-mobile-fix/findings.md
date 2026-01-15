# M9.8.34 Findings - AlertDialog Implementation

## Problem Discovery
- Native `confirm()` works on desktop browsers but fails on mobile
- Mobile browsers often block or suppress native dialogs
- Discovered during M9.8.33 testing when delete buttons didn't work on mobile

## Locations Using confirm()

### Confirmed Locations:
1. `frontend/src/components/AgentServerList.tsx:366` - handleDeleteServer()
2. `frontend/src/pages/ServerDetail.tsx:112` - handleDelete()

### To Audit:
- Search for other `confirm(` calls in codebase

## shadcn/ui AlertDialog
- Part of shadcn/ui component library
- Uses Radix UI primitives
- Mobile-friendly
- Can be styled to match app theme

## Design Decisions
- Create reusable `ConfirmDialog` wrapper component
- Support destructive variant for delete actions
- Keep API simple: open state + onConfirm callback
