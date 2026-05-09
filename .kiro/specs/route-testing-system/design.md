# Design Document: Route Testing System

## Overview

The Route Testing System introduces three tightly coordinated pieces:

1. **Pure algorithm extraction** — `routeAlgorithm.ts` pulls `haversineKm`, `isValidCoord`, `twoOptOptimize`, `moveTowards`, and `computeGreedyRoute` out of the hook into a side-effect-free module that can be unit- and property-tested without mocking React, AsyncStorage, or expo-location.

2. **Simulation infrastructure** — `driverLocationStore.ts` (global singleton), `DriverSimulator.ts` (movement engine), and `locationService.ts` (`getDriverLocation()` abstraction) form a layered stack that lets the app run with either real GPS or simulated GPS, controlled by a single `DEV_MODE` flag derived from `__DEV__`.

3. **Test suite** — `routeArrangement.simulation.test.ts` exercises the pure functions with fast-check property runners (1000+ iterations) and the simulator with Jest unit tests, covering all named scenarios, validation rules, distance quality, UI state, and performance bounds.

The critical design constraint is that these three pieces must not fight each other. The architecture below is specifically designed to prevent infinite re-renders, mid-delivery route reshuffling, and CURRENT order jumping.

---

## Architecture

### Core Data Flow

```
DriverSimulator
    │  writes position on every SIM_STEP_INTERVAL tick
    ▼
driverLocationStore          ← global singleton, plain JS object, NOT React state
    │  getDriverLocation() reads from here when DEV_MODE = true
    ▼
locationService.getDriverLocation()
    │  called by useRouteArrangement instead of expo-location directly
    ▼
useRouteArrangement
    │  freeze guard: if (isSimulationRunning && isArranged) skip arrangeRoute() only
    │  position updates + distance UI + arrival detection still run normally
    ▼
sortedOrderIds + currentOrderId
    ▼
UI (ActiveOrderCard — cards, locks, CURRENT badge, navigation)
```

### Location Abstraction

```
getDriverLocation()
    ├── DEV_MODE = false  →  expo-location.getCurrentPositionAsync()
    └── DEV_MODE = true   →  driverLocationStore.current
```

`DEV_MODE` is derived from `__DEV__` (React Native global) or `process.env.EXPO_PUBLIC_DEV_MODE`. It is never a runtime-mutable flag so it cannot be accidentally enabled in production.

### Freeze Guard (Most Critical Rule)

```typescript
// Inside useRouteArrangement.arrangeRoute():
if (driverLocationStore.isSimulationRunning && isArranged) {
  console.warn('[ROUTE_ARRANGEMENT] Skipping rearrange — simulation running');
  return; // return early from arrangeRoute only — does NOT block other hook logic
}
```

The freeze guard is **scoped to `arrangeRoute()` only**. It prevents `sortedOrderIds` from being recomputed mid-delivery. It does **not** block:
- The hook updating its internal driver position reference
- Distance calculations used for UI display
- Arrival detection edge cases
- Re-renders triggered by position changes

Route ORDER is frozen during simulation. UI distance display, arrival detection, and debugging visibility continue to work normally.

Route rearrangement is only permitted:
- Before the simulation starts (initial arrangement, `isArranged = false`)
- After `DriverSimulator.reset()` is called (which sets `isSimulationRunning = false`)

This prevents the three-way conflict between the simulator writing positions, the store broadcasting updates, and the hook re-sorting orders mid-delivery.

---

## Components and Interfaces

### File Structure

```
apps/customer-app/src/
├── utils/
│   └── routeAlgorithm.ts          ← pure functions only, zero side effects
├── simulator/
│   ├── DriverSimulator.ts          ← singleton simulation engine
│   └── driverLocationStore.ts      ← global location state (NOT React state)
├── services/
│   └── locationService.ts          ← getDriverLocation() abstraction
├── hooks/delivery/
│   └── useRouteArrangement.ts      ← updated: uses getDriverLocation() + freeze guard
└── dev/
    └── DebugPanel.tsx              ← DEV_MODE only, renders null in production
```

