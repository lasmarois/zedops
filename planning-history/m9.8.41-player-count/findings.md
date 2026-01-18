# M9.8.41 - Research Findings

## Existing RCON Implementation

### Agent (`agent/rcon.go`)
- `RCONManager` handles connections to game servers
- Uses `github.com/gorcon/rcon` library
- Connects via Docker internal network (no external port needed)
- Session-based with 5-minute timeout
- Commands: `Connect()`, `Execute()`, `Disconnect()`

### Manager (`AgentConnection.ts`)
- Routes RCON commands via WebSocket
- Handles: `rcon.connect`, `rcon.command`, `rcon.disconnect`
- 30-second timeout per command

### Frontend (`RconTerminal.tsx`)
- Full terminal with xterm.js
- Already parses `players` command response
- Extracts count from: "Players connected (N): name1, name2..."

## Project Zomboid RCON Commands

| Command | Response |
|---------|----------|
| `players` | "Players connected (3): player1, player2, player3" |
| `help` | List of available commands |
| `save` | Save world |
| `servermsg "text"` | Broadcast message |

## Current Metrics Flow

```
Agent (metrics.go)
  → collectHostMetrics() every 5s
  → Sends via WebSocket: metrics.host

AgentConnection (DO)
  → Receives metrics
  → Caches in this.cachedMetrics
  → Broadcasts to subscribed UIs

Frontend (useAgents.ts)
  → Polls /api/agents every 5s
  → Displays in AgentList, Dashboard
```

## Integration Point

The cleanest integration is to add player counts to the existing metrics flow:

1. **Agent**: After collecting host metrics, also collect player counts via RCON
2. **Payload**: `{ host: {...}, players: { serverId: { count: 3, names: [...] } } }`
3. **Manager**: Store alongside host metrics
4. **Frontend**: Display with other metrics

## Considerations

### RCON Connection Management
- Creating a new RCON connection for every poll is expensive
- Could reuse existing RCONManager sessions
- Need to handle servers that don't have RCON enabled

### Error Handling
- Server not running → skip
- RCON not responding → return 0 or "unknown"
- Password wrong → log error, skip

### Performance
- 30s poll interval is reasonable
- Only poll running servers
- Cache results to avoid repeated queries
