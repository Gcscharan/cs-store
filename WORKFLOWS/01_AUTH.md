# AUTH WORKFLOW CATALOG

**Domain:** authentication, session, token lifecycle, role resolution.
**Authority:** code-grounded with `file:line` citations.

## File-by-file ownership

| Surface | File | Role |
|---|---|---|
| Auth slice | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/store/slices/authSlice.ts:1-67` | `status` (LOADING / UNAUTHENTICATED / GOOGLE_AUTH_ONLY / ACTIVE), `user`, `accessToken`, `refreshToken` |
| Bootstrap | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/hooks/useAuthBootstrap.ts:1-77` | runs on app launch; checks SecureStore for token; calls `/auth/me`; sets ACTIVE/UNAUTHENTICATED |
| 401 reauth | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/baseApi.ts:55-111` | RTK Query baseQueryWithReauth — refresh on 401, retry once, logout on failure |
| Customer auth API | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/authApi.ts:1-108` | sendOtp, verifyOtp, getProfile, updateProfile, checkPhone, verifyOnboardingOtp, completeOnboarding, signup, refreshToken, logout |
| Delivery auth API | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/api/deliveryAuthApi.ts:1-54` | deliveryLogin (email+password), deliverySignup |
| Customer login screen | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/screens/auth/LoginScreen.tsx` | phone+OTP entry → verifyOtp → set tokens |
| Customer OTP screen | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/screens/auth/OTPScreen.tsx:69-127` | auto-submit on 6 digits; signup or verifyOtp; setTokens/setUser/setStatus('ACTIVE') |
| Customer onboarding | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/screens/auth/OnboardingScreen.tsx:110-131` | new-user flow: name + phone + verify → completeOnboarding |
| Delivery login screen | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/screens/auth/DeliveryLoginScreen.tsx:30-70` | email+password → deliveryLogin → SecureStore.setItem tokens → setStatus('ACTIVE') |
| SocketClient token refresh | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/services/socketClient.ts:209-231` | on `connect_error` containing 'authentication'/'token'/'exp' → POST /auth/refresh → reconnectWithNewToken |
| Storage utility | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/apps/customer-app/src/utils/storage.ts:1-37` | SecureStore on iOS/Android, AsyncStorage on web |
| Backend socket auth | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/index.ts:282-316` | best-effort JWT verify in io.use; sets socket.data.userId/role |
| Backend HTTP auth | `@/Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend/src/middleware/auth.ts` | authenticateToken middleware `[partially traced]` |

## Auth state machine

```
LOADING → UNAUTHENTICATED              (bootstrap completes with no token)
LOADING → ACTIVE                        (bootstrap completes with valid token + /auth/me 200)
UNAUTHENTICATED → ACTIVE                (login flow success)
ACTIVE → UNAUTHENTICATED                (logout OR 401 reauth fails)
ACTIVE → ACTIVE                         (token refreshed silently on 401)
LOADING → UNAUTHENTICATED               (bootstrap error / token reject)
GOOGLE_AUTH_ONLY                        (legacy state; see authSlice.ts:5; no current path observed setting it)
```

## SecureStore / AsyncStorage keys (auth domain)

- `accessToken` — SecureStore on native, AsyncStorage on web
- `refreshToken` — same
- (No `userId`, `userRole` separately persisted — derived from `/auth/me` response on bootstrap)

---

## AUTH-1 — Customer phone+OTP login (existing user)

