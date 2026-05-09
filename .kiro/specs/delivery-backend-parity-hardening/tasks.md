# Implementation Tasks

## Overview

Harden the delivery system so the backend is the single source of truth for all business rules. Tasks are ordered by dependency: backend core first, then response standardization, then frontend cleanup.

## Tasks

- [x] 1. Remove duplicate `/fail` endpoint and `useFailDeliveryMutation`
  - [x] 1.1 Delete the `failDelivery` controller function from `backend/src/domains/operations/controllers/deliveryOrderController.ts`
    - Remove the entire `export const failDelivery = async (...)` function body
    - _Requirements: 1.2_
  - [x] 1.2 Remove the `/fail` route from `backend/src/routes/deliveryAuth.ts`
    - Delete the line `router.post("/orders/:orderId/fail", ...)` if it exists; confirm it is absent
    - The comment `// NOTE: /fail endpoint removed` already exists — verify no route registration remains
    - _Requirements: 1.1, 1.7_
  - [x] 1.3 Remove `failDelivery` endpoint and `useFailDeliveryMutation` from `apps/customer-app/src/api/deliveryApi.ts`
    - Delete the `failDelivery` builder entry (the mutation that calls `/delivery/orders/${orderId}/fail`)
    - Remove `useFailDeliveryMutation` from the exports list at the bottom of the file
    - _Requirements: 1.3, 1.4_
  - [x] 1.4 Migrate all call sites from `useFailDeliveryMutation` to `useRecordDeliveryAttemptMutation`
    - Search for any remaining usages of `useFailDeliveryMutation` or `failDelivery` across `apps/customer-app/src` and `frontend/src`
    - Replace each with `useRecordDeliveryAttemptMutation` called with `{ orderId, status: "FAILED", failureReason, failureNotes }`
    - _Requirements: 1.5_

- [x] 2. Enforce delivery-specific state machine in `orderStateService`
  - [x] 2.1 Add `ARRIVED` to `OrderStatus` enum and `ALLOWED_TRANSITIONS` map
    - In `backend/src/domains/orders/enums/OrderStatus.ts`, confirm `ARRIVED = "ARRIVED"` exists (it does in the Order model schema — add to enum if missing)
    - In `orderStateService.ts`, update `ALLOWED_TRANSITIONS`:
      - Change `[OrderStatus.IN_TRANSIT]` from `[DELIVERED, FAILED]` to `[OrderStatus.ARRIVED, OrderStatus.FAILED]`
      - Add `[OrderStatus.ARRIVED]: [OrderStatus.DELIVERED, OrderStatus.FAILED]`
    - _Requirements: 2.1, 2.4_
  - [x] 2.2 Add `DELIVERY_ALLOWED_TRANSITIONS` constant and update `assertAllowedByRole` for `DELIVERY_PARTNER`
    - In `orderStateService.ts`, define:
      ```typescript
      const DELIVERY_ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
        [OrderStatus.ASSIGNED]:  [OrderStatus.PICKED_UP],
        [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
        [OrderStatus.IN_TRANSIT]: [OrderStatus.ARRIVED, OrderStatus.FAILED],
        [OrderStatus.ARRIVED]:   [OrderStatus.DELIVERED, OrderStatus.FAILED],
      };
      ```
    - Update `assertAllowedByRole` for `DELIVERY_PARTNER`: replace the current boolean expression with a lookup against `DELIVERY_ALLOWED_TRANSITIONS[from]?.includes(to)`
    - Export `DELIVERY_ALLOWED_TRANSITIONS` alongside `ALLOWED_TRANSITIONS`
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  - [x] 2.3 Add `arrivedAt` timestamp field handling in `orderStateService.transition`
    - In `getTimestampField`, add `case OrderStatus.ARRIVED: return "arrivedAt"`
    - This ensures `arrivedAt` is set atomically when the state machine transitions to `ARRIVED`
    - _Requirements: 2.6_
  - [x] 2.4 Update `markArrived` controller to use `orderStateService.transition` to `ARRIVED`
    - In `deliveryOrderController.ts`, replace the current `markArrived` implementation that manually sets `order.arrivedAt` with a call to `orderStateService.transition({ toStatus: OrderStatus.ARRIVED, actorRole: "DELIVERY_PARTNER", ... })`
    - Remove the manual `(order as any).arrivedAt = new Date()` and `order.save()` — the state service handles this
    - _Requirements: 2.6_
  - [x] 2.5 Update `verifyDeliveryOtp` controller to accept `ARRIVED` as valid pre-state
    - Change the `okToVerify` check from `status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY"` to `status === "ARRIVED"`
    - The state machine transition is already `ARRIVED → DELIVERED` — align the controller guard to match
    - _Requirements: 2.6_
  - [x] 2.6 Update `deliverAttempt` (OTP send) controller to accept `ARRIVED` as valid pre-state
    - Change the `okToAttempt` check from `status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY"` to `status === "ARRIVED"`
    - Set `(order as any).deliveryOtpGeneratedAt = now` (this field serves as `otpSentAt`) — already done; confirm it is saved
    - _Requirements: 2.6_
  - [x] 2.7 Update `recordDeliveryAttempt` controller to accept `ARRIVED` as valid pre-state
    - Change `okToRecordAttempt` check from `IN_TRANSIT || OUT_FOR_DELIVERY` to `ARRIVED`
    - _Requirements: 2.6_

