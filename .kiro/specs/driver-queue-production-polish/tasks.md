# Implementation Tasks — Driver Queue Production Polish

## Overview

All five production fixes are already implemented in the codebase. The remaining work is to write the missing property-based tests that validate the bug conditions and correctness properties defined in the bugfix requirements.

---

- [x] 1. Write bug condition exploration property test for Fix 1 (lifecycle flush)
  - [x] 1.1 Create `useActionQueue.lifecycle.property.test.ts` in `apps/customer-app/src/hooks/delivery/__tests__/`
  - [x] 1.2 Implement `isBugCondition_1` predicate: `nextState ∈ {background, inactive}` AND a debounce timer is pending
  - [x] 1.3 Write fix-checking property: for all events where `isBugCondition_1` is true, after `flushPersistQueue` runs, `persistTimerRef.current === null` and `AsyncStorage` contains the latest queue state
  - [x] 1.4 Write preservation property: for all `nextState` values NOT in `{background, inactive}`, the handler behaviour is unchanged (no flush triggered)
  - [x] 1.5 Write unmount property: when the `useEffect` cleanup runs with a pending timer, `persistQueueNow` is called with the current queue contents
  - [x] 1.6 Write crash-window property: `enqueue() → debounce pending → AppState background → process kill → restart` THEN `restoredQueue === latestQueueBeforeKill` (validates true production invariant)
  - [x] 1.7 Run the test suite and confirm all properties pass with ≥ 100 iterations each

- [x] 2. Write bug condition exploration property test for Fix 2 (action guard) **[HIGHEST PRIORITY]**
  - [x] 2.1 Create `useActionQueue.actionGuard.property.test.ts` in `apps/customer-app/src/hooks/delivery/__tests__/`
  - [x] 2.2 Implement `isBugCondition_2` predicate: all pending actions for `orderId` have the same `action` type as `currentActionType`
  - [x] 2.3 Write fix-checking property: when `isBugCondition_2` is true, `hasPendingActionsForOrder(orderId, currentActionType)` returns `false`
  - [x] 2.4 Write preservation property (cross-type block): when a pending action of a **different** type exists, `hasPendingActionsForOrder` still returns `true`
  - [x] 2.5 Write preservation property (no pending actions): when the queue has no actions for `orderId`, `hasPendingActionsForOrder` returns `false`
  - [x] 2.6 Write `acquireOrderLock` integration property: when `isBugCondition_2` is true, `acquireOrderLock(orderId, actionType)` returns `true` (lock acquired, no alert)
  - [x] 2.7 Write FIFO ordering property: actions replay in FIFO order per `orderId` — `pickup → arrived → otp` must never become `arrived → pickup` even under retries, backoff, or queue reconstruction
  - [x] 2.8 Run the test suite and confirm all properties pass with ≥ 100 iterations each

- [x] 3. Write elapsed-time property test for Fix 5 (SyncingSkeleton timer)
  - [x] 3.1 Create `syncingSkeleton.elapsedTime.property.test.ts` in `apps/customer-app/src/components/delivery/StateCard/__tests__/`
  - [x] 3.2 Implement `isBugCondition_5` predicate: `elapsedMs >= 1000`
  - [x] 3.3 Write fix-checking property: for all `elapsedMs >= 1000`, the rendered text contains `"Still syncing… (${Math.floor(elapsedMs / 1000)}s)"`
  - [x] 3.4 Write preservation property: for all `elapsedMs < 1000`, the rendered text is `"Syncing state…"`
  - [x] 3.5 Write retry-reset property: after `handleRetry` is called, `elapsedSec` resets to `0` and the text reverts to `"Syncing state…"`
  - [x] 3.6 Write monotonicity property: `elapsedSec` is non-decreasing between ticks (never goes backwards)
  - [x] 3.7 Run the test suite and confirm all properties pass with ≥ 100 iterations each

- [x] 4. Add missing property to Fix 3 (mergeServerAttempt write-once guarantee)
  - [x] 4.1 Open `useAttemptTracker.properties.test.ts`
  - [x] 4.2 Add write-once property: when `serverCount > localCount`, `AsyncStorage.setItem` is called **exactly once** (not zero, not multiple times)
  - [x] 4.3 Run the test and confirm it passes with ≥ 100 iterations

- [x] 5. Verify all existing tests still pass
  - [x] 5.1 Run `useAttemptTracker.properties.test.ts` — Fix 3 (mergeServerAttempt no-write guard + write-once)
  - [x] 5.2 Run `useRouteArrangement.routeFreeze.property.test.ts` — Fix 4 (alert debounce freeze guard)
  - [x] 5.3 Run `syncingSkeleton.property.test.ts` and `SyncingSkeleton.test.ts` — Fix 5 (skeleton exclusivity)
  - [x] 5.4 Run `useActionQueue.offlineEscalation.test.ts` — regression check for queue replay
  - [x] 5.5 Run `useAttemptTracker.test.ts` and `useAttemptTracker.cleanup.test.ts` — regression check for attempt tracking
  - [x] 5.6 Confirm zero test failures across all delivery hook and component test files

- [x] 6. Manual chaos testing (execute personally, document results)
  - [x] 6.1 **Chaos Test 1 — Offline Crash Recovery**: airplane mode → pickup → arrived → kill app → reopen → reconnect → ASSERT: queue restored, replay ordered, no duplicates
  - [x] 6.2 **Chaos Test 2 — Rapid Tapping**: spam pickup/fail/arrived buttons → ASSERT: exactly one active mutation, no duplicate queue entries
  - [x] 6.3 **Chaos Test 3 — Route Freeze**: arrange route → tap arrange 10x rapidly → ASSERT: one alert max every 2s, route unchanged
  - [x] 6.4 **Chaos Test 4 — Attempt Drift**: simulate local=1, server=2 → ASSERT: local becomes 2, exactly one write
  - [x] 6.5 Document all chaos test results in a `CHAOS_TEST_RESULTS.md` file in the spec directory
