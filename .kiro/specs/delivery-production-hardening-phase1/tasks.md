# Implementation Plan: Delivery Production Hardening Phase 1

## Overview

Incremental implementation across four strictly ordered layers. Each layer depends on the one before it. Backend foundation must be complete before frontend hooks are written; hooks must be complete before UI integration; tests come last.

## Tasks

- [x] 1. Layer 1 — Backend Foundation

  - [x] 1.1 Harden socket auth middleware to reject non-delivery roles
    - Modify the `io.use()` middleware in `backend/src/index.ts`
    - After attaching `socket.data.userId` and `socket.data.role`, add a role check: if `role !== 'delivery' && role !== 'admin'`, call `next(new Error('Unauthorized'))` and return
    - Change the current fail-open `next()` calls (missing token, missing JWT_SECRET, user not found) to `next(new Error('Unauthorized'))` so connections are rejected rather than silently allowed
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.2 Add zone room join/leave to `join_room` handler
    - Modify the `delivery:` branch of the `join_room` handler in `backend/src/index.ts`
    - After the existing role check passes, query `User.findById(deliveryBoyId).select('role assignedAreas').lean()`
    - Derive `zone = user.assignedAreas?.[0] ?? 'default'`
    - Call `socket.join(`delivery_zone:${zone}`)` and store `socket.data.zone = zone`
    - Add a `leave_room` event handler that calls `socket.leave(`delivery_zone:${socket.data.zone}`)` when the rider goes offline
    - _Requirements: 1.2, 1.3, 1.6_

  - [x] 1.3 Create idempotency middleware
    - Create new file `backend/src/middleware/idempotency.ts`
    - Import `createHash` from `'crypto'`, `redis` from `'../config/redis'`, and `logger` from `'../utils/logger'`
    - Read `Idempotency-Key` header; if absent, call `next()` and return
    - Compute `hash = SHA-256(JSON.stringify(req.body))`
    - On Redis hit with matching hash: return cached response with HTTP 200
    - On Redis hit with mismatched hash: return HTTP 400 `{ error: 'Idempotency key reuse with different payload' }`
    - On Redis miss: intercept `res.json` to cache `{ hash, response }` with 60-second TTL at key `idempotency:{key}`, then call `next()`
    - On Redis error: log warning and call `next()` (fail-open)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 1.4 Apply idempotency middleware to all 7 mutation routes
    - Modify `backend/src/routes/deliveryAuth.ts`
    - Import `idempotencyMiddleware` from `'../middleware/idempotency'`
    - Insert `idempotencyMiddleware` after `requireDeliveryRole` on these 7 routes: `accept`, `reject`, `pickup`, `start-delivery`, `arrived`, `verify-otp`, `fail`
    - _Requirements: 6.1_

  - [x] 1.5 Rewrite `acceptOrder` to use atomic `findOneAndUpdate`
    - Modify `acceptOrder` in `backend/src/domains/operations/controllers/deliveryOrderController.ts`
    - Replace any read-then-write pattern with a single `Order.findOneAndUpdate({ _id: orderId, status: 'pending' }, { $set: { status: 'assigned', deliveryBoy: riderId } }, { new: true })`
    - If result is `null`, return HTTP 409 `{ error: 'Order already taken by another rider' }`
    - If result is the updated order, emit `order_updated` to `delivery:{riderId}` room and return HTTP 200 `{ success: true, order }`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 1.6 Emit `new_order` to zone room with ACK timeout re-emit
    - Locate the order creation flow that triggers socket emission (in `backend/src/domains/operations/controllers/deliveryOrderController.ts` or `OrderEventBroadcaster`)
    - Derive `zone = order.zone ?? 'default'` and emit to `delivery_zone:${zone}` using `.timeout(5000).emit('new_order', order, callback)`
    - In the callback, if `err` is set (no ACKs within 5 s), re-emit once: `io.to(room).emit('new_order', order)`
    - _Requirements: 1.1, 1.5, 1.6, 4.6_

  - [x] 1.7 Emit `order_updated` to assigned rider's personal room
    - After any order status change in the delivery controllers, emit `io.to(`delivery:${riderId}`).emit('order_updated', order)` where `riderId = order.deliveryBoy?.toString()`
    - Ensure this is emitted from `acceptOrder` (already covered in 1.5) and from all other status-change controllers (`rejectOrder`, `pickupOrder`, `startDelivery`, `markArrived`, `verifyDeliveryOtp`, `failDelivery`)
    - _Requirements: 2.1, 2.3_

