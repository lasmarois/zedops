# M9.8.21 - Server Metrics Empty/Not Displaying

**Priority:** MEDIUM (Bug Fix)

**Started:** 2026-01-13

---

## Problem

**User report:**
> "there is the servers metric that should be fixed, they are empty right now"

Server metrics are not displaying or showing as empty.

---

## Investigation Needed

- [ ] Where are server metrics displayed? (Dashboard? Server detail page?)
- [ ] What metrics should be shown? (CPU, RAM, player count, etc.)
- [ ] How are metrics fetched? (Agent reports? API endpoint?)
- [ ] Are metrics being collected but not displayed, or not collected at all?
- [ ] Check backend metric collection
- [ ] Check frontend metric display components

---

## Potential Causes

1. Agent not reporting metrics
2. Manager not storing/forwarding metrics
3. Frontend not fetching metrics
4. Frontend component not rendering metrics
5. API endpoint issue

---

## Files to Investigate

- Agent metrics collection
- Manager metrics endpoints
- Frontend metrics display components
- Server detail pages
- Dashboard metrics widgets
