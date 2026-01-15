# Enhanced Metrics & Monitoring

**Origin:** Deferred enhancements from Milestone 5 (Host Metrics Display)
**Status:** ⏳ Planned (potential Milestone 10)
**Created:** 2026-01-11
**Related:** [planning-history/milestone-5-host-metrics/](planning-history/milestone-5-host-metrics/)

---

## Context

Milestone 5 delivered basic host metrics (CPU, memory, disk) with real-time display in the UI. These enhancements build on that foundation to provide comprehensive monitoring, alerting, and multi-platform support.

**Current State (M5 Complete):**
- ✅ Agent collects CPU/memory/disk every 30 seconds via /proc filesystem
- ✅ Metrics stored in D1 agents.metadata field (ephemeral, latest values only)
- ✅ UI displays color-coded badges (green <70%, yellow 70-85%, red >85%)
- ✅ Linux-only (relies on /proc filesystem)
- ✅ Host-level metrics only (not per-container)

**Implementation:**
- Agent: `agent/metrics.go` - CollectHostMetrics() with /proc parsing
- Manager: `manager/src/durable-objects/AgentConnection.ts` - Stores in D1 metadata
- Frontend: `frontend/src/components/AgentList.tsx` - MetricBadge component

---

## Enhancements

### 1. Historical Metrics Tracking (Time-Series)

**Goal:** Store metrics history for trending and analysis

**Requirements:**
- [ ] Create D1 table: `agent_metrics` (agent_id, timestamp, cpu, memory, disk)
- [ ] Retention policy (e.g., 1-hour granularity for 7 days, daily avg for 90 days)
- [ ] Agent continues sending metrics with heartbeat (no change)
- [ ] Manager stores both latest (metadata) and historical (agent_metrics table)
- [ ] API endpoint: `GET /api/agents/:id/metrics/history?start=&end=`

**Use Cases:**
- Identify CPU spikes over time
- Track disk growth trends
- Correlate metrics with server issues

**Estimated Effort:** 1-2 days

---

### 2. Metrics Graphs & Charts

**Goal:** Visualize metrics trends with interactive charts

**Requirements:**
- [ ] Add charting library (recharts, victory, or similar)
- [ ] Line graphs for CPU/memory/disk over time (last 24h, 7d, 30d)
- [ ] Sparklines in AgentList for at-a-glance trends
- [ ] Hover tooltips with exact values and timestamps
- [ ] Zoom/pan for detailed inspection
- [ ] Export chart as PNG or CSV

**UI Placement:**
- Expand AgentList row to show mini-charts (accordion/collapse)
- Or add "Agent Details" page with full dashboard

**Estimated Effort:** 2-3 days (depends on charting library choice)

---

### 3. Per-Container Resource Metrics

**Goal:** Monitor CPU/memory usage for individual containers (servers)

**Requirements:**
- [ ] Agent collects per-container metrics via Docker Stats API
- [ ] New message type: `container.metrics` (sent with heartbeat)
- [ ] Manager stores in D1 containers table metadata field (similar to agents)
- [ ] UI shows metrics per server in ContainerList
- [ ] Color-coded badges per container

**Challenges:**
- Docker Stats API returns live data (no historical accumulation)
- Need to store snapshots for trending
- CPU % is per-container, not host-relative

**Use Cases:**
- Identify resource-hungry servers
- Detect memory leaks in game servers
- Plan server consolidation

**Estimated Effort:** 2-3 days (agent + manager + UI)

---

### 4. Network Metrics (Bandwidth Usage)

**Goal:** Track network I/O per agent and per container

**Requirements:**
- [ ] Agent collects network stats via /proc/net/dev (host) or Docker Stats (container)
- [ ] Metrics: bytes sent/received, packets sent/received
- [ ] Calculate rate: MB/s upload/download
- [ ] Store in time-series table (agent_network_metrics, container_network_metrics)
- [ ] UI displays bandwidth graphs and current rate

**Use Cases:**
- Detect abnormal traffic (DDoS, data exfiltration)
- Monitor server player count correlation
- Plan network capacity

**Estimated Effort:** 2-3 days (agent + manager + UI)

---

### 5. Custom Thresholds (User-Configurable)

**Goal:** Allow users to set warning/critical levels per agent

**Requirements:**
- [ ] UI settings panel per agent (or global defaults)
- [ ] Thresholds: CPU (warn%, crit%), Memory (warn%, crit%), Disk (warn%, crit%)
- [ ] Store in D1 agent_settings table (agent_id, thresholds JSON)
- [ ] Frontend uses custom thresholds instead of hardcoded (70/85)
- [ ] Visual indicator when thresholds customized

**Use Cases:**
- High-performance servers need higher CPU thresholds
- Low-disk agents need lower disk thresholds
- Different teams have different SLAs

