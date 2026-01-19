# Docker Network Investigation

## Goal
Investigate and fix the "network zomboid-backend not found" error when creating servers on newly deployed agents.

## Context
- Error occurred on `zedops-test-agent` (VM at 10.0.13.208)
- Agent connected successfully, but server creation failed
- Error: `failed to start container: Error response from daemon: network zomboid-backend not found`

## Phases

### Phase 1: Reproduce and Understand
**Status:** `complete`
- [x] Check current Docker network configuration on remote agent
- [x] Find where `zomboid-backend` network is referenced in agent code
- [x] Understand why the network is expected to exist
- [x] Document the intended network architecture

### Phase 2: Determine Root Cause
**Status:** `complete`
- [x] Is this a hardcoded network name that should be configurable? → Yes, hardcoded
- [x] Should the agent create the network automatically? → Yes, implemented
- [x] Is this a legacy assumption from a different architecture? → Original setup was manual
- [x] Check if maestroserver (original agent) has this network → Yes, created manually

### Phase 3: Implement Fix
**Status:** `complete`
- [x] Choose approach: auto-create network OR make configurable OR remove requirement
- [x] Implement the fix in agent code (EnsureNetworks in docker.go)
- [x] Test on local agent (maestroserver) - networks detected as existing
- [x] Deploy binary to remote agent

### Phase 4: Deploy and Verify
**Status:** `complete`
- [x] Build updated agent binary
- [x] Deploy to test agent
- [x] Verify networks created on remote VM
- [x] Added test VM instructions to Claude rules

## Success Criteria
- [x] New agents can create servers without manual network setup
- [x] Existing agents continue to work
- [x] Network configuration is documented or automatic

## Files to Investigate
| File | Purpose |
|------|---------|
| `agent/docker/*.go` | Docker container management |
| `agent/handlers/*.go` | Server creation handlers |
| Original agent config | Reference for working setup |
