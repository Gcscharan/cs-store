# Implementation Plan: Driver UX Phase 5

## Overview

Additive UX polish on top of the existing `useRouteArrangement` hook and `ActiveOrderCard` component. All work is TypeScript/React Native. Tasks follow the implementation order: visuals → progress header → distance/ETA → failure modal → syncing skeleton → route freeze/persistence → property-based tests.

## Tasks

- [x] 1. Current / Next / Locked visuals
  - [x] 1.1 Apply `cardCurrent` and `cardLocked` styles in `SingleOrderCard`
    - Ensure card container uses `[styles.card, isCurrent && styles.cardCurrent, isLocked && styles.cardLocked]`
    - Wrap card in `<View pointerEvents={isLocked ? 'none' : 'auto'}>` to block all touch on locked cards
    - Verify `CurrentStrip` is only rendered when `isCurrent === true` and never when `isLocked === true`
    - Verify `NextStrip` is only rendered when `stopIndex === 2 && !isCurrent && !isLocked`
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.4, 6.1, 6.2, 6.4, 6.6_

  - [x]* 1.2 Write property test for Single-Current Invariant (Property 1)
    - **Property 1: Single-Current Invariant**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 6.4**
    - Generate random `activeOrders` (1–10 orders), call `arrangeRoute`, assert `count(isOrderCurrent) === 1`, `isOrderCurrent(sortedOrderIds[0]) === true`, and `!isOrderLocked(sortedOrderIds[0])`
    - Tag: `Feature: driver-ux-phase5, Property 1: single-current invariant`

  - [x]* 1.3 Write unit tests for CurrentStrip / NextStrip rendering
    - Test `CurrentStrip` renders with correct stop label when `isCurrent === true`
    - Test `NextStrip` renders when `stopIndex === 2` and order is not current/locked
    - Test neither strip renders on a locked card
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.4, 6.4_

- [x] 2. Route Progress Header
  - [x] 2.1 Extract `RouteProgressHeader` as a standalone component
    - Create `apps/customer-app/src/components/delivery/RouteProgressHeader/RouteProgressHeader.tsx`
    - Accept props: `completedCount`, `remainingCount`, `totalStops`, `orders`, `isOrderCurrent`, `currentIndex`
    - Render left side: `"{remainingCount} stop{s} remaining"` + `"{completedCount} of {totalStops} completed"`
    - Render right side: one dot per stop — `routeDotDone` (i < currentIndex), `routeDotCurrent` (i === currentIndex), `routeDot` (i > currentIndex)
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 2.2 Wire `RouteProgressHeader` into `ActiveOrderCard`
    - Derive `completedCount = sortedOrderIds.indexOf(currentOrderId)` (use `currentIndex` from `findIndex`)
    - Derive `remainingCount = totalStops - completedCount`
    - Replace inline progress header JSX with `<RouteProgressHeader>` component
    - Show only when `isArranged === true && totalStops > 0`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x]* 2.3 Write property test for Progress Consistency (Property 2)
    - **Property 2: Progress Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Generate random `sortedOrderIds` (1–10 IDs) and a random `currentOrderId` from that list, compute `completedCount` and `remainingCount`, assert `completedCount + remainingCount === sortedOrderIds.length`
    - Tag: `Feature: driver-ux-phase5, Property 2: progress consistency`

