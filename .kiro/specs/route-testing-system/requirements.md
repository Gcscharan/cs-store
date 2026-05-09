# Requirements Document

## Introduction

A fully automated route testing system for the delivery app that simulates driver movement and validates the route arrangement logic in `useRouteArrangement.ts` without any manual interaction. The system runs as a Jest test suite (using the existing jest-expo + fast-check infrastructure) and covers location simulation, scenario generation, validation, distance quality checks, structured logging, failure capture, UI-state validation, and performance stress testing.

The system also includes a `DriverSimulator` module and a `getDriverLocation()` abstraction that override the app's internal `driverLocation` state only — no OS/device-level GPS mocking (e.g., `Location.setMockLocation()`) is used. This is a dev/test-mode-only feature controlled by a `DEV_MODE` flag.

---

## Glossary

- **Route_Testing_System**: The automated test suite described in this document.
- **DriverSimulator**: The module that simulates driver movement by updating the app's internal driver location state step-by-step along a route. Does NOT use OS-level GPS mocking.
- **getDriverLocation**: The central location abstraction function. Returns real GPS via expo-location when `DEV_MODE = false`, or simulated location from DriverSimulator when `DEV_MODE = true`.
- **DEV_MODE**: A boolean flag derived from React Native's `__DEV__` global or an environment variable. Controls whether real or simulated location is used.
- **Location_Simulator**: Alias for DriverSimulator in the context of the test suite (produces a sequence of GPS coordinates for test scenarios).
- **Route_Arranger**: The pure, testable extraction of the core algorithm from `useRouteArrangement.ts` (haversine scoring, 2-opt optimisation, coordinate filtering).
- **Mock_Order**: A synthetic `Order` object with realistic coordinates used exclusively in tests.
- **Scenario**: A named test case that defines a driver start position, a set of Mock_Orders, and the expected validation outcomes.
- **Validation_Rule**: A deterministic assertion applied to a computed route.
- **2-opt**: The segment-reversal optimisation algorithm already implemented in `useRouteArrangement.ts`.
- **WAREHOUSE**: Fixed reference point `{ lat: 17.0956, lng: 80.6089 }` (Boya Bazar, Tiruvuru).
- **haversineKm**: The great-circle distance function already implemented in `useRouteArrangement.ts`.
- **isValidCoord**: The coordinate validation function already implemented in `useRouteArrangement.ts`.
- **moveTowards**: The path interpolation function that calculates a new `{ lat, lng }` by moving a fixed number of meters from a current position toward a target position along the bearing between them.
- **Eligible_Status**: One of `picked_up`, `in_transit`, `out_for_delivery`, `arrived`.
- **Test_Logger**: The component that emits structured `[ROUTE_TEST]` / `[ROUTE_TEST_FAIL]` / `[SIM]` log lines and persists failure snapshots to JSON.
- **Failure_Snapshot**: A JSON object capturing input orders, driver location, and computed route for a failing assertion.
- **Stress_Test**: A scenario with 50+ Mock_Orders used to validate performance bounds.
- **Debug_Panel**: A DEV_MODE-only UI component that exposes simulation controls (Start, Pause, Reset, Speed).
- **ARRIVED_THRESHOLD**: The distance in meters (30–50 m) within which the DriverSimulator considers the driver to have reached an order's location.
- **SIM_STEP_INTERVAL**: The time between DriverSimulator position updates (2 seconds at 1× speed).
- **SIM_STEP_DISTANCE**: The distance moved per step (50–100 meters at 1× speed).

---

## Requirements

### Requirement 1: Location Abstraction Layer (`getDriverLocation`)

**User Story:** As a developer, I want a single `getDriverLocation()` function that returns either real GPS or simulated location depending on `DEV_MODE`, so that the rest of the app never calls expo-location directly and simulation requires no OS-level mocking.

#### Acceptance Criteria

1. THE Route_Testing_System SHALL implement a `getDriverLocation()` function that returns a `Promise<{ lat: number; lng: number }>`.
2. WHEN `DEV_MODE = false`, THE `getDriverLocation` function SHALL obtain the driver's position by calling `expo-location`'s `getCurrentPositionAsync` and returning the result as `{ lat, lng }`.
3. WHEN `DEV_MODE = true`, THE `getDriverLocation` function SHALL return the current simulated position from the DriverSimulator's internal state instead of calling expo-location.
4. THE `getDriverLocation` function SHALL NOT call `Location.setMockLocation()` or any other OS/device-level GPS mocking API under any circumstances.
5. IF `DEV_MODE = false` and expo-location permission is denied, THEN THE `getDriverLocation` function SHALL throw an error with the message `"Location permission denied"`.
6. THE `useRouteArrangement` hook SHALL call `getDriverLocation()` instead of calling `expo-location` directly, so that simulation is transparent to the hook.

