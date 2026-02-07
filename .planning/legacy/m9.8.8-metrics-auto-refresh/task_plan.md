# Task Plan: M9.8.8 - Fix Metrics Auto-Refresh on Agent Overview Page

**Goal:** Fix metrics not auto-refreshing on agent overview page

**Status:** COMPLETE

**Priority:** MEDIUM

**Started:** 2026-01-13 16:00
**Completed:** 2026-01-13 16:05

---

## Objective

Fix metrics not auto-refreshing on agent overview page

## Investigation Results

- [x] Check if AgentDetail page has refetchInterval configured
  - ✅ useAgents hook has `refetchInterval: 5000` (line 16)
- [x] Check if metrics query is set up for polling
  - ✅ Query configured for 5-second polling
- [x] Identify root cause
  - ⚠️ TanStack Query pauses refetchInterval when window not focused by default
  - Missing `refetchIntervalInBackground: true` option

## Tasks

- [x] Add `refetchIntervalInBackground: true` to useAgents hook
- [x] Build and deploy frontend
- [x] Deploy manager (Version: c7def356-eb84-47e0-8ae5-2633bbca1d3e)
- [x] User testing and confirmation

## Result

Metrics now auto-refresh every 5 seconds, even when tab is not focused

**User Feedback:** "ok it works !" ✓

## Files Modified

- `frontend/src/hooks/useAgents.ts` - Added refetchIntervalInBackground option
