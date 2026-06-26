# SOCKET & RECONNECT WORKFLOW CATALOG

**Domain:** all real-time messaging across mobile (rider, customer, admin) and backend.
**Authority:** Code-grounded; citations provided.

## File-by-file ownership

| Surface | File | Role |
|---|---|---|
| Backend io setup | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/index.ts:268-625` | server io, auth middleware, room handlers, relay handlers, location fan-out |
| Backend emitter (DEAD in prod) | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/delivery/services/deliverySocketEmitter.ts` | hardened emitter; only used in tests |
| Backend legacy broadcaster | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/orders/services/orderEventBroadcaster.ts` | polls outbox every 5s, emits to admin_room only |
| Backend disabled service | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/services/socketService.ts` | constructed code, not initialized — referenced by route cancellation handler (BROKEN, P1-12) |
| Backend production emits (inline) | `backend/src/domains/operations/controllers/deliveryOrderController.ts` | actual production realtime path |
| Backend payment emits | `backend/src/domains/payments/services/webhookProcessor.ts:441-450` | payment_status_update to user_{userId} |
| Backend assignment emits | `backend/src/controllers/orderAssignmentController.ts:263-284` | order_assigned + order:assigned |
| Mobile socketClient (singleton) | `apps/customer-app/src/services/socketClient.ts` | shared customer/admin client |
| Mobile rider socket | `apps/customer-app/src/hooks/delivery/useDeliverySocket.ts` | rider-specific |
| Mobile admin socket | `apps/customer-app/src/hooks/useProductSocket.ts` | admin product events |
| Mobile customer tracking | `apps/customer-app/src/hooks/useOrderTrackingSocket.ts` | per-order tracking |

## Room reference (canonical)

