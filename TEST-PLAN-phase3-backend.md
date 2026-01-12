# Test Plan: Phase 3 Backend Auth Migration

**Purpose:** Verify all backend endpoints use JWT authentication and role-based permission checks

**Environment:** Local development (manager running on localhost)

**Duration:** ~30-45 minutes

---

## Prerequisites

1. **Manager service running locally**
   ```bash
   cd manager
   npm run dev
   # Should be running on http://localhost:8787 (or configured port)
   ```

2. **Database migration 0009 applied**
   - Verify: Check that `role_assignments` table exists
   - Users table allows NULL role

3. **Tools needed**
   - `curl` or `httpie`
   - `jq` (for JSON parsing)

---

## Test Setup

### Step 1: Get Admin Token

Login as existing admin user to get JWT token:

```bash
# Login as admin
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-admin-password"
  }')

# Extract token
ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.token')

echo "Admin token: $ADMIN_TOKEN"
```

**Expected:** Should receive JWT token
**If fails:** Create admin user first or check credentials

---

### Step 2: Create Test Users

Create test users for each role scenario:

```bash
# Test User 1: NULL role user (no default access)
curl -X POST http://localhost:8787/api/users/invite \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "viewer@test.com",
    "role": "viewer"
  }'

# Test User 2: Operator role
curl -X POST http://localhost:8787/api/users/invite \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operator@test.com",
    "role": "operator"
  }'

# Test User 3: Agent-admin role
curl -X POST http://localhost:8787/api/users/invite \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agentadmin@test.com",
    "role": "agent-admin"
  }'
```

**Expected:** Each returns invitation with token
**Save:** Invitation tokens for account creation

---

### Step 3: Accept Invitations

For each invitation token received above:

```bash
# Accept viewer invitation
curl -X POST http://localhost:8787/api/invite/{VIEWER_TOKEN}/accept \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestPassword123!"
  }'

# Accept operator invitation
curl -X POST http://localhost:8787/api/invite/{OPERATOR_TOKEN}/accept \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestPassword123!"
  }'

# Accept agent-admin invitation
curl -X POST http://localhost:8787/api/invite/{AGENTADMIN_TOKEN}/accept \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestPassword123!"
  }'
```

**Expected:** Users created with NULL system role
**Verify:** Check that invitation role is stored (but users have NULL system role)

---

### Step 4: Login Test Users

Get JWT tokens for each test user:

```bash
# Login as viewer
VIEWER_RESPONSE=$(curl -s -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "viewer@test.com",
    "password": "TestPassword123!"
  }')
VIEWER_TOKEN=$(echo $VIEWER_RESPONSE | jq -r '.token')

# Login as operator
OPERATOR_RESPONSE=$(curl -s -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operator@test.com",
    "password": "TestPassword123!"
  }')
OPERATOR_TOKEN=$(echo $OPERATOR_RESPONSE | jq -r '.token')

# Login as agent-admin
AGENTADMIN_RESPONSE=$(curl -s -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agentadmin@test.com",
    "password": "TestPassword123!"
  }')
AGENTADMIN_TOKEN=$(echo $AGENTADMIN_RESPONSE | jq -r '.token')

echo "Viewer token: $VIEWER_TOKEN"
echo "Operator token: $OPERATOR_TOKEN"
echo "Agent-admin token: $AGENTADMIN_TOKEN"
```

**Expected:** All users can login successfully
**Verify:** JWT tokens returned

---

### Step 5: Get Test Resources

Get agent and server IDs for testing:

```bash
# List agents
AGENTS=$(curl -s -X GET http://localhost:8787/api/agents \
  -H "Authorization: Bearer $ADMIN_TOKEN")

AGENT_ID=$(echo $AGENTS | jq -r '.agents[0].id')
echo "Test Agent ID: $AGENT_ID"

# List servers on agent
SERVERS=$(curl -s -X GET http://localhost:8787/api/agents/$AGENT_ID/servers \
  -H "Authorization: Bearer $ADMIN_TOKEN")

SERVER_ID=$(echo $SERVERS | jq -r '.servers[0].id')
echo "Test Server ID: $SERVER_ID"
```