### `routeAlgorithm.ts`

Pure module with no imports from React, expo-location, or AsyncStorage.

```typescript
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number

export function isValidCoord(lat?: number | null, lng?: number | null): boolean

export function moveTowards(
  current: { lat: number; lng: number },
  target:  { lat: number; lng: number },
  stepMeters: number
): { lat: number; lng: number }

export interface RouteStop {
  order: Order;
  score: number;
  warehouseDist: number;
  driverDist: number;
}

export interface RouteResult {
  routeBefore: RouteStop[];
  routeAfter:  RouteStop[];
  distanceBefore: number;
  distanceAfter:  number;
}

export function twoOptOptimize(
  route: RouteStop[],
  startLat: number,
  startLng: number,
  maxIterations?: number,   // default: 50
  timeLimitMs?: number      // default: 500
): RouteStop[]

export function computeGreedyRoute(
  eligible: Order[],
  driverLat: number,
  driverLng: number
): RouteResult
```

`computeGreedyRoute` encapsulates the sequential greedy scoring (phase-1 weighted score, phase-2+ nearest-neighbour, end penalty for last 3 stops) followed by `twoOptOptimize`. It returns both the pre- and post-optimisation routes and distances so the test suite can assert improvement.

#### Time-Bounded 2-opt

`twoOptOptimize` is bounded by both iteration count and wall-clock time to prevent O(n² × iterations) blowup at 50+ orders:

```typescript
const MAX_2OPT_ITER = 50;   // maxIterations param default
const TIME_LIMIT_MS = 500;  // timeLimitMs param default
const startTime = Date.now();
let iter = 0;

while (improved && iter < MAX_2OPT_ITER) {
  if (Date.now() - startTime > TIME_LIMIT_MS) {
    console.warn('[ROUTE_ALGORITHM] 2-opt time limit reached, returning best so far');
    break;
  }
  improved = false;
  iter++;
  // ... swap logic
}
```

The 500 ms cap leaves ample headroom within the 2000 ms total performance budget (Property 22). The best route found so far is always returned — the time limit is a safety valve, not a correctness compromise.

### `driverLocationStore.ts`

Global singleton — plain JS object, no React state, no hooks.

```typescript
type DriverLocationStore = {
  current: { lat: number; lng: number } | null;
  isSimulationRunning: boolean;
  set(pos: { lat: number; lng: number }): void;
  setSimulationRunning(running: boolean): void;
  subscribe(cb: (pos: { lat: number; lng: number }) => void): () => void; // returns unsubscribe fn
};

export const driverLocationStore: DriverLocationStore;
```

Subscribers are notified synchronously on every `set()` call. `useRouteArrangement` subscribes during simulation to receive position updates without triggering React re-renders from the store itself (the hook decides when to re-render based on its own state).

### `locationService.ts`

```typescript
// DEV_MODE derived from __DEV__ || process.env.EXPO_PUBLIC_DEV_MODE === 'true'
export async function getDriverLocation(): Promise<{ lat: number; lng: number }>
```

- `DEV_MODE = false`: calls `Location.requestForegroundPermissionsAsync()`, throws `"Location permission denied"` if denied, otherwise calls `Location.getCurrentPositionAsync({ accuracy: Balanced })` and returns `{ lat: coords.latitude, lng: coords.longitude }`.
- `DEV_MODE = true`: returns `driverLocationStore.current`. If `current` is null (simulation not yet started), throws `"Simulation not started — no position available"`.
- Never calls `Location.setMockLocation()`.
- If both real GPS and simulated GPS are somehow active simultaneously, prefers simulated and emits `[SIM] WARNING: dual-source conflict detected`.

### `DriverSimulator.ts`

Singleton class. Disabled entirely in production (`!__DEV__`).

