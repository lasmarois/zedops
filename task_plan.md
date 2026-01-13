# Task Plan: Milestone 8 - Visual Redesign (Design Phase)

**Goal:** Design comprehensive visual redesign and modern template for ZedOps UI

**Duration:** 1-2 weeks estimated

**Date Started:** 2026-01-12

---

## Overview

After completing foundational UI styling with shadcn/ui (M7.5), design a **professional hypervisor-style UI** that elevates ZedOps to infrastructure management tool quality (Proxmox VE, vSphere, Portainer). This is a **design-focused milestone** - no code implementation, only design artifacts and specifications.

**Vision:** Professional, scalable infrastructure management UI with:
- Hypervisor-style resource detail pages (tabs, previews, quick actions)
- Historical metrics with graphs (24-48h retention)
- Collapsible preview panels for logs/RCON
- Future-proof design for unimplemented features (server.ini editor, ENV editor, backups)
- Beautiful shadcn/ui powered interface

**Current State:**
- ✅ All 10 pages styled with shadcn/ui + Tailwind CSS
- ✅ Consistent spacing, typography, colors (semantic variants)
- ✅ WCAG AA accessible (11.5:1 text contrast)
- ✅ Responsive layouts (mobile/tablet/desktop)
- ✅ Loading/error/empty states implemented
- ✅ Basic metrics displayed (current values only)

**Target State:**
- Complete specifications for all pages (text-based with diagrams)
- Hypervisor-style server/agent detail pages designed
- Tab-based organization specified
- Collapsible preview panels designed
- Historical metrics graphs specified (future implementation)
- Future features designed (server.ini editor, ENV editor)
- Implementation roadmap for M9 and beyond

---

## Phases

### Phase 0: Research & Discovery (⏳ pending)
**Goal:** Understand current UI, gather inspiration, define design goals

**Tasks:**
- [ ] Audit current UI (screenshot all 10 pages)
- [ ] Identify pain points and improvement opportunities
- [ ] Research modern dashboard/admin panel designs
- [ ] Gather design inspiration (Dribbble, Behance, real products)
- [ ] Define design principles and goals
- [ ] Choose design tools (Figma/Sketch/Penpot)

**Deliverable:** Research findings document with screenshots and inspiration references

---

### Phase 1: Visual Design System (⏳ pending)
**Goal:** Define comprehensive design system

**Tasks:**
- [ ] Color Palette
  - [ ] Refine primary/secondary colors (beyond current Bootstrap)
  - [ ] Define semantic colors (success, warning, error, info)
  - [ ] Dark theme color refinements
  - [ ] Color accessibility verification (WCAG AA)
- [ ] Typography
  - [ ] Font family selection (body, headings, monospace)
  - [ ] Type scale (h1-h6, body, small, etc.)
  - [ ] Line heights and letter spacing
  - [ ] Font weights and styles
- [ ] Iconography
  - [ ] Icon library selection (Lucide/Heroicons/custom)
  - [ ] Icon sizing system
  - [ ] Icon usage guidelines
- [ ] Spacing & Layout
  - [ ] Grid system specification
  - [ ] Spacing scale (4px, 8px, 12px, 16px, etc.)
  - [ ] Container widths and breakpoints
  - [ ] Padding/margin standards
- [ ] Component Specifications
  - [ ] Button variants and states
  - [ ] Form input styles
  - [ ] Card/container styles
  - [ ] Table styles
  - [ ] Badge/chip styles
  - [ ] Modal/dialog styles
  - [ ] Navigation elements

**Deliverable:** Design system specification document + visual style guide

---

### Phase 2: Navigation & Layout Structure (⏳ pending)
**Goal:** Design primary navigation and page layout templates

**Tasks:**
- [ ] Navigation Structure
  - [ ] Evaluate options: sidebar, header, hybrid, collapsible
  - [ ] Design navigation states (collapsed, expanded, mobile)
  - [ ] Define navigation hierarchy (primary, secondary)
  - [ ] Design user menu and profile section
  - [ ] Design breadcrumb navigation (if needed)
- [ ] Page Template
  - [ ] Header design (branding, search, notifications, user menu)
  - [ ] Content area layout (main + optional sidebars)
  - [ ] Footer design (if needed)
  - [ ] Mobile navigation pattern (drawer, bottom nav, etc.)
- [ ] Dashboard/Home Page
  - [ ] Design dashboard layout (cards, widgets, overview)
  - [ ] Define key metrics and visualizations
  - [ ] Design quick actions and shortcuts
  - [ ] Mobile dashboard layout

**Deliverable:** Navigation mockups + page template specifications

---

### Phase 3: Page Redesigns (⏳ pending)
**Goal:** High-fidelity mockups for all 10+ pages

**Tasks:**
- [ ] Authentication Pages (2 pages)
  - [ ] Login page redesign
  - [ ] Registration page redesign
- [ ] Agent Management (1 page)
  - [ ] Agent list with metrics and status
  - [ ] Agent detail cards
  - [ ] Agent actions and controls
- [ ] Server Management (3 pages)
  - [ ] Container list (servers view)
  - [ ] Server creation form
  - [ ] Server detail/edit view (if adding)
- [ ] Operations Pages (2 pages)
  - [ ] Log viewer redesign
  - [ ] RCON terminal redesign
