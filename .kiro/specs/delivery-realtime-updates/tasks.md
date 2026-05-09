# Implementation Plan: delivery-realtime-updates

## Overview

Replace polling-based delivery updates with a systematic Socket.IO push architecture. The implementation proceeds backend-first (data model → emitter service → auth/handlers → wiring) then frontend (hooks → offline queue → cleanup), finishing with observability and tests.

## Tasks

- [x] 1. DeliverySocketEvent MongoDB model + indexes + TTL
  - Create `backend/src/models/DeliverySocketEvent.ts` with the `IDeliverySocketEvent` interface and Mongoose schema
  - Add compound indexes `{ riderId: 1, timestamp: 1 }` and `{ orderId: 1, timestamp: 1 }`
  - Add TTL index on `createdAt` with `expireAfterSeconds: 86400`
  - Export the model and register it in the backend model index
  - _Requirements: 1b.1, 1b.2, 1b.4_

  - [ ]* 1.1 Write property test for sync recovery completeness (Property 13)
    - **Property 13: Sync recovery completeness within 24-hour window**
    - Generate random sequences of events within/outside the 24-hour TTL window; assert `sync_request` returns all events within the window and none outside
    - **Validates: Requirements 6.2, 6.3, 1b.4**

- [x] 2. Order schema — add `socketVersion` field
  - Add `socketVersion: { type: Number, default: 0 }` to the Order Mongoose schema and `IOrder` TypeScript interface
  - Ensure the field is never set directly — only incremented via `$inc` in `DeliverySocketEmitter`
  - _Requirements: 1.2, 1.9_

  - [ ]* 2.1 Write property test for socketVersion monotonic increment (Property 3)
    - **Property 3: socketVersion increments monotonically**
    - Generate a random sequence of 1–10 status transitions on the same order; assert each successive payload `version` is exactly 1 greater than the previous
    - **Validates: Requirement 1.9**

- [x] 3. DeliverySocketEmitter service (backend)
  - Create `backend/src/domains/delivery/services/deliverySocketEmitter.ts`
  - Implement `emitStatusChanged`: atomically `$inc socketVersion`, compute `allowedActions` via `computeAllowedActions`, build payload with `eventId: uuidv4()` and `timestamp`, emit to `delivery:{deliveryBoyId}`, `admin_room`, and `order:{userId}` simultaneously; skip rooms with null IDs and log `warn`; persist to `DeliverySocketEvent` asynchronously (fire-and-forget); log at `info` level
  - Implement `emitOrderAssigned`: emit full normalized order payload to `delivery:{riderId}` and `admin_room` using `emitWithRetry`
  - Implement `emitOrderCancelled`: emit `order:cancelled` to `delivery:{riderId}` and `admin_room`
  - Implement `emitOrderReassigned`: emit `order:reassigned` to the old rider's room
  - Add `SocketMetrics` counters module (`eventsEmittedPerMin`, `eventsDroppedThrottlePerMin`, `syncRequestsPerMin`, `ackRetriesPerMin`, `totalEventsEmitted`, `totalSyncRequests`, `totalAckFailures`) reset on a 60-second interval
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 10.1, 10.2_

  - [ ]* 3.1 Write property test for emission targets all three rooms (Property 1)
    - **Property 1: Emission targets all three rooms for every status change**
    - Generate random `orderId`, `deliveryBoyId`, `userId`, `orderStatus`, `previousStatus`; mock `io.to()`; call `emitStatusChanged()`; assert `io.to()` was called with all three room names
    - **Validates: Requirements 1.1, 1.5**

  - [ ]* 3.2 Write property test for allowedActions matches computeAllowedActions (Property 2)
    - **Property 2: allowedActions in payload equals computeAllowedActions output**
    - Generate all combinations of `orderStatus`, `deliveryStatus`, `codCollected`, `isNext`, `riderHasLocation`, `otpSentAt`; call `emitStatusChanged()`; assert `payload.allowedActions` deep-equals `computeAllowedActions(order, options)`
    - **Validates: Requirements 1.3, 3.2**

  - [ ]* 3.3 Write unit tests for DeliverySocketEmitter
    - Test: emits to all three rooms when both IDs are present
    - Test: skips `delivery:` room and logs warn when `deliveryBoyId` is null
    - Test: skips `order:` room and logs warn when `userId` is null
    - Test: persists to `DeliverySocketEvent` asynchronously
    - Test: does not throw when `DeliverySocketEvent.create()` fails
    - Test: increments `socketVersion` via `$inc`
    - _Requirements: 1.6, 1.7, 1.8, 1.9, 1b.3_