- [x] 3. Distance + ETA (`useDistanceEta` hook)
  - [x] 3.1 Create `useDistanceEta` hook
    - Create `apps/customer-app/src/hooks/delivery/useDistanceEta.ts`
    - Accept `{ driverLocation, address }` options
    - Return `{ distanceKm, etaMinutes, formattedDistance, formattedEta }`
    - Validate coords — return nulls if `driverLocation` is null or address lat/lng are 0, undefined, non-finite, or out of range
    - Compute `rawKm = haversineKm(...)`
    - Apply jitter guard: if `rawKm > prevKm * 1.05`, use `rawKm`; otherwise use `min(rawKm, prevKm)`
    - Compute `rawEta = (distanceKm / 25) * 60`
    - Apply ETA cap: if `rawEta > prevEta * 1.10` and `distanceKm <= prevKm * 1.05`, clamp to `prevEta * 1.10`
    - Use `useRef` for `prevKm` and `prevEta` to avoid stale closure issues
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.1, 9.2_

  - [x] 3.2 Integrate `useDistanceEta` into `SingleOrderCard`
    - Replace the inline haversine calculation in `SingleOrderCard` with a call to `useDistanceEta`
    - Pass `distanceKm` and `formattedDistance`/`formattedEta` to `CurrentStrip` and `NextStrip`
    - Render distance/ETA in strips only when `distanceKm !== null`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.2_

  - [x]* 3.3 Write property test for ETA Monotonicity (Property 3)
    - **Property 3: ETA Monotonicity**
    - **Validates: Requirements 3.1, 9.1, 9.2**
    - Generate a destination coordinate and a sequence of driver positions moving toward it (each step reduces haversine distance by a random amount within ±5%), compute ETA at each step via the hook logic, assert no ETA increase exceeds 10% unless distance increased by >5%
    - Tag: `Feature: driver-ux-phase5, Property 3: ETA monotonicity`

  - [x]* 3.4 Write property test for Distance Formatting (Property 6)
    - **Property 6: Distance Formatting**
    - **Validates: Requirements 3.2, 3.3, 9.2**
    - Generate random non-negative distances, assert `formatDistance(d)` contains "m" iff `d < 1` and "km" iff `d >= 1`; assert `formatEta(d)` matches the correct format bracket (`< 1 min`, `{N} min`, `{H}h {M}m`)
    - Tag: `Feature: driver-ux-phase5, Property 6: distance formatting`

  - [x]* 3.5 Write unit tests for `useDistanceEta`
    - Test `formatDistance`: `0.35` → `"350 m"`, `1.0` → `"1.0 km"`, `2.45` → `"2.5 km"`
    - Test `formatEta`: `0.01 km` → `"< 1 min"`, `10 km` → `"24 min"`, `100 km` → `"4h 0m"`
    - Test null return when coords are invalid (zero, out-of-range, undefined)
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Failure Modal polish
  - [x] 5.1 Add notes trimming and confirm gate to `FailureModal`
    - In `handleConfirmFail`, pass `failNotes.trim() || undefined` to `onFailDelivery` (never pass whitespace-only string)
    - Disable the confirm `TouchableOpacity` when `selectedReason === ''` (add `disabled={!selectedReason}` and `styles.modalConfirmBtnDisabled`)
    - Confirm `maxLength={200}` is set on the notes `TextInput`
    - _Requirements: 5.5, 5.7, 5.9_

  - [x]* 5.2 Write property test for Failure Notes Sanitisation (Property 8)
    - **Property 8: Failure Notes Sanitisation**
    - **Validates: Requirements 5.7, 5.9**
    - Generate random strings (including whitespace-only and strings > 200 chars), assert submitted notes are trimmed, ≤ 200 chars, and `undefined` when whitespace-only
    - Tag: `Feature: driver-ux-phase5, Property 8: failure notes sanitisation`

  - [x]* 5.3 Write unit tests for `FailureModal`
    - Test confirm button is disabled when no reason selected
    - Test confirm button is enabled after reason selected
    - Test whitespace-only notes are passed as `undefined`
    - _Requirements: 5.5, 5.7, 5.9_

