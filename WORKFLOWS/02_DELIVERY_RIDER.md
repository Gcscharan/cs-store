# DELIVERY RIDER WORKFLOW CATALOG

**Domain:** delivery rider (single-app role; rider screens under `apps/customer-app/src/screens/delivery/`)
**Status:** authoritative for rider lifecycle. Cross-references `FORENSIC_AUDIT_2026.md` for known bugs.

## File-by-file ownership map (rider domain)

| Surface | File | Role |
|---|---|---|
| Tab container | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/screens/delivery/DeliveryDashboardScreen.tsx` | Tab nav for Home / Earnings / More |
| Active orders + actions | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx` | Primary work surface |
| Earnings | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/screens/delivery/DeliveryEarningsTab.tsx` | Today/total/history |
| Route map | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/screens/delivery/DeliveryRouteScreen.tsx` | Route-by-route navigation |
| Profile/Settings/KYC/Selfie/Help/Emergency | `Delivery{Profile,Settings,KYC,Selfie,HelpCenter,Emergency}Screen.tsx` | Account |
| Domain hooks | `apps/customer-app/src/hooks/delivery/*` | 14 hooks |
| RTK API | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:1-200` | 21 endpoints |
| Auth API | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryAuthApi.ts` | rider login |
| Background task | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/tasks/backgroundLocationTask.ts` | location heartbeat |
| Backend domain | `backend/src/domains/operations/` | rider controllers |
| Backend domain | `backend/src/domains/delivery/` | socket emitter (mostly dead) |

## Backend endpoints used (verified from `deliveryApi.ts`)

```
GET    /delivery/orders                      → getDeliveryOrders
POST   /delivery/orders/:id/accept           → acceptOrder
POST   /delivery/orders/:id/reject           → rejectOrder
POST   /delivery/orders/:id/pickup           → pickupOrder
POST   /delivery/orders/:id/start-delivery   → startDelivery
POST   /delivery/orders/:id/arrived          → markArrived
POST   /delivery/orders/:id/deliver          → deliverAttempt (sends OTP)
POST   /delivery/orders/:id/verify-otp       → verifyDeliveryOtp
POST   /delivery/orders/:id/attempt          → recordDeliveryAttempt (FAILED/SUCCESS)
POST   /delivery/orders/:id/escalate         → escalateOrder
GET    /delivery/orders/:id/cod-collection   → getCodCollection
POST   /delivery/orders/:id/cod-collection   → createCodCollection
PUT    /delivery/location                    → updateLocation
POST   /delivery/orders/:id/resend-otp       → resendOtp
PUT    /delivery/status                      → toggleStatus (online/offline)
GET    /delivery/earnings                    → getEarnings
GET    /delivery/profile                     → getDeliveryProfile
PUT    /delivery/profile                     → updateDeliveryProfile
GET    /delivery/selfie-url                  → getSelfieUrl
PUT    /delivery/update-selfie               → updateSelfie
GET    /delivery/routes/current              → getCurrentRoute
```

---

## DEL-1 — Rider login

1. **Workflow ID:** DEL-1
2. **Workflow Name:** Rider login (phone/OTP)
3. **User Role:** delivery
4. **Entry Point:** `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/screens/auth/` (shared auth screens — `[NOT VERIFIED — exact rider login screen requires read of auth screens]`)
5. **Trigger:** user taps "Login" with phone+OTP from delivery role context
6. **Screens involved:** auth/PhoneEntryScreen, auth/OtpVerifyScreen (names typical; verify)
7. **Hooks involved:** `useAuthBootstrap` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/useAuthBootstrap.ts`)
8. **Services involved:** `services/socketClient` initializes after token set; `axiosBaseQuery` for HTTP
9. **APIs involved:** `authApi` or `deliveryAuthApi` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryAuthApi.ts`)
10. **Backend controllers involved:** `backend/src/controllers/auth*` or `backend/src/domains/identity/` `[NOT VERIFIED — exact controller path]`
11. **Models involved:** `User`, `OtpToken` `[NOT VERIFIED model name]`
12. **Socket events involved:** none during login. Post-login socket connect → `io.use` reads token from handshake auth → assigns `socket.data.userId/role` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/index.ts:282-316`)
13. **RTK cache tags:** invalidates everything via `baseApi.util.resetApiState()` typically on login `[NOT VERIFIED]`
14. **Offline queue involvement:** none — login requires network
15. **Replay involvement:** none
16. **Notification involvement:** push token registered post-login (DEL-3)
17. **Background task involvement:** location task is gated on rider being on duty + having active route; not started at login
18. **AsyncStorage / SecureStore keys:** `accessToken`, `refreshToken` in SecureStore via `storage.ts` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/utils/storage.ts:1-37`); also `userId`, `userRole` likely
19. **State transitions involved:** auth slice: `unauthenticated → authenticated`
20. **Success path:** OTP submit → backend issues JWT → store tokens → bootstrap socket → navigate to DeliveryDashboardScreen
21. **Failure path:** invalid OTP → toast error; expired OTP → resend flow
22. **Retry path:** OTP resend (rate-limited backend-side) `[NOT VERIFIED — limit value]`
23. **Reconnect path:** N/A
24. **App-kill recovery path:** see DEL-2 (session restore)
25. **Polling fallback path:** N/A
26. **Idempotency strategy:** OTP verification is single-use server-side
27. **Cache invalidation path:** post-login → resetApiState (typical pattern; verify)
28. **Optimistic update path:** none
29. **Security/auth validation:** server-side OTP expiry; JWT signed with `JWT_SECRET`
30. **Final persisted state:** tokens in SecureStore; auth slice hydrated
31. **Known bugs:** none from forensic audit specific to rider login.
32. **Broken states:** —
33. **Stale-state risks:** if previous user logged out incompletely, residual SecureStore keys may leak across rider switches
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** —
37. **Launch risk severity:** none
38. **Recommended fix:** verify all SecureStore keys cleared on logout (DEL-33)
39. **Safe pre-launch?** yes
40. **Coordination:** mobile only

---

## DEL-2 — Rider session restore (app launch)

1. **ID:** DEL-2
2. **Name:** Session restore on app launch
3. **Role:** delivery
4. **Entry:** App boot → `useAuthBootstrap` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/useAuthBootstrap.ts:1-60`)
5. **Trigger:** RootNavigator mount
6. **Screens:** SplashScreen → DeliveryDashboardScreen if rider role
7. **Hooks:** `useAuthBootstrap`
8. **Services:** `storage` (SecureStore)
9. **APIs:** none initially; lazy `getDeliveryProfile` etc. fire after auth restored
10. **Backend controllers:** none at boot (only token verify on first authed request)
11. **Models:** —
12. **Socket events:** socketClient connects with restored token (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/services/socketClient.ts`)
13. **RTK tags:** none
14. **Offline:** —
15. **Replay:** post-restore — `useOfflineQueueReplay` may flush queued actions when network online (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/useOfflineQueueReplay.ts`); `useActionQueue` rehydrates from `@delivery_action_queue` AsyncStorage
16. **Notification:** push token re-registered if missing (DEL-3)
17. **Background task:** **NOT auto-resumed** at launch. `useDeliveryLocation` only starts when `isOnDuty && routeId` is true after `getCurrentRoute` resolves (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/useDeliveryLocation.ts:151-179`). **See P1-8 in audit.**
18. **AsyncStorage:** `accessToken`, `refreshToken`, `activeRouteId`, `@delivery_action_queue`, `@delivery_socket_last_event_ts`
19. **State transitions:** auth slice: `bootstrapping → authenticated|unauthenticated`
20. **Success path:** read token → axios sets default Authorization → socket connects → first authed query (e.g. `getDeliveryProfile`) succeeds
21. **Failure path:** missing token → unauthenticated → navigate to auth stack
22. **Retry:** none — token refresh handled by axios interceptor or `socketClient connect_error` handler (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/services/socketClient.ts:209-231`)
23. **Reconnect:** see SOCK-* (file 03)
24. **App-kill recovery:** this IS the recovery path. Background location task may still be running independently — need explicit reconciliation (P1-8 fix)
25. **Polling fallback:** N/A
26. **Idempotency:** —
27. **Cache invalidation:** none on restore — RTK cache is in-memory and starts cold
28. **Optimistic update:** —
29. **Security:** JWT signature verified server-side on first authed call
30. **Final state:** authenticated session re-established
31. **Known bugs:** P1-8 (no background task reconciliation), P1-12 (no `delivery` push category check at restore)
32. **Broken states:** if rider was on duty before kill and `activeRouteId` is in storage but no app reconciliation runs, location task may continue silently or stop silently depending on OS — admin live tracking may go flat
33. **Stale-state risks:** RTK cache cold → first paint shows skeletons; can be confusing if previous queries had data
34. **Missing listeners:** —
35. **Missing invalidations:** would benefit from a one-shot `invalidateTags(['DeliveryOrders','Earnings','Notifications','Profile'])` on socket connect (planned in P0-3 fix)
36. **Runtime risks:** background location task drift across app kill
37. **Launch risk severity:** P1
38. **Recommended fix:** add `useEffect` in DeliveryDashboardScreen on auth restore: check `Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)` — if true and current route exists, mark `isTracking=true`; if false and `activeRouteId` in storage, call `startTracking()`
39. **Safe pre-launch?** yes
40. **Coordination:** mobile only

