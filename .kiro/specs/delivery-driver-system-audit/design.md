# Delivery Driver System — Critical Bugfix Design

## Scope

This design covers the **5 critical fixes** that must ship before production. Everything else is deferred.

| Fix | Issues | Files Changed |
|-----|--------|---------------|
| 1. Persistent offline queue + working replay | #4, #5 | `useActionQueue.ts`, `DeliveryHomeTab.tsx` |
| 2. Retry backoff mismatch | #1 | `deliveryConfig.ts` |
| 3. Escalation removes order too early | #3 | `DeliveryHomeTab.tsx` |
| 4. Attempt count atomicity | #2, #7 | `useAttemptTracker.ts`, `DeliveryHomeTab.tsx` |
| 5. Route mutex + preserve current order | #9, #10 | `useRouteArrangement.ts` |

---

## Fix 1 — Persistent Offline Queue + Working Replay

### Root Causes

**#4 — Queue lost on crash:** `useActionQueue` stores the queue in React `useState`. When the app is force-closed, the JS heap is destroyed and the queue is gone.

**#5 — Replay always discards:** `DeliveryHomeTab.tsx` calls `replayQueue(async (_orderId) => 'unknown')`. The hardcoded `'unknown'` causes `VALID_TRANSITIONS['unknown']` to return `undefined`, so every action is treated as an invalid transition and silently dropped.

### Design

#### `useActionQueue.ts` — Add AsyncStorage persistence

```
Storage key: @delivery_action_queue
Storage value: JSON array of QueuedAction[]
```

**Lifecycle:**
1. **Mount** — load persisted queue from AsyncStorage into `queueRef.current` and state. Expire any actions older than 2 hours (`Date.now() - enqueuedAt > 7_200_000`).
2. **Enqueue** — after updating state, write the full queue to AsyncStorage.
3. **After replay** — after removing processed/discarded actions, write the updated queue to AsyncStorage.

**TTL expiry on load:**
```
actions where (Date.now() - enqueuedAt) > 2 * 60 * 60 * 1000  →  discard silently
```
This prevents stale "Mark Arrived" actions from 3 hours ago from replaying against an order that has long since changed state.

**Idempotency key stability:** `QueuedAction.idempotencyKey` is already set at enqueue time. The `fn` closure must use this stored key, not generate a new `Date.now()` key. This is enforced in Fix 1 — the `fn` passed to `enqueue` in `DeliveryHomeTab.tsx` must close over the key that was generated before `enqueue` was called (which is already the case for most actions — the key is generated on the line before `enqueue` is called).

#### `DeliveryHomeTab.tsx` — Fix `fetchOrderStatus`

Replace:
```ts
replayQueue(async (_orderId: string) => 'unknown');
```

With a real implementation that reads from the RTK Query cache:
```ts
replayQueue(async (orderId: string) => {
  const state = store.getState() as any;
  const queryData = state?.api?.queries?.['getDeliveryOrders(undefined)']?.data;
  const order = queryData?.orders?.find((o: any) => o._id === orderId);
  return order?.orderStatus?.toLowerCase() ?? 'unknown';
});
```

`store` is the Redux store — already available via `useDispatch` / `useSelector` context. Access it via `store.getState()` where `store` is imported from `../../store`.

If the order is not found in cache (`'unknown'`), the action is discarded — this is correct behaviour for a truly stale action.

### Data Flow

```
App crash with 3 queued actions
         ↓
AsyncStorage: @delivery_action_queue = [action1, action2, action3]
         ↓
App restarts → useActionQueue mounts
         ↓
loadQueue() → reads AsyncStorage → populates queueRef + state
         ↓
Network restored → replayQueue() triggered
         ↓
For each action:
  fetchOrderStatus(orderId) → reads RTK cache → returns real status
  VALID_TRANSITIONS[status].includes(targetStatus) → true/false
  true  → fn(...args) → API call with stored idempotencyKey
  false → discard (order state has moved on)
         ↓
persistQueue() → writes updated queue to AsyncStorage
```

### Correctness Properties

- **P1.1** — After app restart, `queueRef.current.length` equals the number of actions that were enqueued before the crash (minus expired ones).
- **P1.2** — After a successful replay, the action is removed from AsyncStorage.
- **P1.3** — `fetchOrderStatus` never returns `'unknown'` for an order that exists in the RTK cache.
- **P1.4** — The idempotency key used during replay equals the key generated at enqueue time.

---

## Fix 2 — Retry Backoff Mismatch

### Root Cause

`deliveryConfig.ts` has `RETRY_BACKOFF_SECONDS = 30`. The backend `deliveryFailureService.ts` has `RETRY_COOLDOWN_MS = 10 * 60 * 1000` (600 seconds). The client shows a 30-second countdown, re-enables the button, the driver retries, and the backend silently rejects with a cooldown message that never surfaces in the UI.

