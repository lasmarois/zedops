# Goal #11: Progress

## Session 1 — 2026-02-07

### Created
- Goal #11 registered in GOALS.md
- Planning files created (task_plan.md, findings.md, progress.md)
- 11 items across 5 phases identified from M15 post-mortem

### Context
This goal was created from the honest testing assessment after M15 deployment.
M15 fixed the critical bugs (P0 metrics, audit security, legacy cleanup) but
testing was only performed as admin. The gaps are all UX/polish for non-admin
users and broadening some overly-restrictive admin-only endpoints.

### Risk Assessment
- No security issues — all gaps are UX-side or overly-restrictive (not under-restrictive)
- Non-admin users currently see empty pages but cannot access anything they shouldn't
- All admin-only endpoints are correctly protected; we're just loosening some to match intended roles

## Session 2 — 2026-02-07

### Completed
- **Phase 1** — Non-admin empty states added to Dashboard, ServerList, AgentList
  - Dashboard: Shows "No servers assigned" card for non-admins with 0 servers; hides Users card, Recent Activity, admin Quick Actions
  - ServerList: Shows "No servers assigned" instead of "Create your first server" for non-admins
  - AgentList: Shows "No agents assigned" instead of "No agents registered"; hides "Add Agent" button
  - Fixed: `useUsers` and `useAuditLogs` hooks now only fire for admins (prevents 403 errors)
- **Phase 2** — Admin route guard added
  - `AdminRoute` wrapper in App.tsx redirects non-admins from `/users` and `/audit-logs` to `/dashboard`
- **Phase 4** — Endpoint permissions fixed
  - Finding: All 5 backup endpoints were ALREADY role-based (canControlServer/canViewServer) — no changes needed
  - check-data: Added missing `canViewServer` permission check
  - ports/availability: Changed from `user.role !== 'admin'` to `canCreateServer`
- **Phase 5** — Both frontend and manager build clean
