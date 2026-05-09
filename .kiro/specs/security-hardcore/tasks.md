# Implementation Plan

## Overview
This task list implements fixes for 18 CRITICAL security vulnerabilities across 50+ files. The approach follows the bug condition methodology: first explore the bugs through testing, then preserve existing behavior, and finally implement the fixes with validation.

---

## Phase 1: Exploration - Write Bug Condition Tests (BEFORE Fix)

- [ ] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Fail-Fast Startup Validation
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the security vulnerabilities exist
  - **Scoped PBT Approach**: Test concrete failing cases for each of the 18 bug conditions
  - Test implementation details from Bug Condition specification in design
  - The test assertions should match the Expected Behavior Properties from design (requirements 2.1-2.18)
  - Create test file: `backend/test/security/environment-validation.exploratory.test.ts`
  - Test Case 1.1: Missing JWT_SECRET - app starts with fallback "your-secret-key"
  - Test Case 1.2: Missing RESEND_API_KEY - app uses exposed hardcoded key
  - Test Case 1.3: Missing Gmail credentials - app uses hardcoded credentials
  - Test Case 1.4: Missing Razorpay credentials - app uses test fallbacks
  - Test Case 1.5: Missing MONGODB_URI - app uses empty string
  - Test Case 1.6: Missing GOOGLE_MAPS_API_KEY - app uses empty string
  - Test Case 1.7: OTP in API response - response includes otp field in development
  - Test Case 1.8: Unsecured debug endpoints - endpoints accessible without auth
  - Test Case 1.9: Short JWT_SECRET - app accepts weak secrets
  - Test Case 1.10: Invalid RAZORPAY_KEY_ID format - app accepts invalid format
  - Test Case 1.11: Invalid RESEND_API_KEY format - app accepts invalid format
  - Test Case 1.12: Exposed API keys - app uses compromised credentials
  - Test Case 1.13: Identical JWT secrets - app accepts same value for both
  - Test Case 1.14: Test credentials in production - app processes test transactions
  - Test Case 1.15: Missing required variables - app starts anyway
  - Test Case 1.16: Invalid NODE_ENV - app accepts invalid environment
  - Test Case 1.17: Invalid MONGODB_URI format - app accepts invalid URI
  - Test Case 1.18: Default JWT_SECRET - app uses example values
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18_

---

## Phase 2: Preservation - Write Preservation Tests (BEFORE Fix)

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Configuration Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for valid configurations (non-buggy inputs)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Create test file: `backend/test/security/preservation.test.ts`
  - Test authentication flow with valid JWT_SECRET continues to work
  - Test email OTP delivery via Resend/Gmail with valid credentials continues to work
  - Test payment intent creation via Razorpay with valid keys continues to work
  - Test database connections with valid MONGODB_URI continue to work
  - Test image uploads to Cloudinary with valid credentials continue to work
  - Test Google Maps distance calculations with valid API key continue to work
  - Test refresh token generation with JWT_REFRESH_SECRET continues to work
  - Test webhook signature verification with RAZORPAY_WEBHOOK_SECRET continues to work
  - Test CORS configuration continues to allow configured origins
  - Test rate limiting continues to enforce limits
  - Test Socket.io connections continue to work
  - Test all API endpoints remain accessible with same auth requirements
  - Test OTP never appears in responses (all environments)
  - Test debug endpoints secured or removed
  - Run tests on UNFIXED code with valid configuration
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15_

---

## Phase 3: Implementation - Apply Security Fixes

