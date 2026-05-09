# Requirements Document

## Introduction

The delivery system currently has two failure entry points (`POST /delivery/orders/:orderId/fail` and `POST /delivery/orders/:orderId/attempt`), frontend UI logic that duplicates business rules, and API responses that do not tell clients what actions are permitted. This creates a risk of divergence between the web dashboard and the mobile app — either client can trigger invalid state transitions or bypass payment gates.

This feature hardens the backend to become the single source of truth for all delivery business rules. The backend will enforce a strict state machine, a COD + OTP payment gate, centralized failure reasons, and delivery attempt pre-conditions. Every delivery API response will include an `allowedActions` array so that both web and mobile render their UI purely from server-declared permissions — no hardcoded condition trees.

---

## Glossary

- **State Machine**: The `ALLOWED_TRANSITIONS` map in `orderStateService.ts` that governs which `orderStatus` values may follow which.
- **Delivery State Machine**: The delivery-specific subset of transitions that a `DELIVERY_PARTNER` actor may perform: `assigned → picked_up → in_transit → arrived → delivered | FAILED`. Note: `delivery_attempt` is a transient event recorded in the `DeliveryAttempt` collection — it is NOT a persisted `orderStatus` value.
- **`arrivedAt`**: The timestamp field set on an order when the delivery partner calls `POST /arrived`.
- **`otpSentAt`**: The timestamp field set on an order when the OTP is generated and sent to the customer via `POST /deliver`. Its presence indicates the OTP phase has been initiated and `VERIFY_OTP` is the next required action.
- **`deliveryAttempts`**: The integer counter on an order tracking how many delivery attempts have been recorded.
- **MAX_ATTEMPTS**: The maximum number of delivery attempts allowed before the order is permanently failed (currently `3`, defined in `deliveryFailureService.ts`).
- **COD Order**: An order whose `paymentMethod` is `"cod"`.
- **COD Collected**: A COD order for which a `CodCollection` document exists in the database.
- **`allowedActions`**: A string array returned in every delivery API response listing the action keys the calling delivery partner may perform next on that order.
- **`/fail` endpoint**: `POST /delivery/orders/:orderId/fail` — the duplicate failure entry point to be removed.
- **`/attempt` endpoint**: `POST /delivery/orders/:orderId/attempt` — the single canonical failure entry point to be kept.
- **`useFailDeliveryMutation`**: The RTK Query mutation in `apps/customer-app/src/api/deliveryApi.ts` that calls the `/fail` endpoint — to be removed.
- **`FAILURE_REASONS` enum**: The canonical list of valid failure reason codes: `CUSTOMER_NOT_AVAILABLE`, `ADDRESS_ISSUE`, `CUSTOMER_REJECTED`.
- **Cooldown**: The 10-minute minimum interval between consecutive delivery attempts on the same order.
- **`deliveryStatus`**: A secondary status field on the order used for delivery-specific sub-states (e.g., `"arrived"`, `"failed"`).
- **`isNext`**: A boolean flag on an order (within a multi-order route) indicating it is the currently active order the rider should be working on. Only the `isNext` order may advance to `MARK_ARRIVED` or `VERIFY_OTP`.

---

## Requirements

### Requirement 1: Remove Duplicate Failure Entry Point

**User Story:** As a system operator, I want a single canonical endpoint for recording delivery failures, so that there is no ambiguity about which path to use and no risk of double-recording.

#### Acceptance Criteria

1. THE backend SHALL remove the `POST /delivery/orders/:orderId/fail` route from `backend/src/routes/deliveryAuth.ts`.
2. THE backend SHALL remove the `failDelivery` controller function from `backend/src/domains/operations/controllers/deliveryOrderController.ts`.
3. THE mobile app SHALL remove the `failDelivery` endpoint definition from `apps/customer-app/src/api/deliveryApi.ts`.
4. THE mobile app SHALL remove the exported `useFailDeliveryMutation` hook from `apps/customer-app/src/api/deliveryApi.ts`.
5. ALL call sites that currently invoke `useFailDeliveryMutation` or the `/fail` endpoint SHALL be updated to use `useRecordDeliveryAttemptMutation` with `status: "FAILED"` instead.
6. THE `POST /delivery/orders/:orderId/attempt` endpoint SHALL remain as the sole entry point for recording both successful and failed delivery attempts.
7. WHEN a client calls the removed `/fail` endpoint, THE backend SHALL return HTTP `404`.

