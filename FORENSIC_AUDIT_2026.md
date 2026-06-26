# FORENSIC AUDIT — Delivery / Operations Stack

**Date:** 2026-05-18
**Auditor:** Cascade (Principal Engineer / Production Investigator role)
**Scope reviewed (deep):** backend `src/domains/orders`, `src/domains/operations`, `src/domains/delivery`, `src/services`, `src/index.ts`, `src/models/Order.ts`, `src/models/DeliveryEarning.ts`; mobile `apps/customer-app/src/hooks/delivery/*`, `src/services/socketClient.ts`, `src/hooks/useDeliverySocket.ts`, `src/hooks/useProductSocket.ts`, `src/hooks/useOrderTrackingSocket.ts`, `src/screens/delivery/DeliveryHomeTab.tsx`, `src/api/deliveryApi.ts`, `src/api/baseApi.ts`, `src/tasks/backgroundLocationTask.ts`, `src/hooks/useDeliveryLocation.ts`, `src/hooks/useOfflineQueueReplay.ts`.
**Scope NOT reviewed (acknowledged gap):** web frontend (`frontend/`), full payment gateway flows (Razorpay/UPI verify endpoints), admin web dashboard runtime, voice/AI subsystems, i18n, product / catalog / cart, jobs, queues. Findings below are restricted to the surfaces I traced; audit confidence outside these is **low**.

---

## 0. EXECUTIVE SUMMARY

The delivery rider experience has had heavy hardening at the **mobile** layer (dedup, version guard, action queue, replay, idempotency keys, escalated-set, RTK cache patching). However the **backend socket emission path that the mobile layer was designed against does not exist in production code**. The production realtime path is a parallel set of inline `io.to(room).emit(...)` calls scattered across `deliveryOrderController.ts` that:

- do not increment `socketVersion`
- do not persist to `DeliverySocketEvent`
- have no ACK/retry
- frequently target rooms that no client joins

This single mismatch is the dominant launch risk. It causes silent event loss, version-guard discard, and a broken `sync_request` reconnect path that the mobile app relies on for reconciliation.

**Other categories with significant exposure:**
- Multiple parallel socket connections per app (4) with inconsistent reconnect/refresh behavior.
- Inconsistent room naming across emitters (`delivery:{userId}`, `delivery_{deliveryBoyId}`, `driver_{deliveryBoyId}`, `user_{userId}`, `order:{userId}`, `order:{orderId}`, `order_{orderId}`).
- Customer order tracking screen receives `order:status:changed` only from a room (`order:{userId}`) the client never joins; customer tracking is effectively partial.
- `OrderEventBroadcaster` is a parallel/legacy path still polling every 5s, emitting duplicate events to admin only.
- Background location task is persisted in OS, but on app cold start there is no proactive resume — depends on OS keeping the task alive; no app-launch reconciliation.
- No global RTK refetch on socket reconnect (only `DeliveryOrders`); `Earnings`, `Orders`, `Order`, `Notifications` go stale.
- Force Sync / debug overlay are not yet implemented.

### Launch Readiness Score

| Domain                       | Score      | Rationale |
|------------------------------|------------|-----------|
| Order state machine          | **8 / 10** | Strong: `orderStateService.transition` + Order pre-save guards block all unauthorized status writes. |
| Idempotency (earnings)       | **9 / 10** | `DeliveryEarning` unique index `(orderId, deliveryBoyId)` + duplicate-key catch is correct. |
| Mobile offline replay        | **7 / 10** | Solid design (TTL, MAX_RETRIES, debounced persist, FIFO) but two parallel queue systems coexist. |
| Realtime socket reliability  | **3 / 10** | Production emits skip the hardened emitter; version guard discards inline events; sync_request unhandled. |
| Customer order tracking      | **3 / 10** | Room mismatch (`order:{userId}` vs `order:{orderId}`); only location updates work. |
| Push notifications           | **6 / 10** | Functional, but rider earning push uses customer-facing `myOrders` preference key → may be silenced. |
| Background location          | **6 / 10** | Foreground-gated start prevents Android crashes; but no cold-start resume + no auth-fail recovery. |
| RTK cache invalidation       | **5 / 10** | Granular tag use; but no global reconnect refetch and inconsistent payment cache invalidation. |
| OTP integrity                | **8 / 10** | Server-side OTP with expiry + issued-to check + new resend throttle. |
| Payment / COD flow           | **5 / 10** | Reviewed surface only. COD offline-block now correct. UPI verify wasn't audited. |
| Lifecycle / app-kill safety  | **6 / 10** | Action queue persists immediately. Background location may double-start. |

**Overall production-readiness for rider launch: ~5.5 / 10.** Safe-to-launch only after fixing socket-emit/version-guard mismatch (P0-1 below), or after disabling mobile version guard as a workaround.

---

## 1. SYSTEM ARCHITECTURE EXTRACTION

### 1.1 Mobile socket connections (per-app, simultaneous)