---

## DEL-3 — Push notification token registration

1. **ID:** DEL-3
2. **Name:** Expo push token register/refresh
3. **Role:** delivery (also customer; but tracked here for rider focus)
4. **Entry:** post-login or post-restore — `[NOT VERIFIED — likely in App.tsx or RootNavigator effect]`
5. **Trigger:** authenticated state established + push permission granted
6. **Screens:** none direct
7. **Hooks:** `[NOT VERIFIED — suspect a usePushNotifications hook]`
8. **Services:** `expo-notifications`, backend `/auth/push-token` or similar
9. **APIs:** `[NOT VERIFIED — exact endpoint path]`
10. **Backend controllers:** `backend/src/controllers/auth*` or `domains/communication/`
11. **Models:** `User.pushTokens` array `[NOT VERIFIED]`
12. **Socket events:** none
13. **RTK tags:** none
14. **Offline:** registration deferred until network
15. **Replay:** —
16. **Notification:** —
17. **Background task:** —
18. **AsyncStorage:** push token cached (likely)
19. **State transitions:** —
20. **Success path:** Notifications.requestPermissionsAsync → getExpoPushTokenAsync → POST to backend
21. **Failure path:** permission denied → silent; no in-app degradation handling
22. **Retry:** none documented
23. **Reconnect:** —
24. **App-kill recovery:** re-runs on next launch
25. **Polling fallback:** —
26. **Idempotency:** backend should upsert by `(userId, token)` `[NOT VERIFIED]`
27. **Cache invalidation:** —
28. **Optimistic update:** —
29. **Security:** Expo project-id required (config); token authenticity verified by Expo
30. **Final state:** token stored on User document
31. **Known bugs:** P1-11 (`myOrders` push category gates rider notifications — riders with category disabled don't receive earnings push)
32. **Broken states:** rider with disabled `myOrders` category receives nothing
33. **Stale-state risks:** stale tokens not cleaned up — pending verification
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** notification spam to old devices if token cleanup missing
37. **Launch risk severity:** P1 (P1-11)
38. **Recommended fix:** add `delivery` notification category; check it instead of `myOrders` for rider role (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/utils/PushNotificationService.ts:30-31`)
39. **Safe pre-launch?** yes (small mobile change)
40. **Coordination:** mobile + backend (preference schema)

---

## DEL-4 — Online/availability toggle

1. **ID:** DEL-4
2. **Name:** Toggle isOnline (go on duty / off duty)
3. **Role:** delivery
4. **Entry:** `DeliveryHomeTab.tsx` toggle UI element
5. **Trigger:** rider taps toggle
6. **Screens:** DeliveryHomeTab
7. **Hooks:** `useDeliveryState` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/delivery/useDeliveryState.ts`)
8. **Services:** —
9. **APIs:** `toggleStatus` mutation → `PUT /delivery/status` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:151-157`)
10. **Backend controllers:** `[NOT VERIFIED — backend route file for /delivery/status]`
11. **Models:** `DeliveryBoy.availability`, `DeliveryBoy.isActive` `[NOT VERIFIED]`
12. **Socket events:** none directly; admin dashboard may receive `driver:status:update` via the (insecure P1-13) relay handler
13. **RTK tags:** mutation does not declare `invalidatesTags` in API definition `[VERIFIED — line 151-157 has no invalidatesTags]` → state slice updated locally
14. **Offline:** —
15. **Replay:** —
16. **Notification:** —
17. **Background task:** **DOWNSTREAM EFFECT** — `useDeliveryLocation` effect re-evaluates `isOnDuty` and starts/stops `LOCATION_TASK_NAME` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/useDeliveryLocation.ts:151-179`)
18. **AsyncStorage:** `activeRouteId` set/cleared inside startTracking/stopTracking
19. **State transitions:** `DeliveryBoy.availability: offline ↔ available|busy`
20. **Success path:** PUT 200 → local state isOnline=true → useDeliveryLocation effect → location task starts (if route exists)
21. **Failure path:** PUT non-200 → toggle reverts (UI must rollback) `[NOT VERIFIED — need read of toggle handler in DeliveryHomeTab]`
22. **Retry:** —
23. **Reconnect:** —
24. **App-kill recovery:** server state persists; rider's `availability` field on relaunch determines initial UI state
25. **Polling fallback:** —
26. **Idempotency:** PUT is naturally idempotent
27. **Cache invalidation:** none directly; risk: `getDeliveryOrders` cache may not refresh until socket fires
28. **Optimistic update:** local state updates immediately
29. **Security:** `requireRole(['delivery'])` middleware `[NOT VERIFIED]`
30. **Final state:** `DeliveryBoy.availability` updated
31. **Known bugs:** none specific
32. **Broken states:** if PUT fails silently, UI shows online but server has rider offline → no assignments → "ghost online" state
33. **Stale-state risks:** medium — toggling rapidly during network blip
34. **Missing listeners:** rider should re-fetch `getDeliveryOrders` on going online to pick up any orders assigned during offline period
35. **Missing invalidations:** add `invalidatesTags: ['DeliveryOrders']` on toggleStatus mutation → ensures orders refresh on going online
36. **Runtime risks:** location task may fail to start if AppState != 'active' at moment of toggle (defensive guard exists at `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/useDeliveryLocation.ts:58-61`)
37. **Launch risk severity:** P2
38. **Recommended fix:** add `invalidatesTags: ['DeliveryOrders']` to `toggleStatus`
39. **Safe pre-launch?** yes (1-line change)
40. **Coordination:** mobile only

---

## DEL-5 — Active route / orders load

