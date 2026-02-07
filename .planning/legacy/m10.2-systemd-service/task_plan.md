# M10.2 - Systemd Service Installation

## Goal
Create a proper systemd service for the ZedOps agent with an install script.

## Phases

### Phase 1: Research Current State - `complete`
- [x] Check existing install.sh script
- [x] Review agent startup flags and requirements
- [x] Understand token storage location

### Phase 2: Create Systemd Service File - `complete`
- [x] Create zedops-agent.service file
- [x] Configure restart policy (on-failure, not always)
- [x] Add RestartPreventExitStatus=78 for auth failures
- [x] Integrate with journald for logging

### Phase 3: Update Install Script - `complete`
- [x] Download binary from GitHub releases
- [x] Install to /usr/local/bin/zedops-agent
- [x] Create config directory (/etc/zedops-agent/)
- [x] Fix SELinux context with restorecon
- [x] Install and enable systemd service
- [x] Create uninstall.sh script

### Phase 4: Fix Agent Request Handling - `complete`
- [x] Make auth failure FATAL (exit code 78)
- [x] Add clear error message with fix instructions
- [x] Add IsAuthenticated() check for metrics collector
- [x] Add IsAuthenticated() check for player stats collector
- [x] Update systemd to not restart on auth failure

### Phase 5: Documentation - `pending`
- [ ] Update install instructions
- [ ] Document uninstall process
- [ ] Add troubleshooting section

## Files Modified
| File | Changes |
|------|---------|
| `agent/main.go` | ExitCodeAuthFailure, IsAuthenticated() |
| `agent/reconnect.go` | Fatal auth failure with clear message |
| `agent/metricscollector.go` | Auth check before sending |
| `agent/playerstats.go` | Auth check before collecting |
| `agent/scripts/install.sh` | SELinux fix, systemd config |
| `agent/scripts/uninstall.sh` | New file |
| `agent/scripts/zedops-agent.service` | Updated restart policy |

## Success Criteria
- [x] Install script works on SELinux systems
- [x] Auth failure stops agent cleanly (no retry loop)
- [x] Systemd doesn't restart on auth failure
- [x] Metrics only sent when authenticated
- [x] Clear error messages guide user to fix