The mobile app **establishes up to four independent Socket.IO connections** per session:

1. `services/socketClient.ts` — singleton "general" client (handles token refresh on `connect_error`, listens for `order:status:changed`, `order:assigned`, `payment_status_update[d]`, `delivery_location_updated`, `order_status_updated`).
2. `hooks/delivery/useDeliverySocket.ts` — rider-specific. Joins `delivery:{userId}`. Listens for `order:assigned`, `new_order`, `order:status:changed`, `order:cancelled`, `order:reassigned`, `sync_response`, `delivery:earning:credited`.
3. `hooks/useProductSocket.ts` — admin only. Joins `admin_room`. Listens for `product:created/updated/deleted`.
4. `hooks/useOrderTrackingSocket.ts` — customer per-order tracking. Calls `join_order_room { orderId }`. Listens for `order:status:changed`, `order:location:update`.

**Risk:** every active hook = a fresh `io()` instance with its own auth, reconnect timer, listeners. Token refresh logic lives only in `socketClient`; the other three reconnect indefinitely with stale tokens on JWT expiry. See §3 P1-7.

### 1.2 Backend socket layer (`backend/src/index.ts`)

- `io.use` middleware: best-effort JWT verify; assigns `socket.data.userId` and `role` if token valid. **Does not reject** on missing/invalid token (calls `next()` without arg). Authorization enforced on a per-room basis at `join_room`/`join_order_room` instead.
- On `connection`: auto-joins `user_${userId}` if authenticated.
- `join_room`: only `admin_room` (admin role required) and `delivery:{userId}` (delivery role + room-must-equal-self) accepted. All other room names rejected.
- `join_order_room`: customer joins `order:{orderId}` after verifying ownership.
- Several relay-style handlers (`order_status_update`, `order_created`, `driver_status_update`) re-emit untrusted client payloads into `admin_room`. **P1 security/correctness risk** — a non-admin authenticated socket can spam admin updates. See §M.

### 1.3 Backend emitters (production paths)

| Emitter | Used in production? | Notes |
|---|---|---|
| `DeliverySocketEmitter` (`backend/src/domains/delivery/services/deliverySocketEmitter.ts`) | **NO** — only instantiated in `__tests__/deliverySocketEmitter.test.ts`. | Dead in prod. Includes `version`, `eventId`, `arrivedAt`, persists to `DeliverySocketEvent`, retries. **Mobile depends on its payload contract.** |
| `OrderEventBroadcaster` (`orderEventBroadcaster.ts`) | YES — `index.ts:322` constructs and `startPolling(5000)` runs. | Emits only to `admin_room`. Polls `OrderEvent` outbox every 5s and re-emits — duplicates events. |
| Inline `io.to(...).emit(...)` in `deliveryOrderController.ts` | YES — primary production path. | No version, no persistence, no retry. Inconsistent room naming. See §D. |
| Inline `io.to('admin_room').emit(...)` in `orderAssignmentController.ts:263` | YES | Emits both `order_assigned` and `order:assigned` (snake + colon) — admin web likely listens for one. |
| `webhookProcessor` payment emit `io.to('user_{userId}').emit('payment_status_update', ...)` | YES | Customer auto-joins `user_{userId}` on connect — works. |

### 1.4 Mobile RTK Query tags (after recent earnings fix)

`baseApi.tagTypes`: `Products, Product, Categories, Cart, Orders, Order, Addresses, Profile, Notifications, DeliveryOrders, DeliveryBoys, DeliveryPartners, Reviews, Coupons, Users, Clusters, RecentRoutes, AdminRoutes, AdminSettings, Pincode, Earnings`.

Used providers/invalidators verified: `Cart`, `Orders/Order`, `Profile`, `Addresses`, `Notifications`, `DeliveryOrders`, `Earnings`, `Products`. No tag for `DeliveryRoute`/`CodCollection` — those queries are uncached or invalidated implicitly.

---

## 2. STATE MACHINES

### 2.1 Order state machine (authoritative — `orderStateService.ALLOWED_TRANSITIONS`)

```
CREATED    → CONFIRMED, CANCELLED
CONFIRMED  → PACKED, CANCELLED
PACKED     → ASSIGNED, CANCELLED
ASSIGNED   → PICKED_UP, PACKED            (PACKED back-transition admin only)
PICKED_UP  → IN_TRANSIT
IN_TRANSIT → DELIVERED, FAILED
FAILED     → RETURNED
DELIVERED, RETURNED, CANCELLED → terminal
OUT_FOR_DELIVERY → []                     (legacy, normalized to IN_TRANSIT on read)
```

Role guards (`assertAllowedByRole`):
- CUSTOMER: only `CREATED → CANCELLED`.
- DELIVERY_PARTNER: `ASSIGNED→PICKED_UP`, `PICKED_UP→IN_TRANSIT`, `IN_TRANSIT→DELIVERED|FAILED`. Must be the assigned partner.
- ADMIN: confirm/pack/assign/un-assign/cancel/return.

