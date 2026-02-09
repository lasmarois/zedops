# Goal #16: Mobile-Friendly UI/UX

## Overview
Fix all mobile UI issues found during iPhone 14 (390x844) browser testing. The app has basic mobile support (hamburger sidebar, some responsive grids) but most pages have significant issues on phones.

## Phases

### Phase 1: Fix Horizontal Overflow (Critical) ✅
- [x] ServerDetail: Stack header title/actions vertically on mobile
- [x] ServerDetail: Replace segmented buttons with DropdownMenu on mobile
- [x] MainLayout: Add `overflow-x-hidden` safety net

### Phase 2: Fix Page Headers (All Pages) ✅
- [x] ServerList: Stack title + "Create Server" dropdown vertically on mobile
- [x] AgentDetail: Wrap header, move last seen below on mobile
- [x] Dashboard: Stack title + refresh button
- [x] UserList: Stack Back + title + "Invite User"
- [x] AuditLogViewer: Stack Back + title + "Show Filters"
- [x] AgentServerList: Stack title + layout toggle + "Create" button

### Phase 3: Tables → Mobile Card Views ✅
- [x] UserList: Table → cards on mobile (hidden md:block / md:hidden)
- [x] CompactAuditLog: Grid → stacked layout on mobile
- [x] AgentDetail: Storage table → cards on mobile

### Phase 4: Tabs Scroll Indicators + Filter Toolbars ✅
- [x] Add scrollbar-hide CSS utility to index.css
- [x] ServerDetail tabs: Add gradient fade indicator
- [x] AgentDetail tabs: Add gradient fade indicator
- [x] ServerList filter toolbar: Stack on mobile
- [x] AuditLogViewer pagination: Stack on mobile

### Phase 5: Global Padding & Typography ✅
- [x] All pages: p-8 → p-4 md:p-8
- [x] All pages: text-3xl → text-2xl md:text-3xl
- [x] All pages: space-y-8 → space-y-6 md:space-y-8, gap-6 → gap-4 md:gap-6

### Phase 6: Touch Targets & Dialog Polish ✅
- [x] UserList: min-h-[44px] on action buttons (in mobile cards)
- [x] AuditLogViewer: min-h-[44px] on pagination buttons
- [x] Dialog footers: Full-width buttons on mobile (ConfirmDialog)

### Phase 7: Build & Verify ✅
- [x] `npm run build` — no TypeScript errors
- [x] Update GOALS.md, archive planning files
- [x] Commit

## Files Modified
- `pages/ServerDetail.tsx`
- `pages/ServerList.tsx`
- `pages/AgentDetail.tsx`
- `pages/Dashboard.tsx`
- `pages/SettingsPage.tsx`
- `components/UserList.tsx`
- `components/AuditLogViewer.tsx`
- `components/ui/compact-audit-log.tsx`
- `components/AgentServerList.tsx`
- `components/layout/MainLayout.tsx`
- `index.css`
