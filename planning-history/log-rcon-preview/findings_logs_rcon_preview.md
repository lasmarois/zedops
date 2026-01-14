# Findings: Log & RCON Preview Investigation

**Task:** Make log and RCON previews show real data on ServerDetail Overview tab

---

## Components Found

### LogViewer Component (/frontend/src/components/LogViewer.tsx)
**Status**: Fully functional, used in Logs tab

**Key features**:
- Uses `useLogStream` hook for real-time log streaming
- Displays logs with timestamps and stream types (stdout/stderr)
- Has filters (stream type, search term)
- Auto-scroll functionality
- Pause/resume streaming
- Clear logs button

**Hook used**: `useLogStream({ agentId, containerId })`

**Data structure**:
```typescript
interface Log {
  timestamp: number;
  stream: 'stdout' | 'stderr';
  message: string;
}
```

**Returns**:
```typescript
{
  logs: Log[],        // Array of log entries
  isConnected: boolean,
  error: string | null,
  clearLogs: () => void
}
```

### RconTerminal Component (/frontend/src/components/RconTerminal.tsx)
**Status**: Fully functional, used in RCON tab

**Key features**:
- Uses xterm.js for terminal display
- Uses `useRcon` hook for RCON connection
- Command history (stored in localStorage)
- Quick actions (refresh players, save world, broadcast)
- Player management (kick/ban buttons)
- Retry logic with exponential backoff

**Hook used**: `useRcon({ agentId, serverId, containerID, port, rconPassword, enabled })`

**Returns**:
```typescript
{
  isConnected: boolean,
  error: string | null,
  sendCommand: (cmd: string) => Promise<string>,
  isRetrying: boolean,
  retryAttempt: number,
  maxRetries: number,
  manualRetry: () => void
}
```

**Command handling**:
- Commands stored in `currentCommandRef` and `commandHistory` state
- Responses handled inline in terminal buffer
- No easy way to extract "last N commands" without refactoring

---

## ServerDetail Current State (lines 290-346)

### Log Preview (lines 290-316)
**Current code**:
```jsx
<div className="text-sm text-muted-foreground space-y-1 font-mono">
  <div>[12:34:56] Server started on port 16261</div>
  <div>[12:35:02] Player 'John' connected</div>
  <div className="text-warning">[12:35:45] WARNING: High memory usage</div>
  <div>[12:36:15] Player 'Sarah' connected</div>
  <div>[12:37:22] Autosaving world...</div>
  <div className="text-xs text-center text-muted-foreground pt-2">
    Last 5 lines • Click "Expand View" for full logs
  </div>
</div>
```

**What's missing**: Real log data

### RCON Preview (lines 318-346)
**Current code**:
```jsx
<div className="text-sm text-muted-foreground space-y-2 font-mono">
  <div>
    <span className="text-primary">&gt;</span> players
  </div>
  <div>Players online (5): John, Sarah, Mike, Alex, Jordan</div>
  <div className="pt-2">
    <span className="text-primary">&gt;</span> servermsg Welcome to the server!
  </div>
  <div>Message broadcast to all players</div>
  <div className="text-xs text-center text-muted-foreground pt-2">
    Click "Expand View" for full RCON terminal
  </div>
</div>
```

**What's missing**: Real RCON data or at least helpful content

---

## Implementation Strategy

### For Log Preview

**✅ Best approach**: Reuse existing `useLogStream` hook

**Reasoning**:
- Hook already exists and works
- Returns array of logs - easy to slice last 5
- Maintains real-time updates
- No additional backend work needed
- Already handles connection state and errors

**Implementation**:
1. Import `useLogStream` in ServerDetail
2. Call hook (only when server running)
3. Extract `logs` array
4. Slice to last 5: `logs.slice(-5)`
5. Map over logs to render with timestamps

