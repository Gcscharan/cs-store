# Bugfix Requirements Document — Delivery Driver System Audit

## Introduction

This document captures a production-grade audit of the Delivery Driver System, identifying every defect, missing behavior, and reliability risk that would prevent the system from operating at Amazon/Flipkart-level reliability. The audit covers the full stack: route arrangement, driver movement, order lifecycle state machine, multi-attempt retry, UI layer, API layer, offline handling, persistence, and backend services.

Issues are classified as:
- 🚨 **Critical** — must fix before production; causes data loss, silent failures, or broken core flows
- ⚠️ **Medium** — should fix; causes degraded UX or intermittent failures under real-world conditions
- 🟡 **Minor** — nice to improve; causes cosmetic or edge-case issues
- ❌ **Missing Feature** — blocking real-world usage; functionality that simply does not exist
- 💡 **Improvement** — non-essential but meaningfully raises reliability or maintainability

---

## Bug Analysis

### Current Behavior (Defect)

---

#### 🚨 CRITICAL ISSUES

**1. Retry Backoff Mismatch — Client Shows 30s, Backend Enforces 10 Minutes**

1.1 WHEN a driver fails a delivery attempt THEN the system displays a 30-second countdown timer (DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS = 30) while the backend enforces a 10-minute cooldown (RETRY_COOLDOWN_MS = 600,000ms), causing the driver to see the retry button re-enable after 30 seconds but every subsequent attempt is silently rejected by the backend with a cooldown message

**2. Attempt Count Incremented Before API Call — Phantom Attempt on API Failure**

1.2 WHEN a driver taps "Cancel Delivery" and the API call to recordDeliveryAttempt fails with a server error THEN the system has already incremented the local attempt count via incrementAttempt(), permanently consuming one of the driver's 3 allowed attempts even though the backend never recorded the failure, causing premature escalation after fewer real attempts than allowed

**3. Escalation Path Removes Order from UI Before Backend Confirms**

1.3 WHEN a driver reaches max attempts and the escalateOrder API call fails with a network error THEN the system calls markOrderEscalated() immediately (adding the order to escalatedOrderIds), causing the order to disappear from the driver's UI permanently even though the backend never processed the escalation, resulting in a lost order that no driver is handling

**4. useActionQueue Is In-Memory Only — All Queued Actions Lost on App Crash**

1.4 WHEN a driver performs actions (accept, pickup, startDelivery, markArrived, verifyOtp, failDelivery) while offline and the app is force-closed or crashes before network is restored THEN the system loses all queued actions because useActionQueue stores the queue only in React state (useState), not in AsyncStorage, resulting in permanently lost delivery state transitions

**5. replayQueue Always Fails Transition Validation — fetchOrderStatus Returns 'unknown'**

1.5 WHEN the network is restored and replayQueue is triggered THEN the system calls fetchOrderStatus with a hardcoded implementation that always returns the string 'unknown', causing VALID_TRANSITIONS['unknown'] to return undefined, causing every queued action to be silently discarded as an "invalid transition" and never replayed, making the entire offline queue useless

**6. ensureLoaded Race Condition in useAttemptTracker — Stale Store Returned**

1.6 WHEN two async operations (e.g., incrementAttempt and mergeServerAttempt) call ensureLoaded() concurrently before the first load completes THEN the system returns the stale in-memory store (empty {}) from the closure captured at hook creation time rather than the freshly loaded AsyncStorage data, causing one operation to overwrite the other's changes and producing incorrect attempt counts

**7. incrementAttempt Is Non-Atomic — Lost Update Under Concurrent Calls**

1.7 WHEN handleFailDelivery is called twice in rapid succession for the same order (e.g., double-tap before the failInProgressRef guard activates) THEN both calls read the same current attempt count, both increment independently, and both write back, causing one increment to be silently lost and the attempt count to be off by one

**8. useActionGuard isProcessing Captured in Stale Closure**

1.8 WHEN the component re-renders between the time useActionGuard is called and the time the guarded callback is invoked THEN the isProcessing value captured in the useCallback closure is stale (always false from the previous render), causing the guard to never block concurrent calls and allowing duplicate API mutations to fire simultaneously

