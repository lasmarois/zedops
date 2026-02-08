# Goal #6: Findings

## Key Discovery
- The old healthcheck reported healthy during ALL boot phases (steamcmd, entry.sh, Java loading)
- Docker's `--start-period` was only 30s — way too short for game boot
- `ss` command (from `iproute2`) is the most reliable way to check UDP port binding
- `iproute2` was not previously installed in the Docker image — added to apt-get

## Timing Analysis
| Parameter | Old | New | Rationale |
|-----------|-----|-----|-----------|
| interval | 30s | 15s | Faster ready detection |
| timeout | 10s | 10s | Unchanged |
| start-period | 30s | 300s | Covers full boot (SteamCMD + Java) |
| retries | 3 | 5 | More tolerance after start-period |
