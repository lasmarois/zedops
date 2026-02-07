# Git Workflow

## Branching Strategy

All code changes follow a **dev-first workflow**:

```
dev branch (development) → main branch (production)
```

| Branch | Purpose | CI Action |
|--------|---------|-----------|
| `dev` | Development & testing | Deploys to `zedops-dev` worker |
| `main` | Production | Deploys to `zedops` worker |

### Daily Workflow

1. **Work on `dev`** branch (or feature branches that merge into `dev`)
2. **Push to `dev`** → CI deploys to dev environment
3. **Test on dev** → verify at `https://zedops-dev.mail-bcf.workers.dev`
4. **When satisfied** → merge `dev` into `main`
5. **Push `main`** → CI deploys to production

### Switching Between Branches

```bash
# Start working on dev
git checkout dev

# After testing, merge to production
git checkout main && git merge dev && git push origin main

# Go back to dev for more work
git checkout dev
```

### Agent Releases

Agent releases use tags (independent of branch workflow):

```bash
git tag agent-v1.0.X && git push origin agent-v1.0.X
```

This triggers the Release Agent workflow → builds binaries → creates GitHub release → broadcasts update to agents.

## Commit Timing

### When to Commit
- After completing a milestone/sub-milestone (M8/M9.8.X)
- After significant planning/documentation cleanup
- Before starting a new feature (clean working state)
- When user explicitly requests

### When NOT to Commit
- Mid-implementation (incomplete code)
- Work-in-progress planning files (task_plan.md, progress.md, findings.md)
- Uncommitted changes from previous sessions without user approval

## Commit Message Format

```
<type>: <short description>

<body - what changed and why>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Types
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code restructuring
- `docs:` Documentation only
- `chore:` Maintenance (deps, config)
- For milestones: `M9.8.X: <description>`

## Workflow with Planning

### Starting a Milestone
1. Ensure working directory is clean (commit or stash pending changes)
2. Create planning files (task_plan.md, progress.md, findings.md)
3. Do NOT commit planning files until milestone complete

### During Implementation
- Commit logical chunks as you go
- Each commit should be buildable/testable
- Reference milestone in commit messages

### Completing a Milestone
1. Final implementation commit
2. Archive planning files to `.planning/history/`
3. Commit archive move with milestone summary
4. Update MILESTONES.md
5. Commit tracker updates

## Common Commands

```bash
# Check status before committing
git status

# Stage specific files
git add <file1> <file2>

# Stage deletions/renames
git add -u <path>

# Commit with heredoc (preserves formatting)
git commit -m "$(cat <<'EOF'
Commit message here

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"

# View recent commits
git log --oneline -5

# Deploy to dev
git push origin dev

# Merge dev to main for production deploy
git checkout main && git merge dev && git push origin main && git checkout dev
```

## Safety Rules
- NEVER use `--force` on `main` without explicit user approval
- NEVER commit secrets (.dev.vars, tokens, credentials)
- NEVER amend commits without explicit user request
- Check `git status` before and after commits
