# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Simulator Wiring Executes in Production
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — `__DEV__ === false` with any combination of `activeOrders`, `sortedOrderIds`, and `isArranged` props
  - Render `DeliveryHomeTab` with `__DEV__` forced to `false`; assert that after mount `driverSimulator.onArrived`, `driverSimulator.onDelivered`, and `driverSimulator.onRouteComplete` are all `undefined` / not assigned (from Bug Condition in design: `isBugCondition(buildContext)` where `buildContext.__DEV__ === false`)
  - Also assert that unmounting the component does NOT call `driverSimulator.reset()`
  - Also assert that no `DebugPanel` internal hooks (e.g. `setInterval`) fire — spy on `setInterval` and assert it was not called
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g. "`driverSimulator.onArrived` is assigned a function even when `__DEV__ === false`", "`driverSimulator.reset` is called on unmount even when `__DEV__ === false`")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Development Mode Simulator Behavior Is Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code with `__DEV__ === true`: `driverSimulator.onArrived`, `driverSimulator.onDelivered`, and `driverSimulator.onRouteComplete` are assigned after mount
  - Observe on UNFIXED code with `__DEV__ === true`: `driverSimulator.reset()` is called exactly once on unmount
  - Observe on UNFIXED code with `__DEV__ === true`: `DebugPanel` is present in the rendered output with simulator controls (Start, Pause, Resume, Reset, speed multipliers)
  - Observe on UNFIXED code (both builds): `ControlBar`, `ConnectionBanner`, `NewOrderCard`, `ActiveOrderCard`, and `IdleCard` render identically regardless of `__DEV__`
  - Write property-based test: for all combinations of `activeOrders` (including empty array, single order, multiple orders) with `__DEV__ === true`, all three simulator callbacks are assigned after mount and `driverSimulator.reset()` is called exactly once on unmount (from Preservation Requirements in design)
  - Write property-based test: for all combinations of `activeOrders` with `__DEV__ === false`, the production delivery screen components (`ControlBar`, `ConnectionBanner`, order cards) render without any change in behavior
  - Verify all preservation tests PASS on UNFIXED code
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix simulator production visibility in DeliveryHomeTab.tsx

  - [x] 3.1 Guard the simulator `useEffect` with `__DEV__`
    - Open `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`
    - Inside the `useEffect` that assigns `driverSimulator.onArrived`, `driverSimulator.onDelivered`, `driverSimulator.onRouteComplete`, and returns `() => { driverSimulator.reset(); }`, add `if (!__DEV__) return;` as the very first statement in the effect body
    - This causes Metro to dead-code-eliminate the entire simulator wiring block in production bundles
    - _Bug_Condition: `isBugCondition(buildContext)` where `buildContext.__DEV__ === false` AND `simulatorUseEffectIsRegistered(buildContext)` is true_
    - _Expected_Behavior: in production, `driverSimulator.onArrived`, `driverSimulator.onDelivered`, `driverSimulator.onRouteComplete` are never assigned and `driverSimulator.reset()` is never called on unmount_
    - _Preservation: in development, the `useEffect` continues to assign all three callbacks and call `driverSimulator.reset()` on cleanup, exactly as before_
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.2 Guard the `<DebugPanel />` render with `__DEV__`
    - In the JSX return of `DeliveryHomeTab`, replace the unconditional `<DebugPanel activeOrders={...} sortedOrderIds={...} isArranged={...} />` with `{__DEV__ && <DebugPanel activeOrders={activeOrders} sortedOrderIds={sortedOrderIds} isArranged={isArranged} />}`
    - This prevents React from evaluating `DebugPanel` and executing its hooks in production
    - _Bug_Condition: `isBugCondition(buildContext)` where `buildContext.__DEV__ === false` AND `debugPanelIsEvaluated(buildContext)` is true_
    - _Expected_Behavior: in production, `DebugPanel` is never evaluated and none of its internal hooks (`useState(driverSimulator.getState())`, `useState(driverLocationStore.current)`) execute_
    - _Preservation: in development, `DebugPanel` continues to render with all simulator controls fully functional_
    - _Requirements: 2.1, 2.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Simulator Wiring Does Not Execute in Production
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (no simulator callbacks assigned, no `reset()` on unmount, no `DebugPanel` hooks fired when `__DEV__ === false`)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Development Mode Simulator Behavior Is Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run all preservation property tests from step 2
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions in dev-mode simulator behavior or production delivery screen behavior)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite for `DeliveryHomeTab` and related components
  - Confirm Property 1 (bug condition exploration test) passes — bug is fixed
  - Confirm Property 2 (preservation tests) passes — no regressions
  - Confirm no simulator source files (`DriverSimulator.ts`, `driverLocationStore.ts`, `DebugPanel.tsx`) were modified or deleted
  - Ensure all tests pass; ask the user if any questions arise
