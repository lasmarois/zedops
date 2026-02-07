# Container Health Visual Feedback - Findings

## Docker Health Check States

Docker containers can have these health states (from `container.State.Health.Status`):
- `"starting"` - Health check running, not yet passed
- `"healthy"` - Health check passed
- `"unhealthy"` - Health check failed
- `nil/undefined` - No health check configured

## Current Agent Implementation

**File:** `agent/docker.go`

```go
type ContainerInfo struct {
    ID      string
    Names   []string
    Image   string
    State   string            // "running", "exited", "paused", etc.
    Status  string            // "Up 2 hours", "Exited (0) 10 minutes ago"
    Created int64
    Ports   []PortMapping
    Labels  map[string]string
}
```

**Missing:** Health field not collected

## Docker SDK Access to Health

The Docker SDK provides health via container inspection:

```go
// Option 1: From container list (types.Container)
container.State  // Just the state string, no health

// Option 2: From container inspect (types.ContainerJSON)
inspect.State.Health.Status  // Full health info
```

For `ListContainers()`, we use `types.Container` which doesn't include health directly.
We need to either:
1. Call `Inspect()` for each container (slower but accurate)
2. Check if `types.Container` has health info in newer Docker API versions

## Frontend StatusBadge Variants

**File:** `frontend/src/components/ui/status-badge.tsx`

| Variant | Color | Use For |
|---------|-------|---------|
| `success` | Green | Running, healthy |
| `warning` | Orange/Amber | Starting, agent offline, missing |
| `error` | Red | Failed, unhealthy |
| `info` | Blue | Creating, updating |
| `muted` | Gray | Stopped, deleted |

**Icons:**
- `pulse` - Animated pulsing (active states)
- `dot` - Static circle
- `alert` - Warning triangle
- `cross` - X mark
- `check` - Checkmark

## Steam-Zomboid Image Health Check

The steam-zomboid Docker image has a health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD pgrep -f "ProjectZomboid" || exit 1
```

- Start period: 120s (2 minutes before first check)
- Interval: 30s between checks
- This means container will show "starting" for ~2 minutes after launch

## Proposed Display Logic

```typescript
function getHealthDisplay(state: string, health?: string) {
  if (state !== 'running') {
    // Not running - use existing logic
    return existingLogic(state);
  }

  // Running container - check health
  switch (health) {
    case 'starting':
      return { label: 'Starting', variant: 'warning', icon: 'pulse' };
    case 'healthy':
      return { label: 'Running', variant: 'success', icon: 'pulse' };
    case 'unhealthy':
      return { label: 'Unhealthy', variant: 'error', icon: 'alert' };
    default:
      // No health check configured
      return { label: 'Running', variant: 'success', icon: 'pulse' };
  }
}
```

## Files to Modify

1. **Agent:** `agent/docker.go` - Add health field to ContainerInfo
2. **Manager:** Already passes through container data (no changes needed if agent sends it)
3. **Frontend Types:** `frontend/src/lib/api.ts` - Add health to Container interface
4. **Frontend Display:**
   - `frontend/src/lib/server-status.ts` - Update getDisplayStatus
   - `frontend/src/components/AgentServerList.tsx` - Update status display
   - `frontend/src/pages/ServerList.tsx` - Update status display
