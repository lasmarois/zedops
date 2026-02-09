# Goal #17: Remove Agent — Findings

## Agent Data Model
- D1 table: `agents` (id, name, token_hash, status, last_seen, created_at, metadata, public_ip, hostname)
- Foreign keys with CASCADE: `servers.agent_id`, `backups.agent_id`
- Durable Object storage: agentId, agentName, clientIp, isAgentLogStreaming

## Existing Deletion Patterns
- Pending agents: `DELETE /api/admin/pending-agents/:id` — hard delete, checks `status='pending'`
- Servers: soft delete (status='deleted', deleted_at) + hard purge endpoint
- Agent removal should be hard delete since there's no meaningful "restore" for an agent record

## Durable Object Lifecycle
- DO keyed by agent name (via `env.AGENT_CONNECTION.get(env.AGENT_CONNECTION.idFromName(agentName))`)
- Agent WebSocket stored as class property (this.agentSocket)
- `handleAgentClose()` clears DO storage and updates D1 status
- To force-close: call `this.agentSocket.close()` from within DO

## Frontend Placeholder
- AgentDetail.tsx line ~205: disabled "Disconnect" button with `variant="glass-destructive"`
- Title tooltip: "Not yet implemented - Planned for future release"

## Permission Model
- Admin token check via `requireAdmin()` middleware already used on agent endpoints
- No granular "delete agent" permission needed — admin-only is sufficient
