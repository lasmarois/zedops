# Task Plan: Milestone 6 - RCON Integration

**Goal:** Implement RCON console for Project Zomboid server administration

**Duration:** 1-2 weeks (estimated)

**Success Criteria:**
- User types RCON command in UI terminal → executes on server
- Player list displayed in UI
- Quick action buttons work (kick player, etc.)
- Command history navigable with arrow keys
- Real-time command responses displayed in terminal

**Status:** ⏳ Planning
**Started:** 2026-01-11
**Completed:** TBD

---

## Phase Overview

| Phase | Status | Description |
|-------|--------|-------------|
| 0. Research & Design | ✅ complete | Understand RCON protocol, explore libraries, design architecture |
| 1. Agent RCON Client | ⏳ pending | Go RCON client, connect to server, send/receive commands |
| 2. Manager RCON Proxy | ⏳ pending | WebSocket message handlers, RCON session management |
| 3. Frontend Terminal UI | ⏳ pending | xterm.js integration, command input, response display |
| 4. Command History & Autocomplete | ⏳ pending | Store history, arrow key navigation, command suggestions |
| 5. Quick Actions | ⏳ pending | Player list, kick/ban buttons, broadcast message |
| 6. Testing & Verification | ⏳ pending | End-to-end testing, edge cases |

---

## Phase 0: Research & Design ✅ Complete

**Status:** ✅ complete

**Goals:**
- Understand Source RCON protocol (used by Zomboid)
- Find suitable Go RCON library
- Design message protocol for RCON commands
- Design xterm.js integration approach
- Identify Zomboid-specific RCON commands

**Research Questions:**
- [x] What is the Source RCON protocol specification? → TCP-based, binary, little-endian packets
- [x] Which Go RCON library should we use? → **gorcon/rcon** (active, feature-rich)
- [x] How does Zomboid implement RCON? → Port in D1, password in config.ADMIN_PASSWORD
- [x] What are the key Zomboid admin commands? → players(), kickuser, banuser, save, quit, etc.
- [x] How to integrate xterm.js in React? → Manual integration with useRef/useEffect
- [x] How to handle RCON session state? → Persistent with 5min timeout
- [x] What's the message protocol? → Extend existing (rcon.connect, rcon.command, rcon.disconnect)

**Tasks:**
- [x] Research Source RCON protocol → findings.md #1
- [x] Explore Go RCON libraries (compare features, maintenance) → findings.md #2
- [x] Review existing RCON configuration in ZedOps → findings.md #8
- [x] Review Zomboid RCON documentation (commands list) → findings.md #3
- [x] Research xterm.js React integration patterns → findings.md #4
- [x] Design RCON message protocol (rcon.connect, rcon.command, rcon.response) → findings.md #5
- [x] Design session management (when to connect/disconnect) → findings.md #6
- [x] Design UI/UX (terminal layout, quick action buttons) → findings.md #9
- [x] Document findings in findings.md

**Outcome:** Architecture designed, ready for implementation

---

## Phase 1: Agent RCON Client ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- Agent can connect to server RCON port
- Send RCON commands and receive responses
- Handle authentication
- Handle connection errors gracefully

**Tasks:**
- [ ] Choose Go RCON library (based on Phase 0 research)
- [ ] Create `agent/rcon.go` with RCON client
- [ ] Implement RCONConnect(host, port, password)
- [ ] Implement RCONCommand(command) -> response
- [ ] Add message handlers in `agent/main.go`
  - [ ] `rcon.connect` - Establish RCON connection
  - [ ] `rcon.command` - Execute command
  - [ ] `rcon.disconnect` - Close connection
- [ ] Handle errors (connection refused, auth failed, timeout)
- [ ] Test with local Zomboid server

**Message Protocol (Proposed):**
```json
// Connect request
{
  "subject": "rcon.connect",
  "data": {
    "serverId": "uuid",
    "host": "localhost",
    "port": 27015,
    "password": "rcon_password"
  },
  "reply": "_INBOX.uuid"
}

// Connect response
{
  "subject": "_INBOX.uuid",
  "data": {
    "success": true,
    "sessionId": "rcon-session-uuid"
  }
}

// Command request
{
  "subject": "rcon.command",
  "data": {
    "sessionId": "rcon-session-uuid",
    "command": "players"
  },
  "reply": "_INBOX.uuid"
}

// Command response
{
  "subject": "_INBOX.uuid",
  "data": {
    "success": true,
    "response": "Player list:\n- Player1\n- Player2"
  }
}
```