- [x] 4. ACK retry helper (`emitWithRetry`)
  - Create `emitWithRetry(io, room, eventName, payload, maxRetries = 3)` in `backend/src/domains/delivery/services/deliverySocketEmitter.ts` (or a shared socket utils file)
  - Implement exponential backoff schedule: first retry after 1 s, second after 3 s, third after 5 s; use `io.to(room).timeout(5000).emit()` with ACK callback
  - After 3 failed ACKs, log `warn` with `{ room, eventName, orderId }` and increment `totalAckFailures` counter
  - _Requirements: 6.7, 6.8_

  - [ ]* 4.1 Write unit tests for emitWithRetry
    - Test: resolves immediately on first ACK
    - Test: retries up to 3 times on no-ACK and logs warn after exhaustion
    - Test: increments `ackRetriesPerMin` counter on each retry
    - _Requirements: 6.7, 6.8_

- [x] 5. Socket auth middleware extension (allow customer role)
  - In `backend/src/index.ts`, extend the existing `io.use()` JWT middleware to also allow `role === 'customer'` in addition to `'delivery'` and `'admin'`
  - Attach decoded JWT fields (`userId`, `role`) to `socket.data` for use in room handlers
  - _Requirements: 7.1, 5.7_

- [x] 6. `join_room` rate limiter (10/min per socket)
  - In `backend/src/index.ts`, add an in-memory `joinRoomCounts` map (`socketId → { count, resetAt }`) inside `io.on('connection')`
  - Enforce max 10 `join_room` calls per socket per minute; silently ignore and log `warn` on excess
  - Delete the socket's entry from `joinRoomCounts` on `disconnect`
  - _Requirements: 7.7_

  - [ ]* 6.1 Write unit tests for join_room rate limiter
    - Test: allows first 10 `join_room` calls per minute
    - Test: silently ignores the 11th call and logs warn
    - Test: resets counter after 60 seconds
    - _Requirements: 7.7_

- [x] 7. Location throttle (3 s per-rider, in-memory map)
  - In `backend/src/index.ts`, add `locationThrottle: Map<riderId, lastEmitMs>` in the `liveLocationEvents.on('location')` handler
  - Drop updates within 3 seconds of the previous emit for the same rider; increment `eventsDroppedThrottlePerMin` counter on drop
  - Clean up the rider's entry from `locationThrottle` on socket `disconnect`
  - _Requirements: 4.5a_

  - [ ]* 7.1 Write property test for location throttle (Property 8)
    - **Property 8: Location throttle — at most one emit per rider per 3 seconds**
    - Generate a random sequence of 2–10 location updates for the same rider within a 3-second window; assert `io.to('admin_room').emit('driver:location:update')` is called exactly once
    - **Validates: Requirement 4.5a**

  - [ ]* 7.2 Write unit tests for location throttle
    - Test: drops second location update within 3 seconds
    - Test: allows update after 3-second window expires
    - Test: cleans up throttle map on disconnect
    - _Requirements: 4.5a_

- [x] 8. `sync_request` / `sync_response` handler with 500-event backpressure cap
  - In `backend/src/index.ts`, add `socket.on('sync_request', ...)` inside `io.on('connection')`
  - Query `DeliverySocketEvent.find({ riderId, timestamp: { $gt: since } }).sort({ timestamp: 1 }).limit(500)`
  - Emit `sync_response { orders, fullRefetchRequired: wasCapped }` where `wasCapped = events.length === 500`
  - Log `{ riderId, lastEventTimestamp, eventsFound, wasCapped }` at `info` level; emit `sync_response { orders: [] }` on DB error and log `error`
  - _Requirements: 2.5, 6.2, 6.3, 1b.5, 10.3_

  - [ ]* 8.1 Write unit tests for sync_request handler
    - Test: queries `DeliverySocketEvent` with correct filter `{ riderId, timestamp: { $gt: since } }`
    - Test: emits `sync_response` with empty array on DB error
    - Test: sets `fullRefetchRequired: true` when result is capped at 500
    - Test: logs `eventsFound` count
    - _Requirements: 2.5, 6.2, 6.3_

