# Goal #6: Fix Health Check — Healthy Only When Game Ready

## Overview
Change Docker healthcheck so "healthy" means "game server is accepting connections" (UDP port bound), not just "some process is running."

## Phase 1: Implementation
- [x] Rewrite `steam-zomboid/scripts/healthcheck.sh` — check UDP port binding only
- [x] Update `steam-zomboid/Dockerfile` — add `iproute2` for `ss`, update HEALTHCHECK args
- [ ] Verify changes are correct (review final files)

## Phase 2: Verification & Completion
- [ ] Review final state of both modified files
- [ ] Archive planning files and update GOALS.md
- [ ] Commit changes

## Files Modified
1. `steam-zomboid/scripts/healthcheck.sh` — Strict UDP port check only
2. `steam-zomboid/Dockerfile` — Added `iproute2`, updated HEALTHCHECK timing

## Key Design Decisions
- `ss -uln` checks UDP port binding (requires `iproute2` package)
- `--start-period=300s` (5 min) covers SteamCMD + Java loading
- `--interval=15s` for faster ready detection
- `--retries=5` for crash detection after start-period (75s window)