**9. arrangeRoute Always Overwrites currentOrderId with sorted[0] — In-Progress Order Displaced**

1.9 WHEN arrangeRoute() is called while a driver is actively delivering an order (e.g., status is in_transit or arrived) THEN the system sets currentOrderId = sorted[0] (the first order in the newly optimized route), which may be a different order than the one currently being delivered, causing the driver's current order to lose its CURRENT status and become locked, blocking all action buttons on the active delivery

**10. arrangeRoute Has No Mutex — Concurrent Calls Produce Race Condition**

1.10 WHEN arrangeRoute() is called multiple times concurrently (e.g., user taps "Arrange Route" twice quickly, or a new order arrives triggering auto-arrange while a previous arrange is in flight) THEN the system runs multiple arrange operations simultaneously with no lock, causing the last write to AsyncStorage to win non-deterministically and potentially producing an inconsistent sortedOrderIds/currentOrderId pair

**11. ACTIVE_STATUSES Includes 'cancelled' — Cancelled Orders Shown as Active**

1.11 WHEN an order is cancelled by the customer or admin THEN the system includes it in activeOrders because 'cancelled' is listed in ACTIVE_STATUSES in useOrders.ts, causing cancelled orders to appear in the driver's active order list alongside real deliveries, polluting the UI and potentially causing the driver to attempt delivery of a cancelled order

**12. Backend ALLOWED_TRANSITIONS Has No 'arrived' State — Frontend/Backend State Mismatch**

1.12 WHEN a driver marks an order as 'arrived' on the frontend THEN the backend ALLOWED_TRANSITIONS map has no entry for OrderStatus.ARRIVED (the map goes directly from IN_TRANSIT to [DELIVERED, FAILED]), meaning the backend state machine does not recognize 'arrived' as a valid state, causing any backend-side transition validation from 'arrived' to fail with an InvalidStateTransitionError

**13. deliveryAttempts Reset to 0 on Reassignment — Client Attempt Tracker Not Reset**

1.13 WHEN an order is auto-reassigned to a new driver after max attempts THEN the backend resets deliveryAttempts to 0 on the Order document, but the new driver's client-side useAttemptTracker still has no entry for this order (correct), however the original driver's client still has the old attempt count persisted in AsyncStorage, and if the original driver somehow receives the order again (e.g., second reassignment), the client attempt count will be wrong

**14. Idempotency Keys Use Date.now() — Not Stable Across Retries**

1.14 WHEN a queued action is replayed from useActionQueue after a network failure THEN the system generates a new idempotency key using Date.now() inside the fn closure at enqueue time, but the key was already generated at enqueue time with a different timestamp, meaning if the same action is retried the key changes on each attempt, defeating the purpose of idempotency and allowing duplicate state transitions to be processed by the backend

**15. pointerEvents="none" on Entire Card When isRetryLocked — Phone Call Blocked**

1.15 WHEN an order is in retry-locked state (waiting for backoff timer) THEN the system applies pointerEvents="none" to the entire card wrapper including the customer phone number TouchableOpacity, preventing the driver from calling the customer during the retry wait period, which is the most critical action available during that time

---

#### ⚠️ MEDIUM ISSUES

**16. No OFFLINE / SYNCING / RETRY_LOCKED / ESCALATING States in useDeliveryState**

1.16 WHEN the device goes offline, or an action is syncing, or an order is retry-locked, or an escalation is in progress THEN the system's state machine (useDeliveryState) only models three states (IDLE, NEW_ORDER, ACTIVE_DELIVERY) with no representation of these operational states, causing the UI to show normal active-delivery UI with no indication of the degraded operational mode

**17. Socket Room Join Has No Acknowledgement/Confirmation**

1.17 WHEN the socket connects and emits join_room for delivery:${userId} THEN the system does not listen for any acknowledgement or confirmation from the server that the room join succeeded, meaning if the server-side join fails silently (auth error, room limit, server bug), the driver receives no real-time events but sees "connected" status in the UI

**18. useNetworkStatus Has No Debounce — Rapid Connectivity Flapping**

