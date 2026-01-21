# M10.3 - Auto-Update Push Notifications - Findings

## Current Implementation

### Agent (`autoupdate.go`)
- Checks on startup
- Polls every 6 hours (to be removed)
- Fetches `/api/agent/version`
- Downloads from GitHub releases
- Uses `syscall.Exec()` for in-place restart

### Manager (`index.ts`)
- `/api/agent/version` returns hardcoded `1.0.0`
- No broadcast mechanism exists

## GitHub API

### Releases Endpoint
```
GET https://api.github.com/repos/lasmarois/zedops/releases
```

### Latest Agent Release
Filter for tags matching `agent-v*`, sort by date, get first.

### Rate Limits
- Unauthenticated: 60 requests/hour
- With caching (1 hour): Only 1 request/hour max

## WebSocket Message Protocol

Existing subjects:
- `agent.register` / `agent.register.response`
- `agent.heartbeat` / `agent.heartbeat.ack`
- `server.*` commands
- `logs.*` streaming

New subject:
- `agent.update.available` - Push notification for updates
