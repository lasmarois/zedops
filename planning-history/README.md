# Planning History

This directory contains archived planning sessions for each milestone. Each session follows the Manus-style planning-with-files pattern.

---

## Organization

Each milestone gets its own folder when completed:

```
planning-history/
├── milestone-1-agent-connection/
│   ├── task_plan.md      # Structured plan with phases
│   ├── findings.md       # Research and design decisions
│   └── progress.md       # Session tracking log
├── milestone-2-container-control/
│   └── ...
└── milestone-N-name/
    └── ...
```

**Current sessions:** None (project in setup phase)

---

## Workflow

### During Development

When working on a milestone, planning files live in the project root:
```
zedops/
├── task_plan.md    # Current milestone only
├── findings.md     # Current milestone only
├── progress.md     # Current milestone only
└── ...
```

### After Completion

When a milestone is complete, move planning files to this directory:

```bash
# Example: Completing Milestone 1
mkdir -p planning-history/milestone-1-agent-connection/
mv task_plan.md planning-history/milestone-1-agent-connection/
mv findings.md planning-history/milestone-1-agent-connection/
mv progress.md planning-history/milestone-1-agent-connection/

# Update MILESTONES.md status (🚧 → ✅)
# Commit
git add .
git commit -m "Complete Milestone 1: Agent Connection"
```

**Result:** Root directory is clean for the next milestone.

---

## Session Index

### Milestone 1: Agent Connection
**Status:** ⏳ Not Started
**Planning:** *(not started)*

**Goal:** Establish WebSocket connection between agent and manager using NATS-inspired message protocol.

---

### Milestone 2: Container Control
**Status:** ⏳ Not Started
**Planning:** *(not started)*

**Goal:** Agent can list and control Docker containers via manager commands.

---

### Milestone 3: Log Streaming
**Status:** ⏳ Not Started
**Planning:** *(not started)*

**Goal:** Real-time log streaming from containers to UI.

---

### Milestone 4: Server Management
**Status:** ⏳ Not Started
**Planning:** *(not started)*

**Goal:** Full server lifecycle management (create, configure, deploy, delete).

---

### Milestone 5: RCON Integration
**Status:** ⏳ Not Started
**Planning:** *(not started)*

**Goal:** RCON console for server administration.

---

### Milestone 6: RBAC & Audit Logs
**Status:** ⏳ Not Started
**Planning:** *(not started)*

**Goal:** Role-based access control and audit logging.

---

## Session Template

When creating a new session folder, include these files:

```
milestone-N-name/
├── task_plan.md      # Structured plan (phases, tasks, success criteria)
├── findings.md       # Research, spikes, design decisions
└── progress.md       # Session log (what was done, when, outcomes)
```

Each file follows the planning-with-files pattern. See the plugin documentation for details.

---

## Purpose

These archived sessions serve as:
- **Historical context**: Why decisions were made
- **Reference**: How features were implemented
- **Learning**: Patterns to reuse, mistakes to avoid
- **Onboarding**: Help new contributors understand project evolution

**Note:** These files are NOT needed for day-to-day operations. They're historical documentation.

---

## Naming Convention

Folder names should be:
- Lowercase with hyphens
- Descriptive of the milestone
- Match the milestone name in MILESTONES.md

**Examples:**
- `milestone-1-agent-connection`
- `milestone-2-container-control`
- `milestone-3-log-streaming`

**Not:**
- `m1` (too terse)
- `Agent_Connection` (use hyphens, not underscores or spaces)
- `first-milestone` (use number for ordering)
