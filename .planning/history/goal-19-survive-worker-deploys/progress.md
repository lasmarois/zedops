# Goal #19: Progress Log

## Session 2 — 2026-02-09

### Implementation
- Added `ErrTransientAuth` sentinel error in `reconnect.go`
- Added `maxTransientAuthRetries = 5` constant
- Modified `RunWithReconnect()` to distinguish transient vs permanent auth failures:
  - Transient: retry with exponential backoff (1s → 2s → 4s → 8s → 16s), max 5 retries
  - Permanent: immediate fatal exit (unchanged behavior)
  - Reset transient counter on successful auth
- Modified `register()` and `authenticate()` in `main.go`:
  - `sendMessage()` fails → `ErrTransientAuth` (connection lost before auth)
  - `ReadJSON` error in goroutine → now sends error to channel (was silently returning)
  - Server responds with `error` subject → `ErrAuthFailure` (permanent)
  - Timeout → `ErrTransientAuth` (likely deploy-induced)
- Changed goroutine pattern: now uses `authResult{msg, err}` struct channel instead of `Message` channel, so ReadJSON errors reach the select
- Build succeeds (Docker cross-compile)

### Files Modified
- `agent/reconnect.go` — ErrTransientAuth, maxTransientAuthRetries, RunWithReconnect retry logic
- `agent/main.go` — register() and authenticate() typed errors

### Deployment & Testing
- Built agent binary (Docker cross-compile) ✓
- Deployed to test VM (10.0.13.208) with `--no-update` ✓
- Triggered dev worker redeploy (push to dev, CI run 21838977535) ✓
- **Deploy survival test**: Agent saw `close 1006 (abnormal closure)`, reconnected in ~2s, re-authenticated successfully ✓
  - Note: This deploy was clean — WS dropped during normal operation, not during auth handshake
  - The transient retry path wasn't triggered because auth succeeded on first reconnect
- **Wrong token test**: Replaced token with fake, agent got `"Invalid or expired token"`, immediately showed `AUTHENTICATION FAILED`, exited code 78 with NO retries ✓
- Restored real token, agent reconnected normally ✓

### Commits
- `abb3bff` — feat: survive worker deploys without agent death (Goal #19)
- `98f95ed` — chore: bump version comment to trigger dev redeploy

## Session 1 — 2026-02-09

### Research
- Analyzed agent logs from maestroserver deploy failure
- Traced the full failure sequence: deploy → WS close → reconnect → auth timeout → fatal exit
- Identified root cause: `register()` returns generic error, `RunWithReconnect()` treats all as fatal
- Reviewed free tier constraints — bounded retry (5 attempts) is safe (~10 requests per event)
- Created task_plan.md with phased approach