- [x] 6. Syncing Skeleton guard
  - [x] 6.1 Harden `allowedActions` undefined guard in `SingleOrderCard`
    - Confirm `SyncingSkeleton` renders when `allowedActions === undefined` (field absent)
    - Confirm `SyncingSkeleton` does NOT render when `allowedActions === []` (empty array is a valid server response)
    - Confirm action buttons and `SyncingSkeleton` are never rendered simultaneously
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x]* 6.2 Write property test for Syncing Skeleton Exclusivity (Property 9)
    - **Property 9: Syncing Skeleton Exclusivity**
    - **Validates: Requirements 8.1, 8.2, 8.4**
    - Generate random `allowedActions` values (including `undefined`, `[]`, and non-empty arrays), assert `SyncingSkeleton` is rendered iff `allowedActions === undefined`, and action buttons are rendered iff `allowedActions !== undefined`
    - Tag: `Feature: driver-ux-phase5, Property 9: syncing skeleton exclusivity`

  - [x]* 6.3 Write unit tests for `SyncingSkeleton`
    - Test `SyncingSkeleton` renders when `allowedActions === undefined`
    - Test `SyncingSkeleton` absent when `allowedActions === []`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 7. Route freeze + persistence
  - [x] 7.1 Add ghost-order guard to `useRouteArrangement`
    - In the auto-advance `useEffect`, after `currentOrderId` is set, verify it exists in `activeOrders`
    - If `currentOrderId` points to an order not in `activeOrders`, advance to the first `sortedOrderIds` entry that IS in `activeOrders`; if none remain, call `resetArrangement`
    - Ensure `driverLocation` updates never trigger a re-sort of `sortedOrderIds` (location subscription only calls `setDriverLocation`, never `setSortedOrderIds`)
    - _Requirements: 5.8, 7.1, 7.5_

  - [x] 7.2 Verify AsyncStorage persistence contract
    - Confirm `arrangeRoute` writes all three keys (`@delivery_sorted_orders`, `@delivery_current_order`, `@delivery_route_arranged`) atomically via `Promise.all`
    - Confirm `resetArrangement` removes all three keys via `Promise.all`
    - Confirm mount effect reads all three keys and starts in unarranged state if any key is missing
    - Confirm AsyncStorage read failures are caught and result in unarranged state (safe default)
    - _Requirements: 7.3, 7.4_

  - [x]* 7.3 Write property test for Route Freeze (Property 4)
    - **Property 4: Route Freeze**
    - **Validates: Requirements 7.1, 7.2, 7.5**
    - Generate an arranged route (random `sortedOrderIds`), send N random `driverLocation` updates, assert `sortedOrderIds` is unchanged after each update
    - Tag: `Feature: driver-ux-phase5, Property 4: route freeze`

  - [x]* 7.4 Write property test for Ghost-Order Guard (Property 7)
    - **Property 7: Ghost-Order Guard**
    - **Validates: Requirements 5.8, 7.1**
    - Generate random `sortedOrderIds` and random subsets of those IDs as `activeOrderIds`, assert `currentOrderId` always equals the first element of `sortedOrderIds` present in `activeOrderIds`, or that `resetArrangement` is called when none remain
    - Tag: `Feature: driver-ux-phase5, Property 7: ghost-order guard`

  - [x]* 7.5 Write property test for Failure Transition (Property 5)
    - **Property 5: Failure Transition — No Zero-Current Gap**
    - **Validates: Requirements 5.3, 5.4, 5.8**
    - Generate random `sortedOrderIds` (2–5 IDs) and a random subset of `activeOrders` (simulating removal of current order), assert `currentOrderId` advances to the next surviving entry without a zero-current intermediate state
    - Tag: `Feature: driver-ux-phase5, Property 5: failure transition`

  - [x]* 7.6 Write unit tests for AsyncStorage persistence
    - Test `resetArrangement` clears all three AsyncStorage keys
    - Test mount restores state from AsyncStorage when all three keys are present
    - Test mount starts in unarranged state when any key is missing
    - _Requirements: 7.3, 7.4_

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integration and wiring
  - [x] 9.1 Wire `driverLocation` from `useRouteArrangement` into `ActiveOrderCard` → `SingleOrderCard`
    - Confirm `driverLocation` is passed from `DeliveryHomeTab` → `ActiveOrderCard` → `SingleOrderCard` (already in props; verify no gaps)
    - Confirm `stopIndex` and `totalStops` are passed correctly when `isArranged === true`
    - _Requirements: 3.1, 3.4, 3.5, 9.3_

  - [x] 9.2 Verify touch-blocking on locked cards end-to-end
    - Confirm `<View pointerEvents={isLocked ? 'none' : 'auto'}>` wraps the entire `SingleOrderCard` render output
    - Confirm no action button, OTP input, or navigation link is reachable on a locked card
    - _Requirements: 6.2, 6.6_

  - [x] 9.3 Verify idle and offline state rendering
    - Confirm `IdleCard` renders when both `availableOrders` and `activeOrders` are empty
    - Confirm `ConnectionBanner` renders with offline indicator when `networkIsOnline === false`
    - _Requirements: 10.1, 10.2, 10.6_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already available in the React Native/TypeScript stack)
- Each property test must run a minimum of 100 iterations
- The `useDistanceEta` hook does NOT throttle — throttling is handled upstream by `useRouteArrangement`'s 1 s subscription gate
- `allowedActions === undefined` (field absent) and `allowedActions === []` (empty array) are semantically distinct — the guard must use strict `=== undefined`
