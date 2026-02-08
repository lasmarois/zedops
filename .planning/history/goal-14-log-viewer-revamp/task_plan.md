# Goal #14: Log Viewer Revamp — xterm.js Terminal-Style Logs

## Phase 1: Install Dependencies
- [x] Install `@xterm/addon-search`

## Phase 2: Create ANSI Formatting Utilities
- [x] Create `frontend/src/lib/ansi-format.ts`
- [x] `formatAgentLogLine()` with colored level badges
- [x] `formatContainerLogLine()` with stdout/stderr coloring

## Phase 3: Create XTermLogViewer Component
- [x] Create `frontend/src/components/ui/xterm-log-viewer.tsx`
- [x] Read-only xterm terminal with VS Code dark theme
- [x] FitAddon + SearchAddon + ResizeObserver
- [x] Incremental rendering (track renderedCount, only write new lines)
- [x] Follow mode detection via onScroll
- [x] Search highlighting via searchTerm prop

## Phase 4: Refactor LogViewer.tsx (Container Logs)
- [x] Replace TerminalLog with XTermLogViewer
- [x] Compute formattedLines with ANSI formatting
- [x] Handle pause via snapshot count
- [x] Keep toolbar, scroll-to-top button

## Phase 5: Refactor AgentLogViewer.tsx (Agent Logs)
- [x] Replace TerminalLog with XTermLogViewer
- [x] Use formatAgentLogLine with level filter
- [x] Keep offline banner and level dropdown

## Phase 6: Clean Up terminal-log.tsx
- [x] Remove TerminalLog, TerminalLogRef, TerminalToolbar
- [x] Keep TerminalStatus, TerminalLineCount, LogLine type

## Phase 7: Build, Test, Deploy
- [x] `npm run build` — no TS errors
- [x] Push to dev (commit c61f155), CI deploying
- [ ] Verify all features work on dev environment
