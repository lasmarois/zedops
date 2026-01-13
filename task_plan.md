# Task Plan: M7.5 - UI Styling & Design System

**Goal:** Transform ZedOps UI with shadcn/ui and Tailwind CSS for a polished, professional appearance

**Duration:** 1-2 weeks (estimated)

**Success Criteria:**
- All pages use shadcn/ui components consistently
- Design tokens (colors, spacing, typography) applied across entire app
- Responsive layouts work on mobile, tablet, desktop
- Loading/error/empty states present everywhere
- UI feels polished and professional
- No custom CSS outside design system

**Status:** 🚀 Ready to Plan
**Started:** 2026-01-12

---

## Phase Overview

| Phase | Status | Description | Duration |
|-------|--------|-------------|----------|
| 0. Planning & Setup | ⏳ next | Install shadcn/ui, Tailwind, create design system | 2-3 hours |
| 1. Design System | ⏳ planned | Define colors, spacing, typography, themes | 2-3 hours |
| 2. Core Components | ⏳ planned | Replace custom components with shadcn | 4-6 hours |
| 3. Page Layouts | ⏳ planned | Implement responsive layouts for all pages | 4-6 hours |
| 4. State Variations | ⏳ planned | Add loading, error, empty states | 2-3 hours |
| 5. Polish & Refinement | ⏳ planned | Final touches, accessibility, dark mode | 3-4 hours |
| 6. Testing & Verification | ⏳ planned | Cross-browser, responsive, accessibility testing | 2-3 hours |

---

## Phase 0: Planning & Setup ⏳ Next

**Status:** ⏳ next

**Goals:**
- Analyze current frontend architecture
- Install shadcn/ui and Tailwind CSS
- Set up configuration files
- Create component inventory

### 0.1 Current State Analysis

**Analyze:**
- [ ] List all existing pages
- [ ] List all existing components
- [ ] Identify custom CSS usage
- [ ] Document current component patterns
- [ ] Take screenshots of current UI (for before/after comparison)

**Pages to Style:**
1. Login page (`/login`)
2. Registration page (`/register`)
3. Agent list page (`/`)
4. Container list page (`/agents/:id`)
5. Server creation form
6. Log viewer
7. RCON console
8. Audit logs viewer
9. User management page
10. Permissions management page

**Key Components:**
- AgentList (table)
- ContainerList (table)
- ServerForm (form with inputs)
- LogViewer (terminal-like)
- RconTerminal (xterm.js)
- AuditLogViewer (table with filters)
- UserList (table)
- PermissionsManager (form)

---

### 0.2 Install shadcn/ui & Tailwind CSS ✅

**Status:** ✅ complete

**Tasks:**
- [x] Navigate to frontend directory
- [x] Install Tailwind CSS v4 + PostCSS plugin
- [x] Install clsx + tailwind-merge for cn() utility
- [x] Configure shadcn/ui manually (components.json)
- [x] Update `tailwind.config.js` with shadcn theme tokens
- [x] Add Tailwind v4 import to index.css
- [x] Configure path aliases (@/ → src/)
- [x] Create lib/utils.ts with cn() function
- [x] Test build - PASSED ✅

**Files Created:**
- `frontend/tailwind.config.js` ✅
- `frontend/postcss.config.js` ✅
- `frontend/components.json` ✅
- `frontend/src/lib/utils.ts` ✅

**Files Modified:**
- `frontend/src/index.css` ✅
- `frontend/vite.config.ts` ✅
- `frontend/tsconfig.app.json` ✅

---

### 0.3 Initial shadcn Components

**Install Core Components:**
- [ ] `npx shadcn-ui@latest add button`
- [ ] `npx shadcn-ui@latest add input`
- [ ] `npx shadcn-ui@latest add label`
- [ ] `npx shadcn-ui@latest add card`
- [ ] `npx shadcn-ui@latest add table`
- [ ] `npx shadcn-ui@latest add badge`
- [ ] `npx shadcn-ui@latest add dialog`
- [ ] `npx shadcn-ui@latest add form`
- [ ] `npx shadcn-ui@latest add select`
- [ ] `npx shadcn-ui@latest add toast`