1. **ID:** DEL-5
2. **Name:** Load assigned orders + current route
3. **Role:** delivery
4. **Entry:** DeliveryHomeTab mount
5. **Trigger:** screen render → RTK `useGetDeliveryOrdersQuery` and `useGetCurrentRouteQuery` fire
6. **Screens:** DeliveryHomeTab, DeliveryRouteScreen
7. **Hooks:** `useOrders` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/delivery/useOrders.ts`), `useDashboardData` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/delivery/useDashboardData.ts:10-13`)
8. **Services:** —
9. **APIs:** `getDeliveryOrders` GET `/delivery/orders` (provides `DeliveryOrders` tag); `getCurrentRoute` GET `/delivery/routes/current`
10. **Backend controllers:** `domains/operations/controllers/deliveryOrderController.ts` getDeliveryOrders, getCurrentRoute `[NOT FULLY VERIFIED — only spot-checked]`
11. **Models:** `Order`, `Route`, `DeliveryBoy`
12. **Socket events:** real-time updates via `useDeliverySocket` (DEL-30) replace polling
13. **RTK tags:** provides `['DeliveryOrders']`; current route is uncached (no providesTag)
14. **Offline:** if offline → returns last cached
15. **Replay:** —
16. **Notification:** —
17. **Background task:** none direct, but route load triggers location tracking start (DEL-25)
18. **AsyncStorage:** none
19. **State transitions:** —
20. **Success path:** GET 200 → list rendered; first item becomes "active order"
21. **Failure path:** GET non-200 → error UI; cached data still shown if available
22. **Retry:** RTK Query auto-retry behaviour (default no retry); manual pull-to-refresh in `DeliveryHomeTab`
23. **Reconnect:** on socket reconnect with outage > 60s, `useDeliverySocket` invalidates `['DeliveryOrders']` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/delivery/useDeliverySocket.ts:121-123`)
24. **App-kill recovery:** RTK cache is in-memory, lost on kill; refetch on next mount
25. **Polling fallback:** during socket disconnect, useDeliverySocket polls invalidations every 30s
26. **Idempotency:** GET is naturally idempotent
27. **Cache invalidation:** any mutation tagged `['DeliveryOrders']` invalidates this query
28. **Optimistic update:** mutations like pickup/start/arrive use `updateQueryData` patches (no `invalidatesTags`) to avoid refetch storm
29. **Security:** `requireRole(['delivery'])`; backend filters orders by `deliveryBoyId === user.deliveryBoyId`
30. **Final state:** rider's active order list + active route hydrated
31. **Known bugs:** P0-3 (sync_request silent failure on reconnect — falls back to 60s threshold), P1-6 (Earnings missed on reconnect), P2-5 (verify completed orders are filtered out client-side)
32. **Broken states:** after reconnect with mid-range outage (5-60s), only `sync_request` is sent which is unhandled — list may stay stale
33. **Stale-state risks:** high — central to all rider UX
34. **Missing listeners:** —
35. **Missing invalidations:** Earnings on reconnect (P1-6)
36. **Runtime risks:** see P0 issues
37. **Launch risk severity:** P0 (inherits from socket reconnect issues)
38. **Recommended fix:** see P0-3 in audit — drop sync_request, invalidate `['DeliveryOrders','Earnings']` on every reconnect after >5s outage
39. **Safe pre-launch?** yes
40. **Coordination:** mobile only

---

## DEL-6 — Order assignment reception (realtime)

1. **ID:** DEL-6
2. **Name:** Receive `order:assigned` socket event and add order to cache
3. **Role:** delivery
4. **Entry:** socket already connected to `delivery:{userId}` room
5. **Trigger:** admin assigns order → backend emits to `delivery:{userId}` and `admin_room`
6. **Screens:** DeliveryHomeTab (re-renders from cache)
7. **Hooks:** `useDeliverySocket.handleOrderAssigned` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/delivery/useDeliverySocket.ts`)
8. **Services:** —
9. **APIs:** none directly; cache patched via `deliveryApi.util.updateQueryData('getDeliveryOrders', ...)` `[VERIFIED via prior session]`
10. **Backend controllers:** `controllers/orderAssignmentController.ts:177-186` (transition to ASSIGNED via `orderStateService`); also lines `:263-284` emit `order_assigned` AND `order:assigned` to `admin_room` AND `delivery:{userId}`
11. **Models:** `Order`, `DeliveryBoy`
12. **Socket events:** **listen** `order:assigned`, `new_order` (P2-1: dead listener); **emit** none
13. **RTK tags:** patches `getDeliveryOrders` directly; falls back to invalidate if patch fails
14. **Offline:** if disconnected, missed events recovered via reconnect resync (P0-3 broken)
15. **Replay:** —
16. **Notification:** push notification sent server-side via `PushNotificationService.sendToUser` for `OrderAssigned` event `[NOT FULLY VERIFIED — sender is event consumer]`
17. **Background task:** —
18. **AsyncStorage:** `@delivery_socket_last_event_ts` updated
19. **State transitions:** `Order: PACKED → ASSIGNED` (server-side)
20. **Success path:** event received → `isEventDuplicate` check → `processedEventIds.add(eventId)` → cache patch → toast/sound feedback
21. **Failure path:** if eventId already processed → silent skip; if cache patch errors → fallback `invalidateTags(['DeliveryOrders'])`
22. **Retry:** backend `emitWithRetry` retries with ACK timeout (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/delivery/services/deliverySocketEmitter.ts`) — **but emitter is unused in production** so retry is also dead
23. **Reconnect:** post-reconnect `sync_request` (broken — P0-3) or 60s threshold invalidate
24. **App-kill recovery:** missed events reconciled by next `getDeliveryOrders` fetch
25. **Polling fallback:** 30s polling of invalidations during disconnect
26. **Idempotency:** mobile dedup via `processedEventIds` Map (60s TTL purge)
27. **Cache invalidation:** patch first, fall back to invalidate
28. **Optimistic update:** N/A (server-driven)
29. **Security:** `delivery:{userId}` room only joinable by user with that id and role=delivery (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/index.ts:474-528`)
30. **Final state:** Order in `getDeliveryOrders` cache with status ASSIGNED
31. **Known bugs:** P0-1 (version guard discards `order:status:changed` events but `order:assigned` payload is full Order — not version-guarded, so OK); P1-4 (duplicate snake/colon emit causes potential dedup miss if eventIds differ)
32. **Broken states:** if backend emits without `eventId`, mobile dedup degrades to tracking by orderId+status which is less precise
33. **Stale-state risks:** if rider is offline at moment of assign + reconnects after 60s → invalidation refetches list ✓; if 5-60s → stale until next event
34. **Missing listeners:** `new_order` is listened-for but never emitted (P2-1)
35. **Missing invalidations:** —
36. **Runtime risks:** double-listener if `useDeliverySocket` and `socketClient` both fire — confirmed: `socketClient` listens too and invalidates `['Orders','Order']` (customer tags, not Delivery) → no double invalidation
37. **Launch risk severity:** P1 (mostly OK, but reconnect path is fragile)
38. **Recommended fix:** P0-3 + P1-4 (drop snake_case duplicate)
39. **Safe pre-launch?** yes
40. **Coordination:** backend (drop snake_case duplicate) + mobile (P0-3 reconnect fix)

---

## DEL-7 — Available orders fetch (if accept/reject flow used)