| Room | Joined by | How | Emitted to from |
|---|---|---|---|
| `user_{userId}` | every authed socket auto-joins | `index.ts:412` | webhookProcessor, deliverAttempt, verifyDeliveryOtp, otpResent |
| `admin_room` | admin role only | `join_room` event (`index.ts:419-471`) | OrderEventBroadcaster, orderAssignmentController, etc. |
| `delivery:{userId}` | rider role only, room=self | `join_room` event (`index.ts:474-528`) | orderAssignmentController, deliveryOrderController inline emits |
| `order:{orderId}` | customer who owns order | `join_order_room` (`index.ts:541-596`) | liveLocationEvents (`index.ts:392`) — **only location, NOT status** |
| `delivery_{deliveryBoyId}` | **NO ONE** | — | `deliveryOrderController.ts:1033` (P1-1 dead room) |
| `driver_{deliveryBoyId}` | **NO ONE** | — | `deliveryOrderController.ts:1037` (P1-1 dead room) |
| `order:{userId}` | **NO ONE** (mismatch with customer's `order:{orderId}`) | — | `deliverySocketEmitter.ts:193` (P0-2; emitter is dead anyway) |

## Event reference (canonical — mobile listens / backend emits)

| Event name | Mobile listener | Backend emit source | Status |
|---|---|---|---|
| `order:assigned` | `useDeliverySocket`, `socketClient` | `orderAssignmentController.ts:263-284` (admin_room + delivery:{userId}) | ✅ working |
| `order_assigned` (snake) | none | same as above | P1-4 dead duplicate |
| `order:status:changed` | `useDeliverySocket`, `socketClient`, `useOrderTrackingSocket` | inline `deliveryOrderController` (no version), `OrderEventBroadcaster` (admin_room only), `deliverySocketEmitter` (dead) | **P0-1 + P0-2 broken** |
| `order:cancelled` | `useDeliverySocket` | `deliverySocketEmitter.emitOrderCancelled` (dead) + inline emits in cancellation paths | partial |
| `order:reassigned` | `useDeliverySocket` | `deliverySocketEmitter.emitOrderReassigned` (dead) | dead |
| `order:location:update` | `useOrderTrackingSocket` | `index.ts:392` to `order:{orderId}` | ✅ working |
| `driver:location:update` | admin web | `index.ts:345` to admin_room | ✅ admin only |
| `notification:refresh` | `socketClient` | `deliverAttempt`, others to `user_{customerId}` | ✅ |
| `payment_status_update` | `socketClient` | `webhookProcessor.ts:444` | ✅ |
| `payment_status_updated` (legacy) | `socketClient` (backward compat) | none | P2-2 dead listener |
| `order_status_updated` | `socketClient` (legacy) | only `socketService.sendOrderStatusUpdate` (disabled) | P2-3 dead path |
| `delivery:earning:credited` | `useDeliverySocket` | `deliveryOrderController.verifyDeliveryOtp` inline to `delivery:{riderUserId}` | ✅ |
| `order:otpResent` | **none** | `deliveryOrderController.ts:2052` to `user_{userId}` | P1-14 unlistened |
| `order_delivered` | `socketClient` (likely) | inline in verifyDeliveryOtp to admin_room + user_{customerId} | partial |
| `order_picked_up` | none | `deliveryOrderController.ts:1027,1033,1037` (dead rooms P1-1) | P1-1 dead |
| `route:order:removed` | rider mobile | `routeCancellationHandler.ts:179-180` (BROKEN P1-12) | P1-12 broken |
| `new_order` | `useDeliverySocket:299` | **none** | P2-1 dead listener |
| `sync_request` (mobile→server) | server-side: **none** | mobile emits | P0-3 unhandled |
| `sync_response` (server→mobile) | `useDeliverySocket` | **none** | P0-3 dead |
| `product:created/updated/deleted` | `useProductSocket` | admin_room emits from product controllers `[NOT VERIFIED exact lines]` | ✅ working |
| `order_status_update` (mobile→server) | server relay (`index.ts:599`) | re-emits to admin_room | **P1-13 SECURITY** |
| `order_created` (mobile→server) | server relay (`index.ts:605`) | re-emits | P1-13 |
| `driver_status_update` (mobile→server) | server relay (`index.ts:611`) | re-emits | P1-13 |
| `verify_otp`, `get_payment_status` | `socketService.ts:87-96` (DISABLED) | none | dead |

---

## SOCK-1 — `socketClient` initialization (singleton)

1. **ID:** SOCK-1
2. **Name:** Mobile general socket (singleton)
3. **Role:** customer + admin (general events)
4. **Entry:** module-level lazy init on first import; or explicit `initializeSocket(token)` call
5. **Trigger:** auth state established
6. **Screens:** all (top-level)
7. **Hooks:** consumed by app-wide listeners
8. **Services:** `services/socketClient.ts`
9. **APIs:** none (socket only); calls `/auth/refresh` on connect_error
10. **Backend:** `index.ts:282` auth middleware
11. **Models:** —
12. **Socket events:** **listen** `order:status:changed`, `order:assigned`, `payment_status_update`, `payment_status_updated`, `delivery_location_updated`, `order_status_updated`, `notification:refresh`, etc.
13. **RTK tags:** invalidates `['Orders','Order']` on `order:status:changed` (P1-5: too broad)
14. **Offline:** auto-reconnect via Socket.IO native
15. **Replay:** —
16. **Notification:** triggers in-app notification refresh
17. **Background task:** —
18. **AsyncStorage:** reads `accessToken` for handshake auth
19. **State transitions:** disconnected ↔ connected
20. **Success path:** io() with auth.token → server middleware verifies → connection event → user_{userId} room auto-joined
21. **Failure path:** `connect_error` → token refresh attempt (`socketClient.ts:209-231`) → retry once
22. **Retry:** Socket.IO built-in exponential backoff
23. **Reconnect:** automatic; on reconnect emits `Orders` invalidation indirectly via subsequent events
24. **App-kill recovery:** re-init on next launch
25. **Polling fallback:** none configured (no engine.io polling fallback explicitly disabled — uses default which may or may not include polling)
26. **Idempotency:** —
27. **Cache invalidation:** broad `['Orders','Order']` on every status change
28. **Optimistic update:** —
29. **Security:** JWT in handshake auth
30. **Final state:** singleton connected
31. **Known bugs:** P1-5 (too-broad invalidation), shared with all consumers
32. **Broken states:** —
33. **Stale-state risks:** if token refresh fails silently, socket reconnects forever with bad token
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** double socket if a hook also calls `io()` directly
37. **Launch risk severity:** P1
38. **Recommended fix:** scope invalidations by orderId via `updateQueryData`; centralize all sockets through socketClient gradually
39. **Safe pre-launch?** invalidation scoping yes; consolidation no (regression)
40. **Coordination:** mobile only

---

## SOCK-2 — `useDeliverySocket` initialization (rider)

1. **ID:** SOCK-2
2. **Name:** Rider-specific socket hook
3. **Role:** delivery (currently runs for any authenticated user — P0-4)
4. **Entry:** mounted by DeliveryHomeTab and possibly higher-up nav `[NOT VERIFIED — likely DeliveryDashboardScreen]`
5. **Trigger:** token + userId set
6. **Screens:** DeliveryHomeTab, DeliveryEarningsTab
7. **Hooks:** itself
8. **Services:** —
9. **APIs:** dispatches `deliveryApi.util.invalidateTags`
10. **Backend:** join_room handler (`index.ts:474-528`)
11. **Models:** —
12. **Socket events:** **emit** `join_room { room: 'delivery:{userId}', token }`, `sync_request`; **listen** `connect`, `disconnect`, `connect_error`, `order:assigned`, `new_order` (dead), `order:status:changed`, `order:cancelled`, `order:reassigned`, `sync_response` (dead), `delivery:earning:credited`
13. **RTK tags:** invalidates `['DeliveryOrders']` on outage>60s; `['Earnings','DeliveryOrders']` on `delivery:earning:credited`
14. **Offline:** when disconnected, polls invalidations every 30s
15. **Replay:** —
16. **Notification:** —
17. **Background task:** —
18. **AsyncStorage:** `@delivery_socket_last_event_ts` (LAST_EVENT_TS_KEY)
19. **State transitions:** socketStatus: connecting → connected → disconnected
20. **Success path:** init io() → on `connect` emit join_room → wait for events → patch cache or invalidate as appropriate
21. **Failure path:** `connect_error` → no token refresh logic (P1-7) → reconnect storm with stale token
22. **Retry:** Socket.IO automatic
23. **Reconnect:** if outage>60s → invalidate `['DeliveryOrders']` only (P1-6 misses Earnings); if 5-60s → emit sync_request (P0-3 unhandled)
24. **App-kill recovery:** re-init on relaunch
25. **Polling fallback:** 30s invalidation polling during disconnect
26. **Idempotency:** `processedEventIds` Map with 60s TTL purge
27. **Cache invalidation:** scoped to delivery tags
28. **Optimistic update:** patches via `updateQueryData`
29. **Security:** server enforces role=delivery + room=self in join handler
30. **Final state:** subscribed to delivery:{userId}
31. **Known bugs:** **P0-3 (sync_request unhandled), P0-4 (no role guard on hook), P1-6 (Earnings missed on reconnect), P1-7 (no token refresh)**
32. **Broken states:** ALL non-rider users open dead sockets that fail authorization forever
33. **Stale-state risks:** mid-range outage (5-60s) leaves cache stale
34. **Missing listeners:** `new_order` is dead (not emitted)
35. **Missing invalidations:** Earnings, Notifications, Order/Orders on reconnect
36. **Runtime risks:** version-guard discard of inline emits (P0-1 inherited from event handlers)
37. **Launch risk severity:** P0
38. **Recommended fix:** P0-3, P0-4, P1-6, P1-7 — all surgical
39. **Safe pre-launch?** yes
40. **Coordination:** mobile only (P0-3, P0-4); backend (event versions, P1-* trail)

---

## SOCK-3 — `useProductSocket` initialization (admin)

Admin web/mobile only. `io()` → `join_room { room: 'admin_room' }` → listen `product:created/updated/deleted` → invalidate `['Products']`. **P1-7** (no token refresh). Otherwise OK.

---

## SOCK-4 — `useOrderTrackingSocket` initialization (customer per-order)

1. **ID:** SOCK-4
2. **Role:** customer
3. **Entry:** OrderTrackingScreen mount
4. **Trigger:** orderId param exists
5. **Hooks:** itself
6. **Socket events:** **emit** `join_order_room { orderId, token }`; **listen** `order:status:changed`, `order:location:update`
7. **Backend:** `index.ts:541-596` validates order ownership before joining `order:{orderId}` room
8. **Known bugs:** **P0-2** — listens for `order:status:changed` but production never emits status events to `order:{orderId}` room (only `order:{userId}` from dead emitter, or `admin_room` from broadcaster). Only `order:location:update` works.
9. **Severity:** P0
10. **Recommended fix:** backend emits `order:status:changed` to `order:{orderId}` room from inline emit paths
11. **Coordination:** backend + mobile

---

## SOCK-5 — Backend socket auth middleware

`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/index.ts:282-316`. **Best-effort** (calls `next()` even on missing/invalid token — does NOT reject). Sets `socket.data.userId` and `role` if valid. This means **unauthenticated sockets are accepted** but cannot join restricted rooms (admin_room, delivery:*, order:*). They auto-join nothing (since user_{userId} requires userId). **Risk:** unbounded anonymous sockets accepted — DDoS surface. **Recommended:** reject on missing token in production.

---

## SOCK-6 — `join_room` handler: admin_room

`index.ts:419-471`. Validates JWT, fetches user, checks `role === 'admin'`. **Strong**.

## SOCK-7 — `join_room` handler: delivery:{userId}

`index.ts:474-528`. Validates JWT, checks `role === 'delivery'`, asserts `room === delivery:{decoded.userId}` (no impersonation). **Strong.**

## SOCK-8 — `join_order_room` handler: customer order tracking

`index.ts:541-596`. Validates JWT, fetches Order, checks `order.user === userId`. **Strong.**

## SOCK-9 — Relay handlers (P1-13 SECURITY)

`index.ts:599-618`. Three handlers (`order_status_update`, `order_created`, `driver_status_update`) blindly re-emit untrusted client payloads to `admin_room`. **Any authenticated socket can spam admin dashboards.** Recommended: **DELETE these handlers**. Backend already emits these events from controllers; clients should not be able to trigger admin emits.

---

## SOCK-10 — `order:assigned` end-to-end

- **Emit (a):** `orderAssignmentController.ts:263-284` (after `orderStateService.transition(ASSIGNED)`)
  - `io.to('admin_room').emit('order_assigned', payload)` (snake — P1-4 dead duplicate to admin)
  - `io.to('admin_room').emit('order:assigned', payload)`
  - `io.to(`delivery:${userId}`).emit('order:assigned', payload)`
- **Emit (b):** `DeliverySocketEmitter.emitOrderAssigned` is dead in prod
- **Receive (admin):** admin web socket → invalidates `['Orders']`
- **Receive (rider):** `useDeliverySocket.handleOrderAssigned` → patch `getDeliveryOrders` cache or fall back to invalidate
- **Receive (customer):** `socketClient` listens but customer is in `user_{userId}` room — only fires if backend also emits to user_; verify `[NOT VERIFIED]` — most likely customer doesn't get this event
- **Failure modes:** snake/colon dual emit can cause double-invalidation on admin (P1-4)
- **Severity:** P1

## SOCK-11 — `order:status:changed` end-to-end (BROKEN)

- **Emit paths in production:**
  - inline `deliveryOrderController.ts:1192` (markArrived) → `delivery:{riderUserId}` only, no version
  - `OrderEventBroadcaster.broadcastOrderStatusChanged` → `admin_room` only, every 5s polled
  - other inline emits in pickupOrder/startDelivery/verifyDeliveryOtp `[partially traced]` — likely with no version
  - `deliverySocketEmitter.emitStatusChanged` (DEAD in prod)
- **Receive paths:**
  - `useDeliverySocket.handleStatusChanged` — checks version guard → discards if no version (P0-1)
  - `socketClient.on('order:status:changed')` — invalidates `['Orders','Order']` (P1-5)
  - `useOrderTrackingSocket` — listens for `order:{orderId}` room which receives nothing (P0-2)
- **Severity:** **P0** — most central event, broken across all 3 consumers in different ways

## SOCK-12 — `order:cancelled`

- **Emit:** `deliverySocketEmitter.emitOrderCancelled` (DEAD); inline cancellation paths in admin controllers `[NOT FULLY VERIFIED]`
- **Receive:** `useDeliverySocket.handleOrderCancelled` — removes order from cache
- **Risk:** if emitter is dead and inline emits don't target `delivery:{userId}`, rider never knows order was cancelled. **Verify** admin cancel flow emits to rider room.

## SOCK-13 — `order:reassigned`

- **Emit:** `deliverySocketEmitter.emitOrderReassigned` (DEAD); ad-hoc inline emits if any `[NOT VERIFIED]`
- **Receive:** `useDeliverySocket.handleOrderReassigned` — old rider removes order; new rider receives `order:assigned` (SOCK-10)
- **Risk:** old rider may not be notified — see DEL-22 / DEL-23

## SOCK-14 — `order:location:update`

- **Emit:** `index.ts:392` to `order:{orderId}` (privacy-rounded coords + ETA)
- **Receive:** `useOrderTrackingSocket` — updates customer tracking screen
- **Status:** ✅ working
- **Source data:** `liveLocationEvents` event-emitter triggered by `PUT /delivery/location` (DEL-26) accepted updates

## SOCK-15 — `notification:refresh`

- **Emit:** various paths to `user_{userId}` (e.g., deliverAttempt OTP creation)
- **Receive:** `socketClient` invalidates `['Notifications']`
- **Status:** ✅

## SOCK-16 — `payment_status_update`

- **Emit:** `webhookProcessor.ts:444` to `user_{userId}`
- **Receive:** `socketClient` — updates payment cache, invalidates `['Orders','Order']`
- **Backward compat:** also listens for `payment_status_updated` (P2-2 dead)
- **Status:** ✅

## SOCK-17 — `delivery:earning:credited`

- **Emit:** inline in `verifyDeliveryOtp` to `delivery:{riderUserId}`
- **Receive:** `useDeliverySocket` — invalidates `['Earnings','DeliveryOrders']`, shows toast
- **Status:** ✅
- **Risk:** missed on disconnected rider — no reconnect Earnings invalidation (P1-6)

## SOCK-18 — `route:order:removed`

- **Emit:** `routeCancellationHandler.ts:179-180` — uses `socketService.io` which is undefined (P1-12)
- **Receive:** rider mobile `[NOT VERIFIED — listener location]`
- **Status:** **BROKEN** — emit is dead

## SOCK-19 — `sync_request` (BROKEN)

- **Emit:** mobile `useDeliverySocket:93-129` on reconnect after 5-60s outage
- **Receive (server):** **none**
- **Receive (client `sync_response`):** would be `useDeliverySocket.handleSyncResponse` but never fires
- **Status:** **BROKEN** — P0-3
- **Recommended:** drop entirely; on reconnect always invalidate `['DeliveryOrders','Earnings','Notifications']`

## SOCK-20 — Mobile reconnect lifecycle

```
disconnect (network blip)
  → setSocketStatus('disconnected')
  → disconnectedAtRef = Date.now()
  → startPolling(30000) — invalidate every 30s as fallback
  
reconnect (Socket.IO native)
  → 'connect' event
  → setSocketStatus('connected')
  → stopPolling()
  → emit join_room (delivery:{userId})
  → outage = Date.now() - disconnectedAtRef
  → if outage > 60000:
      invalidateTags(['DeliveryOrders'])   // P1-6 misses Earnings
  → else if outage > 5000:
      jittered delay 0-2000ms
      emit sync_request { lastEventTimestamp }   // P0-3 unhandled
```

## SOCK-21 — Token refresh on `connect_error` (only socketClient)

`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/services/socketClient.ts:209-231`. On 401-like connect_error, attempts `/auth/refresh`, retries connect. **Other 3 sockets do not have this logic** — P1-7.

## SOCK-22 — Event deduplication

`useDeliverySocket` maintains `processedEventIds: Map<string, number>` keyed by `eventId` from event payload. Any event without `eventId` falls back to `${event.orderId}:${event.status}:${ts}` key. Map is purged every 60s for entries older than 60s. **Risk:** if backend doesn't include `eventId` (which inline emits don't), dedup is weaker but still functional via the fallback key. Not an active bug.

