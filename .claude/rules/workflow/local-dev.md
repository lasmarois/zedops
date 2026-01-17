# Local Development Setup

## Frontend Development (Against Production Backend)

The manager (Cloudflare Worker) cannot run locally on this server due to GLIBC version requirements. Use the production backend instead.

### Start Frontend Dev Server

```bash
cd frontend && npm run dev -- --host 0.0.0.0
```

The `--host 0.0.0.0` flag binds to all interfaces (required for remote access).

### Vite Proxy Configuration

The `frontend/vite.config.ts` includes proxy settings to forward API calls to production:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'https://zedops.mail-bcf.workers.dev',
      changeOrigin: true,
      secure: true,
    },
    '/ws': {
      target: 'wss://zedops.mail-bcf.workers.dev',
      changeOrigin: true,
      ws: true,
      secure: true,
    },
  },
},
```

### Access Points

- Local: `http://localhost:5173`
- Remote: `http://<server-ip>:5173`

### Limitations

- Frontend changes are visible immediately (HMR)
- Backend changes require deployment to production
- Data comes from production database

## Why Wrangler Dev Doesn't Work

The Cloudflare `workerd` runtime requires GLIBC 2.35+, but this server runs an older Linux (RHEL 8 / Rocky 8) with GLIBC 2.28.

Error signature:
```
workerd: /lib64/libc.so.6: version `GLIBC_2.35' not found
```

### Workarounds

1. **Proxy to production** (current approach) - Test frontend against live backend
2. **Deploy and test** - Deploy changes to Cloudflare and test in production
3. **Use newer Linux** - Container or VM with Ubuntu 22.04+ / Fedora 36+

## Production Deployment

### Deploy Frontend + Manager to Cloudflare

```bash
# Build frontend and deploy everything in one command
cd frontend && npm run build && cd ../manager && npx wrangler deploy
```

This will:
1. Build the React frontend to `frontend/dist/`
2. Upload static assets to Cloudflare
3. Deploy the Worker (API + Durable Objects)
4. Output the deployment URL

### Deploy Agent to Host

The agent binary must be manually updated on the host server:

```bash
# Build the agent using Docker (cross-compilation)
cd agent && ./scripts/build.sh

# Copy binary to host and restart service
scp bin/zedops-agent user@host:/tmp/
ssh user@host "sudo systemctl stop zedops-agent && sudo cp /tmp/zedops-agent /usr/local/bin/ && sudo systemctl start zedops-agent"
```

Or if you have direct access:
```bash
sudo systemctl stop zedops-agent
sudo cp bin/zedops-agent /usr/local/bin/
sudo systemctl start zedops-agent
```

### Deployment Checklist

1. **Build frontend**: `cd frontend && npm run build`
2. **Fix any TypeScript errors** if build fails
3. **Update index.ts asset paths** (CRITICAL - see below)
4. **Deploy to Cloudflare**: `cd ../manager && npx wrangler deploy`
5. **Verify deployment**: Check https://zedops.mail-bcf.workers.dev
6. **Update agent** (if agent code changed): Build and deploy binary to host

### CRITICAL: Update index.ts After Build

The SPA fallback in `manager/src/index.ts` has hardcoded asset filenames that must match the build output. After `npm run build`, check the generated filenames:

```bash
ls frontend/dist/assets/
# Example output: index-C8OaW8Lz.js  index-dc-jheIq.css  vite.svg
```

Then update `manager/src/index.ts` to match:
```typescript
<script type="module" crossorigin src="/assets/index-C8OaW8Lz.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-dc-jheIq.css">
```

**If you skip this step**: Users will get a blank page on refresh (the old asset files don't exist).

### Common Build Errors

| Error | Solution |
|-------|----------|
| Unused imports (TS6133) | Remove the unused import from the file |
| GLIBC error on wrangler dev | Use deploy instead - local dev not supported on this server |
| Blank page on refresh | Update asset paths in `manager/src/index.ts` to match build output |

## Quick Reference

| Task | Command |
|------|---------|
| Frontend dev (local) | `cd frontend && npm run dev -- --host 0.0.0.0` |
| Build frontend only | `cd frontend && npm run build` |
| Deploy to Cloudflare | `cd frontend && npm run build && cd ../manager && npx wrangler deploy` |
| Build agent binary | `cd agent && ./scripts/build.sh` |
| Check production | `https://zedops.mail-bcf.workers.dev` |
| View agent logs | `sudo journalctl -u zedops-agent -f` |
