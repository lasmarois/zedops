# M10.3 - Auto-Update Push Notifications

## Goal
Improve auto-update to use GitHub API for version info and push notifications to connected agents.

## Design

### Update Flow
```
ON AGENT START:
  Agent → GET /api/agent/version → Compare → Update if newer

WHILE CONNECTED:
  Manager broadcasts: agent.update.available { version: "X.Y.Z" }
  Agent receives → Triggers update → Restarts with new version
```

## Phases

### Phase 1: GitHub API Version Endpoint
**Status:** `complete`
- [x] Update `/api/agent/version` to fetch from GitHub releases API
- [x] Cache response for 1 hour (avoid rate limits)
- [x] Parse `agent-v*` tag to extract version
- [x] Return download URLs for linux-amd64 and linux-arm64

### Phase 2: Agent WebSocket Handler
**Status:** `complete`
- [x] Add handler for `agent.update.available` message
- [x] Trigger `CheckOnce()` when received
- [x] Log update notification received

### Phase 3: Manager Broadcast Mechanism
**Status:** `complete`
- [x] Add method to broadcast to all connected agents
- [x] Create admin endpoint to trigger update broadcast
- [x] Broadcast includes version number

### Phase 4: Remove Polling
**Status:** `complete`
- [x] Remove 6-hour ticker from `autoupdate.go`
- [x] Keep startup check only (`CheckOnce()` method)
- [x] Update logs to reflect new behavior

### Phase 5: Testing
**Status:** `complete`
- [x] Test version endpoint returns correct version
- [x] Test agent receives push notification
- [x] Test end-to-end update flow
- [x] Verify no unnecessary API calls

## Bug Fix Applied

The `agent.update.available` switch case needed to be positioned first in the switch statement. The original code had it near the end, and due to a Go compiler/build caching issue with volume mounts, it wasn't matching properly. Moving it to the first position and using `docker cp` instead of volume mount for builds resolved the issue.

## Files to Modify

| File | Changes |
|------|---------|
| `manager/src/index.ts` | Update `/api/agent/version` to use GitHub API |
| `manager/src/durable-objects/AgentConnection.ts` | Add broadcast support |
| `manager/src/routes/admin.ts` | Add trigger endpoint |
| `agent/autoupdate.go` | Remove polling, keep startup check |
| `agent/main.go` | Add `agent.update.available` handler |

## API Changes

### GET /api/agent/version (updated)
```json
{
  "version": "1.0.1",
  "downloadUrls": {
    "linux-amd64": "https://github.com/.../zedops-agent-linux-amd64",
    "linux-arm64": "https://github.com/.../zedops-agent-linux-arm64"
  }
}
```

### WebSocket Message: agent.update.available
```json
{
  "subject": "agent.update.available",
  "data": {
    "version": "1.0.2"
  }
}
```

### POST /api/admin/broadcast-update (new)
Triggers broadcast to all connected agents.

## Success Criteria
- [ ] Version endpoint fetches from GitHub API
- [ ] Connected agents receive update notification
- [ ] Agents update without 6-hour delay
- [ ] No excessive GitHub API calls (cached)