---

### Step 6: Assign Role Permissions

Now assign permissions to test users (using new role assignments API when implemented).

**Note:** Since Phase 5 (Frontend) isn't done yet, we need to insert directly into DB:

```bash
# This would be done via API in Phase 5, but for now use direct DB insert:
# For local testing, you may need to use wrangler d1 execute or sqlite3

# Example: Grant viewer role on server to viewer@test.com
# INSERT INTO role_assignments (id, user_id, role, scope, resource_id, created_at)
# VALUES ('test-ra-1', '{VIEWER_USER_ID}', 'viewer', 'server', '{SERVER_ID}', {TIMESTAMP})

# Example: Grant operator role on agent to operator@test.com
# INSERT INTO role_assignments (id, user_id, role, scope, resource_id, created_at)
# VALUES ('test-ra-2', '{OPERATOR_USER_ID}', 'operator', 'agent', '{AGENT_ID}', {TIMESTAMP})

# Example: Grant agent-admin role on agent to agentadmin@test.com
# INSERT INTO role_assignments (id, user_id, role, scope, resource_id, created_at)
# VALUES ('test-ra-3', '{AGENTADMIN_USER_ID}', 'agent-admin', 'agent', '{AGENT_ID}', {TIMESTAMP})
```

**Alternative:** Skip this for now and test with admin token to verify endpoints work, then test Phase 5 frontend for role assignments.

---

## Test Scenarios

### Test Group 1: JWT Authentication Required

**Goal:** Verify all endpoints reject requests without JWT token

#### Test 1.1: No Token → 401

```bash
# Test: List containers without token
curl -i -X GET http://localhost:8787/api/agents/$AGENT_ID/containers

# Expected: 401 Unauthorized
# Expected Response: {"error":"Unauthorized - Missing or invalid Authorization header"}
```

#### Test 1.2: Invalid Token → 401

```bash
# Test: List containers with invalid token
curl -i -X GET http://localhost:8787/api/agents/$AGENT_ID/containers \
  -H "Authorization: Bearer invalid-token-12345"

# Expected: 401 Unauthorized
# Expected Response: {"error":"Unauthorized - Invalid or expired token"}
```

#### Test 1.3: Valid Token → Success

```bash
# Test: List containers with valid admin token
curl -i -X GET http://localhost:8787/api/agents/$AGENT_ID/containers \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 200 OK
# Expected Response: {"containers":[...]}
```

**Result:** ✅ / ❌
**Notes:** _____

---

### Test Group 2: Admin-Only Endpoints

**Goal:** Verify admin-only endpoints reject non-admin users

#### Test 2.1: Container Listing (Admin Only)

```bash
# Admin: Should succeed
curl -i -X GET http://localhost:8787/api/agents/$AGENT_ID/containers \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 200 OK

# Non-admin: Should fail (even with token)
curl -i -X GET http://localhost:8787/api/agents/$AGENT_ID/containers \
  -H "Authorization: Bearer $VIEWER_TOKEN"

# Expected: 403 Forbidden
# Expected Response: {"error":"Forbidden - requires admin role"}
```

**Result:** ✅ / ❌
**Notes:** _____

---

#### Test 2.2: Port Availability Check (Admin Only)

```bash
# Admin: Should succeed
curl -i -X GET http://localhost:8787/api/agents/$AGENT_ID/ports/availability \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 200 OK

# Non-admin: Should fail
curl -i -X GET http://localhost:8787/api/agents/$AGENT_ID/ports/availability \
  -H "Authorization: Bearer $OPERATOR_TOKEN"

# Expected: 403 Forbidden
```

**Result:** ✅ / ❌
**Notes:** _____

---

#### Test 2.3: Server Purge (Admin Only)

```bash
# Admin: Should succeed (creates soft-deleted server first)
curl -i -X DELETE http://localhost:8787/api/agents/$AGENT_ID/servers/$SERVER_ID/purge \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 200 OK

# Non-admin: Should fail
curl -i -X DELETE http://localhost:8787/api/agents/$AGENT_ID/servers/$SERVER_ID/purge \
  -H "Authorization: Bearer $AGENTADMIN_TOKEN"

# Expected: 403 Forbidden
```

