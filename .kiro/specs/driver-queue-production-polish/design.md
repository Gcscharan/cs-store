# Design Document — Driver Queue Production Polish

## Overview

Five targeted production fixes for the delivery driver app's queue and order management system. All fixes are already implemented in the codebase. This document captures the design decisions, affected files, and correctness properties that the test suite must validate.

---

## Architecture

The driver queue system spans three layers:

```
DeliveryHomeTab.tsx          ← screen: action handlers, lock guards
  ├── useActionQueue          ← queue persistence, debounce, replay
  ├── useAttemptTracker       ← delivery attempt counts, mergeServerAttempt
  └── useRouteArrangement     ← route ordering, freeze guard, alert debounce

ActiveOrderCard.tsx           ← per-order card: SyncingSkeleton, action buttons
```

---

## Fix 1 — Debounced Persistence Lifecycle Gap

### Problem
`useActionQueue` batches `AsyncStorage` writes with a debounce timer. If the app is backgrounded or killed while the timer is pending, the latest queue state is lost.

### Design
- `flushPersistQueue()` cancels the pending timer and calls `persistQueueNow(queueRef.current)` synchronously.
- An `AppState.addEventListener('change', ...)` subscription calls `flushPersistQueue()` when `nextState` is `'background'` or `'inactive'`.
- The `useEffect` cleanup also calls `flushPersistQueue()` to handle component unmount.

### Affected File
`apps/customer-app/src/hooks/delivery/useActionQueue.ts`

### Correctness Properties
- **Fix check**: For any app lifecycle event where `nextState ∈ {background, inactive}` and a debounce timer is pending, after the handler runs `persistTimerRef.current === null` and `AsyncStorage` contains the latest queue.
- **Preservation**: For all other `nextState` values, behaviour is unchanged.

---

## Fix 2 — Action Guard Over-Blocking

### Problem
`hasPendingActionsForOrder(orderId)` returned `true` for any pending action on an order, including same-type retries. This prevented drivers from re-submitting an identical action after an offline failure.

### Design
`hasPendingActionsForOrder(orderId, currentActionType?)` now returns `true` only when there is a pending action whose `action` field **differs** from `currentActionType`:

```ts
return queueRef.current.some(
  a => a.orderId === orderId && a.action !== currentActionType
);
```

`acquireOrderLock(orderId, actionType)` in `DeliveryHomeTab.tsx` passes the current action type so same-type retries are allowed while cross-type conflicts are still blocked.

### Affected Files
- `apps/customer-app/src/hooks/delivery/useActionQueue.ts`
- `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`

### Correctness Properties
- **Fix check**: When the only pending action for an order has the same type as `currentActionType`, `hasPendingActionsForOrder` returns `false`.
- **Preservation**: When a pending action of a **different** type exists, the function still returns `true`.

---

## Fix 3 — `mergeServerAttempt` Performance Guard

### Problem
`mergeServerAttempt` was called for every order on every `activeOrders` change, performing `AsyncStorage` reads and writes even when the server count equalled the local count.

### Design
`mergeServerAttempt(orderId, serverCount)` in `useAttemptTracker` skips `writeStore` when `serverCount <= local.attemptCount`:

```ts
if (!local || serverCount > local.attemptCount) {
  await writeStore({ ...current, [orderId]: next });
}
```

The `useEffect` in `DeliveryHomeTab.tsx` already guards the call site with `serverCount > 0`, but the inner guard is the authoritative performance gate.

### Affected File
`apps/customer-app/src/hooks/delivery/useAttemptTracker.ts`

### Correctness Properties
- **Fix check**: When `serverCount <= localCount`, `AsyncStorage.setItem` is not called.
- **Preservation**: When `serverCount > localCount`, the store is updated and persisted as before.

---

## Fix 4 — Route Freeze Alert Spam

### Problem
Tapping "Arrange Route" rapidly while `isArranged === true` fired an `Alert.alert` on every tap, stacking identical dialogs.

### Design
`lastRouteAlertRef = useRef(0)` tracks the timestamp of the last alert. Inside `arrangeRoute()`, the alert fires only when `Date.now() - lastRouteAlertRef.current > 2_000`:

```ts
const now = Date.now();
if (now - lastRouteAlertRef.current > 2_000) {
  lastRouteAlertRef.current = now;
  Alert.alert('Route Already Arranged', ...);
}
```

A `useRef` is used (not `useState`) because the guard must be synchronous — React state updates are async and cannot prevent a second tap from entering the alert branch before the first render completes.

### Affected File
`apps/customer-app/src/hooks/delivery/useRouteArrangement.ts`

### Correctness Properties
- **Fix check**: For any tap where `isArranged === true` and `elapsed < 2000 ms`, `Alert.alert` is not called.
- **Preservation**: The first tap after the 2-second cooldown still shows the alert exactly once.

---

## Fix 5 — SyncingSkeleton Elapsed Time

### Problem
`SyncingSkeleton` showed only "Syncing state…" with no indication of elapsed time, increasing driver anxiety during long sync states.

### Design
`SyncingSkeleton` tracks elapsed seconds with a `setInterval` ticker:

```ts
const [elapsedSec, setElapsedSec] = React.useState(0);
const startTimeRef = React.useRef(Date.now());

React.useEffect(() => {
  const ticker = setInterval(() => {
    setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
  }, 1_000);
  return () => clearInterval(ticker);
}, []);
```

Display logic:
- `elapsedSec === 0` → "Syncing state…"
- `elapsedSec > 0` → "Still syncing… (Xs)"

On retry, `startTimeRef.current` is reset to `Date.now()` and `elapsedSec` is reset to `0`.

### Affected File
`apps/customer-app/src/components/delivery/StateCard/ActiveOrderCard.tsx`

### Correctness Properties
- **Fix check**: For any `elapsedMs >= 1000`, the rendered text contains `"Still syncing… (${Math.floor(elapsedMs/1000)}s)"`.
- **Preservation**: For `elapsedMs < 1000`, the rendered text is `"Syncing state…"`.

---

## Test Strategy

Each fix has a corresponding property-based test (PBT) using `fast-check` that encodes the bug condition and validates both fix-checking and preservation-checking properties.

| Fix | Test File | Property |
|-----|-----------|----------|
| 1 — Lifecycle flush | `useActionQueue.lifecycle.property.test.ts` | Flush on background/inactive |
| 2 — Action guard | `useActionQueue.actionGuard.property.test.ts` | Same-type retry allowed; cross-type blocked |
| 3 — mergeServerAttempt | `useAttemptTracker.properties.test.ts` | No write when server ≤ local |
| 4 — Alert debounce | `useRouteArrangement.alertDebounce.property.test.ts` | At most one alert per 2s window |
| 5 — Elapsed time | `syncingSkeleton.elapsedTime.property.test.ts` | Correct text after 1s |

Existing tests already cover Fixes 3, 4 (route freeze), and 5 (skeleton exclusivity). New PBT files are needed for Fixes 1, 2, and the elapsed-time variant of Fix 5.
