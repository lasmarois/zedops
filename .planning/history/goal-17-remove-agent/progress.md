# Goal #17: Remove Agent — Progress

## Session 1 — 2026-02-09

### Exploration
- Explored full agent lifecycle: registration, auth, disconnect
- Found disabled placeholder button in AgentDetail.tsx
- Confirmed D1 CASCADE on servers/backups tables
- No existing DELETE endpoint for registered agents
- Created planning files, ready to implement

### Implementation — Phases 1-3
- **Backend (agents.ts)**: Added `DELETE /api/agents/:id` — admin-only, counts servers/backups, force-disconnects online agents via DO, deletes from D1 (CASCADE), cleans up role assignments, audit logs
- **Durable Object**: Added `/force-disconnect` POST endpoint — closes agent + UI WebSockets, clears all storage, resets in-memory state
- **Frontend (api.ts)**: Added `deleteAgent(id)` function
- **Frontend (AgentDetail.tsx)**: Replaced disabled "Disconnect" with active "Remove Agent" button + ConfirmDialog (destructive variant, warns about permanent deletion)
- **Build**: Frontend compiles clean. Manager has pre-existing TS errors (users.ts, Message.ts) — not from our changes.

### Phase 4 — Browser Testing (dev)
- Deployed to dev via CI (run 21835512135, success in 57s)
- Navigated to agent detail for `zedops-test-agent` (offline)
- **Button visible**: "Remove Agent" with trash icon, top-right, destructive styling
- **Cancel test**: Clicked Remove Agent → dialog appeared → clicked Cancel → dialog dismissed, no action
- **Remove test**: Clicked Remove Agent → confirmed → agent deleted → redirected to /agents (0 agents)
- **Audit log**: "agent deleted" entry at top, "just now", admin → zedops-test-agent
- All offline tests pass.

### Phase 4b — Online Agent Testing (test VM)
- Created fresh agent via UI: "Add Agent" → "zedops-test-agent" → generated ephemeral token
- Built agent binary, copied to test VM (10.0.13.208), started with `--no-update --token`
- Agent registered, came online with live metrics (CPU 1.7%, MEM 85.5%, Storage 46%)
- 1 running container visible (steam-zomboid-log-test, unmanaged)
- Clicked "Remove Agent" → confirmed → agent force-disconnected → redirected to /agents (0 agents)
- Agent logs confirm: WebSocket closed → reconnect attempt → "Agent not found" → exit code 78
- Audit log shows 2x "agent deleted" entries (offline + online tests)
- **All test scenarios pass. Goal #17 complete.**