- [x] 9. Wire DeliverySocketEmitter into all delivery controllers
  - In `backend/src/domains/delivery/controllers/deliveryOrderController.ts`, inject `DeliverySocketEmitter` (via `req.app.get('io')` or constructor injection)
  - Call `emitter.emitStatusChanged(...)` after each successful state transition in: `pickupOrder`, `startDelivery`, `markArrived`, `verifyDeliveryOtp`, `recordDeliveryAttempt`
  - Pass `previousStatus` (captured before the transition) and `options` (from the request context) to `emitStatusChanged`
  - Remove any existing ad-hoc `io.to(...).emit(...)` calls for these events from the controllers
  - _Requirements: 1.1, 1.8, 8.2_

  - [ ]* 9.1 Write unit tests for controller wiring
    - Test: `pickupOrder` calls `emitStatusChanged` with correct `previousStatus` and post-transition order
    - Test: `verifyDeliveryOtp` calls `emitStatusChanged` with correct payload
    - Test: no duplicate emissions (emitter called exactly once per mutation)
    - _Requirements: 1.1, 1.8_

- [x] 10. Wire DeliverySocketEmitter into OrderEventBroadcaster
  - In `backend/src/domains/orders/services/orderEventBroadcaster.ts`, update `broadcastStatusChange` to call `DeliverySocketEmitter.emitStatusChanged` instead of (or in addition to) the existing `io.to('admin_room').emit('order:status:changed')`
  - Ensure the broadcaster now emits to `delivery:{deliveryBoyId}` and `order:{userId}` in addition to `admin_room`, using the order's `deliveryBoyId` and `userId` fields
  - _Requirements: 1.5_

  - [ ]* 10.1 Write unit tests for OrderEventBroadcaster
    - Test: emits to all three rooms via `DeliverySocketEmitter`
    - Test: handles null `deliveryBoyId` gracefully (no throw)
    - _Requirements: 1.5, 1.6_

- [x] 11. Checkpoint — backend complete
  - Ensure all backend unit tests pass
  - Verify `DeliverySocketEvent` collection is created with correct indexes in a local MongoDB instance
  - Ask the user if questions arise before proceeding to frontend work

- [x] 12. `useDeliverySocket` hook redesign
  - Replace `apps/customer-app/src/hooks/delivery/useDeliverySocket.ts` with the redesigned implementation
  - Single `useEffect` with `[token, userId, dispatch]` dependencies; all listeners registered and cleaned up inside it
  - Implement version guard: discard `order:status:changed` if `event.version <= cached.version`
  - Implement shallow merge for `order:status:changed`: update only `orderStatus`, `deliveryStatus`, `allowedActions`, `version`, `timestamp`
  - Implement full replacement for `order:assigned`
  - Implement `sync_request` on reconnect: if disconnected > 5 s emit `sync_request`; if disconnected > 60 s do full cache invalidation
  - Implement polling fallback: start 30-second `setInterval` on `disconnect`, cancel on `connect`
  - Implement event deduplication via `Map<eventId, processedAtMs>` with 60-second TTL purge
  - Implement `AppState` subscription: emit `sync_request` on foreground after 30+ seconds in background; do NOT disconnect on background
  - Persist last event timestamp to `AsyncStorage` key `delivery_socket_last_event_ts`
  - Handle `sync_response` with `fullRefetchRequired` flag: full invalidation if true, otherwise merge with version guard
  - Handle `order:cancelled` and `order:reassigned` by filtering the order from cache
  - Handle unknown `orderId` in `order:status:changed` by triggering a targeted single-order refetch
  - Configure socket with `reconnection: true`, `reconnectionDelay: 1000`, `reconnectionDelayMax: 30000`, `reconnectionAttempts: Infinity`
  - Return `{ socketStatus: 'connected' | 'reconnecting' | 'disconnected' }`
  - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.1, 3.1a, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1, 6.2, 6.5, 6.6, 9.5, 9.6, 9c.1, 9c.2, 9c.3, 9c.5, 9c.6_

  - [ ]* 12.1 Write property test for event deduplication idempotency (Property 4)
    - **Property 4: Event deduplication is idempotent**
    - Generate a random `StatusChangedPayload` with a fixed `eventId`; process it N times (N = 2–5); assert cache state after N processings equals state after 1 processing
    - **Validates: Requirement 8.6**

  - [ ]* 12.2 Write property test for version guard prevents state regression (Property 5)
    - **Property 5: Version guard prevents state regression**
    - Generate a random cached order with `version = V`; generate event with `version <= V`; assert cache is unchanged after processing
    - **Validates: Requirements 1.9, 3.1a**

  - [ ]* 12.3 Write property test for partial update merge preserves non-updated fields (Property 6)
    - **Property 6: Partial update merge preserves non-updated fields**
    - Generate a random cached order with all fields populated; generate `order:status:changed` event (partial payload); assert all non-payload fields (`address`, `userId`, `totalAmount`, `paymentMethod`, `items`, etc.) are identical before and after merge
    - **Validates: Requirements 3.2, 3.4**

  - [ ]* 12.4 Write property test for no duplicate orders after sync_response (Property 7)
    - **Property 7: No duplicate orders in cache after sync_response**
    - Generate a random initial cache with N orders; generate `sync_response` containing a mix of existing and new orders; assert final cache has no duplicate `_id`s and all orders are present
    - **Validates: Requirements 2.6, 6.3, 6.4**

  - [ ]* 12.5 Write property test for polling fallback mutual exclusion (Property 9)
    - **Property 9: Polling fallback is mutually exclusive with socket connection**
    - Generate a random sequence of `connect` and `disconnect` events; assert at every point: if socket is connected, no polling interval is active; if socket is disconnected, polling interval is active
    - **Validates: Requirements 9.5, 9.6**

  - [ ]* 12.6 Write unit tests for useDeliverySocket
    - Test: registers all listeners in a single `useEffect`
    - Test: calls `socket.off` for every listener in cleanup
    - Test: calls `socket.disconnect()` on unmount, NOT on re-render
    - Test: starts polling on disconnect, stops on reconnect
    - Test: emits `sync_request` on reconnect after 5+ second disconnect
    - Test: performs full cache invalidation on reconnect after 60+ second disconnect
    - Test: emits `sync_request` on foreground after 30+ second background
    - Test: does NOT disconnect on background
    - _Requirements: 9c.1, 9c.2, 9c.3, 9c.5, 9c.6_