### Design

**Single change — `deliveryConfig.ts`:**

```ts
const RAW_CONFIG = {
  MAX_DELIVERY_ATTEMPTS: 3,
  RETRY_BACKOFF_SECONDS: 600,   // was 30 — must match backend RETRY_COOLDOWN_MS
  COUNTDOWN_UPDATE_INTERVAL: 1000,
};
```

Also update the validator minimum:
```ts
function validateRetryBackoff(value: number): number {
  if (typeof value !== 'number' || isNaN(value) || value < 60) {  // was < 10
    ...
    return 600;  // was 30
  }
  return Math.floor(value);
}
```

**No backend changes.** The backend is already correct. The client was wrong.

**Downstream effects (all automatic, no code changes needed):**
- `incrementAttempt()` computes `retryAvailableAt = Date.now() + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000` → now 10 minutes from now ✓
- `isRetryLocked()` checks `Date.now() < retryAvailableAt` → correct ✓
- `getRemainingSeconds()` returns up to 600 → countdown shows 10:00 ✓
- `ActiveOrderCard` countdown timer reads `attemptState.retryAvailableAt - currentTime` → shows correct 10-minute countdown ✓

### Correctness Properties

- **P2.1** — `DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS === 600`
- **P2.2** — After `incrementAttempt()`, `retryAvailableAt - Date.now()` is within ±1000ms of 600,000ms.
- **P2.3** — `isRetryLocked()` returns `true` for at least 599 seconds after `incrementAttempt()`.

---

## Fix 3 — Escalation Removes Order Too Early

### Root Cause

In `handleFailDelivery` escalation path, the network-error branch calls `markOrderEscalated(orderId)` before the backend has confirmed the escalation. The order is added to `escalatedOrderIds`, filtered out of `filteredActiveOrders`, and disappears from the UI permanently — even though no driver is now handling it.

### Current (broken) flow

```
escalateOrder() → network error (no error.status)
  → enqueue escalation for offline replay   ✓
  → removeAttempt(orderId)                  ✗ (loses attempt count)
  → markOrderEscalated(orderId)             ✗ (order disappears)
  → Alert: "Order escalated (will sync)"    ✗ (misleading)
```

### Fixed flow

```
escalateOrder() → network error (no error.status)
  → enqueue escalation for offline replay   ✓
  → DO NOT removeAttempt                    ✓ (keep count — driver knows max reached)
  → DO NOT markOrderEscalated               ✓ (order stays visible)
  → Alert: "No network — escalation queued. Order stays active until confirmed."  ✓

escalateOrder() → success
  → removeAttempt(orderId)                  ✓
  → markOrderEscalated(orderId)             ✓  (only now)
  → Alert: "Order escalated for reassignment"  ✓

escalateOrder() → server error (has error.status)
  → Alert: "Escalation failed"              ✓ (already correct)
  → DO NOT remove order                     ✓ (already correct)
```

### UI — Pending Escalation Banner

When `attemptCount >= MAX_DELIVERY_ATTEMPTS` and the order is NOT in `escalatedOrderIds` (i.e., escalation is queued but not confirmed), show a warning banner on the card:

```
⚠️  Max attempts reached — escalation pending sync
    [Retry Now]  (triggers replayQueue manually)
```

This is rendered in `ActiveOrderCard` / `SingleOrderCard` based on props passed down from `DeliveryHomeTab`.

### Correctness Properties

- **P3.1** — After a network error on `escalateOrder`, the order remains in `filteredActiveOrders`.
- **P3.2** — After a network error on `escalateOrder`, `escalatedOrderIds` does NOT contain the order ID.
- **P3.3** — After a successful `escalateOrder`, the order is removed from `filteredActiveOrders` within one render cycle.
- **P3.4** — The escalation action enqueued on network error uses the same idempotency key as the original attempt.

---

## Fix 4 — Attempt Count Atomicity

### Root Causes

**#2 — Increment before API:** `handleFailDelivery` calls `incrementAttempt(orderId)` first, then calls the API. If the API fails, the count is permanently wrong.

**#7 — Non-atomic increment:** `incrementAttempt` reads from the in-memory `store` (captured in closure), increments, writes back. Two concurrent calls read the same value and both write `count + 1` instead of `count + 2`.

**#6 — ensureLoaded race:** `ensureLoaded` checks `loadedRef.current` but returns the stale `store` from the closure if two calls race before the first load completes.

### Design

#### `useAttemptTracker.ts` — Promise coalescing + atomic reads

**Replace `ensureLoaded` with promise coalescing:**

