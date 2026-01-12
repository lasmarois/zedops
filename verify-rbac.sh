#!/bin/bash
# RBAC System Verification Script
# Run this after deployment to verify everything works

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MANAGER_URL=${MANAGER_URL:-"https://your-manager-url.workers.dev"}
ADMIN_EMAIL="admin@zedops.local"
ADMIN_PASSWORD="admin123"

echo "🔍 ZedOps RBAC Verification"
echo "============================"
echo ""

# Test 1: Check if migrations ran
echo "Test 1: Database Tables"
echo -n "  Checking users table... "
if wrangler d1 execute ZEDOPS_DB --command="SELECT COUNT(*) FROM users;" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Run: wrangler d1 execute ZEDOPS_DB --file=migrations/0006_create_rbac_tables.sql"
    exit 1
fi

# Test 2: Check if default admin exists
echo -n "  Checking default admin... "
ADMIN_COUNT=$(wrangler d1 execute ZEDOPS_DB --command="SELECT COUNT(*) as count FROM users WHERE email='$ADMIN_EMAIL';" --json | grep -o '"count":[0-9]*' | cut -d: -f2)
if [ "$ADMIN_COUNT" = "1" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Run: wrangler d1 execute ZEDOPS_DB --file=migrations/0007_insert_default_admin.sql"
    exit 1
fi

# Test 3: Check if manager is deployed
echo ""
echo "Test 2: Manager Deployment"
echo -n "  Checking manager endpoint... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$MANAGER_URL/api/agents" 2>/dev/null || echo "000")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} (HTTP $STATUS)"
else
    echo -e "${RED}✗${NC} (HTTP $STATUS)"
    echo "  Manager URL: $MANAGER_URL"
    echo "  Expected 401 (unauthorized) or 200, got $STATUS"
    exit 1
fi

# Test 4: Test login endpoint
echo -n "  Testing login endpoint... "
LOGIN_RESPONSE=$(curl -s -X POST "$MANAGER_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null)

if echo "$LOGIN_RESPONSE" | grep -q '"token"'; then
    echo -e "${GREEN}✓${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
else
    echo -e "${RED}✗${NC}"
    echo "  Response: $LOGIN_RESPONSE"
    exit 1
fi

# Test 5: Test authenticated request
echo -n "  Testing authenticated request... "
USERS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$MANAGER_URL/api/users" 2>/dev/null)
if echo "$USERS_RESPONSE" | grep -q '"users"'; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "  Response: $USERS_RESPONSE"
    exit 1
fi

# Test 6: Check audit logs table
echo ""
echo "Test 3: Audit Logging"
echo -n "  Checking audit_logs table... "
if wrangler d1 execute ZEDOPS_DB --command="SELECT COUNT(*) FROM audit_logs;" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"

    # Check if login was logged
    echo -n "  Checking login was logged... "
    AUDIT_COUNT=$(wrangler d1 execute ZEDOPS_DB --command="SELECT COUNT(*) FROM audit_logs WHERE action='user_login';" --json | grep -o '"COUNT.*":[0-9]*' | grep -o '[0-9]*')
    if [ "$AUDIT_COUNT" -gt "0" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC} (No login events logged yet)"
    fi
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All tests passed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Login at your frontend URL"
echo "  2. Email: $ADMIN_EMAIL"
echo "  3. Password: $ADMIN_PASSWORD"
echo "  4. ⚠️  Change the default password immediately!"
echo ""
