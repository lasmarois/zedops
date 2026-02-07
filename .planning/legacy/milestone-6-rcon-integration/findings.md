# Findings: Milestone 6 - RCON Integration

**Milestone:** M6 - RCON Integration
**Started:** 2026-01-11
**Status:** Research phase

---

## 1. Source RCON Protocol

**What is it:**
- Remote console protocol used by Source engine games
- Also used by Project Zomboid, Minecraft, Rust, ARK
- TCP-based, binary protocol
- Request/response pattern with authentication

**Protocol Specification:**
- Port: Configurable (Zomboid default: 27015)
- Packet format: Little-endian 32-bit integers
  ```
  | Size (4 bytes) | ID (4 bytes) | Type (4 bytes) | Body (N bytes) | Null (1 byte) | Null (1 byte) |
  ```
- Packet types:
  - `SERVERDATA_AUTH` (3) - Authentication request
  - `SERVERDATA_AUTH_RESPONSE` (2) - Auth response
  - `SERVERDATA_EXECCOMMAND` (2) - Execute command
  - `SERVERDATA_RESPONSE_VALUE` (0) - Command response

**References:**
- Valve Developer Wiki: https://developer.valvesoftware.com/wiki/Source_RCON_Protocol
- _(to be filled after research)_

---

## 2. Go RCON Libraries ✅ RESEARCHED

**Options:**

### gorcon/rcon ⭐ RECOMMENDED
- **Repo:** https://github.com/gorcon/rcon
- **Package Docs:** https://pkg.go.dev/github.com/gorcon/rcon
- **Stars:** ~400
- **Last Updated:** Active (2023+)
- **Features:**
  - Full Source RCON protocol support
  - `Dial()` - Creates authorized TCP connection
  - `Execute()` - Send commands with SERVERDATA_EXECCOMMAND
  - `SetDeadline()` - Configurable read/write timeouts
  - Multi-packet response handling
  - Option-based configuration
- **Pros:**
  - Well-maintained and actively developed
  - Comprehensive feature set
  - Proper timeout/deadline management
  - Better error handling
- **Cons:**
  - Slightly larger dependency (~few KB)

**Usage Example:**
```go
import "github.com/gorcon/rcon"

conn, err := rcon.Dial("localhost:27015", "password")
if err != nil {
    return err
}
defer conn.Close()

response, err := conn.Execute("players")
if err != nil {
    return err
}
fmt.Println(response)
```

### james4k/rcon
- **Repo:** https://github.com/james4k/rcon
- **Stars:** ~100
- **Last Updated:** Less active (last commit 2019)
- **Features:**
  - Simple RCON client
  - Basic authentication
  - Foundation for other tools (itzg/rcon-cli)
- **Pros:**
  - Minimal, straightforward API
  - Proven in production (used by itzg/rcon-cli)
- **Cons:**
  - Less active maintenance
  - API limitations (hamburghammer/grcon was created due to API issues)
  - No multi-packet support
  - Less configurable

**Note:** hamburghammer/grcon was created specifically due to dissatisfaction with james4k/rcon's API, suggesting potential usability issues for complex use cases.

### Custom Implementation
- **Pros:** Full control, no dependencies
- **Cons:** Need to implement protocol from scratch, potential bugs, maintenance burden

**✅ DECISION: Use gorcon/rcon**

**Rationale:**
1. **Active Maintenance**: Last updated 2023+, still receiving updates
2. **Feature-Rich**: Timeout management, multi-packet support, configurable options
3. **Better API**: More flexible than james4k/rcon (no known API complaints)
4. **Production-Ready**: Comprehensive error handling and connection management
5. **Small Cost**: Dependency size is negligible (~few KB), benefits outweigh costs