```typescript
type SimulatorState = {
  isRunning: boolean;
  isPaused: boolean;
  currentPosition: { lat: number; lng: number };
  currentIndex: number;
  route: Order[];
  speedMultiplier: 1 | 2 | 5;
};

class DriverSimulator {
  // Callbacks — set before calling start()
  onArrived: (orderId: string) => void;
  onDelivered: (orderId: string) => void;
  onRouteComplete: () => void;

  start(route: Order[], isArranged: boolean): void;  // throws if !isArranged; no-op + warning if !__DEV__; stops existing sim first
  pause(): void;
  resume(): void;
  reset(): void;
  setSpeed(multiplier: 1 | 2 | 5): void;
  getState(): Readonly<SimulatorState>;
}

export const driverSimulator: DriverSimulator; // singleton export
```

`start()` enforces a hard pre-condition guard:

```typescript
start(route: Order[], isArranged: boolean): void {
  if (!__DEV__) {
    console.warn('[SIM] DriverSimulator.start() called in production — no-op');
    return;
  }
  if (!isArranged) {
    throw new Error('Route must be arranged before starting simulation');
  }
  // stop existing simulation if running, then begin
}
```

Movement loop (runs every `SIM_STEP_INTERVAL = 2000ms` at 1×):

```typescript
const stepMeters = SIM_STEP_DISTANCE * state.speedMultiplier; // 75m * multiplier
const next = moveTowards(state.currentPosition, targetOrder.address, stepMeters);
driverLocationStore.set(next);
console.log(`[SIM] Moving → ${next.lat.toFixed(6)},${next.lng.toFixed(6)}`);

if (haversineKm(next.lat, next.lng, targetOrder.address.lat, targetOrder.address.lng) * 1000 < ARRIVED_THRESHOLD) {
  handleArrival(targetOrder._id);
}
```

Auto-delivery sequence:

```typescript
async function handleArrival(orderId: string) {
  console.log(`[SIM] Reached Order → ${orderId}`);
  onArrived(orderId);          // caller updates order status to "arrived"
  await delay(2000);
  onDelivered(orderId);        // caller triggers DELIVERY_COMPLETE
  console.log(`[SIM] Delivered → ${orderId}`);
  moveToNextOrder();
}
```

Constants:
- `ARRIVED_THRESHOLD = 40` (meters)
- `SIM_STEP_INTERVAL = 2000` (ms at 1×)
- `SIM_STEP_DISTANCE = 75` (meters at 1×)

### `useRouteArrangement.ts` (updated)

Key changes from current implementation:

1. Replace direct `expo-location` call with `getDriverLocation()`.
2. Add freeze guard at the top of `arrangeRoute` — scoped to route reordering only:
   ```typescript
   if (driverLocationStore.isSimulationRunning && isArranged) {
     console.warn('[ROUTE_ARRANGEMENT] Skipping rearrange — simulation running');
     return; // exits arrangeRoute() only; hook continues updating position + distances
   }
   ```
   The guard prevents `sortedOrderIds` from being recomputed mid-delivery. It does **not** prevent the hook from updating its internal driver position reference, running distance calculations for UI display, or triggering re-renders for distance updates.
3. Subscribe to `driverLocationStore` during simulation for position updates (read-only; the hook does not re-sort, it only updates its internal driver position reference for display purposes).
4. Remove the duplicate `AsyncStorage.setItem` calls (currently called twice in the existing implementation).

### `DebugPanel.tsx`

```typescript
// Returns null immediately if !__DEV__
export const DebugPanel: React.FC<{
  activeOrders: Order[];
  isArranged: boolean;
  sortedOrderIds: string[];
}> = ({ activeOrders, isArranged, sortedOrderIds }) => {
  if (!__DEV__) return null;
  // Controls:
  //   Start Simulation — disabled when !isArranged
  //     tooltip when disabled: "Arrange route first before starting simulation"
  //   Pause | Resume | Reset
  // Speed selector: 1× | 2× | 5×
  // Live display: Current lat,lng | Target: Order #XXXXXX
};
```