1. **ID:** AUTH-1
2. **Name:** Customer login (phone + 6-digit OTP)
3. **User Role:** customer
4. **Entry Point:** `LoginScreen.tsx`
5. **Trigger:** user enters phone, taps "Get OTP"
6. **Screens involved:** LoginScreen → OTPScreen
7. **Hooks involved:** `useSendOtpMutation`, `useVerifyOtpMutation`, `useSignupMutation`
8. **Services involved:** none (RTK only)
9. **APIs involved:** `POST /auth/send-otp`, `POST /auth/verify-otp` (`authApi.ts:11-26`)
10. **Backend controllers involved:** `auth` controller `[NOT VERIFIED — exact path]`
11. **Models involved:** `User`, OTP store (likely Mongo / Redis) `[NOT VERIFIED]`
12. **Socket events involved:** none during login. Socket connects after token set.
13. **RTK cache tags:** `verifyOtp` invalidates `['Profile']` (`authApi.ts:25`)
14. **Offline queue involvement:** none — login requires network
15. **Replay involvement:** none
16. **Notification involvement:** OTP delivered via SMS server-side
17. **Background task involvement:** none
18. **AsyncStorage / SecureStore:** stores `accessToken`, `refreshToken` via `SecureStore.setItemAsync` (`LoginScreen.tsx:115-118`) — **NOTE inconsistency**: LoginScreen uses raw `SecureStore` directly, not the `storage` util
19. **State transitions:** `auth.status: UNAUTHENTICATED → ACTIVE`; `auth.user`, `auth.accessToken`, `auth.refreshToken` set
20. **Success path:** sendOtp → backend SMS → user enters OTP → verifyOtp returns `AuthResponse` → SecureStore tokens → dispatch setTokens/setUser/setStatus('ACTIVE') → navigation re-renders to authenticated stack
21. **Failure path:** invalid OTP → 4xx → vibration + alert + clear OTP field (`OTPScreen.tsx:120-126`); SMS not received → user taps Resend `[NOT VERIFIED — resend path on customer screen]`
22. **Retry path:** manual re-enter; resend OTP if available
23. **Reconnect path:** N/A
24. **App-kill recovery path:** if token persisted, AUTH-3 restores
25. **Polling fallback path:** N/A
26. **Idempotency strategy:** server consumes OTP single-use
27. **Cache invalidation path:** `['Profile']` invalidated; downstream queries refetch
28. **Optimistic update path:** none
29. **Security/auth validation:** OTP TTL server-side; JWT signed with `JWT_SECRET`
30. **Final persisted state:** SecureStore has tokens; auth slice ACTIVE
31. **Known bugs:** **AUTH-BUG-1**: `LoginScreen.tsx:115-118` uses `SecureStore.setItemAsync` directly, bypassing `storage.ts` abstraction → on web, tokens not stored (web uses AsyncStorage). May or may not be intentional. `OTPScreen.tsx:114-117` uses `dispatch(setTokens(...))` but does **NOT** call `storage.setItem` → if app is killed before next bootstrap, tokens lost on web. **Inconsistency between LoginScreen and OTPScreen.** OTPScreen relies on rehydration via `redux-persist` (if any) or assumes session re-login.
32. **Broken states:** logging in via OTPScreen on a fresh install → tokens NOT in SecureStore → next launch → bootstrap finds no token → forced re-login. **Verify** redux-persist setup `[NOT VERIFIED]`.
33. **Stale-state risks:** if redux-persist is not active for `auth` slice, tokens are memory-only after OTPScreen path
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** AUTH-BUG-1 — token persistence inconsistency
37. **Launch risk severity:** **P1** (potentially P0 if redux-persist not configured)
38. **Recommended fix:** in `OTPScreen.tsx` after `verifyOtp`/`signup` success, also call `await storage.setItem('accessToken', ...)` and `await storage.setItem('refreshToken', ...)`. Make consistent with `LoginScreen.tsx` and `DeliveryLoginScreen.tsx`.
39. **Safe pre-launch?** yes (mobile-only, single file)
40. **Coordination:** mobile only

---

## AUTH-2 — Customer phone+OTP signup (new user)