- [x] 2. Checkpoint — Backend layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Layer 2 — Frontend Hooks

  - [x] 3.1 Create `useActionGuard` hook
    - Create new file `apps/customer-app/src/hooks/delivery/useActionGuard.ts`
    - Implement a generic hook `useActionGuard<T extends unknown[]>(fn: (...args: T) => Promise<void>)` using `useState` and `useCallback`
    - Return `{ guarded, isProcessing }` where `guarded` sets `isProcessing = true` before calling `fn`, resets to `false` in a `finally` block, and is a no-op if `isProcessing` is already `true`
    - _Requirements: 5.2, 5.3, 5.4, 5.6_

  - [x] 3.2 Create `useNetworkStatus` hook
    - Create new file `apps/customer-app/src/hooks/delivery/useNetworkStatus.ts`
    - Import `NetInfo` from `'@react-native-community/netinfo'`
    - On mount, call `NetInfo.fetch()` to set initial `isOnline` and `connectionType` state
    - Subscribe to `NetInfo.addEventListener` and update state on every change; unsubscribe on unmount
    - Return `{ isOnline, connectionType }`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.3 Create `useDeliverySocket` hook
    - Create new file `apps/customer-app/src/hooks/delivery/useDeliverySocket.ts`
    - Connect to `EXPO_PUBLIC_API_URL` with `auth: { token }`, `reconnection: true`, `reconnectionDelay: 1000`, `reconnectionDelayMax: 30000`, `reconnectionAttempts: Infinity`
    - Track `socketStatus: 'connected' | 'reconnecting' | 'disconnected'` via `connect`, `reconnecting`, and `disconnect` events
    - On `connect`, emit `join_room` with `{ room: 'delivery:{userId}', token }`
    - On `new_order`: patch RTK cache via `deliveryApi.util.updateQueryData('getDeliveryOrders', ...)` — push order if not already present; call `ack?.()` to acknowledge
    - On `order_updated`: patch RTK cache — find by `_id` and replace in place
    - Disconnect and clean up all listeners on unmount or when `token` changes
    - Return `{ socketStatus }`
    - _Requirements: 1.4, 2.2, 2.4, 2.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.4 Create `useActionQueue` hook
    - Create new file `apps/customer-app/src/hooks/delivery/useActionQueue.ts`
    - Define and export `VALID_TRANSITIONS: Record<string, string[]>` mapping each order status to its valid next statuses: `pending → ['assigned']`, `assigned → ['picked_up']`, `picked_up → ['in_transit']`, `in_transit → ['arrived']`, `arrived → ['delivered', 'failed']`
    - Define `QueuedAction` interface with fields: `id`, `action`, `orderId`, `args`, `fn`, `idempotencyKey`, `enqueuedAt`
    - Implement `enqueue(action: QueuedAction)`: add to queue; if length would exceed 10, drop the oldest item and log a warning
    - Implement `replayQueue(fetchOrderStatus: (id: string) => Promise<string>)`: iterate queue in FIFO order, fetch current status for each `orderId`, check `VALID_TRANSITIONS[currentStatus]` includes the intended target status — if not, silently discard; if yes, call `action.fn(...action.args)` with the stored `idempotencyKey`; on server error remove from queue and alert; on success remove from queue
    - Set `isSyncing = true` during replay, `false` when done
    - Return `{ enqueue, replayQueue, isSyncing, queueLength }`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