---

### Requirement 2: Enforce Delivery-Specific State Machine in Backend

**User Story:** As a system operator, I want the backend to enforce a strict delivery state machine so that neither mobile nor web can trigger invalid order status transitions.

#### Acceptance Criteria

1. THE `orderStateService.ts` SHALL define a delivery-specific transition map for `DELIVERY_PARTNER` actors:
   ```
   DELIVERY_ALLOWED_TRANSITIONS = {
     assigned:   ['picked_up'],
     picked_up:  ['in_transit'],
     in_transit: ['arrived', 'FAILED'],
     arrived:    ['delivered', 'FAILED'],
   }
   ```
   Note: `delivery_attempt` is a transient event recorded in the `DeliveryAttempt` collection — it is NOT a persisted `orderStatus`. The `/attempt` endpoint records the event and then drives the order to `delivered` or `FAILED` directly from `arrived`.
2. WHEN a `DELIVERY_PARTNER` actor calls any order status update, THE `orderStateService` SHALL validate the transition against `DELIVERY_ALLOWED_TRANSITIONS` before applying it.
3. WHEN the requested transition is not in `DELIVERY_ALLOWED_TRANSITIONS` for the current status, THE backend SHALL throw an `InvalidStateTransitionError` and return HTTP `409` with body `{ "error": "Invalid state transition: {from} -> {to}" }`.
4. THE existing `ALLOWED_TRANSITIONS` map (used for all actors) SHALL be updated so that `in_transit` no longer allows direct transition to `delivered` — delivery must pass through `arrived` first.
5. THE `assertAllowedByRole` function SHALL enforce that `DELIVERY_PARTNER` actors may only perform transitions defined in `DELIVERY_ALLOWED_TRANSITIONS`.
6. THE state machine enforcement SHALL apply to all delivery controllers: `pickupOrder`, `startDelivery`, `markArrived`, `deliverAttempt`, `verifyDeliveryOtp`, and `recordDeliveryAttempt`.
7. WHEN an `ADMIN` actor attempts a transition that is only valid for `DELIVERY_PARTNER`, THE backend SHALL return HTTP `403`.

---

### Requirement 3: Lock COD + OTP Flow at Backend Level

**User Story:** As a system operator, I want the backend to block OTP sending and delivery attempt recording for COD orders where payment has not been collected, so that payment cannot be skipped regardless of which client is used.

#### Acceptance Criteria

1. WHEN `POST /delivery/orders/:orderId/deliver` is called for a COD order AND no `CodCollection` document exists for that order, THE backend SHALL return HTTP `422` with body `{ "error": "Collect payment before delivery" }`.
2. WHEN `POST /delivery/orders/:orderId/verify-otp` is called for a COD order AND no `CodCollection` document exists for that order, THE backend SHALL return HTTP `422` with body `{ "error": "Collect payment before delivery" }`.
3. WHEN `POST /delivery/orders/:orderId/attempt` is called for a COD order AND no `CodCollection` document exists for that order, THE backend SHALL return HTTP `422` with body `{ "error": "Collect payment before delivery" }`.
4. THE COD gate check SHALL be performed BEFORE any state transition is attempted.
5. THE COD gate SHALL NOT apply to non-COD orders (prepaid, UPI, etc.).
6. WHEN a COD order has a valid `CodCollection` document, THE backend SHALL allow the delivery attempt, OTP send, and OTP verification to proceed normally.

---

### Requirement 4: Centralize and Enforce Failure Reasons

**User Story:** As a system operator, I want all failure reasons to be validated against a canonical enum at the API boundary, so that unknown or misspelled reasons are rejected before they reach the database.

#### Acceptance Criteria

1. THE canonical `FAILURE_REASONS` enum SHALL be defined in `backend/src/domains/delivery/enums/FailureReason.ts` as:
   ```
   FAILURE_REASONS = ['CUSTOMER_NOT_AVAILABLE', 'ADDRESS_ISSUE', 'CUSTOMER_REJECTED']
   ```
