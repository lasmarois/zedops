# RCON Integration - Quick Testing Guide

**Phase 6: Testing & Verification**

---

## Quick Start

### 1. Deploy Updated Code

**Agent:**
```bash
# Binary already built at:
/Volumes/Data/docker_composes/zedops/agent/bin/zedops-agent

# If agent is running as systemd service, restart it:
sudo systemctl restart zedops-agent

# Or if running manually, stop and restart with new binary
```

**Manager:**
```bash
cd /Volumes/Data/docker_composes/zedops/manager
npm run deploy
# Deploys to wss://zedops.mail-bcf.workers.dev
```

**Frontend:**
```bash
cd /Volumes/Data/docker_composes/zedops/frontend
npm run build
# Upload dist/ to hosting (Cloudflare Pages, etc.)
```

---

## 2. Verify Server Setup

Your Zomboid server needs RCON enabled. Check the server configuration:

**Location:** Server data directory → `server.ini`

**Required Settings:**
```ini
RCONEnabled=true
RCONPort=27015
RCONPassword=<your-admin-password>
```

**If you need to enable RCON:**
1. Stop the server container
2. Edit the server.ini file
3. Set the above values
4. Restart the server

**Verify RCON is accessible:**
```bash
# Test RCON connection from agent host
nc -zv localhost 27015
# Should return: Connection to localhost 27015 port [tcp/*] succeeded!
```

---

## 3. Quick Smoke Test (5 minutes)

**Step 1:** Open ZedOps UI in browser
**Step 2:** Navigate to your agent's container list
**Step 3:** Find a running Zomboid server
**Step 4:** Click the "🎮 RCON" button (orange, appears after "View Logs")

**Expected Result:**
```
╔════════════════════════════════════════╗
║   ZedOps RCON Console                  ║
╚════════════════════════════════════════╝

Server: your-server-name
Port: 27015

Connecting to RCON server...
✓ Connected to RCON server

Type "help" for available commands

>
```

**Step 5:** Type `help` and press Enter
**Expected:** List of available RCON commands appears

**Step 6:** Type `players` and press Enter
**Expected:** Player list appears (may be empty if no one is online)

**Step 7:** Click "🔄 Refresh Players" button
**Expected:** Player list section updates

**Step 8:** Click "💾 Save World" button
**Expected:** Terminal shows "✓ World saved" in green

✅ **If all 8 steps work, basic functionality is confirmed!**

---

## 4. Full Test Suite

Follow the detailed test plan in **TEST-PLAN-RCON.md**

**Test Categories:**
1. Happy Path (1 test)
2. Authentication (2 tests)
3. Connection Errors (3 tests)
4. Session Management (3 tests)
5. Command History (2 tests)
6. Quick Actions (5 tests)
7. Edge Cases (4 tests)
8. Performance (1 test)
9. Keyboard Shortcuts (1 test)
10. UI/UX (1 test)

**Total:** 22 tests

**Time Estimate:** 1-2 hours for full suite

---

## 5. Common Issues & Fixes

### Issue: "RCON connection failed"

**Possible Causes:**
1. RCON not enabled on server
2. Wrong RCON password
3. RCON port not accessible
4. Server not running

**Debug Steps:**
```bash
# Check if server is running
docker ps | grep zomboid

# Check server RCON config
cat /var/lib/zedops/servers/<server-name>/data/Server/server.ini | grep RCON

# Check if RCON port is listening
netstat -tuln | grep 27015

# Check agent logs
journalctl -u zedops-agent -f
```

### Issue: "Agent not connected"

**Fix:**
1. Check agent status: `sudo systemctl status zedops-agent`
2. Check agent logs: `journalctl -u zedops-agent -n 50`
3. Verify agent shows "online" in UI

### Issue: Terminal not displaying output

**Fix:**
1. Open browser console (F12)
2. Check for JavaScript errors
3. Check WebSocket connection in Network tab
4. Try refreshing the page

### Issue: Player list empty but players are online

**Possible Causes:**
1. `players` command returns unexpected format
2. Parser doesn't handle Zomboid's response format

**Debug:**
1. Type `players` command manually in terminal
2. Copy the exact response
3. Check if parser handles that format (see RconTerminal.tsx → parsePlayersResponse)

---

## 6. Test Data Collection

As you test, collect this information:

### Performance Metrics
- Command execution time (should be < 2 seconds)
- Terminal responsiveness (should be < 100ms)
- Browser memory usage (check Chrome Task Manager)

### Browser Compatibility
- Test in Chrome/Edge
- Test in Firefox
- Test in Safari (if available)

### Network Conditions
- Test on local network
- Test on remote connection (if applicable)

---

## 7. Recording Test Results

**Option 1:** Fill out TEST-PLAN-RCON.md directly
- Check boxes as you complete tests
- Add notes for each test
- Record pass/fail status

**Option 2:** Create a summary document
- List critical issues found
- List nice-to-have improvements
- Prioritize fixes

**Option 3:** File issues in issue tracker
- One issue per bug
- Include steps to reproduce
- Tag with "RCON" label

---

## 8. Deployment Checklist

Before considering RCON complete:

- [ ] All 22 tests pass (or documented failures are acceptable)
- [ ] No critical bugs found
- [ ] Performance is acceptable (< 2s for commands)
- [ ] Works in at least 2 browsers
- [ ] Agent logs show no errors
- [ ] Manager logs show no errors (check Cloudflare dashboard)
- [ ] Terminal doesn't leak memory (tested over 15+ minutes)

---

## 9. Post-Testing

After successful testing:

1. **Update Documentation:**
   - [ ] Add RCON section to user guide
   - [ ] Create screenshot/GIF of RCON in action
   - [ ] Document common commands

2. **Update CHANGELOG.md:**
   - [ ] Move RCON features from Unreleased to vX.X.X
   - [ ] List all RCON features added

3. **Create Release:**
   - [ ] Tag version: `git tag -a v2.2.0 -m "RCON Integration"`
   - [ ] Push tag: `git push origin v2.2.0`
   - [ ] Write release notes

4. **Archive Planning Files:**
   - [ ] Move task_plan.md, findings.md, progress.md to planning-history/rcon-integration/
   - [ ] Move TEST-PLAN-RCON.md to planning-history/rcon-integration/

---

## Need Help?

**Check Logs:**
- Agent: `journalctl -u zedops-agent -f`
- Manager: Cloudflare Workers dashboard → Logs
- Frontend: Browser console (F12)

**WebSocket Debugging:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. Click on connection to see messages

**RCON Protocol Debugging:**
1. Check agent logs for RCON messages
2. Look for `[RCON]` prefixed log lines
3. Verify session IDs are being created

---

## Success Criteria

RCON Integration is complete when:

✅ User can click RCON button and connect to server
✅ User can type commands and see responses
✅ User can see player list and use quick actions
✅ Command history works with arrow keys
✅ Terminal is responsive and performant
✅ Errors are handled gracefully
✅ No critical bugs in 22 test scenarios

**Current Status:** Ready for testing 🚀
