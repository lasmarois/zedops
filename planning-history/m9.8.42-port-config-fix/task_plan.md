# M9.8.42 - Server Port Configuration Not Applied

## Goal
Fix the issue where server port configuration from the UI is not being applied to the container environment variables, causing the server INI to reset to default ports.

## Root Cause (IDENTIFIED)

The `gamePort` and `udpPort` values are passed to the agent for Docker port bindings, but are **NOT** added to the config map as `SERVER_DEFAULT_PORT` and `SERVER_UDP_PORT` environment variables.

The Docker image expects these env vars to configure the server INI file. Without them, the image uses its default values (16261, 16262).

### Evidence
Container inspection shows:
```
SERVER_DEFAULT_PORT=16261  (default, should be 16285)
SERVER_UDP_PORT=16262      (default, should be 16286)
```

### Code Location
In `manager/src/routes/agents.ts`, only `RCON_PORT` is added to the config:
```typescript
const configWithRconPort = {
  ...body.config,
  RCON_PORT: rconPort.toString(),
  // MISSING: SERVER_DEFAULT_PORT: gamePort.toString(),
  // MISSING: SERVER_UDP_PORT: udpPort.toString(),
};
```

---

## Phases

### Phase 1: Fix Server Create Flow [PENDING]
- File: `manager/src/routes/agents.ts` ~line 1049
- Add `SERVER_DEFAULT_PORT` and `SERVER_UDP_PORT` to `configWithRconPort`

### Phase 2: Fix Server Recreate Flow [PENDING]
- File: `manager/src/routes/agents.ts` ~line 1395
- Same fix for container recreation on start

### Phase 3: Check Rebuild/Apply-Config Flows [PENDING]
- Check if rebuild or apply-config have same issue
- May need to pass full config including port env vars

### Phase 4: Deploy and Test [PENDING]
- Deploy to Cloudflare
- Rebuild build42-testing server
- Verify container has correct port env vars
- Verify server INI uses correct ports

---

## Files to Modify

| File | Change |
|------|--------|
| `manager/src/routes/agents.ts` | Add port env vars in create and recreate flows |

## Success Criteria

- [ ] Container inspection shows `SERVER_DEFAULT_PORT=16285`
- [ ] Container inspection shows `SERVER_UDP_PORT=16286`
- [ ] Server INI file uses configured ports
- [ ] Player count feature can connect via RCON on correct port