1. **ID:** AUTH-2
2. **Name:** Customer signup (new phone)
3. **Role:** customer (prospective)
4. **Entry:** LoginScreen → verifyOtp returns `{ requiresOnboarding: true, phone }` (`LoginScreen.tsx:106-110`); OR direct OTPScreen with `isSignup` flag
5. **Trigger:** new phone number
6. **Screens:** LoginScreen → OnboardingScreen → OTPScreen (signup variant)
7. **Hooks:** `useSendOtpMutation`, `useVerifyOnboardingOtpMutation`, `useCompleteOnboardingMutation`, `useSignupMutation`
8. **Services:** —
9. **APIs:** `POST /auth/send-otp`, `POST /auth/verify-otp` (or `verify-onboarding-otp`), `POST /auth/complete-onboarding` (`authApi.ts:53-77`), `POST /auth/signup` (`authApi.ts:70-77`)
10. **Backend controllers:** auth controller (verify-otp, complete-onboarding, signup) `[NOT VERIFIED]`
11. **Models:** User
12. **Socket events:** none
13. **RTK tags:** `completeOnboarding` and `signup` invalidate `['Profile']`
14. **Offline:** none
15. **Replay:** none
16. **Notification:** SMS for OTP
17. **Background task:** none
18. **AsyncStorage:** tokens stored via `dispatch(setTokens(...))` — **same risk as AUTH-BUG-1** — does not persist to SecureStore in `OnboardingScreen.tsx:122-127`
19. **State transitions:** `UNAUTHENTICATED → ACTIVE`
20. **Success path:** OTP sent → verify-onboarding-otp → enter name → completeOnboarding returns AuthResponse → setTokens/setUser/setStatus
21. **Failure path:** name validation, OTP failure, network errors
22. **Retry:** resend OTP, re-enter name
23. **Reconnect:** N/A
24. **App-kill recovery:** AUTH-3 (if tokens persisted)
25. **Polling fallback:** N/A
26. **Idempotency:** OTP single-use
27. **Cache invalidation:** `['Profile']`
28. **Optimistic update:** none
29. **Security:** OTP + signed JWT
30. **Final persisted state:** auth ACTIVE
31. **Known bugs:** **AUTH-BUG-1** propagates to onboarding path
32. **Broken states:** same as AUTH-1
33. **Stale-state risks:** same
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** same as AUTH-1
37. **Launch risk severity:** P1
38. **Recommended fix:** add `storage.setItem` calls after dispatch in OnboardingScreen and OTPScreen
39. **Safe pre-launch?** yes
40. **Coordination:** mobile only

---

## AUTH-3 — Session restore (app launch, all roles)

