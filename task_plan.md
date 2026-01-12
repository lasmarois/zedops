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
| 1. Agent RCON Client | ✅ complete | Go RCON client, connect to server, send/receive commands |
| 2. Manager RCON Proxy | ✅ complete | WebSocket message handlers, RCON session management |
| 3. Frontend Terminal UI | ✅ complete | xterm.js integration, command input, response display |
| 4. Command History & Autocomplete | ✅ complete | Store history, arrow key navigation, command suggestions |
| 5. Quick Actions | ✅ complete | Player list, kick/ban buttons, broadcast message |
| 5.5. Secure RCON Network Access | ⏳ in progress | Agent accesses RCON via Docker network (no host exposure) |
| 6. Testing & Verification | ⏸️ blocked | End-to-end testing, edge cases |

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

## Phase 1: Agent RCON Client ✅ Complete

**Status:** ✅ complete

**Goals:**
- Agent can connect to server RCON port
- Send RCON commands and receive responses
- Handle authentication
- Handle connection errors gracefully

**Tasks:**
- [x] Choose Go RCON library (based on Phase 0 research) → gorcon/rcon
- [x] Create `agent/rcon.go` with RCON client (RCONManager, RCONSession)
- [x] Implement Connect(serverId, host, port, password) → sessionId
- [x] Implement Execute(sessionId, command) → response
- [x] Implement Disconnect(sessionId) → close connection
- [x] Add cleanup goroutine (5-minute idle timeout)
- [x] Add message handlers in `agent/main.go`
  - [x] `rcon.connect` - Establish RCON connection
  - [x] `rcon.command` - Execute command
  - [x] `rcon.disconnect` - Close connection
- [x] Handle errors (connection refused, auth failed, timeout)
- [x] Compile agent binary (successful build)

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

## Phase 2: Manager RCON Proxy ✅ Complete

**Status:** ✅ complete

**Goals:**
- Manager receives RCON requests from UI
- Forwards requests to agent
- Returns responses to UI
- Manages RCON session state

**Tasks:**
- [x] Add RCON message handlers in `manager/src/durable-objects/AgentConnection.ts`
  - [x] Handle `rcon.connect` from UI → forward to agent
  - [x] Handle `rcon.command` from UI → forward to agent
  - [x] Handle `rcon.disconnect` from UI → forward to agent
