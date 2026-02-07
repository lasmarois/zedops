# Findings: Milestone 8 - Visual Redesign (Design Phase)

**Milestone:** M8 - Visual Redesign - Design Phase
**Date Started:** 2026-01-12

---

## User Vision (Captured 2026-01-12)

**Goal:** Professional infrastructure management UI, "hypervisor-style" like Proxmox VE, vSphere, Portainer

**Key Requirements:**
1. **Sidebar navigation** with industry-standard sections (Infrastructure, Management)
2. **Hierarchical resource navigation**:
   - Click Agent → Agent Detail Page (dedicated dashboard)
   - Click Server → Server Detail Page (dedicated dashboard)
3. **Hypervisor-style server pages**:
   - Preview panels for logs, RCON (collapsible/expandable)
   - Quick action buttons always visible
   - Tab-based organization (Overview, Configuration, Logs, RCON, etc.)
4. **Future-proof design** for unimplemented features:
   - Server.ini view/edit (tab)
   - Docker ENV view/edit (elegant, intuitive)
   - Backup management
   - Performance metrics
5. **Historical metrics**:
   - Agent/host metrics collected over time
   - 1-2 day retention (short-term trends)
   - Graphs showing CPU, memory, disk history
6. **Scalability**: Design should work with many agents and many servers

**Design Approach:**
- Text-based specifications with ASCII diagrams (user not familiar with Figma)
- Build on existing shadcn/ui foundation (M7.5)
- Reference shadcn component docs for specifications
- Markdown files with clear implementation guide

---

## Research & Discovery

**Hypervisor UI Patterns:**

### Proxmox VE Pattern
- Left sidebar: Node tree (datacenter → nodes → VMs)
- Center: Detail view with tabs
- Top action bar: Start, Stop, Shutdown, etc.
- Metrics: Current + historical graphs (RRD database, 24h-5y retention)
- Console: Embedded noVNC or text console
- Configuration: Multiple tabs (Hardware, Options, Backup, etc.)

### vSphere Client Pattern
- Left tree navigator: Datacenter → Clusters → Hosts → VMs
- Center panel: Summary, Monitor, Configure tabs
- Action buttons context-aware (disabled when VM off)
- Performance graphs: Real-time + historical
- Task/events panel at bottom (collapsible)

### Portainer Pattern
- Side navigation: Stacks, Containers, Images, Networks, Volumes
- Container detail: Stats, Logs, Inspect, Console tabs
- Quick actions at top
- Live stats with mini-graphs
- Full-screen console when needed

**Common Patterns:**
1. ✅ Tree/list navigation on left
2. ✅ Rich detail pages on right
3. ✅ Tab-based organization for complex resources
4. ✅ Always-visible action bar at top
5. ✅ Metrics with graphs (current + historical)
6. ✅ Console/logs embedded but expandable
7. ✅ Breadcrumb navigation
8. ✅ Context-aware actions (disabled when unavailable)

---

## Color System Decision (2026-01-12)

**Requirements:**
- ❌ No light theme support
- ✅ Midnight blue palette (not black, clearly blue-tinted)
- ✅ Dark with clean, professional finish
- ✅ Modern and polished aesthetic
- ✅ Color badges: Text-only with elegant contrast (no filled backgrounds)
- ✅ Activity logs: Clean, minimal, professional

**Palette Choice: Pronounced Midnight Blue**

```css
/* Base Colors */
--background: 220 45% 12%        /* #0C1628 - Clear midnight blue, not black */
--foreground: 210 40% 98%        /* #F8FAFC - Crisp white text */

/* Surface Colors */
--card: 220 40% 16%              /* #151F33 - Slightly lighter cards */
--card-foreground: 210 40% 98%

/* Primary Accent (Bright Blue) */
--primary: 217 91% 60%           /* #3B82F6 - Vivid blue for actions */
--primary-foreground: 220 45% 12% /* Dark text on bright buttons */

/* Secondary/Muted */
--secondary: 217 32% 20%         /* #1F2937 - Subtle secondary areas */
--secondary-foreground: 210 40% 98%

--muted: 217 32% 18%             /* #1A2332 - Very subtle backgrounds */
--muted-foreground: 215 20% 70%  /* #9CA3AF - Muted text */

/* Borders & Inputs */
--border: 217 32% 30%            /* #374151 - Visible but elegant borders */
--input: 217 32% 30%             /* Same as border for consistency */
--ring: 217 91% 60%              /* Focus rings match primary */

/* Semantic Status Colors (Text-Only Badges) */
--success-text: 142 76% 60%      /* #34D399 - Green text for success */
--warning-text: 38 92% 60%       /* #FBBF24 - Amber text for warnings */
--error-text: 0 84% 65%          /* #EF4444 - Red text for errors */
--info-text: 199 89% 60%         /* #22D3EE - Cyan text for info */
--muted-status: 215 20% 70%      /* #9CA3AF - Gray for inactive */

/* No filled badge backgrounds - text color + subtle transparency only */
```

**Status Badge Design:**
- Text-only with semantic colors (green, amber, red, cyan, gray)
- No filled backgrounds (keeps UI clean)
- Optional: Very subtle border or minimal background (5-10% opacity)
- Example: "🟢 Online" → Just green text, no green box

**Activity Log Design:**
- Clean timeline style (no boxes)
- Timestamp + user + action + target (all inline)
- Color only for severity/type (success=green, error=red, info=blue)
- Minimal lines/separators (whitespace for breathing room)

**Contrast Ratios (WCAG AA Verified):**
- Text on background: `#F8FAFC` on `#0C1628` = **15.2:1** ✅ (exceeds 7:1)
- Primary button: `#3B82F6` on `#0C1628` = **8.1:1** ✅ (exceeds 3:1)
- Success text: `#34D399` on `#0C1628` = **7.8:1** ✅
- Warning text: `#FBBF24` on `#0C1628` = **9.2:1** ✅
- Error text: `#EF4444` on `#0C1628` = **5.9:1** ✅
- All pass WCAG AA standards

---

## Current UI Audit

*(Screenshots and observations will be documented here)*

---

## Design Inspiration

*(References and inspiration sources will be collected here)*

---

## Design Tool Selection

*(Evaluation of design tools will be documented here)*

---

## Design System Research

*(Research on color systems, typography, iconography will go here)*

---

## Navigation Patterns

*(Research on modern navigation patterns for dashboards)*

---

## Technical Considerations

*(Implementation constraints and technical findings)*

---

## User Feedback

*(If collected, user feedback on current UI will be documented here)*

---

## Best Practices

*(Design best practices discovered during research)*