```ts
const loadPromiseRef = useRef<Promise<AttemptTrackerStore> | null>(null);

const ensureLoaded = useCallback(async (): Promise<AttemptTrackerStore> => {
  if (loadedRef.current) return store;  // fast path: already loaded
  if (!loadPromiseRef.current) {
    // First caller creates the promise
    loadPromiseRef.current = readStore().then(loaded => {
      loadedRef.current = true;
      setStore(loaded);
      loadPromiseRef.current = null;
      return loaded;
    });
  }
  // All concurrent callers await the same promise
  return loadPromiseRef.current;
}, [store, readStore]);
```

**Make `incrementAttempt` always read from AsyncStorage directly (atomic read-modify-write):**

```ts
const incrementAttempt = useCallback(
  async (orderId: string): Promise<AttemptState> => {
    // Always read from AsyncStorage — never from potentially stale in-memory store
    const current = await readStore();
    const existing = current[orderId];
    const newCount = (existing?.attemptCount ?? 0) + 1;
    const retryAvailableAt = Date.now() + DELIVERY_CONFIG.RETRY_BACKOFF_SECONDS * 1000;
    const next: AttemptState = { attemptCount: newCount, retryAvailableAt };
    await writeStore({ ...current, [orderId]: next });
    return next;
  },
  [readStore, writeStore],
);
```

Note: `readStore` is used directly (not `ensureLoaded`) to guarantee we always read the latest persisted value, not a cached in-memory snapshot.

#### `DeliveryHomeTab.tsx` — Move increment to after API success

**Retry path (attempt < max):**
```ts
// OLD (broken):
const attemptState = await incrementAttempt(orderId);  // ← before API
await recordDeliveryAttempt(...).unwrap();

// NEW (correct):
await recordDeliveryAttempt(...).unwrap();             // ← API first
const attemptState = await incrementAttempt(orderId);  // ← only on success
```

**Escalation path:**
```ts
// OLD (broken):
const attemptState = await incrementAttempt(orderId);  // ← before API
if (attemptCount >= MAX) {
  await escalateOrder(...).unwrap();
  await removeAttempt(orderId);
  await markOrderEscalated(orderId);
}

// NEW (correct):
// Read current count WITHOUT incrementing to decide which path to take
const currentState = getAttemptState(orderId);
const currentCount = currentState?.attemptCount ?? 0;

if (currentCount + 1 >= MAX_DELIVERY_ATTEMPTS) {
  // Escalation path — increment happens implicitly via removeAttempt after success
  await escalateOrder(...).unwrap();   // API first
  await removeAttempt(orderId);        // clean up on success
  await markOrderEscalated(orderId);
} else {
  // Retry path
  await recordDeliveryAttempt(...).unwrap();   // API first
  await incrementAttempt(orderId);             // increment only on success
}
```

This requires reading the current count before the API call (to decide which path), but not incrementing until after success.

### Correctness Properties

- **P4.1** — If `recordDeliveryAttempt` throws, `getAttemptState(orderId).attemptCount` equals its value before the call.
- **P4.2** — Two concurrent calls to `incrementAttempt` for the same order produce a final count exactly 2 higher than the initial count.
- **P4.3** — Two concurrent calls to `ensureLoaded` before the first load completes both receive the same loaded store (not an empty `{}`).
- **P4.4** — If `escalateOrder` throws with a network error, `escalatedOrderIds` does not contain the order ID (covered by Fix 3).

---

## Fix 5 — Route Mutex + Preserve Current Order

### Root Causes

**#9 — Current order displaced:** `arrangeRoute()` always sets `currentOrderId = sorted[0]`. If the driver is mid-delivery on order B, and the optimizer puts order A first, order B loses its CURRENT status and its action buttons are locked.

**#10 — No mutex:** `isArranging` is React state — it's set asynchronously. Two rapid taps both pass the `if (isArranging) return` check before the first tap's state update propagates, launching two concurrent arrange operations.

**#29 — Freeze guard broken in production:** `driverLocationStore.isSimulationRunning && isArranged` is always `false` in production because `isSimulationRunning` is only `true` in the simulator.

### Design

#### `useRouteArrangement.ts`

**Mutex via ref (synchronous guard):**

```ts
const isArrangingRef = useRef(false);  // synchronous mutex

const arrangeRoute = useCallback(async () => {
  // Mutex check — synchronous, not subject to React batching
  if (isArrangingRef.current) {
    console.warn('[ROUTE_ARRANGEMENT] Already arranging — skipping concurrent call');
    return;
  }
  isArrangingRef.current = true;
  setIsArranging(true);  // keep for UI display

  try {
    // ... arrange logic ...
  } finally {
    isArrangingRef.current = false;
    setIsArranging(false);
  }
}, [activeOrders, currentOrderId]);  // add currentOrderId to deps
```

**Production freeze guard:**

Replace:
```ts
if (driverLocationStore.isSimulationRunning && isArranged) { return; }
```

