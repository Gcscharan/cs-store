# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Cross-User Data Leakage Detection
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate User B sees User A's data
  - **Scoped PBT Approach**: Scope the property to concrete failing case: User A logout → User B login → check rendered userId
  - Test implementation: User A logs out → User B logs in → assert HomeScreen renders ONLY User B's userId (no flash of User A)
  - The test assertions should match: User B never sees User A's name, cart, orders, or addresses
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: which screen shows wrong userId, timing of flash, data source (Redux/RTK/AsyncStorage)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.4, 2.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Single-User Session Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for single-user sessions (no logout-login between different users)
  - Test Case 1: User A navigates between screens → observe RTK Query cache returns cached data (performance optimization)
  - Test Case 2: User A adds item to cart → observe optimistic update provides instant feedback
  - Test Case 3: User A backgrounds app → resumes → observe Redux persist restores state correctly
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements (3.1-3.7)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for cross-user data leakage (MINIMAL SURGICAL FIX)

  - [x] 3.1 Fix 1: HARD RESET STATE ON LOGOUT (MOST IMPORTANT)
    - Update logout handlers in AccountScreen.tsx, DeliveryMoreTab.tsx, AdminDashboardScreen.tsx
    - Add three cleanup calls in EXACT ORDER:
      1. `dispatch(baseApi.util.resetApiState())` - clear RTK Query cache
      2. `await persistor.purge()` - clear AsyncStorage persisted state
      3. `dispatch(logout())` - clear Redux state
    - ORDER MATTERS: RTK cache → AsyncStorage → Redux
    - Remove tokens from SecureStore (existing behavior - keep it)
    - Add minimal logging: `console.log("🚪 LOGOUT COMPLETE", {userId, time: Date.now()})`
    - _Bug_Condition: isBugCondition(input) where User A logs out and User B logs in_
    - _Expected_Behavior: User B SHALL only see User B's data with no flash of User A's information_
    - _Preservation: Single-user session caching (3.1-3.7) must remain unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.5_

  - [x] 3.2 Fix 2: REMOVE ARTIFICIAL DELAY (CRITICAL BUG)
    - Update LoginScreen.tsx handleVerify function
    - DELETE the 500ms setTimeout wrapper around dispatch(setUser(...))
    - REPLACE WITH immediate dispatch: `dispatch(setUser(userData))` and `dispatch(setStatus('ACTIVE'))`
    - This eliminates the race condition where UI renders before user state is ready
    - Add minimal logging: `console.log("🔐 LOGIN COMPLETE", {userId, time: Date.now()})`
    - _Bug_Condition: Race condition where UI renders with stale state before login completes_
    - _Expected_Behavior: User state propagates immediately, no race condition_
    - _Preservation: Authentication flow continues to work correctly (3.6)_
    - _Requirements: 1.4, 2.4, 2.6_

  - [x] 3.3 Fix 3: BLOCK UI UNTIL USER READY
    - Update HomeScreen.tsx (and other user-dependent screens if needed)
    - Add guard at component start: `if (!user) { return null; }` or return a loader component
    - This prevents rendering with undefined/stale user data
    - Add minimal logging: `console.log("🎯 UI RENDER", {userId: user?.id, time: Date.now()})`
    - _Bug_Condition: UI renders before user data is available_
    - _Expected_Behavior: UI waits for user data before rendering_
    - _Preservation: Normal logged-in rendering continues to work (3.1, 3.4)_
    - _Requirements: 2.1, 2.6_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - No Cross-User Data Leakage
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify: User A logout → User B login → User B sees ONLY User B's data (no flash)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Single-User Session Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all single-user session behaviors still work: cache, optimistic updates, state persistence
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all tests (bug condition + preservation)
  - Verify no regressions in single-user sessions
  - Verify cross-user data leakage is completely eliminated
  - Ask the user if questions arise
