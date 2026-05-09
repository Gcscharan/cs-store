# Requirements Document

## Introduction

The delivery platform currently relies on polling (`refetch()` calls after mutations) for all real-time updates. The backend already has Socket.IO partially wired — it emits events like `order_assigned`, `order_updated`, `order:status:changed`, and `new_order` to various rooms — but the mobile app's `useDeliverySocket` hook only handles `new_order` and `order_updated`, and does not systematically listen to all relevant events. The admin dashboard has no structured socket listener layer at all.

This feature replaces polling-based updates with a systematic Socket.IO push architecture so that:
- Riders see new order assignments instantly without manual refresh
- Order status changes are pushed to all relevant parties (rider, admin, customer)
- The mobile app updates its Redux/RTK Query cache from socket events instead of refetching the full order list
- The admin dashboard receives live updates on rider status and order progress
- Reconnection, missed-event recovery, and graceful fallback are handled reliably

The existing socket infrastructure (rooms `delivery:{riderId}`, `admin_room`, `order:{orderId}`, `delivery_zone:{zone}`) and the `useDeliverySocket` hook are extended — not replaced.

---

## Glossary

- **SocketServer**: The Node.js + Express + Socket.IO server in `backend/src/index.ts`.
- **DeliverySocket**: The `useDeliverySocket` React hook at `apps/customer-app/src/hooks/delivery/useDeliverySocket.ts` that manages the Socket.IO client connection on the rider mobile app.
- **AdminSocket**: A new `useAdminSocket` React hook (or equivalent service) on the admin web dashboard that manages the Socket.IO client connection for admin users.
- **CustomerSocket**: A new `useOrderTrackingSocket` React hook on the customer app that manages the Socket.IO client connection for customers tracking a specific order.
- **RTK Query cache**: The Redux Toolkit Query in-memory cache managed via `deliveryApi.util.updateQueryData` and `adminApi.util.updateQueryData`.
- **Delivery Room**: A Socket.IO room named `delivery:{riderId}` that a rider joins on connect. Used for push events targeted at a specific rider.
- **Zone Room**: A Socket.IO room named `delivery_zone:{zone}` that a rider joins based on their assigned area. Used for broadcasting new order assignments to all available riders in a zone.
- **Admin Room**: A Socket.IO room named `admin_room` that admin users join on connect. Used for broadcasting all operational events to all admins.
- **Order Room**: A Socket.IO room named `order:{orderId}` that a customer joins to receive live tracking updates for their specific order.
- **OrderEventBroadcaster**: The service at `backend/src/domains/orders/services/orderEventBroadcaster.ts` that broadcasts `order:status:changed` events to `admin_room`.
- **Delivery Flow**: The canonical order status progression: `ASSIGNED → PICKED_UP → IN_TRANSIT → ARRIVED → DELIVERED | FAILED`.
- **Missed Event**: A socket event emitted while a client was disconnected or reconnecting that was not received.
- **Stale Cache**: An RTK Query cache entry that no longer reflects the current server state, typically due to a missed socket event.
- **Reconnection Window**: The period after a socket reconnects during which the client must reconcile its local cache with the server.
- **`allowedActions`**: The array of permitted next actions for an order, as defined in the delivery-backend-parity-hardening spec. Socket event payloads SHALL include this field so the UI can update without a separate fetch.
- **Event Payload**: The JSON object emitted with each socket event. All delivery event payloads SHALL follow a standardized shape.
- **ACK**: A Socket.IO acknowledgement callback confirming a client received an event.
- **Event Version**: A monotonically increasing integer per order that increments with every state transition. Clients use this to discard out-of-order events.
- **Partial Update**: A socket event payload that contains only the fields that changed (e.g., `orderStatus`, `allowedActions`) and must be merged into the existing cached object — not used to replace it.
- **Full Object**: A socket event payload that contains the complete normalized order document and may safely replace the cached entry.
- **Offline Queue**: A persistent local queue (AsyncStorage) of failed mutations that are retried in order when connectivity is restored.
- **Delivery Event Log**: The `DeliverySocketEvent` MongoDB collection that persists every emitted delivery socket event for sync recovery and audit purposes.

---

## Requirements