The "Start Simulation" button is **disabled** when `isArranged === false` and shows a tooltip: `"Arrange route first before starting simulation"`. This mirrors the hard guard in `DriverSimulator.start()` and prevents the error from ever being thrown in normal usage.

---

## Data Models

### `LatLng`

```typescript
type LatLng = { lat: number; lng: number };
```

### `RouteStop`

```typescript
interface RouteStop {
  order: Order;
  score: number;        // weighted score used for selection
  warehouseDist: number; // km from WAREHOUSE
  driverDist: number;    // km from driver/previous stop
}
```

### `RouteResult`

```typescript
interface RouteResult {
  routeBefore: RouteStop[];   // greedy order before 2-opt
  routeAfter:  RouteStop[];   // optimised order after 2-opt
  distanceBefore: number;     // total haversine km before 2-opt
  distanceAfter:  number;     // total haversine km after 2-opt
}
```

### `SimulatorState`

```typescript
type SimulatorState = {
  isRunning: boolean;
  isPaused: boolean;
  currentPosition: LatLng;
  currentIndex: number;       // index into route[]
  route: Order[];
  speedMultiplier: 1 | 2 | 5;
};
```

### `FailureSnapshot`

```typescript
interface FailureSnapshot {
  scenario: string;
  driverPosition: LatLng;
  inputOrders: Array<{
    _id: string;
    address: LatLng;
    orderStatus: string;
  }>;
  routeBefore: string[];   // order IDs
  routeAfter:  string[];   // order IDs
  failingRule: string;
  timestamp: string;
}
```

### `MockOrder` factory

```typescript
function createMockOrder(params: {
  lat: number;
  lng: number;
  status?: EligibleStatus;
  id?: string;
}): Order
```

Returns a complete `Order`-shaped object. Generates a unique ID (UUID v4 prefix) when none is provided. Coordinates are stored exactly as supplied — if they are out of range, `isValidCoord` will return false for that order (by design, for EDGE_CASES scenario).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Haversine identity

*For any* valid coordinate point A, `haversineKm(A.lat, A.lng, A.lat, A.lng)` SHALL equal 0.

**Validates: Requirements 17.2**

---

### Property 2: Haversine symmetry

*For any* two valid coordinate points A and B, `haversineKm(A, B)` SHALL equal `haversineKm(B, A)`.

**Validates: Requirements 17.3**

---

### Property 3: Haversine triangle inequality

*For any* three valid coordinate points A, B, C, `haversineKm(A, C)` SHALL be less than or equal to `haversineKm(A, B) + haversineKm(B, C)`.

**Validates: Requirements 17.4**

---

### Property 4: moveTowards progress invariant

*For any* valid `(current, target, stepMeters)` where `stepMeters < haversineKm(current, target) * 1000`, the distance from `moveTowards(current, target, stepMeters)` to `target` SHALL be strictly less than the distance from `current` to `target`.

**Validates: Requirements 3.6, 17.7**

---

### Property 5: moveTowards no-overshoot

*For any* valid `(current, target)` and any `stepMeters >= haversineKm(current, target) * 1000`, `moveTowards(current, target, stepMeters)` SHALL return a position equal to `target` within 0.0001 degrees on both axes.

**Validates: Requirements 3.4, 17.8**

---

### Property 6: moveTowards output validity

*For any* valid inputs to `moveTowards`, the returned `{ lat, lng }` SHALL satisfy `isValidCoord(lat, lng) === true`.

**Validates: Requirements 3.7**

---

### Property 7: Mock order coordinate round-trip

*For any* valid `(lat, lng)` pair, a mock order created with those coordinates SHALL have `order.address.lat === lat` and `order.address.lng === lng` exactly, and `isValidCoord(order.address.lat, order.address.lng)` SHALL return `true`.

**Validates: Requirements 8.4, 8.5**

---

### Property 8: Mock order unique IDs

