# M10.4 - CI/CD & Environment Setup

## Goal
Implement proper dev/prod environment separation with automated deployments via GitHub Actions.

## Design

### Environment Architecture
```
                    GitHub Repository
                           |
            +--------------+--------------+
            |                             |
         dev branch                   main branch
            |                             |
            v                             v
    +---------------+             +---------------+
    | zedops-dev    |             | zedops-prod   |
    | (CF Worker)   |             | (CF Worker)   |
    +---------------+             +---------------+
            |                             |
            v                             v
    +---------------+             +---------------+
    | zedops-db-dev |             | zedops-db     |
    | (D1 Database) |             | (D1 Database) |
    +---------------+             +---------------+
```

### Branch Strategy
- `main` - Production (auto-deploy to prod worker)
- `dev` - Staging/Development (auto-deploy to dev worker)
- `feature/*` - Feature branches (no auto-deploy, PR to dev)

### Workflow
1. Create feature branch from `dev`
2. Develop and test locally
3. PR to `dev` → Auto-deploy to dev worker
4. Test on dev environment
5. PR from `dev` to `main` → Auto-deploy to prod worker

## Phases

### Phase 1: Cloudflare Environment Setup
**Status:** `pending`
- [ ] Create `zedops-dev` worker in Cloudflare
- [ ] Create `zedops-db-dev` D1 database
- [ ] Create `wrangler.toml` environment configurations
- [ ] Set up environment-specific secrets

### Phase 2: GitHub Actions - Dev Deployment
**Status:** `pending`
- [ ] Create `.github/workflows/deploy-dev.yml`
- [ ] Trigger on push to `dev` branch
- [ ] Build frontend
- [ ] Deploy to `zedops-dev` worker
- [ ] Run D1 migrations on dev database

### Phase 3: GitHub Actions - Prod Deployment
**Status:** `pending`
- [ ] Create `.github/workflows/deploy-prod.yml`
- [ ] Trigger on push to `main` branch
- [ ] Build frontend
- [ ] Deploy to `zedops-prod` worker
- [ ] Run D1 migrations on prod database
- [ ] Optional: Broadcast update notification to agents

### Phase 4: Branch Protection & PR Workflow
**Status:** `pending`
- [ ] Create `dev` branch from current `main`
- [ ] Set up branch protection rules
- [ ] Document PR workflow in README

### Phase 5: Testing & Validation
**Status:** `pending`
- [ ] Test dev deployment workflow
- [ ] Test prod deployment workflow
- [ ] Verify environment isolation
- [ ] Document rollback procedures

## Files to Create/Modify

| File | Changes |
|------|---------|
| `manager/wrangler.toml` | Add dev/prod environment configs |
| `.github/workflows/deploy-dev.yml` | Dev deployment workflow |
| `.github/workflows/deploy-prod.yml` | Prod deployment workflow |
| `.github/workflows/release-agent.yml` | Update to broadcast after release |
| `README.md` | Document deployment workflow |

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

## Success Criteria
- [ ] Push to `dev` → Auto-deploys to dev worker
- [ ] Push to `main` → Auto-deploys to prod worker
- [ ] Dev and prod have separate databases
- [ ] Migrations run automatically
- [ ] No manual deployment steps required