2. THE `FAILURE_REASONS` enum file already exists with this definition and SHALL NOT be changed.
3. THE `recordDeliveryAttempt` controller SHALL import and use `isValidFailureReason` from `FailureReason.ts` to validate the `failureReason` field.
4. THE `deliveryFailureService.ts` `FailureReason` type SHALL be updated to use the canonical enum from `FailureReason.ts` instead of its own local type definition.
5. WHEN a `FAILED` attempt is submitted with a `failureReason` not in `FAILURE_REASONS`, THE backend SHALL return HTTP `400` with body `{ "error": "Invalid failure reason. Must be one of: CUSTOMER_NOT_AVAILABLE, ADDRESS_ISSUE, CUSTOMER_REJECTED" }`.
6. WHEN a `FAILED` attempt is submitted without a `failureReason`, THE backend SHALL return HTTP `400` with body `{ "error": "failureReason is required for FAILED attempts" }`.
7. THE mobile app `ActiveOrderCard` failure reason modal SHALL only present the three canonical reasons: "Customer Not Available", "Address Issue", "Customer Rejected".
8. THE web dashboard failure reason selector SHALL only present the same three canonical reasons.

---

### Requirement 5: Enforce Delivery Attempt Pre-conditions

**User Story:** As a system operator, I want the `/attempt` endpoint to validate all pre-conditions before recording an attempt, so that attempts cannot be recorded out of sequence or in violation of cooldown rules.

#### Acceptance Criteria

1. WHEN `POST /delivery/orders/:orderId/attempt` is called AND `order.arrivedAt` is null or undefined, THE backend SHALL return HTTP `409` with body `{ "error": "Order must be marked as arrived before recording a delivery attempt" }`.
2. WHEN `POST /delivery/orders/:orderId/attempt` is called AND `order.deliveryAttempts >= MAX_ATTEMPTS`, THE backend SHALL return HTTP `409` with body `{ "error": "Maximum delivery attempts reached" }`.
3. WHEN `POST /delivery/orders/:orderId/attempt` is called AND the cooldown period has not elapsed since `order.lastAttemptAt`, THE backend SHALL return HTTP `429` with body `{ "error": "Please wait {N} minute(s) before next attempt", "cooldownRemainingMs": {N} }`.
4. THE `MAX_ATTEMPTS` value SHALL remain `3` as defined in `deliveryFailureService.ts`.
5. THE cooldown period SHALL remain `10 minutes` as defined in `deliveryFailureService.ts`.
6. Pre-condition checks SHALL be applied in this order: assignment check → status check → `arrivedAt` check → COD gate check → attempt count check → cooldown check. Rationale: COD gate is checked before attempt count so that a payment-skipping attempt does not consume an attempt slot.

---

### Requirement 6: Standardize Delivery API Responses with `allowedActions`

**User Story:** As a frontend developer, I want every delivery API response to include an `allowedActions` array, so that the UI can render buttons purely based on server-declared permissions without any hardcoded condition logic.

#### Acceptance Criteria

1. EVERY delivery order mutation endpoint SHALL include an `allowedActions: string[]` field in its success response alongside `orderId`, `orderStatus`, and `deliveryStatus`.
2. THE `allowedActions` array SHALL be computed by a pure function `computeAllowedActions(order, deliveryBoy)` that takes the current order state and returns the list of permitted next actions.
3. THE `computeAllowedActions` function SHALL return actions from this set: `["PICKUP", "START_DELIVERY", "MARK_ARRIVED", "COLLECT_COD", "SEND_OTP", "VERIFY_OTP", "RECORD_ATTEMPT", "CUSTOMER_NOT_AVAILABLE", "NAVIGATE"]`.
4. THE mapping from order state to `allowedActions` SHALL be:

   | Condition | Actions included |
   |-----------|-----------------|
   | `orderStatus === "assigned"` AND `deliveryStatus !== "unassigned"` | `["PICKUP", "NAVIGATE"]` |
   | `orderStatus === "assigned"` AND `deliveryStatus === "unassigned"` | `[]` |
   | `orderStatus === "picked_up"` | `["START_DELIVERY", "NAVIGATE"]` |
   | `orderStatus === "in_transit"` AND `!arrivedAt` | `["MARK_ARRIVED", "NAVIGATE"]` |
   | `orderStatus === "in_transit"` AND `arrivedAt` AND COD AND `!codCollected` | `["COLLECT_COD"]` |
   | `orderStatus === "in_transit"` AND `arrivedAt` AND (non-COD OR `codCollected`) AND `!otpSentAt` | `["SEND_OTP", "CUSTOMER_NOT_AVAILABLE"]` |
   | `orderStatus === "in_transit"` AND `arrivedAt` AND `otpSentAt` | `["VERIFY_OTP", "CUSTOMER_NOT_AVAILABLE"]` |
   | `orderStatus === "arrived"` AND `!otpSentAt` | `["SEND_OTP", "CUSTOMER_NOT_AVAILABLE"]` |
   | `orderStatus === "arrived"` AND `otpSentAt` | `["VERIFY_OTP", "CUSTOMER_NOT_AVAILABLE"]` |
   | `orderStatus === "delivered"` | `[]` |
   | `orderStatus === "failed"` | `[]` |
   | `orderStatus === "cancelled"` | `[]` |

   `NAVIGATE` is included whenever `order.address.lat` and `order.address.lng` are both present, regardless of status. It is additive — it does not replace other actions.
