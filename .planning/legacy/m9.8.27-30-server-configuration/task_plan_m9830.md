# Task Plan: M9.8.30 - Image Default ENV Values

**Goal:** Display accurate default ENV values from Docker images in Configuration tab
**Priority:** MEDIUM (Enhancement to M9.8.27)
**Started:** 2026-01-14
**Completed:** 2026-01-14
**Status:** ✅ COMPLETE - Verified working in production (+ rebuild fix deployed)

---

## Problem Statement

Configuration tab currently shows hard-coded defaults (PUID=1000, TZ=UTC) but the actual image defaults are different (steam-zomboid uses PUID=1430). We need accurate defaults from the image itself.

---

## Key Questions to Investigate

### 1. When to Inspect Image?
**Options:**
- A. After pull (during container creation)
- B. Before creation (registry inspection)
- C. During config display (lazy load)
- D. Cache at agent startup (pre-warm)

### 2. How to Inspect?
**Options:**
- A. `docker image inspect` (requires local pull)
- B. `skopeo inspect` (remote registry, no pull)
- C. Go library (containerd, go-containerregistry)

### 3. Where to Store Defaults?
**Options:**
- A. DB column: `image_defaults` JSON (cached at creation)
- B. Agent memory cache (ephemeral)
- C. Query on-demand (no storage)

### 4. UX Impact on Server Creation?
**Concerns:**
- Does inspection delay form display?
- Do we need defaults DURING creation?
- Or only AFTER creation (config display)?

---

## Investigation Phases

### Phase 1: Understand Current Flow ✅ COMPLETE

**Questions Answered:**
1. ✅ Image pulled agent-side during CreateServer (before container creation)
2. ✅ Yes, image is local after CreateServer completes
3. ✅ Only ConfigurationDisplay needs defaults (not ServerForm)
4. ✅ No UX impact - defaults queried lazily when viewing config tab

**Files Read:**
- ✅ `agent/server.go` lines 39-67 (image pull) and 69-73 (ENV handling)
- ✅ Docker Go SDK documentation (ImageInspect method)

**Key Findings:** See findings_m9830.md for detailed analysis

---

### Phase 2: Evaluate Inspection Methods ✅ COMPLETE (SKIPPED)

**Decision:** Use Docker Go SDK's `ImageInspect()` method (local)

**Rationale:**
- ✅ Image is local after CreateServer pulls it
- ✅ Built-in to Docker Go SDK (no new dependencies)
- ✅ Fast (<50ms local operation)
- ✅ Reliable (no registry availability issues)
- ❌ Skopeo/registry inspection unnecessary (adds complexity, no benefit)

**Verdict:** Local `docker image inspect` is optimal.

---

### Phase 3: Design Solution ✅ COMPLETE

**Chosen Approach:** Lazy Load on Display

**Architecture:**

1. **Agent:** New message handler `images.inspect`
   ```go
   // Request: {"imageTag": "rathena/steam-zomboid:latest"}
   // Response: {"defaults": {"PUID": "1430", "TZ": "Etc/UTC", ...}}
   ```

2. **Manager:** New endpoint `GET /api/agents/:id/images/:imageTag/defaults`
   - Proxies request to agent via DO
   - Returns parsed ENV defaults as JSON

3. **Frontend:** ConfigurationDisplay component
   - Query defaults on mount (parallel with server data)
   - Use as fallbacks for missing config values
   - Graceful degradation if query fails

**Storage Strategy:** No storage (query on-demand)
- Image defaults change rarely
- Query is fast (<200ms)
- Avoids stale data
- Can add caching later if needed

**UX Impact:** None on creation, <200ms delay on config display (acceptable)

---

### Phase 4: Implementation ⏳ IN PROGRESS

**Architecture** (from Phase 3):
- Agent: `images.inspect` message handler → returns image ENV defaults
- Manager: `GET /api/agents/:id/images/:tag/defaults` → proxies to agent
- Frontend: Query defaults on mount → use as fallbacks

**Tasks:**

#### 4.1: Agent Image Inspection Handler ⏳ IN PROGRESS

**File:** `agent/docker.go`

Add function to inspect image and extract ENV defaults:

```go
// GetImageDefaults inspects a local Docker image and returns default ENV variables
func (dc *DockerClient) GetImageDefaults(ctx context.Context, imageTag string) (map[string]string, error) {
    inspect, err := dc.cli.ImageInspect(ctx, imageTag)
    if err != nil {
        return nil, fmt.Errorf("failed to inspect image: %w", err)
    }

    // Parse ENV array into map
    defaults := make(map[string]string)
    for _, env := range inspect.Config.Env {
        parts := strings.SplitN(env, "=", 2)
        if len(parts) == 2 {
            defaults[parts[0]] = parts[1]
        }
    }

    return defaults, nil
}
```

**File:** `agent/main.go`

Add message handler for `images.inspect`:

```go
case "images.inspect":
    var req struct {
        ImageTag string `json:"imageTag"`
    }
    if err := json.Unmarshal(msg.Data, &req); err != nil {
        a.sendError(msg.Reply, fmt.Sprintf("Invalid request: %v", err))
        continue
    }

    defaults, err := a.docker.GetImageDefaults(context.Background(), req.ImageTag)
    if err != nil {
        a.sendError(msg.Reply, fmt.Sprintf("Failed to inspect image: %v", err))
        continue
    }

    a.send(Message{
        Subject: msg.Reply,
        Data:    map[string]interface{}{"defaults": defaults},
    })
```

---

#### 4.2: Manager Proxy Endpoint ⏸ PENDING

**File:** `manager/src/routes/agents.ts`