- [x] 3. Lock COD + OTP flow at backend level
  - [x] 3.1 Add COD gate to `deliverAttempt` controller with correct error body
    - The gate already exists but returns `{ error: "COD_COLLECTION_REQUIRED_BEFORE_OTP" }` (HTTP 409)
    - Change to return HTTP `422` with `{ "error": "Collect payment before delivery" }` to match the spec
    - _Requirements: 3.1, 3.4_
  - [x] 3.2 Add COD gate to `verifyDeliveryOtp` controller
    - After the assignment check and before the OTP verification, add:
      ```typescript
      const paymentMethod = String((orderDoc as any).paymentMethod || "").toLowerCase();
      if (paymentMethod === "cod") {
        const codRecord = await CodCollection.findOne({ orderId: new mongoose.Types.ObjectId(String(orderId)) }).select("_id").lean();
        if (!codRecord) {
          res.status(422).json({ error: "Collect payment before delivery" });
          return;
        }
      }
      ```
    - _Requirements: 3.2, 3.4_
  - [x] 3.3 Add COD gate to `recordDeliveryAttempt` controller (the `/attempt` endpoint)
    - After the `arrivedAt` check and before attempt count check, add the same COD gate pattern
    - This enforces the pre-condition order: `arrivedAt` → COD gate → attempt count → cooldown
    - _Requirements: 3.3, 3.4, 5.6_

- [x] 4. Centralize failure reasons — unify `deliveryFailureService` with canonical enum
  - [x] 4.1 Update `deliveryFailureService.ts` to import and use the canonical `FailureReason` type
    - Remove the local `FailureReason` type definition and `VALID_FAILURE_REASONS` array from `backend/src/services/deliveryFailureService.ts`
    - Add `import { FailureReason, FAILURE_REASONS, isValidFailureReason } from "../domains/delivery/enums/FailureReason"`
    - Replace `VALID_FAILURE_REASONS` usages with `FAILURE_REASONS`
    - _Requirements: 4.4_
  - [x] 4.2 Update `recordDeliveryAttempt` controller to use `isValidFailureReason` for validation
    - Replace the inline `allowedReasons` array check with `isValidFailureReason(failureReason)`
    - Update the error message to: `"Invalid failure reason. Must be one of: CUSTOMER_NOT_AVAILABLE, ADDRESS_ISSUE, CUSTOMER_REJECTED"`
    - _Requirements: 4.3, 4.5, 4.6_
  - [x] 4.3 Update mobile `ActiveOrderCard` failure reason modal to use only the three canonical reasons
    - In `apps/customer-app/src/components/delivery/StateCard/ActiveOrderCard.tsx`, replace any hardcoded reason list with the three canonical values: `"CUSTOMER_NOT_AVAILABLE"`, `"ADDRESS_ISSUE"`, `"CUSTOMER_REJECTED"`
    - Display labels: "Customer Not Available", "Address Issue", "Customer Rejected"
    - _Requirements: 4.7_

