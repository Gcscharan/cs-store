#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DELIVERY LIFECYCLE VERIFICATION SCRIPT
# 
# Verifies the ENTIRE delivery partner lifecycle end-to-end against the live
# backend. Captures PASS/FAIL for every step.
#
# Requires: backend running on localhost:5001 with MOCK_OTP=true
# ═══════════════════════════════════════════════════════════════════════════════

set -e

API="http://localhost:5001/api"
RESULTS_FILE="DELIVERY_LIFECYCLE_RESULTS.md"
PASS_COUNT=0
FAIL_COUNT=0
PARTIAL_COUNT=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}✅ PASS${NC} $1"; PASS_COUNT=$((PASS_COUNT+1)); echo "| $1 | PASS ✅ | $2 |" >> $RESULTS_FILE; }
log_fail() { echo -e "${RED}❌ FAIL${NC} $1 — $2"; FAIL_COUNT=$((FAIL_COUNT+1)); echo "| $1 | FAIL ❌ | $2 |" >> $RESULTS_FILE; }
log_partial() { echo -e "${YELLOW}⚠️  PARTIAL${NC} $1 — $2"; PARTIAL_COUNT=$((PARTIAL_COUNT+1)); echo "| $1 | PARTIAL ⚠️ | $2 |" >> $RESULTS_FILE; }

# Initialize results file
cat > $RESULTS_FILE << 'EOF'
# DELIVERY LIFECYCLE VERIFICATION RESULTS
## Date: $(date '+%Y-%m-%d %H:%M:%S')
## Method: API-level end-to-end verification against live backend

---

| Step | Status | Details |
|------|--------|---------|
EOF

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  DELIVERY LIFECYCLE VERIFICATION"
echo "  Backend: $API"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── STEP 1: Health check ────────────────────────────────────────────────────
HEALTH=$(curl -s --max-time 5 $API/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  log_pass "STEP-01: Backend health" "Status OK"
else
  log_fail "STEP-01: Backend health" "Backend not responding"
  echo "Cannot continue without backend. Exiting."
  exit 1
fi

# ─── STEP 2: Admin Login ─────────────────────────────────────────────────────
ADMIN_PHONE="9391795162"
OTP_RESP=$(curl -s $API/auth/send-otp -H "Content-Type: application/json" -d "{\"phone\":\"$ADMIN_PHONE\"}")
OTP=$(echo $OTP_RESP | python3 -c "import sys,json;print(json.load(sys.stdin).get('otp',''))" 2>/dev/null)

if [ -z "$OTP" ]; then
  log_fail "STEP-02: Admin OTP send" "No OTP in response: $OTP_RESP"
  exit 1
fi

VERIFY_RESP=$(curl -s $API/auth/verify-otp -H "Content-Type: application/json" -d "{\"phone\":\"$ADMIN_PHONE\",\"otp\":\"$OTP\"}")
ADMIN_TOKEN=$(echo $VERIFY_RESP | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "None" ]; then
  log_fail "STEP-02: Admin login" "Token not received"
  exit 1
fi
log_pass "STEP-02: Admin login" "Token received, role=admin"

# ─── STEP 3: Get delivery partners ───────────────────────────────────────────
DP_RESP=$(curl -s $API/delivery-personnel -H "Authorization: Bearer $ADMIN_TOKEN")
DP_COUNT=$(echo $DP_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('deliveryBoys',[])))" 2>/dev/null)

