# M9.8.5 Task Plan - Increase Embedded RCON Terminal Height

**Milestone:** M9.8.5 - Make Embedded RCON Terminal Use More Vertical Space
**Parent:** M9.8 - Polish & Production Readiness
**Priority:** LOW (Polish/UX Enhancement)
**Estimated Duration:** 15 minutes
**Started:** 2026-01-13

---

## Goal

Increase the height of the embedded RCON terminal in ServerDetail to use more of the available vertical space on the page instead of just 600px.

---

## Success Criteria

- [ ] Plan created
- [ ] Current height constraint identified (h-[600px])
- [ ] New height approach decided (viewport-based or larger fixed)
- [ ] RconTerminal updated with new height
- [ ] Build succeeds
- [ ] Deployed to production
- [ ] User validates terminal uses more space

---

## Current State Analysis

**Location:** `frontend/src/components/RconTerminal.tsx` line 589

**Current Embedded Mode:**
```tsx
<div className="bg-[#1e1e1e] rounded-lg w-full h-[600px] flex flex-col shadow-lg">
  {terminalContent}
</div>
```

**Problem:** Fixed 600px height only uses about half the available space on typical screens.

**User Feedback:**
> "it works !!! but it is only using half the available space left in the page ! could we adjust that?"

---

## Implementation Phases

### Phase 1: Decide on Height Strategy (5 min) - `in_progress`

**Options:**

1. **Larger Fixed Height:**
   ```tsx
   h-[800px]  // 800px (better but still fixed)
   ```
   - Pros: Simple, predictable
   - Cons: Doesn't adapt to screen size

2. **Viewport-Based Height:**
   ```tsx
   h-[calc(100vh-300px)]  // viewport height minus header/tabs
   ```
   - Pros: Adapts to screen size
   - Cons: Need to estimate header size

3. **Very Tall Fixed Height:**
   ```tsx
   h-[1000px]  // 1000px
   ```
   - Pros: Uses most screens well
   - Cons: May overflow on small screens

**Recommendation:** Use viewport-based height with calc() for responsiveness.

**Files to Modify:**
- `frontend/src/components/RconTerminal.tsx`

---

### Phase 2: Update Embedded Height (5 min) - `pending`

**Change in RconTerminal.tsx (line 589):**
```tsx
// BEFORE
<div className="bg-[#1e1e1e] rounded-lg w-full h-[600px] flex flex-col shadow-lg">

// AFTER
<div className="bg-[#1e1e1e] rounded-lg w-full h-[calc(100vh-300px)] flex flex-col shadow-lg">
```

**Rationale:**
- `100vh` = full viewport height
- `-300px` = approximate space for header + breadcrumb + server info + tabs
- Result: Terminal fills remaining vertical space
- Responsive: adapts to different screen sizes

**Files to Modify:**
- `frontend/src/components/RconTerminal.tsx`

---

### Phase 3: Build & Deploy (5 min) - `pending`

**Steps:**
1. Build frontend: `cd frontend && npm run build`
2. Deploy backend: `cd manager && npx wrangler deploy`
3. Verify deployment URL: https://zedops.mail-bcf.workers.dev
4. Test on different screen sizes

**Expected Results:**
- Terminal uses more vertical space
- Adapts to viewport size
- Doesn't overflow on small screens

---

## Errors Encountered

None yet.

---

## Notes

- This is M9.8.5 (fifth sub-milestone of M9.8 polish phase)
- User confirmed M9.8.4 works but wants more height
- Simple CSS change (one line)
- Viewport-based approach is responsive
