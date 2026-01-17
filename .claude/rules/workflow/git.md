# Git Workflow

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

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
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
2. Archive planning files to `planning-history/`
3. Commit archive move with milestone summary
4. Update MILESTONE-M98.md or MILESTONES.md
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

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# View recent commits
git log --oneline -5
```

## Safety Rules
- NEVER use `--force` without explicit user approval
- NEVER commit secrets (.dev.vars, tokens, credentials)
- NEVER amend commits without explicit user request
- Check `git status` before and after commits