**Verification:**
- Components installed in `src/components/ui/`
- Can import and use components
- Tailwind classes work

---

## Phase 1: Design System ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Define color palette (primary, secondary, accent, neutrals)
- Define spacing scale
- Define typography scale
- Configure dark mode (optional)

### 1.1 Color Palette

**Define Colors:**
- [ ] Primary color (brand color for buttons, links)
- [ ] Secondary color (accent color)
- [ ] Success color (green for success states)
- [ ] Warning color (yellow/orange for warnings)
- [ ] Error color (red for errors)
- [ ] Neutral colors (grays for text, borders, backgrounds)

**Considerations:**
- Current Dracula theme in LogViewer (keep for terminal)
- RCON terminal colors (keep as-is)
- Agent/server status badges (green/yellow/red)

**Implementation:**
- [ ] Update `tailwind.config.js` with color tokens
- [ ] Test colors in a sample component
- [ ] Verify accessibility (contrast ratios)

---

### 1.2 Typography

**Define Type Scale:**
- [ ] Font families (sans-serif for UI, monospace for code/logs)
- [ ] Font sizes (xs, sm, base, lg, xl, 2xl, etc.)
- [ ] Font weights (normal, medium, semibold, bold)
- [ ] Line heights

**Implementation:**
- [ ] Configure in `tailwind.config.js`
- [ ] Create typography utilities if needed

---

### 1.3 Spacing & Layout

**Define Spacing Scale:**
- [ ] Use Tailwind default scale or customize
- [ ] Define container widths
- [ ] Define breakpoints (mobile, tablet, desktop)

---

## Phase 2: Core Components ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Replace custom buttons with shadcn Button
- Replace custom inputs with shadcn Input
- Replace custom tables with shadcn Table
- Replace custom cards with shadcn Card
- Replace custom badges with shadcn Badge

### 2.1 Button Component

**Current Usage:**
- Start/stop/restart buttons in ContainerList
- Delete/purge/restore buttons
- Form submit buttons (login, registration, server creation)
- Quick action buttons (RCON, logs)

**Tasks:**
- [ ] Find all `<button>` elements in codebase
- [ ] Replace with shadcn Button component
- [ ] Apply variants (default, destructive, outline, ghost)
- [ ] Apply sizes (default, sm, lg, icon)
- [ ] Test all button interactions

**Files to Modify:**
- `frontend/src/components/ContainerList.tsx`
- `frontend/src/components/ServerForm.tsx`
- `frontend/src/components/Login.tsx`
- `frontend/src/components/RconTerminal.tsx`
- (and others)

---

### 2.2 Input Component

**Current Usage:**
- Login form (email, password)
- Registration form
- Server creation form (all inputs)
- User management forms

**Tasks:**
- [ ] Find all `<input>` elements
- [ ] Replace with shadcn Input component
- [ ] Add proper labels (shadcn Label)
- [ ] Add validation states (error, success)
- [ ] Test form submissions

---

### 2.3 Table Component

**Current Usage:**
- AgentList (agents table)
- ContainerList (servers table)
- AuditLogViewer (audit logs table)
- UserList (users table)

**Tasks:**
- [ ] Replace custom table markup with shadcn Table
- [ ] Add sorting (if not present)
- [ ] Add pagination (if not present)
- [ ] Style table headers, rows, cells
- [ ] Test responsive behavior (mobile tables)

---

### 2.4 Card Component

**Usage:**
- Wrap sections in cards
- Agent cards (optional alternative to table)
- Server cards (optional)

**Tasks:**
- [ ] Identify sections that should be cards
- [ ] Wrap content in shadcn Card
- [ ] Use CardHeader, CardTitle, CardDescription, CardContent

---

### 2.5 Badge Component

**Current Usage:**
- Server status indicators (running, stopped, missing, deleted)
- Agent status (online, offline)
- Resource usage badges (CPU, memory, disk)
- Role badges (admin, operator, viewer)

**Tasks:**
- [ ] Replace custom badges with shadcn Badge
- [ ] Apply variants (default, secondary, destructive, outline)
- [ ] Match colors to current color-coding (green/yellow/red)

---

## Phase 3: Page Layouts ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Implement responsive layouts for all pages
- Consistent page structure
- Proper spacing and alignment