- [x] 13. `useAdminSocket` hook (new, with 500 ms batching)
  - Create `apps/admin-dashboard/src/hooks/useAdminSocket.ts`
  - Single `useEffect` with `[token, dispatch]` dependencies; all listeners registered and cleaned up inside it
  - On `connect`: emit `join_room { room: 'admin_room', token }`
  - On `reconnect`: dispatch `adminApi.util.invalidateTags(['AdminOrders', 'AdminRiders'])` for full state refresh
  - Implement 500 ms batch flush for `order:status:changed`: accumulate events in `pendingUpdates[]`, apply in one immer pass via `setTimeout(flush, 500)`; cancel timer on cleanup
  - Implement event deduplication (same `Map<eventId, processedAtMs>` pattern as `useDeliverySocket`)
  - Handle `order:assigned`: full replacement in admin orders cache
  - Handle `driver:status:update`: update rider `availability` and `status` in admin riders cache
  - Handle `driver:location:update`: dispatch `adminActions.updateRiderLocation(data)`
  - Configure socket with same reconnection parameters as `useDeliverySocket`
  - Return `{ socketStatus: 'connected' | 'reconnecting' | 'disconnected' }`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 9c.4_

  - [ ]* 13.1 Write unit tests for useAdminSocket
    - Test: joins `admin_room` on connect
    - Test: invalidates admin cache tags on reconnect
    - Test: batches `order:status:changed` events and flushes after 500 ms
    - Test: deduplicates events by `eventId`
    - Test: cleans up all listeners and disconnects on unmount
    - _Requirements: 4.1, 4.7, 4.8, 9c.4_

- [x] 14. `useOrderTrackingSocket` hook (new)
  - Create `apps/customer-app/src/hooks/useOrderTrackingSocket.ts`
  - Accept `orderId: string` parameter; single `useEffect` with `[token, orderId]` dependencies
  - On `connect`: emit `join_order_room { orderId, token }`
  - Handle `order:status:changed`: shallow-merge `orderStatus` into local state; set `isDelivered` / `isFailed` flags; disconnect on terminal states (`DELIVERED`, `FAILED`)
  - Handle `order:location:update`: update `riderLat`, `riderLng`, `etaMinutes` in local state
  - Clean up listeners and call `socket.disconnect()` on unmount
  - Configure socket with same reconnection parameters
  - Return `OrderTrackingState { orderStatus, riderLat, riderLng, etaMinutes, isDelivered, isFailed, failureReason }`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9c.4_

  - [ ]* 14.1 Write unit tests for useOrderTrackingSocket
    - Test: emits `join_order_room` on connect
    - Test: updates state on `order:status:changed`
    - Test: disconnects on `DELIVERED` status
    - Test: disconnects on `FAILED` status
    - Test: cleans up listeners on unmount
    - _Requirements: 5.1, 5.4, 5.5, 5.6_

