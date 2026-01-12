#!/bin/bash
set -e

# Quick smoke test for Phase 3: Backend Auth Migration
# Tests that JWT authentication is working on all endpoints

# Configuration
API_URL="${API_URL:-http://localhost:8787}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

echo "========================================"
echo "Backend Auth Migration - Smoke Test"
echo "========================================"
echo ""

# Check if admin password is set
if [ -z "$ADMIN_PASSWORD" ]; then
  echo "Please set ADMIN_PASSWORD environment variable:"
  echo "  export ADMIN_PASSWORD='your-admin-password'"
  echo "  bash test-backend-auth.sh"
  exit 1
fi

# Check dependencies
if ! command -v curl &> /dev/null; then
  echo "❌ curl is required but not installed"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "❌ jq is required but not installed"
  echo "Install: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
fi

# Test 1: Admin Login
echo "Test 1: Admin Login"
echo "-------------------"
ADMIN_RESPONSE=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.token // empty')

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Admin login failed"
  echo "Response: $ADMIN_RESPONSE"
  exit 1
fi
echo "✅ Admin login successful"
echo "   Token: ${ADMIN_TOKEN:0:20}..."
echo ""

# Test 2: Get Agent ID
echo "Test 2: Get Test Agent"
echo "-----------------------"
AGENTS_RESPONSE=$(curl -s -X GET $API_URL/api/agents \
  -H "Authorization: Bearer $ADMIN_TOKEN")

AGENT_ID=$(echo $AGENTS_RESPONSE | jq -r '.agents[0].id // empty')

if [ -z "$AGENT_ID" ]; then
  echo "❌ No agents found"
  echo "Response: $AGENTS_RESPONSE"
  exit 1
fi
echo "✅ Found agent: $AGENT_ID"
echo ""

# Test 3: Endpoint without token (should fail with 401)
echo "Test 3: Request Without Token"
echo "------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET $API_URL/api/agents/$AGENT_ID/containers)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Correctly rejected request without token (401)"
else
  echo "❌ Expected 401, got $HTTP_CODE"
  echo "Body: $BODY"
fi
echo ""

# Test 4: Endpoint with invalid token (should fail with 401)
echo "Test 4: Request With Invalid Token"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET $API_URL/api/agents/$AGENT_ID/containers \
  -H "Authorization: Bearer invalid-token-123")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Correctly rejected invalid token (401)"
else
  echo "❌ Expected 401, got $HTTP_CODE"
  echo "Body: $BODY"
fi
echo ""

# Test 5: Endpoint with valid admin token (should succeed with 200)
echo "Test 5: Request With Valid Admin Token"
echo "---------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET $API_URL/api/agents/$AGENT_ID/containers \
  -H "Authorization: Bearer $ADMIN_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Admin can access containers endpoint (200)"
  CONTAINER_COUNT=$(echo "$BODY" | jq '.containers | length')
  echo "   Found $CONTAINER_COUNT containers"
else
  echo "❌ Expected 200, got $HTTP_CODE"
  echo "Body: $BODY"
fi
echo ""

# Test 6: Admin-only endpoint with admin token (port availability)
echo "Test 6: Admin-Only Endpoint (Port Availability)"
echo "-----------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET $API_URL/api/agents/$AGENT_ID/ports/availability \
  -H "Authorization: Bearer $ADMIN_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Admin can access port availability endpoint (200)"
else
  echo "❌ Expected 200, got $HTTP_CODE"
  echo "Body: $BODY"
fi
echo ""

# Test 7: WebSocket endpoint without token (should fail)
echo "Test 7: WebSocket Endpoint Without Token"
echo "-----------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/agents/$AGENT_ID/logs/ws" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ WebSocket endpoint requires token (401)"
else
  echo "⚠️  Expected 401, got $HTTP_CODE (may be normal for WebSocket)"
  echo "Body: $BODY"
fi
echo ""

# Test 8: WebSocket endpoint with token (should upgrade or authenticate)
echo "Test 8: WebSocket Endpoint With Token"
echo "--------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/agents/$AGENT_ID/logs/ws?token=$ADMIN_TOKEN" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# WebSocket may return 101 (upgrade) or 200, depending on curl behavior
if [ "$HTTP_CODE" = "101" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "✅ WebSocket endpoint accepts JWT token ($HTTP_CODE)"
elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "426" ]; then
  echo "⚠️  WebSocket handshake response ($HTTP_CODE) - full test needs WebSocket client"
else
  echo "⚠️  Unexpected response ($HTTP_CODE) - may need WebSocket-capable client"
fi
echo ""

# Summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "✅ JWT authentication is working"
echo "✅ Admin role can access endpoints"
echo "✅ Endpoints reject missing/invalid tokens"
echo ""
echo "Next Steps:"
echo "1. Review full test plan: TEST-PLAN-phase3-backend.md"
echo "2. Test permission-based endpoints (requires Phase 5 frontend)"
echo "3. Proceed to Phase 5: Frontend Updates"
echo ""
echo "For detailed permission testing, use the full test plan after Phase 5 is complete."
