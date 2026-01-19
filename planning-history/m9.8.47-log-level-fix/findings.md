# M9.8.47 - Agent Log Level Improvements - Findings

## Log Flow Architecture
```
Agent (Go)
  └─ log.Printf("Failed to create server...")
  └─ LogCapture.Write() intercepts log output
  └─ containsAny() detects level from keywords
  └─ AgentLogLine{level: "INFO/WARN/ERROR"} sent via WebSocket

Manager (DO)
  └─ Receives agent.logs.line
  └─ Forwards to UI subscribers unchanged

Frontend
  └─ useAgentLogStream receives AgentLogLine
  └─ AgentLogViewer filters by level
  └─ TerminalLog renders with level-based styling
```

## Root Cause Analysis

**Location:** `agent/logcapture.go:50-61`

**Original Detection:**
```go
if containsAny(message, []string{"ERROR", "error:", "Error:", "FATAL", "fatal:"}) {
    level = "ERROR"
}
```

**Problem:** "Failed to create server" doesn't match any keyword

**Fix:** Add "Failed to", "failed to", "Failed:", "failed:" to ERROR list

## Error Patterns Found in Agent Code

From grep of `log.Printf.*[Ff]ailed`:
- `Failed to create server %s: %v`
- `Failed to delete server`
- `Failed to rebuild server`
- `Failed to start container`
- `Failed to stop container`
- `Failed to restart container`
- `Failed to list containers`
- `Failed to collect metrics`
- `Failed to send heartbeat`
- `Connection failed`
- `Registration/authentication failed`
- `RCON command failed`
- `RCON connection failed`
- `Copy failed`

All use "Failed" or "failed" - the fix covers all of these.

## Frontend Verification ✅

TerminalLog component (`terminal-log.tsx:46-50`) has proper ERROR styling:
```javascript
ERROR: {
  icon: XCircle,           // Red X icon
  color: 'text-red-400/90', // Red text
  bg: 'bg-red-500/10',      // Red tint background
},
```

Frontend is correctly configured - only the agent detection was broken.