**Result:** ✅ / ❌
**Notes:** _____

---

### Test Group 3: Server Permission-Based Endpoints

**Goal:** Verify permission-based endpoints check server access

#### Test 3.1: Server Creation (canCreateServer)

```bash
# Admin: Should succeed (can create anywhere)
curl -i -X POST http://localhost:8787/api/agents/$AGENT_ID/servers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-server",
    "image_tag": "latest",
    "game_port": 16261,
    "config": {}
  }'

# Expected: 201 Created

# Agent-admin with assignment on this agent: Should succeed
# (Requires role assignment to be created first - Phase 5)

# Non-admin without permission: Should fail
curl -i -X POST http://localhost:8787/api/agents/$AGENT_ID/servers \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-server-2",
    "image_tag": "latest",
    "game_port": 16262,
    "config": {}
  }'

# Expected: 403 Forbidden
# Expected Response: {"error":"Forbidden - requires admin or agent-admin role for this agent"}
```

**Result:** ✅ / ❌
**Notes:** _____

---

#### Test 3.2: Server Rebuild (canControlServer)

```bash
# Get a running server ID first
RUNNING_SERVER=$(curl -s -X GET http://localhost:8787/api/agents/$AGENT_ID/servers \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.servers[] | select(.status=="running") | .id' | head -1)

# Admin: Should succeed
curl -i -X POST http://localhost:8787/api/agents/$AGENT_ID/servers/$RUNNING_SERVER/rebuild \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 200 OK

# Operator with permission: Should succeed (requires role assignment)
# (Skip for now - test in Phase 5)

# Viewer: Should fail (read-only)
curl -i -X POST http://localhost:8787/api/agents/$AGENT_ID/servers/$RUNNING_SERVER/rebuild \
  -H "Authorization: Bearer $VIEWER_TOKEN"

# Expected: 403 Forbidden
# Expected Response: {"error":"Forbidden - requires operator or higher role for this server"}
```

**Result:** ✅ / ❌
**Notes:** _____

---

### Test Group 4: WebSocket JWT Authentication

**Goal:** Verify WebSocket endpoints use JWT token in query parameter

#### Test 4.1: Log Streaming WebSocket

```bash
# Test with valid JWT token
curl -i -X GET "http://localhost:8787/api/agents/$AGENT_ID/logs/ws?token=$ADMIN_TOKEN" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket"

# Expected: 101 Switching Protocols (WebSocket upgrade)

# Test without token
curl -i -X GET "http://localhost:8787/api/agents/$AGENT_ID/logs/ws" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket"

# Expected: 401 Unauthorized
# Expected Response: {"error":"Unauthorized - Missing token parameter"}

# Test with invalid token
curl -i -X GET "http://localhost:8787/api/agents/$AGENT_ID/logs/ws?token=invalid123" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket"

# Expected: 401 Unauthorized
# Expected Response: {"error":"Unauthorized - Invalid or expired token"}
```

**Result:** ✅ / ❌
**Notes:** _____

---

### Test Group 5: Permission Hierarchy (Phase 5 Required)

**Goal:** Verify scope priority (server > agent > global)

**Status:** ⏳ Requires Phase 5 frontend to assign roles at different scopes

**Test Cases:**
1. User with agent-level operator + server-level viewer → server should be viewer (override)
2. User with global viewer + agent-level operator → agent servers should be operator (inheritance)
3. User with server-level operator → only that server accessible, not others on same agent

**Defer to Phase 7 (Testing & Verification)**

---

### Test Group 6: Edge Cases

#### Test 6.1: NULL Role User Without Assignments

```bash
# Create user with NULL role, no assignments
# User should not be able to access any resources

# Try to list servers (should see empty list or 403)
curl -i -X GET http://localhost:8787/api/agents/$AGENT_ID/servers \
  -H "Authorization: Bearer $VIEWER_TOKEN"

# Expected: Empty servers list or appropriate response
# Note: This requires checking frontend filtering logic
```