---

### Requirement 2: DriverSimulator Module

**User Story:** As a test engineer, I want a DriverSimulator module that moves the app's internal driver location state step-by-step along a route, so that I can test route logic without a real device or OS-level GPS mocking.

#### Acceptance Criteria

1. THE DriverSimulator SHALL accept a route defined as an ordered list of orders, each with `{ _id, address: { lat, lng } }` fields.
2. WHEN the DriverSimulator is started, THE DriverSimulator SHALL initialise its current position to the driver's actual device location at the time `start()` is called (obtained via expo-location, one-time read).
3. WHEN the DriverSimulator is running, THE DriverSimulator SHALL call `moveTowards(currentPosition, targetOrderLocation, stepMeters)` every SIM_STEP_INTERVAL to advance the simulated position toward the current target order.
4. THE DriverSimulator SHALL move 50–100 meters per step at 1× speed (SIM_STEP_DISTANCE), scaling linearly with the active speed multiplier (2× = 100–200 m/step, 5× = 250–500 m/step).
5. WHEN the DriverSimulator's current position is within ARRIVED_THRESHOLD (30–50 m) of the current target order's location, THE DriverSimulator SHALL mark that order as arrived and emit an `onArrived(orderId)` event.
6. WHEN an `onArrived` event is emitted, THE DriverSimulator SHALL automatically advance to the next order in the route list without requiring manual intervention.
7. WHEN the last order in the route has been marked arrived, THE DriverSimulator SHALL emit an `onRouteComplete` event and stop advancing.
8. IF the DriverSimulator is started while another simulation is already running, THEN THE DriverSimulator SHALL stop the existing simulation before starting the new one.
9. THE DriverSimulator SHALL expose a `pause()` method that suspends position updates without resetting state, and a `resume()` method that continues from the paused position.
10. THE DriverSimulator SHALL expose a `reset()` method that stops the simulation and clears all internal state.
11. THE DriverSimulator SHALL emit `[SIM] Moving → <lat>,<lng>` log lines each step, `[SIM] Reached Order → <orderId>` on arrival, and `[SIM] Delivered → <orderId>` after delivery completion.

---

### Requirement 3: `moveTowards` Path Interpolation

**User Story:** As a developer, I want a pure `moveTowards(current, target, stepMeters)` function, so that the DriverSimulator can advance position incrementally along the correct bearing without depending on any external library.

#### Acceptance Criteria

1. THE `moveTowards` function SHALL accept `current: { lat: number; lng: number }`, `target: { lat: number; lng: number }`, and `stepMeters: number`, and SHALL return a new `{ lat: number; lng: number }`.
2. THE `moveTowards` function SHALL calculate the bearing from `current` to `target` using the standard forward-azimuth formula.
3. THE `moveTowards` function SHALL advance the position by `stepKm / totalDistanceKm` of the remaining distance along the bearing, where `stepKm = stepMeters / 1000`.
4. WHEN `stepMeters` is greater than or equal to the remaining distance to `target`, THE `moveTowards` function SHALL return `target` exactly (no overshoot).
5. THE `moveTowards` function SHALL have no side effects and SHALL NOT import React, expo-location, or any async dependency.
6. FOR ALL valid `(current, target, stepMeters)` inputs where `stepMeters < haversineKm(current, target) * 1000`, the distance from the returned position to `target` SHALL be strictly less than the distance from `current` to `target` (progress invariant).
7. FOR ALL valid inputs, the returned `{ lat, lng }` SHALL satisfy `isValidCoord(lat, lng)` (output validity invariant).

---

### Requirement 4: Auto Delivery Flow

**User Story:** As a test engineer, I want the DriverSimulator to automatically trigger ARRIVED and DELIVERY_COMPLETE state transitions when the simulated driver reaches an order, so that the full delivery lifecycle can be exercised without manual input.

#### Acceptance Criteria