1.18 WHEN the device experiences rapid network connectivity changes (e.g., moving between WiFi and cellular, or brief signal drops) THEN the system fires a state update and triggers replayQueue on every single NetInfo event with no debounce, causing multiple simultaneous replay attempts and potential duplicate action submissions

**19. cleanup() Called on Every filteredActiveOrders Change — Excessive AsyncStorage Reads**

1.19 WHEN filteredActiveOrders changes (which happens on every socket event, every poll, and every refetch) THEN the system calls cleanup() which calls ensureLoaded() which reads from AsyncStorage on every invocation, causing excessive AsyncStorage I/O that degrades performance and can cause read/write contention with concurrent incrementAttempt calls

**20. COD Fetch Triggered on Every activeOrders Change for Arrived COD Orders**

1.20 WHEN activeOrders changes (on every socket event or poll) THEN the system iterates all orders and fetches COD collection status for every arrived COD order that is not already in codCollectionByOrderId, but the check !(order._id in codCollectionByOrderId) is true even when the fetch is already in-flight, causing duplicate concurrent fetches for the same order

**21. prevKmRef/prevEtaRef Mutated Inside useMemo — React Anti-Pattern**

1.21 WHEN useDistanceEta re-renders THEN the system mutates prevKmRef.current and prevEtaRef.current inside the useMemo callback, which is a React violation (useMemo must be pure/side-effect-free), causing unpredictable behavior in React's concurrent rendering mode where useMemo may be called multiple times for the same render, corrupting the jitter guard state

**22. "UP NEXT" Strip Hardcoded to stopIndex === 2 — Wrong for Routes with Gaps**

1.22 WHEN a route has orders where the second stop (stopIndex === 2) is not the next actionable order (e.g., stop 1 is delivered, stop 2 is locked, stop 3 is current) THEN the system shows the "UP NEXT" strip only on the card with stopIndex === 2 regardless of route state, causing the wrong card to be labeled "UP NEXT" and potentially no card being labeled "UP NEXT" when the second stop is already completed

**23. SyncingSkeleton Shown Indefinitely When allowedActions Is Absent**

1.23 WHEN an order's allowedActions field is undefined (absent from server response) THEN the system shows the SyncingSkeleton spinner indefinitely with no timeout or fallback, leaving the driver unable to take any action on the order if the server never sends allowedActions, with no way to recover except a manual pull-to-refresh

**24. 409 Conflicts Silently Discarded in replayQueue — No User Notification**

1.24 WHEN a queued action replays and receives a 409 Conflict response (order already escalated or reassigned) THEN the system silently discards the action with only a console.log, giving the driver no indication that their queued action was not applied and that the order state may have changed significantly

**25. routeLifecycleService Emits No Socket Event After Route Status Change**

1.25 WHEN a route transitions from ASSIGNED to IN_PROGRESS or from IN_PROGRESS to COMPLETED THEN the backend routeLifecycleService updates the route document but emits no socket event to the driver, meaning the driver's UI has no real-time awareness of route lifecycle changes and must rely on polling to discover route completion

**26. handleOrderAssigned Falls Back to Full Invalidation When order._id Missing**

1.26 WHEN the server emits an order:assigned socket event with the old payload format (containing orderId but not _id) THEN the system triggers a full cache invalidation (invalidateTags(['DeliveryOrders'])), causing a full API refetch for every assigned order that uses the legacy payload format, creating unnecessary load on both client and server

**27. Cross-Action Guard Missing — Independent useActionGuard Instances Allow Parallel Mutations**

1.27 WHEN a driver rapidly taps different action buttons (e.g., "Mark Arrived" and "Cancel Delivery" simultaneously) THEN the system has no cross-action guard because each useActionGuard instance is independent, allowing two different mutations to fire concurrently for the same order, potentially causing conflicting state transitions

**28. ETA Speed Hardcoded at 25 km/h — Inaccurate for All Vehicle Types and Traffic**

1.28 WHEN the system calculates ETA for a delivery THEN it always uses 25 km/h as the average speed regardless of vehicle type (motorcycle vs. bicycle vs. car), time of day, traffic conditions, or actual GPS speed data, producing ETAs that are systematically wrong and erode customer trust

---

#### 🟡 MINOR ISSUES

**29. Freeze Guard Checks driverLocationStore.isSimulationRunning — Production Always False**

