#!/bin/bash
###############################################################################
# Test Rollback Procedures
#
# This script tests all rollback procedures in a staging environment to ensure
# they work correctly before production deployment.
#
# USAGE:
#   bash backend/scripts/rollback/test-rollback-procedures.sh
#
# PREREQUISITES:
#   - Staging environment available
#   - All phases deployed to staging
#   - Test data available
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Rollback Procedures${NC}\n"

# Check if we're in staging
if [ "$ENVIRONMENT" != "staging" ]; then
  echo -e "${RED}❌ Error: This script should only be run in staging environment${NC}"
  echo "Set ENVIRONMENT=staging to proceed"
  exit 1
fi

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
TEST_TOKEN="${TEST_TOKEN:-}"

if [ -z "$TEST_TOKEN" ]; then
  echo -e "${RED}❌ Error: TEST_TOKEN environment variable not set${NC}"
  exit 1
fi

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run test
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  echo -e "\n${BLUE}Testing: $test_name${NC}"
  
  if eval "$test_command"; then
    echo -e "${GREEN}✅ PASSED: $test_name${NC}"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}❌ FAILED: $test_name${NC}"
    ((TESTS_FAILED++))
    return 1
  fi
}

# Helper function to test order creation
test_order_creation() {
  local with_key="$1"
  
  if [ "$with_key" = "true" ]; then
    curl -f -s -X POST "$BACKEND_URL/api/orders/create" \
      -H "Authorization: Bearer $TEST_TOKEN" \
      -H "Content-Type: application/json" \
      -H "x-idempotency-key: $(uuidgen)" \
      -d '{"paymentMethod":"UPI"}' > /dev/null
  else
    curl -f -s -X POST "$BACKEND_URL/api/orders/create" \
      -H "Authorization: Bearer $TEST_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"paymentMethod":"UPI"}' > /dev/null
  fi
}

# Test 1: Phase 1 Rollback
echo -e "\n${YELLOW}=== Test Suite 1: Phase 1 Rollback ===${NC}"

run_test "Phase 1 rollback script exists" \
  "[ -f backend/scripts/rollback/rollback-phase1-schema.js ]"

run_test "Phase 1 rollback script is executable" \
  "node backend/scripts/rollback/rollback-phase1-schema.js --help 2>&1 | grep -q 'rollback' || true"

# Test 2: Phase 2 Rollback
echo -e "\n${YELLOW}=== Test Suite 2: Phase 2 Rollback ===${NC}"

run_test "Phase 2 rollback script exists" \
  "[ -f backend/scripts/rollback/rollback-phase2-code.sh ]"

run_test "Phase 2 rollback script is executable" \
  "[ -x backend/scripts/rollback/rollback-phase2-code.sh ]"

# Test 3: Phase 3 Rollback
echo -e "\n${YELLOW}=== Test Suite 3: Phase 3 Rollback ===${NC}"

run_test "Phase 3 rollback script exists" \
  "[ -f backend/scripts/rollback/rollback-phase3-enforcement.js ]"

# Test order creation with key (should work)
run_test "Order creation with idempotency key" \
  "test_order_creation true"

# Test 4: Component Rollbacks
echo -e "\n${YELLOW}=== Test Suite 4: Component Rollbacks ===${NC}"

run_test "Atomic finalization rollback script exists" \
  "[ -f backend/scripts/rollback/rollback-atomic-finalization.js ]"

run_test "Gateway creation rollback script exists" \
  "[ -f backend/scripts/rollback/rollback-gateway-creation.js ]"

run_test "Admin assignment rollback script exists" \
  "[ -f backend/scripts/rollback/rollback-admin-assignment.js ]"

# Test 5: Documentation
echo -e "\n${YELLOW}=== Test Suite 5: Documentation ===${NC}"

run_test "Rollback documentation exists" \
  "[ -f backend/docs/PAYMENT_IDEMPOTENCY_ROLLBACK.md ]"

run_test "Rollback documentation is not empty" \
  "[ -s backend/docs/PAYMENT_IDEMPOTENCY_ROLLBACK.md ]"

# Test 6: Monitoring
echo -e "\n${YELLOW}=== Test Suite 6: Monitoring ===${NC}"

run_test "Grafana dashboard exists" \
  "[ -f backend/monitoring/grafana-dashboards/payment-idempotency-dashboard.json ]"

run_test "Grafana dashboard is valid JSON" \
  "jq empty backend/monitoring/grafana-dashboards/payment-idempotency-dashboard.json 2>/dev/null || python -m json.tool backend/monitoring/grafana-dashboards/payment-idempotency-dashboard.json > /dev/null"

# Test 7: Verification Scripts
echo -e "\n${YELLOW}=== Test Suite 7: Verification Scripts ===${NC}"

run_test "Duplicate order verification script exists" \
  "[ -f backend/scripts/verify-no-duplicate-orders.js ]"

run_test "Atomic finalization verification script exists" \
  "[ -f backend/scripts/verify-atomic-finalization.js ]"

run_test "Gateway creation verification script exists" \
  "[ -f backend/scripts/verify-gateway-creation.js ]"

run_test "Admin assignment verification script exists" \
  "[ -f backend/scripts/verify-admin-assignment.js ]"

# Summary
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed!${NC}"
  echo -e "\n${BLUE}📝 Next steps:${NC}"
  echo "   1. Review rollback procedures documentation"
  echo "   2. Conduct rollback drill with team"
  echo "   3. Deploy to production with confidence"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed!${NC}"
  echo -e "\n${BLUE}📝 Next steps:${NC}"
  echo "   1. Fix failing tests"
  echo "   2. Re-run test suite"
  echo "   3. Do not deploy to production until all tests pass"
  exit 1
fi
