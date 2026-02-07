# Local Development Setup

## Development Workflow

All code changes follow the **dev-first workflow**:

```
work on dev branch → push to dev → CI deploys to zedops-dev → test → merge to main → CI deploys to prod
```

| Environment | Worker | URL | D1 Database |
|-------------|--------|-----|-------------|
| Dev | `zedops-dev` | `https://zedops-dev.mail-bcf.workers.dev` | `zedops-db-dev` |
| Prod | `zedops` | `https://zedops.mail-bcf.workers.dev` | `zedops-db` |

## Frontend Development (Against Dev Backend)

The manager (Cloudflare Worker) cannot run locally on this server due to GLIBC version requirements. Use the dev backend instead.

### Start Frontend Dev Server

```bash
cd frontend && npm run dev -- --host 0.0.0.0
```

The `--host 0.0.0.0` flag binds to all interfaces (required for remote access).

### Vite Proxy Configuration

The `frontend/vite.config.ts` proxies API/WS calls to the dev environment by default.
Override with `VITE_BACKEND_URL` to point at production if needed:

```bash
# Default: proxies to dev
cd frontend && npm run dev -- --host 0.0.0.0

# Override: proxy to production
VITE_BACKEND_URL=https://zedops.mail-bcf.workers.dev npm run dev -- --host 0.0.0.0
```

### Access Points

- Local: `http://localhost:5173`
- Remote: `http://<server-ip>:5173`

### Limitations

- Frontend changes are visible immediately (HMR)
- Backend changes require deployment (`push to dev` triggers CI)
- Data comes from dev database

## Why Wrangler Dev Doesn't Work

The Cloudflare `workerd` runtime requires GLIBC 2.35+, but this server runs an older Linux (RHEL 8 / Rocky 8) with GLIBC 2.28.

Error signature:
```
workerd: /lib64/libc.so.6: version `GLIBC_2.35' not found
```

### Workarounds

1. **Proxy to dev environment** (current approach) - Test frontend against dev backend
2. **Push to dev branch** - CI deploys to dev environment automatically
3. **Use newer Linux** - Container or VM with Ubuntu 22.04+ / Fedora 36+

## Deployment

### CI/CD (Preferred — No Manual Steps)

```bash
# Deploy to dev: push to dev branch
git push origin dev

# Deploy to prod: merge dev into main and push
git checkout main && git merge dev && git push origin main
```

CI handles: build frontend → apply D1 migrations → deploy Worker + assets.

SPA routing is handled by Cloudflare's asset handler (`not_found_handling = "single-page-application"` in wrangler.toml). No hardcoded asset paths — CI builds are fully self-contained.

### Manual Deployment (Emergency Only)

```bash
# Deploy to dev
cd frontend && npm run build && cd ../manager && npx wrangler deploy --env dev

# Deploy to prod
cd frontend && npm run build && cd ../manager && npx wrangler deploy
```

### Deploy Agent to Host

Agent runs as a systemd service on maestroserver (enabled on boot).

#### Build the Agent

```bash
cd /Volumes/Data/docker_composes/zedops/agent && ./scripts/build.sh
```

#### Stop the Running Agent

```bash
sudo pkill -f zedops-agent
# Wait for process to stop AND for backend to register disconnect
# (5 seconds minimum - prevents backend confusion about which agent is real)
sleep 5
ps aux | grep zedops-agent | grep -v grep || echo "Agent stopped"
```

#### Start the Agent

```bash
cd /Volumes/Data/docker_composes/zedops/agent && nohup sudo ./bin/zedops-agent --manager-url wss://zedops.mail-bcf.workers.dev/ws --name maestroserver > /tmp/zedops-agent.log 2>&1 &
```

#### Full Rebuild & Restart (One-liner)

```bash
cd /Volumes/Data/docker_composes/zedops/agent && ./scripts/build.sh && sudo pkill -f zedops-agent; sleep 5; nohup sudo ./bin/zedops-agent --manager-url wss://zedops.mail-bcf.workers.dev/ws --name maestroserver > /tmp/zedops-agent.log 2>&1 &
```

#### Check Agent Status & Logs

```bash
# Check if running
ps aux | grep zedops-agent | grep -v grep

