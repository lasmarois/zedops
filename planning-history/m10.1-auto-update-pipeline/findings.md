# M10.1 - Complete Agent Auto-Update Pipeline - Findings

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Auto-Update Flow                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Agent Startup                                                   │
│  └─ AutoUpdater.Start()                                         │
│     └─ checkAndUpdate() immediately + every 6 hours             │
│                                                                  │
│  Version Check                                                   │
│  └─ GET /api/agent/version                                      │
│     └─ Returns: { version: "1.0.0", downloadUrls: {...} }       │
│                                                                  │
│  Compare Versions                                                │
│  └─ if latestVersion != Version (currently "dev")               │
│     └─ Download binary from GitHub releases                     │
│     └─ Replace current binary                                   │
│     └─ syscall.Exec() to restart in-place                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

### Agent Side
- `main.go:20` - `var Version = "dev"` (set via ldflags at build)
- `autoupdate.go` - Full update logic
- Build script sets version: `-ldflags="-X main.Version=${VERSION}"`

### Manager Side
- `index.ts:55-70` - `/api/agent/version` endpoint
- Hardcoded: `LATEST_AGENT_VERSION = '1.0.0'`
- URLs point to: `github.com/lasmarois/zedops/releases/download/agent-v1.0.0/...`

### GitHub Actions
- `.github/workflows/release-agent.yml`
- Triggers on tags: `agent-v*`
- Builds: linux/amd64, linux/arm64, darwin/amd64, darwin/arm64, windows/amd64
- Creates release with checksums

## Current Agent Behavior

From logs:
```
Checking for updates...
New version available: 1.0.0 (current: dev)
Downloading update from https://github.com/lasmarois/zedops/releases/download/agent-v1.0.0/zedops-agent-linux-amd64
Failed to apply update: download returned status 404
```

## Potential Issues to Watch

1. **Binary permissions** - New binary needs execute permission (handled in code)
2. **Binary path** - Agent must be able to write to its own location
3. **Restart mechanism** - `syscall.Exec()` replaces process in-place
4. **systemd interaction** - Should see same PID, no restart trigger
