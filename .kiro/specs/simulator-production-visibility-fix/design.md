# Simulator Production Visibility Fix — Bugfix Design

## Overview

The Driver Simulator UI (`DebugPanel`) and its associated callback wiring in `DeliveryHomeTab` are
leaking into production builds. Although `DebugPanel` itself returns `null` when `__DEV__ === false`,
React still evaluates the component and executes its hooks before the early return. More critically,
`DeliveryHomeTab` unconditionally registers `driverSimulator.onArrived`, `driverSimulator.onDelivered`,
and `driverSimulator.onRouteComplete` callbacks via `useEffect`, and calls `driverSimulator.reset()`
on unmount — all of which run in production where the simulator should never be active.

The fix is a minimal, surgical `__DEV__` guard placed around the simulator `useEffect` block in
`DeliveryHomeTab.tsx`, and a conditional render of `<DebugPanel />` gated on `__DEV__`. No simulator
source files are deleted or restructured.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — the app is running in a production
  build (`__DEV__ === false`) and simulator wiring / rendering executes unconditionally.
- **Property (P)**: The desired correct behavior — in production, no simulator code path is entered;
  in development, all simulator behavior is preserved exactly as before.
- **Preservation**: All development-mode simulator functionality and all production delivery-screen
  functionality that must remain unchanged by the fix.
- **`DeliveryHomeTab`**: The component at `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`
  that renders the delivery home screen and currently wires simulator callbacks unconditionally.
- **`DebugPanel`**: The component at `apps/customer-app/src/dev/DebugPanel.tsx` that renders the
  simulator UI controls; it already has an internal `if (!__DEV__) return null` guard, but is still
  evaluated unconditionally by its parent.
- **`driverSimulator`**: The singleton exported from `apps/customer-app/src/simulator/DriverSimulator.ts`
  that manages fake driver movement and fires lifecycle callbacks.
- **`driverLocationStore`**: The singleton at `apps/customer-app/src/simulator/driverLocationStore.ts`
  whose `setSimulationRunning` method is called by `driverSimulator.reset()` — currently invoked on
  every production unmount.
- **`__DEV__`**: React Native's global boolean that is `true` in development/QA builds and `false`
  in production builds. Metro bundler dead-code-eliminates branches guarded by this flag.

## Bug Details

### Bug Condition

The bug manifests when the app is built for production (`__DEV__ === false`). `DeliveryHomeTab`
imports `driverSimulator` at the module level and registers simulator callbacks unconditionally
inside a `useEffect`. It also renders `<DebugPanel />` unconditionally, causing React to evaluate
the component and run its hooks before the internal `if (!__DEV__) return null` guard fires.

**Formal Specification:**
```
FUNCTION isBugCondition(buildContext)
  INPUT: buildContext — the current build environment
  OUTPUT: boolean

  RETURN buildContext.__DEV__ === false
         AND (
           simulatorUseEffectIsRegistered(buildContext)
           OR debugPanelIsEvaluated(buildContext)
         )
END FUNCTION
```

### Examples

- **Production build, component mounts**: `driverSimulator.onArrived`, `driverSimulator.onDelivered`,
  and `driverSimulator.onRouteComplete` are assigned inside `useEffect` — simulator event handlers
  are live in production even though no simulation will ever start.
- **Production build, component unmounts**: `driverSimulator.reset()` is called, which internally
  calls `driverLocationStore.setSimulationRunning(false)` — simulator teardown logic runs in a
  context where the simulator was never initialised.
- **Production build, JSX evaluation**: `<DebugPanel activeOrders={...} sortedOrderIds={...} isArranged={...} />`
  is evaluated by React; `useState(driverSimulator.getState())` and `useState(driverLocationStore.current)`
  execute before the `if (!__DEV__) return null` guard, touching simulator singletons unnecessarily.
- **Development build (no bug)**: All of the above is expected and correct — simulator wiring and
  `DebugPanel` rendering work as designed.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Mouse/touch interactions with the delivery home screen (accept, reject, pickup, start delivery,
  mark arrived, verify OTP, COD collection) must continue to work exactly as before in both builds.
- The `ControlBar`, `ConnectionBanner`, `NewOrderCard`, `ActiveOrderCard`, and `IdleCard` components
  must render and behave identically in production.
- In development builds, `DebugPanel` must continue to render with all simulator controls (Start,
  Pause, Resume, Reset, speed multipliers) fully functional.
- In development builds, `driverSimulator.onArrived`, `driverSimulator.onDelivered`, and
  `driverSimulator.onRouteComplete` callbacks must continue to fire and update Redux cache state.
- In development builds, `driverSimulator.reset()` must continue to be called on unmount.
- All simulator source files (`DriverSimulator.ts`, `driverLocationStore.ts`, `DebugPanel.tsx`)
  must remain intact and undeleted.

