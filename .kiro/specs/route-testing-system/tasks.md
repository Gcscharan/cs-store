# Implementation Tasks: Route Testing System

## Phase 1 — Pure Algorithm (Foundation)

- [x] 1.1 Create `apps/customer-app/src/utils/routeAlgorithm.ts`
  - Implement `haversineKm(lat1, lng1, lat2, lng2): number`
  - Implement `isValidCoord(lat?, lng?): boolean` — returns false for (0,0), null, undefined, out-of-range
  - Implement `moveTowards(current, target, stepMeters): LatLng` — bearing formula, no-overshoot guard, no side effects
  - Implement `twoOptOptimize(route, startLat, startLng, maxIterations = 50, timeLimitMs = 500): RouteStop[]` — time-bounded loop with `console.warn` on limit hit
  - Implement `computeGreedyRoute(eligible, driverLat, driverLng): RouteResult` — phase-1 weighted score, phase-2+ nearest-neighbour, end penalty, calls twoOptOptimize, returns `{ routeBefore, routeAfter, distanceBefore, distanceAfter }`
  - Export `RouteStop`, `RouteResult` interfaces
  - ZERO imports from React, Expo, AsyncStorage, or any async dependency

- [x] 1.2 Create `apps/customer-app/src/__tests__/routeAlgorithm.property.test.ts`
  - Unit test: `haversineKm` identity — same point returns 0
  - Property test: `haversineKm` symmetry — `haversineKm(A,B) === haversineKm(B,A)` (Property 2, 1000 runs)
  - Property test: `haversineKm` triangle inequality — `dist(A,C) <= dist(A,B) + dist(B,C)` (Property 3, 1000 runs)
  - Unit test: known distance example (London → Paris ≈ 340 km)
  - Unit test: `isValidCoord(0, 0)` returns false; `isValidCoord(null, undefined)` returns false; out-of-range returns false; valid coords return true
  - Property test: `moveTowards` progress invariant — distance to target strictly decreases (Property 4, 1000 runs)
  - Property test: `moveTowards` no-overshoot — step >= remaining distance returns target within 0.0001° (Property 5, 1000 runs)
  - Property test: `moveTowards` output validity — result always satisfies `isValidCoord` (Property 6, 1000 runs)
  - Unit test: `twoOptOptimize` returns unchanged route for < 3 stops (Property 13)
  - Property test: `twoOptOptimize` monotone improvement — `distanceAfter <= distanceBefore` (Property 11, 1000 runs)

## Phase 2 — Location System

- [x] 2.1 Create `apps/customer-app/src/simulator/driverLocationStore.ts`
  - Plain JS singleton object (no React, no hooks)
  - Fields: `current: LatLng | null`, `isSimulationRunning: boolean`
  - Method `set(pos: LatLng): void` — updates `current`, notifies all subscribers synchronously
  - Method `setSimulationRunning(running: boolean): void`
  - Method `subscribe(cb: (pos: LatLng) => void): () => void` — returns unsubscribe function
  - Export as `driverLocationStore`

- [x] 2.2 Create `apps/customer-app/src/services/locationService.ts`
  - Derive `DEV_MODE` from `__DEV__ || process.env.EXPO_PUBLIC_DEV_MODE === 'true'`
  - `DEV_MODE = false` path: request foreground permissions → throw `"Location permission denied"` if denied → call `Location.getCurrentPositionAsync({ accuracy: Balanced })` → return `{ lat, lng }`
  - `DEV_MODE = true` path: if `driverLocationStore.current` is null (simulator not yet started), return `WAREHOUSE` as safe fallback (`{ lat: 17.0956, lng: 80.6089 }`) instead of throwing — this prevents crashes when `useRouteArrangement` calls `getDriverLocation()` before simulation starts
  - Dual-source conflict detection: if both real GPS and simulated are active, prefer simulated and emit `[SIM] WARNING: dual-source conflict detected`
  - Never call `Location.setMockLocation()`

- [x] 2.3 Update `apps/customer-app/src/hooks/delivery/useRouteArrangement.ts`
  - Replace direct `expo-location` call with `getDriverLocation()` from `locationService`
  - Add freeze guard at top of `arrangeRoute()`: `if (driverLocationStore.isSimulationRunning && isArranged) { console.warn(...); return; }` — guard exits `arrangeRoute` only, does not block position updates or distance calculations
  - Subscribe to `driverLocationStore` with a 1-second throttle to update internal driver position reference (for distance display and arrival detection); do not re-sort on these updates:
    ```typescript
    let lastUpdate = 0;
    driverLocationStore.subscribe((pos) => {
      const now = Date.now();
      if (now - lastUpdate < 1000) return; // throttle — prevent unnecessary re-renders at 5× speed
      lastUpdate = now;
      setDriverLocation(pos);
    });
    ```
  - Remove duplicate `AsyncStorage.setItem` calls (currently called twice)

