# Bugfix Requirements Document

## Introduction

This document captures five production edge cases and UX polish issues in the delivery driver app's queue and order management system. The issues span persistence lifecycle gaps, action guard logic, sync performance, alert spam, and syncing UX feedback. Each fix is scoped to a specific, observable defect with clear regression boundaries.

---

## Bug Analysis

### Current Behavior (Defect)

**Issue 1 — Debounced persistence lifecycle gap**

1.1 WHEN the app is backgrounded or killed while a debounce timer is pending in `useActionQueue` THEN the system loses the latest queue state because `persistQueueNow` never fires before the process is terminated

1.2 WHEN the app is unmounted while a debounce timer is pending THEN the system loses any queued actions that were written since the last debounce flush

**Issue 2 — Action guard over-blocking**

2.1 WHEN a driver taps the same action button again for an order that already has a pending action of the same type in the queue THEN the system blocks the retry with an "Action Pending Sync" alert, preventing the driver from re-submitting an identical action (e.g. re-tapping "Pickup" after an offline failure)

2.2 WHEN `hasPendingActionsForOrder(orderId)` is called without a `currentActionType` argument THEN the system returns `true` for any pending action on that order, including same-type retries that should be allowed

**Issue 3 — `mergeServerAttempt` performance guard missing**

3.1 WHEN `activeOrders` changes and every order has a `deliveryAttempts` value greater than zero THEN the system calls `mergeServerAttempt` for every order on every render cycle, triggering unnecessary `AsyncStorage` reads and writes even when the server count equals the local count

3.2 WHEN the server attempt count equals the local attempt count THEN the system still performs a full `ensureLoaded` + `writeStore` cycle inside `mergeServerAttempt`, causing redundant I/O

**Issue 4 — Route freeze alert spam**

4.1 WHEN a driver taps the "Arrange Route" button multiple times in rapid succession while `isArranged` is already `true` THEN the system fires an `Alert.alert` call on every tap, producing a stack of identical "Route Already Arranged" dialogs

4.2 WHEN a driver taps the "Arrange Route" button twice within less than 2 seconds while a route is already arranged THEN the system shows two separate alert dialogs instead of suppressing the duplicate

**Issue 5 — SyncingSkeleton shows no elapsed time**

5.1 WHEN `allowedActions` is absent from the server response and the `SyncingSkeleton` component is displayed THEN the system shows only "Syncing state…" with no indication of how long the driver has been waiting, increasing driver anxiety during long sync states

5.2 WHEN the syncing state persists beyond 1 second THEN the system continues to display the static "Syncing state…" message without updating to reflect elapsed time

---

### Expected Behavior (Correct)

**Issue 1 — Debounced persistence lifecycle gap**

1.3 WHEN the app transitions to `background` or `inactive` AppState THEN the system SHALL immediately flush any pending debounced persistence write by cancelling the timer and calling `persistQueueNow` synchronously with the current queue state

1.4 WHEN the `useActionQueue` hook unmounts THEN the system SHALL flush any pending debounced persistence write so that no queued actions are lost on component teardown

**Issue 2 — Action guard correctness**

2.3 WHEN `hasPendingActionsForOrder(orderId, currentActionType)` is called and the only pending action for that order has the same `action` type as `currentActionType` THEN the system SHALL return `false`, allowing the driver to retry the same action

2.4 WHEN `hasPendingActionsForOrder(orderId, currentActionType)` is called and there is a pending action of a different type for that order THEN the system SHALL return `true`, blocking the forward transition

2.5 WHEN `acquireOrderLock` is called with an `actionType` that matches the type of the only pending action for that order THEN the system SHALL acquire the lock and allow the action to proceed

**Issue 3 — `mergeServerAttempt` performance guard**

3.3 WHEN `mergeServerAttempt(orderId, serverCount)` is called and `serverCount` is less than or equal to the local `attemptCount` THEN the system SHALL skip the `writeStore` call entirely, producing zero `AsyncStorage` writes for that invocation

3.4 WHEN `mergeServerAttempt(orderId, serverCount)` is called and `serverCount` is strictly greater than the local `attemptCount` THEN the system SHALL update the local state and persist the new count to `AsyncStorage`

**Issue 4 — Route freeze alert debounce**

4.3 WHEN a driver taps "Arrange Route" while a route is already arranged THEN the system SHALL show at most one "Route Already Arranged" alert per 2-second window, suppressing any additional taps within that cooldown period using `lastRouteAlertRef`

4.4 WHEN 2 seconds have elapsed since the last route-freeze alert THEN the system SHALL allow the next tap to show the alert again

**Issue 5 — SyncingSkeleton elapsed time**

5.3 WHEN `allowedActions` is absent and the `SyncingSkeleton` is displayed for more than 0 seconds THEN the system SHALL show "Still syncing… (Xs)" where X is the number of whole seconds elapsed since the skeleton first appeared

5.4 WHEN the `SyncingSkeleton` first renders THEN the system SHALL show "Syncing state…" for the first second before switching to the elapsed-time format

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the app is in the `active` foreground state and a new action is enqueued THEN the system SHALL CONTINUE TO write immediately via `persistQueueNow` without waiting for any debounce timer

3.2 WHEN the app returns to the foreground after being backgrounded THEN the system SHALL CONTINUE TO load and replay the persisted queue normally

3.3 WHEN `hasPendingActionsForOrder(orderId, currentActionType)` is called and there are no pending actions for that order THEN the system SHALL CONTINUE TO return `false`, allowing all actions to proceed

3.4 WHEN `hasPendingActionsForOrder(orderId, currentActionType)` is called and there is a pending action of a different type THEN the system SHALL CONTINUE TO return `true` and block the conflicting forward transition

