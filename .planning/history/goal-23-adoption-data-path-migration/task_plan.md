# Goal #23: Adoption Data Path Migration

## Problem

When adopting a container, the agent correctly preserves existing mount paths (e.g., `/Volumes/Data/mnt/fast/dockers/steam-zomboid-servers/data.newyear`), but:

1. `server_data_path` is stored as `NULL` in D1 (frontend doesn't send it)
2. The UI falls back to the agent's default path — **wrong** for adopted containers
3. Adopted containers often have **non-standard** directory layouts (e.g., `data.servername/` instead of `servername/data/`)
4. All management operations (backup, volume sizes, rebuild, delete) assume the ZedOps convention: `{base}/{name}/data` and `{base}/{name}/bin`

## Solution

During adoption, **move** the container's data from its current location into the ZedOps-standard layout at the chosen data path. This leverages the existing `server.movedata` infrastructure (copy → verify → delete original).

### User Flow

1. User clicks "Adopt" on an unmanaged container
2. Adopt dialog shows container's **current mount paths** (read-only, from inspect)
3. User can choose a **destination data path** (defaults to agent's `server_data_path`)
4. On submit:
   - Container is adopted (stopped, recreated with ZedOps labels)
   - Data is moved from original mounts to `{dataPath}/{name}/bin` and `{dataPath}/{name}/data`
   - New container is started with the standard mount layout
   - `server_data_path` is stored in D1

---

## Phase 1: Agent — Return mount paths + move during adoption `status: complete`

### Tasks

- [ ] 1.1 Add `DataPath` field to `ServerOperationResponse` struct
- [ ] 1.2 Add `AdoptResult` return type to `AdoptServer()` (container ID + resolved data path)
- [ ] 1.3 Change adopt logic: ALWAYS create standard layout dirs `{dataPath}/{name}/bin` and `{dataPath}/{name}/data`
- [ ] 1.4 If existing mounts found, **copy** data from old mount paths into new standard dirs (reuse `copyFile` from MoveServerData)
- [ ] 1.5 Create new container with standard mount layout (not the original arbitrary paths)
- [ ] 1.6 Return resolved dataPath in adopt response
- [ ] 1.7 Update `handleServerAdopt` in main.go to pass back `DataPath`

### Key Design Decision

The adopt operation itself handles the data migration — no separate move step needed. The agent:
1. Inspects container → gets existing mount sources
2. Creates standard dirs at `{dataPath}/{name}/bin` and `{dataPath}/{name}/data`
3. Copies files from old mounts to new standard dirs
4. Creates new container pointing at the standard dirs
5. Starts container
6. (Old data left in place — user can clean up manually, or we can delete after verification)

This is simpler than doing adopt + separate movedata because:
- The container is already stopped during adoption
- We're already recreating it with new mounts
- No need for two-step UI (adopt then change path)

---

## Phase 2: Manager — Store resolved data path `status: complete`

### Tasks

- [ ] 2.1 In adopt API handler: read `result.dataPath` from agent response
- [ ] 2.2 Store it as `server_data_path` in D1 (UPDATE after successful adoption)
- [ ] 2.3 Pass `server_data_path` through in the inspect response for the adopt dialog to show current paths

---

## Phase 3: Frontend — Show paths + data path choice in adopt dialog `status: complete`

### Tasks

- [ ] 3.1 Show current mount paths (from inspect) in the adopt dialog as read-only info
- [ ] 3.2 Add optional "Data Path" field (defaults to agent's `server_data_path`, editable)
- [ ] 3.3 Show info message: "Data will be migrated to ZedOps standard layout at {path}/{name}/"
- [ ] 3.4 Pass `server_data_path` in the `adoptServer()` API call
- [ ] 3.5 Show adoption progress (the adopt already shows "Adopting..." but migration may take longer)

---

## Phase 4: Fix existing adopted servers `status: complete`

### Tasks

- [ ] 4.1 Query D1 for servers with `server_data_path = NULL`
- [ ] 4.2 For each: inspect container to get actual mount paths
- [ ] 4.3 Update D1 with the correct base path (parent of data mount)
- [ ] 4.4 Optionally: trigger movedata to normalize layout (only if needed)

---

## Phase 5: Test & Verify `status: complete`

### Tasks

- [ ] 5.1 Build agent, deploy manager, test adopt flow end-to-end
- [ ] 5.2 Verify volume sizes, backup, rebuild work with adopted servers
- [ ] 5.3 Verify existing servers unaffected

---

## Files to Modify

| File | Changes |
|------|---------|
| `agent/server.go` | `AdoptServer()` return type, standard layout creation, data copy |
| `agent/main.go` | `handleServerAdopt()` include DataPath in response |
| `manager/src/routes/agents.ts` | Adopt endpoint stores `server_data_path` from result |
| `manager/src/durable-objects/AgentConnection.ts` | Pass through inspect mount data |
| `frontend/src/components/AdoptServerDialog.tsx` | Show mounts, data path field |
| `frontend/src/lib/api.ts` | Pass `server_data_path` in adopt request |

## Risks

- **Large data copies during adoption** — could take minutes for big servers. Need progress indication.
- **Deleting old data** — should we auto-delete or let user clean up? Safer to leave old data.
- **Existing adopted servers** — their containers point at non-standard paths. Would need re-adoption or manual movedata to normalize.
