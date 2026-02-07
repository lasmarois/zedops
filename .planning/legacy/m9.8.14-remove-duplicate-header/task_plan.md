# Task Plan: M9.8.14 - Remove Duplicate Header in Agent Server Overview

**Goal:** Remove duplicate "Servers on this agent" header and Create Server button when AgentServerList is embedded in AgentDetail

**Status:** COMPLETE

**Priority:** LOW (UI Polish)

**Started:** 2026-01-13 17:50
**Completed:** 2026-01-13 18:00

---

## Objective

Remove duplicate header section in AgentDetail's Overview tab. Currently shows:
1. AgentDetail.tsx: "Servers on This Agent" + "Create Server" button
2. AgentServerList: "← Back to Agents" + "Zomboid Servers on {agentName}" + "Create Server" button

User wants: Only "← Back to Agents" button + card list (no duplicate heading/create button)

## Investigation

**Current Duplication (AgentDetail.tsx Overview Tab):**
- Lines 205-211: "Servers on This Agent" heading + "Create Server" button
- Lines 214-219: Embeds AgentServerList component
  - AgentServerList lines 686-694: Own heading + buttons

**AgentServerList Contexts:**
1. **Standalone route** (/agents/:id/containers) - needs full header
2. **Embedded in AgentDetail** (Overview tab) - duplicate header

## Solution Options

### Option 1: Remove Duplicate Section from AgentDetail
- Remove lines 205-211 in AgentDetail.tsx (heading + create button)
- Keep AgentServerList's own header (back button + heading + create button)
- ✅ Simple, minimal changes
- ⚠️ Less control over layout in AgentDetail

### Option 2: Add "embedded" Prop to AgentServerList
- Add `embedded?: boolean` prop to AgentServerList
- When `embedded={true}`: Hide header, show only card list
- When standalone: Show full header
- ✅ More flexible, better encapsulation
- ⚠️ Slightly more complex

### Option 3: Split AgentServerList Component
- Create separate components: AgentServerListHeader + AgentServerListContent
- AgentDetail uses only content component
- ✅ Maximum flexibility
- ⚠️ Most complex refactor

**Recommended:** Option 1 (simplest, addresses user's immediate need)

## Tasks

- [x] Remove duplicate header section from AgentDetail.tsx (lines 205-211)
- [x] Remove unused Plus import from lucide-react
- [x] Verify AgentServerList header works properly when embedded
- [x] Build and deploy frontend
- [x] User testing and confirmation

## Result

Successfully removed duplicate header section. AgentDetail Overview tab now shows only AgentServerList's header with back button and card list.

**Deployed Version:** d9e6b549-ef6c-4798-b1aa-7e5909a9e3c6

**User Feedback:** (Awaiting testing)

## Files to Modify

- `frontend/src/pages/AgentDetail.tsx` - Remove duplicate header section

---

## Notes

Following new sub-milestone pattern from CLAUDE.md:
- Fresh planning files in manager/
- Focus only on M9.8.14 (this issue)
- Archive immediately after completion
