# Findings: M9.8.14 - Duplicate Header Investigation

**Milestone:** M9.8.14 - Remove Duplicate Header in Agent Server Overview

---

## Root Cause

AgentDetail.tsx embeds the AgentServerList component, but adds its own header section above it, creating duplication.

### Current Structure (AgentDetail.tsx - Overview Tab)

```tsx
// Lines 205-211: Duplicate header
<div className="flex items-center justify-between mb-4">
  <h2 className="text-xl font-semibold">Servers on This Agent</h2>
  <Button onClick={() => navigate('/agents')}>
    <Plus className="h-4 w-4" />
    Create Server
  </Button>
</div>

// Lines 214-219: Embedded component with its own header
<AgentServerList
  agentId={agent.id}
  agentName={agent.name}
  onBack={() => navigate('/agents')}
  onViewLogs={() => {}}
/>
```

### AgentServerList Component Header

```tsx
// Lines 686-694: Full header with back button, heading, create button
<Button variant="secondary" onClick={onBack} className="mb-4">
  ← Back to Agents
</Button>
<h1 className="text-3xl font-bold">Zomboid Servers on {agentName}</h1>

<Button onClick={() => setShowServerForm(true)} size="lg">
  + Create Server
</Button>
```

### Result
User sees:
1. "Servers on This Agent" (h2) + Create Server button
2. "← Back to Agents" button
3. "Zomboid Servers on {agentName}" (h1) + Create Server button
4. Card list

**Total duplication:** 2 headings, 2 Create Server buttons

## Solution Analysis

### Option 1: Remove Duplicate Section ✅ RECOMMENDED
**Remove:** Lines 205-211 in AgentDetail.tsx

**Pros:**
- Simplest solution (delete 7 lines)
- No changes to AgentServerList (backward compatible)
- AgentServerList already has full header with back button

**Cons:**
- Less control over header styling in embedded context
- Back button always visible (though user wants it)

### Option 2: Add "embedded" Prop
**Add:** `embedded?: boolean` prop to AgentServerList

**Changes:**
```tsx
// AgentDetail.tsx
<AgentServerList embedded={true} ... />

// AgentServerList.tsx
{!embedded && (
  <div>
    <Button onClick={onBack}>← Back to Agents</Button>
    <h1>Zomboid Servers on {agentName}</h1>
    <Button onClick={() => setShowServerForm(true)}>+ Create Server</Button>
  </div>
)}
```

**Pros:**
- More flexible for future use cases
- Better component encapsulation

**Cons:**
- More complex (conditional rendering)
- Changes component API
- Not needed for current use case

### Option 3: Split Component
**Create:** AgentServerListHeader + AgentServerListContent components

**Pros:**
- Maximum flexibility
- Clear separation of concerns

**Cons:**
- Most complex refactor
- Overkill for this issue
- More files to maintain

## Decision

**Use Option 1** - Remove duplicate section from AgentDetail.tsx

**Rationale:**
- User specifically wants: "← back to agent and the new card list"
- AgentServerList already provides this
- Simplest solution that solves the immediate problem
- No breaking changes to existing component

## Impact Analysis

### Files Affected
- `frontend/src/pages/AgentDetail.tsx` - Remove lines 205-211

### Behavior Changes
- Overview tab: Shows only AgentServerList header (back button + heading + create)
- Servers tab: No change (already uses AgentServerList directly)
- Standalone AgentServerList route: No change

### Visual Changes
- Overview tab: One less heading, one less Create Server button
- User gets clean single header with back button (as requested)

---

## Testing Checklist

- [ ] Overview tab displays correctly with single header
- [ ] Back button navigates to /agents
- [ ] Create Server button opens form dialog
- [ ] Card list displays properly
- [ ] Servers tab still works (uses same component)
- [ ] No layout regression in other parts of the page