## Phase 3 — Driver Simulator

- [x] 3.1 Create `apps/customer-app/src/simulator/DriverSimulator.ts` — class skeleton and state
  - Define `SimulatorState` type: `isRunning`, `isPaused`, `currentPosition`, `currentIndex`, `route`, `speedMultiplier`
  - Implement singleton `DriverSimulator` class
  - Implement `start(route: Order[], isArranged: boolean): void`:
    - Production guard: `if (!__DEV__) { console.warn(...); return; }`
    - Pre-condition guard: `if (!isArranged) { throw new Error('Route must be arranged before starting simulation'); }`
    - Stop existing simulation if running before starting new one
    - Initialise position from expo-location (one-time read)
    - Call `driverLocationStore.setSimulationRunning(true)`
  - Implement `pause()`, `resume()`, `reset()` (reset calls `setSimulationRunning(false)`)
  - Implement `setSpeed(multiplier: 1 | 2 | 5): void`
  - Implement `getState(): Readonly<SimulatorState>`
  - Export singleton as `driverSimulator`

- [x] 3.2 Implement movement loop in `DriverSimulator`
  - `setInterval` at `SIM_STEP_INTERVAL = 2000ms / speedMultiplier`
  - Each tick: compute `stepMeters = 75 * speedMultiplier`, call `moveTowards(currentPosition, targetOrder.address, stepMeters)`, call `driverLocationStore.set(next)`
  - Emit `[SIM] Moving → <lat.toFixed(6)>,<lng.toFixed(6)>` each tick
  - Check arrival: if `haversineKm(...) * 1000 < ARRIVED_THRESHOLD (40m)`, call `handleArrival(orderId)`
  - Respect `isPaused` flag — skip tick body when paused

- [x] 3.3 Implement auto-delivery flow in `DriverSimulator`
  - `handleArrival(orderId)`: emit `[SIM] Reached Order → <orderId>`, call `onArrived(orderId)`, await 2000ms, call `onDelivered(orderId)`, emit `[SIM] Delivered → <orderId>`, call `moveToNextOrder()`
  - `moveToNextOrder()`: increment `currentIndex`; if past end of route, call `onRouteComplete()` and stop interval
  - Expose `onArrived`, `onDelivered`, `onRouteComplete` as settable callback properties

## Phase 4 — Hook Integration

- [x] 4.1 Wire `DriverSimulator` callbacks into `DeliveryHomeTab.tsx`
  - Set `driverSimulator.onArrived` → update order status to `arrived` in active orders state
  - Set `driverSimulator.onDelivered` → trigger delivery complete mutation for that order
  - Set `driverSimulator.onRouteComplete` → reset arrangement (`isArranged = false`, `currentOrderId = null`)
  - Wire up before rendering; add cleanup on unmount to prevent memory leaks and background movement:
    ```typescript
    useEffect(() => {
      return () => {
        driverSimulator.reset(); // stops interval + clears state on unmount
      };
    }, []);
    ```

- [x] 4.2 Pass ordered `Order[]` (already sorted) from `useRouteArrangement` to `DriverSimulator.start()`
  - Derive the ordered `Order[]` by mapping `sortedOrderIds` → `activeOrders` lookup: `sortedOrderIds.map(id => activeOrders.find(o => o._id === id)).filter(Boolean) as Order[]`
  - Pass this pre-sorted `Order[]` directly as the first argument — `DriverSimulator` receives a fully ordered route, no ID lookup needed inside the simulator
  - Pass `isArranged` as second argument: `driverSimulator.start(orderedRoute, isArranged)`
  - Ensure `DebugPanel` receives `isArranged` and `sortedOrderIds` as props

## Phase 5 — Debug Panel (DEV ONLY)

- [x] 5.1 Create `apps/customer-app/src/dev/DebugPanel.tsx`
  - Return `null` immediately if `!__DEV__`
  - Props: `activeOrders: Order[]`, `isArranged: boolean`, `sortedOrderIds: string[]`
  - "Start Simulation" button: disabled when `!isArranged`, tooltip `"Arrange route first before starting simulation"` when disabled; calls `driverSimulator.start(orderedRoute, isArranged)` when enabled
  - "Pause" button: calls `driverSimulator.pause()`; disabled when not running
  - "Resume" button: calls `driverSimulator.resume()`; disabled when not paused
  - "Reset" button: calls `driverSimulator.reset()`
  - Speed selector: 1×, 2×, 5× — calls `driverSimulator.setSpeed(multiplier)`
  - Live display: current `lat, lng` from `driverLocationStore.current`; current target order ID from `driverSimulator.getState().currentIndex`