1. WHEN the DriverSimulator emits `onArrived(orderId)`, THE Route_Testing_System SHALL update the order's status to `arrived` in the app's active orders state.
2. WHEN an order's status is set to `arrived` by the simulator, THE Route_Testing_System SHALL wait 2–3 seconds and then automatically trigger a `DELIVERY_COMPLETE` transition for that order.
3. WHEN `DELIVERY_COMPLETE` is triggered for an order, THE Route_Testing_System SHALL remove that order from the active orders list and advance `currentOrderId` to the next order in `sortedOrderIds`.
4. WHEN the active orders list becomes empty after sequential deliveries, THE Route_Testing_System SHALL assert that `isArranged` resets to `false` and `currentOrderId` resets to `null`.
5. THE auto delivery flow SHALL only execute when `DEV_MODE = true`.

---

### Requirement 5: State Integration

**User Story:** As a developer, I want the DriverSimulator to keep all relevant app state in sync as it moves, so that the UI and route logic reflect the simulated position accurately.

#### Acceptance Criteria

1. WHEN the DriverSimulator updates its position, THE DriverSimulator SHALL update the driver location state consumed by `useRouteArrangement` so that distance calculations use the simulated position.
2. WHEN the DriverSimulator updates its position, THE DriverSimulator SHALL trigger a re-evaluation of the `useRouteArrangement` hook's route ordering if the driver has moved more than 100 meters since the last arrangement.
3. WHEN the DriverSimulator advances to a new target order, THE DriverSimulator SHALL update `currentOrderId` in the route arrangement state to reflect the new CURRENT order.
4. THE DriverSimulator SHALL ensure that at most one order satisfies `isOrderCurrent` at any time during simulation (single-current invariant).
5. WHEN the DriverSimulator is running, THE DriverSimulator SHALL NOT allow real GPS updates from expo-location to overwrite the simulated driver location state.

---

### Requirement 6: DEV-Only Debug Panel

**User Story:** As a developer, I want a Debug_Panel UI component that exposes simulation controls, so that I can start, pause, reset, and speed up the simulation during development without modifying code.

#### Acceptance Criteria

1. THE Debug_Panel SHALL only render when `DEV_MODE = true`; it SHALL render nothing (null) in production builds.
2. THE Debug_Panel SHALL expose a "Start Simulation" button that calls `DriverSimulator.start()` with the current active route.
3. THE Debug_Panel SHALL expose a "Pause" button that calls `DriverSimulator.pause()` and a "Resume" button that calls `DriverSimulator.resume()`.
4. THE Debug_Panel SHALL expose a "Reset" button that calls `DriverSimulator.reset()` and clears all simulated state.
5. THE Debug_Panel SHALL expose a speed selector with options 1×, 2×, and 5× that sets the DriverSimulator's speed multiplier.
6. WHEN the DriverSimulator is not running, THE Debug_Panel SHALL display the "Start Simulation" button as active and the "Pause" button as disabled.
7. WHEN the DriverSimulator is running, THE Debug_Panel SHALL display the current simulated `{ lat, lng }` position and the ID of the current target order.

---

### Requirement 7: Safety and Production Guard

**User Story:** As a developer, I want the simulation to be automatically disabled in production builds and to prevent conflicts with real GPS, so that simulated data never reaches production users.

#### Acceptance Criteria

1. WHEN `DEV_MODE = false`, THE DriverSimulator SHALL refuse to start and SHALL log a warning if `start()` is called.
2. THE `getDriverLocation` function SHALL derive `DEV_MODE` from `__DEV__` (React Native global) or an explicit environment variable; it SHALL NOT rely solely on a runtime flag that could be accidentally enabled in production.
3. WHEN real GPS becomes available (expo-location returns a valid fix) while `DEV_MODE = true`, THE Debug_Panel SHALL display an option to switch back to real GPS, which stops the simulation and re-enables expo-location as the location source.
4. THE Route_Testing_System SHALL assert that real GPS updates and simulated updates cannot both be active simultaneously (mutual exclusion invariant).
5. IF both real GPS and simulated GPS are somehow active at the same time, THEN THE `getDriverLocation` function SHALL prefer the simulated source and emit a `[SIM] WARNING: dual-source conflict detected` log line.

---

### Requirement 8: Mock Order Generation

**User Story:** As a test engineer, I want a deterministic Mock_Order factory, so that I can generate realistic test orders with valid coordinates for any scenario.

#### Acceptance Criteria

