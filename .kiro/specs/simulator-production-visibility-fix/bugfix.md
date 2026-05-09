# Bugfix Requirements Document

## Introduction

The Driver Simulator UI (Start / Pause / Resume / Speed controls) is a DEV-only testing tool used for fake driver movement, route flow testing, delivery lifecycle simulation, and GPS-free debugging. It is currently visible and partially active in production builds of the delivery partner app, confusing real drivers, exposing internal tooling, and eroding user trust. The fix must hide the simulator UI and prevent simulator callbacks from executing in production, while keeping all simulator code intact for dev/QA use.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the app is built for production (`__DEV__ === false`) THEN the `DebugPanel` component returns `null` correctly, but `DeliveryHomeTab` still renders `<DebugPanel />` unconditionally, causing the component to be evaluated and its hooks to execute before the early return.

1.2 WHEN the app is built for production THEN `DeliveryHomeTab` wires `driverSimulator.onArrived`, `driverSimulator.onDelivered`, and `driverSimulator.onRouteComplete` callbacks unconditionally via `useEffect`, meaning simulator event handlers are registered and active even though no simulation should ever run.

1.3 WHEN the app is built for production THEN `driverSimulator.reset()` is called on unmount of `DeliveryHomeTab` unconditionally, invoking simulator logic (including `driverLocationStore.setSimulationRunning(false)`) in a production context where the simulator should never have been initialised.

1.4 WHEN the app is built for production THEN the `driverSimulator` module is imported at the top level of `DeliveryHomeTab.tsx`, meaning the simulator singleton is instantiated and its module-level code runs in every production session.

### Expected Behavior (Correct)

2.1 WHEN the app is built for production THEN the system SHALL NOT render the `DebugPanel` component or evaluate any of its internal state/hooks.

2.2 WHEN the app is built for production THEN the system SHALL NOT register `driverSimulator.onArrived`, `driverSimulator.onDelivered`, or `driverSimulator.onRouteComplete` callbacks, so no simulator event handlers are active.

2.3 WHEN the app is built for production THEN the system SHALL NOT call `driverSimulator.reset()` on unmount, preventing any simulator teardown logic from executing.

2.4 WHEN the app is built for production THEN the system SHALL guard the entire simulator `useEffect` block in `DeliveryHomeTab` with a `__DEV__` check so that simulator wiring is completely skipped.

2.5 WHEN the app is built for development (`__DEV__ === true`) THEN the system SHALL continue to render the `DebugPanel` and wire all simulator callbacks exactly as before.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the app is running in development mode THEN the system SHALL CONTINUE TO render the full Simulator UI (Start / Pause / Resume / Speed controls) inside `DebugPanel`.

3.2 WHEN the app is running in development mode THEN the system SHALL CONTINUE TO allow `driverSimulator.start()`, `driverSimulator.pause()`, `driverSimulator.resume()`, `driverSimulator.reset()`, and `driverSimulator.setSpeed()` to be triggered from the UI.

3.3 WHEN the app is running in development mode THEN the system SHALL CONTINUE TO fire `onArrived`, `onDelivered`, and `onRouteComplete` callbacks that update local Redux cache state.

3.4 WHEN the app is running in development mode THEN the system SHALL CONTINUE TO call `driverLocationStore.setSimulationRunning(true)` when a simulation starts and `setSimulationRunning(false)` when it resets.

3.5 WHEN the `DriverSimulator` class, `driverLocationStore`, or any simulator module is referenced THEN the system SHALL CONTINUE TO keep all simulator source files, classes, stores, and logic intact and undeleted.

3.6 WHEN a production user interacts with the delivery home screen THEN the system SHALL CONTINUE TO display available orders, active orders, the control bar, and the connection banner without any change in behaviour.