# View logs
tail -f /tmp/zedops-agent.log
```

### Common Build Errors

| Error | Solution |
|-------|----------|
| Unused imports (TS6133) | Remove the unused import from the file |
| GLIBC error on wrangler dev | Use deploy instead - local dev not supported on this server |

## Test VM (zedops-test-agent)

A secondary VM for testing agent deployment and features.

### Connection Details

| Property | Value |
|----------|-------|
| Host | 10.0.13.208 |
| User | zedops |
| Agent Name | zedops-test-agent |

### SSH Access

```bash
ssh zedops@10.0.13.208
```

### Deploying Agent to Test VM

```bash
# 1. Build the agent
cd /Volumes/Data/docker_composes/zedops/agent && ./scripts/build.sh

# 2. Copy binary to test VM
scp /Volumes/Data/docker_composes/zedops/agent/bin/zedops-agent zedops@10.0.13.208:/tmp/

# 3. Start agent (user is in docker group, no sudo needed for Docker)
ssh zedops@10.0.13.208 'nohup /tmp/zedops-agent --manager-url wss://zedops.mail-bcf.workers.dev/ws --name zedops-test-agent > /tmp/agent.log 2>&1 &'

# 4. Check logs
ssh zedops@10.0.13.208 'tail -f /tmp/agent.log'
```

### Important Notes

- **No sudo access via SSH** - The zedops user requires password for sudo, but is in the `docker` group
- **Token location**: `~/.zedops-agent/token` (user home, not /root)
- **Docker networks**: Agent auto-creates `zomboid-backend` and `zomboid-servers` on first start
- **Agent binary**: Stored at `/tmp/zedops-agent` (not persistent across reboots)

### Check Docker Networks

```bash
ssh zedops@10.0.13.208 'docker network ls | grep zomboid'
```

## Browser Debugging (Chrome DevTools MCP)

Allows Claude Code to see and interact with the Brave browser on your laptop via the Chrome DevTools Protocol.

### Setup

**Option A: From your laptop (recommended)**
```bash
# Launches Brave with debug port + creates SSH tunnel to server
./scripts/dev/browser-debug-laptop.sh root@<server-ip>
```

**Option B: From the server**
```bash
# 1. On laptop: launch Brave manually
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser \
    --remote-debugging-port=9222 --user-data-dir="$HOME/BraveDebug"

# 2. On server: create tunnel to laptop
./scripts/dev/browser-debug-server.sh nicolas@192.168.200.250
```

### MCP Configuration (already configured)
```bash
claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest --browserUrl http://127.0.0.1:9222
```

### Verify
```bash
# From server - should return Brave version JSON
curl -s http://127.0.0.1:9222/json/version
```

### Notes
- Uses `--user-data-dir` for a separate Brave profile (required for Chrome 136+ security)
- Must use `127.0.0.1` not `localhost` (IPv6 issue on macOS)
- Tunnel must stay open for the duration of the session

## Quick Reference

| Task | Command |
|------|---------|
| Frontend dev (local) | `cd frontend && npm run dev -- --host 0.0.0.0` |
| Build frontend only | `cd frontend && npm run build` |
| Deploy to dev (CI) | `git push origin dev` |
| Deploy to prod (CI) | merge dev→main, `git push origin main` |
| Deploy to dev (manual) | `cd frontend && npm run build && cd ../manager && npx wrangler deploy --env dev` |
| Deploy to prod (manual) | `cd frontend && npm run build && cd ../manager && npx wrangler deploy` |
| Build agent binary | `cd agent && ./scripts/build.sh` |
| Stop agent | `sudo pkill -f zedops-agent` |
| Start agent | `cd agent && nohup sudo ./bin/zedops-agent --manager-url wss://zedops.mail-bcf.workers.dev/ws --name maestroserver > /tmp/zedops-agent.log 2>&1 &` |
| View agent logs | `tail -f /tmp/zedops-agent.log` |
| Deploy to test VM | `scp agent/bin/zedops-agent zedops@10.0.13.208:/tmp/` |
| Check dev | `https://zedops-dev.mail-bcf.workers.dev` |
| Check production | `https://zedops.mail-bcf.workers.dev` |