1. THE Mock_Order factory SHALL accept a coordinate `{ lat, lng }`, an order status from Eligible_Status, and an optional order ID, and SHALL return a complete `Order`-shaped object.
2. THE Mock_Order factory SHALL generate unique order IDs when none is provided.
3. WHEN coordinates outside the range `lat ∈ [-90, 90]` and `lng ∈ [-180, 180]` are supplied, THEN THE Mock_Order factory SHALL produce an order whose `isValidCoord` check returns `false`.
4. THE Mock_Order factory SHALL produce orders whose `address.lat` and `address.lng` fields match the supplied coordinates exactly.
5. FOR ALL generated Mock_Orders with valid coordinates, `isValidCoord(order.address.lat, order.address.lng)` SHALL return `true` (invariant property).

---

### Requirement 9: Named Test Scenarios

**User Story:** As a test engineer, I want six named Scenarios covering distinct geographic and edge-case distributions, so that the Route_Arranger is exercised across a representative input space.

#### Acceptance Criteria

1. THE Route_Testing_System SHALL implement a scenario named `ALL_ORDERS_NEAR_WAREHOUSE` that generates 5–15 Mock_Orders with coordinates within 2 km of WAREHOUSE.
2. THE Route_Testing_System SHALL implement a scenario named `MIXED_CITY_VILLAGE` that generates 5–15 Mock_Orders split between coordinates within 5 km of WAREHOUSE and coordinates 10–30 km from WAREHOUSE.
3. THE Route_Testing_System SHALL implement a scenario named `DRIVER_STARTS_FAR` that places the simulated driver start position more than 20 km from WAREHOUSE.
4. THE Route_Testing_System SHALL implement a scenario named `RANDOM_SCATTERED` that generates 5–15 Mock_Orders using fast-check arbitraries for coordinates within the region `lat ∈ [16.5, 17.5]`, `lng ∈ [80.0, 81.0]`.
5. THE Route_Testing_System SHALL implement a scenario named `SAME_LOCATION_ORDERS` that generates 5–10 Mock_Orders sharing identical coordinates.
6. THE Route_Testing_System SHALL implement a scenario named `EDGE_CASES` that includes at least one order with `lat = 0, lng = 0`, at least one order with `null` coordinates, and at least one order with a non-Eligible_Status.
7. WHEN any Scenario is executed, THE Route_Testing_System SHALL run the Route_Arranger at least 1000 iterations in aggregate across all Scenarios using fast-check property runners.

---

### Requirement 10: Route Validation Rules

**User Story:** As a test engineer, I want deterministic Validation_Rules applied to every computed route, so that correctness of the Route_Arranger is asserted automatically.

#### Acceptance Criteria

1. WHEN a route is computed with at least one eligible order, THE Route_Testing_System SHALL assert that the first order in the route is the one with the lowest weighted score (warehouse distance × W1 + driver distance × W2) among all eligible orders for the first-pick phase.
2. WHEN a route contains three or more stops, THE Route_Testing_System SHALL assert that no three consecutive stops form a back-and-forth pattern where `dist(A→B) + dist(B→C) > dist(A→C) × 1.5` (zig-zag detection).
3. FOR ALL consecutive stop pairs `(i, i+1)` in a computed route, THE Route_Testing_System SHALL assert that the distance between them does not exceed twice the average inter-stop distance of the route (no extreme outlier jumps).
4. WHEN the Route_Arranger processes a set of orders containing invalid coordinates, THE Route_Testing_System SHALL assert that no order with an invalid coordinate appears in the computed route.
5. WHEN a route is computed, THE Route_Testing_System SHALL assert that the first order in `sortedOrderIds` is designated as `currentOrderId` (CURRENT order is always first).
6. WHEN a simulated delivery completion is applied (removing the current order from active orders), THE Route_Testing_System SHALL assert that the next order in `sortedOrderIds` becomes the new `currentOrderId` (sequential unlock property).
7. FOR ALL computed routes, the set of order IDs in the route SHALL equal the set of eligible order IDs from the input (no orders added or dropped — completeness invariant).

---

### Requirement 11: Distance Quality (2-opt Improvement)

**User Story:** As a test engineer, I want distance quality assertions comparing pre- and post-2-opt routes, so that the optimisation step is verified to reduce total travel distance.

#### Acceptance Criteria