### Requirement 1: Standardize Backend Socket Event Emission for Delivery Status Changes

**User Story:** As a system operator, I want every delivery status change to emit a consistent, well-structured socket event to all relevant parties, so that no client misses a state change and all events carry enough data to update the UI without a follow-up fetch.

#### Acceptance Criteria

1. WHEN any delivery order status changes (via `pickupOrder`, `startDelivery`, `markArrived`, `verifyDeliveryOtp`, or `recordDeliveryAttempt`), THE SocketServer SHALL emit an `order:status:changed` event to the following rooms simultaneously:
   - `delivery:{riderId}` — the assigned rider's personal room
   - `admin_room` — all connected admins
   - `order:{orderId}` — the customer tracking that order
2. THE `order:status:changed` event payload SHALL conform to this shape:
   ```json
   {
     "orderId": "<string>",
     "orderStatus": "<string>",
     "deliveryStatus": "<string>",
     "previousStatus": "<string>",
     "allowedActions": ["<string>"],
     "riderId": "<string>",
     "version": "<number>",
     "eventId": "<uuid v4>",
     "timestamp": "<ISO 8601 string>"
   }
   ```
   The `version` field is a monotonically increasing integer per order, incremented by 1 on every state transition. It is stored on the Order document as `socketVersion`.
3. THE `allowedActions` field in the event payload SHALL be computed by `computeAllowedActions` (from the delivery-backend-parity-hardening spec) using the post-transition order state.
4. WHEN a delivery order is assigned to a rider (via the assignment controller), THE SocketServer SHALL emit an `order:assigned` event to `delivery:{riderId}` and `admin_room` with the full normalized order object including `allowedActions`.
5. THE `OrderEventBroadcaster` SHALL be updated to emit `order:status:changed` to `delivery:{riderId}` and `order:{orderId}` in addition to `admin_room`, using the order's `deliveryBoyId` and `userId` fields.
6. WHEN the `deliveryBoyId` on an order is null or undefined at emission time, THE SocketServer SHALL skip the `delivery:{riderId}` emit and log a warning — it SHALL NOT throw or crash.
7. WHEN the `userId` on an order is null or undefined at emission time, THE SocketServer SHALL skip the `order:{orderId}` emit and log a warning.
8. THE SocketServer SHALL NOT emit duplicate events for the same status change — each status change SHALL result in exactly one `order:status:changed` emission per room.
9. WHEN emitting `order:status:changed`, THE SocketServer SHALL atomically increment the `socketVersion` field on the Order document using `$inc: { socketVersion: 1 }` and include the resulting value in the event payload.

---

### Requirement 1b: Delivery Event Log — Persistent Event Storage for Sync Recovery

**User Story:** As a system operator, I want every emitted delivery socket event to be persisted in a dedicated collection so that reconnecting clients can recover missed events reliably.

#### Acceptance Criteria

1. THE backend SHALL persist every emitted delivery socket event in a `DeliverySocketEvent` MongoDB collection with the following schema:
   ```typescript
   {
     _id: ObjectId,
     orderId: ObjectId,       // indexed
     riderId: ObjectId,       // indexed
     eventName: string,
     payload: object,         // full event payload including version + eventId
     timestamp: Date,         // indexed
     createdAt: Date,
   }
   ```
2. THE `DeliverySocketEvent` collection SHALL have the following compound indexes:
   - `{ riderId: 1, timestamp: 1 }` — for `sync_request` queries
   - `{ orderId: 1, timestamp: 1 }` — for per-order event history
3. THE backend SHALL write to `DeliverySocketEvent` asynchronously (non-blocking) after emitting the socket event — a write failure SHALL be logged but SHALL NOT prevent the socket emit.
4. THE `DeliverySocketEvent` collection SHALL have a TTL index on `createdAt` with an expiry of 24 hours — events older than 24 hours are automatically deleted.
5. THE `sync_request` handler SHALL query `DeliverySocketEvent` using `{ riderId, timestamp: { $gt: lastEventTimestamp } }` to retrieve missed events.

---

### Requirement 2: Rider Mobile App — Real-Time Order Assignment

**User Story:** As a delivery rider, I want to see new order assignments appear on my screen instantly without refreshing, so that I can accept and act on orders as quickly as possible.