**Scope:**
All inputs and interactions that do NOT involve the `__DEV__ === false` production build context
are completely unaffected by this fix. This includes:
- All user interactions in development builds
- All production user interactions with the delivery home screen (orders, status toggle, etc.)
- Any other component or hook that imports from the simulator modules

## Hypothesized Root Cause

Based on the bug description and code inspection, the root causes are:

1. **Unconditional `useEffect` simulator wiring**: The `useEffect` block in `DeliveryHomeTab` that
   assigns `driverSimulator.onArrived`, `driverSimulator.onDelivered`, `driverSimulator.onRouteComplete`,
   and calls `driverSimulator.reset()` on cleanup has no `__DEV__` guard. It runs in every build.

2. **Unconditional `<DebugPanel />` render**: `DeliveryHomeTab` renders `<DebugPanel />` without
   a `__DEV__` guard at the call site. React evaluates the component (including its `useState` calls
   that reference simulator singletons) before the internal `if (!__DEV__) return null` fires.
   This violates the Rules of Hooks — calling hooks conditionally inside a component is only safe
   when the condition is at the top of the component body, not when the parent calls it
   unconditionally and relies on the child's early return.

3. **Top-level module import of `driverSimulator`**: `import { driverSimulator } from '../../simulator/DriverSimulator'`
   at the top of `DeliveryHomeTab.tsx` means the simulator singleton is instantiated and its
   module-level code executes in every production session, even if the `useEffect` were guarded.
   Metro's dead-code elimination does not remove top-level imports unless the entire module is
   tree-shaken, which requires the import to be inside a `__DEV__` branch.

4. **Partial guard in `onDelivered` callback**: The `onDelivered` handler already contains an
   internal `if (!__DEV__) { console.warn(...); return; }` guard, confirming the intent was always
   to keep simulator logic dev-only — but this guard was never applied at the `useEffect` level.

## Correctness Properties

Property 1: Bug Condition — Simulator Code Does Not Execute in Production

_For any_ build context where `__DEV__ === false` (isBugCondition returns true), the fixed
`DeliveryHomeTab` SHALL NOT register any `driverSimulator` callbacks, SHALL NOT call
`driverSimulator.reset()` on unmount, and SHALL NOT evaluate `<DebugPanel />` or any of its
internal hooks, ensuring zero simulator code paths are entered in a production session.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation — Development Mode Simulator Behavior Is Unchanged

_For any_ build context where `__DEV__ === true` (isBugCondition returns false), the fixed
`DeliveryHomeTab` SHALL produce exactly the same behavior as the original — rendering `<DebugPanel />`,
wiring all three simulator callbacks, and calling `driverSimulator.reset()` on unmount — preserving
all existing development and QA simulator functionality.

**Validates: Requirements 2.5, 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct, only one file requires modification:

**File**: `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`

**Specific Changes**:

1. **Guard the simulator `useEffect` with `__DEV__`**: Wrap the entire `useEffect` block that
   assigns `driverSimulator.onArrived`, `driverSimulator.onDelivered`, `driverSimulator.onRouteComplete`,
   and the cleanup `driverSimulator.reset()` inside an `if (__DEV__)` check so it is completely
   skipped in production. Metro will dead-code-eliminate this block in production bundles.

   ```typescript
   // Before
   useEffect(() => {
     driverSimulator.onArrived = ...;
     driverSimulator.onDelivered = ...;
     driverSimulator.onRouteComplete = ...;
     return () => { driverSimulator.reset(); };
   }, [dispatch, resetArrangement]);

   // After
   useEffect(() => {
     if (!__DEV__) return;
     driverSimulator.onArrived = ...;
     driverSimulator.onDelivered = ...;
     driverSimulator.onRouteComplete = ...;
     return () => { driverSimulator.reset(); };
   }, [dispatch, resetArrangement]);
   ```

2. **Guard the `<DebugPanel />` render with `__DEV__`**: Replace the unconditional JSX with a
   conditional expression so React never evaluates the component in production.

   ```tsx
   // Before
   {/* Debug Panel — DEV ONLY */}
   <DebugPanel
     activeOrders={activeOrders}
     sortedOrderIds={sortedOrderIds}
     isArranged={isArranged}
   />

   // After
   {/* Debug Panel — DEV ONLY */}
   {__DEV__ && (
     <DebugPanel
       activeOrders={activeOrders}
       sortedOrderIds={sortedOrderIds}
       isArranged={isArranged}
     />
   )}
   ```

