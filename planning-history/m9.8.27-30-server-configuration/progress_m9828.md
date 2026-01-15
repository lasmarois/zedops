# Progress Log: M9.8.28 - Configuration Editing

**Goal:** Enable editing of server configuration with two-step Save → Apply workflow
**Started:** 2026-01-14
**Status:** Phase 2 - Backend Implementation

---

## Session 1: 2026-01-14 - Investigation & Implementation

### Phase 1: Investigation ✅ COMPLETE

**Findings:**

1. **Config Storage** (agents.ts lines 1022-1041):
   - `config` column stores JSON string of ENV variables
   - `image_tag` is separate column (metadata)
   - `server_data_path` is separate column (NULL = use agent default)
   - Config updated with: `JSON.stringify(body.config)`

2. **Existing Patterns**:
   - Stop endpoint (line 1439): Stops container, updates status
   - Rebuild endpoint (line 1952): Removes + recreates container with same config
   - Server creation (line 1055): Sends config to DO → agent creates container

3. **API Design:**
   - **PATCH /api/agents/:id/servers/:serverId/config**
     - Update: config, image_tag, server_data_path in DB
     - Validate: Immutable fields (name, ports, map)
     - Return: success + pendingRestart flag

   - **POST /api/agents/:id/servers/:serverId/apply-config**
     - Stop container (if running)
     - Rebuild container with new config from DB
     - Start container
     - Return: success + updated server

4. **Permissions**:
   - Use `canControlServer()` (same as stop/restart)
   - Requires operator or higher role

---

### Phase 2: Backend Implementation ✅ COMPLETE

**Implemented:**

1. **PATCH /api/agents/:id/servers/:serverId/config** (agents.ts lines 2248-2367)
   - Updates config, image_tag, server_data_path in database
   - Validates immutable fields (SERVER_MAP)
   - Returns flags: pendingRestart, dataPathChanged, configChanged
   - Audit logging with changes tracked

2. **POST /api/agents/:id/servers/:serverId/apply-config** (agents.ts lines 2375-2508)
   - Sets status to 'restarting'
   - Forwards rebuild request to Durable Object with full config
   - Handles errors gracefully (updates status to 'failed')
   - Returns updated server object

3. **Durable Object Update** (AgentConnection.ts lines 1842-1888)
   - Extended handleServerRebuildRequest to accept full config
   - Forwards all parameters to agent

4. **Agent Updates** (agent/server.go + main.go)
   - Extended ServerRebuildRequest struct to include optional config
   - Added RebuildServerWithConfig() function
   - Added rebuildWithNewConfig() function (recreates container with new ENV)
   - Backward compatible: simple rebuild still works

**Files Modified:**
- `manager/src/routes/agents.ts` (+267 lines)
- `manager/src/durable-objects/AgentConnection.ts` (+40 lines modified)
- `agent/server.go` (+164 lines)
- `agent/main.go` (+2 lines modified)

---

### Phase 3: Frontend Edit Component ✅ COMPLETE

**Implemented:**

1. **API Functions** (api.ts)
   - `updateServerConfig()` - PATCH request to save config
   - `applyServerConfig()` - POST request to apply config

2. **React Hooks** (useServers.ts)
   - `useUpdateServerConfig()` - Mutation hook for saving
   - `useApplyServerConfig()` - Mutation hook for applying

3. **ConfigurationEdit Component** (NEW)
   - Form with all mutable fields
   - Immutable fields shown as disabled with lock icons
   - Input validation (admin password required)
   - Data path change warning
   - Save/Cancel buttons

4. **ServerDetail Integration**
   - Edit mode state management
   - Pending changes state (tracks what changed)
   - Two-step workflow:
     - Save → Shows pending changes banner
     - Apply → Confirmation dialog with impact warning
   - Conditional rendering (display vs edit mode)
   - onEdit callback passed to ConfigurationDisplay

**Files Modified:**
- `frontend/src/lib/api.ts` (+77 lines)
- `frontend/src/hooks/useServers.ts` (+68 lines)
- `frontend/src/components/ConfigurationEdit.tsx` (+276 lines, NEW)
- `frontend/src/pages/ServerDetail.tsx` (+91 lines modified)

**Features:**
- ✅ Edit button in ConfigurationDisplay
- ✅ Edit mode with form
- ✅ Save changes (updates DB only)
- ✅ Pending changes banner
- ✅ Apply changes (restarts container)
- ✅ Impact warnings (restart vs data migration)
- ✅ Loading states
- ✅ Error handling

---

### Phase 4: Build & Deploy ✅ COMPLETE

**Build Output:**
```
dist/index.html                   0.99 kB │ gzip:   0.48 kB
dist/assets/index-DYmvQnZa.css   47.24 kB │ gzip:   8.73 kB
dist/assets/index-I2k7smvb.js   982.36 kB │ gzip: 264.65 kB
✓ built in 6.08s
```

**Deployment:**
- Updated asset hashes in manager/src/index.ts
- Deployed to Cloudflare Workers
- Version: `8f85730f-58fd-44e5-85d3-c40aa3a419af`
- URL: https://zedops.mail-bcf.workers.dev

---

## M9.8.28 Complete! ✅

**Total Implementation:**
- Backend: 267 lines (manager) + 164 lines (agent)
- Frontend: 77 lines (API) + 68 lines (hooks) + 276 lines (edit component) + 91 lines (integration)
- **Total: ~943 lines of code**

