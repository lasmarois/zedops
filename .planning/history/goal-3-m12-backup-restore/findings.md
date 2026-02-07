# Findings: Goal #3 — M12: Backup & Restore

## Codebase Patterns Discovered

### Agent Message Handler Pattern (agent/main.go)
- Each handler follows: parse msg.Data → validate → do work → send reply to msg.Reply
- Progress messages sent as fire-and-forget (no reply subject)
- Use `a.sendMessage()` with connMutex for thread safety

### MoveServerData Pattern (agent/server.go:671-859)
- Best reference for backup implementation
- Progress callback: `ProgressCallback func(progress MoveProgress)`
- Phases: calculating → copying → verifying → cleaning → complete
- Uses `filepath.Walk` for file counting and progress
- Cleans up on failure (os.RemoveAll partial copy)

### DO Request/Reply (AgentConnection.ts)
- `sendMessageWithReply()` — generates `_INBOX.{uuid}`, stores in pendingReplies map
- `handleServerMoveDataRequest` — 5min timeout, manual inbox pattern
- Progress broadcast: `handleMoveProgress` sends to all `logSubscribers` via `subscriber.ws.send()`

### API Route Pattern (routes/agents.ts)
- Auth: `requireAuth(c)` → `requirePermission(c, env, agentId, 'operator')`
- DO proxy: get stub → call DO fetch → return response
- Server lookup: query D1 for server by ID, verify it belongs to the agent

### Frontend Patterns
- `useMoveProgress.ts` — WebSocket hook filtering by subject + serverName
- `useServers.ts` — TanStack Query mutations with `queryClient.invalidateQueries()`
- `api.ts` — fetch wrapper functions with auth headers

## RCON Pre-Save

- RCON password stored in server config JSON as `RCON_PASSWORD`
- Agent connects to RCON via Docker network (container IP on zomboid-backend)
- RCONManager already exists — can reuse `Connect()` + `Execute()` + `Disconnect()`
- Save command: `save` (Project Zomboid RCON command)

## Server Data Layout

```
{dataPath}/{serverName}/
├── bin/          # Game server binaries (large, recreatable)
├── data/         # Save data (what we back up)
└── backups/      # NEW — where backups go
    ├── 2026-02-07T12-00-00_manual.tar.gz
    ├── 2026-02-07T12-00-00_manual.meta.json
    └── ...
```

## Migration Numbering
- Latest migration: check `manager/migrations/` for highest number
- Will use 0015 (or next available)

## Auto-Update Blocks Dev Testing
- Agent auto-updates to latest GitHub release on every startup (`updater.CheckOnce()`)
- This replaces locally-built dev binaries with the released version (which lacks new features)
- **Fix**: Added `--no-update` flag to skip auto-update for development
- Also skips push-based update notifications (doesn't set `agent.updater`)
- **Usage**: `./zedops-agent --no-update --manager-url wss://... --name ...`

## Bug: Hardcoded WS URL in Agent Install Command
- When generating an ephemeral token via "Add Agent" UI, the install command always uses `wss://zedops.mail-bcf.workers.dev/ws` (production)
- Even when on the dev environment (`zedops-dev.mail-bcf.workers.dev`), the install script URL is hardcoded to prod
- **Should be**: derive the WS URL from the current environment (e.g. `window.location.host`)
- **Impact**: Agents registered from dev UI connect to prod instead of dev
- **Fix location**: Likely in the frontend component that renders the install command, and/or the API that generates the token response