1. **ID:** DEL-7
2. **Name:** Available (unassigned) orders displayed for rider self-pickup
3. **Role:** delivery
4. **Entry:** DeliveryHomeTab "Available" section if such a tab exists
5. **Trigger:** screen mount or socket `new_order` (P2-1: dead listener so this is broken if it depends on that)
6. **Screens:** DeliveryHomeTab
7. **Hooks:** `useDashboardData` derives `availableOrders` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/delivery/useDashboardData.ts`) `[NOT FULLY VERIFIED — exact derivation logic]`
8. **Services:** —
9. **APIs:** `getDeliveryOrders` returns assigned orders only `[NOT VERIFIED whether unassigned-available endpoint exists]`
10. **Backend controllers:** `[NOT VERIFIED — appears the system uses admin-driven assignment, not rider-pickup]`
11. **Models:** Order (status=PACKED, deliveryBoyId=null)
12. **Socket events:** none verified
13. **RTK tags:** —
14. **Offline:** —
15. **Replay:** —
16. **Notification:** —
17. **Background task:** —
18. **AsyncStorage:** —
19. **State transitions:** —
20. **Success path:** unclear; likely the system is admin-assignment-only and there is NO rider self-pickup flow
21. **Failure path:** —
22. **Retry:** —
23. **Reconnect:** —
24. **App-kill recovery:** —
25. **Polling fallback:** —
26. **Idempotency:** —
27. **Cache invalidation:** —
28. **Optimistic update:** —
29. **Security:** —
30. **Final state:** —
31. **Known bugs:** P2-1 (`new_order` listener present but never fired) suggests this workflow is **architecturally absent** in production — only admin assigns orders
32. **Broken states:** —
33. **Stale-state risks:** —
34. **Missing listeners:** if "available orders" is intended, backend never emits it
35. **Missing invalidations:** —
36. **Runtime risks:** dead UI affordance if available-orders section exists but never populates
37. **Launch risk severity:** P3 (likely cleanup item)
38. **Recommended fix:** confirm with product whether self-pickup flow is intended; if not, remove `new_order` listener and any "available orders" UI; if yes, implement backend emit + endpoint
39. **Safe pre-launch?** yes (cleanup only)
40. **Coordination:** backend + mobile

---

## DEL-8 — Accept order (if applicable)

1. **ID:** DEL-8
2. **Name:** Rider accepts an offered order
3. **Role:** delivery
4. **Entry:** Accept button on offered order
5. **Trigger:** user taps Accept
6. **Screens:** DeliveryHomeTab
7. **Hooks:** `useActionQueue` for offline support
8. **Services:** —
9. **APIs:** `acceptOrder` mutation `POST /delivery/orders/:id/accept` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:13-21`); idempotency-key passed
10. **Backend controllers:** `domains/operations/controllers/deliveryOrderController.ts` acceptOrder `[exact lines NOT VERIFIED]`
11. **Models:** Order, DeliveryBoy
12. **Socket events:** likely emits `order:status:changed` to admin/rider rooms; **inline emit, no version field** — same P0-1 family bug
13. **RTK tags:** invalidates `['DeliveryOrders']`
14. **Offline:** action queueable via `useActionQueue` (idempotency-key generated on enqueue)
15. **Replay:** yes — replayed when network online; status precondition checked before replay
16. **Notification:** —
17. **Background task:** —
18. **AsyncStorage:** `@delivery_action_queue` if enqueued
19. **State transitions:** `Order: ASSIGNED → ASSIGNED` (no state change on accept; or it may be an internal "acknowledged" flag)
20. **Success path:** POST 200 → list invalidated → re-fetch
21. **Failure path:** 409 conflict → drop from queue with alert; 5xx → enqueue
22. **Retry:** queue replay every reconnect; max 5 retries; 2h TTL
23. **Reconnect:** queue auto-replays
24. **App-kill recovery:** queue persisted to AsyncStorage; rehydrated on launch
25. **Polling fallback:** —
26. **Idempotency:** server keyed by `Idempotency-Key` header
27. **Cache invalidation:** `['DeliveryOrders']`
28. **Optimistic update:** none for accept
29. **Security:** rider must own the assignment (`deliveryBoyId === user.deliveryBoyId`)
30. **Final state:** Order acknowledged
31. **Known bugs:** if backend lacks idempotency-key handling on this route, double-tap could double-process `[NOT VERIFIED]`
32. **Broken states:** —
33. **Stale-state risks:** low
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** —
37. **Launch risk severity:** P2
38. **Recommended fix:** verify backend idempotency-key middleware on `/delivery/orders/:id/accept`
39. **Safe pre-launch?** yes
40. **Coordination:** backend (verify) + mobile

---

## DEL-9 — Reject order

Same template as DEL-8, route `POST /delivery/orders/:id/reject` with reason. Allowed offline. Idempotency-key. Triggers `['DeliveryOrders']` invalidation. **Risk:** rejecting last-rider triggers admin reassignment; if reassign service fails, order stuck. `[Reassign details — see DEL-22]`

---

## DEL-10 — View active order detail

Read-only screen sourced from `getDeliveryOrders` cache, no separate endpoint. Patched live by `useDeliverySocket`. **Risk:** P0-1 (status changes from socket discarded by version guard once cached.version > 0).

---

## DEL-11 — Pickup order

1. **ID:** DEL-11
2. **Name:** Mark order picked up at vendor / hub
3. **Role:** delivery
4. **Entry:** Pickup button on active order card
5. **Trigger:** rider taps Pickup
6. **Screens:** DeliveryHomeTab
7. **Hooks:** `useActionQueue` for offline; `useActionGuard` for double-tap protection (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/delivery/useActionGuard.ts`)
8. **Services:** —
9. **APIs:** `pickupOrder` mutation `POST /delivery/orders/:id/pickup` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:33-41`); **NO `invalidatesTags` — uses optimistic cache from response body**
10. **Backend controllers:** `domains/operations/controllers/deliveryOrderController.ts pickupOrder` (line ~1027+); transitions ASSIGNED → PICKED_UP via `orderStateService.transition`
11. **Models:** Order, DeliveryBoy
12. **Socket events:** **emit** to (a) `admin_room` (b) `delivery_${deliveryBoyId}` [DEAD ROOM, P1-1] (c) `driver_${deliveryBoyId}` [DEAD ROOM, P1-1]; event name `order_picked_up` (snake)
13. **RTK tags:** none direct; cache updated optimistically from response body in mutation handler
14. **Offline:** queueable
15. **Replay:** yes; `VALID_TRANSITIONS[from]` guard ensures replay only fires if order is still ASSIGNED
16. **Notification:** OrderPickedUp event published to outbox → `PushNotificationService` may notify customer (verify in `orderStateService:560-573`)
17. **Background task:** —
18. **AsyncStorage:** queue if enqueued
19. **State transitions:** `Order: ASSIGNED → PICKED_UP`; `pickedUpAt` timestamp set
20. **Success path:** POST 200 → response includes updated Order → mutation handler patches `getDeliveryOrders` cache → UI re-renders with PICKED_UP status
21. **Failure path:** 409 (state conflict) → drop from queue + alert; 5xx → enqueue
22. **Retry:** queue auto-replay; idempotency-key prevents double-process
23. **Reconnect:** queue replays
24. **App-kill recovery:** queue persisted
25. **Polling fallback:** —
26. **Idempotency:** `Idempotency-Key` header `[backend-side handling NOT VERIFIED but mobile generates one]`
27. **Cache invalidation:** none (optimistic patch only)
28. **Optimistic update:** **YES** — cache patched from response (cleaner than pre-mutation optimistic)
29. **Security:** `orderStateService.assertAllowedByRole` — rider must be assigned (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/orders/services/orderStateService.ts:260-272`)
30. **Final state:** Order PICKED_UP, pickedUpAt set
31. **Known bugs:** P1-1 (dead emit rooms — but harmless because mobile gets state from response; admin gets it from `admin_room`); customer push notification — see push category P1-11
32. **Broken states:** —
33. **Stale-state risks:** if mutation succeeds but response is malformed and cache patch fails silently → list stale until next refresh
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** —
37. **Launch risk severity:** P1 (mostly cosmetic dead-room cleanup)
38. **Recommended fix:** drop `delivery_`/`driver_` rooms emit (P1-1)
39. **Safe pre-launch?** yes
40. **Coordination:** backend only

---

## DEL-12 — Start delivery (PICKED_UP → IN_TRANSIT)

Same shape as DEL-11. Route: `POST /delivery/orders/:id/start-delivery`. Transition `PICKED_UP → IN_TRANSIT` via orderStateService. ETA window computed if missing (`orderStateService.ts:335-356`). Customer push: "Order Out for Delivery 🚚". Cache: optimistic from response. **Same P1 risks as DEL-11.**

---

## DEL-13 — Mark arrived

1. **ID:** DEL-13
2. **Name:** Rider marks arrival at customer location
3. **Role:** delivery
4. **Entry:** Arrived button (visible after IN_TRANSIT)
5. **Trigger:** rider taps Arrived
6. **Screens:** DeliveryHomeTab
7. **Hooks:** `useActionGuard`, `useActionQueue`
8. **Services:** —
9. **APIs:** `markArrived` mutation `POST /delivery/orders/:id/arrived` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:53-61`); no `invalidatesTags`
10. **Backend controllers:** `deliveryOrderController.markArrived` (~line 1140+); does **NOT** call orderStateService — it only sets `Order.arrivedAt` timestamp (no orderStatus change)
11. **Models:** Order
12. **Socket events:** **emit** `order:status:changed` to `delivery:{riderUserId}` only (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/operations/controllers/deliveryOrderController.ts:1192-1198`) — payload includes `arrivedAt`, `orderStatus`, `deliveryStatus`, but **NO `version` field** → P0-1 / P1-3
13. **RTK tags:** none
14. **Offline:** queueable
15. **Replay:** yes
16. **Notification:** none server-side `[NOT VERIFIED — could be silent or could fire OrderArrived event; suspect not]`
17. **Background task:** —
18. **AsyncStorage:** —
19. **State transitions:** Order.arrivedAt set; orderStatus stays IN_TRANSIT
20. **Success path:** POST 200 → response includes `{ order: { arrivedAt, ... } }` → mutation handler patches cache `arrivedAt` field → UI shows OTP send button
21. **Failure path:** 5xx → enqueue
22. **Retry:** queue auto-replay
23. **Reconnect:** —
24. **App-kill recovery:** queue persisted
25. **Polling fallback:** —
26. **Idempotency:** idempotency-key
27. **Cache invalidation:** optimistic patch
28. **Optimistic update:** from response body
29. **Security:** rider must be assigned + order must be IN_TRANSIT `[NOT VERIFIED but typical]`
30. **Final state:** `Order.arrivedAt` set
31. **Known bugs:** **P1-3 (CRITICAL)** — inline socket emit lacks version → mobile guard discards → if rider has multiple devices or admin pushes mark-arrived, OTHER devices won't update; current device works because mutation response patches cache
32. **Broken states:** see P0-1
33. **Stale-state risks:** medium — multi-device riders are rare but possible
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** version-guard discard
37. **Launch risk severity:** P1
38. **Recommended fix:** include `version: ++cached.socketVersion` in inline emit, OR apply mobile guard fix from P0-1 (treat undefined version as bypass)
39. **Safe pre-launch?** yes (mobile-side fix is 1-line)
40. **Coordination:** mobile (immediate fix) + backend (proper fix)

---

## DEL-14 — COD cash collection

1. **ID:** DEL-14
2. **Name:** Record cash collected from customer
3. **Role:** delivery
4. **Entry:** "Collect Cash" button after Arrived (only if `paymentMethod === 'COD'`)
5. **Trigger:** rider taps Collect Cash, confirms amount
6. **Screens:** DeliveryHomeTab modal or sub-screen
7. **Hooks:** `useActionGuard`
8. **Services:** —
9. **APIs:** `getCodCollection` (GET status), `createCodCollection` mutation `POST /delivery/orders/:id/cod-collection { mode: 'CASH', idempotencyKey }` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:109-123`)
10. **Backend controllers:** `deliveryOrderController.createCodCollection` `[exact line NOT VERIFIED]`
11. **Models:** `CodCollection` (or similar) with unique index on orderId
12. **Socket events:** none verified — likely no socket emit
13. **RTK tags:** none verified `[NOT VERIFIED — check invalidates in api file]`
14. **Offline:** **MUST NOT BE OFFLINE-QUEUEABLE** for cash (real money handling — verify mobile blocks offline path). Earlier session note indicated COD offline-block was correct.
15. **Replay:** —
16. **Notification:** —
17. **Background task:** —
18. **AsyncStorage:** local map of collected orders updated for UI
19. **State transitions:** CodCollection: none → recorded
20. **Success path:** POST 200 → CodCollection row created → mobile updates local collected map → enables OTP send button
21. **Failure path:** 409 (already collected) → idempotent OK; 5xx → user retries (NOT auto-replay since financial)
22. **Retry:** manual retry only
23. **Reconnect:** —
24. **App-kill recovery:** server is source of truth; on relaunch query `getCodCollection` to determine whether already collected
25. **Polling fallback:** —
26. **Idempotency:** unique index on `(orderId, mode)` server-side; idempotency-key from mobile
27. **Cache invalidation:** local mobile map only
28. **Optimistic update:** —
29. **Security:** rider assigned + order IN_TRANSIT + payment method = COD
30. **Final state:** CodCollection record persisted
31. **Known bugs:** none specific verified
32. **Broken states:** if mobile retries on 5xx without idempotency-key, double row possible (mitigated by unique index)
33. **Stale-state risks:** if rider closes app after collecting cash but before backend confirms, on relaunch mobile may show "uncollected" until `getCodCollection` re-fetches
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** financial — must keep retry strict
37. **Launch risk severity:** P1
38. **Recommended fix:** ensure `getCodCollection` is auto-fetched on order detail mount; ensure mobile blocks offline cash collection (confirm)
39. **Safe pre-launch?** yes (verification only)
40. **Coordination:** mobile + backend (verification)

