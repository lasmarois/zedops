# M10.1 - Complete Agent Auto-Update Pipeline

## Goal
Create the first GitHub release and verify the auto-update mechanism works end-to-end.

## Context
- Auto-update code exists in agent (`autoupdate.go`)
- Manager endpoint returns version 1.0.0 with GitHub download URLs
- GitHub Actions workflow exists (`release-agent.yml`)
- **Missing:** Actual GitHub release (agents get 404 when trying to update)

## Phases

### Phase 1: Create First Release
**Status:** `pending`
- [ ] Create git tag `agent-v1.0.0`
- [ ] Push tag to trigger GitHub Actions
- [ ] Verify workflow completes successfully
- [ ] Confirm release appears on GitHub with binaries

### Phase 2: Verify Auto-Update
**Status:** `pending`
- [ ] Check current agent logs for update attempt
- [ ] Restart agent to trigger fresh update check
- [ ] Verify agent downloads new binary (no more 404)
- [ ] Confirm agent restarts with new version
- [ ] Check `--version` flag shows 1.0.0

### Phase 3: Test on Fresh Agent
**Status:** `pending`
- [ ] Deploy old binary to test VM
- [ ] Start agent, watch it auto-update
- [ ] Verify seamless update without manual intervention

### Phase 4: Documentation & Cleanup
**Status:** `pending`
- [ ] Update MILESTONE-M98.md or create M10.1 entry
- [ ] Document release process in Claude rules
- [ ] Commit and archive planning files

## Success Criteria
- [ ] GitHub release exists with all platform binaries
- [ ] Running agents can auto-update without errors
- [ ] Agent version shows 1.0.0 after update
- [ ] Process is documented for future releases

## Files Involved
| File | Purpose |
|------|---------|
| `.github/workflows/release-agent.yml` | Release automation |
| `agent/autoupdate.go` | Update logic |
| `agent/main.go` | Version variable |
| `manager/src/index.ts` | Version endpoint |
