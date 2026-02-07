# M9.8.39 - Audit Logs Revamp

## Goal
Redesign audit logs from vertical timeline to compact horizontal log lines for better scannability.

## New Design
```
[icon] action string | actor | [icon] item string | time ago | details >
```
- Action icon + text: Same color (based on action type)
- Item icon + text: Same color (based on item type)
- Lucide icons for both action and item types
- Inline expand for details (keep current behavior)

## Phases

### Phase 1: Design Icon Mappings `complete`
- Map action types to Lucide icons (play, square, user-plus, trash, etc.)
- Map item types to Lucide icons (server, user, shield, etc.)
- Define color scheme (reuse existing action colors)

### Phase 2: Create CompactAuditLog Component `complete`
- New component: `compact-audit-log.tsx`
- Single row per log entry
- Hover states for interactivity
- Expandable details section

### Phase 3: Update AuditLogViewer `complete`
- Replace ActivityTimeline with CompactAuditLog
- Keep existing filters and pagination
- Update loading skeleton to match new layout

### Phase 4: Test & Polish `complete`
- Verify all action types display correctly
- Check responsive behavior
- Deploy and verify

## Files to Modify
- `frontend/src/components/ui/compact-audit-log.tsx` (new)
- `frontend/src/components/AuditLogViewer.tsx`
- `frontend/src/lib/audit-colors.ts` (add icon mappings)

## Decisions
- Keep existing color scheme from `audit-colors.ts`
- Reuse inline expand pattern from current ActivityTimeline
