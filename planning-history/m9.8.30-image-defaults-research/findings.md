# Findings: M9.8.30 - Image Default ENV Values

**Feature:** Display accurate Docker image defaults in Configuration tab
**Started:** 2026-01-14

---

## Investigation Log

### Session 1: 2026-01-14 - Understanding Current Flow

Starting investigation to answer key questions about when/how to inspect Docker images for default ENV values.

**Goals:**
1. Understand when Docker images are pulled
2. Identify if we need defaults during creation or only display
3. Evaluate inspection method options
4. Design optimal solution

---

## Discoveries

### Finding 1: Image Pull Timing ✅

**Source:** `agent/server.go` lines 39-67

The Docker image is pulled **during** `CreateServer()` on the agent side:

```go
// Pull latest image (always check registry for updates)
log.Printf("Pulling image: %s (checking registry for updates...)", fullImage)
reader, err := dc.cli.ImagePull(ctx, fullImage, image.PullOptions{})
```

**Key Insights:**
- Pull happens BEFORE container creation
- By the time container exists, image is already local
- This means `docker image inspect` would be fast (no network call)
- Pull is agent-side, not client-side

**Implication:** No need for registry inspection (skopeo) - image is local after creation.

---

### Finding 2: Current ENV Handling ✅

**Source:** `agent/server.go` lines 69-73

ENV variables come from user input (manager → agent), not from image defaults:

```go
// Convert config map to ENV array
env := make([]string, 0, len(config.Config))
for key, value := range config.Config {
    env = append(env, fmt.Sprintf("%s=%s", key, value))
}
```

**Key Insights:**
- No image inspection currently happens
- No defaults are extracted from images
- User-provided ENV vars are passed directly to container

**Implication:** We need to add image inspection functionality to extract defaults.

---

### Finding 3: When Do We Need Defaults? ✅

**Analysis of UX Flow:**

1. **Server Creation Form (ServerForm.tsx)**
   - User enters: name, image tag, admin password
   - Most fields are EMPTY or have UI defaults (not image defaults)
   - Form doesn't need image-specific defaults

2. **Configuration Display (ConfigurationDisplay.tsx)**
   - Shows server configuration POST-creation
   - Displays "Not set" or hard-coded defaults for missing values
   - **This is where we need accurate image defaults**

**Key Insight:** We don't need defaults during creation, only during display.

**Implication:** No UX impact on server creation flow! We can query defaults lazily when viewing config tab.

---

### Finding 4: Docker Go SDK Capabilities ✅

**Research:** Docker Go SDK has `ImageInspect` method

```go
// From github.com/docker/docker/client
func (cli *Client) ImageInspect(ctx context.Context, imageID string) (types.ImageInspect, error)
```

Returns `types.ImageInspect` which includes:
- `Config.Env` []string - Default ENV variables from image
- `Config.Labels` map[string]string
- Other metadata

**Example ENV extraction:**
```go
inspect, err := dc.cli.ImageInspect(ctx, fullImage)
if err != nil {
    return nil, err
}

// inspect.Config.Env = ["PUID=1430", "PGID=1430", "TZ=Etc/UTC", ...]
```

**Key Insight:** Simple, built-in, fast (local lookup after pull).

**Implication:** No new dependencies needed (skopeo, go-containerregistry, etc).

---

## Answer to User Questions

### Q1: "We will do docker image inspect after the pull?"
**A:** Yes, but the pull happens DURING CreateServer (agent-side). By the time the server exists in the DB, the image is already local. When we query defaults later (during config display), inspect is fast (<50ms local operation).

### Q2: "How would this affect our server creation UX?"
**A:** **Zero impact**. We don't need defaults during creation form - only when viewing configuration post-creation. The inspection happens lazily when user clicks Configuration tab.

### Q3: "Should we use skopeo or another go library to inspect image directly on the registry?"
**A:** **No, unnecessary**. Image is local after CreateServer pulls it. Local `docker image inspect` is:
- Simpler (no new dependencies)
- Faster (no network call)
- More reliable (no registry availability issues)
- Already available in Docker Go SDK

---

## Recommended Solution

**Approach: Lazy Load on Display (Option A from task plan)**

1. **Agent:** Add `POST /images/inspect` endpoint
   - Takes: `imageTag` (e.g., "rathena/steam-zomboid:latest")
   - Returns: Parsed ENV defaults as JSON `{"PUID": "1430", "TZ": "Etc/UTC", ...}`
   - Uses: `client.ImageInspect()` (local, fast)

2. **Manager:** Add `GET /api/agents/:id/images/:tag/defaults` endpoint
   - Proxies request to agent
   - Caches response (optional, for performance)

3. **Frontend:** Query defaults when loading ConfigurationDisplay
   - Parallel fetch with server data
   - Use defaults as fallbacks for "Not set" values
   - Graceful fallback if query fails (show "Not set")

**Benefits:**
- No UX impact on creation
- Always accurate (reflects current image)
- Simple implementation (no new dependencies)
- Fast (<200ms including network)

**Trade-offs:**
- Slight delay when viewing config tab (acceptable)
- Requires agent online (same as current config display)

---

## Implementation Estimate

**Effort:** ~2-3 hours

1. Agent handler: 30 min
2. Manager proxy: 20 min
3. Frontend integration: 1 hour
4. Testing: 30 min
5. Documentation: 30 min