## SOCK-23 — Version guard discard (P0-1)

`useDeliverySocket.handleStatusChanged` rejects events where `event.version <= cached.socketVersion ?? 0`. Inline production emits do not include `version` → `undefined <= 0` is `true` → silent drop. **Critical bug; root cause of stale UI for arrivedAt/orderStatus updates from admin or other devices.**

## SOCK-24 — `OrderEventBroadcaster` polling (legacy parallel)

`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/orders/services/orderEventBroadcaster.ts:71-117`. Started at `index.ts:787` with 5000ms interval. Polls `OrderEvent` outbox for unpublished events, broadcasts to `admin_room` only. **Duplicates events** because `OutboxDispatcher` already handles publishing. **Recommendation:** disable polling, keep it as a one-shot startup recovery.

---

# SOCKET DOMAIN RISK MATRIX

| ID | Severity | Bug | Pre-launch fix? |
|---|---|---|---|
| SOCK-1 socketClient | P1 | P1-5 broad invalidate | ✅ |
| SOCK-2 useDeliverySocket | P0 | P0-3, P0-4, P1-6, P1-7 | ✅ |
| SOCK-3 useProductSocket | P2 | P1-7 | ✅ |
| SOCK-4 useOrderTrackingSocket | P0 | P0-2 status mismatch | ✅ |
| SOCK-5 auth middleware | P2 | accepts unauth sockets | ✅ |
| SOCK-6 admin_room join | none | — | — |
| SOCK-7 delivery:{userId} join | none | — | — |
| SOCK-8 join_order_room | none | — | — |
| SOCK-9 relay handlers | P1 | P1-13 SECURITY | ✅ |
| SOCK-10 order:assigned | P1 | P1-4 dual emit | ✅ |
| SOCK-11 order:status:changed | P0 | P0-1 + P0-2 | ✅ |
| SOCK-12 order:cancelled | P1 | dead emitter | ✅ |
| SOCK-13 order:reassigned | P2 | dead emitter | ✅ |
| SOCK-14 order:location:update | none | — | — |
| SOCK-15 notification:refresh | none | — | — |
| SOCK-16 payment_status_update | none | P2-2 dead listener | ✅ cleanup |
| SOCK-17 earning:credited | P1 | P1-6 reconnect miss | ✅ |
| SOCK-18 route:order:removed | P1 | P1-12 broken | ✅ |
| SOCK-19 sync_request | P0 | P0-3 unhandled | ✅ |
| SOCK-20 reconnect lifecycle | P0 | inherits P0-3 | ✅ |
| SOCK-21 token refresh | P1 | P1-7 missing on 3 hooks | ✅ |
| SOCK-22 dedup | none | works fallback | — |
| SOCK-23 version guard | P0 | P0-1 silent drop | ✅ |
| SOCK-24 broadcaster polling | P1 | P1-2 duplicate work | ✅ |

