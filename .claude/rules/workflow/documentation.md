# Documentation Guidelines

## When to Update Which File

| Change Type | Update |
|-------------|--------|
| Architecture change | @ARCHITECTURE.md, @TECH_DECISIONS.md |
| New milestone | @MILESTONES.md (add status) |
| Milestone complete | Archive to `planning-history/`, update @MILESTONES.md |
| API endpoint added | `manager/src/index.ts`, API docs |
| Protocol change | @ARCHITECTURE.md, agent + manager code |
| Database schema | D1 migration file, @ARCHITECTURE.md |

## Technical Decisions

Record major decisions in @TECH_DECISIONS.md:
- Architecture changes
- Technology choices
- Security decisions
- Design pattern adoption

Use format: `TD-XXX: Decision Name (YYYY-MM-DD)`

## Principles

- **Reference over duplication**: Link to existing docs, don't copy
- **Keep docs current**: Update when making changes
- **Milestone deliverables**: Each must be user-visible and complete
