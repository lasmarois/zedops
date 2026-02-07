# GOALS.md - Goal Registry

> Track all project goals here. Read this file FIRST at every session start.

---

## Active Goal

None

---

## Goal Registry

| # | Goal | Milestone | Status | Created | Completed |
|---|------|-----------|--------|---------|-----------|
| 1 | Complete M10: Agent Deployment & Fix Status Bugs | M10 | Complete | 2026-02-07 | 2026-02-07 |
| 2 | Dev/Prod Workflow Readiness | Infra | Complete | 2026-02-07 | 2026-02-07 |
| 3 | Implement M12: Backup & Restore | M12 | Complete | 2026-02-07 | 2026-02-07 |
| 4 | Smart Health Check | M14 | Complete | 2026-02-07 | 2026-02-07 |
| 5 | ZedOps Integration Audit + Fix All Gaps | M14 | Complete | 2026-02-07 | 2026-02-07 |
| 6 | Fix Health Check: Healthy Only When Game Ready | M14 | Planned | | |
| 7 | Distribution Strategy | M14 | Planned | | |

---

## Status Legend

- **In Progress** - Currently being worked on (planning files in project root)
- **Iced** - Temporarily paused (planning files in `.planning/iced/goal-N/`)
- **Complete** - Finished and archived (planning files in `.planning/history/goal-N/`)

---

## How Goals Relate to Milestones

- **Milestones** (in MILESTONES.md) = High-level features/phases in the roadmap
- **Goals** = Actionable work units that implement milestones

A milestone may have multiple goals. Goals reference their parent milestone.

Example:
```
M10: Agent Deployment (Milestone)
  ├── Goal #1: Cross-platform build scripts
  ├── Goal #2: Linux install script
  └── Goal #3: Systemd service setup
```

---

## Quick Reference

### Start a New Goal
1. Add entry to registry table above
2. Set as "Active Goal"
3. Create planning files in project root:
   - `task_plan.md` - Phases and tasks
   - `findings.md` - Research notes
   - `progress.md` - Session log

### Ice a Goal (Pause)
```bash
mkdir -p .planning/iced/goal-N-description
mv task_plan.md findings.md progress.md .planning/iced/goal-N-description/
# Update status to "Iced" in registry
```

### Complete a Goal
```bash
mkdir -p .planning/history/goal-N-description
mv task_plan.md findings.md progress.md .planning/history/goal-N-description/
# Update status to "Complete" in registry
```

### Resume an Iced Goal
```bash
mv .planning/iced/goal-N-description/*.md ./
rmdir .planning/iced/goal-N-description
# Update status to "In Progress" in registry
```