**Estimated Effort:** 1-2 days

---

### 6. Alerting (Email/Webhook on Threshold Breach)

**Goal:** Notify users when metrics exceed thresholds

**Requirements:**
- [ ] Alert rules: Per-agent or global
- [ ] Notification channels: Email (SMTP), Webhook (HTTP POST), Discord, Slack
- [ ] Alert conditions: CPU >X% for Y minutes, Disk >Z% for W minutes
- [ ] Cooldown period (avoid alert spam)
- [ ] Alert history log (D1 table: alert_events)
- [ ] UI to configure alert rules and test notifications

**Architecture:**
- Manager Durable Object checks thresholds on heartbeat
- Sends alerts via Cloudflare Workers (fetch to webhook, Mailgun/SendGrid for email)
- Queue alerts to avoid blocking heartbeat handler

**Use Cases:**
- Page on-call when disk full
- Notify team when CPU high for 10 minutes
- Integrate with existing incident management (PagerDuty, Opsgenie)

**Estimated Effort:** 3-5 days (alert engine + notification channels + UI)

---

### 7. Windows/macOS Support (Multi-Platform Metrics)

**Goal:** Extend metrics collection beyond Linux

**Requirements:**
- [ ] Agent detects OS at runtime (runtime.GOOS)
- [ ] Separate collection methods per OS:
  - **Linux**: /proc filesystem (current implementation)
  - **Windows**: WMI queries or Windows Performance Counters
  - **macOS**: sysctl or Go runtime libraries
- [ ] Use Go libraries (gopsutil or shirou/gopsutil) for cross-platform support
- [ ] Fallback to Go runtime package if platform-specific fails
- [ ] Test on Windows and macOS VMs

**Trade-offs:**
- gopsutil adds dependency (~500KB binary size increase)
- But provides consistent cross-platform API
- Consider conditional compilation (build tags) to keep Linux builds small

**Use Cases:**
- Deploy agent on Windows game servers
- Monitor macOS development machines
- Unified platform for mixed infrastructure

**Estimated Effort:** 2-3 days (testing + gopsutil integration + cross-compilation)

---

## Implementation Priority

**Suggested Order:**
1. **Historical Metrics** (Foundation for all other enhancements)
2. **Custom Thresholds** (Improves existing M5 feature)
3. **Metrics Graphs** (Leverages historical data)
4. **Alerting** (High value, uses custom thresholds)
5. **Per-Container Metrics** (Expands monitoring scope)
6. **Network Metrics** (Nice-to-have, completes picture)
7. **Windows/macOS Support** (Platform expansion)

**Quick Wins (1-2 days each):**
- Custom Thresholds
- Historical Metrics (basic time-series table)

**High Value (3-5 days):**
- Alerting
- Metrics Graphs

**Future Expansion:**
- Per-Container Metrics
- Network Metrics
- Windows/macOS Support

---

### 8. Real-Time Agent Logs (New)

**Goal:** View agent's log output in real-time from the platform

**Requirements:**
- [ ] Agent captures its own stdout/stderr log output
- [ ] New message type: `agent.logs` (subscribe/stream)
- [ ] Agent streams logs to manager when subscribed
- [ ] UI adds "Logs" tab to agent detail page (similar to container logs)
- [ ] Log filtering, search, pause/resume controls

**Implementation Options:**
- **Option A (WebSocket stream)**: Frontend subscribes, agent streams via existing WS
- **Option B (Log buffer)**: Agent buffers last N lines, frontend polls or fetches on demand
- **Option C (Log file)**: Agent writes to file, frontend requests via new endpoint

**Use Cases:**
- Debug agent connection issues from platform
- Monitor agent startup and authentication
- View agent errors without SSH access to host

**Estimated Effort:** 2-3 days

---

## Related Milestones

- **Milestone 5** (Complete) - Host Metrics Display
- **Milestone 10** (Proposed) - Server Metrics & Monitoring (could encompass these enhancements)
- **Milestone 11** (Proposed) - Backup & Restore (could integrate with disk metrics)

---

## Notes

- All enhancements are backward compatible (existing M5 metrics continue working)
- Historical metrics require D1 schema migration
- Alerting requires Cloudflare Workers API calls (email/webhook)
- Cross-platform support may require CI/CD pipeline for multi-arch builds
- Consider using existing Go libraries (gopsutil) vs custom /proc parsing trade-off

---

## References

- Milestone 5 Implementation: [planning-history/milestone-5-host-metrics/](planning-history/milestone-5-host-metrics/)
- Agent Metrics Code: `agent/metrics.go`
- Manager Storage: `manager/src/durable-objects/AgentConnection.ts`
- UI Display: `frontend/src/components/AgentList.tsx`
