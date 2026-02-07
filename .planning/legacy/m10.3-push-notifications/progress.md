# M10.3 - Auto-Update Push Notifications - Progress

## Session Log

### Session 1 - 2026-01-20
- Discussed auto-update design
- Decided on: startup check + WebSocket push (no polling)
- Created planning files

## Changes Made
| File | Change | Status |
|------|--------|--------|
| `manager/src/index.ts` | GitHub API version endpoint with 1-hour caching | Complete |
| `manager/src/durable-objects/AgentConnection.ts` | Broadcast support + `broadcastToAll()` method | Complete |
| `manager/src/routes/admin.ts` | `/api/admin/broadcast-update` endpoint | Complete |
| `agent/autoupdate.go` | Removed polling, added `CheckOnce()` method | Complete |
| `agent/main.go` | Handler for `agent.update.available` message | Complete |

## Build Status
- Manager: ✅ Builds successfully (wrangler dry-run)
- Agent: ✅ Builds successfully (go build via Docker)

## Testing Results (Session 2 - 2026-01-20)

### Version Endpoint
- ✅ `GET /api/agent/version` returns `{"version":"1.0.1","downloadUrls":{...}}`
- ✅ Fetches from GitHub API with 1-hour cache

### Broadcast Update
- ✅ `POST /api/admin/broadcast-update` sends to all online agents
- ✅ Agent receives `agent.update.available` message
- ✅ Agent triggers update check

### Bug Fix
- Moved `case "agent.update.available"` to first position in switch statement
- Build with `docker cp` instead of volume mount (fixes caching issues)
