# Goal #22: Progress

## Session 1 — 2026-02-09

### Context
- Discovered during Goal #21 investigation (INI mod display)
- Adoption of `steam-zomboid-newyear` and `steam-zomboid-build42-jan26` created new empty data dirs
- Original server data with mods/world orphaned at old docker-compose paths
- Root cause: `AdoptServer()` only reads `HostConfig.Mounts`, misses `HostConfig.Binds`

### Completed
- Confirmed hypothesis: Binds-style containers have `HostConfig.Mounts = null`
- Fixed 3 functions in `agent/server.go`: `AdoptServer`, `GetContainerDataPath`, `InspectContainer`
- All now use `inspect.Mounts` (top-level) + `.Destination` instead of `inspect.HostConfig.Mounts` + `.Target`
- Tested on test VM: Binds-style container adopted with original mounts preserved, INI data intact
- Committed to dev: `b358be9`

## Session 2 — 2026-02-10 (Prod Restoration & Real Test)

### Plan: Restore servers to original unmanaged state

**Current state on maestroserver:**
- `steam-zomboid-newyear`: ZedOps-adopted, mounts at `/Volumes/Data/zedops/newyear/{bin,data}` (empty game data)
- `steam-zomboid-build42-jan26`: ZedOps-adopted, mounts at `/Volumes/Data/zedops/build42-jan26/{bin,data}` (empty game data)
- Original game data with mods at `/Volumes/Data/docker_composes/steam-zomboid-servers/{bin,data}.{name}/` (same inodes as `/Volumes/Data/mnt/fast/dockers/...`)

**Key finding:** `/Volumes/Data/docker_composes/steam-zomboid-servers/data.newyear` and `/Volumes/Data/mnt/fast/dockers/steam-zomboid-servers/data.newyear` are the SAME directory (same inode). No data duplication.

**Steps:**
1. [x] Stop & remove adopted containers (they had empty data, no loss)
2. [x] Bring up containers via docker-compose (`docker compose up -d newyear build42-jan26`)
3. [x] Verify containers running with Binds-style mounts and original data paths
4. [x] Remove server records from prod D1
5. [x] Deploy fixed agent binary to prod (`--no-update`)
6. [x] Deploy manager to prod (includes port conflict fix)
7. [x] Adopt newyear via prod UI — mount sources: `/Volumes/Data/mnt/fast/dockers/steam-zomboid-servers/{bin,data}.newyear` — SUCCESS
8. [x] Adopt build42-jan26 via prod UI — mount sources: `.../build42-jan26` — SUCCESS (shared RCON 27015 no longer conflicts)
9. [x] Both servers healthy, mods intact in INI files