# SOCKET EVENT GRAPH

```
                    ┌────────────────────────────────────────┐
                    │            BACKEND EMITTERS            │
                    └────────────────────────────────────────┘

orderAssignmentController.ts:263 ──┬─→ admin_room: order_assigned (snake)
                                    ├─→ admin_room: order:assigned
                                    └─→ delivery:{userId}: order:assigned

orderStateService.transition ──→ outbox OrderEvent
                                    │
                                    ├─→ OutboxDispatcher (verify) ──→ events?
                                    └─→ OrderEventBroadcaster (5s poll) ──→ admin_room: order:status:changed

deliveryOrderController.pickupOrder ──┬─→ admin_room: order_picked_up
                                        ├─→ delivery_{deliveryBoyId}: order_picked_up [DEAD]
                                        └─→ driver_{deliveryBoyId}: order_picked_up [DEAD]

deliveryOrderController.markArrived ──→ delivery:{riderUserId}: order:status:changed [no version, P0-1]

deliveryOrderController.verifyDeliveryOtp ──┬─→ admin_room: order_delivered
                                              ├─→ user_{customerId}: order_delivered
                                              └─→ delivery:{riderUserId}: delivery:earning:credited

deliveryOrderController.deliverAttempt ──→ user_{customerId}: notification:refresh
deliveryOrderController.resendDeliveryOtp ──→ user_{customerId}: order:otpResent [P1-14 unlistened]

webhookProcessor (Razorpay) ──→ user_{userId}: payment_status_update

routeCancellationHandler ──→ delivery:{userId}: route:order:removed [P1-12 BROKEN — io undefined]

liveLocationEvents (HTTP location accepted) ──┬─→ admin_room: driver:location:update
                                                └─→ order:{orderId}: order:location:update

DeliverySocketEmitter (DEAD in prod, only in tests):
  emitStatusChanged ──→ admin_room + delivery:{userId} + order:{userId} [P0-2 wrong room]
  emitOrderCancelled ──→ delivery:{riderId} + admin_room
  emitOrderReassigned ──→ delivery:{oldRiderId}
  emitOrderAssigned ──→ admin_room + delivery:{riderId}

                    ┌────────────────────────────────────────┐
                    │            MOBILE LISTENERS            │
                    └────────────────────────────────────────┘

socketClient (singleton, customer + admin):
  → order:status:changed → invalidate ['Orders','Order']
  → order:assigned → similar
  → payment_status_update → patch order cache
  → payment_status_updated → [P2-2 dead]
  → order_status_updated → [P2-3 dead path]
  → notification:refresh → invalidate ['Notifications']
  → connect_error → token refresh → retry

useDeliverySocket (rider):
  → connect → emit join_room
  → order:assigned → cache patch (full Order)
  → new_order → [P2-1 dead listener]
  → order:status:changed → version guard discards [P0-1]
  → order:cancelled → cache remove
  → order:reassigned → cache remove
  → delivery:earning:credited → invalidate ['Earnings','DeliveryOrders']
  → sync_response → [P0-3 dead — never fires]
  → disconnect → 30s polling fallback
  → reconnect → if >60s: invalidate ['DeliveryOrders']; else: emit sync_request

useProductSocket (admin):
  → product:created/updated/deleted → invalidate ['Products']

useOrderTrackingSocket (customer):
  → join_order_room
  → order:status:changed → [P0-2 never fires for this room]
  → order:location:update → update map UI
```

