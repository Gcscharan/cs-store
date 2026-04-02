# HTTP Status Code Fix Design

## Overview

This bugfix addresses incorrect HTTP status code usage in the authentication system and health check endpoint. The system currently returns HTTP 410 (Gone) for password-based login attempts, which is semantically incorrect. HTTP 410 indicates a resource that once existed but has been permanently removed, whereas authentication failures should use standard 4xx codes like 401 (Unauthorized) or 400 (Bad Request).

The fix strategy is minimal and targeted:
1. Replace HTTP 410 with HTTP 401 for disabled password login (indicates authentication method not accepted)
2. Ensure invalid credentials return HTTP 400 (Bad Request) as expected by tests
3. Update health check endpoint to return `"ok"` instead of `"healthy"` to match test contracts

This approach maintains the intentional disabling of password-based authentication while using semantically correct HTTP status codes that align with REST API standards and existing test expectations.

## Glossary

- **Bug_Condition (C)**: The condition that triggers incorrect HTTP status codes - when password login is attempted or health check is requested
- **Property (P)**: The desired behavior - correct HTTP status codes (401, 400) and correct health check response ("ok")
- **Preservation**: All other authentication flows (OTP, OAuth) and endpoint behaviors must remain unchanged
- **login**: The function in `backend/src/domains/identity/controllers/authController.ts` that handles POST /api/auth/login requests
- **changePassword**: The function in `backend/src/domains/identity/controllers/authController.ts` that handles password change requests
- **Health Check**: The GET /health endpoint in `backend/src/createApp.ts` that returns system status

## Bug Details

### Bug Condition

The bug manifests when a client attempts password-based authentication or requests the health check endpoint. The authentication controller returns HTTP 410 (Gone) instead of standard authentication error codes, and the health check returns `"healthy"` instead of the expected `"ok"`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type HTTPRequest
  OUTPUT: boolean
  
  RETURN (input.method == 'POST' AND input.path == '/api/auth/login')
         OR (input.method == 'POST' AND input.path == '/api/auth/change-password')
         OR (input.method == 'GET' AND input.path == '/health')