---

## DEL-15 — COD UPI collection (QR)

Same as DEL-14 with `mode: 'UPI'` and `upiRef` (UPI transaction reference). **Risk:** UPI ref entry is manual → typo risk. **Verify** server-side validation of upiRef format. Customer UPI verification is a separate flow (see file 05_PAYMENT.md). **DEL-15 only records that rider initiated UPI collection — not that funds settled.**

---

## DEL-16 — Send delivery OTP (deliverAttempt)

1. **ID:** DEL-16
2. **Name:** Generate and send delivery OTP to customer
3. **Role:** delivery
4. **Entry:** "Send OTP" button visible when arrivedAt set + (cash collected if COD)
5. **Trigger:** rider taps Send OTP
6. **Screens:** DeliveryHomeTab → ActiveOrderCard
7. **Hooks:** `useActionGuard` (single-flight); `useAttemptTracker` for local tracking
8. **Services:** SMS (Twilio?), Email service, NotificationWriter — `[NOT FULLY VERIFIED — backend services not deeply traced]`
9. **APIs:** `deliverAttempt` mutation `POST /delivery/orders/:id/deliver` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:63-70`); invalidates `['DeliveryOrders']`
10. **Backend controllers:** `deliveryOrderController.deliverAttempt` — generates OTP, sets `deliveryOtp/Generated/Issued/ExpiresAt`, sends SMS+email, creates Notification
11. **Models:** Order (OTP fields), Notification
12. **Socket events:** **emit** `notification:refresh` to `user_${customerId}` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/operations/controllers/deliveryOrderController.ts:2052` style — verified via grep on `order:otpResent`)
13. **RTK tags:** invalidates `['DeliveryOrders']`
14. **Offline:** **NOT queueable** — must be online (server generates OTP)
15. **Replay:** —
16. **Notification:** SMS + email + in-app for customer
17. **Background task:** —
18. **AsyncStorage:** local map `@delivery_otp_attempted_${orderId}` `[NOT VERIFIED key naming]`
19. **State transitions:** OTP: `none → generated`; Order.deliveryOtpGeneratedAt set
20. **Success path:** POST 200 → mobile shows OTP entry sheet; SMS lands on customer phone
21. **Failure path:** SMS provider down → backend should still return 200 with email-only fallback `[NOT VERIFIED]`
22. **Retry:** rider can use Resend OTP (DEL-17)
23. **Reconnect:** —
24. **App-kill recovery:** server-side OTP persists 5 min; mobile re-opens to OTP entry by deriving from `deliveryOtpGeneratedAt`
25. **Polling fallback:** —
26. **Idempotency:** if `deliveryOtp` already set + not expired → idempotent re-issue or 409 `[NOT VERIFIED]`
27. **Cache invalidation:** `['DeliveryOrders']`
28. **Optimistic update:** mobile sets `isDeliveryAttempted` flag locally
29. **Security:** rider must be assigned + arrivedAt set + (COD collected if applicable); status must be IN_TRANSIT/OUT_FOR_DELIVERY
30. **Final state:** OTP generated server-side, sent to customer
31. **Known bugs:** P2-6 (`deliveryOtpGeneratedAt` not cleared on verify success — UI uses `flow.isDelivered` guard so harmless)
32. **Broken states:** if SMS provider permanently down → customer never sees OTP → see DEL-17 resend
33. **Stale-state risks:** —
34. **Missing listeners:** customer mobile does not listen for `order:otpResent` (P1-14)
35. **Missing invalidations:** —
36. **Runtime risks:** OTP delivery channel reliability
37. **Launch risk severity:** P2
38. **Recommended fix:** verify SMS provider failover; verify mobile customer in-app OTP display path
39. **Safe pre-launch?** yes
40. **Coordination:** backend (verify SMS) + customer mobile (in-app OTP fallback)

---

## DEL-17 — Resend delivery OTP (throttled)

