# Findings: P4/P5 Debug Session

## Investigation Results

### Agent RCON Logs
(pending)

### API Response Check
(pending)

### Request Flow Analysis
```
Frontend (QuickActions.tsx)
  → executeRconCommand(agentId, serverId, command)
  → POST /api/agents/:id/servers/:serverId/rcon/command

Manager (agents.ts route)
  → Gets server config (RCON port, password)
  → Forwards to Durable Object: http://do/rcon/command

Durable Object (AgentConnection.ts)
  → handleOneShotRconCommand()
  → sendMessageWithReply("rcon.connect")
  → sendMessageWithReply("rcon.command")
  → send("rcon.disconnect")

Agent (main.go)
  → handleRCONConnect()
  → handleRCONCommand()
  → handleRCONDisconnect()
```

## Key Discoveries

### Bug Found: Wrong RCON Port Source
**Location:** `manager/src/routes/agents.ts` line 2985

**Problem:**
```typescript
const rconPort = parseInt(config.RCON_PORT || '27015', 10);
```
This reads RCON_PORT from the config JSON, but the config may not contain this field. The actual RCON port is stored in the `servers.rcon_port` column.

**Evidence from agent logs:**
- Failed attempts used `port:27015` (default fallback)
- Successful RCON terminal uses `port:27027` (correct port from DB)

**Fix:**
Query `rcon_port` column from servers table and use that instead of config JSON.

### Bug #2: Agent Sending Unsolicited rcon.disconnect.response
**Location:** `agent/main.go` line 1416

**Problem:**
The Durable Object sends `rcon.disconnect` as fire-and-forget (no replyTo). But the agent's `handleRCONDisconnect()` always sends a response. When no `replyTo` is set, it falls back to subject `rcon.disconnect.response`, which the manager doesn't know how to handle, causing an error.

**Evidence from agent logs:**
```
16:05:00.587344 [RCON] Executed command 'save' on session ...
16:05:01.604575 [RCON] Disconnected session ...
16:05:01.646834 Received: error - map[message:Unknown subject: rcon.disconnect.response]
```

**Fix:**
Modified agent to only send disconnect response if `msg.Reply != ""` (i.e., a replyTo was requested).
