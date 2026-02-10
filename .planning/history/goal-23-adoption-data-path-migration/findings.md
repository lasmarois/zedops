# Goal #23: Findings

## Existing Infrastructure

### Move Data Flow (already built)
- `server.movedata` message: agent copies `{oldBase}/{name}/*` → `{newBase}/{name}/*`
- Progress streaming via `move.progress` WebSocket messages
- Two-step UI: save config → apply config (triggers move + rebuild)
- Safe copy-first, delete-after approach
- `MoveServerData()` in `agent/server.go` (lines 682-867)
- `useMoveProgress` hook in frontend for real-time progress

### Adopt Flow (current)
- Frontend `AdoptServerDialog.tsx` — collects name, ports only. No data path field.
- API `POST /api/agents/:id/servers/adopt` — merges inspect + user overrides
- Agent `AdoptServer()` — inspects container, reuses mount paths, recreates container
- Mount path extraction uses `inspect.Mounts` (top-level, works for both Binds and Mounts style)
- Returns only container ID — no data path info sent back

### Inspect Response
- `ServerInspectResponse` already includes `Mounts []MountInfo` (source, target, type)
- Frontend receives this via `inspectContainer()` query — **mount data already available in dialog**

### Key Paths
- Standard ZedOps: `{base}/{name}/bin` and `{base}/{name}/data`
- Adopted newyear: `/Volumes/Data/mnt/fast/dockers/steam-zomboid-servers/bin.newyear` and `data.newyear`
- Agent default: stored in `agents.server_data_path` in D1

### D1 State (current)
- `newyear`: `server_data_path = NULL`, `container_id = 7bc263eb...`
- `build42-jan26`: `server_data_path = NULL`, `container_id = 8501458e...`
- Both adopted, both with non-standard mount layouts

### copyFile utility
- Already exists in `agent/server.go` (line 905-918)
- Used by `MoveServerData()` — can be reused for adopt migration
