# M10.2 - Systemd Service Installation - Progress

## Session Log

### Session 1 - 2026-01-19 (Morning)
- Created planning files for M10.2
- Started Phase 1: Research current state
- Found issues in existing install.sh (variable expansion in heredoc)

### Session 2 - 2026-01-19 (Continued)
- Fixed install.sh: Changed `<< 'EOF'` to `<< EOF` so variables expand at install time
- Created uninstall.sh with --purge option
- Tested installation on maestroserver - SUCCESS!
- Service running and visible in journalctl

### Session 3 - 2026-01-19 (Afternoon)
- Tested installation on test VM (10.0.13.208)
- Found SELinux issue: binary had wrong context (user_tmp_t instead of bin_t)
- Fixed by adding `restorecon` call to install.sh
- Test VM service running but auth failing (agent deleted from manager)

### Session 4 - 2026-01-19 (Evening)
- Received Cloudflare 90% usage limit notification
- Investigated: Test agent was retrying auth every 1 second = ~3600 requests/hour
- **Major fix: Auth failure is now FATAL** (exit code 78, systemd won't restart)
- Added `IsAuthenticated()` check to metrics/player stats collectors
- Updated systemd service: `Restart=on-failure` + `RestartPreventExitStatus=78`
- Both agents stopped to prevent further Cloudflare usage

## Changes Made
| File | Change | Status |
|------|--------|--------|
| agent/scripts/install.sh | Fixed variable expansion, added SELinux restorecon, updated systemd config | Complete |
| agent/scripts/uninstall.sh | New file - uninstallation script | Complete |
| agent/scripts/zedops-agent.service | Updated restart policy, added RestartPreventExitStatus | Complete |
| agent/main.go | Added ExitCodeAuthFailure=78, IsAuthenticated() helper | Complete |
| agent/reconnect.go | Auth failure now fatal with clear error message | Complete |
| agent/metricscollector.go | Only send when authenticated | Complete |
| agent/playerstats.go | Only collect when authenticated | Complete |

## Issues Found & Fixed

### 1. SELinux Context Issue
**Problem:** Binary downloaded to /tmp has `user_tmp_t` context, blocked by SELinux.
**Solution:** Added `restorecon` call in install.sh.

### 2. Auth Failure Retry Loop (CRITICAL)
**Problem:** Auth failure only waited 1 second before retry = ~3600 requests/hour per failing agent.
**Solution:** Auth failure is now FATAL - exits with code 78, systemd won't restart.

### 3. Metrics Sent When Not Authenticated
**Problem:** Metrics/player stats collectors ran before/without auth, wasting requests.
**Solution:** Added `IsAuthenticated()` check before sending any data.

## Milestone Status
- Phases 1-4: Complete
- Phase 5 (Documentation): Pending
- Ready for commit and release
