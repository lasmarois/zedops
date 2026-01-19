# Progress: P1 - Metrics Sparklines

## Session Log

### 2026-01-18 - Research & Planning
- Explored current metrics implementation via subagent
- Found: No historical storage, only latest metrics in metadata
- Found: Placeholder sparklines ready in MetricsRow.tsx
- Created planning files (task_plan.md, findings.md, progress.md)
- Starting Phase 1: Database Schema

## Changes Made
| File | Change | Status |
|------|--------|--------|
| `manager/migrations/0014_create_server_metrics_history.sql` | New table + indexes | ✅ |
| `agent/metricscollector.go` | New metrics collector goroutine | ✅ |
| `agent/main.go` | Integrate MetricsCollector | ✅ |
| `manager/src/durable-objects/AgentConnection.ts` | Handle server.metrics.batch | ✅ |
| `manager/src/routes/servers.ts` | GET /metrics/history endpoint | ✅ |
| `frontend/src/components/ui/sparkline.tsx` | Sparkline component | ✅ |
| `frontend/src/lib/api.ts` | (existing fetchServerMetricsHistory) | ✅ |
| `frontend/src/hooks/useServers.ts` | Add useServerMetricsHistory hook | ✅ |
| `frontend/src/components/server-overview/MetricsRow.tsx` | Use real sparklines | ✅ |
| `frontend/src/components/server-overview/ServerOverview.tsx` | Pass serverId prop | ✅ |

## Completed: 2026-01-18

P1 Metrics Sparklines milestone completed:
- D1 table storing 10-second interval metrics (3-day retention)
- Agent sends server.metrics.batch with CPU%, Memory%, player count
- Manager stores metrics in D1
- Frontend displays real sparklines (line for CPU/Memory, bar for players)

## Key Decisions
- 10-second collection interval
- D1 storage (not DO)
- 3-day retention with periodic cleanup
- Include player count in metrics batch