1.29 WHEN the app runs in production (not simulation mode) THEN the freeze guard condition `driverLocationStore.isSimulationRunning && isArranged` is always false because isSimulationRunning is only true in the simulator, meaning the freeze guard never activates in production and routes can be reshuffled mid-delivery if arrangeRoute is called again

**30. Ghost-Order Guard Advances to First Surviving Order in sortedOrderIds — May Skip Completed Stops**

1.30 WHEN the ghost-order guard triggers (currentOrderId disappears from activeOrders) THEN the system advances to the first entry in sortedOrderIds that still exists in activeOrders, but sortedOrderIds may contain already-delivered orders that were removed from activeOrders, causing the guard to skip over them correctly but potentially advancing to a stop that is not the logical next stop

**31. Dedup Map in useDeliverySocket Purged Every 60s — Duplicate Events Possible Within Window**

1.31 WHEN two identical socket events arrive within the 60-second dedup window THEN the system correctly deduplicates them, but if the same event arrives after 60 seconds (e.g., due to a delayed retry from the server) THEN the dedup map has already purged the entry and the event is processed again as a duplicate, causing double state updates

**32. AsyncStorage Keys for Route Not Namespaced by Driver ID**

1.32 WHEN two different driver accounts log in on the same device (e.g., shared device, account switch) THEN the system reads route state from @delivery_sorted_orders, @delivery_current_order, and @delivery_route_arranged without any driver ID namespace, causing one driver's route state to be loaded by the other driver on login

**33. Escalated Orders TTL Check Only on Mount — Stale Entries Persist During Session**

1.33 WHEN the app is running for more than 24 hours without a restart THEN the system only cleans up expired escalated order IDs on mount (initial useEffect), meaning entries that expire during the session are never cleaned up until the next app restart, causing the escalatedOrderIds set to grow unboundedly during long sessions

**34. No Validation That OTP Is Numeric Before Sending to Backend**

1.34 WHEN a driver enters a non-numeric OTP (e.g., pastes text, enters letters) THEN the system strips non-digits with .replace(/\D/g, '') in the TextInput handler but does not re-validate before calling verifyDeliveryOtp, meaning if the stripped result is empty or less than 4 digits the API call fires with an invalid OTP

**35. handleCollectCOD Idempotency Key Is Static — Same Key on Every Call**

1.35 WHEN a driver taps "Collect Cash" or "Collect UPI" and the first attempt fails, then retries THEN the system uses the static key `cod_collection_idem_${orderId}` which is identical on every call for the same order, meaning if the first call partially succeeded (server processed but response lost), the retry with the same key will be correctly deduplicated, but if the driver intentionally changes payment mode (Cash → UPI) the same key is reused, potentially causing the wrong mode to be recorded

---

#### ❌ MISSING FEATURES

**36. No Persistent Offline Queue for Delivery Actions**

1.36 WHEN a driver performs delivery actions while offline THEN the system has no persistent offline queue for delivery-specific actions (useActionQueue is in-memory only), while the cart/wishlist offlineQueue.ts correctly uses AsyncStorage persistence, meaning delivery actions are treated as less reliable than cart actions despite being far more critical

**37. No Backend Escalation Transition in ALLOWED_TRANSITIONS**

1.37 WHEN the backend receives an escalation request THEN the system has no ESCALATED state in the backend ALLOWED_TRANSITIONS map and no escalation transition defined for DELIVERY_PARTNER role in assertAllowedByRole, meaning escalation must bypass the standard state machine entirely and is not auditable through the order history

**38. No Retry Cooldown Enforcement on Client — Driver Can Spam Failure Actions**

1.38 WHEN a driver fails a delivery and the 30-second client timer expires THEN the system allows the driver to immediately submit another failure attempt with no server-side enforcement visible to the client, and the backend's 10-minute cooldown silently rejects the attempt without updating the client's attempt count or timer, leaving the driver confused about why their action had no effect

**39. No Route Re-optimization After Retry Unlock**

1.39 WHEN a retry-locked order unlocks (backoff timer expires) THEN the system does not re-evaluate whether this order should be inserted back into the optimized route at its original position or at a new optimal position, leaving the route potentially suboptimal for the remainder of the delivery run