- [x] 15. Offline mutation queue service (`offlineMutationQueue` + `useOfflineQueueReplay`)
  - Create `apps/customer-app/src/services/offlineMutationQueue.ts` with `enqueue`, `getAll`, `remove`, `incrementRetry` methods backed by `AsyncStorage` key `delivery_offline_queue`
  - Enforce cap of 20 entries: drop oldest and log `warn` when cap is reached
  - Create `useOfflineQueueReplay` hook that subscribes to `useNetworkStatus`; on `isConnected` transition from `false` to `true`, replay entries in FIFO order: remove on 2xx, remove + toast on 4xx/5xx, increment `retryCount` on network error
  - Handle corrupted JSON in `AsyncStorage`: reset queue to `[]` and log `error`
  - _Requirements: 9b.1, 9b.2, 9b.3, 9b.4, 9b.5, 9b.6, 9b.7_

  - [ ]* 15.1 Write property test for offline queue FIFO and bounded (Property 10)
    - **Property 10: Offline queue is FIFO and bounded**
    - Generate a random sequence of 1–30 mutations to enqueue; assert queue never exceeds 20 entries; assert replay order matches enqueue order for the retained entries
    - **Validates: Requirements 9b.3, 9b.5, 9b.6, 9b.7**

  - [ ]* 15.2 Write unit tests for offlineMutationQueue
    - Test: enqueues entry with correct shape (`id`, `action`, `orderId`, `args`, `enqueuedAt`, `retryCount`)
    - Test: drops oldest entry when cap of 20 is reached
    - Test: replays in FIFO order
    - Test: removes entry on 2xx response
    - Test: removes entry on 4xx/5xx response
    - Test: increments `retryCount` on network error
    - Test: resets queue on corrupted JSON
    - _Requirements: 9b.1, 9b.2, 9b.3, 9b.4, 9b.5, 9b.6, 9b.7_

- [x] 16. Remove post-mutation `refetch()` calls from DeliveryHomeTab
  - In `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx` (and any related delivery screen files), remove all `refetch()` calls triggered as side effects of successful mutations: `handlePickup`, `handleStartDelivery`, `handleMarkArrived`, `handleVerifyOtp`, `handleFailDelivery`
  - Update each mutation success handler to update the RTK Query cache optimistically from the mutation response body (which includes `allowedActions`) instead of refetching
  - Ensure mutation failure handlers do NOT update the cache and display an error toast
  - Remove any `setInterval` + `refetch` polling loops from the admin dashboard order/rider list components
  - _Requirements: 3.6, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 16.1 Write unit tests for mutation handlers
    - Test: `handlePickup` does not call `refetch()` on success
    - Test: mutation success handler updates cache from response body
    - Test: mutation failure handler does not update cache
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 17. `/admin/socket-stats` endpoint + SocketMetrics counters
  - Add `GET /admin/socket-stats` route in the backend, protected by admin JWT middleware
  - Handler reads `SocketMetrics` from `deliverySocketEmitter.ts` and calls `io.sockets.adapter.rooms` to compute `connectedSocketsPerRoom`
  - Return `200` with the `SocketMetrics` object shape defined in the design
  - _Requirements: 10.6_

  - [ ]* 17.1 Write unit tests for /admin/socket-stats
    - Test: returns 200 with correct metrics shape for admin user
    - Test: returns 401 for unauthenticated request
    - _Requirements: 10.6_

- [x] 18. Checkpoint — frontend and observability complete
  - Ensure all frontend unit tests pass
  - Verify `useDeliverySocket`, `useAdminSocket`, and `useOrderTrackingSocket` are wired into their respective entry-point components
  - Verify `useOfflineQueueReplay` is mounted at the app root (or delivery navigator root)
  - Ask the user if questions arise before proceeding to integration tests

