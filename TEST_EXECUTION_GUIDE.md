# Test Execution Guide

**Purpose**: Step-by-step guide to execute production test suite  
**Audience**: QA Engineers, Developers  
**Estimated Time**: 7 days for complete testing

---

## Quick Start

### Prerequisites
```bash
# Install dependencies
npm install

# Setup test environment
cp .env.test.example .env.test

# Start test database
docker-compose -f docker-compose.test.yml up -d

# Run smoke tests
npm run test:smoke
```

---

## Day 1: Smoke Testing

### Objective
Verify basic functionality works before deep testing

### Test Commands
```bash
# Backend smoke tests
cd backend
npm run test:smoke

# Web smoke tests
cd frontend
npm run test:smoke

# Mobile smoke tests
cd apps/customer-app
npm run test:smoke
```

### Manual Verification Checklist
- [ ] Can login with test phone number
- [ ] Can use GPS to detect address
- [ ] Can manually enter address
- [ ] Can add product to cart
- [ ] Can proceed to checkout
- [ ] Can complete test payment
- [ ] Can view order in history

### Success Criteria
✅ All 7 manual checks pass  
✅ All automated smoke tests pass  
✅ No critical errors in logs

**If any fail**: Stop and fix before proceeding

---

## Day 2-3: Address Management Testing

### Test Execution Order

#### Session 1: GPS Detection (2 hours)
```bash
npm run test:address:gps
```

**Focus Areas**:
- GPS permission handling
- Location detection accuracy
- Reverse geocoding
- Form pre-fill logic
- Validation source tracking

**Manual Tests**:
1. Use GPS on real device (iOS)
2. Use GPS on real device (Android)
3. Verify pincode validated exactly once
4. Check console logs for "PINCODE_VALIDATION" with source="gps"

**Success Criteria**:
- ✅ ≥95% automated tests pass
- ✅ GPS works on both platforms
- ✅ Only 1 API call per GPS detection
- ✅ Logs show correct validation source

---

#### Session 2: Manual Pincode Entry (2 hours)
```bash
npm run test:address:manual
```

**Focus Areas**:
- Debounce timing (500ms)
- Validation source switching
- Deliverable vs non-deliverable
- City/state auto-fill
- Error handling

**Manual Tests**:
1. Type pincode slowly (verify debounce)
2. Type pincode fast (verify single API call)
3. GPS → Manual edit (verify source switch)
4. Enter non-deliverable pincode (verify blocked)

**Success Criteria**:
- ✅ ≥95% automated tests pass
- ✅ Debounce works correctly
- ✅ Validation source switches on manual edit
- ✅ Non-deliverable blocks submission

---

#### Session 3: Edge Cases (2 hours)
```bash
npm run test:address:edge
```

**Focus Areas**:
- Network failures
- API timeouts
- Invalid inputs
- Boundary conditions
- Race conditions

**Manual Tests**:
1. Disconnect network during validation
2. Enter invalid pincode formats
3. Rapid typing test
4. GPS timeout simulation

**Success Criteria**:
- ✅ ≥90% automated tests pass
- ✅ All edge cases handled gracefully
- ✅ No crashes or hangs

---

#### Session 4: Integration Tests (2 hours)
```bash
npm run test:address:integration
```

**Focus Areas**:
- Address save/update/delete
- Default address management
- Backend sync
- Form validation

**Manual Tests**:
1. Save address after GPS detection
2. Edit existing address
3. Delete address
4. Set default address

**Success Criteria**:
- ✅ ≥95% automated tests pass
- ✅ All CRUD operations work
- ✅ Backend sync successful

---

### Day 2-3 Exit Criteria

**Must Pass**:
- [ ] All P0 address tests passing (≥95%)
- [ ] GPS detection works on real devices
- [ ] Manual entry works correctly
- [ ] API call volume ≤2 per address entry
- [ ] Validation source tracking works
- [ ] No critical bugs found