**Files to Create/Modify:**
- `agent/rcon.go` (NEW) - RCON client logic
- `agent/main.go` - Add message handlers

**Verification:**
- Agent can connect to RCON server
- Commands execute successfully
- Responses returned correctly
- Errors handled gracefully

---

## Phase 2: Manager RCON Proxy ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- Manager receives RCON requests from UI
- Forwards requests to agent
- Returns responses to UI
- Manages RCON session state

**Tasks:**
- [ ] Add RCON message handlers in `manager/src/durable-objects/AgentConnection.ts`
  - [ ] Handle `rcon.connect` from UI → forward to agent
  - [ ] Handle `rcon.command` from UI → forward to agent
  - [ ] Handle `rcon.disconnect` from UI → forward to agent
- [ ] Store RCON session state in Durable Object
  - [ ] Track active sessions (sessionId → serverId mapping)
  - [ ] Auto-disconnect on timeout (5min idle)
- [ ] Add API endpoint (optional): `POST /api/agents/:id/servers/:serverId/rcon`
- [ ] Handle errors and timeouts

**Session Management:**
- Session created on first `rcon.connect`
- Session ID returned to UI
- Subsequent commands use session ID
- Auto-cleanup on disconnect or timeout

**Files to Modify:**
- `manager/src/durable-objects/AgentConnection.ts` - RCON message handlers

**Verification:**
- UI → Manager → Agent → Server flow works
- Session state persists across commands
- Timeouts handled correctly

---

## Phase 3: Frontend Terminal UI ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- Display RCON terminal in UI
- User can type commands
- Command responses displayed in terminal
- Terminal scrolls automatically

**Tasks:**
- [ ] Install xterm.js and xterm-addon-fit
  ```bash
  npm install xterm xterm-addon-fit
  ```
- [ ] Create `frontend/src/components/RconTerminal.tsx`
  - [ ] Initialize xterm.js terminal
  - [ ] Connect to WebSocket (reuse existing connection)
  - [ ] Send `rcon.connect` on mount
  - [ ] Handle user input (Enter key → send command)
  - [ ] Display command responses
  - [ ] Handle terminal resize (xterm-addon-fit)
- [ ] Add RCON terminal to ContainerList or separate page
- [ ] Style terminal (dark theme, monospace font)

**UI Component Structure:**
```tsx
interface RconTerminalProps {
  serverId: string;
  rconPort: number;
  rconPassword: string;
}

function RconTerminal({ serverId, rconPort, rconPassword }: RconTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    // Initialize xterm.js
    // Connect to RCON
    // Handle input/output
  }, []);

  return <div ref={terminalRef} style={{ height: '400px' }} />;
}
```

**Files to Create/Modify:**
- `frontend/src/components/RconTerminal.tsx` (NEW)
- `frontend/src/components/ContainerList.tsx` - Add RCON button/modal
- `frontend/package.json` - Add xterm.js dependencies

**Verification:**
- Terminal renders correctly
- User can type commands
- Responses display in terminal
- Terminal scrolls to bottom

---

## Phase 4: Command History & Autocomplete ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- Store command history in browser
- Arrow up/down navigates history
- Tab autocomplete for common commands

**Tasks:**
- [ ] Implement command history in RconTerminal
  - [ ] Store in state: `const [history, setHistory] = useState<string[]>([])`
  - [ ] Add command to history on Enter
  - [ ] Arrow up/down navigate history
  - [ ] Persist history to localStorage
- [ ] Implement autocomplete (optional)
  - [ ] Define common Zomboid commands list
  - [ ] Tab key triggers autocomplete
  - [ ] Show suggestions in terminal

**Common Zomboid Commands:**
- `players` - List players
- `kick "username"` - Kick player
- `ban "username"` - Ban player
- `save` - Save world
- `quit` - Shutdown server
- `adduser "username" "password"` - Add admin
- `servermsg "message"` - Broadcast message
- `help` - Show commands

**Files to Modify:**
- `frontend/src/components/RconTerminal.tsx` - Add history logic

**Verification:**
- History persists across sessions
- Arrow keys navigate history correctly
- Autocomplete suggests commands (if implemented)

---

## Phase 5: Quick Actions ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- Display player list in UI (not just terminal)
- Quick action buttons (kick, ban, broadcast)
- Pre-fill terminal with command on button click