**40. No Device-Switch / Multi-Device Conflict Resolution**

1.40 WHEN a driver logs in on a second device while the first device has an active route and queued offline actions THEN the system has no mechanism to detect or resolve the conflict, allowing both devices to independently submit state transitions for the same orders, potentially causing duplicate deliveries or conflicting status updates

**41. No Handling for FAILED_PERMANENT Orders on Client**

1.41 WHEN the backend marks an order as FAILED_PERMANENT (no riders available after max attempts) THEN the system has no client-side handling for this state — no specific UI, no notification to the driver, and no cleanup of the attempt tracker entry for the order

**42. No Confirmation That Socket Room Join Succeeded**

1.42 WHEN the socket connects and emits join_room THEN the system has no server-side acknowledgement handler, meaning if the driver is not actually subscribed to their delivery room (auth failure, server-side bug), they will miss all real-time order events and only receive updates via the 30-second polling fallback, with no indication that real-time updates are not working

**43. No TTL/Expiry on Queued Actions**

1.43 WHEN an action is enqueued in useActionQueue and the device remains offline for an extended period (hours) THEN the system stores the enqueuedAt timestamp but never uses it to expire stale actions, meaning a "Mark Arrived" action queued 3 hours ago will be replayed when connectivity is restored even though the order state has certainly changed, causing a guaranteed 409 or invalid transition error

**44. No Handling for Duplicate Coordinates in Route Optimization**

1.44 WHEN two or more orders have identical or near-identical delivery coordinates (e.g., same apartment building, same address) THEN the 2-opt optimization and haversine scoring treat them as separate stops with zero distance between them, but the system has no deduplication or grouping logic, causing the route to list them as separate stops with no indication to the driver that they are at the same location

---

#### 💡 SUGGESTED IMPROVEMENTS

**45. ETA Should Use Actual GPS Speed When Available**

1.45 WHEN the driver's GPS provides a speed reading THEN the system ignores it and always uses the hardcoded 25 km/h average, missing an opportunity to provide significantly more accurate ETAs using real-time speed data

**46. Route Progress Header completedCount Calculation Is Incorrect**

1.46 WHEN the route is arranged and some orders have been delivered THEN the system calculates completedCount as the index of the current order (currentIndex), but this is the position of the current order in the sorted list, not the count of actually completed orders, causing the progress header to show incorrect completion counts when orders are delivered out of sequence

**47. No Exponential Backoff for Socket Reconnection Jitter**

1.47 WHEN 1000+ drivers simultaneously lose and regain connectivity (e.g., server restart, network outage) THEN the system applies a fixed 2-second jitter window for sync requests on reconnect, which may be insufficient to prevent a reconnect storm at scale

**48. No Validation of Google Maps API Key Before Route Arrangement**

1.48 WHEN EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is missing or invalid THEN the system silently falls back to haversine distance without notifying the driver or logging a meaningful error, making it difficult to diagnose why road-distance routing is not working in production

**49. Attempt Tracker cleanup() Removes Entries for Orders Not in Active List — May Remove Retry-Locked Orders**

1.49 WHEN cleanup() is called and a retry-locked order has been temporarily removed from activeOrders (e.g., due to a stale cache or socket event) THEN the system removes the attempt tracker entry for that order, causing the retry lock to be lost and the driver to be able to immediately retry without waiting for the backoff period

---

### Expected Behavior (Correct)

**2.1 WHEN a driver fails a delivery attempt THEN the system SHALL display a countdown timer matching the backend's actual cooldown period (10 minutes), and SHALL NOT re-enable the retry button until the backend cooldown has expired**

**2.2 WHEN a driver taps "Cancel Delivery" THEN the system SHALL only increment the local attempt count AFTER the recordDeliveryAttempt API call succeeds, and SHALL roll back the increment if the API call fails**

**2.3 WHEN escalateOrder fails with a network error THEN the system SHALL enqueue the escalation for offline replay but SHALL NOT remove the order from the driver's UI until the escalation is confirmed by the backend**

**2.4 WHEN the app is force-closed or crashes with pending offline actions THEN the system SHALL persist the action queue to AsyncStorage so that all queued actions survive app restarts and are replayed on next launch**

