# Chaos Test Results — Driver Queue Production Polish

## Overview

This document provides comprehensive manual chaos testing procedures for validating the five production fixes in the delivery driver app's queue and order management system. Each test scenario is designed to stress-test edge cases and verify that the implemented fixes handle real-world chaos conditions correctly.

**Test Execution Date**: _[To be filled in during manual testing]_  
**Tester**: _[To be filled in during manual testing]_  
**App Version**: _[To be filled in during manual testing]_  
**Device/Simulator**: _[To be filled in during manual testing]_

---

## Chaos Test 1 — Offline Crash Recovery

### Purpose
Validates **Fix 1 (Debounced Persistence Lifecycle Gap)** by ensuring that queued actions survive app termination and are replayed in correct order after reconnection.

### Bug Being Tested
Previously, if the app was backgrounded or killed while a debounce timer was pending, the latest queue state would be lost because `persistQueueNow` never fired before process termination.

### Prerequisites
- Driver app installed and logged in
- At least one active delivery order assigned
- Ability to toggle airplane mode or disable network
- Ability to force-quit the app

### Test Procedure

#### Step 1: Prepare Offline Environment
1. Open the driver app and navigate to the delivery home screen
2. Verify you have at least one active order in "Assigned" state
3. Enable airplane mode or disable all network connections
4. Confirm the app shows offline indicators (if any)

#### Step 2: Queue Multiple Actions Offline
1. Tap the **"Pickup"** button on the order
2. Wait 1-2 seconds for the action to be queued (you should see a syncing indicator)
3. Tap the **"Arrived"** button on the same order
4. Wait 1-2 seconds
5. **Immediately force-quit the app** (swipe up from app switcher or force stop)
   - This simulates a crash while the debounce timer is still pending

#### Step 3: Restart and Reconnect
1. Reopen the driver app
2. Wait for the app to fully load
3. Disable airplane mode / re-enable network
4. Wait for the app to reconnect to the server

#### Step 4: Verify Queue Restoration and Replay
1. Observe the order card during reconnection
2. Watch for the queued actions to replay

### Expected Results

✅ **PASS Criteria:**
- [ ] The app restores both "Pickup" and "Arrived" actions from the queue
- [ ] Actions replay in the correct FIFO order: Pickup → Arrived
- [ ] No duplicate actions are sent to the server
- [ ] The order progresses through states correctly: Assigned → Picked Up → Arrived
- [ ] No "Action Pending Sync" alerts block the replay
- [ ] The queue is cleared after successful replay

❌ **FAIL Indicators:**
- Actions are lost (order remains in "Assigned" state)
- Actions replay in wrong order (Arrived before Pickup)
- Duplicate actions are sent (server receives multiple Pickup requests)
- App crashes or freezes during replay

### Actual Results
```
[To be filled in during manual testing]

Date/Time: 
Tester: 
Result: PASS / FAIL
Notes:




```

---

## Chaos Test 2 — Rapid Tapping

### Purpose
Validates **Fix 2 (Action Guard Over-Blocking)** by ensuring that same-type action retries are allowed while preventing duplicate queue entries and conflicting cross-type actions.

### Bug Being Tested
Previously, `hasPendingActionsForOrder` blocked all actions on an order if any action was pending, preventing drivers from retrying the same action after an offline failure.

### Prerequisites
- Driver app installed and logged in
- At least one active delivery order assigned
- Ability to tap buttons rapidly (or use accessibility tools for rapid tapping)

### Test Procedure

#### Step 1: Test Same-Type Retry (Should Succeed)
1. Open the driver app and navigate to an order in "Assigned" state
2. Enable airplane mode to simulate offline
3. Tap the **"Pickup"** button once
4. Wait 1 second for the action to queue
5. Tap the **"Pickup"** button again (same action type)
6. Observe the behavior

