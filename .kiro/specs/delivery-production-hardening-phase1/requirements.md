# Requirements Document

## Introduction

This feature hardens the delivery partner app (React Native + Expo) for production use. The UI transformation (DeliveryHomeTab, state engine, components) is already complete. This phase adds four critical production-readiness capabilities:

1. **Real-Time Socket Layer** — replace polling with socket.io push events so riders receive new orders and status updates instantly.
2. **Anti-Double-Action (Idempotency)** — prevent duplicate API calls from rapid taps on the frontend and deduplicate requests on the backend using Redis.
3. **Order Lock Mechanism** — prevent two riders from accepting the same order simultaneously using MongoDB atomic operations.
4. **Network Failure UX** — detect offline state, show a banner, queue failed actions, and retry when connectivity restores.

The backend already has `socket.io` (v4.8.1), `ioredis`, and `redis` installed. The `delivery:{userId}` socket room join flow is partially implemented in `backend/src/index.ts`. The frontend already has a partial `isToggling` guard on the status toggle action.

## Glossary

- **DeliveryApp**: The React Native + Expo delivery partner mobile application.
- **DeliveryHomeTab**: The main screen component at `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`.
- **SocketServer**: The Node.js + Express + socket.io server running in `backend/src/index.ts`.
- **DeliverySocket**: The `useDeliverySocket` React hook that manages the socket.io client connection on the frontend.
- **NetworkMonitor**: The `useNetworkStatus` React hook that monitors device connectivity using `@react-native-community/netinfo`.
- **ActionGuard**: The per-action `isProcessing` state flag that prevents duplicate in-flight API calls on the frontend.
- **IdempotencyMiddleware**: The Express middleware that deduplicates mutation requests using an `Idempotency-Key` header backed by Redis.
- **IdempotencyRecord**: The Redis-stored object `{ hash: string, response: object }` keyed by `idempotency:{key}`, where `hash` is the SHA-256 of the request body.
- **OrderLock**: The MongoDB atomic `findOneAndUpdate` operation that assigns an order to exactly one rider.
- **RTKCache**: The Redux Toolkit Query cache that stores delivery order data on the frontend.
- **ActionQueue**: The in-memory queue of failed actions that are retried when network connectivity restores.
- **ZoneRoom**: A socket.io room scoped to a delivery zone, named `delivery_zone:{zoneId}`, used to broadcast new orders only to riders in the relevant zone.
- **Rider**: A delivery partner using the DeliveryApp.
- **Order**: A customer order document in MongoDB with a `status` field, `deliveryBoy` field, and `zone` field.
- **ValidTransition**: A state transition from the current order status to a target status that is permitted by the defined delivery flow (`pending → assigned → picked_up → in_transit → arrived → delivered`).

---

## Requirements

### Requirement 1: Real-Time New Order Notifications (Zone-Scoped)

**User Story:** As a Rider, I want to receive new order notifications instantly without refreshing, so that I can accept orders before other riders.

#### Acceptance Criteria

1. WHEN a new order is created and no rider is assigned, THE SocketServer SHALL emit a `new_order` event only to sockets in the `delivery_zone:{order.zone}` room containing the full order payload — NOT to a global room.
2. WHEN a Rider's status is set to online, THE DeliveryApp SHALL join the `delivery_zone:{rider.zone}` socket room, where `rider.zone` is derived from the rider's `assignedAreas[0]` field.
3. WHEN a Rider's status is set to offline, THE DeliveryApp SHALL leave the `delivery_zone:{rider.zone}` socket room.
4. WHEN the DeliverySocket receives a `new_order` event, THE DeliveryApp SHALL update the RTKCache for the `getDeliveryOrders` endpoint with the new order data without triggering a full network refetch.
5. THE SocketServer SHALL NOT use a single global `delivery_online` room for new order broadcasts; doing so is a scaling violation that floods all riders regardless of zone.
6. IF an order's `zone` field is missing or null, THEN THE SocketServer SHALL fall back to emitting to `delivery_zone:default` rather than broadcasting globally.

---

### Requirement 2: Real-Time Order Status Updates to Assigned Rider

**User Story:** As a Rider, I want to receive live updates when my assigned order changes status, so that I always see the current state without manual refresh.

#### Acceptance Criteria

1. WHEN an order's status changes and a rider is assigned to that order, THE SocketServer SHALL emit an `order_updated` event to the `delivery:{riderId}` room containing the updated order payload.
2. WHEN the DeliverySocket receives an `order_updated` event, THE DeliveryApp SHALL update the RTKCache entry for that specific order without triggering a full network refetch.
3. THE SocketServer SHALL only emit `order_updated` to the room matching the assigned rider's ID, not to all online riders.
4. WHEN the DeliverySocket disconnects unexpectedly, THE DeliveryApp SHALL attempt to reconnect with exponential backoff, with a minimum interval of 1 second and a maximum interval of 30 seconds.
5. WHILE the DeliverySocket is reconnecting, THE DeliveryApp SHALL display a "Reconnecting..." indicator to the Rider.