1. **ID:** DEL-17
2. **Name:** Re-issue delivery OTP within session
3. **Role:** delivery
4. **Entry:** "Resend" link in OTP entry sheet
5. **Trigger:** rider taps Resend
6. **Screens:** DeliveryHomeTab OTP sheet
7. **Hooks:** —
8. **Services:** SMS, Email
9. **APIs:** `resendOtp` mutation `POST /delivery/orders/:id/resend-otp` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:143-148`)
10. **Backend controllers:** `deliveryOrderController.resendDeliveryOtp` — server enforces 30s throttle + max 3 resends
11. **Models:** Order
12. **Socket events:** **emit** `order:otpResent` to `user_${customerId}` (P1-14: never listened-for)
13. **RTK tags:** none in API; mobile updates timer locally
14. **Offline:** —
15. **Replay:** —
16. **Notification:** SMS + email re-sent
17. **Background task:** —
18. **AsyncStorage:** mobile may track resend count locally `[NOT VERIFIED — server is source of truth via Order.deliveryOtpResendCount]`
19. **State transitions:** OTP: `generated → resent`; `deliveryOtpResendCount++`
20. **Success path:** POST 200 → response includes `otpExpiresAt` + `otpSentTo` → mobile updates UI timer
21. **Failure path:** 429 throttled → toast "wait Xs"; 400 max-reached → disable resend button
22. **Retry:** —
23. **Reconnect:** —
24. **App-kill recovery:** server count persists
25. **Polling fallback:** —
26. **Idempotency:** server enforced
27. **Cache invalidation:** none
28. **Optimistic update:** —
29. **Security:** same as DEL-16 + throttle
30. **Final state:** OTP fields refreshed; resendCount incremented
31. **Known bugs:** P1-14 (customer doesn't receive in-app indicator)
32. **Broken states:** —
33. **Stale-state risks:** —
34. **Missing listeners:** customer-side `order:otpResent`
35. **Missing invalidations:** —
36. **Runtime risks:** —
37. **Launch risk severity:** P2
38. **Recommended fix:** P1-14 — wire customer mobile listener OR remove the unused emit
39. **Safe pre-launch?** yes
40. **Coordination:** mobile + backend

---

## DEL-18 — Verify delivery OTP → DELIVERED

1. **ID:** DEL-18
2. **Name:** Verify customer-provided OTP, complete delivery
3. **Role:** delivery
4. **Entry:** OTP entry sheet
5. **Trigger:** rider enters 4-6 digit OTP and submits
6. **Screens:** DeliveryHomeTab OTP sheet
7. **Hooks:** `useActionGuard`, `useActionFeedback` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/delivery/useActionFeedback.ts`)
8. **Services:** —
9. **APIs:** `verifyDeliveryOtp` mutation `POST /delivery/orders/:id/verify-otp { otp, idempotencyKey }` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:72-80`); invalidates `['DeliveryOrders','Earnings']` (per recent fix)
10. **Backend controllers:** `deliveryOrderController.verifyDeliveryOtp` → calls `orderStateService.transition({to: DELIVERED, meta: { otp }})` which performs OTP guard at `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/orders/services/orderStateService.ts:286-323`
11. **Models:** Order, DeliveryEarning, DeliveryBoy, OrderEvent, Route, Notification
12. **Socket events:** outbox publishes `OrderDelivered`; PushNotificationService.sendToUser (customer); inline emits `order_delivered` to `admin_room` + `user_${customerId}`; `delivery:earning:credited` to `delivery:${riderUserId}`
13. **RTK tags:** invalidates `['DeliveryOrders','Earnings']`
14. **Offline:** **NOT queueable** — final delivery requires server confirmation
15. **Replay:** —
16. **Notification:** customer push "Order Delivered 🎉" (`orderStateService.ts:609-613`); rider push for earning credit; in-app Notification with deepLink `/delivery/earnings`
17. **Background task:** —
18. **AsyncStorage:** —
19. **State transitions:** Order: `IN_TRANSIT → DELIVERED`; Earnings: `none → credited` (atomic via duplicate-key idempotency); DeliveryBoy.assignedOrders pull, currentLoad-1 `[NOT FULLY VERIFIED — confirm in verifyDeliveryOtp controller]`; Route: `updateRouteAfterOrderStatusChange` (verify)
20. **Success path:** OTP submit → server validates (expiry/issued-to/match) → transition → earning created (idempotent) → DeliveryBoy.earnings $inc → push + socket → mobile receives 200 → cache invalidated → UI shows "Delivered"
21. **Failure path:** wrong OTP (`OtpVerificationError`) → 403, mobile shows error; expired (5 min) → resend; mismatched issuer → 403
22. **Retry:** rider re-enters OTP; idempotency-key prevents double-credit if same OTP retried
23. **Reconnect:** —
24. **App-kill recovery:** server is source of truth; on relaunch order shows DELIVERED
25. **Polling fallback:** —
26. **Idempotency:** **TWO LAYERS**: (a) state machine (DELIVERED is terminal — re-verify is no-op since `fromCanonical === to` returns updatedOrder unchanged at `orderStateService.ts:248-251`); (b) DeliveryEarning unique `(orderId, deliveryBoyId)` index catches duplicate-key
27. **Cache invalidation:** `['DeliveryOrders','Earnings']`
28. **Optimistic update:** none (high-stakes — wait for server)
29. **Security:** OTP must be valid + not expired + issued to this rider; rider must be assigned; status must be IN_TRANSIT
30. **Final state:** DELIVERED order; DeliveryEarning row; updated DeliveryBoy.earnings; outbox event; push sent
31. **Known bugs:** P0-1 family if any consumer relies on socket-only updates of this status
32. **Broken states:** —
33. **Stale-state risks:** customer order tracking screen may not reflect DELIVERED via socket due to P0-2 (room mismatch); push notification compensates
34. **Missing listeners:** customer tracking screen `order:status:changed` mismatch (P0-2)
35. **Missing invalidations:** —
36. **Runtime risks:** if `createDeliveryEarning` fails after transition, rider doesn't get earning but order is DELIVERED — needs reconciliation; current code wraps in try/catch and logs but does not retry `[VERIFY in verifyDeliveryOtp controller]`
37. **Launch risk severity:** P1
38. **Recommended fix:** wrap earning credit in retry/queue; ensure customer tracking gets notified (P0-2)
39. **Safe pre-launch?** earnings retry: yes; tracking fix: yes
40. **Coordination:** backend + mobile

---

## DEL-19 — Earnings credit (atomic with delivery)

1. **ID:** DEL-19
2. **Name:** Persist DeliveryEarning row + bump DeliveryBoy.earnings
3. **Role:** delivery (server-side action triggered by DEL-18)
4. **Entry:** `deliveryOrderController.verifyDeliveryOtp` after `orderStateService.transition` succeeds
5. **Trigger:** order DELIVERED transition completed
6. **Screens:** —
7. **Hooks:** —
8. **Services:** `services/createDeliveryEarning` (or inline) `[exact path NOT VERIFIED]`
9. **APIs:** —
10. **Backend controllers:** verifyDeliveryOtp
11. **Models:** **DeliveryEarning** (unique index `(orderId, deliveryBoyId)`), DeliveryBoy
12. **Socket events:** **emit** `delivery:earning:credited` to `delivery:${riderUserId}` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/domains/operations/controllers/deliveryOrderController.ts` — verified via grep in prior session)
13. **RTK tags (mobile receiver side):** mobile `useDeliverySocket` invalidates `['Earnings','DeliveryOrders']` on this event
14. **Offline:** —
15. **Replay:** —
16. **Notification:** push to rider "Earning credited"; in-app Notification with deepLink `/delivery/earnings`
17. **Background task:** —
18. **AsyncStorage:** —
19. **State transitions:** Earnings: none → credited
20. **Success path:** create row → catch dup-key → if dup, return existing → emit socket → push → continue
21. **Failure path:** unique-key catch returns existing earning, treats as success (idempotent); other errors logged but do not roll back DELIVERED transition
22. **Retry:** none (idempotent design — safe to retry but not done)
23. **Reconnect:** if mobile missed socket, reconnect refresh `Earnings` (P1-6: this is currently NOT done unless outage > 60s)
24. **App-kill recovery:** earnings persisted server-side; mobile fetches on tab open
25. **Polling fallback:** —
26. **Idempotency:** **STRONG** — unique compound index
27. **Cache invalidation:** mobile invalidates Earnings on socket event AND on mutation invalidate tag
28. **Optimistic update:** —
29. **Security:** server-side only
30. **Final state:** DeliveryEarning row + DeliveryBoy.earnings incremented
31. **Known bugs:** P1-6 (earnings not refreshed on partial outage reconnect)
32. **Broken states:** —
33. **Stale-state risks:** rider's earnings tab may show old value if rider was disconnected at moment of credit and outage was 5-60s
34. **Missing listeners:** —
35. **Missing invalidations:** invalidate `['Earnings']` on every reconnect
36. **Runtime risks:** if DELIVERED transition succeeds but DeliveryEarning create throws non-dup error, earning is lost (logged but not retried)
37. **Launch risk severity:** P1
38. **Recommended fix:** wrap createDeliveryEarning in retry/outbox pattern; add reconnect Earnings invalidation
39. **Safe pre-launch?** yes
40. **Coordination:** backend (retry) + mobile (reconnect refresh)

