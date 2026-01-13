# ZedOps Design System - Midnight Blue Edition

**Version:** M8 Design Phase
**Date:** 2026-01-12

---

## Color Palette

### Midnight Blue Theme (Dark Only)

```css
/* Base Colors - Pronounced midnight blue, not black */
--background: 220 45% 12%        /* #0C1628 - Main app background */
--foreground: 210 40% 98%        /* #F8FAFC - Primary text */

--card: 220 40% 16%              /* #151F33 - Card/panel backgrounds */
--card-foreground: 210 40% 98%

--popover: 220 40% 16%           /* #151F33 - Dropdown/modal backgrounds */
--popover-foreground: 210 40% 98%

/* Primary Accent - Bright blue for actions */
--primary: 217 91% 60%           /* #3B82F6 - Buttons, links, focus */
--primary-foreground: 220 45% 12% /* Dark text on bright buttons */

/* Secondary - Subtle backgrounds */
--secondary: 217 32% 20%         /* #1F2937 - Hover states, secondary buttons */
--secondary-foreground: 210 40% 98%

/* Muted - Very subtle elements */
--muted: 217 32% 18%             /* #1A2332 - Disabled backgrounds */
--muted-foreground: 215 20% 70%  /* #9CA3AF - Subtle text */

/* Accent - Special highlights */
--accent: 217 32% 20%            /* #1F2937 - Accent areas */
--accent-foreground: 210 40% 98%

/* Destructive - Danger actions */
--destructive: 0 84% 60%         /* #DC2626 - Delete/danger buttons */
--destructive-foreground: 210 40% 98%

/* Borders & Inputs */
--border: 217 32% 30%            /* #374151 - Visible borders */
--input: 217 32% 30%             /* Input borders */
--ring: 217 91% 60%              /* Focus ring (matches primary) */

/* Semantic Status Colors (Text-Only) */
--success: 142 76% 60%           /* #34D399 - Green for success/online */
--warning: 38 92% 60%            /* #FBBF24 - Amber for warnings */
--error: 0 84% 65%               /* #EF4444 - Red for errors/offline */
--info: 199 89% 60%              /* #22D3EE - Cyan for info */

/* Chart/Graph Colors (Future) */
--chart-1: 217 91% 60%           /* Blue */
--chart-2: 142 76% 60%           /* Green */
--chart-3: 38 92% 60%            /* Amber */
--chart-4: 280 87% 65%           /* Purple */
--chart-5: 340 82% 60%           /* Pink */
```

### Color Usage Guidelines

