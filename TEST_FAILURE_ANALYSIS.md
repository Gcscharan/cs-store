# Test Failure Analysis & Fix Plan

## Test Run Summary
- **Total Tests**: 913
- **Passed**: 871
- **Failed**: 42
- **Test Suites**: 94 (6 failed, 88 passed)

## Failure Categories

### 1. Timeout (1 test)
**File**: `backend/src/services/__tests__/cacheService.test.ts`
**Issue**: Property test exceeds 30s timeout
**Root Cause**: Test waits for TTL expiration (up to 600 seconds per iteration)
**Fix**: Reduce TTL in property test or increase timeout

### 2. GPS Detection (7 tests)
**File**: `backend/tests/address/gps-detection.test.ts`
**Issue**: All tests expect 201, receiving 400
**Root Cause**: Address validation failing - likely missing auth token or invalid pincode validation
**Tests Affected**:
- GPS detection with valid deliverable pincode
- GPS detection sets validation source to "gps"
- GPS accuracy <50m accepted without warning
- GPS accuracy 50-100m accepted with warning flag
- GPS detection with partial address data
- GPS permission denied handled gracefully
- Reverse geocoding timeout handled

### 3. Auth/Login Tests (4 tests)
**File**: `backend/tests/integration/basic.test.ts`, `backend/src/domains/identity/__tests__/auth.integration.test.ts`
**Issue**: Password login intentionally disabled, returns 401
**Root Cause**: Design decision - password login removed in favor of OTP/OAuth
**Current Behavior**: `login()` returns 401 with "PASSWORD_LOGIN_DISABLED"
**Tests Affected**:
- Should reject invalid login (expects 400, gets 401)
- Logs in with email (expects 200, gets 401)
- Logs in with phone (expects 200, gets 401)
- Logs in with identifier (expects 200, gets 401)

### 4. HTTP Status Preservation (10 tests)
**File**: `backend/tests/property/httpStatusCodePreservation.property.test.ts`
**Issues**:
- **Otp model undefined** (4 tests): `Cannot read properties of undefined (reading 'create')`
- **404 instead of 401** (2 tests): Protected endpoints return 404 instead of 401
- **404 instead of expected** (4 tests): Various endpoints return 404

**Tests Affected**:
- OTP verification tests (login/signup/email modes)
- Google OAuth mobile auth
- Protected endpoints without auth
- Invalid/expired tokens
- Non-existent user lookup
- Invalid OTP attempts
- Authenticated /api/user/me
- Other HTTP status codes

### 5. Mongoose Connection (20 tests)
**File**: `backend/src/__tests__/experimentHardening.validation.test.ts`
**Issue**: `Can't call openUri() on an active connection with different connection strings`
**Root Cause**: Test creates its own MongoMemoryServer while global setup already has one
**Fix**: Use existing mongoose connection from global setup

### 6. Jest Open Handles
**Issue**: "Jest did not exit one second after the test run has completed"
**Root Cause**: Async operations not cleaned up (mongoose connections, redis, timers)
**Fix**: Add proper cleanup in afterAll blocks

## Fix Strategy

### Priority 1: Auth Tests (Design Decision)
**Decision Required**: Is password login intentionally disabled?
- **If YES**: Update tests to expect 401 with "PASSWORD_LOGIN_DISABLED"
- **If NO**: Restore password login functionality

**Recommended**: Update tests to match current design (password login disabled)

### Priority 2: GPS Detection Tests
**Investigation Needed**:
1. Check if auth token is being passed correctly
2. Verify pincode validation logic
3. Check address creation endpoint requirements

### Priority 3: HTTP Status Preservation Tests
**Fixes**:
1. Fix Otp import: `import { Otp } from "../../src/models/Otp"` (not default export)
2. Fix route definitions to return correct status codes
3. Ensure protected endpoints return 401 (not 404)

### Priority 4: Mongoose Connection Test
**Fix**: Remove duplicate mongoose.connect() in test file, use global connection

### Priority 5: Cache Service Timeout
**Fix**: Either increase timeout or reduce TTL values in property test

### Priority 6: Jest Open Handles
**Fix**: Add cleanup in afterAll:
```typescript
afterAll(async () => {
  await mongoose.connection.close();
  if (redis) await redis.quit();
  if (server) await server.close();
});
```

## Execution Order
1. Fix auth tests (update expectations to 401)
2. Fix Otp import in HTTP status tests
3. Fix mongoose connection in experiment tests
4. Fix GPS detection tests (investigate root cause)
5. Fix cache service timeout
6. Add global cleanup for open handles

## Expected Outcome
- 0 unexpected failures
- 100% stable test suite
- No open handle warnings
- All tests respect system design decisions
