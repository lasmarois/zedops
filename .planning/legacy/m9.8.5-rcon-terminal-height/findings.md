# M9.8.5 Findings - Increase Embedded RCON Terminal Height

**Milestone:** M9.8.5 - Make Embedded RCON Terminal Use More Vertical Space
**Investigation Date:** 2026-01-13

---

## User Feedback

**Quote:**
> "it works !!! but it is only using half the available space left in the page ! could we adjust that?"

**Context:**
- M9.8.4 just completed (embedded RCON terminal)
- Terminal works correctly but height is too small
- Fixed 600px height only uses ~half of available vertical space
- User wants more height

---

## Current Implementation

**Location:** `frontend/src/components/RconTerminal.tsx` line 589

**Current Code:**
```tsx
{embedded ? (
  // Embedded mode: renders inline in parent container
  <div className="bg-[#1e1e1e] rounded-lg w-full h-[600px] flex flex-col shadow-lg">
    {terminalContent}
  </div>
) : (
  // Overlay mode: ...
)}
```

**Problem:** `h-[600px]` is too small for typical screens.

---

## Height Analysis

**Typical Page Layout:**
```
┌─────────────────────────────────────┐
│ Header (p-8)              ~100px    │ ← Padding + heading
│ Breadcrumb + Title                  │
├─────────────────────────────────────┤
│ Server Info Cards         ~200px    │ ← Status, ports, actions
├─────────────────────────────────────┤
│ Tabs Bar                  ~50px     │ ← Tab navigation
├─────────────────────────────────────┤
│ RCON Terminal (embedded)  ???px     │ ← This is what we're adjusting
│                                     │
│ Currently: 600px                    │
│ Available: ~700-900px (varies)      │
└─────────────────────────────────────┘
Total viewport: ~1000-1200px (typical laptop)
```

**Issue:**
- Fixed 600px leaves whitespace below
- Doesn't adapt to screen size
- On larger screens, even more wasted space

---

## Solution Options

### Option 1: Larger Fixed Height

**Approach:** Increase fixed height
```tsx
h-[800px]  // or h-[1000px]
```

**Pros:**
- Simple one-line change
- Predictable

**Cons:**
- Still not responsive
- May overflow on small screens (laptops)
- Doesn't use full space on large screens

---

### Option 2: Viewport-Based Height (RECOMMENDED)

**Approach:** Use calc() with viewport height
```tsx
h-[calc(100vh-300px)]
```

**Breakdown:**
- `100vh` = full viewport height
- `-300px` = header + breadcrumb + cards + tabs + margins
- Result: Terminal fills remaining space

**Pros:**
- ✅ Responsive (adapts to screen size)
- ✅ Uses maximum available space
- ✅ No overflow on small screens
- ✅ No wasted space on large screens

**Cons:**
- Harder to predict exact size
- May need adjustment if header changes

---

### Option 3: Min-Height with Flex

**Approach:** Use flexbox
```tsx
min-h-[600px] flex-1
```

**Pros:**
- Flexible, grows to fill space
- No overflow

**Cons:**
- Requires parent to be flex container
- More complex to implement

---

## Recommendation

**Use Option 2: Viewport-Based Height**

```tsx
h-[calc(100vh-300px)]
```

**Rationale:**
1. Simple one-line change
2. Responsive design
3. Uses available space efficiently
4. Matches user request ("use more space")
5. No risk of overflow

---

## Implementation Details

**Single Change Required:**

**File:** `frontend/src/components/RconTerminal.tsx`
**Line:** 589

```tsx
// BEFORE
<div className="bg-[#1e1e1e] rounded-lg w-full h-[600px] flex flex-col shadow-lg">

// AFTER
<div className="bg-[#1e1e1e] rounded-lg w-full h-[calc(100vh-300px)] flex flex-col shadow-lg">
```

---

## Risk Assessment

**Risk Level:** VERY LOW

**Reasons:**
- One-line CSS change
- No logic changes
- No TypeScript changes
- Overlay mode unaffected
- Backward compatible

**Testing Required:**
- Visual verification on ServerDetail RCON tab
- Test on different screen sizes (if possible)
- Verify xterm.js terminal still renders correctly