### 3.1 Layout Structure

**Define:**
- [ ] Page container (max-width, padding)
- [ ] Navigation (if any)
- [ ] Page header (title, actions)
- [ ] Page content (main area)
- [ ] Page footer (if any)

**Create Layout Components:**
- [ ] `PageContainer` - Wrapper for all pages
- [ ] `PageHeader` - Page title + action buttons
- [ ] `PageContent` - Main content area

---

### 3.2 Responsive Design

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Tasks:**
- [ ] Test all pages on mobile
- [ ] Test all pages on tablet
- [ ] Test all pages on desktop
- [ ] Fix layout issues
- [ ] Ensure tables are responsive (scroll on mobile)

---

### 3.3 Individual Pages

**Login Page:**
- [ ] Center login card on page
- [ ] Responsive form width
- [ ] shadcn components (Input, Button, Card)

**Agent List Page:**
- [ ] Page header with "Agents" title
- [ ] shadcn Table for agents
- [ ] Responsive design

**Container List Page:**
- [ ] Page header with agent name + "Back" button
- [ ] "Create Server" button
- [ ] shadcn Table for containers/servers
- [ ] Action buttons (start, stop, delete, etc.)

**Server Form:**
- [ ] Modal or dedicated page
- [ ] shadcn Form components
- [ ] Validation states
- [ ] Submit/cancel buttons

**Log Viewer:**
- [ ] Keep terminal-like appearance (Dracula theme)
- [ ] shadcn Card wrapper
- [ ] Control buttons (pause, clear, auto-scroll)

**RCON Console:**
- [ ] Keep xterm.js terminal
- [ ] shadcn Card wrapper
- [ ] Quick action buttons (shadcn)

**Audit Log Viewer:**
- [ ] shadcn Table
- [ ] Filter controls (shadcn Select, Input)
- [ ] Pagination

**User Management:**
- [ ] shadcn Table for users
- [ ] Add user button (Dialog)
- [ ] User invitation flow

**Permissions Manager:**
- [ ] shadcn Form
- [ ] Role selector (Select)
- [ ] Resource selector (Select)
- [ ] Grant/revoke buttons

---

## Phase 4: State Variations ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Add loading states (skeletons, spinners)
- Add error states (inline errors, toasts)
- Add empty states (no data messages)

### 4.1 Loading States

**Add Skeletons:**
- [ ] Agent list loading (skeleton table rows)
- [ ] Container list loading
- [ ] User list loading
- [ ] Audit log loading

**Add Spinners:**
- [ ] Button loading states (during API calls)
- [ ] Page loading states

**Install:**
- [ ] `npx shadcn-ui@latest add skeleton`
- [ ] `npx shadcn-ui@latest add spinner` (if available)

---

### 4.2 Error States

**Add Error Handling:**
- [ ] Form validation errors (inline under inputs)
- [ ] API error messages (toast notifications)
- [ ] Network error states (retry buttons)

**Install:**
- [ ] `npx shadcn-ui@latest add alert`
- [ ] `npx shadcn-ui@latest add toast` (already installed)

---

### 4.3 Empty States

**Add Empty State Messages:**
- [ ] No agents (empty agent list)
- [ ] No servers (empty container list)
- [ ] No users (empty user list)
- [ ] No audit logs (empty audit log)
- [ ] No role assignments (empty permissions)

**Design:**
- Icon + message + optional CTA button
- Example: "No servers yet. Create your first server to get started."

---

## Phase 5: Polish & Refinement ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Final visual polish
- Accessibility improvements
- Dark mode (optional)
- Animation/transitions

### 5.1 Visual Polish

**Tasks:**
- [ ] Consistent spacing throughout
- [ ] Consistent border radius
- [ ] Consistent shadows
- [ ] Hover states on interactive elements
- [ ] Focus states (keyboard navigation)

---

### 5.2 Accessibility

**Tasks:**
- [ ] All buttons have proper ARIA labels
- [ ] All form inputs have labels
- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Color contrast meets WCAG AA standards

---

### 5.3 Dark Mode (Optional)