- [x] 5. Enforce delivery attempt pre-conditions in `recordDeliveryAttempt`
  - [x] 5.1 Add `arrivedAt` pre-condition check to `recordDeliveryAttempt`
    - Fetch `arrivedAt` in the order select query: add `arrivedAt` to the `.select(...)` call
    - After the status check, add: if `!order.arrivedAt` → return HTTP 409 `{ "error": "Order must be marked as arrived before recording a delivery attempt" }`
    - _Requirements: 5.1_
  - [x] 5.2 Add attempt count pre-condition check to `recordDeliveryAttempt`
    - Fetch `deliveryAttempts` and `lastAttemptAt` in the order select query
    - After the COD gate check, add: if `order.deliveryAttempts >= MAX_DELIVERY_ATTEMPTS` → return HTTP 409 `{ "error": "Maximum delivery attempts reached" }`
    - Import `MAX_DELIVERY_ATTEMPTS` from `deliveryFailureService.ts`
    - _Requirements: 5.2, 5.4_
  - [x] 5.3 Add cooldown pre-condition check to `recordDeliveryAttempt`
    - After the attempt count check, add: if `lastAttemptAt` exists and `Date.now() - lastAttemptAt < RETRY_COOLDOWN_MS` → return HTTP 429 with `{ "error": "Please wait {N} minute(s) before next attempt", "cooldownRemainingMs": N }`
    - Import `RETRY_COOLDOWN_MS` from `deliveryFailureService.ts`
    - _Requirements: 5.3, 5.5_

- [x] 6. Build `computeAllowedActions` utility — full spec-compliant implementation
  - [x] 6.1 Rewrite `backend/src/domains/delivery/utils/allowedActions.ts` to match the spec
    - Make the function synchronous (remove the async `CodCollection` DB call — COD collected status must be passed in as a pre-fetched boolean to keep the function pure)
    - Update the `DeliveryAction` type to include all actions from the spec: `"PICKUP" | "START_DELIVERY" | "MARK_ARRIVED" | "COLLECT_COD" | "SEND_OTP" | "VERIFY_OTP" | "RECORD_ATTEMPT" | "CUSTOMER_NOT_AVAILABLE" | "NAVIGATE"`
    - Rename `START_ATTEMPT` → `SEND_OTP` throughout
    - **Fix 1 — ARRIVED is the single source of truth**: Remove all `IN_TRANSIT + arrivedAt` branches. The mapping is now exclusively status-driven:
      - `ASSIGNED + deliveryStatus !== "unassigned"` → `["PICKUP", "NAVIGATE"]`
      - `ASSIGNED + deliveryStatus === "unassigned"` → `[]`
      - `PICKED_UP` → `["START_DELIVERY", "NAVIGATE"]`
      - `IN_TRANSIT` (regardless of `arrivedAt`) → `["MARK_ARRIVED", "NAVIGATE"]`
      - `ARRIVED + COD + !codCollected` → `["COLLECT_COD"]`
      - `ARRIVED + (non-COD OR codCollected) + !otpSentAt` → `["SEND_OTP", "CUSTOMER_NOT_AVAILABLE"]`
      - `ARRIVED + otpSentAt` → `["VERIFY_OTP", "CUSTOMER_NOT_AVAILABLE"]`
      - Terminal states (`DELIVERED`, `FAILED`, `CANCELLED`, `RETURNED`) → `[]`
    - `arrivedAt` is metadata only — never used as a branching condition inside `computeAllowedActions`
    - **Fix 2 — delivery_attempt is an event, not a state**: `SEND_OTP` and `VERIFY_OTP` do NOT change `orderStatus`. Only `VERIFY_OTP` (success) → `DELIVERED` and `/attempt FAILED` → `FAILED` are state transitions. Document this in a comment at the top of the file.
    - **Fix 3 — NAVIGATE requires both order coords AND rider location**: Include `"NAVIGATE"` only when `order.address?.lat && order.address?.lng && options.riderHasLocation === true`. Add `riderHasLocation: boolean` to the options parameter.
    - `otpSentAt` maps to `!!order.deliveryOtpGeneratedAt` (the existing field)
    - Function signature: `computeAllowedActions(order: any, options: { codCollected: boolean; isNext: boolean; riderHasLocation: boolean }): DeliveryAction[]`
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 9.2, 9.3_
  - [x] 6.2 Add `isNext` sequencing logic to `computeAllowedActions`
    - If `options.isNext === false`, remove `"MARK_ARRIVED"` and `"VERIFY_OTP"` from the returned actions
    - Default `isNext` to `true` when not provided (solo delivery / no route context)
    - _Requirements: 9.2, 9.3, 9.5_