1. **ID:** AUTH-3
2. **Name:** Bootstrap session from persisted token
3. **Role:** all (customer, delivery, admin)
4. **Entry:** RootNavigator mounts `useAuthBootstrap` (`useAuthBootstrap.ts:8-76`)
5. **Trigger:** app launch
6. **Screens:** SplashScreen → role-appropriate home
7. **Hooks:** `useAuthBootstrap`
8. **Services:** `storage`, raw `fetch` to `/auth/me`
9. **APIs:** `GET /auth/me` directly via fetch (NOT RTK Query) — `useAuthBootstrap.ts:40-42`
10. **Backend controllers:** `auth.getProfile` `[NOT VERIFIED]`
11. **Models:** User
12. **Socket events:** post-bootstrap, sockets initialize with stored token
13. **RTK tags:** none directly; `getProfile` invalidates `['Profile']` indirectly when downstream queries fire
14. **Offline:** if offline at launch, fetch fails → tokens removed → UNAUTHENTICATED. **BUG**: this means an offline rider cannot start the app — even if they have a valid persisted token, the `/auth/me` call fails offline → bootstrap clears their token → they're forced to login again on next online launch. **AUTH-BUG-2.**
15. **Replay:** post-restore, `useOfflineQueueReplay` flushes queued actions when network online
16. **Notification:** —
17. **Background task:** **NOT auto-resumed** at launch (P1-8 from forensic audit)
18. **AsyncStorage / SecureStore:** reads `accessToken`; on failure, removes both tokens (`useAuthBootstrap.ts:51-58`)
19. **State transitions:** `LOADING → ACTIVE` or `LOADING → UNAUTHENTICATED`
20. **Success path:** read token → fetch /auth/me with Bearer → 200 with user → dispatch setTokens(accessToken, refreshToken=null) → setUser → setStatus(ACTIVE)
21. **Failure path:** no token → UNAUTHENTICATED; non-200 from /auth/me → remove tokens → UNAUTHENTICATED; network error → remove tokens → UNAUTHENTICATED **(AUTH-BUG-2)**
22. **Retry path:** none — single attempt
23. **Reconnect path:** N/A (this IS the entry to authenticated state)
24. **App-kill recovery path:** this IS the recovery path
25. **Polling fallback path:** none
26. **Idempotency:** /auth/me is idempotent
27. **Cache invalidation:** none directly
28. **Optimistic update:** none
29. **Security/auth validation:** server validates JWT signature + expiry on /auth/me
30. **Final persisted state:** auth slice rehydrated
31. **Known bugs:** **AUTH-BUG-2** (offline launch wipes tokens), **AUTH-BUG-3**: `dispatch(setTokens({ accessToken, refreshToken: null }))` at `useAuthBootstrap.ts:47` — **the refreshToken in Redux is set to null on every restart**, even if SecureStore has a valid one. This means after restart, the refresh logic in `baseApi.ts:67` reads from `storage.getItem('refreshToken')` (which still has the value) → works. But code that uses `selectRefreshToken` from auth slice would break. **Verify** no consumer reads refreshToken from auth state directly `[NOT VERIFIED]`.
32. **Broken states:** AUTH-BUG-2 — offline relaunch logs out. AUTH-BUG-3 — refreshToken null in Redux but present in SecureStore.
33. **Stale-state risks:** rider on rural network + cold start → forced re-login
34. **Missing listeners:** —
35. **Missing invalidations:** would benefit from one-shot `invalidateTags(['DeliveryOrders','Earnings','Notifications','Profile'])` after ACTIVE
36. **Runtime risks:** AUTH-BUG-2 high-impact for delivery riders in low-connectivity areas
37. **Launch risk severity:** **P1**
38. **Recommended fix (AUTH-BUG-2):** wrap fetch in try/catch — if network error (TypeError / no response), DO NOT remove tokens; set status to ACTIVE with cached user from SecureStore (or LOADING with timer). Background task can attempt re-validation later.
39. **Recommended fix (AUTH-BUG-3):** read refreshToken from SecureStore in bootstrap and dispatch full setTokens
40. **Safe pre-launch?** yes (mobile-only fixes)
41. **Coordination:** mobile only

---

## AUTH-4 — 401 token refresh (RTK Query baseQueryWithReauth)

