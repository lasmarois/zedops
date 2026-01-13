# Findings: M9.8 Polish Phase

**Session:** 2026-01-13
**Goal:** Fix UI/UX issues in server management interface

---

## Technical Discoveries

### TanStack Query Invalidation Patterns

**Finding:** Query key structure matters for proper cache invalidation

**Context:** After purging a server, the UI didn't refresh because mutation only invalidated agent-specific queries but page used global query.

**Solution:**
```typescript
// BEFORE (buggy)
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({ queryKey: ['servers', variables.agentId] });
  queryClient.invalidateQueries({ queryKey: ['containers', variables.agentId] });
}

// AFTER (fixed)
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({ queryKey: ['servers', variables.agentId] });
  queryClient.invalidateQueries({ queryKey: ['servers', 'all'] }); // Added global invalidation
  queryClient.invalidateQueries({ queryKey: ['containers', variables.agentId] });
}
```

**Lesson:** When using both scoped and global queries, must invalidate ALL relevant query keys

---

### Soft Delete + Purge Pattern

**Finding:** Backend logic relied on container_id existing to send delete commands

**Context:** Soft-deleted servers often have no container (already removed), so `if (server.container_id)` check prevented agent from receiving data removal commands.

**Root Cause:**
```typescript
// BEFORE (buggy)
if (server.container_id) {
  // Only send delete command if container exists
  // Problem: Soft-deleted servers may have container_id = null
}
```

**Solution:**
```typescript
// AFTER (fixed)
const agent = await c.env.DB.prepare(`SELECT name, status FROM agents WHERE id = ?`).bind(agentId).first();

if (agent && agent.status === 'online') {
  // Always send delete command if agent is online
  // Pass serverName so agent can remove data without container
  await stub.fetch(`http://do/servers/${serverId}`, {
    method: 'DELETE',
    body: JSON.stringify({
      containerId: server.container_id || '',  // Empty string if no container
      serverName: server.name,  // NEW: Pass server name
      removeVolumes: removeData,
    }),
  });
}
```

**Lesson:** Soft delete operations must work independently of associated resources (containers)

---

### Go Docker SDK - Container Operations

**Finding:** Docker SDK operations can fail gracefully for non-existent containers

**Context:** When purging soft-deleted servers, container may not exist but data removal should still proceed.

**Solution:**
```go
func (dc *DockerClient) DeleteServer(ctx context.Context, containerID string, serverName string, removeVolumes bool) error {
    // Container removal is optional (skip if containerID empty)
    if containerID != "" {
        // Try to stop/remove, but log warnings instead of returning errors
        if err := dc.cli.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout}); err != nil {
            log.Printf("Warning: failed to stop container (may already be stopped): %v", err)
        }
        // ... continue with removal
    }

    // Data removal works independently of container
    if removeVolumes && serverName != "" {
        basePath := fmt.Sprintf("/var/lib/zedops/servers/%s", serverName)
        if err := os.RemoveAll(basePath); err != nil {
            return fmt.Errorf("failed to remove volumes: %w", err)
        }
        log.Printf("Volumes removed successfully")
    }

    return nil
}
```

**Lesson:** Separate concerns - container lifecycle and data lifecycle should be independent

---

### React Component State Management

**Finding:** Mutation hooks provide built-in loading states via `isPending`

**Context:** Server action buttons needed loading feedback during operations.

**Implementation:**
```tsx
const startServerMutation = useStartServer()

<Button
  onClick={handleStart}
  disabled={startServerMutation.isPending}
>
  {startServerMutation.isPending ? 'Starting...' : 'Start'}
</Button>
```

**Lesson:** TanStack Query mutations provide built-in state management for loading/error/success

---

### Multi-Step Confirmation Dialogs

**Finding:** JavaScript `confirm()` can be chained for multi-step confirmations

**Context:** Purge operation needed to ask: (1) Remove data? (2) Final confirmation

**Implementation:**
```typescript
const handlePurge = (server: ServerWithAgent) => {
  // First prompt: Choose data removal (OK = yes, Cancel = no)
  const removeData = confirm(
    `⚠️ Click OK to DELETE SERVER DATA\nClick Cancel to keep data`
  )

  if (removeData !== null) { // User didn't close dialog
    // Second prompt: Final confirmation
    const finalConfirm = confirm(
      removeData
        ? `⚠️ FINAL WARNING: Delete "${server.name}" AND all its data?`
        : `Purge "${server.name}" record but keep data?`
    )

    if (finalConfirm) {
      purgeServerMutation.mutate({ agentId, serverId, removeData })
    }
  }
}
```

**Lesson:** Two-step confirmations improve UX for destructive operations

---

## Codebase Patterns

### WebSocket Message Protocol (NATS-inspired)

**Pattern:** Request-reply with inbox routing

```typescript
// Manager sends request
this.send({
  subject: "server.delete",
  data: { containerId, serverName, removeVolumes },
  reply: inbox,  // Unique reply subject
});

// Agent processes and replies
a.send(Message{
    Subject: msg.Reply,
    Data: response,
})
```

**Benefit:** Decouples request from response, allows async operations

---

### Multi-Stage Docker Build

**Pattern:** Separate validation stage from runtime

```dockerfile
FROM alpine:latest AS scripts
COPY scripts/ /scripts/
RUN apk add --no-cache bash && \
    find /scripts -name "*.sh" -exec bash -n {} \;

