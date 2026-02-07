# Findings: M7.5 - UI Styling & Design System

**Purpose:** Document discoveries, issues, and solutions during UI styling implementation

**Milestone:** M7.5 - UI Styling & Design System

**Started:** 2026-01-12

---

## Finding Template

```markdown
## Finding N: 🐛/💡 Title

**Date Discovered:** YYYY-MM-DD

**Context:** [What were you doing when you discovered this?]

**Issue/Discovery:** [What did you find?]

**Impact:** [How does this affect the implementation?]

**Resolution:** [How was it resolved?]

**Status:** 🔍 investigating | ✅ resolved | ⏳ deferred

**Date Resolved:** YYYY-MM-DD (if resolved)
```

---

## Findings Log

## Finding 1: 🐛 npm install executed from wrong directory

**Date Discovered:** 2026-01-12

**Context:** After completing Phase 0.3 (installing shadcn components), user noticed unexpected files in project root: `node_modules/`, `src/`, `package.json`, `package-lock.json`.

**Issue/Discovery:**
During Phase 0.3, some npm install commands were executed from project root (`/Volumes/Data/docker_composes/zedops`) instead of the frontend directory (`/Volumes/Data/docker_composes/zedops/frontend`). This created duplicate package files in the wrong location.

**Root Cause:**
Bash tool commands did not include explicit `cd /Volumes/Data/docker_composes/zedops/frontend` prefix, causing npm to run from the current working directory (project root).

**Impact:**
- 57MB of duplicate node_modules in root
- Confusing project structure
- Dependencies not available to frontend build until fixed
- Required cleanup and reinstallation

**Resolution:**
1. Installed all Radix UI packages in correct location: `cd frontend && npm install @radix-ui/...`
2. Verified build successful
3. Removed duplicate files from root: `rm -rf node_modules/ src/ package.json package-lock.json`
4. Final verification: Build test passed ✅

**Lesson Learned:**
Always include explicit `cd /path/to/frontend` in Bash commands when running npm/node operations. Monorepo pattern requires explicit directory navigation.

**Commit:** 8e17cc8 - "Fix Phase 0 cleanup: Move shadcn dependencies to frontend/"

**Status:** ✅ resolved

**Date Resolved:** 2026-01-12

---