*For any* N calls to `createMockOrder` without supplying an ID, all N returned order IDs SHALL be distinct.

**Validates: Requirements 8.2**

---

### Property 9: Route completeness invariant

*For any* set of eligible orders passed to `computeGreedyRoute`, the returned `routeAfter` SHALL contain exactly the same order IDs as the eligible input — no orders added, no orders dropped.

**Validates: Requirements 10.7, 15.2**

---

### Property 10: Invalid coordinates filtered from route

*For any* input set containing orders with invalid coordinates (failing `isValidCoord`), none of those orders SHALL appear in the computed route.

**Validates: Requirements 10.4**

---

### Property 11: Monotone 2-opt improvement

*For any* route input, `distanceAfter` SHALL be less than or equal to `distanceBefore` — 2-opt optimisation SHALL never increase total travel distance.

**Validates: Requirements 11.1**

---

### Property 12: Significant 2-opt improvement for large spread routes

*For any* route with 5 or more eligible orders whose maximum pairwise haversine distance exceeds 5 km, the 2-opt improvement percentage (`(distanceBefore - distanceAfter) / distanceBefore * 100`) SHALL be at least 10%.

**Validates: Requirements 11.2**

---

### Property 13: 2-opt unchanged for short routes

*For any* route with fewer than 3 stops, `twoOptOptimize` SHALL return the route in the same order as the input.

**Validates: Requirements 11.4**

---

### Property 14: First-pick optimality

*For any* set of eligible orders and driver position, the first order selected by `computeGreedyRoute` SHALL have the minimum weighted score (`warehouseDist * W1 + driverDist * W2`) among all eligible orders.

**Validates: Requirements 10.1**

---

### Property 15: Single-current invariant

*For any* route arrangement state, at most one order SHALL satisfy `isOrderCurrent(orderId) === true` at any point in time.

**Validates: Requirements 5.4, 14.5**

---

### Property 16: First order is current, not locked

*For any* arranged route, `isOrderCurrent(sortedOrderIds[0])` SHALL return `true` and `isOrderLocked(sortedOrderIds[0])` SHALL return `false`.

**Validates: Requirements 10.5, 14.1**

---

### Property 17: All non-first orders are locked

*For any* arranged route with 2 or more orders, `isOrderLocked(sortedOrderIds[i])` SHALL return `true` for all `i > 0`.

**Validates: Requirements 14.2**

---

### Property 18: Sequential unlock after delivery

*For any* arranged route, when the current order is removed from active orders (simulating delivery completion), the order at the next position in `sortedOrderIds` SHALL become the new `currentOrderId`.

**Validates: Requirements 10.6, 14.3**

---

### Property 19: Terminal state after all deliveries

*For any* arranged route, after all orders are removed from active orders sequentially, `isArranged` SHALL be `false` and `currentOrderId` SHALL be `null`.

**Validates: Requirements 4.4, 14.4**

---

### Property 20: Production guard — simulator is a no-op

*For any* route input, calling `DriverSimulator.start()` when `__DEV__ === false` SHALL result in no simulation starting (no interval created, no position updates, no callbacks fired).

**Validates: Requirements 7.1**

---

### Property 21: Route stability under stress

*For any* randomly generated input of 10–50 eligible orders, `computeGreedyRoute` SHALL complete without throwing an unhandled exception.

**Validates: Requirements 15.3**

---

### Property 22: Performance bound for large routes

*For any* input of 50 or more eligible orders, `computeGreedyRoute` (including 2-opt) SHALL complete in under 2000 milliseconds. The 2-opt phase is additionally bounded at 500 ms (`timeLimitMs = 500`) and 50 iterations (`maxIterations = 50`), ensuring the optimisation step alone consumes at most 25% of the total budget and leaves headroom for greedy scoring and result assembly.

**Validates: Requirements 15.1, 15.4**

---

**Property Reflection — Redundancy Check:**