---

### Requirement 3: Socket Authentication and Security

**User Story:** As a system operator, I want socket connections to be authenticated and role-checked, so that only verified delivery partners can receive order events.

#### Acceptance Criteria

1. THE SocketServer SHALL apply a `socket.io` middleware that runs before any connection is accepted.
2. THE middleware SHALL extract the JWT token from `socket.handshake.auth.token`.
3. WHEN the token is valid and the decoded payload contains `role === "delivery"`, THE middleware SHALL attach the decoded payload to `socket.user` and call `next()`.
4. WHEN the token is missing, invalid, or expired, THE middleware SHALL call `next(new Error("Unauthorized"))` and the connection SHALL be rejected.
5. WHEN the decoded token has a `role` other than `"delivery"`, THE middleware SHALL call `next(new Error("Unauthorized"))` and the connection SHALL be rejected.
6. THE DeliverySocket SHALL authenticate the socket connection using the rider's JWT token in the socket handshake `auth.token` field.
7. WHEN the Rider's JWT token expires while the socket is connected, THE DeliverySocket SHALL disconnect, refresh the token, and reconnect with the new token.

---

### Requirement 4: Socket Connection Lifecycle Management

**User Story:** As a Rider, I want the socket connection to be managed automatically, so that I always receive real-time updates without manual intervention.

#### Acceptance Criteria

1. WHEN the DeliveryApp mounts and the Rider is authenticated, THE DeliverySocket SHALL establish a socket.io connection to the SocketServer.
2. WHEN the DeliveryApp unmounts, THE DeliverySocket SHALL disconnect the socket.io connection and clean up all event listeners.
3. WHEN the Rider's authentication token changes, THE DeliverySocket SHALL disconnect the existing connection and establish a new authenticated connection.
4. THE DeliverySocket SHALL join the `delivery:{riderId}` room immediately after a successful connection by emitting a `join_room` event with the rider's token.
5. WHEN the socket connection is established successfully, THE DeliveryApp SHALL stop any active polling interval for `getDeliveryOrders` and rely solely on socket push events for order updates.
6. THE SocketServer SHALL emit a delivery acknowledgement callback on `new_order` events; IF the client does not acknowledge within 5 seconds, THE SocketServer SHALL re-emit the event once.

---

### Requirement 5: Frontend Anti-Double-Action Guard

**User Story:** As a Rider, I want action buttons to be disabled while a request is in-flight, so that I cannot accidentally submit the same action twice.

#### Acceptance Criteria

1. THE DeliveryHomeTab SHALL maintain a separate `isProcessing` boolean state flag for each of the following actions: `accept`, `reject`, `pickup`, `startDelivery`, `markArrived`, `verifyOtp`, `failDelivery`.
2. WHEN an action handler is invoked and the corresponding `isProcessing` flag is `true`, THE DeliveryApp SHALL ignore the invocation and not dispatch a new API call.
3. WHEN an action handler is invoked and the corresponding `isProcessing` flag is `false`, THE DeliveryApp SHALL set the flag to `true` before dispatching the API call.
4. WHEN an API call completes (success or error), THE DeliveryApp SHALL set the corresponding `isProcessing` flag back to `false`.
5. WHILE an `isProcessing` flag is `true`, THE DeliveryApp SHALL render the corresponding action button in a visually disabled state.
6. THE ActionGuard implementation SHALL be extracted into a reusable `useActionGuard` hook that accepts an async action function and returns a guarded wrapper and an `isProcessing` boolean.

---

### Requirement 6: Backend Idempotency Key Deduplication

**User Story:** As a system operator, I want duplicate mutation requests to be safely deduplicated, so that network retries do not cause double state transitions.

#### Acceptance Criteria

1. THE IdempotencyMiddleware SHALL read the `Idempotency-Key` request header on all delivery mutation endpoints: `accept`, `reject`, `pickup`, `start-delivery`, `arrived`, `verify-otp`, `fail`.
2. WHEN a request arrives with an `Idempotency-Key`, THE IdempotencyMiddleware SHALL compute a SHA-256 hash of the serialised request body and store it alongside the cached response as an `IdempotencyRecord`.
3. WHEN a request arrives with an `Idempotency-Key` that has been seen within the last 60 seconds AND the SHA-256 hash of the current request body matches the stored hash, THE IdempotencyMiddleware SHALL return the cached response with HTTP status `200` without re-executing the handler.
4. WHEN a request arrives with an `Idempotency-Key` that has been seen within the last 60 seconds BUT the SHA-256 hash of the current request body does NOT match the stored hash, THE IdempotencyMiddleware SHALL return HTTP `400` with the error body `{ "error": "Idempotency key reuse with different payload" }` and SHALL NOT execute the handler.
5. WHEN a request arrives with an `Idempotency-Key` that has not been seen before, THE IdempotencyMiddleware SHALL execute the handler, store the `IdempotencyRecord` `{ hash, response }` in Redis with a 60-second TTL keyed by `idempotency:{key}`, and return the response.
6. WHEN a request arrives without an `Idempotency-Key` header, THE IdempotencyMiddleware SHALL execute the handler normally without deduplication.
7. THE IdempotencyMiddleware SHALL use the existing Redis client from `backend/src/config/redis.ts` for storage.
8. IF the Redis client is unavailable when checking an idempotency key, THEN THE IdempotencyMiddleware SHALL log a warning and execute the handler normally (fail-open behavior).
9. THE DeliveryApp SHALL generate and attach an `Idempotency-Key` header on all delivery mutation API calls, using the format `{action}:{orderId}:{timestamp}`.