#### Step 2: Test Cross-Type Blocking (Should Block)
1. With the same order still in offline mode
2. Tap the **"Arrived"** button (different action type)
3. Observe the behavior

#### Step 3: Test Rapid Spam (Should Deduplicate)
1. Disable airplane mode to go back online
2. Wait for the queue to clear
3. Rapidly tap the **"Pickup"** button 10 times in quick succession
4. Observe the network requests and queue state

#### Step 4: Test Multiple Orders
1. If you have multiple active orders, repeat steps 1-3 for different orders
2. Verify that actions on one order don't block actions on another order

### Expected Results

✅ **PASS Criteria:**
- [ ] Same-type retry (Pickup → Pickup) is allowed without "Action Pending Sync" alert
- [ ] Cross-type action (Pickup pending → Arrived tap) shows "Action Pending Sync" alert
- [ ] Rapid tapping results in exactly ONE active mutation at a time
- [ ] No duplicate queue entries for the same action
- [ ] Actions on different orders don't interfere with each other
- [ ] The order lock is acquired correctly for each action

❌ **FAIL Indicators:**
- Same-type retry is blocked with "Action Pending Sync" alert
- Cross-type action is allowed (should be blocked)
- Multiple mutations are sent simultaneously
- Duplicate queue entries appear
- App crashes or becomes unresponsive

### Actual Results
```
[To be filled in during manual testing]

Date/Time: 
Tester: 
Result: PASS / FAIL
Notes:




```

---

## Chaos Test 3 — Route Freeze

### Purpose
Validates **Fix 4 (Route Freeze Alert Spam)** by ensuring that the "Route Already Arranged" alert is shown at most once per 2-second window, preventing alert stacking.

### Bug Being Tested
Previously, tapping "Arrange Route" multiple times rapidly while a route was already arranged would fire an `Alert.alert` on every tap, producing a stack of identical dialogs.

### Prerequisites
- Driver app installed and logged in
- Multiple active delivery orders assigned (at least 3-4 orders)
- Route arrangement feature enabled

### Test Procedure

#### Step 1: Arrange Initial Route
1. Open the driver app and navigate to the delivery home screen
2. Verify you have multiple active orders
3. Tap the **"Arrange Route"** button
4. Wait for the route to be arranged (orders should reorder)
5. Verify `isArranged` state is now `true` (button may change appearance)

#### Step 2: Rapid Tap Test (Within 2-Second Window)
1. Immediately tap the **"Arrange Route"** button 10 times rapidly (within 2 seconds)
2. Count the number of alert dialogs that appear
3. Dismiss any alerts that appear

#### Step 3: Cooldown Test (After 2-Second Window)
1. Wait for 3 seconds (to exceed the 2-second cooldown)
2. Tap the **"Arrange Route"** button once
3. Observe if an alert appears

#### Step 4: Reset and Re-Arrange Test
1. Tap the **"Reset"** button (if available) to clear the arranged state
2. Tap **"Arrange Route"** again
3. Verify the route is arranged normally without any alert

### Expected Results

✅ **PASS Criteria:**
- [ ] First tap on arranged route shows "Route Already Arranged" alert
- [ ] Subsequent taps within 2 seconds show NO additional alerts (suppressed)
- [ ] After 2-second cooldown, next tap shows the alert again
- [ ] At most ONE alert is visible at any time (no stacking)
- [ ] Route order remains unchanged during rapid tapping
- [ ] Reset → Arrange works normally without alerts

❌ **FAIL Indicators:**
- Multiple alert dialogs stack on top of each other
- Alert appears on every tap within 2 seconds
- Alert never appears (over-suppressed)
- Route order changes unexpectedly
- App crashes or freezes

### Actual Results
```
[To be filled in during manual testing]

Date/Time: 
Tester: 
Result: PASS / FAIL
Notes:




```

---

## Chaos Test 4 — Attempt Drift