1. FOR ALL computed routes, THE Route_Testing_System SHALL assert that the total haversine distance of the post-2-opt route is less than or equal to the total haversine distance of the pre-2-opt route (monotone improvement property).
2. WHEN a route has 5 or more eligible orders whose coordinates span more than 5 km (max pairwise distance), THE Route_Testing_System SHALL assert that the 2-opt improvement is at least 10%.
3. THE Route_Testing_System SHALL calculate and expose both `distanceBefore` and `distanceAfter` values for every route computation so that improvement percentage can be logged and asserted.
4. FOR ALL routes with fewer than 3 stops, THE Route_Testing_System SHALL assert that the 2-opt step returns the route unchanged (edge-case invariant).

---

### Requirement 12: Structured Logging

**User Story:** As a test engineer, I want every route computation and simulation step to emit structured log lines with consistent prefixes, so that test runs are auditable and diagnosable.

#### Acceptance Criteria

1. WHEN a Scenario begins execution, THE Test_Logger SHALL emit a line matching the pattern `[ROUTE_TEST] Scenario=<SCENARIO_NAME>`.
2. WHEN a driver position is used for route computation, THE Test_Logger SHALL emit a line matching the pattern `[ROUTE_TEST] DriverPosition=<lat>,<lng>` with coordinates rounded to 4 decimal places.
3. WHEN a route is computed before 2-opt, THE Test_Logger SHALL emit a line matching the pattern `[ROUTE_TEST] RouteBefore=[<id1>,<id2>,...]` using the last 6 characters of each order ID.
4. WHEN a route is computed after 2-opt, THE Test_Logger SHALL emit a line matching the pattern `[ROUTE_TEST] RouteAfter=[<id1>,<id2>,...]` using the last 6 characters of each order ID.
5. WHEN a route computation completes, THE Test_Logger SHALL emit a line matching the pattern `[ROUTE_TEST] Improvement=<N>%` where N is rounded to the nearest integer.
6. THE Test_Logger SHALL buffer all log lines for a test run and expose them for assertion in tests (logs are not only written to stdout).
7. WHEN the DriverSimulator advances its position, THE Test_Logger SHALL emit `[SIM] Moving → <lat>,<lng>` with coordinates rounded to 6 decimal places.
8. WHEN the DriverSimulator reaches an order's location, THE Test_Logger SHALL emit `[SIM] Reached Order → <orderId>`.
9. WHEN the DriverSimulator triggers delivery completion for an order, THE Test_Logger SHALL emit `[SIM] Delivered → <orderId>`.
10. WHEN a dual-source GPS conflict is detected, THE Test_Logger SHALL emit `[SIM] WARNING: dual-source conflict detected`.

---

### Requirement 13: Failure Detection and Capture

**User Story:** As a test engineer, I want automatic failure capture with structured JSON snapshots, so that any failing route assertion can be reproduced and debugged offline.

#### Acceptance Criteria

1. WHEN a Validation_Rule assertion fails, THE Test_Logger SHALL emit a line matching the pattern `[ROUTE_TEST_FAIL] Scenario=<SCENARIO_NAME> Rule=<RULE_NAME>`.
2. WHEN a failure is detected, THE Route_Testing_System SHALL create a Failure_Snapshot object containing: the Scenario name, the driver position, the full list of input Mock_Orders (with coordinates and statuses), the pre-2-opt route order IDs, the post-2-opt route order IDs, and the name of the failing Validation_Rule.
3. THE Route_Testing_System SHALL accumulate all Failure_Snapshots for a test run and expose them as a structured array accessible after the run completes.
4. WHEN the test run completes and at least one failure occurred, THE Route_Testing_System SHALL write all Failure_Snapshots to a JSON file at `apps/customer-app/src/__tests__/route-test-failures.json`.
5. THE Route_Testing_System SHALL capture the top 10 most-failed Scenarios (by failure count) and include them in the final summary output.

---

### Requirement 14: UI State Validation

**User Story:** As a test engineer, I want assertions on the logical UI state produced by the Route_Arranger, so that lock/unlock behaviour and order lifecycle transitions are verified without rendering components.

#### Acceptance Criteria