- [x] 7. Compute `isNext` flag and `codCollected` status in `getDeliveryOrders`
  - [x] 7.1 Add `isNext` computation to `getDeliveryOrders` controller
    - After fetching orders, fetch the rider's active route: `Route.findOne({ deliveryBoyId, status: { $in: ["ASSIGNED", "IN_PROGRESS"] } }).select("routePath orderIds").lean()`
    - Compute `isNext` per order: the first order in `routePath` whose status is not `DELIVERED`, `FAILED`, or `CANCELLED` gets `isNext: true`; all others get `isNext: false`
    - If no active route exists, set `isNext: true` for all orders
    - Attach `isNext` to each normalized order object before returning
    - _Requirements: 9.1, 9.4, 9.5, 9.6_
  - [x] 7.2 Add `codCollected` and `riderHasLocation` status to `getDeliveryOrders` response
    - For each COD order that has `arrivedAt` set, check `CodCollection.exists({ orderId })` and attach `codCollected: boolean` to the order object
    - For non-COD orders or orders without `arrivedAt`, set `codCollected: false`
    - Attach `riderHasLocation: !!(deliveryBoy.currentLocation?.lat && deliveryBoy.currentLocation?.lng)` to each order (same value for all orders in the response since it's per-rider)
    - This allows `computeAllowedActions` to be called synchronously with pre-fetched data
    - _Requirements: 6.2_

- [x] 8. Add `allowedActions` to all delivery mutation responses
  - [x] 8.1 Create a shared helper `buildOrderResponse` in `deliveryOrderController.ts`
    - Extract a helper function that, given an order document and deliveryBoy, fetches `codCollected` and `isNext`, calls `computeAllowedActions` (passing `riderHasLocation` from `deliveryBoy.currentLocation`), and returns the standardized response shape:
      ```typescript
      {
        orderId: string,
        orderStatus: string,
        deliveryStatus: string,
        allowedActions: DeliveryAction[],
      }
      ```
    - _Requirements: 6.1_
  - [x] 8.2 Add `allowedActions` to `pickupOrder` response
    - After the successful state transition, call `buildOrderResponse` and merge into the response JSON
    - _Requirements: 6.1_
  - [x] 8.3 Add `allowedActions` to `startDelivery` response
    - Same pattern as 8.2
    - _Requirements: 6.1_
  - [x] 8.4 Add `allowedActions` to `markArrived` response
    - Same pattern as 8.2
    - _Requirements: 6.1_
  - [x] 8.5 Add `allowedActions` to `deliverAttempt` (OTP send) response
    - Same pattern as 8.2
    - _Requirements: 6.1_
  - [x] 8.6 Add `allowedActions` to `verifyDeliveryOtp` response
    - Same pattern as 8.2
    - _Requirements: 6.1_
  - [x] 8.7 Add `allowedActions` to `recordDeliveryAttempt` (`/attempt`) response
    - Same pattern as 8.2
    - _Requirements: 6.1_
  - [x] 8.8 Add `allowedActions` per order in `getDeliveryOrders` response
    - In the `normalizedOrders` map, call `computeAllowedActions` for each order using the pre-fetched `codCollected` and `isNext` values from Task 7
    - _Requirements: 6.6_

- [x] 9. Enforce idempotency on `/attempt` and `/verify-otp` endpoints
  - [x] 9.1 Make `recordDeliveryAttempt` idempotent — return existing attempt on duplicate
    - The existing `DeliveryAttempt.findOne` check already returns HTTP 409 on duplicate
    - Change the duplicate response from HTTP 409 to HTTP 200 returning the existing attempt record
    - _Requirements: 8.1_
  - [x] 9.2 Make `verifyDeliveryOtp` idempotent — return success if already delivered
    - At the top of `verifyDeliveryOtp`, after fetching the order, add: if `status === "DELIVERED"` → return HTTP 200 with `{ success: true, order: orderDoc, alreadyDelivered: true }`
    - _Requirements: 8.3_
  - [x] 9.3 Add `idempotencyMiddleware` to the `/deliver` and `/attempt` routes
    - In `backend/src/routes/deliveryAuth.ts`, add `idempotencyMiddleware` to:
      - `router.post("/orders/:orderId/deliver", ..., idempotencyMiddleware, deliverAttempt)`
      - `router.post("/orders/:orderId/attempt", ..., idempotencyMiddleware, recordDeliveryAttempt)`
    - _Requirements: 8.6, 8.7_

- [x] 10. Remove frontend business logic duplication in mobile `ActiveOrderCard`
  - [x] 10.1 Add `allowedActions` prop to `ActiveOrderCard` and `SingleActiveOrderCard`
    - In `apps/customer-app/src/components/delivery/StateCard/ActiveOrderCard.tsx`, add `allowedActions: string[]` to the per-order props interface
    - Pass `order.allowedActions ?? []` from `DeliveryHomeTab` → `StateCard` → `ActiveOrderCard`
    - _Requirements: 7.2, 7.3_
  - [x] 10.2 Replace status condition trees with `allowedActions` checks in `ActiveOrderCard`
    - Remove all `if (status === "in_transit" && arrivedAt && ...)` button visibility logic
    - Replace with:
      - `allowedActions.includes("PICKUP")` → show "Mark as Picked Up"
      - `allowedActions.includes("START_DELIVERY")` → show "Start Delivery"
      - `allowedActions.includes("MARK_ARRIVED")` → show "Mark as Arrived"
      - `allowedActions.includes("COLLECT_COD")` → show "Collect Cash" / "Collect UPI"
      - `allowedActions.includes("SEND_OTP")` → show "Start Delivery Attempt"
      - `allowedActions.includes("VERIFY_OTP")` → show OTP input + "Verify OTP & Complete"
      - `allowedActions.includes("CUSTOMER_NOT_AVAILABLE")` → show "Customer Not Available"
      - `allowedActions.includes("NAVIGATE")` → show "Navigate to Location"
    - Remove direct reads of `orderStatus`, `arrivedAt`, `paymentMethod`, `codCollected` for button visibility
    - _Requirements: 7.1, 7.4_
  - [x] 10.3 Add fallback when `allowedActions` is absent or stale
    - If `order.allowedActions` is `undefined` or the API response is missing it, render a "Syncing state..." skeleton loader instead of action buttons
    - Trigger an automatic `refetch()` after 1.5 seconds so the UI self-heals without user intervention
    - Do NOT show a static "Refresh" prompt — silent auto-recovery is the correct UX for a transient state
    - _Requirements: 7.6_

- [x] 11. Write property-based tests for `computeAllowedActions`
  - [x] 11.1 Property 4 — `computeAllowedActions` is a pure function
    - Using `fast-check`, generate random order objects with arbitrary `orderStatus`, `deliveryStatus`, `arrivedAt`, `deliveryOtpGeneratedAt`, `paymentMethod`, `address.lat/lng` values plus `codCollected` and `isNext` booleans
    - Assert: two calls with identical inputs always return identical arrays
    - _Requirements: 6.2; Correctness Property 4_
  - [x] 11.2 Property 5 — `allowedActions` and state machine are consistent
    - For each action in the returned `allowedActions`, assert that the corresponding state transition is present in `DELIVERY_ALLOWED_TRANSITIONS` for the current `orderStatus`
    - _Requirements: 6.3, 6.4; Correctness Property 5_
  - [x] 11.3 Property 2 — COD gate is unconditional
    - Generate random COD orders with `arrivedAt` set and `codCollected: false`
    - Assert: `computeAllowedActions` never includes `"SEND_OTP"` or `"VERIFY_OTP"` for these orders
    - _Requirements: 3.1–3.3; Correctness Property 2_
  - [x] 11.4 Property 3 — Failure reason validation is exhaustive
    - Generate random strings as `failureReason`
    - Assert: `isValidFailureReason` returns `true` if and only if the value is exactly one of `["CUSTOMER_NOT_AVAILABLE", "ADDRESS_ISSUE", "CUSTOMER_REJECTED"]`
    - _Requirements: 4.5, 4.6; Correctness Property 3_
  - [x] 11.5 Property 9 — Multi-order sequencing exclusivity
    - Generate arrays of N orders (N > 1) with `isNext: false` for all but one
    - Assert: `"MARK_ARRIVED"` and `"VERIFY_OTP"` appear in at most one order's `allowedActions`
    - _Requirements: 9.2, 9.3; Correctness Property 9_
  - [x] 11.6 Property 8 — Idempotency of attempt recording
    - Assert: calling `recordDeliveryAttempt` twice with the same `orderId` results in exactly one `DeliveryAttempt` document in the database
    - _Requirements: 8.1, 8.5; Correctness Property 8_
  - [x] 11.7 Fix 1 — ARRIVED is the single source of truth (no `arrivedAt` branching)
    - Generate orders with `orderStatus === "IN_TRANSIT"` and `arrivedAt` set to a non-null value
    - Assert: `computeAllowedActions` returns `["MARK_ARRIVED", "NAVIGATE"]` (or `["MARK_ARRIVED"]` if no coords) — never `SEND_OTP` or `COLLECT_COD`
    - Generate orders with `orderStatus === "ARRIVED"` and `arrivedAt` absent
    - Assert: `computeAllowedActions` still returns the `ARRIVED` branch actions — `arrivedAt` field is never read
    - _Correctness: Fix 1_

- [x] 12. Enforce OTP expiry in `verifyDeliveryOtp`
  - [x] 12.1 Define OTP TTL constant and enforce it in `verifyDeliveryOtp`
    - Add `const DELIVERY_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes` to `deliveryOrderController.ts` (or a shared constants file)
    - In `verifyDeliveryOtp`, after fetching the order, add an expiry check:
      ```typescript
      const generatedAt = (orderDoc as any).deliveryOtpGeneratedAt as Date | undefined;
      if (!generatedAt || Date.now() - generatedAt.getTime() > DELIVERY_OTP_TTL_MS) {
        res.status(410).json({ error: "OTP expired. Please request a new one." });
        return;
      }
      ```
    - Note: `deliveryOtpExpiresAt` already exists on the Order model — use it directly instead of computing from `generatedAt` if it is reliably set by `deliverAttempt`
    - _Requirements: 8.3 (idempotency); production safety_
  - [x] 12.2 Add OTP expiry check to `orderStateService.transition` for `IN_TRANSIT → DELIVERED`
    - The existing check `if (expiresAt.getTime() <= Date.now())` already exists in `orderStateService.ts` — verify it throws `OtpVerificationError` with HTTP 403
    - Confirm the controller catches this and returns the correct status code to the client
    - _Requirements: 2.6_

- [x] 13. Add atomic state transition protection against concurrent requests
  - [x] 13.1 Add optimistic concurrency guard to `orderStateService.transition`
    - Inside the `runOnce` function in `orderStateService.ts`, after reading the order, add a version check using MongoDB's `__v` (version key) or a dedicated `stateVersion` field:
      ```typescript
      // Re-fetch with version check to detect concurrent modification
      const saved = await Order.findOneAndUpdate(
        { _id: input.orderId, orderStatus: fromCanonical },
        { $set: { orderStatus: to, [tsField]: now } },
        { new: false, session }
      );
      if (!saved) {
        throw new InvalidStateTransitionError(
          `Concurrent modification detected: order ${input.orderId} was already transitioned away from ${fromCanonical}`
        );
      }
      ```
    - This replaces the current read-then-save pattern with an atomic conditional update for the status field
    - The rest of the transition logic (events, inventory, notifications) runs after the atomic update succeeds
    - _Requirements: 8.4 (unique DB constraints); Correctness Property 8_
  - [x] 13.2 Verify HTTP 409 is returned to the client on concurrent transition failure
    - `InvalidStateTransitionError` already has `statusCode = 409` — confirm the Express error handler in `backend/src/index.ts` or the controller's `catch` block propagates this correctly
    - _Requirements: 2.3_

- [x] 14. Add delivery action audit logging
  - [x] 14.1 Log every state transition in `orderStateService.transition`
    - After a successful transition (after `order.save()`), add a structured log entry:
      ```typescript
      logger.info("[DeliveryAudit] state_transition", {
        orderId: String(input.orderId),
        riderId: String(input.actorId),
        actorRole: input.actorRole,
        previousState: String(fromStatus),
        nextState: String(toStatus),
        occurredAt: transitionOccurredAt,
      });
      ```
    - _Requirements: all state machine requirements_
  - [x] 14.2 Log every delivery attempt in `recordDeliveryAttempt`
    - After creating the `DeliveryAttempt` document, add:
      ```typescript
      logger.info("[DeliveryAudit] delivery_attempt", {
        orderId: String(orderId),
        riderId: String((deliveryBoy as any)._id),
        status,
        failureReason: status === "FAILED" ? failureReason : null,
        attemptId: String((created as any)._id),
      });
      ```
    - _Requirements: 5.1–5.3_
  - [x] 14.3 Log every OTP verification in `verifyDeliveryOtp`
    - After the successful `orderStateService.transition` call, add:
      ```typescript
      logger.info("[DeliveryAudit] otp_verified", {
        orderId: String(orderId),
        riderId: String((deliveryBoy as any)._id),
        deliveredAt: new Date().toISOString(),
      });
      ```
    - _Requirements: 8.3_