#### Acceptance Criteria

1. WHEN the SocketServer emits `order:assigned` to `delivery:{riderId}`, THE DeliverySocket SHALL receive the event and insert the new order into the RTK Query `getDeliveryOrders` cache if it does not already exist.
2. WHEN the SocketServer emits `new_order` to `delivery_zone:{zone}`, THE DeliverySocket SHALL receive the event, send an ACK, and insert the order into the cache if it does not already exist (deduplication by `_id`).
3. THE DeliverySocket SHALL join both `delivery:{riderId}` and the appropriate `delivery_zone:{zone}` room on connect, using the rider's decoded JWT `userId` to construct the personal room name.
4. WHEN the rider's app reconnects after a disconnection, THE DeliverySocket SHALL emit a `sync_request` event with `{ lastEventTimestamp: <ISO string> }` to request any missed order assignments since the last known event.
5. WHEN the SocketServer receives a `sync_request`, THE SocketServer SHALL respond with a `sync_response` containing all orders assigned to that rider since `lastEventTimestamp`.
6. THE DeliverySocket SHALL merge the `sync_response` orders into the RTK Query cache, updating existing entries and inserting new ones, without triggering a full cache invalidation.
7. WHEN the DeliverySocket receives an `order:assigned` or `new_order` event while the app is in the background (React Native background state), THE mobile app SHALL schedule a local push notification with the order summary.

---

### Requirement 3: Rider Mobile App — Real-Time Order Status Updates

**User Story:** As a delivery rider, I want my order list to update in real time when order statuses change (e.g., a customer cancels, an admin reassigns), so that I am always working with accurate information.

#### Acceptance Criteria

1. WHEN the SocketServer emits `order:status:changed` to `delivery:{riderId}`, THE DeliverySocket SHALL update the matching order in the RTK Query `getDeliveryOrders` cache using the event payload — no HTTP refetch SHALL be triggered.
1a. BEFORE applying an `order:status:changed` event, THE DeliverySocket SHALL compare the event's `version` field against the cached order's `version`. IF `event.version <= cached.version`, THE DeliverySocket SHALL discard the event and log a warning — this prevents state regression from out-of-order delivery.
2. THE DeliverySocket SHALL update the cached order's `orderStatus`, `deliveryStatus`, `allowedActions`, and `timestamp` fields from the event payload — it SHALL merge these fields into the existing cached order object, NOT replace the entire object. Fields not present in the event payload (e.g., `address`, `userId`, `totalAmount`) SHALL be preserved from the existing cache entry.
3. THE `order:assigned` event payload SHALL contain the full normalized order object (same shape as `getDeliveryOrders` response) and MAY replace the cached entry entirely.
4. THE `order:status:changed` event payload is a partial update — clients SHALL merge it into the existing cache entry using a shallow merge strategy.
3. WHEN an `order:status:changed` event arrives for an `orderId` not present in the local cache, THE DeliverySocket SHALL trigger a targeted refetch of that single order (not the full list).
4. WHEN the SocketServer emits `order:cancelled` to `delivery:{riderId}`, THE DeliverySocket SHALL remove the cancelled order from the RTK Query cache and display a toast notification to the rider.
5. WHEN the SocketServer emits `order:reassigned` to `delivery:{riderId}` (indicating the order was taken away), THE DeliverySocket SHALL remove the order from the cache and display a toast notification.
6. THE DeliverySocket SHALL NOT call `refetch()` after any delivery mutation (pickup, start delivery, mark arrived, verify OTP, record attempt) — the mutation response already contains the updated order state with `allowedActions`.

---

### Requirement 4: Admin Dashboard — Real-Time Order and Rider Updates

**User Story:** As an admin, I want my dashboard to reflect live order status changes and rider movements without manual refresh, so that I can monitor operations in real time.

#### Acceptance Criteria