**Result:** ✅ / ❌
**Notes:** _____

---

#### Test 6.2: Expired Token

```bash
# Wait for token to expire (or use old token)
# Expected: 401 Unauthorized with "Session expired" message

# This is hard to test in real-time - can verify in Phase 7 with automated tests
```

**Result:** ⏳ Deferred
**Notes:** _____

---

## Quick Smoke Test Script

For rapid verification, use this condensed test:

```bash
#!/bin/bash

# Configuration
API_URL="http://localhost:8787"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="your-password"

# Login as admin
echo "1. Testing admin login..."
ADMIN_TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | jq -r '.token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
  echo "❌ Admin login failed"
  exit 1
fi
echo "✅ Admin login successful"

# Get agent ID
echo "2. Getting test agent..."
AGENT_ID=$(curl -s -X GET $API_URL/api/agents \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq -r '.agents[0].id')
echo "✅ Agent ID: $AGENT_ID"

# Test 1: No token → 401
echo "3. Testing endpoint without token (should fail)..."
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X GET $API_URL/api/agents/$AGENT_ID/containers)
if [ "$RESPONSE" = "401" ]; then
  echo "✅ Correctly rejected request without token"
else
  echo "❌ Expected 401, got $RESPONSE"
fi

# Test 2: Admin token → 200
echo "4. Testing endpoint with admin token (should succeed)..."
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X GET $API_URL/api/agents/$AGENT_ID/containers \
  -H "Authorization: Bearer $ADMIN_TOKEN")
if [ "$RESPONSE" = "200" ]; then
  echo "✅ Admin can access containers endpoint"
else
  echo "❌ Expected 200, got $RESPONSE"
fi

# Test 3: Invalid token → 401
echo "5. Testing endpoint with invalid token (should fail)..."
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X GET $API_URL/api/agents/$AGENT_ID/containers \
  -H "Authorization: Bearer invalid-token-123")
if [ "$RESPONSE" = "401" ]; then
  echo "✅ Correctly rejected invalid token"
else
  echo "❌ Expected 401, got $RESPONSE"
fi

echo ""
echo "=== Basic JWT Auth Tests Complete ==="
echo "For full permission testing, complete Phase 5 (Frontend) to assign roles"
```

**Save as:** `test-backend-auth.sh`
**Run:** `bash test-backend-auth.sh`

---

## Test Results Summary

| Test Group | Status | Notes |
|------------|--------|-------|
| 1. JWT Required | ⏳ | |
| 2. Admin-Only Endpoints | ⏳ | |
| 3. Permission-Based Endpoints | ⏳ | Partial - need role assignments |
| 4. WebSocket JWT | ⏳ | |
| 5. Permission Hierarchy | ⏳ | Requires Phase 5 |
| 6. Edge Cases | ⏳ | Partial |

**Overall:** ⏳ Not Started / 🟡 In Progress / ✅ Complete

---

## Known Limitations

1. **Role Assignments:** Phase 5 (Frontend) not complete yet, so:
   - Cannot create role assignments via API
   - Must use direct DB inserts for testing permissions
   - Full permission testing deferred to Phase 7

2. **WebSocket Testing:**
   - `curl` WebSocket testing is limited
   - May need specialized tools (wscat, websocat)
   - Full WebSocket testing in Phase 7

3. **Automated Tests:**
   - Manual testing only at this stage
   - Automated integration tests in Phase 7

---

## Cleanup

After testing, remove test users:

```bash
# Delete test users (admin only)
curl -X DELETE http://localhost:8787/api/users/{VIEWER_USER_ID} \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -X DELETE http://localhost:8787/api/users/{OPERATOR_USER_ID} \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -X DELETE http://localhost:8787/api/users/{AGENTADMIN_USER_ID} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Next Steps After Testing

1. **If tests pass:** Proceed to Phase 5 (Frontend Updates)
2. **If tests fail:** Debug and fix issues before continuing
3. **Document issues:** Add to findings.md for tracking

**Phase 5 Priority:** Need role assignment management API/UI to fully test permission system
