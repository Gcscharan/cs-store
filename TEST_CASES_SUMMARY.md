# Production Test Cases Summary

**System**: Vyapara Setu E-Commerce Platform  
**Test Coverage**: Comprehensive  
**Total Estimated Test Cases**: ~6,500  
**Priority Distribution**: 60% P0, 30% P1, 10% P2

---

## Module Test Case Breakdown

| Module | P0 Cases | P1 Cases | P2 Cases | Total | Status |
|--------|----------|----------|----------|-------|--------|
| Authentication System | 180 | 120 | 50 | 350 | ⏳ |
| Address Management | 420 | 280 | 150 | 850 | 📝 In Progress |
| Shopping Cart | 200 | 150 | 50 | 400 | ⏳ |
| Checkout System | 250 | 180 | 70 | 500 | ⏳ |
| Payment System | 500 | 300 | 100 | 900 | 📝 In Progress |
| Order Management | 180 | 120 | 50 | 350 | ⏳ |
| Delivery Tracking | 120 | 100 | 30 | 250 | ⏳ |
| Notifications | 100 | 80 | 20 | 200 | ⏳ |
| Product Catalog | 150 | 100 | 50 | 300 | ⏳ |
| User Profile | 80 | 60 | 20 | 160 | ⏳ |
| **TOTAL** | **2,180** | **1,490** | **590** | **4,260** | |

---

## Critical Test Scenarios (Must Pass Before Production)

### 1. Address Management System - Critical Paths

#### GPS Detection (P0)
- ✅ GPS permission granted → location detected → reverse geocode → pincode validated → form pre-filled
- ✅ GPS accuracy check (warn if >100m)
- ✅ India bounds validation (reject if outside)
- ✅ Validation source tracking (GPS vs manual)
- ✅ Single API call for GPS pincode (no redundant calls)
- ✅ Scroll position preservation during form update
- ✅ Map display with correct marker position

#### Manual Pincode Entry (P0)
- ✅ 500ms debounce working correctly
- ✅ Validation source switches to "manual" on typing
- ✅ Only 6-digit numeric input accepted
- ✅ Deliverable pincode enables submit
- ✅ Non-deliverable pincode blocks submit
- ✅ City/state auto-fill on successful validation
- ✅ Error handling for API failures

#### Edge Cases (P0)
- ✅ GPS → Manual edit → Validation triggered correctly
- ✅ Rapid typing doesn't cause multiple API calls
- ✅ Network failure during validation shows retry option
- ✅ Pincode API timeout handled gracefully
- ✅ Invalid pincode format rejected
- ✅ Empty pincode blocks submission

#### Validation Logic (P0)
- ✅ Submit button disabled until: isResolved=true AND isDeliverable=true
- ✅ Validation status displayed correctly (checking/deliverable/not deliverable)
- ✅ Form validation prevents submission with invalid data
- ✅ GPS data never overwritten when pincode not deliverable

---

### 2. Payment System - Critical Paths

#### Web - Razorpay Flow (P0)
- ✅ Order created → Payment intent created → Razorpay SDK opens
- ✅ Payment success → Backend polling starts (NOT direct navigation)
- ✅ Backend polling checks `/orders/:id` every 3 seconds
- ✅ Navigation only after backend confirms paymentStatus="PAID"
- ✅ 120-second polling timeout with retry logic
- ✅ Payment failure → Show error → Allow retry (max 3 attempts)
- ✅ User cancels payment → Return to checkout → Preserve order
- ✅ Idempotency key prevents duplicate orders

#### Mobile - UPI Flow (P0)
- ✅ Order created → UPI deep link generated → App switch
- ✅ Return to app → Backend polling starts
- ✅ Backend polling via `getPaymentStatus` API
- ✅ Navigation only after backend confirms payment
- ✅ App state change (background→foreground) triggers status check
- ✅ Payment pending → Show status → Allow manual check
- ✅ Payment failure → Show error → Allow retry
- ✅ Multiple UPI apps supported (GPay, PhonePe, Paytm, etc.)

#### COD Flow (P0)
- ✅ Order created with paymentMethod="cod"
- ✅ No payment gateway interaction
- ✅ Direct navigation to success page
- ✅ Order status set correctly