---

### Requirement 7: Order Lock — Atomic Accept

**User Story:** As a system operator, I want only one rider to be able to accept a given order, so that two riders cannot be assigned to the same order simultaneously.

#### Acceptance Criteria

1. WHEN a Rider submits an accept request for an order, THE SocketServer SHALL perform a MongoDB `findOneAndUpdate` with the filter `{ _id: orderId, status: "pending" }` and the update `{ $set: { status: "assigned", deliveryBoy: riderId } }` atomically.
2. WHEN the atomic update succeeds (order was in `pending` status), THE SocketServer SHALL return HTTP `200` with the updated order.
3. WHEN the atomic update fails because the order is no longer in `pending` status (another rider accepted first), THE SocketServer SHALL return HTTP `409` with the error body `{ "error": "Order already taken by another rider" }`.
4. THE OrderLock operation SHALL NOT use a separate read-then-write pattern; the filter and update MUST be applied in a single `findOneAndUpdate` call.
5. WHEN the DeliveryApp receives an HTTP `409` response on an accept action, THE DeliveryApp SHALL display the message "Order already taken by another rider" to the Rider and remove the order from the local order list.

---

### Requirement 8: Network Status Detection

**User Story:** As a Rider, I want the app to detect when I go offline, so that I am informed and my actions are not silently lost.

#### Acceptance Criteria

1. THE NetworkMonitor SHALL use `@react-native-community/netinfo` to subscribe to network state changes.
2. WHEN the device transitions from online to offline, THE NetworkMonitor SHALL update a global `isOnline` boolean state to `false`.
3. WHEN the device transitions from offline to online, THE NetworkMonitor SHALL update the global `isOnline` boolean state to `true`.
4. THE NetworkMonitor SHALL expose the `isOnline` state and a `connectionType` string via a `useNetworkStatus` hook.
5. THE NetworkMonitor SHALL check the initial network state on mount and set `isOnline` accordingly.

---

### Requirement 9: Offline Banner UI

**User Story:** As a Rider, I want to see a clear offline indicator when I lose connectivity, so that I know my actions may not be processed.

#### Acceptance Criteria

1. WHILE `isOnline` is `false`, THE DeliveryHomeTab SHALL render a red banner at the top of the screen with the text "No Internet Connection".
2. WHILE the DeliverySocket is in a reconnecting state, THE DeliveryHomeTab SHALL render a yellow banner at the top of the screen with the text "Reconnecting...".
3. WHEN `isOnline` transitions from `false` to `true` and the socket is connected, THE DeliveryHomeTab SHALL hide the offline banner.
4. THE offline banner SHALL be rendered above all other content and SHALL NOT be obscured by the ControlBar or ScrollView.
5. THE offline banner SHALL display the connection type (e.g., "wifi", "cellular") when the device is online, for diagnostic purposes in a collapsed/subtitle form.

---

### Requirement 10: Action Queue and Retry on Reconnect

**User Story:** As a Rider, I want failed actions to be retried automatically when I come back online, so that I do not lose work done while briefly offline.

#### Acceptance Criteria

1. WHEN an action API call fails due to a network error (not a server error), THE DeliveryApp SHALL add the action to the ActionQueue with its parameters.
2. THE ActionQueue SHALL persist in memory for the lifetime of the DeliveryHomeTab component.
3. WHEN `isOnline` transitions from `false` to `true`, THE DeliveryApp SHALL attempt to replay all queued actions in the order they were added.
4. BEFORE retrying a queued action, THE DeliveryApp SHALL fetch the latest order state for the relevant `orderId` and validate that the intended transition is a ValidTransition; IF the transition is no longer valid (e.g. order was delivered or cancelled), THE DeliveryApp SHALL silently discard the queued action without alerting the Rider.
5. WHEN a queued action passes ValidTransition check and succeeds on retry, THE DeliveryApp SHALL remove it from the ActionQueue.
6. WHEN a queued action fails on retry with a server error (HTTP 4xx or 5xx), THE DeliveryApp SHALL remove it from the ActionQueue and display an error alert to the Rider.
7. THE ActionQueue SHALL hold a maximum of 10 pending actions; IF a new action would exceed this limit, THEN THE DeliveryApp SHALL discard the oldest queued action and log a warning.
8. WHILE actions are being replayed from the ActionQueue, THE DeliveryApp SHALL display a "Syncing..." indicator to the Rider.