**Example**:
```typescript
const { logs, isConnected: logsConnected, error: logsError } = useLogStream({
  agentId: agentId || '',
  containerId: containerID || '',
  enabled: status === 'running' && !!agentId && !!containerID
});

const recentLogs = logs.slice(-5);
```

### For RCON Preview

**⚠️ Challenge**: RconTerminal stores command history in terminal buffer (xterm.js), not in React state

**Options**:
1. **Static helper content** (easiest)
   - Show connection status
   - List common commands
   - Prompt to open full terminal

2. **Show player count only** (medium)
   - Use `useRcon` to connect
   - Run `players` command on mount
   - Display count + "View in RCON tab for more"

3. **Extract terminal buffer** (hardest)
   - Refactor RconTerminal to expose command history
   - Create shared context for command/response tracking
   - Too complex for this task

**✅ Best approach for now**: Option 1 (static helper content)

**Reasoning**:
- RCON terminal is complex (xterm.js manages display)
- Extracting history requires significant refactoring
- Preview should encourage users to open full terminal
- Can enhance later if needed

**Alternative simpler approach**: Show RCON connection status
- Use `useRcon` hook just to check connection
- Display "RCON Ready - Click to interact" when connected
- Display "Server must be running" when not

---

## Hooks Investigation

### useLogStream Hook

**Location**: `/frontend/src/hooks/useLogStream.ts` (assumption - need to verify)

**Expected interface**:
```typescript
function useLogStream(params: {
  agentId: string;
  containerId: string;
  enabled?: boolean;
}): {
  logs: Log[];
  isConnected: boolean;
  error: string | null;
  clearLogs: () => void;
}
```

**Confirmed interface**:
```typescript
function useLogStream(params: {
  agentId: string;
  containerId: string;
  enabled?: boolean;
}): {
  logs: LogLine[];           // Array with full history
  isConnected: boolean;
  error: string | null;
  clearLogs: () => void;
}

interface LogLine {
  containerId: string;
  timestamp: number;         // Unix timestamp
  stream: 'stdout' | 'stderr' | 'unknown';
  message: string;
}
```

**How it works**:
- WebSocket connection to `/api/agents/:id/logs/ws`
- Receives `log.history` (cached logs) and `log.line` (new logs) messages
- Auto-reconnects with exponential backoff
- Maintains full log array in state

### useRcon Hook

**Location**: `/frontend/src/hooks/useRcon.ts`

**Confirmed interface**:
```typescript
function useRcon(params: {
  agentId: string;
  serverId: string;
  containerID: string;
  port: number;
  rconPassword: string;
  enabled?: boolean;
}): {
  isConnected: boolean;
  sessionId: string | null;
  error: string | null;
  isRetrying: boolean;
  retryAttempt: number;
  maxRetries: number;
  sendCommand: (cmd: string) => Promise<string>;
  disconnect: () => void;
  manualRetry: () => void;
}
```

**How it works**:
- WebSocket connection to `/api/agents/:id/logs/ws`
- Sends `rcon.connect` to establish RCON session
- Returns `sessionId` for command execution
- Retry logic for connection failures (5 attempts with exponential backoff)

---

## Implementation Plan (Finalized)

### Log Preview
✅ **Use `useLogStream` hook**
- Call hook with `agentId`, `containerId`, `enabled: status === 'running'`
- Slice last 5 logs: `logs.slice(-5)`
- Format timestamp using `Date.toLocaleTimeString()`
- Color-code stdout (green) vs stderr (red)
- Show "No logs yet" when empty
- Show "Server must be running" when status !== 'running'

### RCON Preview
✅ **Show static helper content**
- Don't connect to RCON (avoid unnecessary resource usage)
- Show helpful text directing users to RCON tab
- List common RCON commands
- Keep preview simple and informative

---

## Next Steps

1. ✅ Read hook implementations to confirm interfaces
2. ⏳ Implement Log Preview with real data
3. ⏳ Implement RCON Preview (static helper)
4. ⏳ Test both previews
5. ⏳ Update progress log