#### Edge Cases (P0)
- ✅ Payment success but backend not updated → Poll until confirmed
- ✅ Polling timeout → Show "pending" status → Allow manual check
- ✅ Network failure during polling → Retry with exponential backoff
- ✅ Duplicate payment attempt → Idempotency prevents duplicate order
- ✅ Payment gateway down → Show error → Suggest COD
- ✅ User closes browser/app during payment → Resume on return

---

### 3. End-to-End Critical Flows

#### Happy Path - GPS + UPI (P0)
1. Login with OTP
2. Use GPS to detect address
3. Verify pincode validated once
4. Add products to cart
5. Navigate to checkout
6. Verify address pre-selected
7. Select UPI payment
8. Complete payment
9. Verify backend polling
10. Navigate to success only after backend confirms

**Expected**: Complete flow in <2 minutes, no errors

#### Happy Path - Manual + Razorpay (P0)
1. Login with OTP
2. Manually enter address
3. Verify pincode validation after 500ms debounce
4. Add products to cart
5. Navigate to checkout
6. Select card payment
7. Complete Razorpay payment
8. Verify backend polling
9. Navigate to success only after backend confirms

**Expected**: Complete flow in <2 minutes, no errors

#### Failure Recovery - Payment Retry (P0)
1. Complete checkout
2. Payment fails (simulate)
3. Verify error message shown
4. Click retry
5. Complete payment successfully
6. Verify order created correctly

**Expected**: Retry works, no duplicate orders

#### Edge Case - GPS Then Manual Edit (P0)
1. Use GPS detection
2. Verify pincode validated once (source="gps")
3. Manually edit pincode
4. Verify validation source switches to "manual"
5. Verify new validation triggered after 500ms
6. Verify only 2 total API calls (GPS + manual)

**Expected**: Validation source tracking works correctly

---

## Test Execution Strategy

### Phase 1: Smoke Tests (Day 1)
**Objective**: Verify basic functionality works

- [ ] Can login
- [ ] Can add address (GPS)
- [ ] Can add address (manual)
- [ ] Can add to cart
- [ ] Can checkout
- [ ] Can complete payment (test mode)
- [ ] Can view orders

**Exit Criteria**: All 7 smoke tests pass

---

### Phase 2: Critical Path Testing (Day 2-3)
**Objective**: Verify all P0 scenarios work

**Address Management** (120 P0 cases):
- [ ] GPS detection flows (40 cases)
- [ ] Manual entry flows (40 cases)
- [ ] Validation logic (40 cases)

**Payment System** (150 P0 cases):
- [ ] Web Razorpay flows (50 cases)
- [ ] Mobile UPI flows (50 cases)
- [ ] COD flows (20 cases)
- [ ] Edge cases (30 cases)

**Exit Criteria**: ≥95% P0 cases pass

---

### Phase 3: Edge Case Testing (Day 4-5)
**Objective**: Verify system handles edge cases

- [ ] Network failures
- [ ] API timeouts
- [ ] Invalid inputs
- [ ] Boundary conditions
- [ ] Race conditions
- [ ] Concurrent requests

**Exit Criteria**: ≥90% P1 cases pass

---

### Phase 4: Load Testing (Day 6)
**Objective**: Verify system handles load

- [ ] 100 concurrent users
- [ ] 1000 address validations/minute
- [ ] 500 payments/minute
- [ ] API response time <500ms (p95)
- [ ] No memory leaks
- [ ] No database deadlocks

**Exit Criteria**: All performance targets met

---

### Phase 5: End-to-End Testing (Day 7)
**Objective**: Verify complete user journeys

- [ ] Happy path (GPS + UPI)
- [ ] Happy path (Manual + Razorpay)
- [ ] Happy path (COD)
- [ ] Failure recovery flows
- [ ] Multi-device scenarios

**Exit Criteria**: All E2E flows complete successfully

---

## Automation Strategy

### Test Framework Stack

**Backend**:
- Jest for unit tests
- Supertest for API tests
- Artillery for load tests

**Web**:
- Playwright for E2E tests
- Jest for component tests
- Lighthouse for performance

