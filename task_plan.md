# M9.8.44 - Server Overview Page Redesign

**Goal:** Redesign the server detail Overview tab to be more slick and useful, with a layout switcher to trial different designs.

---

## Design Decisions

### Removed
- Log Preview section (navigate to Logs tab instead)
- RCON Preview section (navigate to RCON tab instead)

### New Components

| Component | Description |
|-----------|-------------|
| **Metrics Row** | 5 cards: Uptime, CPU, Memory, Disk I/O, Players (sparkline placeholders for now) |
| **Server Info Card** | Game version, map name, mods count, server data path |
| **Connection Card** | Server IP:Port with copy button, direct connect link |
| **Health Indicators** | RCON status, Container health, Disk space usage (visual) |
| **Quick Actions** | Save World, Broadcast Message, Backup Now buttons |
| **Recent Events** | Activity feed filtered to this server |
| **Layout Switcher** | Dropdown: Grid / Stacked / Masonry / Sidebar |

### Layout Options (All 4 to be implemented)

1. **Grid** - Metrics row at top, 2-column grid below (info/actions left, events right)
2. **Stacked** - Full-width sections: Metrics → Info + Connection → Actions → Events
3. **Masonry** - Flexible tiles that adapt to content size
4. **Sidebar** - Server info/health pinned left, metrics + events in main area

---

## Implementation Phases

### Phase 1: Cleanup & Component Prep
- [ ] Remove Log Preview section
- [ ] Remove RCON Preview section
- [ ] Create reusable sub-components for new sections

### Phase 2: New Components
- [ ] Enhanced Metrics Row (with sparkline placeholders)
- [ ] Server Info Card
- [ ] Connection Card (with copy functionality)
- [ ] Health Indicators
- [ ] Quick Actions (Save World, Broadcast, Backup Now)
- [ ] Recent Events feed (server-filtered)

### Phase 3: Layout Variants
- [ ] Implement Grid layout
- [ ] Implement Stacked layout
- [ ] Implement Masonry layout
- [ ] Implement Sidebar layout
- [ ] Add Layout Switcher dropdown

### Phase 4: Polish & Deploy
- [ ] Test all layouts
- [ ] Deploy to production
- [ ] Get user feedback on preferred layout

---

## Deferred: Sparkline Implementation

**Decision:** Sparklines will show placeholder "Coming soon" styling for this milestone.

**Future milestone will implement:**
- Store metrics history in D1 database
- 3-day retention period
- Sparklines for: CPU, Memory, Players

---

## Current Phase: Phase 1
**Status:** `in_progress` (brainstorming complete, ready to implement)
