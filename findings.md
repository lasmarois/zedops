# Docker Network Investigation - Findings

## Initial Error
```
Failed to create server buena: failed to start container: Error response from daemon: network zomboid-backend not found
```

## Environment
- Agent: `zedops-test-agent`
- Host: VM at 10.0.13.208
- Agent binary: Deployed via manual copy (not GitHub releases yet)

## Root Cause Analysis

### Network References in Code
Found in 3 files:
1. `server.go:144` - Attaches containers to both networks on creation
2. `rcon.go:60-68` - Gets container IP from `zomboid-backend` for RCON communication
3. `playerstats.go:327-329` - Gets container IP for player stats collection

### Network Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│  Docker Networks on Agent Host                                   │
├─────────────────────────────────────────────────────────────────┤
│  zomboid-backend (bridge)                                        │
│  ├── Used for agent→container communication (RCON, stats)       │
│  └── Containers get internal IPs on this network                │
│                                                                  │
│  zomboid-servers (bridge)                                        │
│  └── Reserved for future server-to-server communication         │
└─────────────────────────────────────────────────────────────────┘
```

### Why Networks Don't Exist on New Agents
- Original agent (maestroserver) had networks created manually
- Install script doesn't create networks
- New agents deployed without network setup fail on first server creation

## Solution Implemented
Auto-create networks on agent startup in `docker.go`:
- Added `EnsureNetworks()` method called after Docker client init
- Creates `zomboid-backend` and `zomboid-servers` if missing
- Labels networks with `zedops.managed=true`

## Verification
Local agent (maestroserver) logs confirm:
```
Docker network 'zomboid-backend' already exists
Docker network 'zomboid-servers' already exists
```

## Related Issue Found
Agent logs show server creation errors as INFO level instead of ERROR:
```
2026/01/19 03:48:15.727170 Failed to create server buena: failed to start container...
```
→ Added as M9.8 sub-milestone for later fix