- [x] Store RCON session state in Durable Object
  - [x] Track active sessions (sessionId → serverId mapping)
  - [x] Auto-disconnect on timeout (handled by agent's 5min idle cleanup)
- [x] Handle errors and timeouts

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

## Phase 3: Frontend Terminal UI ✅ Complete

**Status:** ✅ complete

**Goals:**
- Display RCON terminal in UI
- User can type commands
- Command responses displayed in terminal
- Terminal scrolls automatically

**Tasks:**
- [x] Install xterm.js and xterm-addon-fit
  ```bash
  npm install @xterm/xterm @xterm/addon-fit
  ```
- [x] Create `frontend/src/components/RconTerminal.tsx`
  - [x] Initialize xterm.js terminal
  - [x] Connect to WebSocket (reuse existing connection)
  - [x] Send `rcon.connect` on mount
  - [x] Handle user input (Enter key → send command)
  - [x] Display command responses
  - [x] Handle terminal resize (xterm-addon-fit)
- [x] Add RCON terminal to ContainerList
- [x] Style terminal (dark theme, monospace font)

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

## Phase 4: Command History & Autocomplete ✅ Complete

**Status:** ✅ complete

**Goals:**
- Store command history in browser
- Arrow up/down navigates history
- Tab autocomplete for common commands

**Tasks:**
- [x] Implement command history in RconTerminal
  - [x] Store in state: `const [history, setHistory] = useState<string[]>([])`
  - [x] Add command to history on Enter
  - [x] Arrow up/down navigate history
  - [x] Persist history to localStorage (per-server, max 100 commands)
- [ ] Implement autocomplete (deferred to Phase 5 - Quick Actions)
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

## Phase 5: Quick Actions ✅ Complete

**Status:** ✅ complete

**Goals:**
- Display player list in UI (not just terminal)
- Quick action buttons (kick, ban, broadcast)
- Pre-fill terminal with command on button click

**Tasks:**
- [x] Parse `players` command response
  - [x] Extract player list from text output (comma-separated and line-by-line formats)
  - [x] Display in structured UI (scrollable list with badges)
- [x] Add quick action buttons
  - [x] "Refresh Players" - Run `players` command (🔄 cyan button)
  - [x] "Kick Player" - Pre-fill `kickuser "username"` in terminal (yellow button per player)
  - [x] "Ban Player" - Pre-fill `banuser "username"` in terminal (red button per player)
  - [x] "Broadcast Message" - Show modal, run `servermsg` (📢 orange button)
  - [x] "Save World" - Run `save` command (💾 green button)
- [x] Add UI section above terminal with player list (max-height 200px, scrollable)

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

## Phase 5.5: Secure RCON Network Access ✅ Complete

**Status:** ✅ complete

**Critical Blocker Discovered:**
- Agent `server.go` does NOT bind RCON port to host (only game/UDP ports)
- RCON connections will fail - agent cannot reach containers
- Two implementation options identified:
  - **Option A**: Bind RCON ports to host (27015+) → Security risk, exposed on network
  - **Option B**: Agent accesses containers via Docker network → Secure, no host exposure
- **Decision**: Implement Option B for production security

**Goals:**
- Agent connects to RCON via Docker network (not host ports)
- Zero RCON exposure on host network
- All servers use internal port 27015 (no conflicts)

**Tasks:**
- [x] Identify blocker (missing RCON port binding in server.go:89-103)
- [x] Fix frontend: ServerForm.tsx sets RCON_PASSWORD=ADMIN_PASSWORD
- [x] Fix existing servers: Manually updated INI files (build42-testing: RCONPort=27027, jeanguy: RCONPort=27025)
- [x] Agent: Resolve container IP from Docker API
- [x] Agent: Connect to RCON at container-specific port (internal)
- [x] Manager: Update handleRCONConnect() to forward containerID
- [x] Manager: Add RCON_PORT to container environment variables
- [x] Frontend: Update useRcon/RconTerminal to send containerID
- [x] Fix WebSocket routing: handleUIMessage() forwards RCON messages
- [x] Fix password authentication: Separate adminPassword and rconPassword
- [x] Fix command input: Use refs for synchronous state tracking
- [x] Fix session tracking: Use refs to prevent stale closures and infinite loops
- [x] Test RCON connection via network (verified on build42-testing, jeanguy)
- [x] Verify commands work (help, players, save, servermsg tested)

**Implementation Notes:**
- Agent must query Docker API for container inspection
- Extract IP from `NetworkSettings.Networks["zomboid-backend"].IPAddress`
- Connect to internal port 27015 (no port conflicts between servers)
- Agent already has Docker client access (server.go)

**Files to Modify:**
- `agent/rcon.go` - Update Connect() to resolve container IP
- `agent/main.go` - Pass container ID to RCON connect handler

**Verification:**
- RCON connection succeeds without host port binding
- `netstat -tuln | grep 27015` returns empty (port not bound)
- Agent logs show connection to internal container IP

---

## Phase 6: Testing & Verification ✅ Complete (Basic Testing)

**Status:** ✅ basic testing complete, comprehensive testing deferred

**Goals:**
- End-to-end testing of RCON flow
- Edge case testing
- Performance verification

**Test Document:** See `TEST-PLAN-RCON.md` for detailed test scenarios

**Test Scenarios (22 Total):**

1. **Happy Path** - Basic RCON flow (help, players commands)
2. **Authentication** - Correct password
3. **Authentication** - Wrong password
4. **Connection Errors** - Server offline
5. **Connection Errors** - RCON disabled
6. **Session Management** - Multiple commands
7. **Session Management** - Idle timeout (5min)
8. **Session Management** - Reconnect after disconnect
9. **Command History** - Arrow navigation
10. **Command History** - Persistence (localStorage)
11. **Quick Actions** - Refresh players
12. **Quick Actions** - Save world
13. **Quick Actions** - Broadcast message
14. **Quick Actions** - Kick player
15. **Quick Actions** - Ban player
16. **Edge Cases** - Long command output
17. **Edge Cases** - Special characters
18. **Edge Cases** - Server restart during session
19. **Edge Cases** - Multiple users
20. **Performance** - Terminal responsiveness
21. **Keyboard Shortcuts** - Ctrl+C, Ctrl+L, arrows
22. **UI/UX** - Visual design verification

**Verification Checklist:**
- [ ] RCON connection established successfully
- [ ] Commands execute and responses return
- [ ] Command history works (up/down arrows)
- [ ] Quick actions execute correctly
- [ ] Player list updates correctly
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
| RCON port not bound to host in agent/server.go | Phase 6 Testing | 1 | Discovered during test prep - agent cannot reach container RCON ports |
| ServerForm.tsx missing RCON_PASSWORD ENV | Phase 6 Testing | 1 | Added RCON_PASSWORD=ADMIN_PASSWORD in config (line 71) |
| Existing servers have empty RCONPassword in INI | Phase 6 Testing | 1 | Manually updated build42-testing and jeanguy INI files |

---

## Design Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Use gorcon/rcon library | Active maintenance, feature-rich, clean API | 2026-01-11 |
| RCON session timeout: 5 minutes | Balance between keeping connections alive and resource cleanup | 2026-01-11 |
| xterm.js for terminal UI | Industry standard (VS Code, Hyper), excellent React integration | 2026-01-11 |
| **Agent accesses RCON via Docker network (Option B)** | **Security: Zero RCON exposure on host network. All servers use internal port 27015. No firewall rules needed.** | **2026-01-11** |
| ServerForm sets RCON_PASSWORD=ADMIN_PASSWORD | Simplicity: Single password for both admin and RCON access | 2026-01-11 |

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
