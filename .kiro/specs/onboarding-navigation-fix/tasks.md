# Implementation Plan

## Overview
This task list follows the bug condition methodology to systematically fix the onboarding navigation crash. The bug occurs when the app attempts to navigate to the 'Onboarding' screen after OTP verification, but the screen is not available in the current navigation stack.

**Bug Condition**: `requiresOnboarding: true` AND `authStatus: 'UNAUTHENTICATED'` AND navigation attempt to 'Onboarding' screen
**Expected Behavior**: Successful navigation to onboarding flow without crashes
**Preservation**: Existing login flows and navigation patterns remain unchanged

---

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Navigation Crash on Onboarding Redirect
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the navigation crash exists
  - **Scoped PBT Approach**: Focus on the specific scenario where OTP verification returns `requiresOnboarding: true` with phone parameter
  - Test that navigation.navigate('Onboarding', { phone }) crashes when authStatus is 'UNAUTHENTICATED'
  - Verify the error message: "The action 'NAVIGATE' with payload {"name":"Onboarding","params":{"phone":"..."}} was not handled by any navigator"
  - Test with various phone number formats to ensure reproducibility
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Navigation Flows
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for existing user login flows (non-buggy inputs)
  - Test Case 1: Users without onboarding requirement complete login normally
    - Verify navigation.navigate('MainApp') works when `requiresOnboarding: false`
    - Test with various user profiles and auth states
  - Test Case 2: Users with 'GOOGLE_AUTH_ONLY' status access Onboarding screen directly
    - Verify Onboarding screen is accessible when authStatus is 'GOOGLE_AUTH_ONLY'
    - Test direct navigation to Onboarding works in this context
  - Test Case 3: Normal app navigation after authentication
    - Verify existing navigation patterns within the app continue to work
    - Test navigation between authenticated screens
  - Write property-based tests capturing observed behavior patterns
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for onboarding navigation crash

  - [x] 3.1 Implement the navigation fix
    - Analyze the current navigation stack configuration and auth status handling
    - Identify why Onboarding screen is not available when authStatus is 'UNAUTHENTICATED'
    - Option A: Update auth status to appropriate state before navigation attempt
    - Option B: Ensure Onboarding screen is available in UNAUTHENTICATED navigation stack
    - Option C: Implement conditional navigation stack based on onboarding requirement
    - Apply the most appropriate fix based on app architecture analysis
    - Ensure the fix handles the phone parameter passing correctly
    - _Bug_Condition: requiresOnboarding: true AND authStatus: 'UNAUTHENTICATED' AND navigation to 'Onboarding'_
    - _Expected_Behavior: Successful navigation to onboarding flow without crashes_
    - _Preservation: Existing login flows and navigation patterns remain unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Navigation Crash on Onboarding Redirect
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify navigation.navigate('Onboarding', { phone }) now succeeds
    - Verify no navigation error is thrown
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Navigation Flows
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all existing navigation flows still work correctly
    - Verify no breaking changes to existing user flows
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run complete test suite to verify the fix
  - Ensure bug condition test passes (navigation works)
  - Ensure preservation tests pass (no regressions)
  - Verify manual testing scenarios:
    - New user OTP verification → onboarding flow
    - Existing user OTP verification → main app
    - Google auth users → onboarding access
  - Document any edge cases discovered during testing
  - Ask the user if questions arise about the implementation or testing results

## Notes

### Bug Condition Details
- **Trigger**: OTP verification API returns `requiresOnboarding: true`
- **Context**: User is in LoginScreen with authStatus 'UNAUTHENTICATED'
- **Action**: `navigation.navigate('Onboarding', { phone })`
- **Failure**: Navigation error because Onboarding screen not in current stack

### Expected Fix Outcomes
- Navigation to Onboarding screen succeeds after OTP verification
- Phone parameter is correctly passed to Onboarding screen
- No crashes or navigation errors occur
- Existing user flows remain unaffected

### Testing Strategy
- Property-based testing for comprehensive input coverage
- Exploration test validates bug exists before fix
- Preservation tests ensure no regressions
- Manual verification of complete user flows