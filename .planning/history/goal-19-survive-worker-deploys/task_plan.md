# Goal #19: Survive Worker Deploys Without Agent Death

## Problem

When CI deploys a new Worker to Cloudflare, existing WebSocket connections are killed. The sequence:

1. Worker redeploys → WebSocket closed → `close 1006 (abnormal closure): unexpected EOF`
2. Agent reconnects in 1s → new WebSocket established ✓
3. Agent sends `agent.auth` with permanent token
4. New Worker is still settling / DO re-initializing → WebSocket killed again → `close 1006`
5. Auth goroutine exits (ReadJSON error), nothing sent to responseCh
6. 10s timeout fires → `"authentication timeout"` error returned
7. `RunWithReconnect()` treats ALL `register()` errors as fatal → exits code 78
8. systemd configured to NOT restart on code 78 → **agent stays dead until manual restart**

## Design Constraint: Cloudflare Free Tier

**We cannot retry auth indefinitely.** Each auth attempt = WebSocket upgrade + message exchange = Worker requests. The Cloudflare free tier has daily request limits (100k/day). An agent stuck in an infinite auth retry loop with short backoff would burn through this budget fast.

The current "fail permanently on auth error" design was **intentional** — it prevents runaway request costs from a misconfigured agent (wrong token, deleted agent, etc.).

## Root Cause Analysis

The issue is that `register()` returns a generic `error` for two very different failure modes:

| Failure Mode | Current Behavior | Correct Behavior |
|---|---|---|
| **Explicit rejection** — server responds with `error` subject ("Agent not found", "Invalid token") | Fatal exit ✓ | Fatal exit ✓ |
| **Connection dropped** — WebSocket closed during auth (deploy, network blip) | Fatal exit ✗ | Retry with backoff |
| **Timeout** — no response within 10s (connection dropped silently) | Fatal exit ✗ | Retry with backoff |

## Solution: Typed Errors + Bounded Transient Retry

### Phase 1: Distinguish error types in `register()` and `authenticate()`

**File:** `agent/reconnect.go`

Add a new sentinel error for transient failures:
```go
var ErrAuthFailure = errors.New("authentication failure")   // existing — permanent
var ErrTransientAuth = errors.New("transient auth failure")  // new — retryable
```

**Files:** `agent/main.go` — `register()` and `authenticate()`

Wrap errors with the correct sentinel:
- Server responds with `error` subject → wrap with `ErrAuthFailure` (permanent)
- `sendMessage()` fails → wrap with `ErrTransientAuth` (connection lost)
- `ReadJSON` error in goroutine → signal the channel with a transient error
- Timeout → wrap with `ErrTransientAuth`

### Phase 2: Bounded retry in `RunWithReconnect()`

**File:** `agent/reconnect.go` — `RunWithReconnect()`

Replace the current "all auth errors are fatal" logic:

```
if err := a.register(); err != nil {
    if errors.Is(err, ErrAuthFailure) {
        // Server explicitly rejected us — fatal, exit
        // (existing behavior, no change)
    }
    if errors.Is(err, ErrTransientAuth) {
        // Connection issue during auth — retry with limits
        transientRetries++
        if transientRetries >= maxTransientRetries {
            // Too many transient failures — give up (safety valve)
            return fatal error
        }
        backoff, sleep, continue
    }
}
// On successful auth, reset transientRetries to 0
```

**Constants:**
- `maxTransientAuthRetries = 5` — max consecutive transient auth failures before giving up
- Use existing exponential backoff (1s → 2s → 4s → 8s → 16s) for retries
- Total worst-case: 5 retries × ~30s each = ~2.5 minutes of retrying, ~10 requests — minimal impact on free tier

### Phase 3: Improve logging

Make it clear what's happening so operators understand:
- Transient retry: `"Auth failed (transient: connection dropped during deploy?), retrying (%d/%d)..."`
- Exhausted retries: `"Auth failed after %d transient retries — giving up"` (then show existing AUTHENTICATION FAILED block)
- Permanent failure: existing AUTHENTICATION FAILED block (no change)

## Files to Modify

| File | Changes |
|------|---------|
| `agent/reconnect.go` | Add `ErrTransientAuth`, bounded retry logic in `RunWithReconnect()` |
| `agent/main.go` | Wrap `register()` and `authenticate()` errors with correct sentinel |

## Testing

- Build agent, deploy to test VM with `--no-update`
- Trigger a prod deploy (push to main) while agent is connected
- Verify agent reconnects and re-authenticates after the deploy settles
- Verify agent still exits permanently on actual auth failures (wrong token)

## Risk Analysis

| Scenario | Behavior |
|---|---|
| Normal deploy (Worker restarts) | Retry 1-2 times, reconnect within seconds |
| Extended Cloudflare outage | Retry 5 times with backoff (~30s total), then exit code 78 |
| Wrong token / deleted agent | Immediate exit code 78 (no retry) — unchanged |
| Network partition | Normal reconnect loop handles this (already works) |
| Runaway retry loop | Impossible — hard cap at 5 transient retries |