- [ ] Admin Pages (3 pages)
  - [ ] User management
  - [ ] Permissions management
  - [ ] Audit log viewer

**Deliverable:** High-fidelity mockups for all pages (desktop + mobile)

---

### Phase 4: UX Enhancements (⏳ pending)
**Goal:** Improve information architecture and user flows

**Tasks:**
- [ ] Information Architecture
  - [ ] Review current navigation structure
  - [ ] Optimize menu organization
  - [ ] Simplify user paths to common tasks
  - [ ] Design breadcrumb/wayfinding improvements
- [ ] User Flows
  - [ ] Map key user journeys (create server, view logs, manage users)
  - [ ] Identify friction points
  - [ ] Design improved flows
  - [ ] Add shortcuts and quick actions
- [ ] Visual Hierarchy
  - [ ] Define importance levels for UI elements
  - [ ] Optimize scanning patterns (F-pattern, Z-pattern)
  - [ ] Improve content grouping and whitespace
  - [ ] Clarify CTAs (call-to-action buttons)
- [ ] Micro-interactions
  - [ ] Define hover states and transitions
  - [ ] Design loading animations
  - [ ] Specify button press animations
  - [ ] Design toast/notification patterns
  - [ ] Plan skeleton screen patterns

**Deliverable:** User flow diagrams + micro-interaction specifications

---

### Phase 5: Responsive Design Specifications (⏳ pending)
**Goal:** Ensure all designs work across devices

**Tasks:**
- [ ] Breakpoint Strategy
  - [ ] Define breakpoints (mobile, tablet, desktop, wide)
  - [ ] Specify layout changes at each breakpoint
  - [ ] Design mobile-specific patterns
- [ ] Mobile Layouts
  - [ ] Navigation (drawer, bottom nav, hamburger)
  - [ ] Table patterns (cards, horizontal scroll, accordion)
  - [ ] Form layouts (single column, stacked)
  - [ ] Dashboard widgets (stacked, scrollable)
- [ ] Touch Targets
  - [ ] Ensure 44px minimum touch targets
  - [ ] Design tap states for mobile
  - [ ] Plan gestures (swipe, long-press)
- [ ] Responsive Images
  - [ ] Specify image sizing and scaling
  - [ ] Plan logo variations (full, compact, icon)

**Deliverable:** Responsive mockups for key pages at all breakpoints

---

### Phase 6: Design Assets & Handoff (⏳ pending)
**Goal:** Prepare all assets and specifications for M9 implementation

**Tasks:**
- [ ] Design Tokens
  - [ ] Export colors, typography, spacing as CSS variables
  - [ ] Generate Tailwind config from design tokens
  - [ ] Document token naming conventions
- [ ] Component Library
  - [ ] Document all component variants
  - [ ] Specify component states (hover, active, disabled)
  - [ ] Provide usage guidelines
- [ ] Asset Export
  - [ ] Export icons (SVG)
  - [ ] Export logos and branding assets
  - [ ] Export illustrations (if any)
  - [ ] Prepare image assets (optimized)
- [ ] Implementation Guide
  - [ ] Create implementation roadmap for M9
  - [ ] Prioritize pages by complexity
  - [ ] Document technical considerations
  - [ ] Create measurement/success criteria

**Deliverable:** Complete design system package + implementation guide

---

## Success Criteria

- [x] Planning complete with all phases defined
- [ ] All 10+ pages have high-fidelity mockups
- [ ] Design system fully documented (colors, typography, spacing, components)
- [ ] Responsive designs for mobile, tablet, desktop
- [ ] Navigation structure designed and approved
- [ ] Micro-interactions and animations specified
- [ ] Design tokens ready for implementation
- [ ] Implementation guide complete for M9
- [ ] All assets exported and organized

---

## Dependencies

- ✅ Milestone 7.5 complete (foundational UI styling)
- ⚠️ Design tool selection (Figma/Sketch/Penpot)
- ⚠️ User feedback on current UI (optional but helpful)

---

## Constraints

- Must maintain WCAG AA accessibility (color contrast)
- Must work with existing shadcn/ui component library
- Must be implementable with Tailwind CSS
- No JavaScript framework changes (React + Vite)
- Budget: 1-2 weeks design work

---

## Open Questions

1. **Design tool preference?**
   - Figma (cloud, collaborative, free tier)
   - Sketch (Mac only, one-time purchase)
   - Penpot (open source, self-hosted)
   - Adobe XD (subscription)

2. **Navigation preference?**
   - Sidebar (vertical nav, common in dashboards)
   - Header (horizontal nav, simpler)
   - Hybrid (both sidebar + header)
   - Collapsible sidebar (responsive)

3. **Dashboard necessity?**
   - Should we add a new dashboard/home page?
   - Or keep current "agent list" as landing page?

4. **Brand identity?**
   - Do we have logo/branding assets?
   - Should we design a logo/icon?
   - Color scheme preferences?

5. **Design fidelity level?**
   - High-fidelity mockups (pixel-perfect)
   - Mid-fidelity wireframes (faster, less detail)
   - Mix of both (wireframes → high-fi for key pages)

---

## Errors Encountered

*(None yet)*

---

## Notes

- This is a **design-only milestone** - no code implementation
- M9 will implement these designs
- Keep M7.5's shadcn/ui foundation (build on it, don't replace)
- Focus on elevating existing UI, not rebuilding from scratch