---

## DEL-20 — Earnings tab refresh

GET `/delivery/earnings` provides `['Earnings']` tag. Refreshed by: mutation invalidations, socket event `delivery:earning:credited`, manual pull-to-refresh. **Risk:** see P1-6.

---

## DEL-21 — Failed delivery (reason capture)

1. **ID:** DEL-21
2. **Name:** Record a failed delivery attempt
3. **Role:** delivery
4. **Entry:** "Mark Failed" / failure reason sheet (typically when customer unreachable, address wrong, etc.)
5. **Trigger:** rider selects failure reason
6. **Screens:** DeliveryHomeTab failure sheet
7. **Hooks:** `useActionGuard`
8. **Services:** `DeliveryFailureService` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/services/deliveryFailureService.ts:38-162`)
9. **APIs:** `recordDeliveryAttempt` mutation `POST /delivery/orders/:id/attempt { status: 'FAILED', failureReason, failureNotes }` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryApi.ts:83-92`)
10. **Backend controllers:** `domains/operations/controllers/deliveryOrderController.ts:285-310` (recordDeliveryAttempt)
11. **Models:** Order, DeliveryAttempt (or embedded)
12. **Socket events:** customer push fires from outbox; inline socket emits `[NOT VERIFIED]`
13. **RTK tags:** invalidates `['DeliveryOrders']`
14. **Offline:** queueable
15. **Replay:** yes; precondition check: status must be IN_TRANSIT
16. **Notification:** customer push "Delivery Failed ❌" (`orderStateService.ts:629-633`)
17. **Background task:** —
18. **AsyncStorage:** queue
19. **State transitions:** depends on attempt count: <MAX → status stays IN_TRANSIT, attempts++; ≥MAX → state → FAILED, finalStatus=FAILED, auto-reassign attempted (DEL-22), or finalStatus=FAILED_PERMANENT
20. **Success path:** POST 200 → response includes new attempts count → mobile cache patch + UI shows attempt counter
21. **Failure path:** —
22. **Retry:** cooldown enforced server-side (`deliveryFailureService.ts:57-69` `RETRY_COOLDOWN_MS`)
23. **Reconnect:** —
24. **App-kill recovery:** server is source of truth
25. **Polling fallback:** —
26. **Idempotency:** idempotency-key
27. **Cache invalidation:** `['DeliveryOrders']`
28. **Optimistic update:** —
29. **Security:** rider assigned + status IN_TRANSIT
30. **Final state:** Order.deliveryAttempts incremented OR Order=FAILED, finalStatus set
31. **Known bugs:** P2-10 (`failureReasons` push uses `as any`, schema may not have field), P2-11 (race window between $set and orderStateService.transition)
32. **Broken states:** if max-attempts logic fires but auto-reassign fails to find rider → finalStatus=FAILED_PERMANENT, manual admin intervention required
33. **Stale-state risks:** mobile attempt counter may diverge from server; `useAttemptTracker.mergeServerAttempt` reconciles
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** small race window in failure service (P2-11)
37. **Launch risk severity:** P2
38. **Recommended fix:** verify schema has `failureReasons` array; tighten transaction in failure service
39. **Safe pre-launch?** yes
40. **Coordination:** backend

---

## DEL-22 — Auto-reassign on max attempts

Backend-only sub-flow inside `DeliveryFailureService.autoReassign` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/services/deliveryFailureService.ts:169-260`).
- **Trigger:** DEL-21 reaches MAX_DELIVERY_ATTEMPTS
- **Logic:** find available riders (excluding all previous), score by distance + load, assign best
- **Models:** DeliveryBoy, Order
- **Socket events:** new rider gets `order:assigned` via `orderStateService.transition`
- **Failure:** no rider available → `Order.finalStatus = FAILED_PERMANENT`
- **Risks:** transactionless mix of writes (`Order.updateOne`, `DeliveryBoy.updateOne`, then `transition`); a crash mid-flight can leave inconsistent state. Manual reconciliation required.
- **Severity:** P2

---

## DEL-23 — Route order removal (admin cancels mid-route)

1. **ID:** DEL-23
2. **Name:** Order removed from rider's active route
3. **Role:** delivery (passive recipient)
4. **Entry:** admin cancels order or reassigns
5. **Trigger:** admin action → backend updates Route → emits `route:order:removed` to rider via `routeCancellationHandler`
6. **Backend controllers:** `services/routeCancellationHandler.ts:179-180`
7. **Socket events:** **BROKEN — P1-12**: handler reads `(socketService as any).io` but socketService is disabled (commented out in `index.ts:319`) → `io` is undefined → early return logs "Socket IO not initialized" and rider gets nothing
8. **Recommended fix:** P1-12 — read io from `app.get('io')` or pass it in
9. **Severity:** P1

---

## DEL-24 — Route completion

When all orders in a route are DELIVERED/FAILED, backend marks Route.status='completed'. Mobile `useGetCurrentRouteQuery` returns null → `useDeliveryLocation` effect calls `stopTracking` (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/useDeliveryLocation.ts:171-173`). **Verify** backend transition logic for Route status (NOT TRACED).

---

## DEL-25 — Live location tracking start

See `07_BACKGROUND_LOCATION.md` (separate file). Summary: `useDeliveryLocation` registers `LOCATION_TASK_NAME` via `expo-task-manager`, starts foreground service notification, persists `activeRouteId` in storage.

---

## DEL-26 — Location heartbeat send (every 3s/20m)

`backgroundLocationTask` callback fires per location update (`@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/tasks/backgroundLocationTask.ts:12-100`):
- Filters: mocked, accuracy>50m, flood (1/2s)
- Reads `accessToken` + `activeRouteId` from SecureStore
- POST `PUT /delivery/location` (raw axios, NOT RTK — bypasses interceptors)
- 422 → stops task + clears activeRouteId
- Other errors → `offlineQueue.enqueue('LOCATION_UPDATE', payload)`

**Bugs:** P1-10 (no 401 token refresh in raw axios), see audit.

---

## DEL-27 — Location stop on route end

`useDeliveryLocation` effect detects `routeId === null` → `stopTracking` → `Location.stopLocationUpdatesAsync` + clear `activeRouteId`. Foreground service notification dismissed.

---

## DEL-28 — App background with active route

OS keeps task alive due to foreground service notification (Android) / background mode (iOS — depends on entitlements). Updates continue. **Risk:** OEM-specific battery optimizations may kill task — common on MIUI/OPPO/realme.

---

## DEL-29 — App killed → recovery on relaunch

**P1-8** — see DEL-2. Currently: useDeliveryLocation effect runs only after auth + getCurrentRoute resolve. No proactive `Location.hasStartedLocationUpdatesAsync` check at app boot. If task was killed by OS, location silently stops.

---

## DEL-30 — Reconnect resync (delivery socket)

See `03_SOCKET_AND_RECONNECT.md`. Summary: on reconnect, jittered `sync_request` emitted (P0-3 — silently unhandled). After 60s outage, `invalidateTags(['DeliveryOrders'])` only — Earnings missed (P1-6).