**2.5 WHEN replayQueue is triggered THEN the system SHALL fetch the actual current order status from the server (or from the RTK Query cache) to validate transitions, and SHALL replay actions whose transitions are still valid**

**2.6 WHEN ensureLoaded() is called concurrently THEN the system SHALL use a single in-flight promise (promise coalescing) so that all concurrent callers wait for the same load operation and receive the same result**

**2.7 WHEN incrementAttempt is called THEN the system SHALL use an atomic read-modify-write pattern (reading from AsyncStorage directly rather than from the potentially stale in-memory store) to prevent lost updates**

**2.8 WHEN useActionGuard's guarded callback is invoked THEN the system SHALL check isProcessing via a ref (useRef) rather than state captured in a closure, ensuring the guard always reflects the current processing state**

**2.9 WHEN arrangeRoute() is called while an order is actively in_transit or arrived THEN the system SHALL preserve the currently active order as currentOrderId and only optimize the remaining stops around it**

**2.10 WHEN arrangeRoute() is called THEN the system SHALL use a mutex/lock (e.g., isArranging ref checked before setting isArranging state) to prevent concurrent arrange operations**

**2.11 WHEN filtering active orders THEN the system SHALL exclude 'cancelled' from ACTIVE_STATUSES so that cancelled orders are never shown in the driver's active delivery list**

**2.12 WHEN the backend processes an 'arrived' status transition THEN the system SHALL include ARRIVED as a valid state in ALLOWED_TRANSITIONS with valid next states [DELIVERED, FAILED], matching the frontend state model**

**2.13 WHEN an order is reassigned to a new driver THEN the system SHALL emit a socket event to the new driver's room and SHALL reset the attempt tracker on the new driver's client via mergeServerAttempt with count 0**

**2.14 WHEN an action is enqueued for offline replay THEN the system SHALL generate the idempotency key once at enqueue time and SHALL reuse the same key on every replay attempt for that action**

**2.15 WHEN an order is in retry-locked state THEN the system SHALL apply pointerEvents="none" only to the action buttons section, not to the customer contact information, so the driver can still call the customer**

**2.16 WHEN the device goes offline, an action is syncing, or an order is retry-locked THEN the system SHALL model these as explicit states in useDeliveryState and SHALL render appropriate UI for each state**

**2.17 WHEN the socket emits join_room THEN the system SHALL listen for a server acknowledgement and SHALL fall back to polling mode if the join is not confirmed within a timeout**

**2.18 WHEN NetInfo fires connectivity change events THEN the system SHALL debounce the handler (minimum 500ms) before triggering replayQueue to prevent duplicate replay attempts**

**2.19 WHEN filteredActiveOrders changes THEN the system SHALL call cleanup() at most once per meaningful change (debounced or throttled), not on every render cycle**

**2.20 WHEN fetching COD collection status THEN the system SHALL track in-flight fetches per order and SHALL NOT initiate a second fetch for an order that already has a fetch in progress**

**2.21 WHEN useDistanceEta calculates distance and ETA THEN the system SHALL update prevKmRef and prevEtaRef in a useEffect (after render) rather than inside useMemo, eliminating the React anti-pattern**

**2.22 WHEN displaying the "UP NEXT" strip THEN the system SHALL show it on the card immediately following the current order in the sorted route, regardless of its stopIndex value**

**2.23 WHEN allowedActions is absent for more than 10 seconds THEN the system SHALL show a timeout fallback with a "Refresh" button rather than spinning indefinitely**

**2.24 WHEN a queued action is discarded due to a 409 Conflict THEN the system SHALL notify the driver that the order state has changed and prompt them to refresh**

**2.25 WHEN a route transitions status THEN the backend routeLifecycleService SHALL emit a socket event to the driver's room so the driver's UI reflects route completion in real time**

**2.26 WHEN the server emits order:assigned with a legacy payload format THEN the system SHALL handle the format gracefully without triggering a full cache invalidation**

**2.27 WHEN a driver interacts with action buttons THEN the system SHALL use a single shared processing lock per order that blocks all action buttons for that order while any one action is in flight**

