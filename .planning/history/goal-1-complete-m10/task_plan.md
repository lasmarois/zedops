# Goal #1: Complete M10 - Agent Deployment & Fix Agent Status Bugs

## Goal
Finish remaining M10 work and fix bugs discovered during review. Get the agent running properly on maestroserver with systemd.

## Parent Milestone
M10: Agent Deployment & Polish

## Phases

### Phase 1: Fix "Last Seen" Epoch Bug
**Status:** `complete`
**Effort:** 5 min
- [ ] Fix `AgentDetail.tsx:200` — add `* 1000` to convert seconds → milliseconds
- [ ] Verify fix matches AgentList.tsx pattern

### Phase 2: Fix Agent Status Going Stale
**Status:** `complete`
**Effort:** 30-60 min
- [x] Research: Add stale detection to agents list API or frontend
- [ ] Option A: Backend — when listing agents, check `last_seen` age and mark stale agents offline
- [ ] Option B: Frontend — show "Stale" indicator if last_seen > threshold
- [ ] Implement chosen approach
- [ ] Test with current stale agents

### Phase 3: Pending Agent Token Expiry Cleanup
**Status:** `complete`
**Effort:** 30 min
- [ ] Add cleanup logic: when listing agents, delete pending agents with expired tokens (>1 hour old)
- [ ] OR add "Expired" badge + delete button in frontend for stale pending agents
- [ ] Test by creating a pending agent and waiting

### Phase 4: Restart Maestroserver Agent
**Status:** `complete`
**Effort:** 15 min
- [ ] Enable systemd service: `systemctl enable zedops-agent`
- [ ] Check if current binary is latest version (v1.0.5)
- [ ] Update binary if needed from GitHub release
- [ ] Start service: `systemctl start zedops-agent`
- [ ] Verify agent connects and shows online in UI

### Phase 5: End-to-End Verification
**Status:** `complete`
**Effort:** 15 min
- [ ] Verify dashboard shows correct agent status
- [ ] Verify "Last seen" shows correct timestamp
- [ ] Verify agent detail page works
- [ ] Verify server list loads on agent detail
- [ ] Test Add Agent flow (generate command, verify pending card appears)
- [ ] Deploy to production and verify

### Phase 6: Complete M10 & Update Docs
**Status:** `in_progress`
**Effort:** 10 min
- [ ] Update MILESTONES.md — mark M10 complete
- [ ] Update GOALS.md — mark Goal #1 complete
- [ ] Archive planning files to `.planning/history/goal-1-complete-m10/`
- [ ] Commit

## Out of Scope
- Phase 6 Windows service (deferred, not needed for M10 completion)
- Test VM (unreachable, separate issue)
- Agent detail URL by name (by design, uses UUID)

## Success Criteria
- [ ] Agent running on maestroserver via systemd (enabled + active)
- [ ] Agent status correctly reflects online/offline state
- [ ] "Last seen" shows correct human-readable timestamp
- [ ] Pending agent cleanup works (expired tokens → removed)
- [ ] M10 marked complete in MILESTONES.md
