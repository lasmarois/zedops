# RCON Integration - Test Plan

**Milestone:** M6 - RCON Integration
**Date:** 2026-01-11
**Tester:** Manual testing required

---

## Test Environment Setup

### Prerequisites

- [ ] Agent running with RCON-enabled build
- [ ] Manager deployed (wss://zedops.mail-bcf.workers.dev)
- [ ] Frontend deployed and accessible
- [ ] At least one Project Zomboid server with RCON enabled
- [ ] RCON port accessible (default: 27015)
- [ ] RCON password configured in server

### Server Configuration

Verify server has RCON enabled:
```ini
# server.ini
RCONEnabled=true
RCONPort=27015
RCONPassword=<admin-password>
```

---

## Test Scenarios

### 1. Happy Path - Basic RCON Flow

**Goal:** Verify end-to-end RCON functionality works

**Steps:**
1. Navigate to agent's container list in UI
2. Find a running Zomboid server
3. Click "🎮 RCON" button
4. Observe RCON terminal opens
5. Wait for connection status: "● Connected"
6. Type `help` command in terminal
7. Press Enter
8. Observe command response appears
9. Type `players` command
10. Press Enter
11. Observe player list appears (may be empty)

**Expected Results:**
- ✅ RCON terminal modal opens
- ✅ Connection status changes: Connecting → Connected
- ✅ Welcome banner displays server name and port
- ✅ Terminal prompt shows: `> `
- ✅ Commands execute successfully
- ✅ Responses display in terminal
- ✅ Terminal auto-scrolls to bottom

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 2. Authentication - Correct Password

**Goal:** Verify RCON connects with valid password

**Steps:**
1. Ensure server has RCON password set in config
2. Click "🎮 RCON" button
3. Observe connection establishes

**Expected Results:**
- ✅ Connection status: "● Connected" (green)
- ✅ Welcome message appears
- ✅ No authentication errors

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 3. Authentication - Wrong Password

**Goal:** Verify proper error handling for invalid password

**Setup:**
1. Temporarily change RCON password in server config
2. Rebuild server container

**Steps:**
1. Click "🎮 RCON" button
2. Observe connection attempt

**Expected Results:**
- ✅ Connection status: "● Disconnected" (red)
- ✅ Error message displays: "RCON connection failed"
- ✅ Terminal shows error (not just blank)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 4. Connection Errors - Server Offline

**Goal:** Verify proper handling when server is down

**Setup:**
1. Stop the Zomboid server container

**Steps:**
1. Click "🎮 RCON" button
2. Observe connection attempt

**Expected Results:**
- ✅ Connection status: "● Disconnected" (red)
- ✅ Error message displays
- ✅ No JavaScript console errors
- ✅ Can close modal without issues

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 5. Connection Errors - RCON Disabled

**Goal:** Verify proper handling when RCON is disabled on server

**Setup:**
1. Set `RCONEnabled=false` in server.ini
2. Restart server

**Steps:**
1. Click "🎮 RCON" button
2. Observe connection attempt

**Expected Results:**
- ✅ Connection status: "● Disconnected" (red)
- ✅ Error message: "Connection refused" or similar
- ✅ Terminal shows error

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 6. Session Management - Multiple Commands

**Goal:** Verify session persists across multiple commands

**Steps:**
1. Connect to RCON
2. Execute `players` command
3. Execute `help` command
4. Execute `save` command
5. Execute 5 more commands in sequence

**Expected Results:**
- ✅ All commands execute on same session
- ✅ No re-authentication between commands
- ✅ Responses appear quickly (< 2 seconds)
- ✅ No timeout errors

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 7. Session Management - Idle Timeout

**Goal:** Verify 5-minute idle timeout works

**Steps:**
1. Connect to RCON
2. Execute one command
3. Wait 6 minutes without interaction
4. Execute another command

**Expected Results:**
- ✅ Agent auto-disconnects session after 5 minutes
- ✅ Manager handles gracefully (no crash)
- ✅ User sees error or auto-reconnect

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 8. Session Management - Reconnect

**Goal:** Verify can reconnect after disconnect

**Steps:**
1. Connect to RCON
2. Close modal (disconnect)
3. Re-open RCON terminal
4. Execute a command

**Expected Results:**
- ✅ New session created
- ✅ Connection successful
- ✅ Commands work normally

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 9. Command History - Arrow Navigation

**Goal:** Verify command history works

**Steps:**
1. Connect to RCON
2. Execute `players` command
3. Execute `help` command
4. Execute `save` command
5. Press Up Arrow once
6. Observe `save` appears
7. Press Up Arrow again
8. Observe `help` appears
9. Press Down Arrow once
10. Observe `save` appears

**Expected Results:**
- ✅ Up arrow navigates to previous commands
- ✅ Down arrow navigates forward
- ✅ Commands display correctly in terminal
- ✅ History persists (check localStorage)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 10. Command History - Persistence

**Goal:** Verify command history persists across sessions

**Steps:**
1. Connect to RCON
2. Execute 5 different commands
3. Close modal
4. Re-open RCON terminal
5. Press Up Arrow
6. Observe previous commands appear

**Expected Results:**
- ✅ Command history persists in localStorage
- ✅ Up to 100 commands saved
- ✅ History is per-server (different servers have different history)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 11. Quick Actions - Refresh Players

**Goal:** Verify refresh player list works

**Setup:**
1. Have at least 1 player connected to server (or test with 0 players)

**Steps:**
1. Connect to RCON
2. Click "🔄 Refresh Players" button
3. Observe player list updates

**Expected Results:**
- ✅ `players` command executes
- ✅ Player list parses correctly
- ✅ Players displayed in UI
- ✅ Terminal shows "Refreshed player list (N online)"
- ✅ If 0 players: "No players online" displays

**Actual Results:**
- [ ] Pass / [ ] Fail
- Players shown:
- Notes:

---

### 12. Quick Actions - Save World

**Goal:** Verify save world button works

**Steps:**
1. Connect to RCON
2. Click "💾 Save World" button
3. Observe terminal output

**Expected Results:**
- ✅ `save` command executes
- ✅ Terminal shows "✓ World saved" in green
- ✅ Server logs confirm save occurred

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 13. Quick Actions - Broadcast Message

**Goal:** Verify broadcast message modal works

**Steps:**
1. Connect to RCON
2. Click "📢 Broadcast Message" button
3. Observe modal opens
4. Type test message: "Test broadcast from RCON"
5. Press Enter or click Send
6. Observe terminal output

**Expected Results:**
- ✅ Modal opens with input field
- ✅ Input field has focus
- ✅ Enter key sends message
- ✅ Escape key cancels
- ✅ `servermsg "Test broadcast from RCON"` executes
- ✅ Terminal shows "✓ Broadcast sent: ..." in green
- ✅ Modal closes after send

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 14. Quick Actions - Kick Player

**Goal:** Verify kick player pre-fills command

**Setup:**
1. Have at least 1 player connected to server

**Steps:**
1. Connect to RCON
2. Click "🔄 Refresh Players"
3. Click "Kick" button next to a player
4. Observe terminal

**Expected Results:**
- ✅ Terminal shows: `> kickuser "PlayerName"`
- ✅ Command is pre-filled but NOT executed
- ✅ User can press Enter to execute
- ✅ User can edit command before executing

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 15. Quick Actions - Ban Player

**Goal:** Verify ban player pre-fills command

**Setup:**
1. Have at least 1 player connected to server

**Steps:**
1. Connect to RCON
2. Click "🔄 Refresh Players"
3. Click "Ban" button next to a player
4. Observe terminal

**Expected Results:**
- ✅ Terminal shows: `> banuser "PlayerName"`
- ✅ Command is pre-filled but NOT executed
- ✅ User can press Enter to execute
- ✅ User can edit command before executing

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 16. Edge Cases - Long Command Output

**Goal:** Verify terminal handles multi-page responses

**Steps:**
1. Connect to RCON
2. Execute `help` command (typically has long output)
3. Observe terminal

**Expected Results:**
- ✅ All output displays
- ✅ Terminal scrolls correctly
- ✅ No truncation or overflow issues
- ✅ Can scroll up to see earlier output

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 17. Edge Cases - Special Characters

**Goal:** Verify special characters in commands/responses work

**Steps:**
1. Connect to RCON
2. Try broadcast with special chars: `Hello "World" & <Test>`
3. Try player names with spaces (if any)

**Expected Results:**
- ✅ Special characters handled correctly
- ✅ Quotes escaped properly
- ✅ No parsing errors

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 18. Edge Cases - Server Restart During Session

**Goal:** Verify graceful handling of server restart

**Steps:**
1. Connect to RCON
2. Restart Zomboid server container
3. Try executing a command

**Expected Results:**
- ✅ Terminal shows error
- ✅ No crash
- ✅ Can close and re-open RCON after server restarts

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 19. Edge Cases - Multiple Users

**Goal:** Verify multiple users can use RCON simultaneously

**Setup:**
1. Open RCON in two different browser windows/tabs

**Steps:**
1. Connect to RCON in Window 1
2. Connect to RCON in Window 2
3. Execute command in Window 1
4. Execute command in Window 2

**Expected Results:**
- ✅ Both sessions work independently
- ✅ No interference between sessions
- ✅ Commands execute in both windows

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 20. Performance - Terminal Responsiveness

**Goal:** Verify terminal remains responsive

**Steps:**
1. Connect to RCON
2. Execute 20 commands rapidly
3. Type fast in terminal
4. Resize browser window

**Expected Results:**
- ✅ Terminal responds to input quickly (< 100ms)
- ✅ No lag or freezing
- ✅ Terminal resizes correctly
- ✅ No memory leaks (check browser dev tools)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 21. Keyboard Shortcuts

**Goal:** Verify all keyboard shortcuts work

**Steps:**
1. Connect to RCON
2. Type a command but don't send
3. Press Ctrl+C
4. Observe command clears
5. Type another command and send
6. Press Ctrl+L
7. Observe terminal clears
8. Test backspace, Enter, arrows

**Expected Results:**
- ✅ Ctrl+C cancels current command
- ✅ Ctrl+L clears terminal
- ✅ Enter sends command
- ✅ Backspace deletes character
- ✅ Up/Down navigate history
- ✅ Left/Right don't do anything (expected)

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

### 22. UI/UX - Visual Design

**Goal:** Verify visual design matches spec

**Steps:**
1. Open RCON terminal
2. Check colors, fonts, spacing
3. Check player list UI
4. Check quick action buttons

**Expected Results:**
- ✅ Dark theme (VS Code style)
- ✅ Proper colors: green=connected, red=error, cyan=info
- ✅ Player list scrollable with max-height 200px
- ✅ Buttons color-coded correctly
- ✅ Modal centered and sized correctly
- ✅ Terminal fills available space

**Actual Results:**
- [ ] Pass / [ ] Fail
- Notes:

---

## Test Summary

**Total Tests:** 22
**Passed:** ___
**Failed:** ___
**Skipped:** ___

### Critical Issues Found

(List any blocking issues that prevent release)

---

### Non-Critical Issues Found

(List any minor issues that can be fixed later)

---

### Performance Notes

- Terminal responsiveness:
- Memory usage:
- Network latency:

---

### Browser Compatibility

- [ ] Chrome/Edge (tested version: ___)
- [ ] Firefox (tested version: ___)
- [ ] Safari (tested version: ___)

---

## Sign-Off

**Tester:** ___________________
**Date:** ___________________
**Status:** [ ] Pass [ ] Fail [ ] Conditional Pass

**Notes:**

---

## Next Steps

If tests pass:
- [ ] Update CHANGELOG.md with M6 completion
- [ ] Create release notes
- [ ] Deploy to production
- [ ] Update user documentation

If tests fail:
- [ ] File issues for critical bugs
- [ ] Fix and re-test
- [ ] Update implementation as needed
