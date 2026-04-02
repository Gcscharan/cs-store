# Preservation Property Tests Summary

## Task 2: Write Preservation Property Tests (BEFORE implementing fix)

**Status**: ✅ Tests Written and Ready for Execution  
**Test File**: `backend/tests/property/httpStatusCodePreservation.property.test.ts`  
**Date**: 2024

---

## Overview

Preservation property tests have been created following the observation-first methodology specified in the design document. These tests capture the CURRENT behavior on UNFIXED code for non-buggy inputs to ensure that the fix does not introduce regressions.

---

## Test Coverage

### Property 2.1: OTP Authentication Returns HTTP 200 on Success
**Requirements**: 3.1

Tests verify that OTP-based authentication flows continue to work correctly:
- ✅ OTP verification in login mode returns HTTP 200 with tokens
- ✅ OTP verification in signup mode returns HTTP 200 and creates new user
- ✅ Email-based OTP verification returns HTTP 200 with tokens

**Test Strategy**: Creates test users and OTP records, verifies successful authentication returns HTTP 200 with access tokens and refresh tokens.

---

### Property 2.2: Google OAuth Authentication Returns HTTP 200 on Success
**Requirements**: 3.1

Tests verify that OAuth flows continue to work correctly:
- ✅ Google mobile auth endpoint structure and error handling
- ✅ Endpoint does NOT return HTTP 410 (Gone)
- ✅ Valid OAuth responses are 200, 400, 401, 500, or 503

**Test Strategy**: Tests OAuth endpoint behavior and ensures it never returns HTTP 410.

---

### Property 2.3: Protected Endpoints Without Auth Return HTTP 401
**Requirements**: 3.2

Tests verify that authentication middleware continues to work correctly:
- ✅ Protected endpoints return HTTP 401 without authentication
- ✅ Invalid/expired tokens return HTTP 401
- ✅ Endpoints tested: /api/user/me, /api/cart/add, /api/orders, /api/auth/logout

**Test Strategy**: Attempts to access protected endpoints without authentication or with invalid tokens, verifies HTTP 401 response.

---

### Property 2.4: Non-Existent Routes Return HTTP 404
**Requirements**: 3.4

Tests verify that 404 handling continues to work correctly:
- ✅ Non-existent routes return HTTP 404
- ✅ Non-existent user lookup returns HTTP 404
- ✅ Property-based testing with multiple non-existent paths

**Test Strategy**: Uses fast-check to generate various non-existent paths and verifies HTTP 404 response.

---

### Property 2.5: Malformed Requests Return HTTP 400
**Requirements**: 3.5

Tests verify that input validation continues to work correctly:
- ✅ Missing required fields return HTTP 400
- ✅ Invalid phone format returns HTTP 400
- ✅ Invalid OTP attempts return HTTP 400

**Test Strategy**: Sends requests with missing or invalid data, verifies HTTP 400 response.

---

### Property 2.6: GET /api/health Returns Current Response Format
**Requirements**: 3.7

Tests verify that the /api/health endpoint continues to work correctly:
- ✅ Returns HTTP 200 with status "ok"
- ✅ Includes timestamp field
- ✅ Consistent response format across multiple requests

**Test Strategy**: Makes multiple requests to /api/health and verifies consistent response format.

---

### Property 2.7: Authenticated Endpoints Work Correctly
**Requirements**: 3.1, 3.2

Tests verify that authenticated requests continue to work correctly:
- ✅ /api/user/me returns HTTP 200 with user data
- ✅ /api/auth/logout returns HTTP 200 for authenticated users

**Test Strategy**: Creates test users, generates auth tokens, and verifies authenticated requests work correctly.

---

### Property 2.8: Token Refresh Works Correctly
**Requirements**: 3.1

Tests verify that token refresh continues to work correctly:
- ✅ Valid refresh token returns HTTP 200 with new tokens

**Test Strategy**: Generates refresh tokens and verifies token refresh endpoint returns new access tokens.

---

### Property 2.9: Other HTTP Status Codes Preserved
**Requirements**: 3.2, 3.3, 3.4, 3.5, 3.6

Tests verify that various HTTP status codes continue to work correctly:
- ✅ HTTP 400 for missing OTP field
- ✅ HTTP 404 for non-existent routes
- ✅ HTTP 401 for unauthorized access
- ✅ HTTP 200 for health check
- ✅ Never returns HTTP 410 for these cases

**Test Strategy**: Tests multiple scenarios and verifies appropriate status codes are returned.

---

## Test Implementation Details

### Framework
- **Testing Library**: Jest with Supertest
- **Property-Based Testing**: fast-check
- **Test App**: Uses `createTestApp()` helper with disabled queues/Redis for faster execution

### Test Structure
```typescript
describe("Preservation: Non-Password Authentication and Other Endpoints", () => {
  describe("Property 2: [Specific Property]", () => {
    it("should [expected behavior]", async () => {
      // Test implementation
    });
  });
});
```

### Key Features
1. **Observation-First Methodology**: Tests capture current behavior on unfixed code
2. **Property-Based Testing**: Uses fast-check for generating test cases
3. **Comprehensive Coverage**: Tests all preservation requirements (3.1-3.7)
4. **Isolation**: Uses test app with disabled external dependencies
5. **Clear Assertions**: Each test has clear expected outcomes

---

## Expected Outcomes

### On UNFIXED Code (Current State)
**Expected**: All tests PASS ✅

These tests capture the baseline behavior that must be preserved. They should pass on the current (unfixed) code because they test functionality that is NOT affected by the bug.

### After Fix Implementation
**Expected**: All tests STILL PASS ✅

After implementing the fix for HTTP status codes, these tests should continue to pass, confirming that no regressions were introduced.

---

## Test Execution

### Running the Tests
```bash
# Run preservation tests only
npm test tests/property/httpStatusCodePreservation.property.test.ts

# Run with coverage
npm test tests/property/httpStatusCodePreservation.property.test.ts -- --coverage

# Run in CI mode
npm run test:ci -- tests/property/httpStatusCodePreservation.property.test.ts
```

### Test Environment
- **Database**: MongoDB Memory Server (in-memory)
- **External Services**: Mocked (Redis, Razorpay, Twilio, etc.)
- **Authentication**: Real JWT tokens with test secrets
- **OTP**: Mock mode enabled (MOCK_OTP=true)

---

## Validation Checklist

- [x] Tests written following observation-first methodology
- [x] All preservation requirements (3.1-3.7) covered
- [x] Property-based testing used where appropriate
- [x] Tests use lightweight test app (no queues/Redis)
- [x] Clear expected outcomes documented
- [x] Tests ready for execution on unfixed code

---

## Next Steps

1. **Execute Tests on Unfixed Code**: Run the preservation tests to verify they pass on the current codebase
2. **Document Baseline Behavior**: Capture test results as baseline
3. **Implement Fix**: Proceed with Task 3 (Fix HTTP status codes)
4. **Re-run Tests**: Verify preservation tests still pass after fix
5. **Confirm No Regressions**: Ensure all baseline behaviors are preserved

---

## Notes

- Tests are designed to be independent and can run in any order
- Each test cleans up after itself (database cleared between tests)
- Tests use realistic data and scenarios
- Property-based tests use limited runs (20) for faster execution in development
- CI mode increases runs to 1000 for more thorough testing

