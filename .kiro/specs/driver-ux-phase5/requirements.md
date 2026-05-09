# Requirements Document

## Introduction

Phase 5 of the delivery partner app focuses on UX polish for the driver-facing interface. The goal is to make the driver's current state, next stop, route progress, and failure flows immediately obvious under real delivery pressure — without adding cognitive load.

The system already has solid logic foundations: `isCurrent`/`isLocked` flags per order, `sortedOrderIds` for deterministic route order, `driverLocation` for real-time GPS input, simulator-tested movement and distance calculations, and the `useRouteArrangement` hook managing route state. Phase 5 encodes the UX invariants that must hold at all times as formal requirements, and eliminates the anti-patterns that erode driver trust.

## Glossary

- **Driver_App**: The React Native delivery partner application running on the driver's device.
- **Route_Manager**: The `useRouteArrangement` hook and its derived state (`sortedOrderIds`, `currentOrderId`, `isArranged`).
- **Current_Order**: The single order with `isCurrent === true` — the stop the driver is actively delivering to.
- **Next_Order**: The order at `sortedOrderIds[1]` — the stop immediately after the current one.
- **Locked_Order**: Any order with `isLocked === true` — a future stop that must not be acted on yet.
- **Active_Order_Card**: The `ActiveOrderCard` / `SingleOrderCard` component rendering a single in-progress order.
- **Route_Progress_Header**: The summary bar showing completed and remaining stop counts.
- **Current_Strip**: The coloured indicator strip rendered at the top of the Current_Order's card.
- **Next_Strip**: The indicator strip rendered at the top of the Next_Order's card.
- **Distance_Display**: The inline distance and ETA text derived from haversine calculation between `driverLocation` and the order's delivery address.
- **Failure_Modal**: The bottom-sheet modal for selecting a failure reason and optional notes before cancelling a delivery.
- **ETA**: Estimated time of arrival, calculated as `distance_km / 25 km/h * 60 minutes`.
- **Syncing_Skeleton**: The loading placeholder shown when `allowedActions` is absent from an order response.

---

## Requirements

### Requirement 1: Single-Current Visual Dominance

**User Story:** As a driver, I want exactly one order card to look visually dominant at all times, so that I always know which stop I am delivering to without scanning the whole list.

#### Acceptance Criteria

1. WHILE the route is arranged, THE Active_Order_Card SHALL render exactly one card with the `cardCurrent` style applied.
2. WHILE the route is arranged, THE Active_Order_Card SHALL render exactly one Current_Strip per render cycle.
3. WHEN `currentOrderId` changes, THE Active_Order_Card SHALL remove the `cardCurrent` style from the previous Current_Order and apply it to the new Current_Order without an intermediate visible state where no card has the `cardCurrent` style applied.
4. IF two or more orders simultaneously have `isCurrent === true`, THEN THE Route_Manager SHALL treat this as an invariant violation and retain only `sortedOrderIds[0]` as the Current_Order.
5. THE Active_Order_Card SHALL NOT apply `cardCurrent` style to any Locked_Order.

---

### Requirement 2: Next-Stop Visibility

**User Story:** As a driver, I want to see exactly one "UP NEXT" indicator pointing to my next stop, so that I can mentally prepare without being distracted by further stops.

#### Acceptance Criteria

1. WHILE the route is arranged and at least two stops remain, THE Active_Order_Card SHALL render exactly one Next_Strip on the card whose `stopIndex === 2`.
2. WHILE the route is arranged and only one stop remains, THE Active_Order_Card SHALL NOT render any Next_Strip.
3. WHEN the Current_Order is completed and the route advances, THE Active_Order_Card SHALL move the Next_Strip to the new `stopIndex === 2` card without an intermediate visible state where no Next_Strip is rendered.
4. THE Active_Order_Card SHALL NOT render a Next_Strip on the Current_Order card.
5. WHERE a Distance_Display value is available for the Next_Order, THE Next_Strip SHALL display the distance alongside the "UP NEXT" label.

---

### Requirement 3: Distance and ETA Monotonicity

**User Story:** As a driver, I want the distance and ETA to my current stop to decrease as I move toward it, so that I trust the numbers and don't feel like the app is broken.

#### Acceptance Criteria