- [x] 5.2 Integrate `DebugPanel` into `DeliveryHomeTab.tsx`
  - Render `<DebugPanel>` below ControlBar
  - Pass `activeOrders`, `isArranged`, `sortedOrderIds` as props
  - Import is tree-shaken in production because component returns null when `!__DEV__`

## Phase 6 — Testing System

- [x] 6.1 Create `apps/customer-app/src/__tests__/routeArrangement.simulation.test.ts` — scaffold
  - Implement `TestLogger` class: buffers `[ROUTE_TEST]` / `[ROUTE_TEST_FAIL]` / `[SIM]` lines in memory; exposes `getLines()` for assertion; also writes to `console.log`
  - Implement `createMockOrder({ lat, lng, status?, id? }): Order` factory — unique UUID-prefix IDs when none supplied; stores coords exactly as given
  - Implement `FailureSnapshot` accumulator: collects snapshots during run; writes to `route-test-failures.json` in `afterAll` if any failures exist
  - Define `WAREHOUSE = { lat: 17.0956, lng: 80.6089 }`

- [x] 6.2 Add fast-check scenario tests (1000+ iterations aggregate)
  - `ALL_ORDERS_NEAR_WAREHOUSE`: 5–15 orders within 2 km of WAREHOUSE — assert completeness, invalid coord filtering, first-pick optimality
  - `MIXED_CITY_VILLAGE`: 5–15 orders split between ≤5 km and 10–30 km from WAREHOUSE — same assertions
  - `DRIVER_STARTS_FAR`: driver start > 20 km from WAREHOUSE — assert route still valid and complete
  - `RANDOM_SCATTERED`: fast-check arbitraries for `lat ∈ [16.5, 17.5]`, `lng ∈ [80.0, 81.0]` — assert completeness and no exceptions
  - `SAME_LOCATION_ORDERS`: 5–10 orders with identical coordinates — assert no crash, completeness
  - `EDGE_CASES`: at least one `(0,0)` order, one null-coord order, one non-eligible-status order — assert those orders are filtered from route
  - Total fast-check `numRuns` across all scenarios sums to ≥ 1000

- [x] 6.3 Add validation rule tests
  - No zig-zag: for all consecutive triples (A, B, C) where `distAC > 0.2 km` (skip very short triangles to avoid GPS noise false positives), assert `dist(A→B) + dist(B→C) ≤ dist(A→C) × 1.5`
  - No extreme jumps: for all consecutive pairs (i, i+1), assert distance ≤ 2× average inter-stop distance
  - Sequential unlock: after removing current order, next order in `sortedOrderIds` becomes `currentOrderId`
  - Single-current invariant: at most one order satisfies `isOrderCurrent` at any time (Property 15)
  - Terminal state: after all orders removed sequentially, `isArranged = false` and `currentOrderId = null` (Property 19)

- [x] 6.4 Add performance stress test
  - Generate 50+ random eligible orders; assert `computeGreedyRoute` completes in < 2000ms (Property 22)
  - Assert returned route length equals input eligible count (Property 9 under load)
  - Run `computeGreedyRoute` 100 consecutive times with 10–50 random orders; assert no unhandled exceptions (Property 21)
  - Assert 2-opt terminates (time-bounded at 500ms, so this is guaranteed by design — assert the warn log is emitted when limit is hit)

- [x] 6.5 Add failure snapshot writer and summary
  - Accumulate `FailureSnapshot` objects on each assertion failure: `{ scenario, driverPosition, inputOrders, routeBefore, routeAfter, failingRule, timestamp }`
  - In `afterAll`: if any failures, write array to `apps/customer-app/src/__tests__/route-test-failures.json`
  - Print `[ROUTE_TEST] SUMMARY` block: total iterations, passes, failures, pass rate %, average 2-opt improvement %, top 10 worst-case snapshots

## Phase 7 — Safety

- [ ] 7.1 Add production guard test
  - Mock `__DEV__ = false` in test environment
  - Call `driverSimulator.start(mockRoute, true)`
  - Assert: no interval created, no position updates emitted, no callbacks fired, warning log emitted (Property 20)

- [ ] 7.2 Add dual-source conflict test
  - Set up `driverLocationStore` with a simulated position (`DEV_MODE = true`)
  - Simultaneously mock expo-location to return a real GPS fix
  - Call `getDriverLocation()`
  - Assert: returns the simulated position (not real GPS)
  - Assert: `[SIM] WARNING: dual-source conflict detected` is present in `TestLogger` buffer
