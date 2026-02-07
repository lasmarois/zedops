# Goal #2: Dev/Prod Workflow Readiness

**Objective:** Make the dev/prod deployment workflow fully functional so we can adhere to it from now on.

**Target Workflow:**
```
work on dev → push to dev → CI deploys to zedops-dev → test → merge to main → CI deploys to prod
```

---

## Phase 1: Fix Hardcoded Asset Paths (Critical)
**Status:** `pending`

The `app.get('*')` catch-all in `manager/src/index.ts:331-358` serves a hardcoded copy of `index.html` with Vite-hashed filenames (`index-CmibS1GF.js`, `index-DLlDIsOB.css`). This breaks CI deployments because each build produces different hashes.

**Investigation needed:**
- wrangler.toml has `not_found_handling = "single-page-application"` — does this make the catch-all redundant?
- If the Worker runs first (needed for API routes), how does asset fallback work?
- Can we remove the catch-all entirely and let Cloudflare handle SPA routing?

**Tasks:**
- [ ] Investigate Workers + Assets routing order (does Worker or assets handler run first?)
- [ ] Test if removing the catch-all breaks SPA routing
- [ ] Remove or fix the hardcoded HTML
- [ ] Verify all routes still work: `/api/*`, `/ws/*`, SPA routes like `/agents/123`

**Files:** `manager/src/index.ts`, `manager/wrangler.toml`

---

## Phase 2: Sync Dev Branch
**Status:** `pending`

`dev` is 5 commits behind `main` and 1 ahead. Need to get them in sync.

**Tasks:**
- [ ] Merge main into dev (or reset dev to main)
- [ ] Push updated dev branch
- [ ] Verify CI deploys to dev environment

---

## Phase 3: Verify Dev Environment
**Status:** `pending`

Ensure the dev Cloudflare Worker (`zedops-dev`) is fully functional with its own secrets and database.

**Tasks:**
- [ ] Check dev worker URL (find/confirm `zedops-dev.*.workers.dev`)
- [ ] Verify dev D1 database has migrations applied
- [ ] Verify dev secrets are set (TOKEN_SECRET, ADMIN_PASSWORD)
- [ ] Test dev environment end-to-end (login, view agents page)

---

## Phase 4: Local Dev Proxy Update
**Status:** `pending`

Update local dev to proxy against the dev environment instead of production.

**Tasks:**
- [ ] Update `frontend/vite.config.ts` proxy target to dev worker URL
- [ ] Test `npm run dev` against dev backend
- [ ] Consider env-based proxy switching (optional)

---

## Phase 5: Update Documentation
**Status:** `pending`

Update all docs to reflect the new workflow.

**Tasks:**
- [ ] Update `.claude/rules/workflow/local-dev.md` — new workflow, dev proxy, remove hardcoded asset paths section
- [ ] Update `.claude/rules/workflow/git.md` — add dev-first branching workflow
- [ ] Update CLAUDE.md quick commands if needed
- [ ] Remove "CRITICAL: Update index.ts After Build" section from local-dev.md (once Phase 1 is resolved)

---

## Phase 6: End-to-End Workflow Test
**Status:** `pending`

Run through the full workflow once to validate everything.

**Tasks:**
- [ ] Make a trivial frontend change on dev branch
- [ ] Push to dev → verify CI deploys → test on dev URL
- [ ] Merge dev into main → verify CI deploys → test on prod URL
- [ ] Confirm no manual steps required (no asset path editing)

---

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