**Metrics to Verify**:
```bash
# Check API call volume
grep "PINCODE_VALIDATION" test.log | \
  jq -r '.pincode' | sort | uniq -c

# Expected: 1-2 calls per unique pincode
```

---

## Day 4-5: Payment System Testing

### Test Execution Order

#### Session 1: Web Razorpay Flow (3 hours)
```bash
npm run test:payment:web
```

**Focus Areas**:
- Order creation
- Payment intent creation
- Razorpay SDK integration
- Backend polling logic
- Success/failure handling

**Manual Tests**:
1. Complete payment with test card (success)
2. Complete payment with decline card (failure)
3. Cancel payment modal
4. Verify backend polling in network tab
5. Verify navigation only after backend confirms

**Critical Verification**:
```javascript
// In browser console during payment
// Should see polling requests every 3 seconds
// Should NOT navigate until paymentStatus="PAID"
```

**Success Criteria**:
- ✅ ≥95% automated tests pass
- ✅ Backend polling works correctly
- ✅ No direct navigation on client success
- ✅ Payment success rate ≥95% in tests

---

#### Session 2: Mobile UPI Flow (3 hours)
```bash
npm run test:payment:mobile
```

**Focus Areas**:
- Order creation
- UPI deep link generation
- App switching
- Backend polling on return
- Status checking

**Manual Tests**:
1. Complete UPI payment with GPay (success)
2. Complete UPI payment with PhonePe (success)
3. Cancel UPI payment
4. Background app during payment
5. Verify backend polling on app return

**Critical Verification**:
```bash
# Check mobile logs
adb logcat | grep "PAYMENT_STATUS"

# Should see:
# - status: "checking" when polling starts
# - status: "PAID" when confirmed
# - success: true on completion
```

**Success Criteria**:
- ✅ ≥95% automated tests pass
- ✅ UPI flow works on real devices
- ✅ Backend polling works correctly
- ✅ App state changes handled

---

#### Session 3: COD Flow (1 hour)
```bash
npm run test:payment:cod
```

**Focus Areas**:
- Order creation with COD
- Direct navigation (no payment)
- Order status correct

**Manual Tests**:
1. Complete checkout with COD
2. Verify order created correctly
3. Verify navigation to success page

**Success Criteria**:
- ✅ 100% automated tests pass
- ✅ COD orders created correctly

---

#### Session 4: Edge Cases & Failures (3 hours)
```bash
npm run test:payment:edge
```

**Focus Areas**:
- Payment gateway down
- Network failures during polling
- Polling timeout
- Duplicate payment attempts
- Idempotency

**Manual Tests**:
1. Simulate payment gateway timeout
2. Disconnect network during polling
3. Try duplicate payment (verify blocked)
4. Payment success but backend slow (verify polling)

**Success Criteria**:
- ✅ ≥90% automated tests pass
- ✅ All failure scenarios handled
- ✅ Idempotency prevents duplicates

---

### Day 4-5 Exit Criteria

**Must Pass**:
- [ ] All P0 payment tests passing (≥95%)
- [ ] Web Razorpay flow works
- [ ] Mobile UPI flow works
- [ ] COD flow works
- [ ] Backend polling verified
- [ ] No direct navigation on client success
- [ ] Payment success rate ≥95%

**Metrics to Verify**:
```bash
# Check payment success rate
grep "PAYMENT_STATUS" test.log | \
  jq -r 'select(.success == true)' | wc -l

# Should be ≥95% of total payment attempts
```

---

## Day 6: Load Testing

### Objective
Verify system handles production load

### Test Scenarios

#### Scenario 1: Address Validation Load
```bash
npm run test:load:address
```

**Configuration**:
- 100 concurrent users
- 1000 pincode validations/minute
- Duration: 10 minutes

**Success Criteria**:
- ✅ API response time <500ms (p95)
- ✅ Error rate <1%
- ✅ No memory leaks
- ✅ No database deadlocks

---

#### Scenario 2: Payment Processing Load
```bash
npm run test:load:payment
```