### Purpose
Validates **Fix 3 (mergeServerAttempt Performance Guard)** by ensuring that the system correctly syncs server attempt counts without redundant AsyncStorage writes.

### Bug Being Tested
Previously, `mergeServerAttempt` was called for every order on every render, performing AsyncStorage reads and writes even when the server count equaled the local count.

### Prerequisites
- Driver app installed and logged in
- At least one active delivery order
- Ability to inspect AsyncStorage writes (via debugging tools or logs)
- Ability to simulate server state changes

### Test Procedure

#### Step 1: Establish Baseline State
1. Open the driver app and navigate to an order
2. Note the current delivery attempt count (should be 0 or 1)
3. If using debugging tools, monitor AsyncStorage write operations

#### Step 2: Simulate Server Ahead (Should Write)
1. Using a backend admin tool or API, increment the server's `deliveryAttempts` count for the order to 2
2. Trigger a refresh in the app (pull to refresh or wait for auto-refresh)
3. Observe the local attempt count update
4. If monitoring, verify that AsyncStorage.setItem was called EXACTLY ONCE

#### Step 3: Simulate Server Equal (Should NOT Write)
1. Ensure local and server counts are now equal (both at 2)
2. Trigger multiple refreshes (pull to refresh 5 times)
3. If monitoring, verify that AsyncStorage.setItem is NOT called on subsequent refreshes

#### Step 4: Simulate Server Behind (Should NOT Write)
1. Using debugging tools, manually set the local attempt count to 3
2. Ensure the server count remains at 2
3. Trigger a refresh
4. Verify that the local count remains at 3 (not overwritten)
5. Verify that AsyncStorage.setItem is NOT called

### Expected Results

✅ **PASS Criteria:**
- [ ] When server count > local count: local updates to match server, exactly ONE AsyncStorage write
- [ ] When server count = local count: no AsyncStorage writes on refresh
- [ ] When server count < local count: local count is preserved, no AsyncStorage writes
- [ ] No redundant writes during multiple refreshes with equal counts
- [ ] App performance remains smooth (no lag from excessive I/O)

❌ **FAIL Indicators:**
- AsyncStorage writes occur when server count equals local count
- Multiple writes occur for a single server update
- Local count is incorrectly overwritten when server is behind
- App lags or freezes during refresh
- Attempt count becomes inconsistent

### Actual Results
```
[To be filled in during manual testing]

Date/Time: 
Tester: 
Result: PASS / FAIL
Notes:




```

---

## Chaos Test 5 — Syncing Elapsed Time (Bonus)

### Purpose
Validates **Fix 5 (SyncingSkeleton Elapsed Time)** by ensuring that the syncing indicator shows elapsed time after 1 second, reducing driver anxiety during long sync states.

### Bug Being Tested
Previously, `SyncingSkeleton` showed only "Syncing state…" with no indication of elapsed time, leaving drivers uncertain about sync progress.

### Prerequisites
- Driver app installed and logged in
- Ability to trigger a syncing state (e.g., by having `allowedActions` absent from server response)
- Ability to observe the syncing skeleton for extended periods

### Test Procedure

#### Step 1: Trigger Syncing State
1. Open the driver app and navigate to an order
2. Trigger a condition where `allowedActions` is absent (may require backend manipulation or specific order state)
3. Observe the `SyncingSkeleton` component appear

#### Step 2: Observe Initial State (0-1 Second)
1. Immediately observe the text displayed
2. Verify it shows "Syncing state…" (no elapsed time)

#### Step 3: Observe Elapsed Time (After 1 Second)
1. Wait for 1 second
2. Observe the text change to "Still syncing… (1s)"
3. Continue observing for 5-10 seconds
4. Verify the elapsed time increments: (2s), (3s), (4s), etc.

#### Step 4: Test Retry Reset
1. Tap the "Refresh" button (if available after timeout)
2. Verify the elapsed time resets to 0
3. Verify the text reverts to "Syncing state…"
4. Verify the timer starts counting again

