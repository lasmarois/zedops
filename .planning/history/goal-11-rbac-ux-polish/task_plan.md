# Goal #11: RBAC UX Polish & Remaining Gaps

Parent: M15 (User Management, RBAC & Permissions Review)

## Context

M15 fixed critical bugs and cleaned up legacy code, but testing revealed UX gaps for non-admin users. This goal addresses every remaining item from the M15 post-mortem audit.

---

## Phase 1: Non-Admin Empty State & Guidance

**Problem:** A non-admin user with no role assignments sees empty pages with zero guidance. After accepting an invitation, they land on a dashboard showing nothing.

### 1.1 Add "no access" empty state to Dashboard
- **File:** `frontend/src/pages/Dashboard.tsx`
- When user is non-admin AND has 0 visible servers, show a friendly card:
  "You don't have access to any servers yet. Contact your administrator to get access."
- Still show the dashboard layout (sidebar, header) — just replace stats cards with this message.

### 1.2 Add "no access" empty state to Server List
- **File:** `frontend/src/pages/ServerList.tsx`
- When server list returns 0 results for a non-admin, show guidance instead of empty table.

### 1.3 Add "no access" empty state to Agents page
- **File:** `frontend/src/pages/AgentsPage.tsx`
- Non-admin users can see the agents page but may not have meaningful data. Consider showing a filtered view or guidance.

**Testing:** Login as non-admin with no assignments, verify guidance shows.

- [x] 1.1 Dashboard empty state
- [x] 1.2 Server list empty state
- [x] 1.3 Agents page handling

---

## Phase 2: Frontend Route Protection

**Problem:** Non-admins can type `/users` or `/audit-logs` in the URL bar. Backend correctly returns 403, but frontend shows an ugly error or blank page.

### 2.1 Add frontend route guard for admin-only pages
- **Files:** `frontend/src/App.tsx`, possibly a new `AdminRoute` wrapper component
- Wrap `/users` and `/audit-logs` routes with an admin check
- Non-admins hitting these routes get redirected to `/dashboard`
- Keep it simple — just check `user.role === 'admin'` in a wrapper

**Testing:** Login as non-admin, navigate to /users and /audit-logs by URL, verify redirect.

- [x] 2.1 Admin route guard

---

## Phase 3: Untested M15 Features — Verify & Fix

**Problem:** Several M15 features were implemented but not fully end-to-end tested.

### 3.1 Test non-admin sidebar
- Login as a non-admin user (create one if needed via invitation)
- Verify Management section is hidden
- Verify "Member" badge shows in user role display
- Fix any issues found

### 3.2 Test password change end-to-end
- Change password via the dialog
- Log out
- Log in with new password
- Verify it works, then change back

### 3.3 Test invitation with non-admin role
- Create an invitation with "operator" role
- Accept the invitation (register)
- Verify user created with role=null (system role)
- Verify instructions say "contact admin for access"
- Login as new user, verify empty state shows

**Testing:** All manual browser testing.

- [ ] 3.1 Non-admin sidebar verified
- [ ] 3.2 Password change end-to-end
- [ ] 3.3 Invitation flow with operator role

---

## Phase 4: Broaden Role-Based Endpoint Access

**Problem:** Some endpoints are admin-only but should allow role-based access for practical use.

### 4.1 Backup endpoints — allow operators
- **Files:** `manager/src/routes/agents.ts` (backup endpoints)
- Currently: all backup endpoints require `user.role === 'admin'`
- Change to: `canControlServer()` for create/list/delete/restore backups
- An operator who can start/stop a server should be able to back it up

### 4.2 check-data endpoint — allow agent-admin
- **File:** `manager/src/routes/agents.ts`
- Currently: admin only
- Change to: `canViewServer()` (anyone who can view the server can check data existence)

### 4.3 ports/availability — allow agent-admin
- **File:** `manager/src/routes/agents.ts`
- Currently: admin only
- Change to: `canCreateServer()` (agent-admins who can create servers need port info)

**Testing:** API calls as non-admin with appropriate role assignments.

- [x] 4.1 Backup endpoints role-based (already done — all 5 backup endpoints use canControlServer/canViewServer)
- [x] 4.2 check-data allows viewers (added canViewServer check)
- [x] 4.3 ports/availability allows agent-admin (changed to canCreateServer)

---

## Phase 5: Build & Deploy

- [x] Frontend builds with zero errors
- [x] Manager builds with wrangler dry-run
- [ ] Deploy to dev, test as admin and non-admin
- [ ] Deploy to prod

---

## Summary

| Phase | Items | Estimated |
|-------|-------|-----------|
| 1: Empty states | 3 | 1-2 hours |
| 2: Route protection | 1 | 30 min |
| 3: Verify M15 features | 3 | 1-2 hours |
| 4: Broaden endpoint access | 3 | 1-2 hours |
| 5: Build & deploy | 1 | 30 min |
| **Total** | **11** | **4-7 hours** |
