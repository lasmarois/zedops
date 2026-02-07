# M9.8.42 Progress Log

## Session: 2026-01-18

### 11:50 - Investigation Started
- User reported: build42-testing ports showing 16285-16286 in UI but server INI resets to 16261-16262
- Inspected container env vars - confirmed SERVER_DEFAULT_PORT and SERVER_UDP_PORT have defaults

### 12:00 - Root Cause Identified
- Found the bug in `manager/src/routes/agents.ts`
- Only `RCON_PORT` is added to config map
- `SERVER_DEFAULT_PORT` and `SERVER_UDP_PORT` are NOT added
- Ports are passed separately for Docker bindings but not as env vars

### 12:25 - Fix Applied
Fixed 4 code locations in `manager/src/routes/agents.ts`:
1. Server create flow (~line 1049) ✅
2. Server recreate flow (~line 1395) ✅
3. Apply-config rebuild flow (~line 2677) ✅
4. Apply-config auto-recovery flow (~line 2752) ✅

Renamed `configWithRconPort` to `configWithPorts` and added:
- `SERVER_DEFAULT_PORT: gamePort.toString()`
- `SERVER_UDP_PORT: udpPort.toString()`

### 12:26 - Deployed
Version: 9f310c49-7710-4644-a864-00781c9fe434
URL: https://zedops.mail-bcf.workers.dev

### 12:40 - Port Fix Verified
User confirmed ports now work after Apply & Restart.

### 12:45 - Additional Fix: BETABRANCH env var
User reported betabranch config not applying. Found naming mismatch:
- Frontend was using `BETA_BRANCH` (with underscore)
- Docker image expects `BETABRANCH` (no underscore)

Fixed in 3 files:
- `ServerForm.tsx` - BETA_BRANCH → BETABRANCH
- `ConfigurationDisplay.tsx` - BETA_BRANCH → BETABRANCH
- `ConfigurationEdit.tsx` - BETA_BRANCH → BETABRANCH

### 12:50 - Deployed
Version: 7f86bc27-8b94-43d3-8527-039a1ded301e

### 13:00 - All Fixes Verified ✅

Container env vars confirmed correct:
```
SERVER_DEFAULT_PORT=16285 ✅
SERVER_UDP_PORT=16286 ✅
BETABRANCH=unstable ✅
RCON_PORT=27027 ✅
```

**M9.8.42 COMPLETE**
