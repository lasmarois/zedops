# Goal #2: Findings

## Current State (Pre-Work)

### Branches
- `main`: production, 5 commits ahead of dev
- `dev`: 1 commit ahead of main (`chore: trigger dev deployment`)
- All recent work pushed directly to main — no dev-first workflow used

### CI/CD Workflows
- `deploy-prod.yml`: push to main → build + deploy to Cloudflare (production)
- `deploy-dev.yml`: push to dev → build + deploy to Cloudflare (dev env)
- `release-agent.yml`: agent-v* tag → build Go → GitHub release → broadcast
- All 3 workflows active and functional

### Wrangler Config
- Prod: `zedops` worker, `zedops-db` D1
- Dev: `zedops-dev` worker, `zedops-db-dev` D1
- Both have DO bindings + D1 bindings
- `not_found_handling = "single-page-application"` set in `[assets]`

### The Hardcoded Asset Path Problem
- `manager/src/index.ts:331-358` has a `app.get('*')` catch-all
- Returns hardcoded HTML with `index-CmibS1GF.js` / `index-DLlDIsOB.css`
- These hashes are from a specific local build — CI builds will produce different hashes
- The `not_found_handling = "single-page-application"` in wrangler.toml MIGHT make this catch-all redundant
- Key question: does the Worker or the assets handler run first?

### Vite Proxy
- Currently proxies to production: `https://zedops.mail-bcf.workers.dev`
- Should proxy to dev environment for local development