1. THE AdminSocket SHALL connect to the SocketServer on admin dashboard load, authenticate using the admin's JWT, and join `admin_room` by emitting `join_room` with `{ room: "admin_room", token }`.
2. WHEN the SocketServer emits `order:status:changed` to `admin_room`, THE AdminSocket SHALL update the relevant order in the admin's RTK Query (or equivalent state) cache.
3. WHEN the SocketServer emits `order:assigned` to `admin_room`, THE AdminSocket SHALL add or update the order in the admin's order list cache.
4. WHEN the SocketServer emits `driver:status:update` to `admin_room`, THE AdminSocket SHALL update the rider's availability and status in the admin's rider list cache.
5. WHEN the SocketServer emits `driver:location:update` to `admin_room`, THE AdminSocket SHALL update the rider's last known coordinates in the admin's rider map state.
5a. THE SocketServer SHALL throttle `driver:location:update` emissions to a maximum of one update per rider per 3 seconds. If a location update arrives within 3 seconds of the previous emit for the same rider, THE SocketServer SHALL drop the update silently — it SHALL NOT queue it.
6. WHEN the SocketServer emits `delivery_attempt_failed` or `delivery_attempt_success` to `admin_room`, THE AdminSocket SHALL update the relevant order's attempt count and status in the admin cache.
7. THE AdminSocket SHALL reconnect automatically with exponential backoff (initial delay 1 s, max delay 30 s, unlimited attempts) when the connection is lost.
8. WHEN the AdminSocket reconnects, THE AdminSocket SHALL request a full state refresh by invalidating and refetching the admin's active orders and riders cache — no `sync_request` mechanism is required for admins (full refetch is acceptable given lower volume).
9. THE admin dashboard SHALL display a connection status indicator showing `connected`, `reconnecting`, or `disconnected`.

---

### Requirement 5: Customer App — Real-Time Order Tracking

**User Story:** As a customer, I want to see my order's delivery status and the rider's live location update in real time on the tracking screen, so that I know exactly where my order is.

#### Acceptance Criteria

1. WHEN a customer opens the order tracking screen, THE CustomerSocket SHALL connect to the SocketServer, authenticate using the customer's JWT, and join `order:{orderId}` by emitting `join_order_room` with `{ orderId, token }`.
2. WHEN the SocketServer emits `order:status:changed` to `order:{orderId}`, THE CustomerSocket SHALL update the displayed order status and delivery progress indicator without a page reload.
3. WHEN the SocketServer emits `order:location:update` to `order:{orderId}`, THE CustomerSocket SHALL update the rider's pin on the map and the displayed ETA.
4. WHEN the customer navigates away from the tracking screen, THE CustomerSocket SHALL disconnect from the `order:{orderId}` room.
5. WHEN the SocketServer emits `order:status:changed` with `orderStatus: "DELIVERED"` to `order:{orderId}`, THE CustomerSocket SHALL display a delivery confirmation screen and disconnect from the order room.
6. WHEN the SocketServer emits `order:status:changed` with `orderStatus: "FAILED"` to `order:{orderId}`, THE CustomerSocket SHALL display a delivery failure notification with the failure reason.
7. THE CustomerSocket SHALL NOT require the customer to be authenticated as a delivery or admin role — the `join_order_room` handler already validates order ownership via JWT.

---

### Requirement 6: Reconnection and Missed-Event Recovery

**User Story:** As a system operator, I want the socket layer to recover gracefully from disconnections so that no critical state update is permanently lost, even on flaky mobile networks.

#### Acceptance Criteria

1. THE DeliverySocket SHALL use Socket.IO's built-in reconnection with `reconnection: true`, `reconnectionDelay: 1000`, `reconnectionDelayMax: 30000`, `reconnectionAttempts: Infinity`.
2. WHEN the DeliverySocket reconnects after a disconnection longer than 5 seconds, THE DeliverySocket SHALL emit a `sync_request` with the timestamp of the last received event to recover missed events.
3. THE SocketServer SHALL handle `sync_request` by querying the `OrderEvent` collection for all `ORDER_STATUS_CHANGED` events for that rider's orders since `lastEventTimestamp` and emitting a `sync_response`.
4. THE `sync_response` payload SHALL be:
   ```json
   {
     "orders": [{ "orderId": "<string>", "orderStatus": "<string>", "allowedActions": ["<string>"], "timestamp": "<ISO string>" }]
   }
   ```
