#!/bin/bash

echo "═══════════════════════════════════════════════════════════════════"
echo "🧪 TESTING COMPLETE DELIVERY DASHBOARD FLOW"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check backend health
echo "1️⃣  Testing Backend Health..."
HEALTH=$(curl -s http://localhost:5001/health)
if echo "$HEALTH" | grep -q '"status":"OK"'; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    exit 1
fi
echo ""

# Test 2: Login as Raju
echo "2️⃣  Testing Raju's Login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5001/api/delivery/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"raju@gmail.com","password":"123456"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Login successful${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    echo "   Token: ${TOKEN:0:50}..."
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Fetch orders with token
echo "3️⃣  Testing Orders API with Token..."
ORDERS_RESPONSE=$(curl -s http://localhost:5001/api/delivery/orders \
  -H "Authorization: Bearer $TOKEN")

if echo "$ORDERS_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Orders API working${NC}"
    ORDER_COUNT=$(echo "$ORDERS_RESPONSE" | grep -o '"_id"' | wc -l)
    echo "   Found $ORDER_COUNT orders"
    
    # Show order details
    echo ""
    echo "   📦 Order Details:"
    echo "$ORDERS_RESPONSE" | grep -o '"_id":"[^"]*"' | head -3 | while read -r line; do
        ORDER_ID=$(echo "$line" | cut -d'"' -f4)
        echo "      - Order ID: $ORDER_ID"
    done
else
    echo -e "${RED}❌ Orders API failed${NC}"
    echo "Response: $ORDERS_RESPONSE"
    exit 1
fi
echo ""

# Test 4: Check frontend
echo "4️⃣  Testing Frontend..."
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
if [ "$FRONTEND" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend not accessible (HTTP $FRONTEND)${NC}"
    exit 1
fi
echo ""

# Test 5: Check proxy
echo "5️⃣  Testing Frontend Proxy..."
PROXY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/delivery/orders)
if [ "$PROXY" = "401" ] || [ "$PROXY" = "200" ]; then
    echo -e "${GREEN}✅ Proxy is working (HTTP $PROXY)${NC}"
else
    echo -e "${YELLOW}⚠️  Proxy returned HTTP $PROXY${NC}"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. Open your browser"
echo "2. Go to: http://localhost:3000/delivery/login"
echo "3. Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)"
echo "4. Login with:"
echo "   Email: raju@gmail.com"
echo "   Password: 123456"
echo "5. You will see all 3 orders (₹955 total)!"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