1. **ID:** AUTH-4
2. **Name:** Silent token refresh on 401
3. **Role:** all
4. **Entry:** any RTK Query call that returns 401
5. **Trigger:** axios baseQuery returns `{ error: { status: 401 } }`
6. **Screens:** none direct
7. **Hooks:** none direct (transparent middleware)
8. **Services:** `storage`, plain `axios` for refresh call (avoids circular 401)
9. **APIs:** `POST /auth/refresh { refreshToken }` (`baseApi.ts:71-73`)
10. **Backend controllers:** `auth.refresh` `[NOT VERIFIED]`
11. **Models:** RefreshToken `[NOT VERIFIED]`
12. **Socket events:** none
13. **RTK tags:** none direct
14. **Offline:** N/A (already requires network)
15. **Replay:** original failed request retried after refresh
16. **Notification:** none
17. **Background task:** none
18. **AsyncStorage:** read+write `accessToken`, `refreshToken`
19. **State transitions:** `auth.accessToken` updated via `dispatch({ type: 'auth/setTokens', ... })` (`baseApi.ts:87`); on failure, `dispatch({ type: 'auth/logout' })`
20. **Success path:** 401 → read refreshToken from SecureStore → POST /auth/refresh → got new tokens → SecureStore + Redux update → retry original baseQuery → success
21. **Failure path:** no refreshToken → logout; refresh returns no token → logout; refresh throws → logout
22. **Retry path:** original request retried once after refresh
23. **Reconnect path:** N/A
24. **App-kill recovery path:** N/A
25. **Polling fallback path:** N/A
26. **Idempotency strategy:** refresh is single-use server-side **(should rotate refreshToken)**; if `refreshResult.data.refreshToken` returned, stored
27. **Cache invalidation path:** none
28. **Optimistic update path:** none
29. **Security/auth validation:** server validates refreshToken; rotation recommended
30. **Final persisted state:** new accessToken (and possibly new refreshToken) stored
31. **Known bugs:** **AUTH-BUG-4**: no concurrency guard — if two queries 401 simultaneously, two `/auth/refresh` calls race; second one may get rejected if backend invalidates first refreshToken on rotate. Common pattern is to use a `refreshPromise` singleton. `baseApi.ts:55-111` has none. Severity depends on whether backend rotates refresh tokens.
32. **Broken states:** racing 401s could cause spurious logout
33. **Stale-state risks:** medium under poor network with multiple parallel queries
34. **Missing listeners:** —
35. **Missing invalidations:** —
36. **Runtime risks:** AUTH-BUG-4 race condition
37. **Launch risk severity:** P2 (manageable; rare in practice)
38. **Recommended fix:** add a module-level `refreshPromise` ref so concurrent 401s share the same refresh call
39. **Safe pre-launch?** yes
40. **Coordination:** mobile only (unless backend doesn't rotate refreshTokens, in which case race is harmless)

---

## AUTH-5 — Socket connect_error → token refresh (socketClient only)

1. **ID:** AUTH-5
2. **Name:** Silent socket re-auth on token expiry
3. **Role:** all
4. **Entry:** `socketClient.setupEventHandlers` `connect_error` listener (`socketClient.ts:209-231`)
5. **Trigger:** socket connect fails with auth/token/exp error message
6. **Hooks:** none
7. **Services:** plain `axios.post` to `/auth/refresh`
8. **APIs:** `POST /auth/refresh`
9. **AsyncStorage:** refreshToken read, accessToken+refreshToken written
10. **State transitions:** none in Redux (does not dispatch setTokens — **AUTH-BUG-5**)
11. **Success path:** error msg matches → read refreshToken → refresh → store new tokens → `reconnectWithNewToken()` → re-emits join_room
12. **Failure path:** logEvent('socket_token_refresh_failed') → `socket.disconnect()`
13. **Known bugs:** **AUTH-BUG-5** — does NOT update Redux auth slice. Subsequent RTK Query calls will use the old token from `auth.accessToken` until they 401 and trigger AUTH-4. Inconsistent state between sockets and HTTP.
14. **Recommended fix:** also `dispatch({ type: 'auth/setTokens', payload: { accessToken, refreshToken } })`
15. **Severity:** P2
16. **Coordination:** mobile only

---

## AUTH-6 — Delivery rider login (email + password)

1. **ID:** AUTH-6
2. **Name:** Rider login
3. **Role:** delivery
4. **Entry:** `DeliveryLoginScreen.tsx`
5. **Trigger:** rider enters email+password and taps Login
6. **Screens:** DeliveryLoginScreen → DeliveryDashboardScreen
7. **Hooks:** `useDeliveryLoginMutation`
8. **APIs:** `POST /delivery/auth/login { email, password }` (`deliveryAuthApi.ts:38-44`)
9. **Backend controllers:** `delivery/auth` controller `[NOT VERIFIED]`
10. **Models:** User (role=delivery), DeliveryBoy
11. **Socket events:** post-login, useDeliverySocket connects (SOCK-2)
12. **AsyncStorage:** `storage.setItem('accessToken', ...)`, `storage.setItem('refreshToken', ...)` (`DeliveryLoginScreen.tsx:45-46`) — **uses storage util correctly, unlike LoginScreen**
13. **State transitions:** `UNAUTHENTICATED → ACTIVE`; user has `role: 'delivery'`
14. **Success path:** login 200 → tokens persisted via storage util → setUser/setTokens/setStatus('ACTIVE') → navigate
15. **Failure path:** server returns `{ status: 'pending' }` → "awaiting admin approval" alert; `{ status: 'suspended' }` → contact support; else → "Invalid email or password"
16. **Retry path:** manual re-enter
17. **Reconnect path:** N/A
18. **App-kill recovery path:** AUTH-3 restores via /auth/me
19. **Polling fallback path:** N/A
20. **Idempotency:** N/A
21. **Cache invalidation:** none declared in `deliveryLogin` mutation — **AUTH-BUG-6**: should invalidate `['Profile']` to ensure profile cache is fresh post-login
22. **Optimistic update:** none
23. **Security:** password hashed server-side; JWT issued
24. **Final persisted state:** ACTIVE rider session
25. **Known bugs:** AUTH-BUG-6 (minor — missing invalidate)
26. **Broken states:** —
27. **Stale-state risks:** —
28. **Missing listeners:** —
29. **Missing invalidations:** `['Profile']` on deliveryLogin
30. **Runtime risks:** —
31. **Launch risk severity:** P3
32. **Recommended fix:** add `invalidatesTags: ['Profile']` to `deliveryLogin`
33. **Safe pre-launch?** yes
34. **Coordination:** mobile only
35–40. (no further entries — minor workflow)

---

## AUTH-7 — Delivery rider signup (KYC pending)

1. **ID:** AUTH-7
2. **Name:** Rider signup (request approval)
3. **Role:** prospective delivery
4. **Entry:** delivery signup screen `[NOT VERIFIED — likely DeliverySignupScreen — search shows DeliveryKYCScreen.tsx]`
5. **Trigger:** new rider applies
6. **APIs:** `POST /delivery/auth/signup { name, email, phone, password, vehicleType }` (`deliveryAuthApi.ts:46-52`)
7. **Backend controllers:** delivery auth signup; creates User+DeliveryBoy with status=pending
8. **Success path:** 200 → "awaiting admin approval" message; user cannot login until approved
9. **State machine:** DeliveryBoy.status: pending → approved (admin) → suspended (admin)
10. **Known bugs:** **VERIFY** that KYC selfie + KYC documents (DeliveryKYCScreen, DeliverySelfieScreen) are linked to this signup
11. **Severity:** P2 (KYC integration)
12. **Coordination:** mobile + backend + admin web

---

## AUTH-8 — Logout (all roles)

1. **ID:** AUTH-8
2. **Name:** Manual logout
3. **Role:** all
4. **Entry:** Profile/Settings/More screens
5. **Trigger:** user taps Logout
6. **Hooks:** `useLogoutMutation`
7. **APIs:** `POST /auth/logout` (`authApi.ts:87-93`); invalidates `['Profile','Cart','Orders','Addresses']`
8. **Backend controllers:** `auth.logout` — likely invalidates refresh token server-side
9. **Models:** RefreshToken `[NOT VERIFIED]`
10. **Socket events:** socket should disconnect
11. **AsyncStorage:** must clear `accessToken`, `refreshToken`, `activeRouteId`, `@delivery_action_queue`, `@delivery_socket_last_event_ts`, `@vyaparsetu_offline_queue`, `delivery_offline_queue`, all DELIVERY_RESET_KEYS
12. **State transitions:** auth: ACTIVE → UNAUTHENTICATED via `dispatch(logout())`
13. **Success path:** server invalidates → clear local state → reset RTK → navigate to auth stack
14. **Failure path:** if logout API fails (offline), still clear local state — logout should be local-first
15. **Retry path:** N/A
16. **App-kill recovery:** logout completed locally regardless
17. **Background task:** **MUST stop** location task and clear activeRouteId
18. **Idempotency:** —
19. **Cache invalidation:** the 4 tags listed; should also `baseApi.util.resetApiState()` for clean slate
20. **Optimistic update:** none
21. **Security:** must invalidate refreshToken server-side
22. **Final persisted state:** UNAUTHENTICATED, all sensitive storage cleared
23. **Known bugs:** **AUTH-BUG-7**: logout flow `[NOT VERIFIED — actual logout handler implementation]`; if it does not explicitly stop background location, location task continues sending updates with old token until 401-stuck → battery drain. Cross-references DEL-33 P1 risks.
24. **Broken states:** background location continuing post-logout
25. **Stale-state risks:** push token leakage (still registered for old userId)
26. **Missing listeners:** —
27. **Missing invalidations:** push token unregister
28. **Runtime risks:** logout while offline + background location running → infinite 401 loop in background task (cross-ref P1-10)
29. **Launch risk severity:** **P1**
30. **Recommended fix:** create a `performLogout()` utility that performs in order:
    1. `Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)` (try/catch)
    2. unregister push token (best-effort POST to backend)
    3. `socketClient.disconnect()` (and any rider sockets)
    4. clear all DELIVERY_RESET_KEYS + `accessToken` + `refreshToken` + `activeRouteId` + `@delivery_socket_last_event_ts` + offline queues
    5. `dispatch(logout())`
    6. `dispatch(baseApi.util.resetApiState())`
    7. `navigation.reset()` to auth stack
31. **Safe pre-launch?** yes
32. **Coordination:** mobile + backend (push token endpoint)

---

## AUTH-9 — Push token registration (post-auth)

1. **ID:** AUTH-9
2. **Name:** Register Expo push token with backend
3. **Role:** all (active sessions)
4. **Entry:** `[NOT VERIFIED — likely a useEffect in App.tsx or RootNavigator after auth.status === 'ACTIVE']`
5. **Trigger:** auth ACTIVE
6. **Hooks:** `[NOT VERIFIED — possibly usePushNotifications]`
7. **Services:** `expo-notifications`
8. **APIs:** `[NOT VERIFIED — likely POST /auth/push-token { token, platform } or similar]`
9. **Backend controllers:** likely communication domain
10. **Models:** User.pushTokens `[NOT VERIFIED]`
11. **AsyncStorage:** push token may be cached
12. **Permissions:** `Notifications.requestPermissionsAsync()`
13. **State transitions:** none in Redux
14. **Success path:** request permission → getExpoPushTokenAsync → POST → server upserts
15. **Failure path:** permission denied → silent (no degradation handling); network failure → no retry mechanism observed
16. **Retry path:** none documented
17. **Reconnect path:** N/A
18. **App-kill recovery:** re-runs on next launch
19. **Polling fallback:** —
20. **Idempotency:** server should upsert `(userId, token)`
21. **Cache invalidation:** none
22. **Optimistic update:** —
23. **Security:** Expo project-id required
24. **Final persisted state:** push token row in User model
25. **Known bugs:** **P1-11** from forensic audit — `myOrders` push category gates rider notifications inappropriately; need `delivery` category
26. **Broken states:** rider with disabled myOrders → no notifications
27. **Stale-state risks:** push tokens not cleaned up on logout (AUTH-BUG-7 cross-reference)
28. **Missing listeners:** —
29. **Missing invalidations:** —
30. **Runtime risks:** notification leakage to old devices
31. **Launch risk severity:** P1
32. **Recommended fix:** P1-11 from audit
33. **Safe pre-launch?** yes
34. **Coordination:** mobile + backend (preference schema)

---

## AUTH-10 — Profile fetch (`/auth/me`)

1. **ID:** AUTH-10
2. **Name:** Profile fetch via `getProfile` query
3. **Role:** all
4. **Entry:** any consumer of `useGetProfileQuery` (`authApi.ts:28-34`); also raw fetch in `useAuthBootstrap.ts:40`
5. **Trigger:** components subscribing to profile
6. **APIs:** `GET /auth/me`; provides `['Profile']`
7. **Backend controllers:** `auth.getProfile`
8. **Models:** User
9. **Cache:** providesTags `['Profile']` → invalidated by login/onboarding/logout/updateProfile
10. **Severity:** none — straightforward
11. **Note:** bootstrap uses raw fetch instead of RTK — could unify for consistent caching `[improvement only]`

---

## AUTH-11 — Profile update

1. **ID:** AUTH-11
2. **APIs:** `PUT /auth/complete-profile` (`authApi.ts:36-43`); invalidates `['Profile']`
3. **State transitions:** authSlice extraReducer matches `updateProfile.matchFulfilled` → updates `state.user` (`authSlice.ts:48-54`)
4. **Severity:** none

---

## AUTH-12 — Phone existence check

1. **ID:** AUTH-12
2. **APIs:** `POST /auth/check-phone` (`authApi.ts:45-51`)
3. **Used in:** new user vs existing user branching `[NOT VERIFIED — search for callers]`
4. **Severity:** none

---

## AUTH-13 — Backend socket auth middleware (best-effort)

1. **ID:** AUTH-13
2. **Backend:** `index.ts:282-316`
3. **Behavior:** verifies JWT if present, sets `socket.data.userId/role`; **does NOT reject** missing/invalid token (calls next() without error)
4. **Risk:** anonymous sockets accepted — DDoS surface; acceptable in dev, risky in prod
5. **Severity:** P2
6. **Recommended fix:** in production environment, return error in middleware on missing token

---

## AUTH-14 — Role resolution (frontend)

1. **ID:** AUTH-14
2. **Name:** Determine user.role for navigation gating
3. **Source:** `auth.user.role` (set by AUTH-1/AUTH-6 from server response)
4. **Roles observed:** `customer`, `delivery`, `admin` (per `User` model in shared types)
5. **Consumers:** `RootNavigator` `[NOT VERIFIED]` — branches between CustomerStack / DeliveryStack / AdminStack
6. **Risks:** **AUTH-BUG-8**: `useDeliverySocket` does not check role (P0-4) — every authenticated user opens a delivery socket
7. **Severity:** P0 (cross-references SOCK-2 / P0-4)
8. **Recommended fix:** see P0-4

---

# AUTH DOMAIN RISK MATRIX

| ID | Severity | Bugs | Pre-launch fix? |
|---|---|---|---|
| AUTH-1 Customer login | P1 | AUTH-BUG-1 (token persistence inconsistency) | ✅ |
| AUTH-2 Customer signup | P1 | AUTH-BUG-1 | ✅ |
| AUTH-3 Session restore | P1 | AUTH-BUG-2 (offline wipes), AUTH-BUG-3 (refreshToken null in Redux) | ✅ |
| AUTH-4 401 reauth | P2 | AUTH-BUG-4 (no concurrency guard) | optional |
| AUTH-5 Socket re-auth | P2 | AUTH-BUG-5 (no Redux dispatch) | ✅ |
| AUTH-6 Rider login | P3 | AUTH-BUG-6 (missing Profile invalidate) | ✅ |
| AUTH-7 Rider signup | P2 | KYC linkage unverified | ✅ |
| AUTH-8 Logout | P1 | AUTH-BUG-7 (cleanup gaps) | ✅ |
| AUTH-9 Push token | P1 | P1-11 from audit | ✅ |
| AUTH-10 Profile fetch | none | — | — |
| AUTH-11 Profile update | none | — | — |
| AUTH-12 Phone check | none | — | — |
| AUTH-13 Socket auth mw | P2 | accepts anon | ✅ (env-gated) |
| AUTH-14 Role resolution | P0 | P0-4 (no role guard on useDeliverySocket) | ✅ |

# AUTH DEPENDENCY GRAPH

```
App launch
  └─→ AUTH-3 Session restore
        ├─→ no token: UNAUTHENTICATED → AUTH-1 / AUTH-2 / AUTH-6 / AUTH-7
        ├─→ token + 200: ACTIVE
        │     ├─→ AUTH-9 push token register
        │     ├─→ socketClient connect (uses AUTH-13)
        │     ├─→ if role=delivery: useDeliverySocket connect (P0-4 — currently runs for all roles)
        │     └─→ AUTH-14 role-based navigation
        └─→ token + non-200: UNAUTHENTICATED (token cleared)

Active session
  ├─→ any 401 → AUTH-4 → refresh → retry → success or AUTH-8
  ├─→ socket connect_error (token) → AUTH-5 → refresh → reconnect
  ├─→ AUTH-11 profile update → invalidates Profile cache
  └─→ AUTH-8 manual logout → clears all state

AUTH-7 rider signup → admin approves (separate flow) → AUTH-6 rider login enabled
```

# KNOWN GAPS

- AUTH-7: KYC selfie/documents linkage not traced
- AUTH-9: exact push token endpoint, hook, and persistence path
- AUTH-10: bootstrap should ideally use RTK getProfile (unification)
- AUTH-12: callers of checkPhone not enumerated
- AUTH-14: RootNavigator role branching not directly read

These will be resolved in future passes.
