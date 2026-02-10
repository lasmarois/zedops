# Goal #21: Findings

## How Mods Are Configured

PZ servers store mods in two places:
1. **ENV vars** (`SERVER_MODS`, `SERVER_WORKSHOP_ITEMS`) — used by the Docker image entrypoint to SET mods on first boot
2. **INI file** (`{dataMount}/Server/{serverName}.ini`) — the actual runtime config that PZ reads

When mods are installed directly via the INI file (common practice), the ENV vars are never set. The config tab only reads ENV vars → shows "No mods installed".

## INI File Locations

The INI path follows: `{data_mount_source}/Server/{serverName}.ini`

Where `data_mount_source` is the host-side path of the container's `/home/steam/Zomboid` mount.

### Existing servers on maestroserver:
- `build42-jan26`: `/Volumes/Data/mnt/fast/dockers/steam-zomboid-servers/data.build42-jan26/Server/build42-jan26.ini`
  - `Mods=\SkillRecoveryJournal;\errorMagnifier;\ChuckleberryFinnAlertSystem`
  - `WorkshopItems=2503622437;2896041179;3077900375`
- `newyear`: `/Volumes/Data/mnt/fast/dockers/steam-zomboid-servers/data.newyear/Server/newyear.ini`
  - `Mods=arandomcharmod;Authentic Z - Current;BetterSortCC;MiniHealthPanel;ToadTraits;PlayersOnMap;SkillRecoveryJournal;arandomcharclothesmod`
  - `WorkshopItems=2726628764;2335368829;2866258937;1299328280;2732804047;2313387159;2503622437`

**IMPORTANT**: These are at the OLD paths (pre-adoption). The adopted containers have NEW empty data dirs at `/Volumes/Data/zedops/{name}/data/` with empty Mods/WorkshopItems. See "Adoption Mount Bug" below.

## Adoption Mount Bug (Separate Issue — Goal #22)

During adoption (`AdoptServer` in server.go:1087-1239), the code reads `inspect.HostConfig.Mounts` to find existing bind mounts. However, containers created via docker-compose may store bind mounts under `HostConfig.Binds` instead of `HostConfig.Mounts`. This causes the adoption to:
1. Miss the original mount sources
2. Create NEW empty directories at `{dataPath}/{name}/bin` and `{dataPath}/{name}/data`
3. The PZ server starts fresh with empty config (no mods, no world data)

The original data with mods remains orphaned at the old paths.

**This is the real reason mods don't show** — the adopted containers lost their data during adoption.

## Agent Patterns for File Reading

Existing patterns in `agent/server.go`:
- `GetContainerDataPath(ctx, containerID)` (line 868-893) — inspects container, finds `/home/steam/Zomboid` mount source
- `CheckServerData(serverName, dataPath)` (line 616-642) — checks if bin/data dirs exist
- Volume size calculation (line 1268-1306) — recursive dir walking

Existing DO communication pattern:
- `sendMessageWithReply()` in AgentConnection.ts (line 1201) — sends message, waits for reply with timeout

## Key Code Locations

| Component | File | Lines |
|-----------|------|-------|
| Config display (mods section) | `frontend/src/components/ConfigurationDisplay.tsx` | 120-147 |
| Config edit (mods fields) | `frontend/src/components/ConfigurationEdit.tsx` | 357-397 |
| Server detail API | `manager/src/routes/servers.ts` | 172-289 |
| DO route routing | `manager/src/durable-objects/AgentConnection.ts` | ~300-340 |
| `sendMessageWithReply` | `manager/src/durable-objects/AgentConnection.ts` | 1201-1226 |
| Agent message switch | `agent/main.go` | 377-449 |
| `GetContainerDataPath` | `agent/server.go` | 868-893 |
| `AdoptServer` (mount extraction) | `agent/server.go` | 1101-1131 |