1. THE Distance_Display SHALL be non-increasing within a tolerance of ±5% when the driver's movement direction is toward the Current_Order's address. Small fluctuations within this tolerance (due to GPS jitter, road curvature, or signal drift) SHALL NOT be treated as violations.
2. THE Distance_Display SHALL format distances below 1 km as metres (e.g., "350 m") and distances of 1 km or above as kilometres to one decimal place (e.g., "2.4 km").
3. THE Distance_Display SHALL format ETA values below 1 minute as "< 1 min", values below 60 minutes as "{N} min", and values of 60 minutes or above as "{H}h {M}m".
4. IF `driverLocation` is null or the order address coordinates are zero or invalid, THEN THE Distance_Display SHALL NOT render any distance or ETA value for that order.
5. THE Route_Manager SHALL throttle `driverLocation` updates to no more than one update per 1000 milliseconds to prevent excessive re-renders.

---

### Requirement 4: Route Progress Consistency

**User Story:** As a driver, I want to always see how many stops I have completed and how many remain, so that I know where I am in the route without counting cards manually.

#### Acceptance Criteria

1. WHILE the route is arranged and `totalStops > 0`, THE Route_Progress_Header SHALL display a `remainingCount` value equal to `totalStops - completedCount`.
2. WHILE the route is arranged, THE Route_Progress_Header SHALL display a `completedCount` value equal to the number of stops before the Current_Order in `sortedOrderIds`. `completedCount` SHALL be computed as `sortedOrderIds.indexOf(currentOrderId)`, making it deterministic and independent of order status fields.
3. THE Route_Progress_Header SHALL satisfy the invariant: `completedCount + remainingCount === totalStops` on every render.
4. WHEN the Current_Order is completed and the route advances, THE Route_Progress_Header SHALL increment `completedCount` by 1 and decrement `remainingCount` by 1 without an intermediate visible state where `completedCount + remainingCount ≠ totalStops`.
5. WHILE the route is arranged, THE Route_Progress_Header SHALL render one progress dot per stop, with completed stops styled as `routeDotDone`, the Current_Order styled as `routeDotCurrent`, and future stops styled as the default `routeDot`.
6. WHEN all stops are completed, THE Route_Manager SHALL reset the route arrangement and THE Route_Progress_Header SHALL no longer be rendered.

---

### Requirement 5: Failure Transition Without Flicker

**User Story:** As a driver, I want a failed order to disappear cleanly and the next order to become current immediately, so that I can continue my route without confusion or a broken-looking screen.

#### Acceptance Criteria

1. WHEN a delivery failure is recorded via the Failure_Modal, THE Driver_App SHALL call `recordDeliveryAttempt` with `status: 'FAILED'` and the selected `failureReason`.
2. WHEN the `recordDeliveryAttempt` mutation succeeds, THE Driver_App SHALL trigger a refetch of the active orders list via the `invalidatesTags: ['DeliveryOrders']` mechanism.
3. WHEN the refetch completes and the failed order is absent from the response, THE Route_Manager SHALL auto-advance `currentOrderId` to the next entry in `sortedOrderIds`.
4. WHEN `currentOrderId` advances after a failure, THE Active_Order_Card SHALL render the new Current_Order with the `cardCurrent` style and Current_Strip without an intermediate visible state where zero orders have the `cardCurrent` style.
5. THE Failure_Modal SHALL require the driver to select exactly one failure reason from the canonical list before the confirm action is enabled.
6. IF the driver dismisses the Failure_Modal without confirming, THEN THE Driver_App SHALL leave the order status unchanged.
7. THE Failure_Modal SHALL accept optional free-text notes of up to 200 characters.
8. THE Route_Manager SHALL derive `currentOrderId` from the first non-completed order in the intersection of `sortedOrderIds` and the current `activeOrders` list, so that a slow network, socket delay, or stale cache cannot produce a ghost current order pointing to an order no longer in the active list.
9. THE Driver_App SHALL trim leading and trailing whitespace from the optional failure notes before submission. A notes value consisting entirely of whitespace SHALL be treated as absent (not submitted).

---

### Requirement 6: Locked-Order Visual Suppression

**User Story:** As a driver, I want future stops to look clearly inactive, so that I don't accidentally tap an action button on the wrong order.

#### Acceptance Criteria

1. WHILE an order is a Locked_Order, THE Active_Order_Card SHALL apply the `cardLocked` style to that card.
2. WHILE an order is a Locked_Order, THE Active_Order_Card SHALL disable all action buttons for that order.
3. WHILE an order is a Locked_Order, THE Active_Order_Card SHALL display a locked badge showing the stop number (e.g., "STOP 3").
4. WHILE an order is a Locked_Order, THE Active_Order_Card SHALL NOT render the Current_Strip or Next_Strip on that card.
5. WHEN a Locked_Order becomes the Current_Order after route advancement, THE Active_Order_Card SHALL remove the `cardLocked` style and enable action buttons without an intermediate visible state where the card still shows `cardLocked` style.
6. WHILE an order is a Locked_Order, THE Active_Order_Card SHALL ignore all touch interactions on that card (not just action buttons), preventing accidental navigation or state changes.