5. WHEN the DeliverySocket has been disconnected for more than 60 seconds, THE DeliverySocket SHALL perform a full cache invalidation and refetch of `getDeliveryOrders` instead of relying on `sync_response` — this is the fallback for extended outages.
6. THE DeliverySocket SHALL track the timestamp of the last successfully received socket event in `AsyncStorage` under the key `delivery_socket_last_event_ts` so that the sync timestamp survives app restarts.
7. WHEN the SocketServer emits an event and receives no ACK within 5 seconds (for events that support ACK), THE SocketServer SHALL re-emit the event up to 3 times using exponential backoff: first retry after 1 s, second after 3 s, third after 5 s.
8. THE SocketServer SHALL NOT re-emit more than 3 times per event — after 3 failed ACKs, the event is logged as undelivered and the client is expected to recover via `sync_request` on reconnect.

---

### Requirement 7: Socket Authentication and Room Security

**User Story:** As a system operator, I want socket room access to be strictly controlled so that riders cannot receive other riders' events, customers cannot receive other customers' order data, and unauthenticated connections are rejected.

#### Acceptance Criteria

1. THE SocketServer's authentication middleware SHALL reject any connection that does not provide a valid JWT in `socket.handshake.auth.token` or the `Authorization` header, returning an `Unauthorized` error.
2. THE SocketServer SHALL only allow a rider to join `delivery:{userId}` where `userId` matches the `userId` in their decoded JWT — joining another rider's room SHALL be denied.
3. THE SocketServer SHALL only allow a user to join `order:{orderId}` if the order's `userId` field matches the authenticated user's `userId` — joining another customer's order room SHALL be denied.
4. THE SocketServer SHALL only allow users with `role === "admin"` to join `admin_room`.
5. WHEN a socket client attempts to join a room they are not authorized for, THE SocketServer SHALL silently ignore the request and log a warning — it SHALL NOT disconnect the client.
6. THE SocketServer SHALL NOT emit any event payload containing sensitive fields (e.g., full customer address, payment card details, OTP values) to the `delivery:{riderId}` or `admin_room` rooms.
7. THE SocketServer SHALL rate-limit `join_room` requests to a maximum of 10 per socket per minute to prevent room-flooding attacks.

---

### Requirement 8: Event Payload Standardization

**User Story:** As a frontend developer, I want all socket event payloads to follow a consistent, documented schema so that I can write reliable event handlers without guessing field names.

#### Acceptance Criteria

1. THE SocketServer SHALL emit all delivery-related events using the following canonical event names:
   - `order:assigned` — new order assigned to a rider
   - `order:status:changed` — any delivery status transition
   - `order:cancelled` — order cancelled by customer or admin
   - `order:reassigned` — order reassigned to a different rider
   - `driver:status:update` — rider availability or online status changed
   - `driver:location:update` — rider GPS coordinates updated
   - `order:location:update` — rider location update for a specific order (customer-facing)
   - `sync_response` — response to a `sync_request` after reconnection
2. THE SocketServer SHALL NOT emit legacy event names (`order_assigned`, `order_updated`, `order_picked_up`, `order_arrived`, `refresh_orders`) to new rooms — these legacy events SHALL be deprecated and removed from delivery controllers after this feature is live.
3. WHEN a legacy event name is still emitted (during transition), THE SocketServer SHALL also emit the canonical event name to the same room so both old and new listeners work simultaneously.
4. ALL event payloads SHALL include a `timestamp` field in ISO 8601 format representing when the event was generated on the server.
5. ALL event payloads SHALL include an `eventId` field (UUID v4) so clients can deduplicate events received multiple times due to retries.
6. THE DeliverySocket and AdminSocket SHALL deduplicate received events by `eventId`, discarding any event whose `eventId` has already been processed within the last 60 seconds.

---

### Requirement 9: Remove Polling After Mutations

**User Story:** As a frontend developer, I want to eliminate all `refetch()` calls that are triggered after delivery mutations, so that the app relies entirely on socket push events and mutation responses for state updates.

#### Acceptance Criteria