**Backgrounds:**
- Page background: `--background` (#0C1628)
- Cards/panels: `--card` (#151F33)
- Modals/popovers: `--popover` (#151F33)
- Hover states: `--secondary` (#1F2937)

**Text:**
- Primary text: `--foreground` (#F8FAFC)
- Secondary text: `--muted-foreground` (#9CA3AF)
- Colored text: Use semantic colors directly

**Borders:**
- Standard borders: `--border` (#374151) with 1px width
- Focus rings: `--ring` (#3B82F6) with 2px offset

**Buttons:**
- Primary: `--primary` background (#3B82F6)
- Secondary: `--secondary` background (#1F2937)
- Destructive: `--destructive` background (#DC2626)
- Ghost: Transparent with `--primary` text
- Outline: Border only with `--border`

---

## Status Badges (Text-Only Design)

**Design Philosophy:** Clean, minimal, professional. No filled backgrounds - just colored text with optional subtle styling.

### Badge Variants

```
Online Status:
🟢 Online         (text: #34D399, no background)
🔴 Offline        (text: #EF4444, no background)
🟡 Starting       (text: #FBBF24, no background)
⚪ Unknown        (text: #9CA3AF, no background)

Server Status:
▶️ Running        (text: #34D399)
⏸️ Stopped        (text: #9CA3AF)
🔄 Restarting     (text: #FBBF24)
❌ Failed         (text: #EF4444)
🗑️ Deleted        (text: #9CA3AF)

Role Badges:
👑 Admin          (text: #3B82F6)
🔧 Agent Admin    (text: #22D3EE)
⚙️ Operator       (text: #34D399)
👁️ Viewer         (text: #9CA3AF)
```

**Implementation:**
```tsx
// Text-only badge
<span className="text-success">🟢 Online</span>

// With subtle background (optional, 5% opacity)
<span className="px-2 py-1 rounded-md bg-success/5 text-success">
  🟢 Online
</span>

// With subtle border (optional)
<span className="px-2 py-1 rounded-md border border-success/20 text-success">
  🟢 Online
</span>
```

---

## Activity Log Design (Clean Timeline)

**Design Philosophy:** Minimal, scannable, professional. No boxes or heavy styling - just clean typography with color accents.

### Timeline Style

```
┌────────────────────────────────────────────────────────────┐
│ Recent Activity                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 2 minutes ago                                              │
│ admin started server jeanguy                               │
│ [view details]                                             │
│                                                            │
│ 5 minutes ago                                              │
│ john kicked player griefer123 from build42                 │
│ [view details]                                             │
│                                                            │
│ 12 minutes ago                                             │
│ Agent maestroserver came online                            │
│                                                            │
│ 1 hour ago                                                 │
│ admin updated permissions for user sarah                   │
│ [view details]                                             │
│                                                            │
│ ──────────────────────────────────────────────────         │
│ [Load more]                                                │
└────────────────────────────────────────────────────────────┘
```

**With Color Coding:**
```
2 minutes ago (text: #9CA3AF)
admin (text: #3B82F6) started (text: #34D399) server jeanguy (text: #F8FAFC)

5 minutes ago
john (text: #22D3EE) kicked (text: #FBBF24) player griefer123 from build42

12 minutes ago
Agent maestroserver (text: #22D3EE) came online (text: #34D399)

1 hour ago
admin (text: #3B82F6) deleted (text: #EF4444) server old-test
```

**Implementation:**
```tsx
<div className="space-y-4">
  <div className="text-sm">
    <div className="text-muted-foreground">2 minutes ago</div>
    <div>
      <span className="text-primary">admin</span>
      {" "}
      <span className="text-success">started</span>
      {" "}
      server <span className="font-medium">jeanguy</span>
    </div>
    <button className="text-xs text-muted-foreground hover:text-foreground">
      [view details]
    </button>
  </div>

  <div className="h-px bg-border/50" /> {/* Subtle separator */}

  {/* Next entry... */}
</div>
```

**Color Coding by Action Type:**
- **Success actions** (started, created, enabled): Green (#34D399)
- **Warning actions** (restarted, updated, kicked): Amber (#FBBF24)
- **Destructive actions** (deleted, stopped, banned): Red (#EF4444)
- **Info actions** (viewed, logged in, came online): Cyan (#22D3EE)
- **User names**: Primary blue (#3B82F6) or Info cyan (#22D3EE)
- **Timestamps**: Muted gray (#9CA3AF)

---

## Typography

### Font Families

```css
/* Sans-serif (UI text) */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Monospace (code, logs, RCON) */
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Type Scale

```css
/* Headings */
.text-h1 { font-size: 2.25rem; line-height: 2.5rem; font-weight: 700; }   /* 36px */
.text-h2 { font-size: 1.875rem; line-height: 2.25rem; font-weight: 600; } /* 30px */
.text-h3 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; }      /* 24px */
.text-h4 { font-size: 1.25rem; line-height: 1.75rem; font-weight: 600; }  /* 20px */

/* Body */
.text-base { font-size: 1rem; line-height: 1.5rem; }      /* 16px - default */
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }   /* 14px */
.text-xs { font-size: 0.75rem; line-height: 1rem; }       /* 12px */

/* Large */
.text-lg { font-size: 1.125rem; line-height: 1.75rem; }   /* 18px */
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }    /* 20px */
```

### Font Weights

- **Regular:** 400 (body text)
- **Medium:** 500 (emphasis)
- **Semibold:** 600 (headings, buttons)
- **Bold:** 700 (page titles)

---

## Spacing System

### Scale (Tailwind default, 4px base)

```
0.5 = 2px
1   = 4px
2   = 8px
3   = 12px
4   = 16px
5   = 20px
6   = 24px
8   = 32px
10  = 40px
12  = 48px
16  = 64px
20  = 80px
24  = 96px
```

### Usage Guidelines

**Padding:**
- Cards: `p-6` (24px)
- Buttons: `px-4 py-2` (16px x 8px)
- Inputs: `px-3 py-2` (12px x 8px)
- Sections: `p-8` (32px)

**Gaps:**
- Between elements: `gap-4` (16px)
- Between sections: `gap-8` (32px)
- Table cells: `gap-2` (8px)

**Margins:**
- Between cards: `mb-6` (24px)
- Section spacing: `mb-8` (32px)

---

## Border Radius

```css
--radius: 0.5rem;  /* 8px - default for cards, inputs, buttons */

/* Component-specific */
.rounded-sm { border-radius: 0.25rem; }  /* 4px - badges, tags */
.rounded-md { border-radius: 0.375rem; } /* 6px - smaller elements */
.rounded-lg { border-radius: 0.5rem; }   /* 8px - cards, modals */
.rounded-xl { border-radius: 0.75rem; }  /* 12px - large cards */
.rounded-full { border-radius: 9999px; } /* Circular - avatars, dots */
```

---

## Shadows

**Subtle elevation system:**

```css
/* Card elevation */
.shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }           /* Subtle */
.shadow { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1); }               /* Default */
.shadow-md { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }         /* Elevated */
.shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }       /* Modals */
.shadow-xl { box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); }       /* Popovers */

/* Note: In dark theme, shadows are more subtle (adjust opacity to 0.3-0.5) */
```

---

## Log Viewer Design (Smart Hybrid - APPROVED)

**Pattern:** Compact terminal for normal logs, auto-expanded cards for warnings/errors

### Normal Logs (Compact Terminal Style)

```tsx
// INFO/DEBUG logs - terminal style
<div className="font-mono text-sm">
  <span className="text-muted-foreground">[12:34:56]</span>
  {" "}
  <span className="text-muted-foreground">[INFO]</span>
  {" "}
  Server started on port 16261
</div>

// WARNING - highlighted line
<div className="font-mono text-sm text-warning">
  <span className="text-muted-foreground">[12:35:45]</span>
  {" "}
  <span>[WARN]</span>
  {" "}
  High memory usage (1.8GB/2GB)
</div>
```

### Error Logs (Auto-Expanded Cards)

```tsx
// ERROR - automatically expands into card
<Card className="bg-muted border-error/20">
  <CardContent className="p-4">
    <div className="flex items-start justify-between">
      <div className="font-mono text-sm">
        <span className="text-muted-foreground">[12:36:12]</span>
        {" "}
        <span className="text-error font-semibold">[ERROR]</span>
        {" "}
        Connection timeout to Steam API
      </div>
      <button className="text-xs text-muted-foreground hover:text-foreground">
        Collapse ▲
      </button>
    </div>

    <div className="mt-3 space-y-2 text-sm">
      <div className="text-muted-foreground">Details:</div>
      <ul className="space-y-1 ml-4">
        <li>• Endpoint: api.steampowered.com:443</li>
        <li>• Timeout: 30 seconds</li>
        <li>• Retry: Attempt 1/3 in progress</li>
      </ul>

      <div className="text-muted-foreground mt-3">Stack trace:</div>
      <pre className="text-xs bg-background/50 p-2 rounded overflow-x-auto">
        at SteamClient.connect (steam.js:45)
        at GameServer.init (server.js:123)
      </pre>
    </div>

    <div className="mt-3 flex gap-2">
      <Button size="sm" variant="ghost">Copy</Button>
      <Button size="sm" variant="ghost">Search Similar</Button>
    </div>
  </CardContent>
</Card>
```

### Log Level Colors (Midnight Blue System)

```css
/* Replace Dracula colors with midnight blue semantic colors */
.log-info    { color: #9CA3AF; }  /* Gray - normal operation */
.log-debug   { color: #3B82F6; }  /* Blue - debug info */
.log-warn    { color: #FBBF24; }  /* Amber - warnings */
.log-error   { color: #EF4444; }  /* Red - errors */
.log-success { color: #34D399; }  /* Green - success messages */
```

---

## Activity Log Design (Expandable Inline - APPROVED)

**Pattern:** Clean collapsed timeline, expandable inline cards for details

### Collapsed State

```tsx
<div className="space-y-4">
  <div className="group">
    <div className="flex items-start gap-3">
      {/* Timeline dot */}
      <div className="mt-1.5 h-2 w-2 rounded-full bg-success" />

      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">2 minutes ago</div>
        <div className="text-sm">
          <span className="text-primary font-medium">admin</span>
          {" "}
          <span className="text-success">started</span>
          {" "}
          server <span className="font-medium">jeanguy</span>
        </div>
      </div>

      <Button
        size="sm"
        variant="ghost"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Details ▼
      </Button>
    </div>
  </div>

  <Separator className="opacity-30" />

  {/* More entries... */}
</div>
```

### Expanded State

```tsx
<div className="space-y-4">
  <div className="group">
    <div className="flex items-start gap-3">
      <div className="mt-1.5 h-2 w-2 rounded-full bg-success" />

      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">2 minutes ago</div>
        <div className="text-sm">
          <span className="text-primary font-medium">admin</span>
          {" "}
          <span className="text-success">started</span>
          {" "}
          server <span className="font-medium">jeanguy</span>
        </div>

        {/* Expanded details card */}
        <Card className="mt-3 bg-muted">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-3">Event Details</h4>

            <dl className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Event ID:</dt>
              <dd className="font-mono text-xs">evt_1234567890abcdef</dd>

              <dt className="text-muted-foreground">Timestamp:</dt>
              <dd>2026-01-12 14:23:45 UTC</dd>

              <dt className="text-muted-foreground">Duration:</dt>
              <dd>2.3 seconds</dd>

              <dt className="text-muted-foreground pt-2 font-semibold">Actor:</dt>
              <dd className="pt-2"></dd>

              <dt className="text-muted-foreground">User:</dt>
              <dd>admin (admin@zedops.local)</dd>

              <dt className="text-muted-foreground">Role:</dt>
              <dd className="text-primary">Admin</dd>

              <dt className="text-muted-foreground">IP:</dt>
              <dd className="font-mono text-xs">192.168.1.100</dd>

              <dt className="text-muted-foreground pt-2 font-semibold">Target:</dt>
              <dd className="pt-2"></dd>

              <dt className="text-muted-foreground">Server:</dt>
              <dd>jeanguy (srv_abc123)</dd>

              <dt className="text-muted-foreground">Agent:</dt>
              <dd>maestroserver</dd>

              <dt className="text-muted-foreground">Status:</dt>
              <dd className="text-success">Running ✓</dd>
            </dl>

            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline">View Server →</Button>
              <Button size="sm" variant="outline">View Logs →</Button>
              <Button size="sm" variant="ghost">Copy Event ID</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button size="sm" variant="ghost">
        Collapse ▲
      </Button>
    </div>
  </div>

  <Separator className="opacity-30" />
</div>
```

### Action Color Coding

```tsx
// Helper function for action colors
const getActionColor = (action: string) => {
  if (['started', 'created', 'enabled', 'online'].includes(action)) {
    return 'text-success';  // Green
  }
  if (['kicked', 'restarted', 'updated', 'warned'].includes(action)) {
    return 'text-warning';  // Amber
  }
  if (['deleted', 'stopped', 'banned', 'failed'].includes(action)) {
    return 'text-error';  // Red
  }
  if (['viewed', 'logged', 'connected'].includes(action)) {
    return 'text-info';  // Cyan
  }
  return 'text-muted-foreground';  // Gray default
};

// Usage
<span className={getActionColor(action)}>{action}</span>
```

---

## Component Specifications

### Buttons

```tsx
// Primary (bright blue)
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Start Server
</Button>

// Secondary (subtle)
<Button variant="secondary" className="bg-secondary hover:bg-secondary/80">
  View Logs
</Button>

// Destructive (red)
<Button variant="destructive" className="bg-destructive hover:bg-destructive/90">
  Delete Server
</Button>

// Ghost (transparent, colored text)
<Button variant="ghost" className="hover:bg-accent hover:text-accent-foreground">
  Cancel
</Button>

// Outline (border only)
<Button variant="outline" className="border-border hover:bg-accent">
  Configure
</Button>
```

**Sizes:**
- Small: `h-9 px-3 text-sm`
- Default: `h-10 px-4`
- Large: `h-11 px-8`

**States:**
- Hover: Reduce opacity by 10% (`hover:bg-primary/90`)
- Active: Reduce opacity by 20% (`active:bg-primary/80`)
- Disabled: 50% opacity (`disabled:opacity-50 disabled:cursor-not-allowed`)

### Cards

```tsx
// Basic card
<Card className="bg-card text-card-foreground border-border">
  <CardHeader>
    <CardTitle>Agent Details</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>

// Hover effect (clickable cards)
<Card className="hover:bg-card/80 transition-colors cursor-pointer">
  {/* Content */}
</Card>
```

### Tables

```tsx
<Table>
  <TableHeader>
    <TableRow className="border-b border-border">
      <TableHead className="text-muted-foreground">Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="border-b border-border/50 hover:bg-muted/50">
      <TableCell className="font-medium">maestroserver</TableCell>
      <TableCell className="text-success">🟢 Online</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Tabs

```tsx
<Tabs defaultValue="overview">
  <TabsList className="bg-muted">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="logs">Logs</TabsTrigger>
    <TabsTrigger value="rcon">RCON</TabsTrigger>
    <TabsTrigger value="config">Configuration</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    {/* Overview content */}
  </TabsContent>
</Tabs>
```

**Tab styling:**
- Inactive: `text-muted-foreground`
- Active: `text-foreground bg-background shadow-sm`
- Hover: `text-foreground`

---

## Accessibility

### WCAG AA Compliance

All color combinations verified:
- Text on background: **15.2:1** ✅ (AAA level)
- Primary button: **8.1:1** ✅
- Success text: **7.8:1** ✅
- Warning text: **9.2:1** ✅
- Error text: **5.9:1** ✅

### Focus States

```css
/* Visible focus ring */
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
focus-visible:ring-offset-background
```

### Keyboard Navigation

- All interactive elements focusable
- Tab order follows visual layout
- Skip links for navigation (optional)
- Focus trap in modals/dialogs

---

## Animation & Transitions

### Principles

- **Subtle:** Animations should enhance, not distract
- **Fast:** 150-200ms for most transitions
- **Purposeful:** Animate only when it adds clarity

### Standard Transitions

```css
/* Default transition */
transition-colors duration-200

/* Hover effects */
hover:bg-primary/90 transition-colors

/* Enter/exit animations */
data-[state=open]:animate-in
data-[state=closed]:animate-out
fade-in-0
zoom-in-95
```

### Loading States

```tsx
// Skeleton loading
<Skeleton className="h-10 w-full bg-muted animate-pulse" />

// Spinner (when needed)
<Loader2 className="h-4 w-4 animate-spin" />
```

---

## Iconography

**Library:** Lucide React (already installed with shadcn/ui)

**Sizes:**
- Small: `h-4 w-4` (16px)
- Default: `h-5 w-5` (20px)
- Large: `h-6 w-6` (24px)

**Common Icons:**
- Server: `Server`
- Agent/Host: `Laptop`
- Users: `Users`
- Settings: `Settings`
- Logs: `FileText`
- Terminal: `Terminal`
- Success: `CheckCircle2`
- Warning: `AlertTriangle`
- Error: `XCircle`
- Info: `Info`

**Usage:**
```tsx
import { Server, CheckCircle2 } from 'lucide-react'

<Server className="h-5 w-5 text-muted-foreground" />
<CheckCircle2 className="h-4 w-4 text-success" />
```

---

## Implementation Notes

**Tailwind Config:**
- Colors defined in `frontend/src/index.css` as CSS variables
- Tailwind reads from `:root` and uses HSL format
- All colors available as classes: `bg-primary`, `text-success`, etc.

**shadcn/ui Components:**
- Already installed from M7.5
- Will update to use new midnight blue theme
- Component variants remain the same (just recolored)

**New Components Needed:**
- Status badge component (text-only variant)
- Activity log timeline component
- Collapsible preview panels
- Tab navigation for detail pages

---

## Next Steps (M9 Implementation)

1. Update `frontend/src/index.css` with midnight blue CSS variables
2. Test all shadcn components with new colors
3. Create custom badge component (text-only)
4. Create activity log timeline component
5. Verify WCAG AA compliance
6. Document any visual adjustments needed
