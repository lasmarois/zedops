# M10: Agent Deployment - Findings

## Current Agent Architecture

### Build System
- **Dockerfile.build**: Multi-stage Go build, outputs Linux amd64 binary
- **scripts/build.sh**: Uses Docker to build, extracts binary to `bin/`
- Binary: `bin/zedops-agent` (statically linked, CGO_ENABLED=0)

### Runtime Requirements
- Runs directly on host (NOT in container)
- Needs Docker socket access (`/var/run/docker.sock`)
- Needs root or docker group membership
- Token stored in `~/.zedops-agent/token`

### Current Invocation
```bash
sudo ./bin/zedops-agent --manager-url wss://zedops.mail-bcf.workers.dev/ws --name <agent-name>
```

### CLI Flags (from main.go)
- `--manager-url` (required): WebSocket URL to manager
- `--name` (required): Agent display name
- Token is read from `~/.zedops-agent/token` or prompted on first run

## Cross-Compilation Targets

| OS | Arch | Binary Name | Priority |
|----|------|-------------|----------|
| linux | amd64 | zedops-agent-linux-amd64 | HIGH |
| linux | arm64 | zedops-agent-linux-arm64 | HIGH |
| darwin | amd64 | zedops-agent-darwin-amd64 | MEDIUM |
| darwin | arm64 | zedops-agent-darwin-arm64 | MEDIUM (M1/M2) |
| windows | amd64 | zedops-agent-windows-amd64.exe | MEDIUM |

## Systemd Service Design

### Unit File Structure
```ini
[Unit]
Description=ZedOps Agent
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/zedops-agent --manager-url ${MANAGER_URL} --name ${AGENT_NAME}
Restart=always
RestartSec=10
Environment=HOME=/root

[Install]
WantedBy=multi-user.target
```

### Configuration
- Environment file: `/etc/zedops-agent/config`
- Binary location: `/usr/local/bin/zedops-agent`
- Token location: `/root/.zedops-agent/token`

## Installation Script Flow

### Remote Install (curl | bash)
1. Detect OS and architecture
2. Download correct binary from GitHub releases or manager endpoint
3. Install to `/usr/local/bin/`
4. Create systemd service file
5. Create config directory and file
6. Enable and start service
7. Display status

### Token Handling
- Option A: Pass token as argument (`--token xyz`)
- Option B: Interactive prompt
- Option C: Pre-register via UI, token embedded in curl URL

## UI Integration Points

### Agent Registration Flow (Current)
1. Admin clicks "Add Agent" → generates ephemeral token
2. Copy token, manually install agent, paste token
3. Agent registers, gets permanent token

### Improved Flow (M10)
1. Admin clicks "Add Agent" → generates ephemeral token
2. UI shows: `curl -sSL https://zedops.../install.sh | sudo bash -s -- --token <token> --name <name>`
3. User runs command on target machine
4. Agent auto-registers and connects

## Questions to Resolve
- [x] Where to host binaries? → **GitHub Releases**
- [x] Auto-update: Check on startup or periodic? → **Both (startup + every 6 hours)**
- [ ] Windows: NSSM or native service wrapper?

## Phase 5: Pending Agent Cards - Analysis

### Current Flow
1. User generates ephemeral token via UI (`POST /api/admin/tokens`)
2. Token returned to user, no agent record created
3. User runs install script with token
4. Agent connects with ephemeral token
5. Agent record created in D1 with status='online' (in `AgentConnection.ts:484`)

### Desired Flow
1. User generates ephemeral token via UI (`POST /api/admin/tokens`)
2. **NEW:** Agent record created with status='pending'
3. UI immediately shows agent card with "Awaiting Connection" badge
4. User runs install script with token
5. Agent connects with ephemeral token
6. **CHANGED:** Agent record updated from status='pending' to status='online'

### Database Changes
- Add 'pending' as valid status: 'online' | 'offline' | 'pending'
- For pending agents, token_hash can be empty or a placeholder

### Implementation Tasks
1. `manager/src/routes/admin.ts`:
   - Generate agent ID when creating token
   - Insert agent record with status='pending'
   - Store agentId in ephemeral token payload

2. `manager/src/durable-objects/AgentConnection.ts`:
   - Check if pending agent exists for this name/token
   - UPDATE instead of INSERT for pending agents

3. `frontend/src/components/AgentList.tsx`:
   - Show pending agents
   - Add "Awaiting Connection" badge for status='pending'
   - Add delete/cancel button for pending agents

4. `frontend/src/components/ui/status-badge.tsx`:
   - Add 'pending' status styling

## Binary Hosting Decision: GitHub Releases

**Chosen:** GitHub Releases

**Implications:**
- GitHub Actions workflow for cross-compilation
- Release tags: `agent-v1.0.0`, `agent-v1.0.1`, etc.
- Download URL: `https://github.com/lasmarois/zedops/releases/download/agent-v{VERSION}/zedops-agent-{OS}-{ARCH}`
- Install script fetches latest release via GitHub API
