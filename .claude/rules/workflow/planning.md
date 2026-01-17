# Milestone-Based Planning Workflow

## Starting a Milestone

1. Use `/planning-with-files` skill to create planning files in root:
   - @task_plan.md - Phases and tasks
   - @findings.md - Research notes
   - @progress.md - Status tracking

2. Break milestone into 3-5 phases
3. Track status in @MILESTONES.md

## Completing a Milestone

```bash
mkdir -p planning-history/milestone-N-name/
mv task_plan.md findings.md progress.md planning-history/milestone-N-name/
# Update MILESTONES.md status
git add . && git commit -m "Complete Milestone N: Name"
```

## Sub-Milestone Pattern (M9.8.X style)

For parent milestones with many small tasks:

- Use `task_plan_m98.md` format in root
- Archive each sub-milestone immediately after completion
- Track in parent file (e.g., `MILESTONE-M98.md`)

## Rules

- One planning session per milestone/sub-milestone
- Always archive to `planning-history/` when complete
- Keep root directory clean between milestones
- Reference previous milestones in `planning-history/` as needed