Direct status writes blocked by `Order.pre('save'|'updateOne'|'updateMany'|'findOneAndUpdate')` hooks, gated by the `AUTHORIZED_TRANSITION_SYMBOL` set only by `orderStateService`. **Strong invariant — verified.**

### 2.2 OTP state machine (per order)

```
(none) → generated         (deliverAttempt: only when status ∈ {IN_TRANSIT, OUT_FOR_DELIVERY} AND arrivedAt set AND COD collected if applicable)
generated → resent         (resendDeliveryOtp: throttle 30s, max 3 resends)
generated|resent → verified  (verifyDeliveryOtp → orderStateService → DELIVERED + earning + push + socket)
generated|resent → expired   (TTL 5 min)
```

Server fields: `deliveryOtp`, `deliveryOtpExpiresAt`, `deliveryOtpGeneratedAt`, `deliveryOtpIssuedTo`, `deliveryOtpResendCount`. After verify, `deliveryOtp` and `deliveryOtpExpiresAt` are unset; `deliveryOtpResendCount`/`deliveryOtpGeneratedAt` are NOT cleared (minor: see §I-3).

### 2.3 Delivery attempts state machine (per order)

`deliveryAttempts` (counter on Order) + `DeliveryFailureService`:
- Cooldown: `RETRY_COOLDOWN_MS` between attempts.
- < `MAX_DELIVERY_ATTEMPTS` → record attempt, status stays IN_TRANSIT, retry allowed.
- ≥ `MAX_DELIVERY_ATTEMPTS` → transition to FAILED, remove from rider load, attempt auto-reassign (excluding previous riders), if no rider → `finalStatus=FAILED_PERMANENT`.

Mobile mirrors a local count in `useAttemptTracker` and merges server count via `mergeServerAttempt` (only when server > local).

### 2.4 Earnings state machine

```
(no record) → credited (DeliveryEarning created in verifyDeliveryOtp; DeliveryBoy.earnings $inc)
credited → (terminal — never reversed in current code)
```

Idempotency: unique `(orderId, deliveryBoyId)` → duplicate-key returns existing earning, does not double-credit.

---

## 3. ALL ISSUES (organized by severity)

Format per issue: **[ID] severity — title** · file:line · root cause · fix · regression risk · safe-pre-launch?

### P0 — block launch

#### P0-1 — Production status emits skip the hardened emitter; mobile version-guard discards them
- **Files:** `backend/src/domains/delivery/services/deliverySocketEmitter.ts` (defined, never used in prod); `backend/src/domains/operations/controllers/deliveryOrderController.ts:1027–1199, 1781–1820` (inline emits without `version`/`eventId`); `apps/customer-app/src/hooks/delivery/useDeliverySocket.ts:185–225` (handler).
- **Root cause:** Inline emits in `pickupOrder`, `markArrived`, `verifyDeliveryOtp`, etc. send payloads with no `version`. Mobile `handleStatusChanged` does `if (event.version <= (cached.version ?? 0)) return;` — `undefined <= 0` is `true`, event silently dropped. Once any earlier event sets cached.version, **all subsequent inline status events are discarded**.
- **Runtime consequence:** rider's `arrivedAt`, `orderStatus`, `allowedActions` stop updating from sockets. UI stale until manual refresh. The "production hardening" of dedup + version + sync is targeting a contract the backend doesn't fulfill.
- **Fix (smallest):** Either (a) integrate `DeliverySocketEmitter` into all status mutation controllers, or (b) make mobile guard `event.version != null && event.version <= cached.version` so missing-version events fall through. **(b) is safest pre-launch.**
- **Regression risk:** Low if (b). Out-of-order events possible but rare; full refresh on reconnect mitigates.
- **Coordination:** mobile-only fix.
- **Type:** socket / contract mismatch.

#### P0-2 — Customer order tracking room mismatch — events emitted to room never joined
- **Files:** `backend/src/domains/delivery/services/deliverySocketEmitter.ts:193` emits `order:status:changed` to `order:${order.userId}`; `backend/src/index.ts:588` joins `order:${orderIdStr}` in `join_order_room`; `apps/customer-app/src/hooks/useOrderTrackingSocket.ts:46,80` joins by orderId and listens for `order:status:changed`.
- **Root cause:** room key inconsistency: `order:{userId}` (emitter) vs `order:{orderId}` (join handler). Even if `DeliverySocketEmitter` were used, customers would never receive `order:status:changed`. Production path (inline emits in `verifyDeliveryOtp` → `io.to('user_${order.userId}').emit('order_delivered', ...)`) uses different event name and `user_` room — also not what `useOrderTrackingSocket` listens for.
- **Runtime consequence:** customer tracking screen never updates `orderStatus` via socket — only `order:location:update` (which uses `order:${orderId}` correctly). Status changes only land via push notification or manual refresh.
- **Fix:** in `DeliverySocketEmitter` and any future emitter, use `order:${String(order._id)}`. Update inline emits in `deliverAttempt` / `markArrived` / `verifyDeliveryOtp` accordingly.
- **Regression risk:** none (today nothing receives these events).
- **Coordination:** backend only.

