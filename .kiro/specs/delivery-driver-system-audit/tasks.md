# Delivery Driver System — Critical Bugfix Tasks

## Implementation Order

Fix 2 (backoff) → Fix 3 (escalation) → Fix 4 (attempt atomicity) → Fix 5 (route mutex) → Fix 1 (offline queue)

---

- [x] 1. Fix retry backoff mismatch — align client to backend (Issue #1)
  - [x] 1.1 In `apps/customer-app/src/constants/deliveryConfig.ts`, change `RAW_CONFIG.RETRY_BACKOFF_SECONDS` from `30` to `600`
  - [x] 1.2 In `deliveryConfig.ts`, update `validateRetryBackoff` minimum from `10` to `60` and default return from `30` to `600`
  - [x] 1.3 Verify `isRetryLocked` and `getRemainingSeconds` in `useAttemptTracker.ts` require no changes (they read from `retryAvailableAt` which is computed from `RETRY_BACKOFF_SECONDS`)
  - [x] 1.4 Verify the countdown timer in `ActiveOrderCard.tsx` requires no changes (it reads `attemptState.retryAvailableAt - currentTime` directly)

- [x] 2. Fix route mutex and preserve in-progress current order (Issues #9, #10, #29)
  - [x] 2.1 In `apps/customer-app/src/hooks/delivery/useRouteArrangement.ts`, add `isArrangingRef = useRef(false)` as a synchronous mutex
  - [x] 2.2 At the start of `arrangeRoute()`, replace the simulation freeze guard with: `if (isArrangingRef.current) return` — set `isArrangingRef.current = true` synchronously before any `await`, reset to `false` in `finally`
  - [x] 2.3 Replace the `driverLocationStore.isSimulationRunning && isArranged` freeze guard with `if (isArranged) return` — block re-arrangement when route is already arranged
  - [x] 2.4 Before the greedy routing loop, detect the in-progress order: find the order in `eligible` whose `_id === currentOrderId` AND whose status is `in_transit` or `arrived`
  - [x] 2.5 Exclude the in-progress order from the `eligible` pool passed to the greedy + 2-opt algorithm
  - [x] 2.6 After optimization, prepend the in-progress order to the front of the sorted list: `finalRoute = [inProgressOrder._id, ...optimizedIds]`
  - [x] 2.7 Set `currentOrderId` to `inProgressOrder._id` when one exists, otherwise use `sorted[0]` as before
  - [x] 2.8 Add `currentOrderId` to the `useCallback` dependency array of `arrangeRoute`

- [x] 3. Fix escalation removes order too early (Issue #3)
  - [x] 3.1 In `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`, in `handleFailDelivery` escalation path, locate the network-error branch (`if (!error?.status)`)
  - [x] 3.2 Remove the `await removeAttempt(orderId)` call from the network-error branch — keep the attempt count so the driver knows max attempts were reached
  - [x] 3.3 Remove the `await markOrderEscalated(orderId)` call from the network-error branch — order must NOT disappear until backend confirms
  - [x] 3.4 Update the Alert message in the network-error branch to: `'No network — escalation queued. Order stays active until confirmed.'`
  - [x] 3.5 Verify the success branch still calls `removeAttempt` and `markOrderEscalated` after `escalateOrder().unwrap()` succeeds (no change needed there)

- [x] 4. Fix attempt count atomicity — increment after API, fix race condition (Issues #2, #7, #6)
  - [x] 4.1 In `apps/customer-app/src/hooks/delivery/useAttemptTracker.ts`, add `loadPromiseRef = useRef<Promise<AttemptTrackerStore> | null>(null)` for promise coalescing
  - [x] 4.2 Rewrite `ensureLoaded` to use promise coalescing: if `loadedRef.current` is true return `store`; if `loadPromiseRef.current` exists return it; otherwise create the load promise, store it in `loadPromiseRef`, and return it — clear `loadPromiseRef` when the promise resolves
  - [x] 4.3 Rewrite `incrementAttempt` to call `readStore()` directly (not `ensureLoaded`) to guarantee an atomic read from AsyncStorage, not from the potentially stale in-memory store
  - [x] 4.4 In `DeliveryHomeTab.tsx` `handleFailDelivery`, read the current attempt count using `getAttemptState(orderId)` BEFORE any API call to decide which path to take (retry vs escalation) — do NOT increment yet
  - [x] 4.5 In the retry path: call `recordDeliveryAttempt` API first; call `incrementAttempt(orderId)` only after `.unwrap()` succeeds; on API failure show error and return without incrementing
  - [x] 4.6 In the escalation path: call `escalateOrder` API first; call `removeAttempt(orderId)` and `markOrderEscalated(orderId)` only after `.unwrap()` succeeds (network-error branch handled by Fix 3)
  - [x] 4.7 Remove the top-level `const attemptState = await incrementAttempt(orderId)` call that currently runs before the if/else branch

- [x] 5. Fix offline queue persistence and working replay (Issues #4, #5)
  - [x] 5.1 In `apps/customer-app/src/hooks/delivery/useActionQueue.ts`, add storage key constant: `const DELIVERY_QUEUE_KEY = '@delivery_action_queue'`
  - [x] 5.2 Add a `loadQueue` function that reads from AsyncStorage, parses the JSON array, filters out actions older than 2 hours (`Date.now() - enqueuedAt > 7_200_000`), and populates `queueRef.current` and state
  - [x] 5.3 Add a `persistQueue` function that writes `queueRef.current` to AsyncStorage as a JSON array
  - [x] 5.4 Call `loadQueue()` in a `useEffect` with empty deps `[]` on mount — this restores the queue after app restart
  - [x] 5.5 Call `persistQueue()` inside `enqueue` after updating `queueRef.current` and state
  - [x] 5.6 Call `persistQueue()` inside `replayQueue` after removing processed/discarded actions from the queue
  - [x] 5.7 In `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`, import the Redux store: `import { store } from '../../store'`
  - [x] 5.8 Replace the hardcoded `replayQueue(async (_orderId: string) => 'unknown')` call with a real implementation that reads from the RTK Query cache: get `store.getState()`, find the order in `state.api.queries['getDeliveryOrders(undefined)'].data?.orders`, return `order?.orderStatus?.toLowerCase() ?? 'unknown'`
  - [x] 5.9 Verify that all `enqueue` call sites in `DeliveryHomeTab.tsx` generate the `idempotencyKey` before calling `enqueue` and pass it as `idempotencyKey` on the `QueuedAction` — the `fn` closure must use this stored key, not generate a new `Date.now()` key on replay