1. WHEN a route is arranged, THE Route_Testing_System SHALL assert that `isOrderCurrent(sortedOrderIds[0])` returns `true` and `isOrderLocked(sortedOrderIds[0])` returns `false`.
2. WHEN a route is arranged and contains more than one order, THE Route_Testing_System SHALL assert that `isOrderLocked(sortedOrderIds[i])` returns `true` for all `i > 0`.
3. WHEN the current order is removed from active orders (simulating delivery completion), THE Route_Testing_System SHALL assert that the previously locked second order becomes current (`isOrderCurrent` returns `true`).
4. WHEN all orders are removed from active orders sequentially, THE Route_Testing_System SHALL assert that `isArranged` resets to `false` and `currentOrderId` resets to `null`.
5. FOR ALL route states, THE Route_Testing_System SHALL assert that at most one order satisfies `isOrderCurrent` at any time (single-current invariant).

---

### Requirement 15: Performance and Stress Testing

**User Story:** As a test engineer, I want a Stress_Test scenario with 50+ orders that asserts timing and stability bounds, so that the Route_Arranger is verified to remain performant under load.

#### Acceptance Criteria

1. WHEN the Route_Arranger is invoked with 50 or more eligible Mock_Orders, THE Route_Testing_System SHALL assert that the computation completes in under 2000 milliseconds.
2. WHEN the Route_Arranger is invoked with 50 or more eligible Mock_Orders, THE Route_Testing_System SHALL assert that the returned route contains exactly the same number of orders as the eligible input (no orders lost under load).
3. WHEN the Route_Arranger is invoked 100 consecutive times with randomly generated inputs of 10–50 orders, THE Route_Testing_System SHALL assert that no invocation throws an unhandled exception (stability property).
4. WHEN the Route_Arranger is invoked with 50 or more eligible Mock_Orders, THE Route_Testing_System SHALL assert that the 2-opt optimisation terminates (does not loop infinitely) within the 2000 ms bound.

---

### Requirement 16: Test Run Summary Output

**User Story:** As a test engineer, I want a structured summary printed at the end of the test run, so that pass/fail counts, average improvement, and worst-case scenarios are immediately visible.

#### Acceptance Criteria

1. WHEN the test run completes, THE Route_Testing_System SHALL print a summary containing: total iterations run, total passes, total failures, and overall pass rate as a percentage.
2. WHEN the test run completes, THE Route_Testing_System SHALL print the average 2-opt improvement percentage across all successful route computations.
3. WHEN the test run completes and at least one failure occurred, THE Route_Testing_System SHALL print the top 10 worst-case Failure_Snapshots ordered by the number of Validation_Rules violated.
4. THE Route_Testing_System SHALL emit the summary using the `[ROUTE_TEST]` prefix so it is consistent with the structured logging format.

---

### Requirement 17: Pure Algorithm Extraction (Testability)

**User Story:** As a test engineer, I want the core route algorithm functions exported as pure, side-effect-free functions, so that they can be unit-tested and property-tested without mocking React hooks, AsyncStorage, or expo-location.

#### Acceptance Criteria

1. THE Route_Testing_System SHALL extract `haversineKm`, `isValidCoord`, `twoOptOptimize`, `moveTowards`, and the sequential greedy scoring logic into a standalone module at `apps/customer-app/src/utils/routeAlgorithm.ts` that has no React, AsyncStorage, or expo-location imports.
2. WHEN `haversineKm` is called with identical coordinates for both points, THE Route_Testing_System SHALL assert that the returned distance is 0 (identity property).
3. FOR ALL valid coordinate pairs `(A, B)`, THE Route_Testing_System SHALL assert that `haversineKm(A, B) === haversineKm(B, A)` (symmetry property).
4. FOR ALL valid coordinate triples `(A, B, C)`, THE Route_Testing_System SHALL assert that `haversineKm(A, C) <= haversineKm(A, B) + haversineKm(B, C)` (triangle inequality property).
5. WHEN `isValidCoord` is called with `lat = 0, lng = 0`, THE Route_Testing_System SHALL assert that it returns `false`.
6. WHEN `isValidCoord` is called with `null` or `undefined` for either argument, THE Route_Testing_System SHALL assert that it returns `false`.
7. FOR ALL valid `(current, target, stepMeters)` inputs where `stepMeters < haversineKm(current, target) * 1000`, THE Route_Testing_System SHALL assert that `haversineKm(moveTowards(current, target, stepMeters), target) < haversineKm(current, target)` (progress invariant property).
8. FOR ALL valid inputs to `moveTowards` where `stepMeters >= haversineKm(current, target) * 1000`, THE Route_Testing_System SHALL assert that the returned position equals `target` within 0.0001 degrees (no-overshoot property).