#### P0-3 — `sync_request` is emitted by mobile on reconnect but no backend handler exists
- **Files:** mobile `useDeliverySocket.ts:93,98,129`; backend search of `sync_request` returns only a comment in `models/DeliverySocketEvent.ts:31` ("Compound indexes for sync_request queries"). No `socket.on('sync_request', …)` handler.
- **Root cause:** the reconciliation feature was designed but never implemented on backend. Plus `DeliverySocketEvent` is never written (no caller of `DeliverySocketEmitter` in prod), so even if implemented it would have nothing to query.
- **Runtime consequence:** after a 5-60s outage the mobile invokes `emitSyncRequest()` and waits silently for `sync_response` that never comes. Stale cache persists until the 60s threshold triggers full invalidation, or until rider pulls-to-refresh.
- **Fix (pre-launch, minimal):** mobile — drop `emitSyncRequest`/`handleSyncResponse` and on any reconnect after >5s simply `dispatch(deliveryApi.util.invalidateTags(['DeliveryOrders','Earnings']))`. This is the "global refetch on reconnect" item in the hardening plan.
- **Regression risk:** small extra refetch on reconnect; safe.

#### P0-4 — `useDeliverySocket` runs for every authenticated user (including customers)
- **File:** `apps/customer-app/src/hooks/delivery/useDeliverySocket.ts:37–38` only checks `token && userId`; no role check.
- **Root cause:** missing role guard. Backend `join_room` rejects non-delivery role for `delivery:{userId}` (good), but the mobile still opens a socket and tries forever.
- **Runtime consequence:** every customer login spawns a 4th socket that idle-reconnects, wasting battery and server FDs. Backend logs filled with "Delivery join denied: role mismatch".
- **Fix:** gate hook on `state.auth.user?.role === 'delivery'` (mirroring `useProductSocket`).
- **Regression risk:** none.

### P1 — high impact

#### P1-1 — Dead emit rooms `delivery_${id}` and `driver_${id}` in `pickupOrder`
- **File:** `deliveryOrderController.ts:1033, 1037`. Mobile only joins `delivery:{userId}`; nobody joins `delivery_…` or `driver_…`.
- **Consequence:** `order_picked_up` event to rider is lost. (But mobile still receives it via the immediate mutation response cache patch, so rider UI works — admin dashboard may also miss it.)
- **Fix:** delete those two emits, or replace with `delivery:${riderUserId}`.

#### P1-2 — `OrderEventBroadcaster` polls outbox every 5s and re-emits already-emitted events to `admin_room`
- **File:** `domains/orders/services/orderEventBroadcaster.ts:71–117`; `index.ts:787` starts polling.
- **Consequence:** every status transition results in 2 events to admin_room (immediate + 5s polled). Admin web invalidates twice. Negligible UX harm; small CPU/IO cost.
- **Fix:** either remove the polling fallback (it duplicates `OrderEvent` outbox dispatcher work) or change the poll target to be only events whose immediate emit failed (currently all are marked published immediately so the loop is mostly dry, but the 5s cadence still runs).

#### P1-3 — Inline `markArrived` emit lacks `version`/`eventId` and triggers P0-1 discard
- **File:** `deliveryOrderController.ts:1192–1198`.
- **Same root cause as P0-1.** Once mobile has any cached version, the arrivedAt patch is dropped. Workaround applied via the prior session (mobile patches `arrivedAt` on cache update from mutation response) — but a remote admin-driven mark-arrived would not propagate to a different rider device.
- **Fix:** include `version: cached.socketVersion + 1` (or run through `DeliverySocketEmitter`).

#### P1-4 — `orderAssignmentController` emits both `order_assigned` and `order:assigned` to admin
- **File:** `controllers/orderAssignmentController.ts:263–270, 275–284`.
- **Consequence:** admin web receives two events; if both invalidate Orders, double refetch storm on bulk assignments.
- **Fix:** keep `order:assigned` only; remove the snake_case duplicate.

#### P1-5 — `socketClient` invalidates `['Orders','Order']` on every `order:status:changed` event
- **File:** `services/socketClient.ts:243–252`.
- **Consequence:** customer app refetches Orders list and Order detail on every admin-room broadcast (because customer NEVER joins admin_room, so this listener fires on `user_{userId}` room only — actually verified that `socketClient` connects via auth and customer auto-joins `user_{userId}`; events to user_ rooms via webhooks would trigger). Combined with `OrderEventBroadcaster` polling and dual emits in P1-4, refetch fan-out can be large under load.
- **Fix:** scope invalidation by `data.orderId` (use `updateQueryData` for the specific order, only invalidate `['Orders']` if list ordering changes).