Add GET endpoint to proxy image inspection:

```typescript
agents.get('/:id/images/:imageTag/defaults', async (c) => {
  const agentId = c.req.param('id');
  const imageTag = c.req.param('imageTag');

  // Get agent's Durable Object
  const agentStub = getAgentStub(c, agentId);

  // Proxy request to agent
  const response = await agentStub.fetch(`http://do/images/${imageTag}/defaults`);

  if (!response.ok) {
    return c.json({ error: 'Failed to fetch image defaults' }, response.status);
  }

  return c.json(await response.json());
});
```

**File:** `manager/src/durable-objects/AgentConnection.ts`

Add handler for image inspection requests:

```typescript
// In fetch() handler, add route:
if (url.pathname.startsWith('/images/') && url.pathname.endsWith('/defaults')) {
  const imageTag = url.pathname.split('/')[2];
  return this.handleImageInspect(imageTag);
}

// Add handler method:
async handleImageInspect(imageTag: string): Promise<Response> {
  const inbox = `_INBOX.${crypto.randomUUID()}`;

  this.send({
    subject: 'images.inspect',
    data: { imageTag },
    reply: inbox,
  });

  const response = await this.waitForReply(inbox, 5000);
  return Response.json(response);
}
```

---

#### 4.3: Frontend Integration ⏸ PENDING

**File:** `frontend/src/lib/api.ts`

Add API function:

```typescript
export async function fetchImageDefaults(
  agentId: string,
  imageTag: string
): Promise<Record<string, string>> {
  const response = await fetch(
    `${API_BASE}/api/agents/${agentId}/images/${encodeURIComponent(imageTag)}/defaults`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch image defaults');
  }

  const data = await response.json();
  return data.defaults || {};
}
```

**File:** `frontend/src/hooks/useServers.ts`

Add query hook:

```typescript
export function useImageDefaults(agentId: string | null, imageTag: string | null) {
  return useQuery({
    queryKey: ['image-defaults', agentId, imageTag],
    queryFn: () => {
      if (!agentId || !imageTag) {
        throw new Error('Agent ID and image tag are required');
      }
      return fetchImageDefaults(agentId, imageTag);
    },
    enabled: !!agentId && !!imageTag,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (image defaults rarely change)
  });
}
```

**File:** `frontend/src/components/ConfigurationDisplay.tsx`

Update to use dynamic defaults:

```typescript
export function ConfigurationDisplay({ server, onEdit }: ConfigurationDisplayProps) {
  const config = server.config ? JSON.parse(server.config) : {}

  // Query image defaults
  const { data: imageDefaults, isLoading } = useImageDefaults(
    server.agent_id,
    server.image_tag
  )

  // Helper to get default value
  const getDefault = (key: string, fallback: string) => {
    if (isLoading) return 'Loading...'
    return imageDefaults?.[key] || fallback
  }

  // Update field rendering:
  {renderField('Timezone', config.TZ || `${getDefault('TZ', 'UTC')} (image default)`)}
  {renderField('User ID (PUID)', config.PUID || `${getDefault('PUID', '1430')} (image default)`)}
}
```

---

#### 4.4: Testing ⏸ PENDING

**Test Cases:**
1. View configuration for steam-zomboid server → shows PUID=1430 (from image)
2. View configuration with PUID set in config → shows custom value
3. Agent offline → graceful fallback ("Unable to load defaults")
4. Invalid image tag → error handling

---

#### 4.5: Build & Deploy ✅ COMPLETE

**Tasks:**
1. ✅ Rebuilt agent binary (with proper fix for resolved image names)
2. ✅ Built frontend (with query parameter fix)
3. ✅ Deployed manager to Cloudflare Workers (Version c3cd52e8-577e-4364-98fd-c7952becb54d)
4. ✅ Agent deployed to production (PID 3058254)
5. ✅ Database migrated (all existing servers have full image names)
6. ✅ Fixed URL encoding issue (query parameter instead of path parameter)
7. ⏳ Ready for final verification

---

## Initial Thoughts (Pre-Investigation)

**Hypothesis 1:** We probably DON'T need defaults during creation form
- ServerForm shows empty fields or lets user set values
- Defaults only matter for ConfigurationDisplay (post-creation)
- This means: No UX impact on creation flow

**Hypothesis 2:** Image is pulled during CreateServer (agent-side)
- Agent calls Docker API to create container
- Docker auto-pulls if image missing
- By the time container exists, image is local
- This means: `docker image inspect` is fast (local, no pull)

**Hypothesis 3:** Best approach might be Option A (query at display time)
- Query agent when showing ConfigurationDisplay
- Agent does local `docker image inspect`
- Fast (<100ms), accurate, no storage needed
- Only minor delay when viewing config tab

**Hypothesis 4:** Registry inspection (skopeo) is overkill
- Adds new dependency to agent
- Doesn't help UX (we don't need defaults during creation)
- Image is pulled anyway during creation
- Local inspect is simpler and faster

---

## Success Criteria

- [x] Configuration tab shows accurate defaults from image
- [x] PUID shows actual default from image (dynamic, not hardcoded) - Shows 1430 for steam-zomboid
- [x] TZ shows actual default from image - Shows Etc/UTC
- [x] No noticeable UX delay (1 hour cache, query on mount)
- [x] Works for any Docker image (not hard-coded)
- [x] Solution is maintainable and simple
- [x] Agent deployed to production - PID 3058254
- [x] Verified in production environment - User confirmed working

---

## Next Steps

1. Read agent/server.go CreateServer function
2. Understand when/how image is pulled
3. Answer the 4 key questions
4. Update findings.md with discoveries
5. Design solution based on findings