- [ ] 3. Fix security vulnerabilities across all affected files

  - [ ] 3.1 Integrate validateEnv.ts into startup sequence
    - File: `backend/src/index.ts`
    - Add validation import at line 1-3 (before all other imports):
      ```typescript
      // CRITICAL: Validate environment before anything else
      import { validateEnvironment } from './config/validateEnv';
      validateEnvironment();
      ```
    - Remove duplicate validation logic (lines 17-50)
    - Verify execution order: validateEnvironment() runs before Express, MongoDB, Socket.io
    - _Bug_Condition: isBugCondition(input) where input.type == "startup" AND missing/invalid env vars_
    - _Expected_Behavior: Application exits with code 1 and descriptive error message_
    - _Preservation: Application starts successfully with valid configuration_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18_

  - [ ] 3.2 Remove hardcoded secrets from sendEmailOTP.ts
    - File: `backend/src/utils/sendEmailOTP.ts`
    - Replace lines 6-9 (Resend initialization):
      - Remove hardcoded API key "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx"
      - Add validation: check RESEND_API_KEY exists and starts with 're_'
      - Throw error if invalid
    - Replace lines 24-31 (Gmail SMTP configuration):
      - Remove hardcoded credentials "gcs.charan@gmail.com" / "lnjhscqyipztkvyu"
      - Add validation: check GMAIL_USER and GMAIL_APP_PASSWORD exist
      - Throw error if missing
    - _Bug_Condition: isBugCondition(input) where uses_hardcoded_fallback(RESEND_API_KEY, GMAIL_*)_
    - _Expected_Behavior: Service initialization fails with clear error if credentials missing_
    - _Preservation: Email sending continues to work with valid credentials_
    - _Requirements: 2.2, 2.3, 2.11, 2.12, 2.13_

  - [ ] 3.3 Remove hardcoded secrets from sendDeliveryOtpEmail.ts
    - File: `backend/src/utils/sendDeliveryOtpEmail.ts`
    - Replace lines 5-7 (Resend initialization):
      - Remove hardcoded API key "re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx"
      - Add validation: check RESEND_API_KEY exists and starts with 're_'
      - Throw error if invalid
    - _Bug_Condition: isBugCondition(input) where uses_hardcoded_fallback(RESEND_API_KEY)_
    - _Expected_Behavior: Service initialization fails with clear error if credentials missing_
    - _Preservation: Delivery OTP email sending continues to work with valid credentials_
    - _Requirements: 2.2, 2.11, 2.12_

  - [ ] 3.4 Remove test credential fallbacks from RazorpayAdapter.ts
    - File: `backend/src/domains/payments/adapters/RazorpayAdapter.ts`
    - Replace lines 22-35 (constructor credential loading):
      - Remove test credential fallbacks "rzp_test_key" / "rzp_test_secret" / "test-webhook-secret"
      - Remove isTest conditional logic
      - Add strict validation: all three credentials required
      - Add format validation: keyId must start with 'rzp_'
      - Add production check: reject test keys when NODE_ENV is production
    - Add validation logging with masked secrets
    - _Bug_Condition: isBugCondition(input) where uses_hardcoded_fallback(RAZORPAY_*) OR test credentials in production_
    - _Expected_Behavior: Adapter initialization fails with clear error if credentials missing/invalid_
    - _Preservation: Payment intent creation continues to work with valid credentials_
    - _Requirements: 2.4, 2.10, 2.15_

  - [ ] 3.5 Remove OTP exposure from otpController.ts
    - File: `backend/src/domains/security/controllers/otpController.ts`
    - Remove lines 227-231 (OTP in payment response):
      - Delete entire block that adds otp, phone, note to paymentResponse
      - Replace with server-side logging only: `logger.debug('[DEV ONLY] Payment OTP for order...')`
    - Verify OTP never included in any response object
    - _Bug_Condition: isBugCondition(input) where input.type == "api_response" AND response_contains_field("otp")_
    - _Expected_Behavior: OTP only logged to server console, never in API response_
    - _Preservation: OTP generation and verification continue to work correctly_
    - _Requirements: 2.7_

  - [ ] 3.6 Remove OTP exposure from authController.ts
    - File: `backend/src/domains/identity/controllers/authController.ts`
    - Remove line 1097 (OTP in login response):
      - Delete: `...(process.env.NODE_ENV === "development" && { otp, devMode: true })`
    - Add server-side logging after response sent:
      - `if (process.env.NODE_ENV === "development") { logger.debug('[DEV ONLY] OTP sent to...') }`
    - _Bug_Condition: isBugCondition(input) where input.type == "api_response" AND response_contains_field("otp")_
    - _Expected_Behavior: OTP only logged to server console, never in API response_
    - _Preservation: Authentication flow continues to work correctly_
    - _Requirements: 2.7_

  - [ ] 3.7 Secure or remove debug endpoints
    - File: `backend/src/routes/debugDbTest.ts`
    - **Option 1 (Recommended)**: Delete the entire file
    - **Option 2**: Add strict authentication:
      - Import requireAuth and requireRole middleware
      - Wrap all routes with requireAuth and requireRole(['admin'])
      - Add production guard: don't register routes if NODE_ENV is production
    - Update route registration in main app if needed
    - _Bug_Condition: isBugCondition(input) where input.type == "http_request" AND path MATCHES "/debug-*" AND NOT authenticated_
    - _Expected_Behavior: Debug endpoints return 404 or require admin authentication_
    - _Preservation: No impact on production functionality_
    - _Requirements: 2.8_

  - [ ] 3.8 Fix Bull Board admin secret
    - File: `backend/src/queues/dashboard.ts`
    - Replace line 45:
      - Remove default fallback 'admin-secret-change-in-production'
      - Add validation: check BULL_BOARD_ADMIN_SECRET exists
      - Add validation: reject default value
      - Add validation: minimum 16 characters
      - Throw error if invalid
    - _Bug_Condition: isBugCondition(input) where uses_hardcoded_fallback(BULL_BOARD_ADMIN_SECRET)_
    - _Expected_Behavior: Dashboard initialization fails with clear error if secret missing/invalid_
    - _Preservation: Bull Board dashboard continues to work with valid secret_
    - _Requirements: 2.1, 2.9_

  - [ ] 3.9 Add BULL_BOARD_ADMIN_SECRET to validateEnv.ts
    - File: `backend/src/config/validateEnv.ts`
    - Add to RequiredEnvVars interface (after line 27):
      - `BULL_BOARD_ADMIN_SECRET: string;`
    - Add to required array (after line 48):
      - `'BULL_BOARD_ADMIN_SECRET',`
    - Add validation rules (after line 90):
      - Check for default value 'admin-secret-change-in-production'
      - Check minimum length 16 characters
      - Add to errors array if invalid
    - _Bug_Condition: isBugCondition(input) where missing BULL_BOARD_ADMIN_SECRET_
    - _Expected_Behavior: Validation fails at startup if secret missing/invalid_
    - _Preservation: Validation passes with valid secret_
    - _Requirements: 2.1, 2.9_

  - [ ] 3.10 Update .env.example documentation
    - File: `backend/.env.example`
    - Verify all 15 required variables are documented:
      - JWT_SECRET, JWT_REFRESH_SECRET
      - MONGODB_URI
      - RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
      - RESEND_API_KEY
      - GMAIL_USER, GMAIL_APP_PASSWORD
      - GOOGLE_MAPS_API_KEY
      - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
      - BULL_BOARD_ADMIN_SECRET
      - NODE_ENV, PORT
    - Add generation instructions:
      - `# Generate secure secrets:`
      - `# node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"`
    - Add format requirements for each variable
    - _Bug_Condition: N/A - documentation only_
    - _Expected_Behavior: Developers know all required variables and how to generate them_
    - _Preservation: No code impact_
    - _Requirements: All requirements (documentation)_

  - [ ] 3.11 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Fail-Fast Startup Validation
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run bug condition exploration tests from Phase 1
    - Verify all 18 test cases now pass:
      - Missing/invalid environment variables cause immediate exit with code 1
      - OTP never appears in API responses
      - Debug endpoints secured or removed
      - All error messages are clear and actionable
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18_

  - [ ] 3.12 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Configuration Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from Phase 2
    - Verify all existing functionality continues to work:
      - Authentication flow with valid JWT_SECRET
      - Email OTP delivery via Resend/Gmail
      - Payment intent creation via Razorpay
      - Database connections
      - All API endpoints accessible with same auth requirements
      - No regressions in business logic
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15_