---

### Requirement 7: Route Freeze During Active Delivery

**User Story:** As a driver, I want the route order to stay fixed once I start delivering, so that the card list never reshuffles under my hands mid-route.

#### Acceptance Criteria

1. WHILE the route is arranged and the simulator or real GPS is reporting movement, THE Route_Manager SHALL NOT re-sort `sortedOrderIds`.
2. WHEN `arrangeRoute` is called while `isArranged === true` and the simulation is running, THE Route_Manager SHALL log a warning and return without modifying `sortedOrderIds`.
3. THE Route_Manager SHALL persist `sortedOrderIds`, `currentOrderId`, and `isArranged` to AsyncStorage so that a device restart or app reload does not reshuffle the route.
4. WHEN the driver explicitly taps "Reset", THE Route_Manager SHALL clear `sortedOrderIds`, `currentOrderId`, and `isArranged` from both memory and AsyncStorage.
5. THE Route_Manager SHALL ignore `driverLocation` updates for the purpose of sorting or re-ordering `sortedOrderIds`. Location updates SHALL only be used for Distance_Display calculations and SHALL never trigger a re-sort.

---

### Requirement 8: Syncing State Transparency

**User Story:** As a driver, I want to see a loading indicator instead of blank action buttons when the server response is still arriving, so that I know the app is working and don't tap the wrong thing.

#### Acceptance Criteria

1. WHEN `allowedActions` is absent (undefined) on an order, THE Active_Order_Card SHALL render the Syncing_Skeleton in place of the action buttons. `undefined` on `allowedActions` means the server response has not yet arrived. An empty array (`[]`) is a valid server response meaning no actions are currently permitted, and SHALL NOT trigger the Syncing_Skeleton.
2. WHEN `allowedActions` is present (even as an empty array), THE Active_Order_Card SHALL NOT render the Syncing_Skeleton.
3. THE Syncing_Skeleton SHALL display an activity indicator and the label "Syncing state...".
4. WHEN `allowedActions` becomes defined after a socket or refetch update, THE Active_Order_Card SHALL replace the Syncing_Skeleton with the appropriate action buttons without an intermediate visible state where the Syncing_Skeleton and action buttons are both rendered simultaneously.

---

### Requirement 9: ETA Precision Guard

**User Story:** As a driver, I want the ETA to never jump to a higher value while I am moving toward a stop, so that I trust the estimate and don't feel like the app is broken.

#### Acceptance Criteria

1. WHILE the driver is moving toward the Current_Order's address, THE Distance_Display SHALL NOT display an ETA value more than 10% higher than the ETA displayed in the previous update cycle, unless the haversine distance has increased by more than 5% between the same two updates.
2. THE Driver_App SHALL derive ETA exclusively from the haversine distance at 25 km/h average speed and SHALL NOT fetch ETA from an external service for the in-card display.
3. THE Route_Manager SHALL throttle location updates to prevent ETA recalculation more frequently than once per 1000 milliseconds.

---

### Requirement 10: Idle and Offline State Clarity

**User Story:** As a driver, I want the screen to clearly tell me when I have no orders or when I am offline, so that I don't wonder if the app is broken.

#### Acceptance Criteria

1. WHEN `availableOrders` is empty and `activeOrders` is empty, THE Driver_App SHALL render the IdleCard and SHALL NOT render the Active_Order_Card or NewOrderCard.
2. WHEN the network connection is lost, THE Driver_App SHALL render the ConnectionBanner with an offline indicator.
3. WHEN the WebSocket connection is lost but the network is available, THE Driver_App SHALL render the ConnectionBanner with a disconnected socket indicator.
4. WHEN the network connection is restored, THE Driver_App SHALL replay any queued actions before rendering updated order state.
5. THE IdleCard SHALL display the driver's current session earnings when `earnings > 0`.
6. WHEN both conditions are true simultaneously (network offline AND no active/available orders), THE Driver_App SHALL render the ConnectionBanner as the primary indicator and the IdleCard as secondary content below it. The ConnectionBanner SHALL always take visual priority over the IdleCard.
