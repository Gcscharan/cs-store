# Bugfix Requirements Document

## Introduction

The authentication and security systems are incorrectly returning HTTP 410 (Gone) status codes where standard 4xx codes should be used. This affects 90 failing tests out of 889 total (~89.8% pass rate) and represents a critical production readiness issue. HTTP 410 is semantically incorrect for these scenarios - it indicates a resource that once existed but has been permanently removed, which is not the case for authentication failures or security rejections.

The root cause is that password-based login has been intentionally disabled in favor of OTP and OAuth, but the implementation returns HTTP 410 (Gone) instead of a more appropriate status code like 401 (Unauthorized) or 400 (Bad Request). This breaks existing tests and violates HTTP semantics.

Additionally, there is a health check contract mismatch where the endpoint returns `"healthy"` but tests expect `"ok"`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a client attempts password-based login via POST /api/auth/login THEN the system returns HTTP 410 (Gone) with error "PASSWORD_LOGIN_DISABLED"

1.2 WHEN a client sends NoSQL injection payloads to POST /api/auth/login THEN the system returns HTTP 410 (Gone) instead of standard security rejection codes

1.3 WHEN a client attempts login with invalid credentials via POST /api/auth/login THEN the system returns HTTP 410 (Gone) instead of HTTP 400 (Bad Request)

1.4 WHEN a client requests GET /health THEN the system returns `{ status: "healthy" }` instead of `{ status: "ok" }`

### Expected Behavior (Correct)

2.1 WHEN a client attempts password-based login via POST /api/auth/login THEN the system SHALL return HTTP 401 (Unauthorized) with a clear message indicating password login is disabled and directing users to OTP or OAuth methods

2.2 WHEN a client sends NoSQL injection payloads to POST /api/auth/login THEN the system SHALL return one of the standard security rejection codes: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), or 404 (Not Found)

2.3 WHEN a client attempts login with invalid credentials via POST /api/auth/login THEN the system SHALL return HTTP 400 (Bad Request) with message "Invalid email or password"

2.4 WHEN a client requests GET /health THEN the system SHALL return `{ status: "ok" }` to match the test contract

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a client successfully authenticates via OTP or OAuth THEN the system SHALL CONTINUE TO return HTTP 200 (OK) with valid tokens

3.2 WHEN a client accesses protected endpoints without authentication THEN the system SHALL CONTINUE TO return HTTP 401 (Unauthorized)

3.3 WHEN a client accesses forbidden resources THEN the system SHALL CONTINUE TO return HTTP 403 (Forbidden)

3.4 WHEN a client requests non-existent routes THEN the system SHALL CONTINUE TO return HTTP 404 (Not Found)

3.5 WHEN a client sends malformed requests THEN the system SHALL CONTINUE TO return HTTP 400 (Bad Request)

3.6 WHEN the system encounters internal errors THEN the system SHALL CONTINUE TO return HTTP 500 (Internal Server Error)

3.7 WHEN a client requests GET /api/health THEN the system SHALL CONTINUE TO return its current response format