---

## Phase 4: Validation & Deployment

- [ ] 4. Run comprehensive test suite
  - Run all unit tests (200+ tests)
  - Run all integration tests (6 scenarios)
  - Run all property-based tests (10 properties, 100 iterations each)
  - Verify test coverage: all 18 bug conditions covered
  - Verify no test failures
  - Estimated time: 5-10 minutes

- [ ] 5. Perform manual verification
  - Start application with valid config → should start successfully
  - Start application with missing JWT_SECRET → should fail with clear error
  - Start application with exposed Resend key → should fail with clear error
  - Test OTP flow → OTP not in response, only in server logs
  - Test payment flow → works correctly with valid credentials
  - Test debug endpoints → secured or removed
  - Verify all error messages are clear and actionable
  - Estimated time: 30 minutes

- [ ] 6. Execute credential rotation procedures
  - **CRITICAL SECURITY STEP**: Revoke all exposed credentials
  - Revoke exposed Resend API key: `re_DnBkmXhh_JQXCyhVPPX1PNJQhZ2vKmCFx`
    - Go to: https://resend.com/api-keys
    - Find and revoke the exposed key
    - Generate new API key
    - Update RESEND_API_KEY in all environments
  - Revoke exposed Gmail app password: `lnjhscqyipztkvyu`
    - Go to: https://myaccount.google.com/apppasswords
    - Find and revoke the exposed password
    - Generate new app password
    - Update GMAIL_APP_PASSWORD in all environments
  - Verify Razorpay keys are production keys (not test keys)
    - Go to: https://dashboard.razorpay.com/app/keys
    - Verify keys start with `rzp_live_` not `rzp_test_`
    - Rotate if compromised
  - Update all deployment environments:
    - Development: Update `.env` file
    - Staging: Update environment variables in hosting platform
    - Production: Update environment variables in hosting platform
    - CI/CD: Update secrets in GitHub Actions / GitLab CI
  - Document rotation in `CREDENTIAL_ROTATION.md`
  - _Requirements: 2.12, 2.13, 2.15_