- [x] 4. Checkpoint — Frontend hooks complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Layer 3 — Frontend UI

  - [x] 5.1 Create `ConnectionBanner` component
    - Create new file `apps/customer-app/src/components/delivery/ConnectionBanner/ConnectionBanner.tsx`
    - Accept props: `isOnline: boolean`, `socketStatus: SocketStatus`, `connectionType: string`, `isSyncing: boolean`
    - Render `null` when `isOnline && socketStatus === 'connected' && !isSyncing`
    - Render red banner with text "No Internet Connection" when `!isOnline`
    - Render yellow banner with text "Reconnecting..." when `isOnline && socketStatus === 'reconnecting'`
    - Render yellow banner with text "Syncing..." when `isSyncing`
    - Apply `zIndex: 100` so the banner is never obscured
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 5.2 Add idempotency key generation to `deliveryApi.ts` mutations
    - Modify `apps/customer-app/src/api/deliveryApi.ts`
    - For each of the 7 mutation endpoints (`acceptOrder`, `rejectOrder`, `pickupOrder`, `startDelivery`, `markArrived`, `verifyDeliveryOtp`, `failDelivery`), update the `query` function to accept an `idempotencyKey` parameter (or derive it from the args) and include it as an `'Idempotency-Key'` request header using the format `{action}:{orderId}:{timestamp}`
    - The key should be generated by the caller (DeliveryHomeTab) and passed in so it can be stored and reused on retry from the queue
    - _Requirements: 6.9_

  - [x] 5.3 Integrate all hooks and `ConnectionBanner` into `DeliveryHomeTab`
    - Modify `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`
    - Add `useDeliverySocket`, `useNetworkStatus`, and `useActionQueue` hook calls at the top of the component
    - Render `<ConnectionBanner isOnline={isOnline} socketStatus={socketStatus} connectionType={connectionType} isSyncing={isSyncing} />` as the first child of the root `<View>`, above `<ControlBar>`
    - Wrap each of the 7 action handlers (`handleAcceptOrder`, `handleRejectOrder`, `handlePickup`, `handleStartDelivery`, `handleMarkArrived`, `handleVerifyOtp`, `handleFailDelivery`) with `useActionGuard`, generating an idempotency key per call in the format `{action}:{orderId}:{Date.now()}`
    - Pass `isProcessing` from each guard to the corresponding button's `disabled` prop
    - In `handleAcceptOrder`: on HTTP 409 response, remove the order from RTK cache via `deliveryApi.util.updateQueryData` and show alert "Order already taken by another rider"
    - In any handler: on network error (no response / connection refused), call `enqueue(...)` instead of showing an error alert; on server error (4xx/5xx that is not 409), show error alert as before
    - When `isOnline` transitions to `true`, call `replayQueue(fetchOrderStatus)` where `fetchOrderStatus` fetches the current order status from the API
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.5, 9.1, 9.2, 9.3, 9.4, 10.1, 10.3, 10.8_

