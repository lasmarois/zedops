# M10: Agent Deployment & Polish

## Goal
Production-ready agent deployment with installation automation for Linux, Windows, and macOS.

## Current State
- Agent binary builds via Docker (`scripts/build.sh`) - Linux amd64 only
- Manual installation (copy binary, run with flags)
- No systemd service file
- No install script
- Token stored in `~/.zedops-agent/token`

## Phases

### Phase 1: Cross-Platform Build Script
**Status:** `complete`
- [x] Create `scripts/build-all.sh` for cross-compilation
- [x] Build targets: linux-amd64, linux-arm64, darwin-amd64, darwin-arm64, windows-amd64
- [x] Output to `bin/` with platform suffixes
- [x] Add Version variable to main.go (set via ldflags)
- [x] Add --version flag
- [x] Create `.github/workflows/release-agent.yml` for GitHub Actions

### Phase 2: Systemd Service File (Linux)
**Status:** `complete`
- [x] Create `scripts/zedops-agent.service` template
- [x] Service runs as root (needs Docker socket access)
- [x] Auto-restart on failure (RestartSec=10)
- [x] Environment file for configuration (/etc/zedops-agent/config)

### Phase 3: Installation Script (Linux)
**Status:** `complete`
- [x] Create `scripts/install.sh` for local installation
- [x] Creates systemd service, enables and starts it
- [x] Prompts for manager URL if not provided
- [x] Detects OS/arch and downloads correct binary from GitHub
- [x] `curl -sSL https://raw.githubusercontent.com/.../install.sh | sudo bash -s -- --manager-url URL --name NAME`

### Phase 4: UI Install Agent Flow
**Status:** `complete`
- [x] Add "Install Agent" button in UI (Agents page)
- [x] Dialog prompts for agent name, generates token
- [x] Shows installation command with token embedded
- [x] Copy-to-clipboard functionality
- [x] Created `InstallAgentDialog.tsx` component

### Phase 5: Pending Agent Cards (UX Improvement)
**Status:** `in_progress`
- [ ] Create agent record in DB when generating ephemeral token
- [ ] Add "pending" status for agents awaiting first connection
- [ ] Show pending agent cards in UI with "Awaiting Connection" badge
- [ ] Update agent status from "pending" to "online" on first connect
- [ ] Handle token expiry (remove pending agent if token expires unused)

### Phase 6: Windows Service (Optional)
**Status:** `pending`
- [ ] Research: NSSM vs native Windows service
- [ ] Create install script for Windows
- [ ] PowerShell one-liner installation

### Phase 7: Agent Auto-Update
**Status:** `complete`
- [x] Version endpoint on manager (`GET /api/agent/version`)
- [x] Agent checks version on startup and every 6 hours
- [x] Download new binary to temp location
- [x] Replace current binary and exec into new version
- [x] Uses `syscall.Exec` to replace process in-place (systemd-friendly)
- [x] Created `autoupdate.go` module

## Out of Scope (for now)
- macOS launchd service (manual run is fine)
- Signed binaries / code signing
- Package managers (apt, brew, chocolatey)

## Success Criteria
- [ ] User can install agent on Linux with single curl command
- [ ] Agent starts on boot (systemd)
- [ ] Agent auto-reconnects after reboot
- [ ] UI shows installation command with token
- [ ] Windows users can install with PowerShell script

## Files to Create/Modify
| File | Purpose |
|------|---------|
| `agent/scripts/build-all.sh` | Cross-platform build script |
| `agent/scripts/zedops-agent.service` | Systemd unit file |
| `agent/scripts/install.sh` | Local Linux installer |
| `manager/src/routes/install.ts` | Remote install script endpoint |
| `frontend/src/components/InstallAgent.tsx` | UI component |