5. THE `computeAllowedActions` function SHALL be exported from a shared utility file `backend/src/domains/delivery/utils/allowedActions.ts`.
6. THE `GET /delivery/orders` endpoint SHALL also include `allowedActions` per order in its response.
7. WHEN `allowedActions` is empty, THE frontend SHALL render no action buttons for that order.

---

### Requirement 7: Remove Frontend Business Logic Duplication

**User Story:** As a frontend developer, I want the mobile app to render delivery action buttons solely based on `allowedActions` from the API, so that business logic lives only in the backend.

#### Acceptance Criteria

1. THE `ActiveOrderCard` component SHALL replace all `if (status === "in_transit" && arrivedAt && ...)` condition trees with `if (allowedActions.includes("SEND_OTP"))`, `if (allowedActions.includes("COLLECT_COD"))`, etc.
2. THE `ActiveOrderCard` SHALL accept an `allowedActions: string[]` prop per order and use it as the sole source of truth for button visibility.
3. THE `DeliveryHomeTab` SHALL pass `order.allowedActions` (from the API response) down to `ActiveOrderCard` for each order.
4. THE mobile app SHALL NOT compute button visibility from `orderStatus`, `arrivedAt`, `paymentMethod`, or `codCollected` fields directly — these checks SHALL be removed from the component.
5. THE web dashboard `EnhancedHomeTab` SHALL apply the same `allowedActions`-driven rendering pattern, replacing any hardcoded status condition trees.
6. WHEN the API response does not include `allowedActions` (e.g., during a network error or legacy response), THE frontend SHALL fall back to showing no action buttons and displaying a "Refresh" prompt.

---

### Requirement 8: Idempotent Delivery Actions

**User Story:** As a system operator, I want all delivery mutation endpoints to be idempotent, so that network retries and rapid double-taps never produce duplicate wallet credits, duplicate COD records, or duplicate delivery attempts.

#### Acceptance Criteria

1. THE `POST /delivery/orders/:orderId/attempt` endpoint SHALL be idempotent: a second call with the same `orderId` and `status` SHALL return the existing `DeliveryAttempt` record with HTTP `200` rather than creating a duplicate.
2. THE `POST /delivery/orders/:orderId/cod-collection` endpoint SHALL be idempotent: a second call with the same `orderId` and `idempotencyKey` SHALL return the existing `CodCollection` record with HTTP `200` rather than creating a duplicate.
3. THE `POST /delivery/orders/:orderId/verify-otp` endpoint SHALL be idempotent: if the order is already in `delivered` status, THE backend SHALL return HTTP `200` with the current order state rather than throwing an error.
4. THE `WalletTransaction` collection SHALL enforce a unique compound index on `(riderId, orderId, type)` so that duplicate `EARNING` and `COD_COLLECTED` credits are rejected at the database level even under concurrent requests.
5. THE `DeliveryAttempt` collection SHALL enforce a unique index on `orderId` so that only one attempt record can exist per order.
6. ALL delivery mutation endpoints that accept an `Idempotency-Key` header SHALL use the existing `idempotencyMiddleware` from `backend/src/middleware/idempotency.ts` to deduplicate requests within a 60-second window.
7. WHEN a duplicate request is detected by `idempotencyMiddleware`, THE backend SHALL return the cached response with HTTP `200` without re-executing the handler or modifying any database state.

---

### Requirement 9: Multi-Order Delivery Sequencing

**User Story:** As a system operator, I want to ensure that when a rider has multiple active orders, they can only advance the currently designated "next" order to the arrived and OTP stages, so that orders are completed in the correct sequence.

#### Acceptance Criteria

