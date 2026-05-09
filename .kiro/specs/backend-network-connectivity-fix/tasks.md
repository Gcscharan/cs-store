# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Non-Blocking Health Check Failure
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that when health check fails (404, timeout, network error), the app renders ConnectivityErrorScreen and blocks RootNavigator
  - Test cases to implement:
    - Backend 404: Mock `/api/health` to return 404 → Verify app shows ConnectivityErrorScreen → Verify RootNavigator is NOT rendered
    - Timeout: Mock `/api/health` to timeout after 7 seconds → Verify app shows "Connection timeout" error → Verify user cannot proceed
    - Network Error: Mock fetch to throw "Network request failed" → Verify app shows "Network error" message → Verify app is completely blocked
    - Retry Blocking: Trigger health check failure → Click retry button → Verify app shows LoadingScreen again → Verify no fallback option
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Successful Health Check Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (successful health checks)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test cases to implement:
    - Successful Health Check: Mock `/api/health` to return 200 OK → Observe that app loads normally on unfixed code → Verify RootNavigator renders → Verify no ConnectivityErrorScreen
    - API Call Preservation: Mock successful health check → Make API calls to protected endpoints → Observe that they work on unfixed code → Verify auth headers are sent correctly
    - Authentication Preservation: Mock successful health check → Test login/logout flows → Observe that auth works on unfixed code → Verify token storage and retrieval
    - OfflineBanner Preservation: Mock successful health check → Simulate network changes → Observe that OfflineBanner shows/hides correctly on unfixed code → Verify banner behavior is unchanged
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for blocking health check behavior

  - [x] 3.1 Remove blocking conditional rendering in App.tsx
    - Remove or modify lines 103-105 that block app rendering when health check fails
    - Remove: `if (!isConnected && connectivityError) { return <ConnectivityErrorScreen ... /> }`
    - Allow RootNavigator to render regardless of health check status
    - Keep LoadingScreen for `checkingConnectivity` state but consider shorter timeout (2-3 seconds max)
    - _Bug_Condition: isBugCondition(input) where (input.httpStatus IN [404, 500, 502, 503, 504]) OR (input.error.name == 'AbortError') OR (input.error.message CONTAINS 'Network request failed') OR (input.error.message CONTAINS 'timeout') AND appRenderingIsBlocked(input)_
    - _Expected_Behavior: App loads with RootNavigator rendered and non-blocking warning indicator instead of ConnectivityErrorScreen_
    - _Preservation: When backend returns 200 OK, app must continue to log success and proceed normally without warnings_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Add non-blocking warning indicator
    - Option A: Extend OfflineBanner to also show backend connectivity issues
    - Option B: Create a new non-blocking BackendStatusBanner component
    - Option C: Show a toast notification for backend issues
    - Display warning when `connectivityError` is present but don't block app
    - Ensure warning is visible but dismissible or auto-hiding
    - _Bug_Condition: isBugCondition(input) where health check fails_
    - _Expected_Behavior: Non-blocking warning indicator shows backend issue without preventing app usage_
    - _Preservation: When backend is available, no warning should be shown_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Implement background retry logic in useConnectivityCheck
    - Add interval-based retry logic (every 30-60 seconds) in useConnectivityCheck.ts
    - Stop retrying after successful connection
    - Expose retry count for debugging
    - Reduce initial timeout from 7000ms to 3000-5000ms for faster app loading
    - Ensure retry happens in background without blocking UI
    - _Bug_Condition: isBugCondition(input) where health check fails and retry is blocking_
    - _Expected_Behavior: Retry happens in background without blocking UI, with automatic periodic retries_
    - _Preservation: Successful health checks should not trigger retry logic_
    - _Requirements: 2.5_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Non-Blocking Health Check Failure
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - Verify that when health check fails, app renders RootNavigator (not ConnectivityErrorScreen)
    - Verify non-blocking warning indicator is shown
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful Health Check Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - Verify successful health checks still produce identical behavior
    - Verify API calls, authentication, and OfflineBanner work unchanged
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all tests (bug condition + preservation)
  - Verify app loads with non-blocking warning when backend is unavailable
  - Verify app loads normally when backend is available
  - Verify background retry logic works without blocking UI
  - Verify OfflineBanner and health check status work together
  - Ask the user if questions arise
