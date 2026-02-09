# Goal #17: Remove Agent from Manager

## Goal
Allow admins to remove a registered agent (online or offline) from the manager, cleaning up all associated data (servers, backups, Durable Object state).

## Key Findings
- Disabled "Disconnect" button already in AgentDetail.tsx (placeholder)
- No DELETE endpoint for registered agents — only pending agents via `/api/admin/pending-agents/:id`
- D1 has `ON DELETE CASCADE` on `servers` and `backups` tables
- RBAC system in place — admin-only operation
- Durable Object stores agent state + manages WebSocket

## Phases

### Phase 1: Backend — DELETE /api/agents/:id endpoint `status: complete`
- [x] Add `DELETE /api/agents/:id` route in `manager/src/routes/agents.ts`
- [x] Require admin role (requireRole('admin') middleware)
- [x] If agent is online: force-close WebSocket via Durable Object before deletion
- [x] Delete agent from D1 (CASCADE handles servers/backups)
- [x] Clean up role assignments scoped to deleted agent
- [x] Return deleted agent info + count of cascaded deletions
- [x] Audit log with agent.deleted action

### Phase 2: Durable Object — Force disconnect support `status: complete`
- [x] Add /force-disconnect POST endpoint in DO fetch handler
- [x] Closes agent WebSocket + all UI WebSockets
- [x] Clears all DO persistent storage via deleteAll()
- [x] Resets all in-memory state

### Phase 3: Frontend — Enable remove button + confirmation dialog `status: complete`
- [x] Enable the existing disabled "Disconnect" button in AgentDetail.tsx
- [x] Renamed to "Remove Agent" with Trash2 icon
- [x] Added ConfirmDialog with destructive warning (agent name, irreversible)
- [x] Added `deleteAgent(id)` to `frontend/src/lib/api.ts`
- [x] After deletion, redirects to /agents and invalidates query cache
- [x] Loading spinner while mutation is pending

### Phase 4: Testing & Verification `status: complete`
- [x] Test removing an offline agent (zedops-test-agent on dev)
- [x] Test removing an online agent (fresh agent on test VM, force disconnect + delete)
- [x] Verify D1 deletion worked (agents list shows 0 agents)
- [x] Verify confirmation dialog shows agent name + warning
- [x] Verify Cancel dismisses dialog without action
- [x] Verify redirect to /agents after deletion
- [x] Verify audit log entries created (2x "agent deleted" by admin → zedops-test-agent)
- [x] Verify agent process exits cleanly after removal (code 78, "Agent not found")

## Architecture Notes
- Agent deletion is a hard delete (no soft delete / restore)
- The agent binary on the host keeps its token — if it reconnects, auth will fail (token hash gone from D1)
- Durable Object keyed by agent name — after deletion, a new agent with same name can re-register

## Files to Modify
- `manager/src/index.ts` — Add DELETE route
- `manager/src/durable-objects/AgentConnection.ts` — Force disconnect support
- `frontend/src/pages/AgentDetail.tsx` — Enable button, add dialog
- `frontend/src/lib/api.ts` — Add deleteAgent()
