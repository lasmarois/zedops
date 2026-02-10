# Goal #22: Findings

## The Bug

`AdoptServer()` in `agent/server.go:1101-1114` only reads `inspect.HostConfig.Mounts`:
```go
if inspect.HostConfig != nil {
    for _, m := range inspect.HostConfig.Mounts {
        switch m.Target {
        case "/home/steam/zomboid-dedicated":
            binSource = m.Source
        case "/home/steam/Zomboid":
            dataSource = m.Source
        }
    }
}
```

Docker-compose containers created with `volumes:` syntax may store bind mounts in `HostConfig.Binds` (string format `"/host:/container"`) instead of `HostConfig.Mounts` (struct format). When Binds are used, Mounts is empty → adoption creates new empty dirs.

## Evidence

**Adopted containers (new empty paths):**
- `steam-zomboid-build42-jan26`: `/Volumes/Data/zedops/build42-jan26/data` → empty Mods/WorkshopItems
- `steam-zomboid-newyear`: `/Volumes/Data/zedops/newyear/data` → empty Mods/WorkshopItems

**Original data (old paths with mods):**
- `build42-jan26`: `/Volumes/Data/mnt/fast/dockers/steam-zomboid-servers/data.build42-jan26/Server/build42-jan26.ini`
  - `Mods=\SkillRecoveryJournal;\errorMagnifier;\ChuckleberryFinnAlertSystem`
  - `WorkshopItems=2503622437;2896041179;3077900375`
- `newyear`: `/Volumes/Data/mnt/fast/dockers/steam-zomboid-servers/data.newyear/Server/newyear.ini`
  - `Mods=arandomcharmod;Authentic Z - Current;BetterSortCC;MiniHealthPanel;ToadTraits;PlayersOnMap;SkillRecoveryJournal;arandomcharclothesmod`
  - `WorkshopItems=2726628764;2335368829;2866258937;1299328280;2732804047;2313387159;2503622437`

## Docker Binds Format

`HostConfig.Binds` is a string array: `["/host/path:/container/path:rw"]`
- Split on `:` to get source and target
- Optional third element is options (ro, rw, etc.)

## Key Code Locations

| What | File | Lines |
|------|------|-------|
| AdoptServer mount extraction | `agent/server.go` | 1101-1131 |
| InspectContainer (similar pattern) | `agent/server.go` | 952-1069 |
| GetContainerDataPath (also uses Mounts only) | `agent/server.go` | 868-893 |

## Path Equivalence

`/Volumes/Data/docker_composes/steam-zomboid-servers/` and `/Volumes/Data/mnt/fast/dockers/steam-zomboid-servers/` are the SAME directory (same inodes). Likely a bind mount at the filesystem level. Docker-compose uses relative `./` paths which resolve to the former.

## Docker-compose env files

- `/Volumes/Data/docker_composes/steam-zomboid-servers/.env.newyear`
- `/Volumes/Data/docker_composes/steam-zomboid-servers/.env.build42-jan26`