- Properties 4 and 6 are complementary, not redundant: Property 4 tests directional progress, Property 6 tests coordinate validity of the output. Both are needed.
- Properties 9 and 10 are complementary: Property 9 tests no orders are dropped/added, Property 10 tests invalid orders are excluded. Together they fully specify the filtering contract.
- Properties 15, 16, and 17 are complementary: Property 15 is the universal single-current invariant, Property 16 specifies the first-order state, Property 17 specifies all subsequent orders. No redundancy.
- Properties 18 and 19 are sequential: Property 18 tests one step of the unlock chain, Property 19 tests the terminal state. Both are needed.
- Properties 21 and 22 are complementary: Property 21 tests stability (no exceptions), Property 22 tests performance (timing). Both are needed.

No properties were eliminated as redundant.

---

## Error Handling

### `getDriverLocation()` errors

| Condition | Behaviour |
|---|---|
| `DEV_MODE = false`, permission denied | Throws `Error("Location permission denied")` |
| `DEV_MODE = true`, simulation not started | Throws `Error("Simulation not started — no position available")` |
| expo-location timeout / hardware error | Propagates the original expo-location error |
| Dual-source conflict | Returns simulated value, emits `[SIM] WARNING: dual-source conflict detected` |

### `DriverSimulator` errors

| Condition | Behaviour |
|---|---|
| `start()` called in production (`!__DEV__`) | Logs warning, returns immediately, no-op |
| `start()` called while already running | Stops existing simulation, starts new one |
| `moveTowards` receives NaN coordinates | `isValidCoord` check in the loop catches it; simulator logs error and stops |
| Route array is empty | `start()` logs warning and returns without starting |

### `computeGreedyRoute` errors

| Condition | Behaviour |
|---|---|
| All orders have invalid coordinates | Returns `{ routeBefore: [], routeAfter: [], distanceBefore: 0, distanceAfter: 0 }` |
| Single eligible order | Returns that order; 2-opt is skipped (< 3 stops) |
| NaN in coordinates | `isValidCoord` filter removes the order before routing |

### Test suite errors

- Failing assertions emit `[ROUTE_TEST_FAIL] Scenario=<NAME> Rule=<RULE>` and create a `FailureSnapshot`.
- All snapshots are accumulated and written to `route-test-failures.json` at the end of the run.
- fast-check shrinks failing inputs to the minimal counterexample before reporting.

---

## Testing Strategy

### Dual Testing Approach

Unit tests cover specific examples, edge cases, and integration wiring. Property tests cover universal correctness across all inputs. Both are required for comprehensive coverage.

### Property-Based Testing Library

