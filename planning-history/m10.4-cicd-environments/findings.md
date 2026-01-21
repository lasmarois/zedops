# M10.4 - CI/CD & Environment Setup - Findings

## Current State

### Existing Infrastructure
- **Production Worker**: `zedops` (deployed to `zedops.mail-bcf.workers.dev`)
- **Production Database**: `zedops-db` (D1, ID: 0c225574-390c-4c51-ba42-8629c7b01f35)
- **Agent Releases**: GitHub Actions on `agent-v*` tags

### Current Deployment Process (Manual)
```bash
cd frontend && npm run build
cd ../manager && npx wrangler deploy
```

### Existing Workflows
- `.github/workflows/release-agent.yml` - Builds agent on `agent-v*` tags

## Wrangler Environment Configuration

### Multi-Environment Setup
Wrangler supports environments via `wrangler.toml`:

```toml
name = "zedops"
main = "src/index.ts"

# Default (production)
[env.production]
name = "zedops"
d1_databases = [{ binding = "DB", database_name = "zedops-db", database_id = "xxx" }]

[env.dev]
name = "zedops-dev"
d1_databases = [{ binding = "DB", database_name = "zedops-db-dev", database_id = "yyy" }]
```

Deploy with:
```bash
wrangler deploy --env dev
wrangler deploy --env production
```

## GitHub Actions for Cloudflare Workers

### Required Secrets
- `CLOUDFLARE_API_TOKEN` - API token with Workers + D1 permissions
- `CLOUDFLARE_ACCOUNT_ID` - Account ID (find in CF dashboard)

### Wrangler GitHub Action
```yaml
- name: Deploy to Cloudflare
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: deploy --env production
```

## D1 Migrations

### Running Migrations in CI
```bash
wrangler d1 migrations apply zedops-db-dev --env dev
wrangler d1 migrations apply zedops-db --env production
```

### Migration Files Location
- `manager/migrations/` - SQL migration files

## Branch Protection Rules

### Recommended Settings for `main`
- Require pull request before merging
- Require status checks to pass (deploy-dev workflow)
- Require branches to be up to date

### Recommended Settings for `dev`
- Allow direct push (for quick iterations)
- Or require PR from feature branches

## Agent Binary Considerations

### Current Flow
1. Tag `agent-v*` → GitHub Actions builds binaries
2. Creates GitHub Release with assets
3. Manager `/api/agent/version` reads from GitHub API

### Integration with Manager Deploy
- Agent releases are independent of manager deploys
- After agent release, can optionally trigger broadcast

## Open Questions

1. **Dev agent testing?** - Should dev environment have test agents?
2. **Database seeding?** - Should dev DB have sample data?
3. **Secrets per environment?** - Different JWT secrets for dev/prod?
4. **Dev domain?** - Use `zedops-dev.mail-bcf.workers.dev` or custom?