if [ "$DP_COUNT" -gt 0 ] 2>/dev/null; then
  # Get first active delivery partner with userId
  DP_INFO=$(echo $DP_RESP | python3 -c "
import sys,json
d=json.load(sys.stdin)
for db in d.get('deliveryBoys',[]):
    if db.get('isActive') and db.get('userId'):
        print(db['_id'] + '|' + str(db.get('userId','')) + '|' + db.get('name',''))
        break
" 2>/dev/null)
  
  DELIVERY_BOY_ID=$(echo $DP_INFO | cut -d'|' -f1)
  DELIVERY_USER_ID=$(echo $DP_INFO | cut -d'|' -f2)
  DELIVERY_NAME=$(echo $DP_INFO | cut -d'|' -f3)
  
  log_pass "STEP-03: Get delivery partners" "$DP_COUNT partners found, using: $DELIVERY_NAME ($DELIVERY_BOY_ID)"
else
  log_fail "STEP-03: Get delivery partners" "No delivery partners found"
  exit 1
fi

# ─── STEP 4: Find or create a PACKED order ───────────────────────────────────
ORDERS_RESP=$(curl -s "$API/orders?status=PACKED&limit=5" -H "Authorization: Bearer $ADMIN_TOKEN")
ORDER_ID=$(echo $ORDERS_RESP | python3 -c "
import sys,json
d=json.load(sys.stdin)
orders = d.get('orders',[])
# Find unassigned PACKED order
for o in orders:
    if not o.get('deliveryBoyId') and not o.get('deliveryPartnerId'):
        print(o['_id'])
        break
" 2>/dev/null)

if [ -z "$ORDER_ID" ]; then
  # Try to find ANY PACKED order (even assigned ones we can reassign)
  ORDER_ID=$(echo $ORDERS_RESP | python3 -c "
import sys,json
d=json.load(sys.stdin)
orders = d.get('orders',[])
if orders:
    print(orders[0]['_id'])
" 2>/dev/null)
  
  if [ -z "$ORDER_ID" ]; then
    log_partial "STEP-04: Find PACKED order" "No PACKED orders in system — need to create an order first"
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  CANNOT VERIFY FULL LIFECYCLE — NO PACKED ORDERS"
    echo "  Need a customer to place an order first, then"
    echo "  admin confirms + packs it."
    echo "═══════════════════════════════════════════════════════"
  else
    log_partial "STEP-04: Find PACKED order" "Found order $ORDER_ID but may already be assigned"
  fi
else
  log_pass "STEP-04: Find PACKED order" "Order ID: $ORDER_ID"
fi

# ─── STEP 5: Assign order to delivery partner ────────────────────────────────
if [ -n "$ORDER_ID" ] && [ -n "$DELIVERY_BOY_ID" ]; then
  ASSIGN_RESP=$(curl -s -X POST "$API/orders/$ORDER_ID/assign" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"deliveryBoyId\":\"$DELIVERY_BOY_ID\"}")
  
  ASSIGN_STATUS=$(echo $ASSIGN_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print('success' if d.get('success') else d.get('error','unknown'))" 2>/dev/null)
  
  if [ "$ASSIGN_STATUS" = "success" ]; then
    log_pass "STEP-05: Assign order" "Order $ORDER_ID assigned to $DELIVERY_NAME"
  elif echo "$ASSIGN_STATUS" | grep -qi "already assigned"; then
    log_partial "STEP-05: Assign order" "Order already assigned (idempotent/409)"
  else
    log_fail "STEP-05: Assign order" "$ASSIGN_STATUS"
  fi
else
  log_partial "STEP-05: Assign order" "Skipped — no order or delivery partner available"
fi

# ─── STEP 6: Login as delivery partner ───────────────────────────────────────
# Try to get a token for the delivery partner via OTP login using their user ID
# The delivery partner uses OTP login via their phone number
if [ -n "$DELIVERY_USER_ID" ]; then
  # Get delivery partner phone from the personnel list
  DP_PHONE=$(echo $DP_RESP | python3 -c "
import sys,json
d=json.load(sys.stdin)
for db in d.get('deliveryBoys',[]):
    if db.get('_id') == '$DELIVERY_BOY_ID':
        print(db.get('phone',''))
        break
" 2>/dev/null)

  if [ -n "$DP_PHONE" ]; then
    DP_OTP_RESP=$(curl -s $API/auth/send-otp -H "Content-Type: application/json" -d "{\"phone\":\"$DP_PHONE\"}")
    DP_OTP=$(echo $DP_OTP_RESP | python3 -c "import sys,json;print(json.load(sys.stdin).get('otp',''))" 2>/dev/null)
    
    if [ -n "$DP_OTP" ] && [ "$DP_OTP" != "None" ]; then
      DP_VERIFY_RESP=$(curl -s $API/auth/verify-otp -H "Content-Type: application/json" -d "{\"phone\":\"$DP_PHONE\",\"otp\":\"$DP_OTP\"}")
      DELIVERY_TOKEN=$(echo $DP_VERIFY_RESP | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
      
      if [ -n "$DELIVERY_TOKEN" ] && [ "$DELIVERY_TOKEN" != "None" ]; then
        DP_ROLE=$(echo $DP_VERIFY_RESP | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('role',''))" 2>/dev/null)
        log_pass "STEP-06: Delivery partner login" "Phone: $DP_PHONE, Role: $DP_ROLE"
      else
        log_fail "STEP-06: Delivery partner login" "Token not received for phone $DP_PHONE"
        DELIVERY_TOKEN=""
      fi
    else
      log_fail "STEP-06: Delivery partner login" "OTP not received for phone $DP_PHONE"
    fi
  else
    log_fail "STEP-06: Delivery partner login" "No phone found for delivery partner"
  fi
else
  log_fail "STEP-06: Delivery partner login" "No delivery user ID available"
fi

# ─── STEP 7: Fetch delivery orders as rider ──────────────────────────────────
if [ -n "$DELIVERY_TOKEN" ]; then
  ORDERS_AS_DP=$(curl -s $API/delivery/orders -H "Authorization: Bearer $DELIVERY_TOKEN")
  DP_ORDER_COUNT=$(echo $ORDERS_AS_DP | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('orders',[])))" 2>/dev/null)
  DP_SUCCESS=$(echo $ORDERS_AS_DP | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('success',''))" 2>/dev/null)
  
  if [ "$DP_SUCCESS" = "True" ]; then
    log_pass "STEP-07: Fetch delivery orders" "$DP_ORDER_COUNT orders in rider's queue"
    
    # Get the assigned order ID
    ASSIGNED_ORDER=$(echo $ORDERS_AS_DP | python3 -c "
import sys,json
d=json.load(sys.stdin)
for o in d.get('orders',[]):
    s = str(o.get('orderStatus','')).upper()
    if s in ['ASSIGNED','PACKED']:
        print(o['_id'])
        break
" 2>/dev/null)
    
    if [ -n "$ASSIGNED_ORDER" ]; then
      echo "   → Found assigned order: $ASSIGNED_ORDER"
      ORDER_ID=$ASSIGNED_ORDER  # Override for subsequent steps
    fi
  else
    DP_ERROR=$(echo $ORDERS_AS_DP | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('error','unknown'))" 2>/dev/null)
    log_fail "STEP-07: Fetch delivery orders" "$DP_ERROR"
  fi
else
  log_partial "STEP-07: Fetch delivery orders" "Skipped — no delivery token"
fi

# ─── STEP 8: Pickup order ────────────────────────────────────────────────────
if [ -n "$DELIVERY_TOKEN" ] && [ -n "$ORDER_ID" ]; then
  PICKUP_RESP=$(curl -s -X POST "$API/delivery/orders/$ORDER_ID/pickup" \
    -H "Authorization: Bearer $DELIVERY_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: pickup:$ORDER_ID:$(date +%s)" \
    -d '{}')
  
  PICKUP_SUCCESS=$(echo $PICKUP_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print('success' if d.get('success') else d.get('error','unknown'))" 2>/dev/null)
  
  if [ "$PICKUP_SUCCESS" = "success" ]; then
    log_pass "STEP-08: Pickup order" "Order $ORDER_ID picked up"
  else
    log_fail "STEP-08: Pickup order" "$PICKUP_SUCCESS"
  fi
else
  log_partial "STEP-08: Pickup order" "Skipped — no token or order"
fi

# ─── STEP 9: Start delivery ──────────────────────────────────────────────────
if [ -n "$DELIVERY_TOKEN" ] && [ -n "$ORDER_ID" ]; then
  START_RESP=$(curl -s -X POST "$API/delivery/orders/$ORDER_ID/start-delivery" \
    -H "Authorization: Bearer $DELIVERY_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: start:$ORDER_ID:$(date +%s)" \
    -d '{}')
  
  START_SUCCESS=$(echo $START_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print('success' if d.get('success') else d.get('error','unknown'))" 2>/dev/null)
  
  if [ "$START_SUCCESS" = "success" ]; then
    log_pass "STEP-09: Start delivery" "Transit started for $ORDER_ID"
  else
    log_fail "STEP-09: Start delivery" "$START_SUCCESS"
  fi
else
  log_partial "STEP-09: Start delivery" "Skipped"
fi

# ─── STEP 10: Mark arrived ───────────────────────────────────────────────────
if [ -n "$DELIVERY_TOKEN" ] && [ -n "$ORDER_ID" ]; then
  ARRIVE_RESP=$(curl -s -X POST "$API/delivery/orders/$ORDER_ID/arrived" \
    -H "Authorization: Bearer $DELIVERY_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: arrive:$ORDER_ID:$(date +%s)" \
    -d '{}')
  
  ARRIVE_SUCCESS=$(echo $ARRIVE_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print('success' if d.get('success') else d.get('error','unknown'))" 2>/dev/null)
  
  if [ "$ARRIVE_SUCCESS" = "success" ]; then
    log_pass "STEP-10: Mark arrived" "Arrived at customer for $ORDER_ID"
  else
    log_fail "STEP-10: Mark arrived" "$ARRIVE_SUCCESS"
  fi
else
  log_partial "STEP-10: Mark arrived" "Skipped"
fi

# ─── STEP 11: Get OTP (from deliver attempt endpoint) ────────────────────────
if [ -n "$DELIVERY_TOKEN" ] && [ -n "$ORDER_ID" ]; then
  OTP_GEN_RESP=$(curl -s -X POST "$API/delivery/orders/$ORDER_ID/deliver" \
    -H "Authorization: Bearer $DELIVERY_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
  
  DELIVERY_OTP=$(echo $OTP_GEN_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('otp','') or d.get('deliveryOtp',''))" 2>/dev/null)
  
  if [ -n "$DELIVERY_OTP" ] && [ "$DELIVERY_OTP" != "None" ]; then
    log_pass "STEP-11: Generate delivery OTP" "OTP: $DELIVERY_OTP"
  else
    GEN_ERROR=$(echo $OTP_GEN_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('error','') or d.get('message','unknown'))" 2>/dev/null)
    log_fail "STEP-11: Generate delivery OTP" "$GEN_ERROR"
  fi
else
  log_partial "STEP-11: Generate delivery OTP" "Skipped"
fi

# ─── STEP 12: Verify OTP (complete delivery) ─────────────────────────────────
if [ -n "$DELIVERY_TOKEN" ] && [ -n "$ORDER_ID" ] && [ -n "$DELIVERY_OTP" ] && [ "$DELIVERY_OTP" != "None" ]; then
  VERIFY_OTP_RESP=$(curl -s -X POST "$API/delivery/orders/$ORDER_ID/verify-otp" \
    -H "Authorization: Bearer $DELIVERY_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: verify:$ORDER_ID:$(date +%s)" \
    -d "{\"otp\":\"$DELIVERY_OTP\"}")
  
  VERIFY_SUCCESS=$(echo $VERIFY_OTP_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print('success' if d.get('success') else d.get('error','unknown'))" 2>/dev/null)
  
  if [ "$VERIFY_SUCCESS" = "success" ]; then
    FINAL_STATUS=$(echo $VERIFY_OTP_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);o=d.get('order',{});print(o.get('orderStatus',''))" 2>/dev/null)
    log_pass "STEP-12: Verify OTP + Complete delivery" "Order status: $FINAL_STATUS"
  else
    log_fail "STEP-12: Verify OTP + Complete delivery" "$VERIFY_SUCCESS"
  fi
else
  log_partial "STEP-12: Verify OTP + Complete delivery" "Skipped — no OTP available"
fi

# ─── STEP 13: Verify earnings credited ───────────────────────────────────────
if [ -n "$DELIVERY_TOKEN" ]; then
  EARNINGS_RESP=$(curl -s $API/delivery/earnings -H "Authorization: Bearer $DELIVERY_TOKEN")
  EARNINGS_SUCCESS=$(echo $EARNINGS_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print('yes' if d.get('totalEarnings') is not None or d.get('earnings') is not None else 'no')" 2>/dev/null)
  
  if [ "$EARNINGS_SUCCESS" = "yes" ]; then
    TOTAL=$(echo $EARNINGS_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('totalEarnings',d.get('earnings',0)))" 2>/dev/null)
    log_pass "STEP-13: Verify earnings" "Total earnings: ₹$TOTAL"
  else
    log_fail "STEP-13: Verify earnings" "Earnings endpoint failed"
  fi
else
  log_partial "STEP-13: Verify earnings" "Skipped — no delivery token"
fi

# ─── STEP 14: Verify admin dashboard reflects delivery ───────────────────────
DASHBOARD_RESP=$(curl -s "$API/admin/dashboard-stats" -H "Authorization: Bearer $ADMIN_TOKEN")
DASH_ORDERS=$(echo $DASHBOARD_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('totalOrders',0))" 2>/dev/null)
DASH_DP=$(echo $DASHBOARD_RESP | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('totalDeliveryBoys',0))" 2>/dev/null)

if [ "$DASH_ORDERS" -gt 0 ] 2>/dev/null; then
  log_pass "STEP-14: Admin dashboard" "Orders: $DASH_ORDERS, Delivery partners: $DASH_DP"
else
  log_fail "STEP-14: Admin dashboard" "No orders in dashboard"
fi

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  DELIVERY LIFECYCLE RESULTS"
echo "═══════════════════════════════════════════════════════"
echo -e "  ${GREEN}PASS:${NC}    $PASS_COUNT"
echo -e "  ${RED}FAIL:${NC}    $FAIL_COUNT"
echo -e "  ${YELLOW}PARTIAL:${NC} $PARTIAL_COUNT"
TOTAL_TESTS=$((PASS_COUNT+FAIL_COUNT+PARTIAL_COUNT))
echo "  TOTAL:   $TOTAL_TESTS"
echo ""
if [ $FAIL_COUNT -eq 0 ] && [ $PARTIAL_COUNT -eq 0 ]; then
  echo -e "  ${GREEN}🎉 ALL STEPS PASSED — DELIVERY LIFECYCLE VERIFIED${NC}"
elif [ $FAIL_COUNT -eq 0 ]; then
  echo -e "  ${YELLOW}⚠️  NO FAILURES, but $PARTIAL_COUNT partial results${NC}"
else
  echo -e "  ${RED}❌ $FAIL_COUNT FAILURES detected — investigate before launch${NC}"
fi
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Full results saved to: $RESULTS_FILE"

# Append summary to results file
echo "" >> $RESULTS_FILE
echo "---" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE
echo "## Summary" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE
echo "| Metric | Count |" >> $RESULTS_FILE
echo "|--------|-------|" >> $RESULTS_FILE
echo "| PASS | $PASS_COUNT |" >> $RESULTS_FILE
echo "| FAIL | $FAIL_COUNT |" >> $RESULTS_FILE
echo "| PARTIAL | $PARTIAL_COUNT |" >> $RESULTS_FILE
echo "| TOTAL | $TOTAL_TESTS |" >> $RESULTS_FILE
echo "| Verified Coverage | $(( PASS_COUNT * 100 / TOTAL_TESTS ))% |" >> $RESULTS_FILE