3.5 WHEN `mergeServerAttempt` is called with a server count strictly greater than the local count THEN the system SHALL CONTINUE TO update local state and persist the higher count

3.6 WHEN a driver taps "Arrange Route" for the first time (no route arranged yet) THEN the system SHALL CONTINUE TO run the full route arrangement algorithm without any alert

3.7 WHEN a driver taps "Reset" and then "Arrange Route" again THEN the system SHALL CONTINUE TO arrange a new route normally

3.8 WHEN `SyncingSkeleton` times out after 10 seconds THEN the system SHALL CONTINUE TO show the "Refresh" button and escalate to the give-up message after `GIVE_UP_RETRIES` retries

3.9 WHEN `SyncingSkeleton` is retried via the "Refresh" button THEN the system SHALL CONTINUE TO reset the elapsed timer to zero and re-arm the 10-second timeout

---

## Bug Condition Pseudocode

### Issue 1 — Debounced Persistence Lifecycle Gap

```pascal
FUNCTION isBugCondition_1(appEvent)
  INPUT: appEvent of type AppLifecycleEvent
  OUTPUT: boolean

  RETURN appEvent.nextState IN ['background', 'inactive']
         AND persistTimerRef.current IS NOT NULL
END FUNCTION

// Property: Fix Checking
FOR ALL appEvent WHERE isBugCondition_1(appEvent) DO
  result ← handleAppStateChange'(appEvent)
  ASSERT persistTimerRef.current = NULL
  ASSERT AsyncStorage contains latest queueRef.current
END FOR

// Property: Preservation Checking
FOR ALL appEvent WHERE NOT isBugCondition_1(appEvent) DO
  ASSERT handleAppStateChange(appEvent) = handleAppStateChange'(appEvent)
END FOR
```

### Issue 2 — Action Guard Over-Blocking

```pascal
FUNCTION isBugCondition_2(orderId, currentActionType)
  INPUT: orderId: string, currentActionType: string
  OUTPUT: boolean

  pendingActions ← queue.filter(a => a.orderId = orderId)
  RETURN pendingActions.length > 0
         AND pendingActions.every(a => a.action = currentActionType)
END FUNCTION

// Property: Fix Checking — same-type retry must be allowed
FOR ALL (orderId, actionType) WHERE isBugCondition_2(orderId, actionType) DO
  result ← hasPendingActionsForOrder'(orderId, actionType)
  ASSERT result = FALSE
END FOR

// Property: Preservation Checking — different-type must still be blocked
FOR ALL (orderId, actionType) WHERE NOT isBugCondition_2(orderId, actionType)
                                AND queue.some(a => a.orderId = orderId AND a.action ≠ actionType) DO
  ASSERT hasPendingActionsForOrder'(orderId, actionType) = TRUE
END FOR
```

### Issue 3 — `mergeServerAttempt` Performance Guard

```pascal
FUNCTION isBugCondition_3(orderId, serverCount)
  INPUT: orderId: string, serverCount: number
  OUTPUT: boolean

  localCount ← store[orderId]?.attemptCount ?? 0
  RETURN serverCount <= localCount
END FUNCTION

// Property: Fix Checking — no write when server count is not higher
FOR ALL (orderId, serverCount) WHERE isBugCondition_3(orderId, serverCount) DO
  writesBefore ← AsyncStorage.writeCount
  mergeServerAttempt'(orderId, serverCount)
  ASSERT AsyncStorage.writeCount = writesBefore
END FOR

// Property: Preservation Checking — write still happens when server is ahead
FOR ALL (orderId, serverCount) WHERE NOT isBugCondition_3(orderId, serverCount) DO
  ASSERT mergeServerAttempt(orderId, serverCount) = mergeServerAttempt'(orderId, serverCount)
END FOR
```

### Issue 4 — Route Freeze Alert Spam

```pascal
FUNCTION isBugCondition_4(tapEvent)
  INPUT: tapEvent of type ArrangeRouteTap
  OUTPUT: boolean

  RETURN isArranged = TRUE
         AND (tapEvent.timestamp - lastRouteAlertRef.current) < 2000
END FUNCTION

// Property: Fix Checking — no alert within 2s cooldown
FOR ALL tapEvent WHERE isBugCondition_4(tapEvent) DO
  alertsBefore ← Alert.callCount
  arrangeRoute'()
  ASSERT Alert.callCount = alertsBefore
END FOR

// Property: Preservation Checking — first tap still shows alert
FOR ALL tapEvent WHERE NOT isBugCondition_4(tapEvent) AND isArranged = TRUE DO
  ASSERT arrangeRoute(tapEvent) = arrangeRoute'(tapEvent)  // alert fires once
END FOR
```

### Issue 5 — SyncingSkeleton Elapsed Time

```pascal
FUNCTION isBugCondition_5(elapsedMs)
  INPUT: elapsedMs: number
  OUTPUT: boolean

  RETURN elapsedMs >= 1000
END FUNCTION

// Property: Fix Checking — elapsed time shown after 1s
FOR ALL elapsedMs WHERE isBugCondition_5(elapsedMs) DO
  displayedText ← SyncingSkeleton'.render(elapsedMs)
  expectedSec   ← FLOOR(elapsedMs / 1000)
  ASSERT displayedText CONTAINS "Still syncing… (" + expectedSec + "s)"
END FOR

// Property: Preservation Checking — initial state unchanged
FOR ALL elapsedMs WHERE NOT isBugCondition_5(elapsedMs) DO
  ASSERT SyncingSkeleton.render(elapsedMs) = SyncingSkeleton'.render(elapsedMs)
  // "Syncing state…" shown for first second
END FOR
```