---

## DEL-31 — Offline action queue (delivery actions)

See `04_OFFLINE_REPLAY.md`. Summary: `useActionQueue` persists to `@delivery_action_queue`. FIFO replay on reconnect. Status precondition check via `VALID_TRANSITIONS`. Idempotency-key per item. 5 max retries, 2h TTL.

---

## DEL-32 — Force sync (manual button)

**NOT YET IMPLEMENTED.** Planned in hardening: a button in DeliveryHomeTab that calls `dispatch(deliveryApi.util.invalidateTags(['DeliveryOrders','Earnings']))` + replays queue.

---

## DEL-33 — Logout

1. **ID:** DEL-33
2. **Name:** Rider logout (manual)
3. **Role:** delivery
4. **Entry:** DeliveryMoreTab or DeliveryProfileScreen
5. **Trigger:** Logout button
6. **Screens:** DeliveryMoreTab → confirmation
7. **Hooks:** `[NOT VERIFIED — likely auth slice action]`
8. **Services:** —
9. **APIs:** logout endpoint `[NOT VERIFIED]`
10. **Backend controllers:** auth — invalidates refresh token
11. **Models:** User (push tokens cleared on logout?)
12. **Socket events:** socket.disconnect()
13. **RTK tags:** `baseApi.util.resetApiState()` on logout `[NOT VERIFIED]`
14. **Offline:** logout local-only if offline
15. **Replay:** queue should be **CLEARED** on logout to avoid replaying as new user (verify)
16. **Notification:** push token unregistered server-side `[NOT VERIFIED]`
17. **Background task:** **MUST stop** location task; clear `activeRouteId` in storage
18. **AsyncStorage:** clear `accessToken`, `refreshToken`, `@delivery_action_queue`, `@delivery_socket_last_event_ts`, `activeRouteId`, all DELIVERY_RESET_KEYS in `DeliveryHomeTab.tsx:129-136`
19. **State transitions:** auth: authenticated → unauthenticated
20. **Success path:** clear all state → reset RTK → navigate to login
21. **Failure path:** —
22. **Retry:** —
23. **Reconnect:** —
24. **App-kill recovery:** —
25. **Polling fallback:** —
26. **Idempotency:** —
27. **Cache invalidation:** full reset
28. **Optimistic update:** —
29. **Security:** must invalidate tokens server-side
30. **Final state:** unauthenticated, all storage cleared
31. **Known bugs:** P2-7 (`@delivery_socket_last_event_ts` not in DELIVERY_RESET_KEYS — leaks across logins)
32. **Broken states:** background location task may persist if not explicitly stopped
33. **Stale-state risks:** push token may remain on server pointing to old userId
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** action queue with old idempotency-keys could replay against new user's session
37. **Launch risk severity:** P1
38. **Recommended fix:** add explicit logout sequence: `Location.stopLocationUpdatesAsync` → clear all DELIVERY_RESET_KEYS + `@delivery_socket_last_event_ts` → unregister push token → `socketClient.disconnect()` → `baseApi.util.resetApiState()` → navigate
39. **Safe pre-launch?** yes
40. **Coordination:** mobile + backend (push token cleanup)

---

# DELIVERY DOMAIN RISK MATRIX

| Workflow | Severity | Bugs | Pre-launch fix? |
|---|---|---|---|
| DEL-1 Login | none | — | — |
| DEL-2 Session restore | P1 | P1-8, P1-12 | ✅ |
| DEL-3 Push token | P1 | P1-11 | ✅ |
| DEL-4 Online toggle | P2 | missing invalidate | ✅ |
| DEL-5 Orders load | P0 | P0-3, P1-6 | ✅ |
| DEL-6 Assignment recv | P1 | P1-4 | ✅ |
| DEL-7 Available orders | P3 | architecturally absent | optional |
| DEL-8 Accept | P2 | verify idempotency | ✅ |
| DEL-9 Reject | P2 | same | ✅ |
| DEL-10 View detail | P0 | inherits P0-1 | ✅ |
| DEL-11 Pickup | P1 | P1-1 dead rooms | ✅ |
| DEL-12 Start delivery | P1 | inherits | ✅ |
| DEL-13 Mark arrived | P1 | P1-3 (no version) | ✅ |
| DEL-14 COD cash | P1 | verify offline-block | ✅ |
| DEL-15 COD UPI | P1 | verify upiRef format | ✅ |
| DEL-16 Send OTP | P2 | SMS reliability | ✅ |
| DEL-17 Resend OTP | P2 | P1-14 | ✅ |
| DEL-18 Verify OTP | P1 | retry on earning fail | ✅ |
| DEL-19 Earning credit | P1 | P1-6 reconnect | ✅ |
| DEL-20 Earnings tab | P1 | inherits P1-6 | ✅ |
| DEL-21 Failed delivery | P2 | P2-10, P2-11 | ✅ |
| DEL-22 Auto-reassign | P2 | transaction gap | post-launch |
| DEL-23 Route remove | P1 | P1-12 | ✅ |
| DEL-24 Route complete | P3 | not traced | optional |
| DEL-25–28 Location | P1 | P1-8, P1-9, P1-10 | ✅ |
| DEL-29 App-kill recovery | P1 | P1-8 | ✅ |
| DEL-30 Reconnect | P0 | P0-3 | ✅ |
| DEL-31 Offline queue | P2 | dual queue systems | post-launch |
| DEL-32 Force sync | feature | not implemented | optional |
| DEL-33 Logout | P1 | P2-7, push cleanup | ✅ |

# DEPENDENCY GRAPH (delivery domain)

```
DEL-1 Login
  └─→ DEL-3 Push token register
  └─→ DEL-2 (next launch: session restore)
        └─→ socketClient connect (uses token)
        └─→ getDeliveryProfile, getDeliveryOrders
        └─→ if isOnDuty + activeRouteId: DEL-25 location start

DEL-4 Online toggle ──→ (optionally) starts DEL-25
DEL-5 Orders load ←── DEL-6 socket assignment ←── ADM-* admin assigns
DEL-6 Assignment ──→ DEL-10 View detail
       └─→ DEL-11 Pickup ──→ DEL-12 Start delivery ──→ DEL-13 Mark arrived
                                                      └─→ DEL-14/15 COD
                                                            └─→ DEL-16 Send OTP
                                                                  └─→ DEL-17 Resend (loop)
                                                                  └─→ DEL-18 Verify
                                                                        ├─→ DEL-19 Earning credit
                                                                        ├─→ DEL-20 Earnings refresh
                                                                        └─→ DEL-24 Route complete (if last order)
       └─→ DEL-21 Failed delivery ──→ (if max) DEL-22 Auto-reassign
                                            └─→ new rider DEL-6

DEL-23 Route remove ←── ADM-* admin cancels
DEL-25–28 Location lifecycle ←─ DEL-4, DEL-5
DEL-29 App-kill recovery ←─ DEL-2
DEL-30 Reconnect ←── socket disconnect/reconnect
DEL-31 Offline queue ←── any DEL-8/9/11/12/13/21 mutation while offline
DEL-33 Logout ←── manual; clears all DEL-* state
```

# KNOWN GAPS IN THIS FILE

The following items in this catalog are marked `[NOT VERIFIED]` and would need additional code reads to fully ground:

- DEL-1: exact rider login screen names + auth/identity controller path
- DEL-3: usePushNotifications hook location, exact push register endpoint
- DEL-4: backend `/delivery/status` controller, role middleware
- DEL-5: getDeliveryOrders + getCurrentRoute controller filter logic
- DEL-7: whether self-pickup flow exists at all
- DEL-8: idempotency-key middleware on accept route
- DEL-13: server emit on markArrived (might be inline only — verified in audit)
- DEL-14: confirm mobile blocks COD-cash offline-queue
- DEL-15: server-side upiRef validation
- DEL-16: SMS provider failover behavior
- DEL-18: earning-credit retry/outbox pattern (currently absent)
- DEL-22: full auto-reassign transaction boundaries
- DEL-24: backend Route.status completion logic
- DEL-33: push token cleanup on logout

These will be resolved in future passes.