END FUNCTION
```

### Examples

- **Password Login Attempt**: POST /api/auth/login with `{email: "user@example.com", password: "pass123"}` → Returns HTTP 410 with "PASSWORD_LOGIN_DISABLED" (should return HTTP 401)
- **Invalid Credentials**: POST /api/auth/login with `{email: "invalid@example.com", password: "wrong"}` → Returns HTTP 410 (should return HTTP 400 with "Invalid email or password")
- **NoSQL Injection Payload**: POST /api/auth/login with `{email: {$gt: ""}, password: {$ne: null}}` → Returns HTTP 410 (should return HTTP 400, 401, 403, or 404)
- **Health Check**: GET /health → Returns `{status: "healthy"}` (should return `{status: "ok"}`)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- OTP authentication flow must continue to work with HTTP 200 on success
- Google OAuth authentication must continue to work with HTTP 200 on success
- Protected endpoints without authentication must continue to return HTTP 401
- Forbidden resources must continue to return HTTP 403
- Non-existent routes must continue to return HTTP 404
- Malformed requests must continue to return HTTP 400
- Internal errors must continue to return HTTP 500
- GET /api/health endpoint must continue to return its current response format

**Scope:**
All inputs that do NOT involve password-based login attempts (POST /api/auth/login, POST /api/auth/change-password) or the main health check endpoint (GET /health) should be completely unaffected by this fix. This includes:
- All OTP-based authentication flows
- All OAuth-based authentication flows
- All other API endpoints and their status codes
- All middleware and error handling behavior

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Semantic Misuse of HTTP 410**: The developer chose HTTP 410 (Gone) to indicate that password login has been "permanently removed", interpreting the status code literally. However, HTTP 410 is meant for resources (URLs) that no longer exist, not for disabled authentication methods. The endpoint still exists and responds - it just doesn't accept password-based authentication.

2. **Incorrect Status Code for Disabled Feature**: When a feature is intentionally disabled, the correct approach is to return HTTP 401 (Unauthorized) with a message explaining which authentication methods are accepted, not HTTP 410 which implies the endpoint itself is gone.

3. **Health Check Contract Mismatch**: The health check endpoint returns `"healthy"` as the status value, but the test contract expects `"ok"`. This is a simple string mismatch between implementation and test expectations.

4. **Test Expectations Not Met**: The existing tests expect:
   - HTTP 400 for invalid credentials
   - HTTP 400, 401, 403, or 404 for security rejections (NoSQL injection)
   - `{status: "ok"}` for health checks
   
   But the current implementation returns HTTP 410 for all password login attempts, regardless of the reason for rejection.

## Correctness Properties

Property 1: Bug Condition - Correct HTTP Status Codes for Authentication

_For any_ HTTP request to POST /api/auth/login or POST /api/auth/change-password, the fixed function SHALL return HTTP 401 (Unauthorized) with a clear message indicating that password login is disabled and directing users to OTP or OAuth methods, not HTTP 410 (Gone).

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition - Correct Health Check Response

_For any_ HTTP request to GET /health, the fixed function SHALL return `{status: "ok"}` instead of `{status: "healthy"}`, matching the test contract expectations.

**Validates: Requirements 2.4**

Property 3: Preservation - Non-Password Authentication Flows

_For any_ HTTP request that uses OTP or OAuth authentication methods, the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing authentication flows and returning HTTP 200 on success.

**Validates: Requirements 3.1**

Property 4: Preservation - Other HTTP Status Codes

_For any_ HTTP request to endpoints other than password login or health check, the fixed code SHALL produce exactly the same HTTP status codes as the original code, preserving all existing error handling behavior.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `backend/src/domains/identity/controllers/authController.ts`

**Function 1**: `login`

**Specific Changes**:
1. **Replace HTTP 410 with HTTP 401**: Change `res.status(410)` to `res.status(401)`
   - Line 329: `return res.status(410).json({` → `return res.status(401).json({`
   - This correctly indicates that the authentication method is not accepted
   - The error message already explains that password login is disabled and directs users to OTP/OAuth

2. **Update Error Code**: Change error code to be more semantically correct
   - Keep "PASSWORD_LOGIN_DISABLED" as it clearly communicates the issue
   - The message already provides clear guidance on alternative authentication methods

**Function 2**: `changePassword`

**Specific Changes**:
1. **Replace HTTP 410 with HTTP 401**: Change `res.status(410)` to `res.status(401)`
   - Line 906: `return res.status(410).json({` → `return res.status(401).json({`
   - This correctly indicates that the password feature is not available

**File 2**: `backend/src/createApp.ts`

**Function**: Health check endpoint handler (GET /health)

**Specific Changes**:
1. **Update Status String**: Change `status: "healthy"` to `status: "ok"`
   - Line 95 (in the basic health check): `status: "healthy"` → `status: "ok"`
   - This matches the test contract expectations
   - Note: The conditional health check with queue information uses a variable `status` that can be 'healthy', 'degraded', or 'down' - this should remain unchanged as it's more detailed monitoring

2. **Clarification**: The GET /api/health endpoint already returns `{status: "ok"}` and should remain unchanged

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, verify that existing tests fail with HTTP 410 (confirming the bug), then verify that the fix makes all tests pass with correct HTTP status codes.

### Exploratory Bug Condition Checking

**Goal**: Confirm that the current implementation returns HTTP 410 and causes test failures. This validates our root cause analysis.

**Test Plan**: Run existing tests on the UNFIXED code to observe failures and confirm they expect HTTP 401/400 instead of HTTP 410.

**Test Cases**:
1. **Password Login Test**: POST /api/auth/login with valid format → Currently returns HTTP 410 (test expects HTTP 401 or 400)
2. **Invalid Credentials Test**: POST /api/auth/login with invalid credentials → Currently returns HTTP 410 (test expects HTTP 400)
3. **NoSQL Injection Test**: POST /api/auth/login with injection payloads → Currently returns HTTP 410 (test expects 400/401/403/404)
4. **Health Check Test**: GET /health → Currently returns `{status: "healthy"}` (test expects `{status: "ok"}`)

**Expected Counterexamples**:
- Tests fail because they receive HTTP 410 instead of expected 400/401
- Health check test fails because it receives "healthy" instead of "ok"
- Possible causes: Intentional use of HTTP 410 to indicate "permanently removed" feature, string mismatch in health check

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected HTTP status codes.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := handleRequest_fixed(request)
  IF request.path == '/api/auth/login' OR request.path == '/api/auth/change-password' THEN
    ASSERT response.status == 401
    ASSERT response.body.error IN ['PASSWORD_LOGIN_DISABLED', 'PASSWORD_FEATURE_DISABLED']
  ELSE IF request.path == '/health' THEN
    ASSERT response.body.status == 'ok'
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT handleRequest_original(request) = handleRequest_fixed(request)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Run existing test suite to verify that all non-password-login tests continue to pass with identical behavior.

**Test Cases**:
1. **OTP Authentication Preservation**: Verify OTP login flow returns HTTP 200 on success
2. **OAuth Authentication Preservation**: Verify Google OAuth flow returns HTTP 200 on success
3. **Protected Endpoints Preservation**: Verify unauthenticated requests return HTTP 401
4. **Other Status Codes Preservation**: Verify 403, 404, 500 codes continue to work correctly
5. **API Health Check Preservation**: Verify GET /api/health continues to return `{status: "ok"}`

### Unit Tests

- Test that POST /api/auth/login returns HTTP 401 with "PASSWORD_LOGIN_DISABLED" message
- Test that POST /api/auth/change-password returns HTTP 401 with "PASSWORD_FEATURE_DISABLED" message
- Test that GET /health returns `{status: "ok"}`
- Test that invalid credentials still trigger appropriate error handling (though now with HTTP 401 instead of 410)
- Test that NoSQL injection payloads are rejected with standard security codes (400/401/403/404)

### Property-Based Tests

- Generate random authentication requests and verify that password-based attempts return HTTP 401
- Generate random valid OTP/OAuth requests and verify they continue to return HTTP 200
- Generate random requests to other endpoints and verify status codes are unchanged
- Test that health check always returns `{status: "ok"}` regardless of system state (for basic check)

### Integration Tests

- Run full authentication flow with OTP and verify end-to-end behavior is unchanged
- Run full authentication flow with OAuth and verify end-to-end behavior is unchanged
- Test that password login attempts are properly rejected with HTTP 401 and clear messaging
- Test that health check monitoring continues to work correctly
- Verify that all 90 failing tests now pass after the fix
