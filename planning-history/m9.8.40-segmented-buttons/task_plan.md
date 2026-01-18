# M9.8.40 - Server Detail Action Buttons Revamp

**Goal:** Redesign the server action buttons (Start, Stop, Restart, Rebuild, Delete) on the ServerDetail page for a more slick, modern look.

**Current State:** Lines 291-318 in ServerDetail.tsx
- Standard horizontal flex row of Button components
- Colored variants: success (Start), warning (Stop), info (Restart/Rebuild), destructive (Delete)
- Icons + text labels
- Basic hover effects

---

## Design Options

### Option 1: Segmented Button Group with Glow
**Style:** Unified pill-shaped container grouping related actions

```
┌─────────────────────────────────────────────────────────────────┐
│  ▶ Start  │  ■ Stop  │  ↻ Restart  ││  🔧 Rebuild  │  🗑 Delete │
└─────────────────────────────────────────────────────────────────┘
      └── Primary Actions ──────────┘    └── Destructive ───────┘
```

**Features:**
- Glass morphism background (semi-transparent with blur)
- Segmented dividers between buttons
- Subtle glow effect on hover
- Primary actions grouped, destructive actions separated
- Active state shows which action is available

**Pros:** Clean, modern, groups related actions logically
**Cons:** More complex component, may feel cramped on mobile

---

### Option 2: Floating Action Bar (Sticky)
**Style:** Detached floating bar that sticks to bottom of header area

```
╭────────────────────────────────────────────────╮
│  ▶ Start   ↻ Restart   🔧 Rebuild   🗑 Delete  │
╰────────────────────────────────────────────────╯
     ↑ Floats with subtle shadow, rounded corners
```

**Features:**
- Semi-transparent background with backdrop blur
- Soft shadow for depth (floating effect)
- Rounded pill shape
- Icons larger, text smaller
- Subtle border glow matching action color on hover

**Pros:** Visually distinct, premium feel, always accessible
**Cons:** Takes more vertical space, may overlap content if sticky

---

### Option 3: Icon-First Compact Design (Discord/Figma style)
**Style:** Large icon buttons with tooltips, minimal footprint

```
    ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐
    │ ▶ │  │ ■ │  │ ↻ │  │ 🔧 │  │ 🗑 │
    └───┘  └───┘  └───┘  └───┘  └───┘
     Start  Stop  Restart Rebuild Delete
      (tooltip on hover)
```

**Features:**
- Square or circular icon buttons (40-48px)
- Color-coded backgrounds
- Tooltips reveal full action name
- Hover: scale up + glow effect
- Active: ring animation

**Pros:** Extremely compact, modern, scales well
**Cons:** Relies on tooltips, less discoverable for new users

---

### Option 4: Split Primary + Overflow Menu
**Style:** One prominent primary action, others in dropdown

```
┌─────────────────┐   ┌───┐
│  ▶ Start Server │   │ ⋮ │ ← More actions dropdown
└─────────────────┘   └───┘
                        │
                        ├─ ↻ Restart
                        ├─ 🔧 Rebuild
                        ├─ ───────────
                        └─ 🗑 Delete Server
```

**Features:**
- Large, prominent primary action (Start when stopped, Stop when running)
- Overflow menu (⋮) for secondary actions
- Destructive action separated in menu with divider
- Clean, minimal footprint

**Pros:** Very clean, emphasizes primary action, mobile-friendly
**Cons:** Hides actions behind menu, extra click for common actions

---

### Option 5: Gradient Border Cards (Premium Gaming Style)
**Style:** Individual button cards with animated gradient borders

```
╭─·─·─·─·─╮  ╭─·─·─·─·─╮  ╭─·─·─·─·─╮  ╭─·─·─·─·─╮
│   ▶     │  │   ↻     │  │   🔧    │  │   🗑    │
│  Start  │  │ Restart │  │ Rebuild │  │ Delete  │
╰─────────╯  ╰─────────╯  ╰─────────╯  ╰─────────╯
  ↑ Animated gradient border that pulses/rotates
```

**Features:**
- Each button is a mini card
- Animated gradient border (conic-gradient rotation)
- Icon above text (vertical layout)
- Glow effect matching action color
- Disabled state dims the gradient

**Pros:** Eye-catching, gaming/premium aesthetic, very polished
**Cons:** Most complex to implement, may be too flashy for some

---

## Implementation Phases

### Phase 1: Design Selection
- [ ] Present options to user
- [ ] Get user preference

### Phase 2: Component Creation
- [ ] Create new component (e.g., `ServerActionBar.tsx`)
- [ ] Implement selected design
- [ ] Handle all states (loading, disabled, available actions)

### Phase 3: Integration
- [ ] Replace current buttons in ServerDetail.tsx
- [ ] Test all action flows
- [ ] Verify mobile responsiveness

### Phase 4: Deploy & Verify
- [ ] Build frontend
- [ ] Deploy to Cloudflare
- [ ] User verification

---

## Current Phase: Phase 1 - Design Selection
**Status:** `in_progress`

Awaiting user selection from the 5 options above.
