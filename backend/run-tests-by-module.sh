#!/bin/bash

# Script to run tests by module and collect results

echo "=========================================="
echo "Running Backend Tests by Module"
echo "=========================================="
echo ""

# Test directories
MODULES=(
  "tests/security"
  "tests/auth"
  "tests/integration"
  "tests/unit"
  "tests/payment"
  "tests/property"
  "tests/chaos"
  "tests/address"
  "tests/abuse"
  "tests/stress"
  "tests/e2e"
  "src/domains/identity/__tests__"
  "src/services/__tests__"
)

RESULTS_FILE="test-results-summary.txt"
> "$RESULTS_FILE"

for module in "${MODULES[@]}"; do
  if [ -d "$module" ] || [ -f "$module" ]; then
    echo "=========================================="
    echo "Module: $module"
    echo "=========================================="
    
    # Run tests for this module with timeout
    npm test -- --testPathPattern="$module" --no-coverage --silent 2>&1 | grep -E "(PASS|FAIL|Test Suites:|Tests:)" | tail -5
    
    echo ""
    echo "Completed: $module"
    echo ""
  fi
done

echo "=========================================="
echo "Test run complete"
echo "=========================================="