3. **No other files require changes**: `DebugPanel.tsx`, `DriverSimulator.ts`, and
   `driverLocationStore.ts` are left completely untouched. The top-level import of `driverSimulator`
   in `DeliveryHomeTab.tsx` can remain — Metro's dead-code elimination will remove the import from
   the production bundle once no live code paths reference it, and the import itself does not cause
   observable side effects beyond singleton instantiation which is already harmless.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate
the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or
refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render `DeliveryHomeTab` with `__DEV__` forced to `false` and assert
that simulator callbacks are NOT registered and `driverSimulator.reset()` is NOT called. Run these
tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Simulator callbacks registered in production** (will fail on unfixed code): Render
   `DeliveryHomeTab` with `__DEV__ = false`; assert `driverSimulator.onArrived`,
   `driverSimulator.onDelivered`, and `driverSimulator.onRouteComplete` are all `undefined` /
   not assigned after mount.
2. **`driverSimulator.reset()` called on production unmount** (will fail on unfixed code): Render
   then unmount `DeliveryHomeTab` with `__DEV__ = false`; assert `driverSimulator.reset` was never
   called.
3. **`DebugPanel` hooks execute in production** (will fail on unfixed code): Render `DeliveryHomeTab`
   with `__DEV__ = false`; assert no `setInterval` from `DebugPanel`'s internal `useEffect` is
   created (spy on `setInterval`).
4. **`DebugPanel` not visible in production** (may fail on unfixed code): Render `DeliveryHomeTab`
   with `__DEV__ = false`; assert the simulator UI container is not present in the rendered output.

**Expected Counterexamples**:
- `driverSimulator.onArrived` is assigned a function even when `__DEV__ === false`
- `driverSimulator.reset` is called on unmount even when `__DEV__ === false`
- Possible causes: missing `__DEV__` guard on `useEffect`, unconditional `<DebugPanel />` render

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the
expected behavior.

**Pseudocode:**
```
FOR ALL buildContext WHERE isBugCondition(buildContext) DO
  result := renderDeliveryHomeTab_fixed(buildContext)
  ASSERT simulatorCallbacksNotRegistered(result)
  ASSERT simulatorResetNotCalledOnUnmount(result)
  ASSERT debugPanelNotEvaluated(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed component
produces the same behavior as the original.

**Pseudocode:**
```
FOR ALL buildContext WHERE NOT isBugCondition(buildContext) DO
  ASSERT renderDeliveryHomeTab_original(buildContext)
       = renderDeliveryHomeTab_fixed(buildContext)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of `activeOrders`, `availableOrders`, and simulator state
- It catches edge cases (empty orders, mid-simulation unmount, rapid mount/unmount) that manual
  tests might miss
- It provides strong guarantees that development-mode behavior is unchanged across all scenarios

**Test Plan**: Observe behavior on UNFIXED code first for development-mode interactions, then write
property-based tests capturing that behavior.

**Test Cases**:
1. **Dev-mode simulator callback preservation**: Verify `driverSimulator.onArrived`,
   `driverSimulator.onDelivered`, and `driverSimulator.onRouteComplete` are assigned after mount
   when `__DEV__ === true` — same as original.
2. **Dev-mode reset-on-unmount preservation**: Verify `driverSimulator.reset()` is called on
   unmount when `__DEV__ === true` — same as original.
3. **Dev-mode `DebugPanel` render preservation**: Verify `DebugPanel` is rendered and its controls
   are present when `__DEV__ === true` — same as original.
4. **Production delivery screen preservation**: Verify `ControlBar`, `ConnectionBanner`,
   `NewOrderCard`, `ActiveOrderCard`, and `IdleCard` render identically in both builds.

### Unit Tests

- Test that simulator `useEffect` is skipped entirely when `__DEV__ === false`
- Test that `<DebugPanel />` is not rendered (and its hooks do not fire) when `__DEV__ === false`
- Test that `driverSimulator.reset()` is not called on unmount when `__DEV__ === false`
- Test edge cases: unmount immediately after mount in production, rapid re-renders in production

### Property-Based Tests

- Generate random `activeOrders` arrays and verify that in production builds none of them cause
  simulator callbacks to be registered
- Generate random simulator states and verify that in development builds the `DebugPanel` reflects
  the correct state (preservation of dev behavior)
- Generate random mount/unmount sequences and verify `driverSimulator.reset()` call count matches
  expected (0 in production, 1 per unmount in development)

### Integration Tests

- Full render of `DeliveryHomeTab` in a production-like environment: assert no simulator UI is
  visible and no simulator methods are called throughout the component lifecycle
- Full render in a development environment: assert simulator UI is visible, callbacks fire correctly
  when simulator events are emitted, and reset is called on unmount
- Switching between development and production build contexts (via mocked `__DEV__`): verify
  correct behavior in each context without cross-contamination