#### P1-6 — `useDeliverySocket` does not invalidate `Earnings` on extended-outage reconnect
- **File:** `hooks/delivery/useDeliverySocket.ts:121–123`.
- **Consequence:** if a delivery completed while disconnected (rider's own device or another device), earnings tab stays stale until tab opens.
- **Fix:** on extended outage and on every reconnect-with-resync, also `invalidateTags(['Earnings'])`. (Already in the hardening plan as "global refetch on reconnect".)

#### P1-7 — Token refresh logic only on `socketClient`; `useDeliverySocket`/`useProductSocket`/`useOrderTrackingSocket` don't refresh on JWT expiry
- **Files:** `services/socketClient.ts:209–231` is the only one with refresh.
- **Consequence:** rider device reconnect storm with stale token after a long offline period; backend logs spam.
- **Fix:** lift the refresh helper into a small utility and reuse in all 4 hooks.

#### P1-8 — `useDeliveryLocation` cold-start has no resume on app launch when route already exists
- **File:** `hooks/useDeliveryLocation.ts:151–179`. Effect depends on `routeId` — only fires after `useGetCurrentRouteQuery` resolves. The OS-resident `LOCATION_TASK_NAME` may or may not still be running depending on how the app died. There is **no explicit reconciliation** at launch (e.g., `Location.hasStartedLocationUpdatesAsync` check + restart if route still active).
- **Consequence:** post-app-kill, location may stop silently; admin live-tracking goes flat.
- **Fix:** in a top-level effect on rider login, if `activeRouteId` in storage and `hasStartedLocationUpdatesAsync` is false → call `startTracking`. Add an `expo-task-manager` registry check.

#### P1-9 — `useDeliveryLocation` AppState restart fires `startTracking` 500ms after foreground regardless of permission state
- **File:** `useDeliveryLocation.ts:153–164`. After permission requests, race conditions with rapid background↔foreground toggles could cause overlapping startTracking.
- **Mitigation present:** `Location.hasStartedLocationUpdatesAsync` check + same-route guard.
- **Fix:** add a single ref-guard `startInProgressRef` to short-circuit overlap.

#### P1-10 — Background location task uses raw `axios.put`; on 401 it does NOT refresh tokens
- **File:** `tasks/backgroundLocationTask.ts:61–67`.
- **Consequence:** when access token expires while in background, every location update will 401 and the queue grows unbounded (offlineQueue.enqueue) — eventually drained on next foreground refresh, but bad battery/data spend.
- **Fix:** on 401 response, attempt `/auth/refresh` once; on persistent 401 stop the task. Otherwise fall through to the existing offlineQueue path.

#### P1-11 — Push notification preference key mismatch for delivery-rider notifications
- **File:** `utils/PushNotificationService.ts:30–31` checks `notificationPreferences.push.categories.myOrders !== false`. Earnings push for rider also routes through this.
- **Consequence:** if a rider has explicitly disabled `myOrders` (a customer-facing concept), they will never receive earning/order/delivery push notifications.
- **Fix:** add a `delivery` category and check `categories.delivery` for delivery-role users; default `!== false` so undefined still allows.

#### P1-12 — `socketService.ts` is dead code (commented out at `index.ts:319`) but exports are still referenced via `routeCancellationHandler.ts`
- **File:** `services/routeCancellationHandler.ts:179–180` reads `(socketService as any).io` — that singleton was never initialized because `SocketService` constructor isn't called.
- **Consequence:** route cancellation rider notification path crashes silently (early return with `'Socket IO not initialized'` warning) and rider never gets `route:order:removed`.
- **Fix:** read `io` from `app.get('io')` like everywhere else, or pass `io` into the cancellation function.

#### P1-13 — Untrusted relay handlers in `index.ts` `socket.on('order_status_update'|'order_created'|'driver_status_update', ...)` echo into `admin_room`
- **File:** `index.ts:599–618`.
- **Consequence:** any authenticated socket can spam admin dashboards with arbitrary `order:status:update` / `order:created` / `driver:status:update` payloads. UI may display fake events; if any admin code mutates state on these payloads, this is a privilege escalation vector.
- **Fix:** delete these three handlers — backend already emits these events from controllers; clients should never trigger admin emits via socket.

#### P1-14 — `order:otpResent` emitted to `user_${order.userId}` is never listened for
- **File:** `deliveryOrderController.ts:2052`.
- **Consequence:** customer never gets in-app realtime indicator that OTP was resent; relies on SMS only.
- **Fix:** either remove the emit or hook customer mobile to it.

### P2 — medium impact

- **P2-1** `useDeliverySocket` listener for `new_order` (line 299) — backend never emits `new_order`. Dead listener.
- **P2-2** `socketClient` listens for both `payment_status_update` and `payment_status_updated` (backward compat). Backend only emits `payment_status_update` — the second is dead but harmless.
- **P2-3** `socketClient` listens for `order_status_updated` (snake_case). Only `socketService.sendOrderStatusUpdate` would emit — but `socketService` is disabled (P1-12). Dead path.
- **P2-4** `OrderEventBroadcaster.broadcastOrderStatusChanged` JSDoc claims it broadcasts to `order_${orderId}` and `delivery_${deliveryBoyId}` rooms but only `admin_room` is implemented. **Misleading docstring** + missing functionality.
- **P2-5** `useDashboardData` is a thin wrapper around `useDeliveryState` — not audited deeply, but `activeOrders`/`availableOrders` derivation from `getDeliveryOrders` query needs verification that `DELIVERED`/`FAILED`/`CANCELLED`/`RETURNED` orders are filtered out client-side. If not, completed orders may briefly appear after socket invalidation.
- **P2-6** `verifyDeliveryOtp` does not clear `deliveryOtpGeneratedAt` after success. Mobile derives `isDeliveryAttempted` from this field — for a delivered order this is harmless because `flow.isDelivered` guard now hides action buttons (recent fix), but on an undelivered re-render path could mislead.
- **P2-7** `DELIVERY_RESET_KEYS` in `DeliveryHomeTab.tsx:129–136` does NOT include `@delivery_socket_last_event_ts` (used by useDeliverySocket for `LAST_EVENT_TS_KEY`). Reset state leaves the resync timestamp pointing to a stale moment.
- **P2-8** `useActionQueue.replayQueue` deps `[persistQueue, persistQueueNow]` but uses `setQueue` form via `prev` — no stale closure, but `failedOrderIds` is recreated each call (good). Replay is single-flight via `isReplayingRef`. If `replayQueue` is invoked from both `useOfflineQueueReplay` (which uses `offlineMutationQueue` — a SEPARATE queue!) and `DeliveryHomeTab.handleForceSync` / online-reconnect effect, the DELIVERY one is single-flight but the OTHER queue runs in parallel. **Two parallel offline-queue systems exist** (`offlineMutationQueue` + `useActionQueue`). Risk of double-replay if the same action ends up in both.
- **P2-9** `useOfflineQueueReplay` wraps `dispatch(deliveryApi.endpoints.X.initiate(...))` and "replays" — but RTK Query `.initiate` returns the cached/in-flight promise; if the same mutation key is already pending, it returns that promise and won't re-fire the mutation. Replay correctness depends on `fixedCacheKey` config (none used here) — currently OK because each call has unique args, but fragile.
- **P2-10** `failureReasons` array push in `DeliveryFailureService` is `$push: { failureReasons: failureEntry } as any` — schema may not have this field; if it doesn't, this either fails silently (in non-strict schemas) or rejects. Worth verifying.
- **P2-11** `DeliveryFailureService.recordFailedAttempt` does its own `Order.updateOne({ $set: { deliveryAttempts, ... } })` outside `orderStateService.transition`. Pre-save guard does not block this because `orderStatus` isn't being changed here — fine. But the same service calls `transition` AFTER updating the doc, which is a small race window: a parallel mark-arrived could land between the two writes.
- **P2-12** `recordDeliveryAttempt` controller (lines 290–308) does `Order.updateOne({_id}, { $set: { deliveryStatus: "failed" } })` after `orderStateService.transition` — that's a side-channel `deliveryStatus` write and is allowed by the guards (deliveryStatus is not the protected field). OK, but worth keeping in mind.

### P3 — low / cleanup

- **P3-1** Inconsistent room names: `delivery:`, `delivery_`, `driver_`, `user_`, `order:`, `order_`. Pick one delimiter (`:`) and document.
- **P3-2** `socketCorsOrigins` in `index.ts:268–272` filters falsy values — fine.
- **P3-3** `verboseLoggingEnabled` flag gates many socket logs but emit/error logs are unconditional. OK.
- **P3-4** `DELIVERY_QUEUE_KEY` `@delivery_action_queue` stored in plain AsyncStorage; queue contains idempotency keys but no PII/OTP — OK.
- **P3-5** Console.log spam in `handleStartDelivery` (DeliveryHomeTab.tsx:434–471). Will be cleaned in the log-cleanup hardening step.
- **P3-6** `deliveryOtpResendCount` not part of `DELIVERY_RESET_KEYS` (server-side, so reset doesn't clear it — correct behavior, but confusing if a rider expects reset to fully clear local OTP state).
- **P3-7** `processedEventIds` Map purge in `useDeliverySocket` runs every 60s — fine. But the same logic runs on each `isEventDuplicate` call — minor double work.
- **P3-8** `ConnectionBanner` + `GlobalConnectivityBanner` both rendered in `DeliveryHomeTab` — verify no duplicate "Reconnected" toasts fire.
- **P3-9** `replayEntry` in `useOfflineQueueReplay.ts:70–74` has a commented "Unknown action — treat as a permanent failure" — silent removal; queue corruption could cause permanent action loss. Add metric/alert.

---

## 4. FLOW MAPS (high level)

### 4.1 Delivery happy path (rider POV, current production)

```
ASSIGN (admin)
  → orderStateService.transition(ASSIGNED) → outbox + push
  → inline io.to('admin_room' + 'delivery:{userId}').emit('order_assigned' + 'order:assigned')
  → mobile useDeliverySocket.handleOrderAssigned → cache push (full replace)

PICKUP (rider taps)
  → POST /delivery/orders/:id/pickup
  → orderStateService.transition(PICKED_UP) → push, outbox event
  → inline io.to('admin_room' + 'delivery_{deliveryBoyId}' + 'driver_{deliveryBoyId}').emit('order_picked_up')   [DEAD ROOMS]
  → mobile updates cache from mutation response
  → OrderEventBroadcaster polls outbox 5s later → re-emits 'order:status:changed' to admin_room only

START DELIVERY → IN_TRANSIT (similar)

MARK ARRIVED
  → POST /delivery/orders/:id/arrived
  → updates Order.arrivedAt (no orderStatus change)
  → inline io.to('delivery:{riderUserId}').emit('order:status:changed', { ... no version })   [DROPPED BY MOBILE GUARD if cached.version > 0]
  → mobile cache updated from mutation response (works on this device)

COD COLLECT (if COD)
  → POST /delivery/orders/:id/cod-collection
  → CodCollection record created
  → no socket emit; mobile updates local map from mutation response

OTP SEND → deliverAttempt
  → sets deliveryOtp / Generated / Issued / ExpiresAt
  → SMS + email + Notification
  → io.to('user_{customerId}').emit('notification:refresh')   [customer notif badge]

OTP RESEND
  → throttle 30s, max 3
  → re-issues OTP, increments deliveryOtpResendCount

OTP VERIFY
  → orderStateService.transition(IN_TRANSIT → DELIVERED, with OTP guard)
  → publish OrderDelivered event + push to customer
  → updateRouteAfterOrderStatusChange
  → io.to('admin_room' + 'user_{customerId}').emit('order_delivered')
  → createDeliveryEarning (idempotent)
  → DeliveryBoy.earnings $inc
  → io.to('delivery:{riderUserId}').emit('delivery:earning:credited', {amount, totalEarnings, ...})
  → PushNotification to rider
  → in-app Notification (deepLink: /delivery/earnings)
  → mobile invalidates ['Earnings','DeliveryOrders']
```

### 4.2 Customer order tracking

```
Customer opens tracking screen
  → useOrderTrackingSocket → io() → socket.on('connect') → emit('join_order_room', {orderId})
  → backend joins `order:{orderId}` after ownership check
  → listens for: 'order:status:changed', 'order:location:update'

WHAT WORKS:
  - 'order:location:update' emitted to `order:{orderId}` from index.ts liveLocationEvents handler [P0-2 doesn't apply — orderId, not userId]

WHAT DOESN'T:
  - 'order:status:changed' — production emits target `order:{userId}` (only if DeliverySocketEmitter were used) or 'admin_room' (OrderEventBroadcaster). Customer's `order:{orderId}` room receives neither.
  - Result: status badge updates only via push notification or pull-to-refresh.
```

### 4.3 Reconnect / sync graph (mobile rider)

```
disconnect → disconnectedAt = now; startPolling() (30s invalidateTags)
reconnect → setSocketStatus('connected'); stopPolling()
            → socket.emit('join_room', { room: `delivery:{userId}`, token })
            → if disconnectedFor > 60s: invalidateTags(['DeliveryOrders'])    [Earnings missed — P1-6]
            → if 5s..60s: jittered delay then emit('sync_request', { lastEventTimestamp })
                          ↳ no backend handler — silent timeout    [P0-3]
```

### 4.4 Offline action queue (delivery actions)

```
Action fires → mutation throws 'no status' → enqueue({id, action, orderId, targetStatus, args, fn, idempotencyKey, enqueuedAt})
              → persistQueueNow (immediate)
              
Network online (prevOnlineRef effect) → replayQueue(fetchOrderStatus)
              → for each item (FIFO sorted):
                  - drop if TTL expired (2h)
                  - drop if retries >= 5 with alert
                  - skip if nextRetryAt > now (backoff)
                  - reconstruct fn from registry
                  - fetch current status; drop if VALID_TRANSITIONS[from] doesn't include targetStatus
                  - exec; on 409 drop+alert; on no-status increment retry; on 4xx/5xx drop+alert
              → setQueue (debounced persist)

PARALLEL queue: useOfflineQueueReplay ('offlineMutationQueue') — separate file/system    [P2-8]
```

### 4.5 Background location lifecycle

```
Rider toggles online + has active route
  → useDeliveryLocation effect fires
  → Permission requests (foreground + background)
  → AppState.active gate
  → storage.setItem('activeRouteId', routeId)
  → Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, ...)   [Balanced, 20m, 3s, FG service]

Each location update:
  → backgroundLocationTask defined globally
  → drop if mocked (anti-spoofing)
  → drop if accuracy > 50m
  → flood-protect: max 1 / 2s
  → axios.put /delivery/location with token + activeRouteId
  → on 422 → stop task + clear activeRouteId
  → on other errors → offlineQueue.enqueue('LOCATION_UPDATE', payload)

App background → OS keeps task alive (with FG notification)
App killed → task SHOULD continue if OS allows (foregroundService notification posted)
App relaunched → useDeliveryLocation effect re-runs after auth + route data load. Does NOT reconcile with task state explicitly — relies on `hasStartedLocationUpdatesAsync` check inside startTracking [P1-8].
```

---

## 5. PARITY (web vs mobile vs backend)

I did not deeply audit the web frontend in this pass. From the search results I can confirm:

- Backend exposes `getDeliveryOrders`, `getEarnings`, etc. that mobile consumes.
- Admin web likely consumes `order:assigned`/`order:status:changed`/`product:created` from `admin_room`.
- Mobile rider consumes `delivery:{userId}` events.
- Customer mobile consumes `order:{orderId}` (location only) and push notifications.
- The "snake_case + colon-case dual emit" pattern (`order_assigned` + `order:assigned`) suggests an in-progress migration that left both event names live. **Recommend completing the migration to colon-case post-launch.**

---

## 6. EVERY FIX REQUIRED — prioritized

### Must fix before launch (P0)

1. **P0-1** Mobile guard tweak: `if (event.version != null && event.version <= cached.version) return;` (1-line fix). OR integrate `DeliverySocketEmitter` into `verifyDeliveryOtp` / `markArrived` / `pickupOrder` / `startDelivery` / `recordDeliveryAttempt` / `failDelivery` / `acceptOrder` / `rejectOrder` controllers (larger).
2. **P0-2** Change `DeliverySocketEmitter` to use `order:${order._id}` and ensure mark-arrived/verify-otp inline emits also target that room.
3. **P0-3** Mobile: drop `sync_request`/`sync_response`; on reconnect after >5s, `invalidateTags(['DeliveryOrders','Earnings'])`. Also add a one-shot `invalidateTags(['DeliveryOrders','Earnings','Notifications','Order','Orders'])` on initial socket connect.
4. **P0-4** Add `userRole === 'delivery'` guard in `useDeliverySocket`.

### Should fix this week (P1)

5. P1-1 Drop dead `delivery_`/`driver_` rooms in pickupOrder.
6. P1-2 Reduce/eliminate `OrderEventBroadcaster` polling.
7. P1-3 Same as P0-1 for markArrived inline emit.
8. P1-4 Drop snake_case `order_assigned` duplicate.
9. P1-5 Scope `socketClient` invalidations to changed orderId.
10. P1-6 Earnings invalidation on every reconnect.
11. P1-7 Lift token-refresh logic into shared util used by all 4 sockets.
12. P1-8 Add app-launch reconciliation for background location task.
13. P1-9 Add `startInProgressRef` ref-guard.
14. P1-10 Background-task 401 → token refresh once.
15. P1-11 Add `delivery` category to push prefs.
16. P1-12 Fix `routeCancellationHandler` to use `app.get('io')`.
17. P1-13 Delete the relay handlers (`order_status_update`, `order_created`, `driver_status_update`).
18. P1-14 Remove or wire up `order:otpResent`.

### Hardening pre-launch (separate ticket)

- Force Sync button (already planned).
- Debug overlay (already planned, after testing).
- Log cleanup (already planned, last).

---

## 7. DANGEROUS FIXES TO AVOID PRE-LAUNCH

- **DO NOT** rename rooms wholesale (`delivery_*` → `delivery:*`) without coordinated mobile + admin web rollout — one stale client breaks.
- **DO NOT** delete `OrderEventBroadcaster` polling without verifying admin web doesn't depend on it as a fallback.
- **DO NOT** consolidate the 4 mobile sockets into one in this cycle — high regression risk.
- **DO NOT** alter `orderStateService.transition` signature or `ALLOWED_TRANSITIONS` map.
- **DO NOT** remove the version-guard on mobile entirely — at least keep it for events that DO carry version. Use the soft-guard fix in P0-1.

---

## 8. FINAL LAUNCH RECOMMENDATION

**Ship-ready after the four P0 fixes are landed and re-tested with the manual simulation matrix the user already defined (Flows 1–6).** Do not block on P1/P2/P3.

The earnings pipeline, OTP integrity, idempotency, and order state machine are the strongest parts of the system. The realtime + reconnect surface is the weakest and is the dominant launch risk; the four P0 fixes are surgical and low-regression.

**Confidence:** Medium-High on backend orders/operations and mobile delivery hooks (audited deeply). **Low** on web frontend, payment gateway internals, voice/AI, and admin dashboard runtime — those should be audited separately before relying on this report's completeness for them.

— END —


