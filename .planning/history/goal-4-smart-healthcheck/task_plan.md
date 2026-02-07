# Goal #4: Smart Health Check

**Milestone:** M14 - Docker Image Improvements
**Status:** In Progress
**Created:** 2026-02-07

## Context

The steam-zomboid Docker image has a health check that only passes when the Java game server process is running AND both UDP ports are bound. During Steam updates (steamcmd) or world loading, the check fails, causing Docker to report "unhealthy" after the 2-minute start period expires. The ZedOps frontend faithfully mirrors Docker state, so users see "Unhealthy" (red) when the server is actually still starting.

## Boot Sequence Analysis

1. `docker-entrypoint.sh` → fix permissions, drop to steam user
2. `entry.sh` → branch detection, backup if switching
3. **steamcmd** → download/update game files (can take 5-30+ minutes on first install or verify)
4. First-run init → start server briefly to create INI, then kill
5. ENV configuration → apply settings to INI
6. `start-server.sh` → launches Java game server
7. Java loads world, binds UDP ports → **only NOW does current health check pass**

## Phases

### Phase 1: Implement lifecycle-aware health check `status: complete`
- [x] Create `scripts/healthcheck.sh` — checks steamcmd, Java, entry.sh processes
- [x] Replace inline HEALTHCHECK CMD with script reference
- [x] Add healthcheck.sh to Dockerfile stage 2 validation (bash -n)
- [x] Add chmod 755 for healthcheck.sh in stage 3
- [x] Reduce start-period from 120s to 30s (smart check doesn't need long grace)
- [x] Verified bash syntax locally

### Phase 2: Test locally `status: complete`
- [x] Build image with new health check (`steam-zomboid:healthcheck-test`)
- [x] Discovered `pgrep -x` fails for ProjectZomboid64 (kernel truncates to 15 chars) — switched to `pgrep -f`
- [x] Discovered old check used `java.*ProjectZomboid64` but process is actually `./ProjectZomboid64` (native binary)
- [x] Verified health check passes for running server (PID 332 matched correctly)
- [x] Verified no pgrep self-match when invoked via Docker HEALTHCHECK
- [x] Rebuilt image with all fixes

### Phase 3: Deploy and verify on prod `status: complete`
- [x] Committed and tagged v2.1.3 in steam-zomboid repo, pushed to GitLab
- [x] GitLab CI built and published image to registry (pipeline #171 success)
- [x] Updated CHANGELOG.md with v2.1.3 entry
- [x] Pulled new image on maestroserver
- [x] Rebuilt build42-testing via ZedOps UI
- [x] Container immediately reported healthy — no false "Unhealthy" during startup
- [x] Verified container uses new healthcheck.sh via docker inspect