1. WHEN a rider has multiple active orders in a route, THE backend SHALL designate exactly one order as `isNext: true` — the order that is next in the route sequence.
2. THE `computeAllowedActions` function SHALL include `"MARK_ARRIVED"` and `"VERIFY_OTP"` only for the order where `isNext === true` (or where the rider has only one active order).
3. FOR all other active orders where `isNext === false`, THE `computeAllowedActions` function SHALL NOT include `"MARK_ARRIVED"` or `"VERIFY_OTP"` in `allowedActions`.
4. THE `isNext` flag SHALL be computed from the route's `routePath` array: the first non-delivered, non-failed order in the path is `isNext`.
5. WHEN `isNext` cannot be determined (e.g., no active route exists), THE backend SHALL treat the order as `isNext: true` to avoid blocking a solo delivery.
6. THE `GET /delivery/orders` response SHALL include `isNext: boolean` per order so the frontend can display sequencing context to the rider.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: State machine completeness — no direct `in_transit → delivered` transition

*For any* order in `in_transit` status, calling `verifyDeliveryOtp` directly (without a prior `markArrived`) SHALL result in an `InvalidStateTransitionError` (HTTP 409), never in a `delivered` status. The order must reach `arrived` status before OTP verification is permitted.

**Validates: Requirements 2.4, 2.6**

---

### Property 2: COD gate is unconditional

*For any* COD order where no `CodCollection` document exists, calling `deliverAttempt`, `verifyDeliveryOtp`, or `recordDeliveryAttempt` SHALL always return HTTP 422 with `"Collect payment before delivery"`, regardless of `orderStatus`, `arrivedAt`, or any other field.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

### Property 3: Failure reason validation is exhaustive

*For any* string value submitted as `failureReason` in a `FAILED` attempt, the backend SHALL accept it if and only if it is exactly one of `["CUSTOMER_NOT_AVAILABLE", "ADDRESS_ISSUE", "CUSTOMER_REJECTED"]`. All other values (including empty string, null, undefined, or any other string) SHALL be rejected with HTTP 400.

**Validates: Requirements 4.5, 4.6**

---

### Property 4: `allowedActions` is a pure function of order state

*For any* two orders with identical `orderStatus`, `deliveryStatus`, `arrivedAt`, `otpSentAt`, `paymentMethod`, `codCollected`, `deliveryAttempts`, `isNext`, and `address.lat`/`address.lng` values, `computeAllowedActions` SHALL return identical arrays. The function has no side effects and no dependency on request context.

**Validates: Requirement 6.2**

---

### Property 5: `allowedActions` and state machine are consistent

*For any* order, every action in `allowedActions` SHALL correspond to a valid next state transition from the current `orderStatus`. No action in `allowedActions` SHALL be blocked by the state machine when the client attempts to execute it.

**Validates: Requirements 6.3, 6.4**

---

### Property 6: Attempt pre-conditions are ordered and non-bypassable

*For any* call to `POST /attempt`, the pre-condition checks SHALL be evaluated in the defined order (assignment → status → `arrivedAt` → COD gate → attempt count → cooldown). No pre-condition later in the chain SHALL be evaluated if an earlier one fails. In particular, a COD-gate failure SHALL never increment `deliveryAttempts`.

**Validates: Requirement 5.6**

---

### Property 7: Single failure entry point

*For any* delivery failure, there exists exactly one HTTP endpoint that can record it: `POST /delivery/orders/:orderId/attempt` with `status: "FAILED"`. The `/fail` endpoint SHALL not exist (returns 404).

**Validates: Requirements 1.1, 1.6, 1.7**

---

### Property 8: Idempotency — no duplicate side effects under retry

*For any* sequence of N identical calls to the same delivery mutation endpoint with the same `orderId`, the resulting database state SHALL be identical to the state produced by a single call. Specifically: `WalletTransaction` count for `(riderId, orderId, type)` SHALL be exactly 1, `DeliveryAttempt` count for `orderId` SHALL be exactly 1, and `CodCollection` count for `orderId` SHALL be at most 1.

**Validates: Requirements 8.1, 8.2, 8.4, 8.5**

---

### Property 9: Multi-order sequencing — `MARK_ARRIVED` and `VERIFY_OTP` are exclusive to `isNext` order

*For any* rider with N active orders (N > 1), `computeAllowedActions` SHALL include `"MARK_ARRIVED"` or `"VERIFY_OTP"` for at most one order — the one where `isNext === true`. All other orders SHALL not contain either action in their `allowedActions` array.

**Validates: Requirements 9.2, 9.3**
