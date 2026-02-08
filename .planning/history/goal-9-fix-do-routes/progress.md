# Goal #9 Progress Log

## Session 1 — 2026-02-07
- Found `/servers/checkdata` missing from DO during Goal #8 check-data investigation
- Fixed check-data route: `/internal/check-data` → `/check-data` (pathname parsing bug)
- Fixed checkdata calls in apply-config: switched to `/check-data` with correct request format
- Committed and deployed `46f215f`
- Testing apply-config auto-recovery on dev:
  - Removed backup-test container from test VM
  - Applied config change (Public Name = "Backup Test Server")
  - Rebuild hit "no such container" → check-data called → agent returned data_exists=true (FIX WORKS)
  - But auto-recovery failed: `/servers/${serverId}/create` route doesn't exist in DO
  - Fixed: changed to `POST /servers` (the existing create route)
  - Manually deployed fix to dev, retesting...
  - Found SECOND broken route: `http://do/servers/${serverId}/create` → no DO handler
  - Fixed: changed to `POST http://do/servers` (existing create handler)
  - Manually deployed second fix to dev
  - Retest: Edit config (set Max Players=16) → Save → Apply Changes
  - Agent logs confirm full flow: checkdata → data_exists=true → server.create with new config
  - Server came back: Starting, 58s uptime, config applied (PUBLIC_NAME, MAX_PLAYERS)
  - Stopped backup-test to free resources