**2.28 WHEN calculating ETA THEN the system SHALL use the driver's actual GPS speed when available, falling back to a vehicle-type-appropriate average speed**

---

### Unchanged Behavior (Regression Prevention)

**3.1 WHEN a driver successfully delivers an order THEN the system SHALL CONTINUE TO remove the order from the active list, clear the attempt tracker entry, and advance currentOrderId to the next stop**

**3.2 WHEN the socket is connected and events arrive in order THEN the system SHALL CONTINUE TO apply version-guarded cache updates without triggering full refetches**

**3.3 WHEN the driver is online and performs actions THEN the system SHALL CONTINUE TO use idempotency keys on all mutations to prevent duplicate processing**

**3.4 WHEN the route is arranged and the driver is mid-delivery THEN the system SHALL CONTINUE TO lock non-current orders and prevent action buttons from being tapped on locked orders**

**3.5 WHEN the app is backgrounded for more than 30 seconds THEN the system SHALL CONTINUE TO emit a sync_request on foreground to catch missed events**

**3.6 WHEN the socket disconnects THEN the system SHALL CONTINUE TO fall back to 30-second polling until reconnection**

**3.7 WHEN an order is escalated and confirmed by the backend THEN the system SHALL CONTINUE TO persist the escalated order ID to AsyncStorage with a 24-hour TTL to prevent re-appearance from stale cache**

**3.8 WHEN mergeServerAttempt is called with a server count higher than local THEN the system SHALL CONTINUE TO update the local count to match the server, preserving the higher-authority server value**

**3.9 WHEN the Google Maps Distance Matrix API is unavailable THEN the system SHALL CONTINUE TO fall back to haversine distance for route optimization**

**3.10 WHEN a driver has no active or available orders THEN the system SHALL CONTINUE TO show the IdleCard with earnings summary**

**3.11 WHEN the OTP verification succeeds THEN the system SHALL CONTINUE TO clear the OTP input, remove the attempt tracker entry, and update the order status in the RTK Query cache**

**3.12 WHEN the backend rejects a state transition with a 409 InvalidStateTransitionError THEN the system SHALL CONTINUE TO show an error alert and NOT update the local cache**

---

## Bug Condition Pseudocode

### Primary Bug Conditions

```pascal
FUNCTION isBugCondition_RetryMismatch(X)
  INPUT: X of type DeliveryAttemptEvent
  OUTPUT: boolean
  RETURN X.clientBackoffSeconds = 30 AND X.backendCooldownMs = 600000
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_RetryMismatch(X) DO
  result ← showCountdown'(X)
  ASSERT result.displayedSeconds = 600 AND result.retryButtonEnabled = false
END FOR

// Preservation
FOR ALL X WHERE NOT isBugCondition_RetryMismatch(X) DO
  ASSERT showCountdown(X) = showCountdown'(X)
END FOR
```

```pascal
FUNCTION isBugCondition_PrematureIncrement(X)
  INPUT: X of type FailDeliveryEvent
  OUTPUT: boolean
  RETURN X.incrementCalledBeforeApiCall = true AND X.apiCallFailed = true
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_PrematureIncrement(X) DO
  result ← handleFailDelivery'(X)
  ASSERT result.localAttemptCount = X.previousAttemptCount
END FOR
```

```pascal
FUNCTION isBugCondition_OfflineQueueLost(X)
  INPUT: X of type AppLifecycleEvent
  OUTPUT: boolean
  RETURN X.queueLength > 0 AND X.appCrashed = true
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_OfflineQueueLost(X) DO
  result ← loadQueueAfterRestart'(X)
  ASSERT result.queueLength = X.queueLength
END FOR
```

```pascal
FUNCTION isBugCondition_ReplayAlwaysFails(X)
  INPUT: X of type ReplayQueueEvent
  OUTPUT: boolean
  RETURN X.fetchOrderStatusImpl = "hardcoded_unknown"
END FUNCTION

// Fix Checking
FOR ALL X WHERE isBugCondition_ReplayAlwaysFails(X) DO
  result ← replayQueue'(X)
  ASSERT result.actionsReplayed > 0 OR result.actionsDiscardedWithReason != "invalid_transition"
END FOR
```