1. THE mobile app SHALL remove all `refetch()` calls that are triggered as a side effect of successful delivery mutations (`handlePickup`, `handleStartDelivery`, `handleMarkArrived`, `handleVerifyOtp`, `handleFailDelivery`).
2. THE mobile app SHALL update the RTK Query cache optimistically from the mutation response body (which includes `allowedActions`) immediately after a successful mutation — no socket event is needed for the actor's own state update.
3. WHEN a mutation fails (network error or server error), THE mobile app SHALL NOT update the cache and SHALL display an error toast — no refetch is needed since the state has not changed.
4. THE admin dashboard SHALL remove all polling intervals (`setInterval` + `refetch`) used for order list and rider list updates, replacing them with socket-driven cache updates.
5. WHEN the socket is in `disconnected` state, THE mobile app SHALL re-enable a single polling fallback: refetch `getDeliveryOrders` every 30 seconds until the socket reconnects.
6. WHEN the socket reconnects, THE mobile app SHALL cancel the polling fallback and resume socket-driven updates.

---

### Requirement 9b: Offline Mutation Queue

**User Story:** As a delivery rider, I want actions I take while offline (e.g., tapping "Mark Arrived" with no signal) to be queued and automatically retried when connectivity is restored, so that no action is silently lost.

#### Acceptance Criteria

1. WHEN a delivery mutation fails due to a network error (no response, timeout, or `fetch` rejection), THE mobile app SHALL persist the failed mutation to an `AsyncStorage` queue under the key `delivery_offline_queue`.
2. THE offline queue entry SHALL contain: `{ id, action, orderId, args, enqueuedAt, retryCount }`.
3. WHEN the network connection is restored (detected via `useNetworkStatus`), THE mobile app SHALL replay queued mutations in FIFO order, one at a time.
4. WHEN a replayed mutation succeeds, THE mobile app SHALL remove it from the queue and update the RTK Query cache from the response.
5. WHEN a replayed mutation fails with a server error (4xx/5xx), THE mobile app SHALL remove it from the queue and display an error toast — server errors are not retried.
6. WHEN a replayed mutation fails again with a network error, THE mobile app SHALL increment `retryCount` and keep it in the queue — it will be retried on the next reconnection.
7. THE offline queue SHALL be capped at 20 entries. If the cap is reached, the oldest entry SHALL be dropped and a warning logged.

---

### Requirement 9c: Socket Listener Lifecycle Management

**User Story:** As a mobile developer, I want socket event listeners to be properly registered and cleaned up so that the app does not accumulate duplicate listeners or leak memory across navigation events.

#### Acceptance Criteria

1. THE `useDeliverySocket` hook SHALL register all event listeners inside a single `useEffect` with a cleanup function that calls `socket.off(eventName, handler)` for every registered listener.
2. THE `useDeliverySocket` hook SHALL guard against duplicate listener registration: if the hook re-renders without the socket instance changing, it SHALL NOT re-register listeners that are already bound.
3. THE `useDeliverySocket` hook SHALL call `socket.disconnect()` in the cleanup function only when the component that owns the socket connection unmounts — not on every re-render.
4. THE `useAdminSocket` and `useOrderTrackingSocket` hooks SHALL follow the same listener lifecycle rules as `useDeliverySocket`.
5. WHEN the app enters the background (React Native `AppState` = `background`), THE `useDeliverySocket` hook SHALL NOT disconnect the socket — it SHALL remain connected to receive push events.
6. WHEN the app returns to the foreground after being in the background for more than 30 seconds, THE `useDeliverySocket` hook SHALL emit a `sync_request` to reconcile any missed events.

---

### Requirement 10: Observability and Error Handling

**User Story:** As a system operator, I want socket events and errors to be logged so that I can diagnose delivery update failures in production.

#### Acceptance Criteria

1. THE SocketServer SHALL log every emitted delivery event at `info` level with fields: `eventName`, `room`, `orderId`, `riderId`, `timestamp`.
2. THE SocketServer SHALL log every failed emission (e.g., no connected sockets in room) at `warn` level with the same fields.
3. THE SocketServer SHALL log every `sync_request` received with fields: `riderId`, `lastEventTimestamp`, `eventsFound`.
4. THE DeliverySocket SHALL log every received event at `debug` level (suppressed in production) with `eventName`, `orderId`, `newStatus`.
5. WHEN the DeliverySocket encounters an error updating the RTK Query cache (e.g., immer mutation error), THE DeliverySocket SHALL log the error and trigger a full `getDeliveryOrders` refetch as a self-healing fallback.
6. THE SocketServer SHALL expose a health metric: count of connected sockets per room, updated every 30 seconds and accessible via `GET /admin/socket-stats` (admin-authenticated).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of the system.*

