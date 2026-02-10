# Goal #22: Fix Adoption Mount Preservation (Binds vs Mounts)

## Context

When adopting an unmanaged server, `AdoptServer` in `agent/server.go` reads `inspect.HostConfig.Mounts` to find existing bind mounts. Docker-compose containers may store bind mounts under `HostConfig.Binds` instead, causing adoption to miss the original mount sources and create new empty directories. This loses server data (mods, world saves, config).

## Phase 1: Investigate — Confirm the Binds vs Mounts hypothesis
- [x] Inspect an unmanaged docker-compose container's `HostConfig.Binds` vs `HostConfig.Mounts`
- [x] Verify the adopted containers have different mount paths than the originals
- [x] Confirm the original data (with mods) is still at the old paths

## Phase 2: Fix Agent — Use top-level inspect.Mounts
- [x] Update `AdoptServer()` in `agent/server.go` — use `inspect.Mounts` + `.Destination`
- [x] Update `GetContainerDataPath()` — same fix
- [x] Update `InspectContainer()` — same fix

## Phase 3: Test — Verify fix on test VM
- [x] Build agent with fix
- [x] Deploy to test VM (zedops-test-agent)
- [x] Create Binds-style unmanaged container with known INI data
- [x] Adopt via dev UI — mount sources correctly read as `/tmp/test-adopt-bin` and `/tmp/test-adopt-data`
- [x] New container preserves original mount paths
- [x] Server data (INI with mods) survives adoption
- [x] ZedOps labels applied, shows as Managed in UI

## Phase 4: Deploy & verify
- [ ] Commit and deploy to dev + prod

## Files to Modify

| File | Change |
|------|--------|
| `agent/server.go` | Fix mount extraction in `AdoptServer()` to handle Binds |