**Features Delivered:**
1. ✅ PATCH endpoint to save configuration changes (DB only)
2. ✅ POST endpoint to apply changes (restart container with new config)
3. ✅ Agent support for config-update rebuild mode
4. ✅ Edit form with all mutable fields
5. ✅ Two-step Save → Apply workflow
6. ✅ Pending changes banner with impact warnings
7. ✅ Immutable field validation (SERVER_MAP locked)
8. ✅ Data path change detection (for M9.8.29)
9. ✅ Loading states and error handling
10. ✅ Audit logging

**Deployment Status:**
- ✅ Frontend built and deployed
- ✅ Manager API deployed to Cloudflare Workers
- ✅ Agent binary rebuilt with new config management functions
- ⚠️ Agent deployment pending (see Phase 5 for instructions)

**Next Steps (M9.8.29):**
- Data path migration with progress tracking
- Agent: MoveServerData() function
- Frontend: Progress bar during migration
- See ISSUE-M9.8.26-30-server-configuration.md for details

---

### Phase 5: Agent Rebuild & Deploy ✅ BUILD COMPLETE

**Objective:** Rebuild agent binary with new RebuildServerWithConfig() function

**Modified Agent Files:**
- `agent/server.go` - Added RebuildServerWithConfig() and rebuildWithNewConfig()
- `agent/main.go` - Changed handleServerRebuild to call RebuildServerWithConfig()

**Build Instructions:**

**Standard Build Method** (uses Docker, no Go required):
```bash
cd /Volumes/Data/docker_composes/zedops/agent

# Build using the project's standard build script
./scripts/build.sh

# Verify binary created in ./bin/
ls -lh ./bin/zedops-agent
```

**Expected Output:**
```
-rwxr-xr-x 1 user group 15M Jan 14 HH:MM ./bin/zedops-agent
```

**How it works:** The `scripts/build.sh` script uses Docker to compile the Go binary (cross-platform support) and extracts it to `./bin/` directory. The binary runs on the HOST, not in a container.

**Deployment Instructions:**

After building the agent binary:

1. **Stop the running agent**:
   ```bash
   # If running as systemd service
   sudo systemctl stop zedops-agent

   # OR if running in Docker/standalone
   docker stop zedops-agent
   # OR
   pkill -f "./agent"
   ```

2. **Replace the agent binary**:
   ```bash
   # Backup existing binary
   cp /path/to/production/agent /path/to/production/agent.backup

   # Copy new binary to production location
   cp /Volumes/Data/docker_composes/zedops/agent/agent /path/to/production/agent

   # Set permissions
   chmod +x /path/to/production/agent
   ```

3. **Start the agent**:
   ```bash
   # If running as systemd service
   sudo systemctl start zedops-agent
   sudo systemctl status zedops-agent

   # OR if running in Docker/standalone
   docker start zedops-agent
   # OR
   cd /path/to/production && ./agent
   ```

4. **Verify connection**:
   - Check ZedOps manager UI - agent should show as "Connected"
   - Check agent logs for successful WebSocket connection
   - Test configuration editing on an existing server

**Build Results:**
```
✅ Build complete!
Binary: /Volumes/Data/docker_composes/zedops/agent/bin/zedops-agent
Size: 7.3M
Built: 2026-01-14 14:10
```

**Testing Checklist:**
- [x] Agent binary built successfully
- [ ] Agent deployed and connected to manager
- [ ] Can save configuration changes (PATCH endpoint)
- [ ] Can apply configuration changes (POST endpoint)
- [ ] Container restarts with new configuration
- [ ] No errors in agent logs

**Status:** ✅ Build complete - Ready for deployment

---

## Deployment Summary

**What's Ready:**
- ✅ Manager API with configuration endpoints deployed to Cloudflare Workers
- ✅ Frontend with edit form and two-step workflow deployed
- ✅ Agent binary rebuilt with RebuildServerWithConfig() function at:
  - Path: `/Volumes/Data/docker_composes/zedops/agent/bin/zedops-agent`
  - Size: 7.3M
  - Built: 2026-01-14 14:10

**To Complete M9.8.28:**

You need to deploy the agent binary to your production host. Follow the deployment instructions above, or use the quick method:

**Quick Deployment (if agent already installed as systemd service):**
```bash
# 1. Stop current agent
sudo systemctl stop zedops-agent

# 2. Backup and replace binary
sudo cp /usr/local/bin/zedops-agent /usr/local/bin/zedops-agent.backup
sudo cp /Volumes/Data/docker_composes/zedops/agent/bin/zedops-agent /usr/local/bin/zedops-agent
sudo chmod +x /usr/local/bin/zedops-agent

# 3. Start agent
sudo systemctl start zedops-agent
sudo systemctl status zedops-agent

# 4. Verify
sudo journalctl -u zedops-agent -f
```

**First-Time Installation:**
```bash
cd /Volumes/Data/docker_composes/zedops/agent
sudo ./scripts/install.sh
# Follow prompts for agent name and manager URL
```

**Verification:**
1. Check agent shows as "Connected" in ZedOps UI
2. Navigate to a server in the UI
3. Click "Edit" button in Configuration section
4. Make a change and click "Save Changes"
5. Click "Apply Changes" to restart container with new config
6. Verify server restarts with updated configuration

**M9.8.28 Status:** 🚧 BUILD COMPLETE - DEPLOYMENT PENDING