**Mobile**:
- Detox for E2E tests
- Jest for component tests
- Maestro for UI tests

### CI/CD Integration

**GitHub Actions Workflow**:
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - Run Jest unit tests
      - Upload coverage report
  
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - Run API integration tests
      - Verify all endpoints
  
  e2e-web:
    runs-on: ubuntu-latest
    steps:
      - Run Playwright tests
      - Test critical flows
  
  e2e-mobile:
    runs-on: macos-latest
    steps:
      - Run Detox tests (iOS)
      - Run Detox tests (Android)
  
  load-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - Run Artillery load tests
      - Verify performance targets
```

### Test Parallelization

**Strategy**:
- Split tests into 10 parallel jobs
- Each job runs ~400-500 tests
- Total execution time: <15 minutes

**Sharding**:
```bash
# Job 1: Authentication tests
# Job 2: Address tests (GPS)
# Job 3: Address tests (Manual)
# Job 4: Cart tests
# Job 5: Checkout tests
# Job 6: Payment tests (Web)
# Job 7: Payment tests (Mobile)
# Job 8: Order tests
# Job 9: E2E tests
# Job 10: Load tests
```

---

## Test Data Management

### Test Pincodes

**Deliverable**:
- 560001 (Bangalore)
- 110001 (Delhi)
- 400001 (Mumbai)
- 600001 (Chennai)

**Non-Deliverable**:
- 999999 (Invalid)
- 000000 (Invalid)
- 123456 (Not in system)

### Test Users

**Valid**:
- +919876543210 (OTP: 123456 in test mode)
- +919876543211 (OTP: 123456 in test mode)

**Invalid**:
- +911234567890 (Blocked)
- +910000000000 (Invalid format)

### Test Payment Cards (Razorpay Test Mode)

**Success**:
- 4111 1111 1111 1111 (Visa)
- CVV: 123, Expiry: 12/25

**Failure**:
- 4000 0000 0000 0002 (Declined)

---

## Monitoring During Testing

### Metrics to Track

**Address Validation**:
- API call volume (target: ≤2 per entry)
- Validation success rate (target: ≥95%)
- Average validation time (target: <1s)

**Payment**:
- Payment success rate (target: ≥95%)
- Backend polling success rate (target: ≥98%)
- Average time to confirmation (target: <10s)

**System**:
- API response time p95 (target: <500ms)
- Error rate (target: <1%)
- Memory usage (target: stable)

### Alert Thresholds

**Critical** (Stop testing):
- Payment success rate <80%
- API error rate >10%
- System crash or hang

**Warning** (Investigate):
- Payment success rate 80-90%
- API error rate 5-10%
- Slow response times (>1s)

---

## Test Results Tracking

### Daily Test Report Template

```markdown
# Test Report - [Date]

## Summary
- Total Tests Run: X
- Passed: X (X%)
- Failed: X (X%)
- Skipped: X

## Critical Failures (P0)
1. [Module] Test Name - Reason
2. [Module] Test Name - Reason

## Metrics
- Address API Calls: X per entry (target: ≤2)
- Payment Success Rate: X% (target: ≥95%)
- Average Test Duration: Xm

## Action Items
- [ ] Fix critical failure #1
- [ ] Investigate slow tests
- [ ] Update test data

## Next Steps
- Continue with Phase X
- Focus on [Module]
```

---

## Production Readiness Checklist

### Test Coverage
- [ ] ≥95% P0 tests passing
- [ ] ≥90% P1 tests passing
- [ ] All E2E flows complete
- [ ] Load tests pass
- [ ] No critical bugs

### Metrics
- [ ] Address API calls ≤2 per entry
- [ ] Payment success rate ≥95%
- [ ] API response time <500ms (p95)
- [ ] Error rate <1%

### Documentation
- [ ] Test cases documented
- [ ] Known issues documented
- [ ] Rollback plan tested
- [ ] Monitoring configured

### Sign-off
- [ ] QA Lead approval
- [ ] Engineering Lead approval
- [ ] Product Manager approval

---

**When all checkboxes are ✅, system is PRODUCTION READY.**