- [x] 6. Checkpoint — Frontend UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Layer 4 — Tests

  - [ ] 7.1 Write property-based tests for all 10 correctness properties
    - Create test file (e.g. `backend/src/__tests__/delivery-hardening.property.test.ts` or alongside the relevant modules)
    - Use `fast-check` for all property tests; run a minimum of 100 iterations per property

    - [ ]* 7.1.1 Property 1 — Zone Isolation
      - Generate random zone strings and order objects; assert `io.to(room).emit` is called with `delivery_zone:{order.zone}` and no other zone room
      - **Property 1: Zone Isolation**
      - **Validates: Requirements 1.1, 1.6**

    - [ ]* 7.1.2 Property 2 — Auth Exclusivity
      - Generate random JWT payloads with arbitrary `role` values; assert only `role === 'delivery'` (or `'admin'`) passes the middleware, all others receive `'Unauthorized'`
      - **Property 2: Auth Exclusivity**
      - **Validates: Requirements 3.3, 3.4, 3.5**

    - [ ]* 7.1.3 Property 3 — Idempotency Safety: Same Key, Same Body
      - Generate random `(key, body, response)` triples; prime Redis with the record, then assert a second request returns the cached response with HTTP 200 without calling the handler
      - **Property 3: Idempotency Safety — Same Key, Same Body**
      - **Validates: Requirements 6.2, 6.3**

    - [ ]* 7.1.4 Property 4 — Idempotency Safety: Same Key, Different Body
      - Generate random `(key, body1, body2)` pairs where `body1 !== body2`; prime Redis with `body1`, then assert a request with `body2` returns HTTP 400 and does not call the handler
      - **Property 4: Idempotency Safety — Same Key, Different Body**
      - **Validates: Requirements 6.4**

    - [ ]* 7.1.5 Property 5 — Order Lock Atomicity
      - Mock `Order.findOneAndUpdate` to simulate concurrent accept requests; assert exactly one call returns HTTP 200 and all others return HTTP 409
      - **Property 5: Order Lock Atomicity**
      - **Validates: Requirements 7.1, 7.2, 7.3**

    - [ ]* 7.1.6 Property 6 — Action Guard: No Concurrent Dispatch
      - Generate random async functions and overlapping call sequences; assert that while `isProcessing` is `true` no second dispatch occurs, and `isProcessing` resets to `false` after completion
      - **Property 6: Action Guard — No Concurrent Dispatch**
      - **Validates: Requirements 5.2, 5.3, 5.4**

    - [ ]* 7.1.7 Property 7 — Queue Validity: Invalid Transitions Discarded
      - Generate random `(action, currentStatus)` pairs; assert that when `VALID_TRANSITIONS[currentStatus]` does not include the action's target status, the action is discarded without calling `fn` or alerting
      - **Property 7: Queue Validity — Invalid Transitions Discarded**
      - **Validates: Requirements 10.4**

    - [ ]* 7.1.8 Property 8 — Queue Bounded Size
      - Generate sequences of more than 10 network-failed actions; assert `queueLength` never exceeds 10 and the oldest item is evicted when the limit is reached
      - **Property 8: Queue Bounded Size**
      - **Validates: Requirements 10.7**

    - [ ]* 7.1.9 Property 9 — RTK Cache Update: No Refetch
      - Generate random order payloads; assert that `new_order` and `order_updated` socket events update the RTK cache via `updateQueryData` and do not trigger a network request to `GET /delivery/orders`
      - **Property 9: RTK Cache Update — No Refetch**
      - **Validates: Requirements 1.4, 2.2**

    - [ ]* 7.1.10 Property 10 — Network Status Accuracy
      - Generate random sequences of `NetInfo` state changes; assert `isOnline` always equals the most recent `isConnected` value after each change
      - **Property 10: Network Status Accuracy**
      - **Validates: Requirements 8.2, 8.3**

  - [ ] 7.2 Write unit tests for idempotency middleware and `acceptOrder` controller
    - Create or extend test files alongside the source files

    - [ ]* 7.2.1 Unit tests for `idempotencyMiddleware`
      - Mock Redis client; test: missing key passes through, same key + same body returns cached 200, same key + different body returns 400, Redis failure passes through (fail-open)
      - _Requirements: 6.2, 6.3, 6.4, 6.6, 6.8_

    - [ ]* 7.2.2 Unit tests for `acceptOrder` controller
      - Mock `Order.findOneAndUpdate`; test: successful update returns HTTP 200 with order and emits `order_updated`, null result returns HTTP 409 with correct error body
      - _Requirements: 7.1, 7.2, 7.3_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Layer ordering is strict: do not start Layer 2 until Layer 1 is complete, etc.
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations each
- The idempotency key format is `{action}:{orderId}:{timestamp}` — generated by the caller and stored in the queue for retry reuse
- The `ConnectionBanner` must be the first child of the root `View` in `DeliveryHomeTab` to guarantee it is never obscured