# RECONNECT / SYNC GRAPH (rider focus)

```
[connected] ─── network drop ───→ [disconnected]
                                       │
                                       ├─ disconnectedAt = now
                                       ├─ start 30s polling (invalidate ['DeliveryOrders'])
                                       │
                                       └── network restored ───→ Socket.IO auto-reconnect
                                                                        │
                                                                        └─→ 'connect' event
                                                                              │
                                                                              ├─ stopPolling
                                                                              ├─ emit join_room
                                                                              ├─ outage = now - disconnectedAt
                                                                              │
                                                                              ├─ outage > 60000:
                                                                              │     invalidate ['DeliveryOrders']  [P1-6 missing Earnings]
                                                                              │
                                                                              ├─ 5000 < outage <= 60000:
                                                                              │     setTimeout(jitter)
                                                                              │       emit sync_request  [P0-3 unhandled]
                                                                              │       wait sync_response (never)
                                                                              │
                                                                              └─ outage <= 5000:
                                                                                    no resync (assume no missed events)
```

# RECOMMENDED SOCKET FIXES (consolidated)

1. **P0-1**: mobile guard `event.version != null && event.version <= cached.socketVersion` (1-line)
2. **P0-2**: backend emit `order:status:changed` to `order:${order._id}` (not `order:{userId}`)
3. **P0-3**: drop sync_request, on every reconnect invalidate `['DeliveryOrders','Earnings','Notifications']`
4. **P0-4**: gate `useDeliverySocket` on `userRole === 'delivery'`
5. **P1-1**: drop `delivery_`/`driver_` dead room emits in pickupOrder
6. **P1-2**: disable `OrderEventBroadcaster` 5s polling (or make it failure-only)
7. **P1-3**: include version in markArrived inline emit (or fix via P0-1)
8. **P1-4**: drop snake_case `order_assigned` admin emit
9. **P1-5**: scope socketClient invalidations to changed orderId via updateQueryData
10. **P1-7**: lift token refresh into shared util used by all 4 sockets
11. **P1-12**: routeCancellationHandler use `app.get('io')` instead of dead socketService
12. **P1-13**: delete relay handlers in `index.ts:599-618`
13. **P1-14**: remove or wire `order:otpResent` listener
14. **P2-1/P2-2/P2-3**: cleanup dead listeners
15. **SOCK-5 hardening**: reject sockets without valid token in production env

# COORDINATION TABLE

| Fix | Backend | Mobile | Web admin |
|---|---|---|---|
| P0-1 | optional (cleaner) | required | optional |
| P0-2 | required | none | none |
| P0-3 | optional | required | none |
| P0-4 | none | required | none |
| P1-1 | required | none | none |
| P1-2 | required | none | none |
| P1-3 | required | optional | none |
| P1-4 | required | none | required (verify single listener) |
| P1-5 | none | required | none |
| P1-7 | none | required | none |
| P1-12 | required | none | none |
| P1-13 | required | none | none |

