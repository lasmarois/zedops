# Goal #19: Findings

## Current Auth Flow
- `register()` dispatches to `registerWithEphemeral()` or `authenticate()` based on token type
- Both use same pattern: send message → goroutine reads response → select on responseCh or timeout
- ReadJSON error in goroutine just logs and returns (nothing sent to channel) → timeout fires
- `RunWithReconnect()` line 99: ALL `register()` errors → fatal exit with ErrAuthFailure

## Error Signals Available
- Server explicitly rejects: sends message with `subject: "error"` — we can detect this
- Connection dropped: `ReadJSON` returns `websocket: close 1006` error — we can detect this
- Timeout: no response in 10s — ambiguous, but in deploy scenario the goroutine would have seen the close error first

## Why This Breaks on Deploy
The deploy window is very short (~1-2 seconds), but the agent reconnects in 1s which lands right in the middle. The second connection establishment succeeds (TCP level) but the Worker/DO isn't ready to process messages yet, so the WS gets closed immediately.

## Free Tier Concern
- Cloudflare Workers free: 100,000 requests/day
- Each reconnect attempt = 1 WebSocket upgrade request + 1 auth message
- 5 bounded retries = ~10 requests per deploy event — negligible
- The concern was about misconfigured agents looping forever (e.g., wrong token)