**References:**
- [GitHub - gorcon/rcon](https://github.com/gorcon/rcon)
- [Go Package Documentation](https://pkg.go.dev/github.com/gorcon/rcon)
- [GitHub - james4k/rcon](https://github.com/james4k/rcon)
- [Valve Source RCON Protocol](https://developer.valvesoftware.com/wiki/Source_RCON_Protocol)

---

## 3. Project Zomboid RCON Configuration ✅ RESEARCHED

**Server Configuration:**
- File: `Server/servertest.ini` (or custom server name)
- Settings:
  ```ini
  RCONEnabled=true
  RCONPort=27015
  RCONPassword=changeme
  ```

**RCON Commands (Zomboid-specific):**

### Player Management
- `players()` - List connected players with details
- `kickuser <username>` - Kick player by username
  - With reason: `/kickuser "username" -r "reason"`
- `banuser <username>` - Ban player by username
  - With IP ban: `/banuser "username" -ip -r "reason"`
- `banid <SteamID64>` - Ban by Steam ID
- `unbanuser <username>` - Unban by username
- `unbanid <SteamID64>` - Unban by Steam ID
- `voiceban "user" [-true | -false]` - Ban/unban from voice chat
- `setaccesslevel <username> <level>` - Set access level (Admin, Moderator, Overseer, GM, Observer)

### Server Management
- `save` - Force save world
- `quit` - Shutdown server
- `servermsg "message"` - Broadcast message to all players
- `adduser "username" "password"` - Add admin user
- `help` - List available commands

### Admin Tools
- `additem "username" "module.item" count` - Give item to player
- `teleport "username" x y z` - Teleport player
- `godmod "username"` - Toggle god mode
- `invisible "username"` - Toggle invisibility
- `noclip "username"` - Toggle noclip

**Command Format:**
- Console: `command arg1 arg2` (no forward slash)
- In-game: `/command arg1 arg2` (with forward slash, requires admin)
- RCON: Same as console (no forward slash)

**Full References:**
- [PZwiki - Admin Commands](https://pzwiki.net/wiki/Admin_commands)
- [Steam Guide - RCON for Servers](https://steamcommunity.com/sharedfiles/filedetails/?id=2821744058)
- [PingPlayers - RCON Commands Guide](https://pingplayers.com/knowledgebase/project-zomboid/rcon-commands-and-how-to-use-them)
- [Shockbyte - All Console Commands](https://shockbyte.com/billing/knowledgebase/479/All-Console-Commands-for-Your-Project-Zomboid-Server.html)

---

## 4. xterm.js Integration ✅ RESEARCHED

**Library:**
- **Repo:** https://github.com/xtermjs/xterm.js
- **NPM:** `xterm` + `xterm-addon-fit`
- **Official Docs:** https://xtermjs.org/
- **Usage:** Terminal emulator for web (used by VS Code, Hyper, etc.)
- **Features:**
  - VT100/ANSI escape codes
  - Cursor control
  - Colors and styling
  - Addons (fit, weblinks, search, etc.)

**React Integration Options:**

### Option 1: Manual Integration (Recommended)
Direct use of xterm.js with useRef + useEffect (full control, no wrapper overhead)

```tsx
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

function RconTerminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    // Handle input
    term.onData((data) => {
      // Send command on Enter
    });

    return () => {
      term.dispose();
    };
  }, []);

  return <div ref={terminalRef} style={{ height: '400px' }} />;
}
```

### Option 2: React Wrapper Libraries

**react-xtermjs** (by Qovery) - Modern hooks-based wrapper
- **NPM:** `react-xtermjs`
- **Pattern:** `const { instance, ref } = useXTerm()`
- **Pros:** Hooks-based, modern React patterns
- **Cons:** Additional dependency, potential version lag

**xterm-for-react** - Component wrapper
- **NPM:** `xterm-for-react`
- **Pattern:** `<XTerm ref={xtermRef} options={...} />`
- **Pros:** Simple component API
- **Cons:** Less flexible, abstraction overhead

**@pablo-lion/xterm-react** - TypeScript wrapper
- **NPM:** `@pablo-lion/xterm-react`
- **Pattern:** TypeScript-first with modern React
- **Pros:** Strong typing
- **Cons:** Smaller community

**✅ DECISION: Use Manual Integration (Option 1)**

**Rationale:**
1. **Full Control**: Direct access to xterm.js instance for advanced features
2. **No Abstraction**: Avoid potential wrapper bugs or version mismatches
3. **Well-Documented**: Plenty of examples using useRef/useEffect pattern
4. **Lightweight**: No additional dependencies beyond xterm.js itself
5. **Flexibility**: Easy to customize terminal behavior (input handling, output formatting)

**References:**
- [GitHub - xtermjs/xterm.js](https://github.com/xtermjs/xterm.js)
- [xterm.js Official Docs](https://xtermjs.org/)
- [Qovery - react-xtermjs](https://github.com/Qovery/react-xtermjs)
- [xterm-for-react](https://github.com/robert-harbison/xterm-for-react)
- [@pablo-lion/xterm-react](https://github.com/PabloLION/xterm-react)

---

## 5. Message Protocol Design

**Proposed Protocol:**

### rcon.connect
```json
Request (UI → Manager → Agent):
{
  "subject": "rcon.connect",
  "data": {
    "serverId": "server-uuid",
    "host": "localhost",
    "port": 27015,
    "password": "rcon_password"
  },
  "reply": "_INBOX.uuid"
}

Response (Agent → Manager → UI):
{
  "subject": "_INBOX.uuid",
  "data": {
    "success": true,
    "sessionId": "rcon-session-uuid",
    "error": null
  }
}
```

### rcon.command
```json
Request (UI → Manager → Agent):
{
  "subject": "rcon.command",
  "data": {
    "sessionId": "rcon-session-uuid",
    "command": "players"
  },
  "reply": "_INBOX.uuid"
}

Response (Agent → Manager → UI):
{
  "subject": "_INBOX.uuid",
  "data": {
    "success": true,
    "response": "Players online (3):\n- Player1\n- Player2\n- Player3",
    "error": null
  }
}
```

### rcon.disconnect
```json
Request (UI → Manager → Agent):
{
  "subject": "rcon.disconnect",
  "data": {
    "sessionId": "rcon-session-uuid"
  },
  "reply": "_INBOX.uuid"
}

Response (Agent → Manager → UI):
{
  "subject": "_INBOX.uuid",
  "data": {
    "success": true
  }
}
```

**Design Rationale:**
- Reuse existing message protocol (subject-based routing)
- Session ID tracks RCON connections (avoid reconnecting per command)
- Manager acts as proxy (no direct UI → Agent connection)
- Reply pattern ensures responses route back correctly

---

## 6. Session Management Strategy

**Options:**

### A. Connect on Demand
- Connect when user opens terminal
- Disconnect when user closes terminal
- **Pros:** Clean lifecycle, no idle connections
- **Cons:** Connection delay on first command

### B. Persistent Connection
- Connect on first command
- Keep alive until explicit disconnect or timeout
- **Pros:** Faster subsequent commands
- **Cons:** Need timeout/cleanup logic

### C. Connection Pool
- Pre-connect to all servers with RCON enabled
- Reuse connections across UI sessions
- **Pros:** Instant commands
- **Cons:** Complex lifecycle, resource usage

**Recommendation:** Option B (Persistent with timeout)
- Balance between performance and resource usage
- 5-minute idle timeout before auto-disconnect
- Explicit disconnect when terminal unmounts

---

## 7. RCON Security Considerations

**Risks:**
- RCON password transmitted in plaintext (no TLS in protocol)
- Admin commands can damage server (kick all, quit, etc.)
- Rate limiting needed to prevent abuse

**Mitigations:**
- Store RCON password in server config (D1 servers table)
- Encrypt at transport layer (WebSocket already uses HTTPS/WSS)
- Add RBAC check before allowing RCON access (future: Milestone 7)
- Consider rate limiting (max 10 commands/minute per user)
- Audit log all RCON commands (future: Milestone 7)

**Current Approach (MVP):**
- Admin-only access (hardcoded password check)
- No rate limiting (trust admin)
- No audit log (deferred to M7)

---

## 8. Existing ZedOps Architecture Context ✅ RESEARCHED

**Current Server Management:**
- Servers stored in D1 `servers` table
- Fields: id, agent_id, name, container_id, config (ENV vars), rcon_port, status
- RCON port already configured during server creation
- RCON password stored in config JSON field as `ADMIN_PASSWORD`

**D1 Schema (`manager/migrations/0003_create_servers_table.sql`):**
```sql
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  container_id TEXT,
  config TEXT NOT NULL,              -- JSON string: {"ADMIN_PASSWORD": "..."}
  image_tag TEXT NOT NULL,
  game_port INTEGER NOT NULL,
  udp_port INTEGER NOT NULL,
  rcon_port INTEGER NOT NULL,        -- Auto-assigned starting at 27015
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

**RCON Port Allocation Logic (`manager/src/routes/agents.ts:645-655`):**
```typescript
if (!rconPort) {
  const maxRconResult = await c.env.DB.prepare(
    `SELECT MAX(rcon_port) as max_rcon FROM servers WHERE agent_id = ?`
  ).bind(agentId).first();
  const maxRcon = maxRconResult?.max_rcon as number | null;
  rconPort = maxRcon ? maxRcon + 1 : 27015;  // Start at 27015, increment by 1
}
```

**RCON Password Storage:**
- Location: `servers.config` JSON field → `ADMIN_PASSWORD` key
- Format: Plain text JSON string
- Example: `{"SERVER_NAME":"test","ADMIN_PASSWORD":"secret123"}`
- Accessible via: `JSON.parse(server.config).ADMIN_PASSWORD`

**Server Creation Form (`frontend/src/components/ServerForm.tsx`):**
- Admin Password field (required) → stored as `ADMIN_PASSWORD` in config
- Custom RCON Port field (optional) → defaults to auto-assign
- Port validation checks:
  1. Database conflict (game/udp/rcon ports)
  2. Host-level binding (queries agent)
  3. Returns suggested port sets

**API Access:**
- `GET /api/agents/:id/servers` returns Server objects with:
  - `rcon_port` (integer) - directly accessible
  - `config` (JSON string) - must parse to get `ADMIN_PASSWORD`

**Message Flow:**
```
UI (React)
  ↓ WebSocket (wss://manager.workers.dev)
Manager (Durable Object)
  ↓ WebSocket proxy
Agent (Go binary)
  ↓ RCON TCP connection (host:port)
Zomboid Server (container at localhost:27015)
```

**Reusable Components:**
- ✅ WebSocket connection (already established)
- ✅ Message protocol (subject-based routing)
- ✅ Server metadata (RCON port, password from D1)
- ✅ Port validation system (3-layer checks)

**Key Insight:**
RCON host is always `localhost` (agent connects to local container on same machine).
Connection string: `localhost:${server.rcon_port}` with password from `config.ADMIN_PASSWORD`

---

## 9. UI/UX Design

**Terminal Layout:**
```
┌────────────────────────────────────────┐
│ RCON Console - ServerName              │
│ [Connected] [Disconnect]               │
├────────────────────────────────────────┤
│ Players Online (3)         [Refresh]   │
│ ┌──────────────────────────────────┐   │
│ │ Player1 (127.0.0.1)  [Kick][Ban] │   │
│ │ Player2 (192.168.1.5)[Kick][Ban] │   │
│ │ Player3 (10.0.0.10)  [Kick][Ban] │   │
│ └──────────────────────────────────┘   │
│ [Broadcast Message] [Save World]       │
├────────────────────────────────────────┤
│ Terminal:                              │
│ ┌──────────────────────────────────┐   │
│ │ Connected to RCON on :27015      │   │
│ │ > players                        │   │
│ │ Players online (3):              │   │
│ │ - Player1 (127.0.0.1)            │   │
│ │ - Player2 (192.168.1.5)          │   │
│ │ - Player3 (10.0.0.10)            │   │
│ │ > help                           │   │
│ │ Available commands: players,     │   │
│ │ kick, ban, save, quit, ...       │   │
│ │ > █                              │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

**Navigation:**
- Access via "RCON Console" button in ContainerList (server row)
- Or separate "RCON" tab when viewing server details
- Terminal in modal or full page (TBD)

---

## 10. Command History Implementation

**Browser Storage:**
```typescript
// Store history in localStorage
const HISTORY_KEY = `rcon-history-${serverId}`;

// Save command
const saveCommand = (cmd: string) => {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history.push(cmd);
  if (history.length > 100) history.shift(); // Keep last 100
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

// Navigate history
const [historyIndex, setHistoryIndex] = useState(-1);
const navigateHistory = (direction: 'up' | 'down') => {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  if (direction === 'up' && historyIndex < history.length - 1) {
    setHistoryIndex(historyIndex + 1);
    return history[history.length - 1 - historyIndex - 1];
  }
  if (direction === 'down' && historyIndex > 0) {
    setHistoryIndex(historyIndex - 1);
    return history[history.length - 1 - historyIndex + 1];
  }
  return null;
};
```

**xterm.js Key Handling:**
```typescript
term.onKey(({ key, domEvent }) => {
  if (domEvent.key === 'ArrowUp') {
    const cmd = navigateHistory('up');
    if (cmd) {
      // Replace current line with history command
    }
  }
  if (domEvent.key === 'ArrowDown') {
    const cmd = navigateHistory('down');
    if (cmd) {
      // Replace current line
    }
  }
  if (domEvent.key === 'Enter') {
    // Send command
  }
});
```

---

## 11. Autocomplete Implementation (Optional)

**Common Commands List:**
```typescript
const ZOMBOID_COMMANDS = [
  'players',
  'kick "username"',
  'ban "username"',
  'unban "username"',
  'save',
  'quit',
  'servermsg "message"',
  'adduser "username" "password"',
  'help',
  'additem "username" "module.item" count',
  'teleport "username" x y z',
  'invisible',
  'godmode',
  'noclip',
];

const autocomplete = (partial: string): string[] => {
  return ZOMBOID_COMMANDS.filter(cmd => cmd.startsWith(partial));
};
```

**Tab Completion:**
```typescript
term.onKey(({ key, domEvent }) => {
  if (domEvent.key === 'Tab') {
    domEvent.preventDefault();
    const suggestions = autocomplete(currentInput);
    if (suggestions.length === 1) {
      // Replace input with suggestion
    } else if (suggestions.length > 1) {
      // Show suggestions in terminal
    }
  }
});
```

---

## 12. Player List Parsing

**RCON `players` Command Output:**
```
Players connected (3):
1) "Player1" ip=127.0.0.1 ping=12ms x=10500 y=9200 z=0
2) "Player2" ip=192.168.1.5 ping=45ms x=10510 y=9205 z=0
3) "Player3" ip=10.0.0.10 ping=23ms x=10490 y=9198 z=0
```

**Parsing Logic:**
```typescript
interface Player {
  username: string;
  ip: string;
  ping: string;
  x: number;
  y: number;
  z: number;
}

const parsePlayers = (response: string): Player[] => {
  const lines = response.split('\n').slice(1); // Skip header
  return lines.map(line => {
    const match = line.match(/"([^"]+)"\s+ip=([\d.]+)\s+ping=(\d+ms)\s+x=([\d.]+)\s+y=([\d.]+)\s+z=([\d.]+)/);
    if (!match) return null;
    return {
      username: match[1],
      ip: match[2],
      ping: match[3],
      x: parseFloat(match[4]),
      y: parseFloat(match[5]),
      z: parseFloat(match[6]),
    };
  }).filter(Boolean);
};
```

---

## 13. Quick Actions Design

**Broadcast Message Modal:**
```tsx
function BroadcastModal({ onSend }: { onSend: (msg: string) => void }) {
  const [message, setMessage] = useState('');

  return (
    <div className="modal">
      <h3>Broadcast Message</h3>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter message to broadcast to all players"
      />
      <button onClick={() => onSend(message)}>Send</button>
    </div>
  );
}

// Usage
<button onClick={() => setShowBroadcast(true)}>Broadcast</button>
{showBroadcast && (
  <BroadcastModal
    onSend={(msg) => {
      sendRconCommand(`servermsg "${msg}"`);
      setShowBroadcast(false);
    }}
  />
)}
```

**Kick/Ban Confirmation:**
```tsx
function ConfirmAction({ action, player, onConfirm }: Props) {
  return (
    <div className="modal">
      <p>Are you sure you want to {action} {player.username}?</p>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
```

---

## 14. Error Handling Scenarios

**Connection Errors:**
- RCON disabled → "RCON not enabled on server"
- Wrong password → "Authentication failed"
- Connection timeout → "Connection timeout (is RCON port accessible?)"
- Server offline → "Cannot connect (server offline)"

**Command Errors:**
- Invalid command → Display server error response
- Permission denied → "Insufficient permissions"
- Timeout → "Command timeout"

**Session Errors:**
- Session expired → "Session expired, reconnecting..."
- Connection lost → "Connection lost, attempting to reconnect..."

---

## 15. Performance Considerations

**Concerns:**
- xterm.js rendering large outputs (1000+ lines)
- WebSocket message size (multi-page responses)
- Terminal memory usage (history accumulation)

**Optimizations:**
- Limit terminal buffer (e.g., 5000 lines)
- Chunk large responses (send in parts)
- Clear terminal command (reset buffer)
- Lazy-load terminal (only initialize when opened)

---

## Research TODO

- [ ] Test gorcon/rcon library with local Zomboid server
- [ ] Test james4k/rcon library (compare)
- [ ] Verify Zomboid RCON command outputs (players, help, etc.)
- [ ] Test xterm.js in React (prototype component)
- [ ] Research xterm.js input handling (cursor, backspace, etc.)
- [ ] Check if Zomboid supports RCON multi-packet responses
- [ ] Test RCON rate limiting (how many commands/sec?)
- [ ] Explore xterm.js addons (weblinks, search, etc.)

---

## Questions for User

- [ ] Should RCON be accessible to all users or admin-only? (Deferred to M7 RBAC)
- [ ] Terminal layout: Modal or separate page?
- [ ] Should we implement autocomplete in MVP or defer?
- [ ] Rate limiting: Needed for MVP or defer to M7?

---

## External Resources

- Source RCON Protocol: https://developer.valvesoftware.com/wiki/Source_RCON_Protocol
- PZ Server Commands: https://pzwiki.net/wiki/Server_Commands
- gorcon/rcon: https://github.com/gorcon/rcon
- xterm.js: https://xtermjs.org/
