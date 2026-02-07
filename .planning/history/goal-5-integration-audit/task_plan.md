# Goal #5: ZedOps Integration Audit

**Milestone:** M14 - Docker Image Improvements
**Status:** Complete
**Created:** 2026-02-07

## Context

Audit the integration between the ZedOps agent and the steam-zomboid Docker image to identify gaps, mismatches, and improvement opportunities.

## Phases

### Phase 1: Research & Audit `status: complete`
- [x] Audit agent container creation (server.go, docker.go)
- [x] Audit image expectations (Dockerfile, entry.sh, docker-entrypoint.sh)
- [x] Map ENV variables: agent sets vs image expects
- [x] Identify port binding vs ENV mismatches
- [x] Check shutdown/signal handling
- [x] Check mod management integration
- [x] Check game settings exposure
- [x] Document all findings

## Summary of Findings

### Critical (should fix)
1. **Port ENV mismatch** — Agent binds ports but doesn't pass port ENVs → INI has wrong values
2. **No graceful shutdown** — No RCON save before stop → data loss risk

### Important (should add)
3. **RCON port not passed as ENV** — Missing `RCON_PORT` in container creation
4. **Game settings not exposed** — 10+ image settings not in agent/UI
5. **Mod management not exposed** — Full image support, zero agent support

### Minor
6. **Health check params not configurable** — Hardcoded but reasonable defaults
7. **No image validation** — Agent accepts any image without checking structure

See findings.md for full details.
