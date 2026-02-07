# Goal #4: Findings

## Boot Process (entry.sh)

The container boot has these phases:
1. **Permissions fix** (docker-entrypoint.sh, runs as root)
2. **Branch detection** (entry.sh, checks `.branch_marker`)
3. **SteamCMD update** (steamcmd.sh, downloads/validates ~6.9GB)
4. **First-run init** (starts Java briefly to create INI, then kills it)
5. **ENV→INI sync** (sed replacements for all config variables)
6. **Start server** (exec start-server.sh → Java → UDP ports bind)

## Current Health Check (Dockerfile:121-124)

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD pgrep -f "java.*ProjectZomboid64" > /dev/null && \
        grep -q ":$(printf '%04X' ${SERVER_DEFAULT_PORT}) " /proc/net/udp && \
        grep -q ":$(printf '%04X' ${SERVER_UDP_PORT}) " /proc/net/udp || exit 1
```

- Only passes when Java + UDP ports are up (final state)
- start-period=120s (2min) → too short for Steam updates
- After 2min: 3 retries × 30s = 90s more → goes "unhealthy" at ~3.5min

## Processes During Each Phase

| Phase | Running Process | Current Check | Should Report |
|-------|----------------|---------------|---------------|
| SteamCMD update | `steamcmd` | FAIL | starting/healthy |
| First-run init | `java.*ProjectZomboid64` briefly | PASS briefly | starting |
| ENV config | nothing (sed commands) | FAIL | starting |
| Server starting | `java.*ProjectZomboid64` | FAIL (no ports yet) | starting |
| Server ready | `java.*ProjectZomboid64` + ports | PASS | healthy |
| Server crashed | nothing | FAIL | unhealthy (correct!) |

## Key Findings

### Process Name Discovery
The game server process is `./ProjectZomboid64` — NOT `java.*ProjectZomboid64`. The old health check pattern was wrong. PZ64 is a native binary (not a Java process), though it may use JNI internally.

### Kernel Process Name Truncation
Linux truncates process names in `/proc/[pid]/comm` to 15 characters. `ProjectZomboid64` (18 chars) → `ProjectZomboid6`. This means `pgrep -x ProjectZomboid64` fails. Must use `pgrep -f` to match against full cmdline.

### PID 1 is `runuser`, not `entry.sh`
The actual PID 1 is `runuser -u steam -- /usr/local/bin/entry.sh`. The entry.sh script runs as a child, and when it does `exec start-server.sh`, PID 26 becomes `start-server.sh`. So:
- PID 1: `runuser ... entry.sh` (always present)
- PID 26: `start-server.sh` (after setup, before game starts)
- PID 332+: `ProjectZomboid64` (game server)

### pgrep Self-Match Risk
`pgrep -f "steamcmd"` will match its own `bash -c "..."` command when run via `docker exec`. But when Docker runs the health check (`CMD bash /usr/local/bin/scripts/healthcheck.sh`), the script filename doesn't contain "steamcmd" or "ProjectZomboid64", so no self-match occurs. Used `pgrep -x steamcmd` (exact match) for extra safety.