**Tasks:**
- [ ] Parse `players` command response
  - [ ] Extract player list from text output
  - [ ] Display in structured UI (table or list)
- [ ] Add quick action buttons
  - [ ] "Refresh Players" - Run `players` command
  - [ ] "Kick Player" - Pre-fill `kick "username"`
  - [ ] "Ban Player" - Pre-fill `ban "username"`
  - [ ] "Broadcast Message" - Show modal, run `servermsg`
  - [ ] "Save World" - Run `save` command
- [ ] Add UI section above terminal with player list

**UI Layout:**
```
┌─────────────────────────────────┐
│ RCON Console - ServerName       │
├─────────────────────────────────┤
│ Players Online (3)              │
│ ┌───────────────────────────┐   │
│ │ Player1     [Kick] [Ban]  │   │
│ │ Player2     [Kick] [Ban]  │   │
│ │ Player3     [Kick] [Ban]  │   │
│ └───────────────────────────┘   │
│ [Refresh] [Broadcast] [Save]    │
├─────────────────────────────────┤
│ Terminal Output                 │
│ ┌───────────────────────────┐   │
│ │ > players                 │   │
│ │ Player1, Player2, Player3 │   │
│ │ >                         │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

**Files to Modify:**
- `frontend/src/components/RconTerminal.tsx` - Add player list UI

**Verification:**
- Player list updates correctly
- Quick actions execute commands
- Broadcast modal works

---

## Phase 6: Testing & Verification ⏳ Pending

**Status:** ⏳ pending

**Goals:**
- End-to-end testing of RCON flow
- Edge case testing
- Performance verification

**Test Scenarios:**

1. **Happy Path**
   - Open RCON terminal
   - Connect to server RCON port
   - Execute `players` command
   - Verify response displays in terminal
   - Navigate command history with arrow keys

2. **Authentication**
   - Wrong RCON password → error displayed
   - Correct password → connection successful

3. **Connection Errors**
   - Server RCON disabled → error message
   - Server offline → connection refused
   - Network timeout → timeout error

4. **Session Management**
   - Multiple commands in same session
   - Idle timeout (5min) → auto-disconnect
   - Reconnect after disconnect

5. **Quick Actions**
   - Refresh players → updates list
   - Kick player → player removed
   - Broadcast message → message sent to all players

6. **Edge Cases**
   - Very long command output (multi-page)
   - Special characters in commands
   - Server restart during RCON session
   - Multiple users sending RCON commands

**Verification Checklist:**
- [ ] RCON connection established successfully
- [ ] Commands execute and responses return
- [ ] Command history works (up/down arrows)
- [ ] Quick actions execute correctly
- [ ] Player list updates in real-time
- [ ] Errors handled gracefully
- [ ] Session cleanup on disconnect
- [ ] No memory leaks in terminal

---

## Dependencies

**External:**
- Go RCON library (gorcon/rcon or james4k/rcon)
- xterm.js (terminal emulator)
- xterm-addon-fit (terminal auto-resize)

**Internal:**
- ✅ Milestone 4 complete (server management, RCON port configured)
- ✅ Agent WebSocket connection (message protocol)
- ✅ Manager Durable Object (message forwarding)
- ✅ Frontend WebSocket hook (useAgents or new useRcon)

**Zomboid Requirements:**
- Server must have RCON enabled (RCONEnabled=true in server.ini)
- RCON port must be accessible (default: 27015)
- RCON password must be configured (RCONPassword in server.ini)

---

## Errors Encountered

| Error | Phase | Attempt | Resolution |
|-------|-------|---------|------------|
| _(none yet)_ | - | - | - |

---

## Design Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| _(to be filled during research)_ | - | - |

---

## Notes

- RCON protocol: Source RCON (same as Half-Life, CS:GO, Minecraft)
- Zomboid RCON commands: https://pzwiki.net/wiki/Server_Commands
- xterm.js is the de facto standard for web terminals (used by VS Code, Hyper, etc.)
- Session management needed to avoid reconnecting on every command
- Consider rate limiting (avoid command spam)

---

## Future Enhancements (Deferred)

- [ ] Multi-server RCON (tabbed terminals)
- [ ] RCON command macros (saved command sequences)
- [ ] RCON logs/audit trail (who ran what command)
- [ ] Advanced autocomplete (context-aware suggestions)
- [ ] Terminal themes (light/dark mode)
- [ ] Copy/paste support in terminal
- [ ] Search terminal output (Ctrl+F)
