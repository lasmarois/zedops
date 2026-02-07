# Goal-Based Workflow

> This file provides instructions for Claude Code when working on this project.
> **CRITICAL**: Follow these instructions at ALL times. Re-read after context compaction.

---

## Key References

Project documentation (auto-imported via @):
- @.planning/GOALS.md - Current work tracking (READ FIRST)
- @.planning/MILESTONES.md - Project roadmap
- @.planning/ARCHITECTURE.md - System design
- @.planning/SECURITY.md - Security guidelines
- @.planning/TECH_DECISIONS.md - Decision log

Active planning files (when goal is active):
- @task_plan.md - Current phases and tasks
- @progress.md - Session log
- @findings.md - Research discoveries

---

## Session Start Checklist

**ALWAYS do these at session start or after context compaction:**

1. **Read @.planning/GOALS.md** to identify current active goal
2. **If active goal exists**, read planning files from project root:
   - task_plan.md, findings.md, progress.md
3. **Check MILESTONES.md** if you need roadmap context

---

## Goal Tracking Workflow

### Overview

This project uses a two-tier tracking system:
- **Milestones** (MILESTONES.md) = What we're building (features, roadmap)
- **Goals** (GOALS.md) = How we're building it (actionable work units)

### Planning Files Location

```
project root/                   (ACTIVE goal's files)
├── task_plan.md
├── findings.md
├── progress.md
│
└── .planning/
    ├── GOALS.md               # Goal registry
    ├── MILESTONES.md          # Project roadmap
    ├── history/goal-N/        # Completed goals
    ├── iced/goal-N/           # Paused goals
    └── legacy/                # Archived milestone planning
```

---

## Starting a New Goal

1. **Update `.planning/GOALS.md`**:
   - Add new goal to registry table
   - Set it as "Active Goal"
   - Link to parent milestone

2. **Create planning files in PROJECT ROOT**:
   ```bash
   # Create these files:
   task_plan.md    # Phases, tasks, progress checkboxes
   findings.md     # Research results, discoveries
   progress.md     # Session log, errors, commits
   ```

3. **Use planning-with-files skill** for complex goals:
   ```
   Skill(skill: "planning-with-files", args: "Goal #N: Description")
   ```

---

## During Goal Work

**DO:**
- Update `task_plan.md` after completing each phase
- Log discoveries to `findings.md` immediately
- Track session progress in `progress.md`
- Re-read planning files before major decisions

**DON'T:**
- Make major decisions without re-reading the plan
- Forget to update progress after completing phases
- Leave planning files stale

---

## Icing a Goal (Temporary Pause)

Use when you need to pause work but plan to resume later.

1. **Update `.planning/GOALS.md`**:
   - Change status to "Iced"
   - Note reason for icing

2. **Move planning files**:
   ```bash
   mkdir -p .planning/iced/goal-N-description
   mv task_plan.md findings.md progress.md .planning/iced/goal-N-description/
   ```

3. **Clear "Active Goal"** in GOALS.md

---

## Resuming an Iced Goal

1. **Restore planning files**:
   ```bash
   mv .planning/iced/goal-N-description/*.md ./
   rmdir .planning/iced/goal-N-description
   ```

2. **Update GOALS.md**:
   - Set as "Active Goal"
   - Change status to "In Progress"

3. **Add session entry** to progress.md noting resumption

---

## Completing a Goal

1. **Mark phases complete** in task_plan.md

2. **Archive planning files**:
   ```bash
   mkdir -p .planning/history/goal-N-description
   mv task_plan.md findings.md progress.md .planning/history/goal-N-description/
   ```

3. **Update GOALS.md**:
   - Set status to "Complete"
   - Add completion date
   - Clear "Active Goal"

4. **Update MILESTONES.md** if milestone is complete

5. **Commit**:
   ```bash
   git add .planning/
   git commit -m "docs: complete Goal #N - Description"
   ```

---

## The 3-Strike Error Protocol

```
ATTEMPT 1: Diagnose & Fix
ATTEMPT 2: Alternative Approach (NEVER same action)
ATTEMPT 3: Broader Rethink
AFTER 3 FAILURES: Escalate to User
```

Log ALL errors to progress.md with resolution attempts.

---

## Read vs Write Matrix

| Situation | Action |
|-----------|--------|
| Just wrote a file | DON'T read (in context) |
| Starting new phase | Read plan/findings |
| Error occurred | Read relevant file |
| Resuming after gap | Read ALL planning files |

---

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `.planning/` | Goal registry, docs, archives |
| `.planning/history/` | Completed goals |
| `.planning/iced/` | Paused goals |
| `.planning/legacy/` | Old milestone archives |
| `.claude/rules/` | Claude Code workflow instructions |