With:
```ts
if (isArranged) {
  // Route already arranged — block re-arrangement unless driver explicitly resets
  console.warn('[ROUTE_ARRANGEMENT] Route already arranged — call resetArrangement() first');
  return;
}
```

This is the correct production behaviour: once a route is arranged, it stays fixed until the driver taps "Reset".

**Preserve in-progress current order:**

Before running the greedy + 2-opt algorithm, check if there is an active in-progress order:

```ts
// Identify the in-progress order (if any)
const IN_PROGRESS_STATUSES = ['in_transit', 'arrived'];
const inProgressOrder = currentOrderId
  ? eligible.find(o => o._id === currentOrderId && IN_PROGRESS_STATUSES.includes(o.orderStatus.toLowerCase()))
  : null;

// Remove in-progress order from the pool to be optimized
const toOptimize = inProgressOrder
  ? eligible.filter(o => o._id !== inProgressOrder._id)
  : eligible;

// Run greedy + 2-opt on remaining orders only
const optimizedRemaining = toOptimize.length > 0
  ? runGreedyAnd2Opt(toOptimize, driverLat, driverLng)
  : [];

// Prepend in-progress order — it is always stop 1
const finalRoute = inProgressOrder
  ? [inProgressOrder._id, ...optimizedRemaining.map(x => x.order._id)]
  : optimizedRemaining.map(x => x.order._id);

const current = inProgressOrder ? inProgressOrder._id : finalRoute[0];
```

**Result:** The driver's active delivery is always stop 1 and always `currentOrderId`. The remaining stops are optimally ordered around it.

### Data Flow

```
Driver is delivering order B (in_transit)
User taps "Arrange Route" (or second tap)
         ↓
isArrangingRef.current === false → proceed
isArrangingRef.current = true (synchronous)
         ↓
isArranged === false → proceed (freeze guard)
         ↓
inProgressOrder = order B (in_transit, matches currentOrderId)
toOptimize = [order A, order C, order D]  (B excluded)
         ↓
greedy + 2-opt on [A, C, D] from driver's location
         ↓
finalRoute = [B, A, C, D]  (B always first)
currentOrderId = B  (preserved)
         ↓
AsyncStorage.setItem(sorted=[B,A,C,D], current=B)
isArrangingRef.current = false
```

### Correctness Properties

- **P5.1** — Two synchronous calls to `arrangeRoute()` result in exactly one arrange operation completing.
- **P5.2** — If `currentOrderId` has status `in_transit` or `arrived`, after `arrangeRoute()` completes, `currentOrderId` is unchanged.
- **P5.3** — If `currentOrderId` has status `in_transit` or `arrived`, after `arrangeRoute()` completes, `sortedOrderIds[0] === currentOrderId`.
- **P5.4** — If `isArranged === true`, calling `arrangeRoute()` returns immediately without modifying state.

---

## Interdependencies

```
Fix 4 (attempt atomicity in DeliveryHomeTab)
  └── depends on Fix 3 (escalation timing) being done first
      because both touch the same handleFailDelivery function

Fix 1 (offline queue persistence)
  └── depends on Fix 2 (backoff mismatch) being done first
      because persisted actions use RETRY_BACKOFF_SECONDS in their retryAvailableAt
      — if the value changes after actions are persisted, the timestamps are wrong
      Fix 2 first ensures all newly persisted actions use the correct 600s value

Fix 5 (route mutex) is independent — can be done in any order
```

**Recommended implementation order:**
1. Fix 2 (backoff) — 1 line change, zero risk
2. Fix 5 (route mutex) — isolated to one file
3. Fix 3 (escalation timing) — isolated to DeliveryHomeTab escalation path
4. Fix 4 (attempt atomicity) — touches useAttemptTracker + DeliveryHomeTab
5. Fix 1 (offline queue) — largest change, depends on all others being stable

---

## Regression Risks

| Risk | Mitigation |
|------|-----------|
| Fix 2: Existing persisted `retryAvailableAt` timestamps use 30s — drivers upgrading mid-session will have stale short timers | Acceptable: timers expire naturally. No migration needed. |
| Fix 4: Moving `incrementAttempt` after API means a crash between API success and `incrementAttempt` leaves count at 0 | Acceptable: driver gets one extra attempt. Better than phantom increment. Server is source of truth via `mergeServerAttempt`. |
| Fix 5: `isArranged` freeze guard blocks re-arrangement after new orders arrive | Acceptable: driver must tap "Reset" then "Arrange" again. This is intentional — prevents mid-delivery reshuffling. |
| Fix 1: Loading queue on mount adds ~1 AsyncStorage read at startup | Negligible. AsyncStorage reads are fast (<5ms). |
| Fix 3: Order stays visible after network-error escalation | Correct behaviour. Driver sees the order, can call customer, waits for sync. |