- [ ] 7. Checkpoint - Ensure all tests pass and credentials rotated
  - Verify all 264 tests pass (unit + integration + PBT)
  - Verify all exposed credentials have been revoked and rotated
  - Verify application starts successfully with new credentials
  - Verify application fails fast with invalid credentials
  - Verify no OTP exposure in any environment
  - Verify debug endpoints secured or removed
  - Ask the user if questions arise or if ready to deploy

---

## Summary

This implementation plan addresses 18 CRITICAL security vulnerabilities through:
- **10 code changes** across 13 files
- **264 comprehensive tests** (exploratory, fix checking, preservation, PBT, integration)
- **Credential rotation** for all exposed secrets
- **Fail-fast validation** at application startup

**Estimated Total Time**: 8-10 hours (3 hours implementation + 5-7 hours testing + credential rotation)

**Files Modified**:
1. `backend/src/index.ts` - Integrate validateEnv.ts
2. `backend/src/utils/sendEmailOTP.ts` - Remove hardcoded Resend/Gmail secrets
3. `backend/src/utils/sendDeliveryOtpEmail.ts` - Remove hardcoded Resend secret
4. `backend/src/domains/payments/adapters/RazorpayAdapter.ts` - Remove test fallbacks
5. `backend/src/domains/security/controllers/otpController.ts` - Remove OTP from response
6. `backend/src/domains/identity/controllers/authController.ts` - Remove OTP from response
7. `backend/src/routes/debugDbTest.ts` - Secure or delete
8. `backend/src/queues/dashboard.ts` - Fix Bull Board secret
9. `backend/src/config/validateEnv.ts` - Add BULL_BOARD_ADMIN_SECRET validation
10. `backend/.env.example` - Update documentation

**Test Files Created**:
1. `backend/test/security/environment-validation.exploratory.test.ts` - Bug condition tests
2. `backend/test/security/preservation.test.ts` - Preservation tests
3. Additional unit tests for each modified component