FROM debian:bookworm-slim AS runtime
COPY --from=scripts /scripts /scripts
```

**Benefit:** ~15x faster rebuilds (10s vs 3-4min) when modifying scripts

---

### TanStack Query - refetchIntervalInBackground Option

**Finding:** TanStack Query pauses refetchInterval when browser window/tab loses focus

**Context:** Agent metrics on AgentDetail page didn't auto-update when user was looking at the page, even though `refetchInterval: 5000` was configured in useAgents hook.

**Root Cause:**
```typescript
// BEFORE (pauses when tab not focused)
return useQuery({
  queryKey: ['agents'],
  queryFn: () => fetchAgents(),
  enabled: isAuthenticated,
  refetchInterval: 5000, // Refetch every 5 seconds
});
```

By default, TanStack Query pauses `refetchInterval` when:
- The browser window/tab is not focused
- The component is not visible
- The device screen is off

**Solution:**
```typescript
// AFTER (continues refetching in background)
return useQuery({
  queryKey: ['agents'],
  queryFn: () => fetchAgents(),
  enabled: isAuthenticated,
  refetchInterval: 5000, // Refetch every 5 seconds
  refetchIntervalInBackground: true, // Continue refetching even when tab not focused
});
```

**Lesson:** For real-time metrics/monitoring dashboards, always add `refetchIntervalInBackground: true` to ensure continuous updates regardless of focus state

**Benefit:** Users can now monitor agent metrics continuously without keeping the tab focused

### React Context - Hardcoded UI vs Dynamic Data

**Finding:** UI components can be disconnected from available context data

**Context:** Sidebar displayed hardcoded "admin" and "admin@zedops.local" even though UserContext had the correct user email (mail@nicomarois.com).

**Root Cause:**
```typescript
// BEFORE (hardcoded values)
<div className="text-sm font-medium text-foreground truncate">admin</div>
<div className="text-xs text-muted-foreground truncate">admin@zedops.local</div>
```

The sidebar component wasn't importing or using the `useUser` hook from UserContext at all. The user data existed in context (from login flow), but the UI just wasn't reading it.

**Solution:**
```typescript
// Import and use context
import { useUser } from "@/contexts/UserContext"

export function Sidebar({ ... }) {
  const { user, logout } = useUser()

  const getUserInitials = () => {
    if (!user?.email) return "U"
    const emailParts = user.email.split("@")[0]
    return emailParts.charAt(0).toUpperCase()
  }

  // AFTER (dynamic from context)
  <div className="text-sm font-medium text-foreground truncate">
    {user?.role || 'User'}
  </div>
  <div className="text-xs text-muted-foreground truncate">
    {user?.email || 'No email'}
  </div>
```

**Lesson:** Always verify UI components are actually connected to context/state, not just displaying placeholder data

**Bonus Fix:** Wired up logout button to actual `logout()` function from context (was previously non-functional)

---

### Cloudflare Workers - SPA Routing with Asset Handler

**Finding:** Worker catch-all routes can interfere with Cloudflare's automatic asset serving

**Context:** Browser refresh caused white page on all routes except root. User had to manually reset URL to get back to dashboard.

**Root Cause:**
```typescript
// BEFORE (buggy)
const indexHtmlContent = `<!doctype html>
<html lang="en">
  <head>
    <script type="module" crossorigin src="/assets/index-C8kK7RS2.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-WvvdXZei.css">
  </head>
  ...
</html>`;

app.get('*', (c) => {
  // Catch-all route serving hardcoded HTML
  return c.html(indexHtmlContent);
});
```

**Problem Breakdown:**
1. Vite generates new hashed filenames on every build (e.g., `index-B4TNYH6f.js`)
2. Hardcoded HTML had OLD filenames from previous build (`index-C8kK7RS2.js`)
3. Catch-all route `app.get('*', ...)` intercepted all requests before Cloudflare asset handler
4. Browser received outdated HTML → tried to load non-existent JS file → white page

**Solution (Attempt #1 - FAILED):**
```typescript
// AFTER (incorrect approach)
// Remove catch-all route entirely

// Assumed wrangler.toml asset handler would work automatically
```

**Problem:** Hono framework returns 404 for unmatched routes, which prevents Cloudflare asset handler from serving index.html. The asset handler only works if the worker doesn't return a response.

**Solution (Attempt #2 - SUCCESS):**
```typescript
// AFTER (correct approach)
// Add ASSETS binding
type Bindings = {
  ASSETS: Fetcher;
  // ... other bindings
};

// Add catch-all that delegates to ASSETS fetcher
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});
```

**How It Works:**
1. Worker routes are evaluated first (`/api/*`, `/ws`, `/health`)
2. If no route matches, catch-all route delegates to `c.env.ASSETS.fetch()`
3. ASSETS fetcher serves actual files from dist folder (CSS, JS, images)
4. For non-asset paths (like `/agents`, `/servers/123`), returns actual `index.html`
5. `not_found_handling = "single-page-application"` in wrangler.toml ensures SPA routing works

**Lesson:** When using Cloudflare Workers with `[assets]` configuration and Hono:
- DO NOT hardcode HTML with asset filenames (they change every build)
- DO NOT rely on implicit asset fallback (Hono returns 404 first)
- DO add ASSETS binding to worker types
- DO add catch-all route that explicitly delegates to `c.env.ASSETS.fetch()`
- Worker API routes are evaluated first, then catch-all delegates to assets

**Benefit:**
- Browser refresh now works on all client-side routes
- Asset filenames always up-to-date (no manual sync needed)
- Proper separation between API routes and static asset serving

---

## Open Questions

None! All M9.8 polish items complete.

---

## References

- TanStack Query docs: Query invalidation
- Docker SDK Go docs: Container lifecycle management
- React Hook patterns: Mutation state management
- NATS protocol: Request-reply pattern