### Expected Results

✅ **PASS Criteria:**
- [ ] Initial display (0-1s): "Syncing state…"
- [ ] After 1 second: "Still syncing… (1s)"
- [ ] Elapsed time increments every second: (2s), (3s), (4s), etc.
- [ ] Elapsed time is monotonically increasing (never goes backwards)
- [ ] Retry resets the timer to 0 and restarts counting
- [ ] Timer stops when syncing completes

❌ **FAIL Indicators:**
- Elapsed time never appears (stuck on "Syncing state…")
- Elapsed time is incorrect or jumps erratically
- Timer continues running after sync completes
- Retry doesn't reset the timer
- App crashes or freezes

### Actual Results
```
[To be filled in during manual testing]

Date/Time: 
Tester: 
Result: PASS / FAIL
Notes:




```

---

## Summary Template

### Overall Test Results

| Test | Status | Notes |
|------|--------|-------|
| Chaos Test 1 — Offline Crash Recovery | ⬜ PASS / ⬜ FAIL | |
| Chaos Test 2 — Rapid Tapping | ⬜ PASS / ⬜ FAIL | |
| Chaos Test 3 — Route Freeze | ⬜ PASS / ⬜ FAIL | |
| Chaos Test 4 — Attempt Drift | ⬜ PASS / ⬜ FAIL | |
| Chaos Test 5 — Syncing Elapsed Time | ⬜ PASS / ⬜ FAIL | |

### Critical Issues Found
```
[List any critical issues discovered during testing]




```

### Recommendations
```
[List any recommendations for additional testing or fixes]




```

### Sign-Off

**Tester Name**: _________________________  
**Date**: _________________________  
**Signature**: _________________________

---

## Appendix: Debugging Tips

### Monitoring AsyncStorage Writes
To monitor AsyncStorage operations during Chaos Test 4:

```javascript
// Add to useAttemptTracker.ts temporarily
console.log('[AttemptTracker] mergeServerAttempt called', { orderId, serverCount, localCount });
```

### Monitoring Queue State
To monitor queue operations during Chaos Tests 1 and 2:

```javascript
// Add to useActionQueue.ts temporarily
console.log('[ActionQueue] Current queue:', queueRef.current);
console.log('[ActionQueue] Persist called:', { queueLength: queue.length });
```

### Monitoring Alert Calls
To monitor alert debouncing during Chaos Test 3:

```javascript
// Add to useRouteArrangement.ts temporarily
console.log('[RouteArrangement] Alert check', { 
  isArranged, 
  elapsed: Date.now() - lastRouteAlertRef.current,
  willShow: Date.now() - lastRouteAlertRef.current > 2000 
});
```

### Force Syncing State
To trigger the syncing skeleton for Chaos Test 5:

```javascript
// Temporarily modify the server response to omit allowedActions
// Or use a backend admin tool to set the order to a state where allowedActions is absent
```

---

## Notes for Testers

1. **Test Environment**: These tests should be performed on a staging or development environment, not production.

2. **Device Variations**: Consider testing on multiple devices (iOS/Android) and different network conditions (WiFi, cellular, offline).

3. **Timing Sensitivity**: Some tests (especially Chaos Test 3) are timing-sensitive. Use a stopwatch or timer to ensure accurate 2-second intervals.

4. **Documentation**: Take screenshots or screen recordings of test execution for documentation purposes.

5. **Reproducibility**: If a test fails, attempt to reproduce the failure at least twice to confirm it's not a fluke.

6. **Server State**: Some tests may require backend manipulation. Coordinate with backend developers to set up appropriate test conditions.

7. **Cleanup**: After testing, ensure all test data is cleaned up and the app is returned to a normal state.

---

**Document Version**: 1.0  
**Last Updated**: [Date to be filled in]  
**Related Spec**: `.kiro/specs/driver-queue-production-polish/`