**If Implementing:**
- [ ] Configure Tailwind dark mode
- [ ] Define dark color palette
- [ ] Add dark mode toggle
- [ ] Test all components in dark mode

---

### 5.4 Animations/Transitions

**Add Subtle Animations:**
- [ ] Page transitions (fade in)
- [ ] Modal/dialog animations
- [ ] Button hover animations
- [ ] Loading animations

---

## Phase 6: Testing & Verification ⏳ Planned

**Status:** ⏳ planned

**Goals:**
- Cross-browser testing
- Responsive testing
- Performance testing
- Accessibility testing

### 6.1 Cross-Browser Testing

**Test In:**
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

### 6.2 Responsive Testing

**Test All Pages:**
- [ ] Mobile (375px, 414px)
- [ ] Tablet (768px, 1024px)
- [ ] Desktop (1280px, 1920px)

---

### 6.3 Performance Testing

**Check:**
- [ ] Bundle size (ensure not too large)
- [ ] Page load times
- [ ] Runtime performance (no jank)

---

### 6.4 Accessibility Testing

**Tools:**
- [ ] Lighthouse accessibility score
- [ ] axe DevTools
- [ ] Manual keyboard navigation testing
- [ ] Screen reader testing (optional)

---

## Success Criteria Checklist

Before marking M7.5 complete, verify:

- [ ] **All pages use shadcn components** (no custom buttons, inputs, tables)
- [ ] **Design tokens applied** (colors, spacing, typography consistent)
- [ ] **Responsive layouts work** (mobile, tablet, desktop)
- [ ] **Loading states present** (skeletons for tables, spinners for buttons)
- [ ] **Error states present** (form validation, API errors, toast notifications)
- [ ] **Empty states present** (no data messages for all lists)
- [ ] **UI feels polished** (consistent spacing, shadows, borders, hover states)
- [ ] **No custom CSS outside design system** (all styling via Tailwind/shadcn)
- [ ] **Accessibility improved** (ARIA labels, keyboard nav, color contrast)
- [ ] **Cross-browser compatible** (Chrome, Firefox, Safari, Edge)

---

## Files to Create

**New:**
- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`
- `frontend/components.json` (shadcn config)
- `frontend/src/components/ui/*` (shadcn components)
- `frontend/src/components/layout/PageContainer.tsx` (optional)
- `frontend/src/components/layout/PageHeader.tsx` (optional)

---

## Files to Modify

**Major Updates:**
- `frontend/src/components/AgentList.tsx`
- `frontend/src/components/ContainerList.tsx`
- `frontend/src/components/ServerForm.tsx`
- `frontend/src/components/Login.tsx`
- `frontend/src/components/Register.tsx`
- `frontend/src/components/LogViewer.tsx`
- `frontend/src/components/RconTerminal.tsx`
- `frontend/src/components/AuditLogViewer.tsx`
- `frontend/src/components/UserList.tsx`
- `frontend/src/components/PermissionsManager.tsx`
- `frontend/src/index.css` (Tailwind directives)
- `frontend/package.json` (new dependencies)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing functionality | Medium | High | Test thoroughly after each component replacement |
| Large bundle size increase | Medium | Medium | Use tree-shaking, lazy loading |
| Responsive layout issues | High | Medium | Test on multiple devices early |
| Accessibility regressions | Low | Medium | Use automated testing (Lighthouse, axe) |
| Design consistency issues | Medium | Low | Define design tokens upfront |

---

## Rollback Plan

If critical issues found during implementation:

1. **Component-by-component rollback**: Git revert specific component changes
2. **Keep shadcn installed**: Only revert problematic components, keep infrastructure
3. **Gradual rollout**: Start with low-risk pages (login, agent list) before high-risk (RCON, logs)

**Git Strategy:**
- Commit after each phase completes successfully
- Use feature branch: `git checkout -b feature/ui-styling-m7.5`
- Can cherry-pick successful commits if needed

---

## Notes

- LogViewer and RconTerminal should keep their terminal-like appearance (Dracula theme, xterm.js)
- Focus on consistency and polish over adding new features
- Use shadcn defaults where possible (don't over-customize)
- Keep performance in mind (bundle size, runtime performance)
- This is purely a styling/UX milestone - no new features or functionality