**fast-check** (already in the project's jest-expo infrastructure). Each property test is configured with `numRuns: 1000` minimum.

Tag format for each property test:
```
// Feature: route-testing-system, Property N: <property_text>
```

### Test File

`apps/customer-app/src/__tests__/routeArrangement.simulation.test.ts`

### Test Suite Structure

```
describe('Route Algorithm — Pure Functions')
  haversineKm
    → identity (Property 1)
    → symmetry (Property 2)
    → triangle inequality (Property 3)
    → known distance example (London → Paris ≈ 340 km)
  isValidCoord
    → (0, 0) returns false [edge case]
    → (null, undefined) returns false [edge case]
    → out-of-bounds returns false [edge case]
    → valid coords return true [example]
  moveTowards
    → progress invariant (Property 4)
    → no-overshoot (Property 5)
    → output validity (Property 6)
    → bearing direction example
  twoOptOptimize
    → unchanged for < 3 stops (Property 13)
    → monotone improvement (Property 11, subset)

describe('Mock Order Factory')
  → coordinate round-trip (Property 7)
  → unique IDs (Property 8)
  → invalid coords produce isValidCoord=false [example]

describe('computeGreedyRoute — Correctness')
  → completeness invariant (Property 9)
  → invalid coords filtered (Property 10)
  → monotone 2-opt improvement (Property 11)
  → significant improvement for large spread (Property 12)
  → first-pick optimality (Property 14)

describe('Route Arrangement — Named Scenarios') [fast-check, 1000+ iterations aggregate]
  → ALL_ORDERS_NEAR_WAREHOUSE
  → MIXED_CITY_VILLAGE
  → DRIVER_STARTS_FAR
  → RANDOM_SCATTERED
  → SAME_LOCATION_ORDERS
  → EDGE_CASES

describe('Route Validation Rules')
  → no zig-zag (dist(A→B)+dist(B→C) ≤ dist(A→C)×1.5)
  → no extreme jumps (≤ 2× average inter-stop distance)

describe('UI State Validation')
  → first order is current, not locked (Property 16)
  → all non-first orders are locked (Property 17)
  → single-current invariant (Property 15)
  → sequential unlock after delivery (Property 18)
  → terminal state after all deliveries (Property 19)

describe('Performance — Stress Test')
  → 50+ orders < 2000ms (Property 22)
  → 50+ orders completeness under load (Property 9, large input)
  → 100 consecutive runs, no exceptions (Property 21)
  → 2-opt terminates within bound (Property 22)

describe('DriverSimulator — Unit Tests')
  → production guard no-op (Property 20)
  → start initialises position from expo-location
  → moveTowards called every SIM_STEP_INTERVAL (fake timers)
  → arrival detection at ARRIVED_THRESHOLD
  → auto-advance to next order after arrival
  → pause suspends updates, resume continues
  → reset clears all state
  → mutual exclusion: start() stops existing simulation
  → structured log lines emitted

describe('locationService — getDriverLocation()')
  → DEV_MODE=false calls expo-location
  → DEV_MODE=true returns driverLocationStore.current
  → permission denied throws correct error
  → never calls Location.setMockLocation()
  → dual-source conflict: prefers simulated, emits warning

describe('Structured Logging')
  → [ROUTE_TEST] Scenario= pattern
  → [ROUTE_TEST] DriverPosition= pattern
  → [ROUTE_TEST] RouteBefore= pattern
  → [ROUTE_TEST] RouteAfter= pattern
  → [ROUTE_TEST] Improvement= pattern
  → [ROUTE_TEST_FAIL] Scenario= Rule= pattern
  → [SIM] Moving → pattern
  → [SIM] Reached Order → pattern
  → [SIM] Delivered → pattern

describe('Failure Capture')
  → FailureSnapshot created on assertion failure
  → Snapshot contains all required fields
  → route-test-failures.json written when failures exist

describe('Test Run Summary')
  → summary contains total/pass/fail/rate
  → summary contains average 2-opt improvement
  → summary uses [ROUTE_TEST] prefix
```

### Unit Test Balance

Unit tests focus on:
- Specific examples that demonstrate correct behavior (known distances, known coordinates)
- Integration wiring (getDriverLocation routing, hook calling service)
- Edge cases (null coords, empty routes, single-order routes)

Property tests focus on:
- Universal mathematical properties (symmetry, triangle inequality, progress invariant)
- Universal correctness invariants (completeness, single-current, sequential unlock)
- Stability and performance under random inputs

### Property Test Configuration

```typescript
fc.assert(
  fc.property(/* arbitraries */, (/* inputs */) => {
    // Feature: route-testing-system, Property N: <property_text>
    // ... assertion
  }),
  { numRuns: 1000 }
);
```

### Logging and Failure Capture

The `TestLogger` class buffers all log lines in memory and exposes them for assertion. It also writes to `console.log` for stdout visibility. On test run completion, if any `FailureSnapshot` objects were accumulated, they are written to `apps/customer-app/src/__tests__/route-test-failures.json`.

Summary output format:
```
[ROUTE_TEST] ===== SUMMARY =====
[ROUTE_TEST] Total: 1000 | Pass: 987 | Fail: 13 | Rate: 98.7%
[ROUTE_TEST] Avg 2-opt improvement: 14.2%
[ROUTE_TEST] Top failures: [...]
```