**Configuration**:
- 50 concurrent users
- 500 payments/minute
- Duration: 10 minutes

**Success Criteria**:
- ✅ Payment success rate ≥95%
- ✅ Backend polling works under load
- ✅ No duplicate orders
- ✅ Database transactions complete

---

#### Scenario 3: Full E2E Load
```bash
npm run test:load:e2e
```

**Configuration**:
- 200 concurrent users
- Complete user journeys
- Duration: 30 minutes

**Success Criteria**:
- ✅ Order completion rate ≥85%
- ✅ System remains stable
- ✅ No critical errors

---

## Day 7: End-to-End Testing

### Critical User Journeys

#### Journey 1: GPS + UPI Payment
```bash
npm run test:e2e:gps-upi
```

**Steps**:
1. Login
2. Use GPS to detect address
3. Verify pincode validated once
4. Add products to cart
5. Checkout
6. Select UPI payment
7. Complete payment
8. Verify backend polling
9. Navigate to success

**Success Criteria**:
- ✅ Complete flow in <2 minutes
- ✅ No errors
- ✅ Order created correctly

---

#### Journey 2: Manual + Razorpay Payment
```bash
npm run test:e2e:manual-razorpay
```

**Steps**:
1. Login
2. Manually enter address
3. Verify debounced validation
4. Add products to cart
5. Checkout
6. Select card payment
7. Complete Razorpay payment
8. Verify backend polling
9. Navigate to success

**Success Criteria**:
- ✅ Complete flow in <2 minutes
- ✅ No errors
- ✅ Order created correctly

---

#### Journey 3: COD Order
```bash
npm run test:e2e:cod
```

**Steps**:
1. Login
2. Add address
3. Add products to cart
4. Checkout
5. Select COD
6. Place order
7. Navigate to success

**Success Criteria**:
- ✅ Complete flow in <1 minute
- ✅ No errors
- ✅ Order created correctly

---

## Test Results Documentation

### Daily Report Template

Create file: `test-reports/YYYY-MM-DD.md`

```markdown
# Test Report - [Date]

## Summary
- Tests Run: X
- Passed: X (X%)
- Failed: X (X%)
- Duration: Xm

## Critical Failures
1. [Module] Test Name
   - Error: [Description]
   - Impact: [High/Medium/Low]
   - Action: [Fix plan]

## Metrics
- Address API Calls: X per entry
- Payment Success Rate: X%
- API Response Time (p95): Xms

## Blockers
- [ ] Issue #1
- [ ] Issue #2

## Next Steps
- Continue with Day X testing
- Fix critical failures
```

---

## Troubleshooting Guide

### Common Issues

#### Issue: Tests Timing Out
**Symptoms**: Tests hang or timeout
**Solution**:
```bash
# Increase timeout
npm run test -- --testTimeout=30000

# Check for hanging processes
ps aux | grep node
```

---

#### Issue: Flaky Tests
**Symptoms**: Tests pass/fail randomly
**Solution**:
- Add proper waits
- Check for race conditions
- Verify test data cleanup

---

#### Issue: Database Connection Errors
**Symptoms**: "Connection refused" errors
**Solution**:
```bash
# Restart test database
docker-compose -f docker-compose.test.yml restart

# Check database logs
docker-compose -f docker-compose.test.yml logs db
```

---

## Final Sign-Off

### Checklist Before Production

- [ ] All P0 tests passing (≥95%)
- [ ] All P1 tests passing (≥90%)
- [ ] Load tests passed
- [ ] E2E flows completed
- [ ] Metrics meet targets
- [ ] No critical bugs
- [ ] Test reports documented
- [ ] QA Lead sign-off
- [ ] Engineering Lead sign-off

### Sign-Off Form

```
Test Execution Complete: [Date]

QA Lead: _________________ Date: _______
Engineering Lead: _________ Date: _______
Product Manager: __________ Date: _______

Status: ✅ APPROVED FOR PRODUCTION
```

---

**System is production-ready when all sign-offs complete.** 🚀
