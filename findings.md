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