### Property 1: No duplicate orders in cache after reconnection

*For any* sequence of disconnect → reconnect → `sync_response` events, the RTK Query `getDeliveryOrders` cache SHALL contain each order exactly once. Receiving the same order in both the initial cache and the `sync_response` SHALL result in an update (not a duplicate insertion).

**Validates: Requirements 2.6, 6.3, 6.4**

---

### Property 2: `allowedActions` in socket payload matches `computeAllowedActions` output

*For any* `order:status:changed` event emitted by the SocketServer, the `allowedActions` array in the payload SHALL be identical to the result of calling `computeAllowedActions(order, { codCollected, isNext, riderHasLocation })` with the post-transition order state. No client-side recomputation of `allowedActions` is needed.

**Validates: Requirements 1.3, 3.2**

---

### Property 3: Event deduplication is idempotent

*For any* event received N times with the same `eventId`, the RTK Query cache state after processing SHALL be identical to the state after processing it once. Duplicate events SHALL NOT cause duplicate insertions, double status updates, or multiple toast notifications.

**Validates: Requirement 8.6**

---

### Property 4: Room isolation — riders cannot receive other riders' events

*For any* two riders A and B, an `order:status:changed` event emitted to `delivery:{riderA_id}` SHALL NOT be received by rider B's socket client. Room membership is enforced server-side and cannot be spoofed by the client.

**Validates: Requirements 7.2, 7.5**

---

### Property 5: Polling fallback activates if and only if socket is disconnected

*For any* point in time, the mobile app SHALL be in exactly one of two states: (a) socket connected — no polling active, or (b) socket disconnected — polling active at 30-second intervals. These states SHALL be mutually exclusive and exhaustive.

**Validates: Requirements 9.5, 9.6**

---

### Property 6: Sync recovery completeness

*For any* rider who was disconnected for a period T where T < 24 hours, the `sync_response` SHALL contain all `ORDER_STATUS_CHANGED` events for that rider's orders during T, with no gaps. Events older than 24 hours are not guaranteed (acceptable data retention limit).

**Validates: Requirements 6.2, 6.3**

---

### Property 7: Legacy and canonical events are consistent during transition

*For any* status change emitted during the transition period (while both legacy and canonical event names are active), the payload of the legacy event and the canonical event for the same status change SHALL describe the same order state. No client SHALL observe a state where the legacy event shows status X and the canonical event shows status Y for the same order at the same time.

**Validates: Requirement 8.3**

---

### Property 8: Event ordering — no state regression

*For any* sequence of `order:status:changed` events received by a client for the same `orderId`, the client's cached `orderStatus` SHALL only ever advance forward in the delivery state machine. If event B arrives after event A but has a lower `version` than A, event B SHALL be discarded. The cached state SHALL always reflect the highest-versioned event received.

**Validates: Requirement 1.9, 3.1a**

---

### Property 9: Partial update merge preserves non-updated fields

*For any* `order:status:changed` event applied to a cached order, the fields not present in the event payload (e.g., `address`, `userId`, `totalAmount`, `paymentMethod`) SHALL be identical before and after the merge. No partial update SHALL cause data loss in the cache.

**Validates: Requirements 3.2, 3.3, 3.4**

---

### Property 10: Location throttle — at most one emit per rider per 3 seconds

*For any* rider, the number of `driver:location:update` events emitted to `admin_room` in any 3-second window SHALL be at most 1. Excess updates within the window are silently dropped.

**Validates: Requirement 4.5a**

---

### Property 11: Offline queue is FIFO and bounded

*For any* sequence of offline mutations enqueued while disconnected, they SHALL be replayed in the exact order they were enqueued (FIFO). The queue SHALL never exceed 20 entries. Successful replays SHALL remove entries; server-error replays SHALL also remove entries; network-error replays SHALL retain entries.

**Validates: Requirements 9b.3, 9b.5, 9b.6, 9b.7**
