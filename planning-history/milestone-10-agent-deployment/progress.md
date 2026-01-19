# M10: Agent Deployment - Progress

## Session Log

### Session 1 - 2026-01-18
- Created planning files (task_plan.md, findings.md, progress.md)
- Reviewed current agent build system
- Identified existing: build.sh, Dockerfile.build
- Missing: install.sh, systemd service, cross-platform builds
- Ready to start Phase 1

## Changes Made
| File | Change | Status |
|------|--------|--------|
| `agent/scripts/build-all.sh` | Cross-platform build script | ✅ |
| `agent/scripts/zedops-agent.service` | Systemd service template | ✅ |
| `agent/scripts/install.sh` | Linux installation script | ✅ |
| `agent/main.go` | Added Version var, --version flag, auto-updater integration | ✅ |
| `agent/autoupdate.go` | NEW - Auto-update module | ✅ |
| `.github/workflows/release-agent.yml` | NEW - GitHub Actions for releases | ✅ |
| `frontend/src/components/InstallAgentDialog.tsx` | NEW - Install Agent UI dialog | ✅ |
| `frontend/src/components/AgentList.tsx` | Integrated InstallAgentDialog | ✅ |
| `manager/src/index.ts` | Added /api/agent/version endpoint | ✅ |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |

## Key Decisions
- Binary hosting: GitHub Releases
- Windows service: TBD (NSSM vs native)
- Auto-update: Complete (Phase 7)

## Session 2 - 2026-01-18

### Bug Fix
- Fixed `/api/admin/tokens` endpoint - was using old ADMIN_PASSWORD auth instead of JWT
- Updated to use `requireAuth()` + `requireRole('admin')` middleware

### New Requirement: Pending Agent Cards
User feedback: When adding an agent via UI, expected to see a "pending" card immediately, not wait until agent connects.

**Implementation Plan:**
1. When generating ephemeral token, also create agent record in D1 with status="pending"
2. Frontend shows pending agents with "Awaiting Connection" badge
3. When agent connects with token, update status from "pending" to "online"
4. Cleanup: Remove pending agents if token expires unused (1 hour)

**Implementation Complete:**
- `manager/src/lib/tokens.ts` - Added agentId to ephemeral token payload
- `manager/src/routes/admin.ts` - Creates pending agent on token generation, added delete endpoint
- `manager/src/durable-objects/AgentConnection.ts` - Handles pending→online transition
- `frontend/src/lib/api.ts` - Added 'pending' to Agent status type
- `frontend/src/components/ui/status-badge.tsx` - Added 'pending' variant (amber color)
- `frontend/src/components/AgentList.tsx` - Shows pending agents with loader icon and different UI