- [x] 19. Property-based tests (fast-check, 10 properties)
  - Create test file(s) using `fast-check` covering all 10 design properties
  - Each property runs a minimum of 100 iterations
  - Annotate each test with its property number and the requirements clause it validates

  - [ ]* 19.1 Property 1 — Emission targets all three rooms
    - **Property 1: Emission targets all three rooms for every status change**
    - **Validates: Requirements 1.1, 1.5**

  - [ ]* 19.2 Property 2 — allowedActions matches computeAllowedActions
    - **Property 2: allowedActions in payload equals computeAllowedActions output**
    - **Validates: Requirements 1.3, 3.2**

  - [ ]* 19.3 Property 3 — socketVersion increments monotonically
    - **Property 3: socketVersion increments monotonically**
    - **Validates: Requirement 1.9**

  - [ ]* 19.4 Property 4 — Event deduplication is idempotent
    - **Property 4: Event deduplication is idempotent**
    - **Validates: Requirement 8.6**

  - [ ]* 19.5 Property 5 — Version guard prevents state regression
    - **Property 5: Version guard prevents state regression**
    - **Validates: Requirements 1.9, 3.1a**

  - [ ]* 19.6 Property 6 — Partial update merge preserves non-updated fields
    - **Property 6: Partial update merge preserves non-updated fields**
    - **Validates: Requirements 3.2, 3.4**

  - [ ]* 19.7 Property 7 — No duplicate orders after sync_response
    - **Property 7: No duplicate orders in cache after sync_response**
    - **Validates: Requirements 2.6, 6.3, 6.4**

  - [ ]* 19.8 Property 8 — Location throttle at most one emit per 3 seconds
    - **Property 8: Location throttle — at most one emit per rider per 3 seconds**
    - **Validates: Requirement 4.5a**

  - [ ]* 19.9 Property 9 — Polling fallback mutual exclusion
    - **Property 9: Polling fallback is mutually exclusive with socket connection**
    - **Validates: Requirements 9.5, 9.6**

  - [ ]* 19.10 Property 10 — Offline queue FIFO and bounded
    - **Property 10: Offline queue is FIFO and bounded**
    - **Validates: Requirements 9b.3, 9b.5, 9b.6, 9b.7**

- [x] 20. Integration tests (sync_request, auth, room isolation)
  - Create integration test suite running against a real MongoDB test database and a real Socket.IO server instance

  - [ ]* 20.1 sync_request returns correct events from DeliverySocketEvent collection
    - Seed `DeliverySocketEvent` with known events; connect a rider socket; emit `sync_request`; assert `sync_response` contains exactly the expected events
    - _Requirements: 2.5, 6.2, 6.3_

  - [ ]* 20.2 DeliverySocketEvent TTL index is configured correctly
    - Call `listIndexes` on the collection; assert TTL index on `createdAt` with `expireAfterSeconds: 86400` exists
    - _Requirements: 1b.4_

  - [ ]* 20.3 socketVersion is correctly incremented in Order document after emission
    - Create an order with `socketVersion: 0`; call `emitStatusChanged`; assert `Order.findById` returns `socketVersion: 1`
    - _Requirements: 1.9_

  - [ ]* 20.4 Socket auth middleware rejects connections without valid JWT
    - Attempt to connect without a token; assert connection is rejected with `Unauthorized`
    - _Requirements: 7.1_

  - [ ]* 20.5 join_room for delivery:{userId} denied when room userId does not match JWT userId
    - Connect as rider A; emit `join_room { room: 'delivery:{riderB_id}' }`; assert rider A does NOT receive events emitted to that room
    - _Requirements: 7.2, 7.5_

  - [ ]* 20.6 join_order_room denied when order.userId does not match JWT userId
    - Connect as customer A; emit `join_order_room { orderId: orderOwnedByCustomerB }`; assert join is silently ignored
    - _Requirements: 7.3, 7.5_

  - [ ]* 20.7 join_room for admin_room denied for non-admin users
    - Connect as a rider; emit `join_room { room: 'admin_room' }`; assert rider does NOT receive events emitted to `admin_room`
    - _Requirements: 7.4, 7.5_

- [x] 21. Final checkpoint — all tests pass
  - Ensure all unit, property-based, and integration tests pass
  - Verify no legacy event names (`order_assigned`, `order_updated`, `order_picked_up`, `order_arrived`, `refresh_orders`) are emitted from delivery controllers
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 11, 18, 21) ensure incremental validation before moving to the next phase
- Property tests validate universal correctness properties using `fast-check` (minimum 100 iterations each)
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests require a real MongoDB instance and Socket.IO server — run with `--testPathPattern=integration` or equivalent
