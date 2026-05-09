# Implementation Plan: Multi-Attempt Failure Flow

## Overview

This implementation plan transforms the delivery driver app's failure handling from a single-attempt-then-remove model to a configurable retry system with automatic escalation. The implementation preserves critical architectural principles: retry is STATE (not structure), timestamp-based backoff (never timers), single-current invariant preservation, escalation is terminal, and local attempt counts take precedence during offline operation.

## Tasks

- [x] 1. Set up configuration constants and core infrastructure
  - Create `apps/customer-app/src/constants/deliveryConfig.ts` with `MAX_DELIVERY_ATTEMPTS` (default: 3), `RETRY_BACKOFF_ScECONDS` (default: 30), and `COUNTDOWN_UPDATE_INTERVAL` (default: 1000)
  - Add validation logic: MAX_DELIVERY_ATTEMPTS >= 1, RETRY_BACKOFF_SECONDS >= 10
  - Export typed `DELIVERY_CONFIG` constant
  - _Requirements: 2.1, 2.2, 2.3, 3.5_

- [x] 2. Implement useAttemptTracker hook with AsyncStorage persistence
  - [x] 2.1 Create hook interface and storage schema
    - Define `AttemptState` interface with `attemptCount` and `retryAvailableAt`
    - Define `UseAttemptTrackerReturn` interface with all required methods
    - Set AsyncStorage key to `@delivery_attempt_tracker`
    - Implement storage schema as `Record<orderId, AttemptState>`
    - _Requirements: 1.1, 1.4_

  - [x] 2.2 Implement core state management functions
    - Implement `getAttemptState(orderId)` with JSON parse error handling
    - Implement `incrementAttempt(orderId)` to increment count and set `retryAvailableAt = Date.now() + RETRY_BACKOFF_SECONDS * 1000`
    - Implement `removeAttempt(orderId)` to clear entry from storage
    - Implement debounced AsyncStorage writes to minimize I/O
    - _Requirements: 1.2, 1.3, 1.5, 1.6_

  - [x] 2.3 Implement derived state functions
    - Implement `isRetryLocked(orderId)` returning `Date.now() < retryAvailableAt`
    - Implement `getRemainingSeconds(orderId)` returning `Math.ceil((retryAvailableAt - Date.now()) / 1000)`
    - Implement `mergeServerAttempt(orderId, serverCount)` keeping max(local, server) count
    - Implement `cleanup(activeOrderIds)` to remove stale entries
    - _Requirements: 1.7, 3.3, 3.4, 7.5, 8.1_

  - [x] 2.4 Write property tests for useAttemptTracker
    - **Property 1: AsyncStorage Round-Trip Preservation**
    - **Property 2: Server Merge Preserves Maximum Count**
    - **Property 3: Increment Produces Correct State**
    - **Property 4: Remove Clears State**
    - **Property 5: Missing Entry Defaults to Null**
    - **Property 14: Retry Lock Derived from Timestamp**
    - **Property 15: Countdown Calculation from Timestamp**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 3.3, 3.4, 7.5**

  - [x] 2.5 Write unit tests for useAttemptTracker
    - Test incrementAttempt increments count and sets timestamp
    - Test removeAttempt clears entry from storage
    - Test cleanup removes stale entries
    - Test AsyncStorage error handling (missing key, parse error)
    - Test initialization with empty storage
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 8.1_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate attempt tracker into DeliveryHomeTab
  - Import and initialize `useAttemptTracker` hook in `DeliveryHomeTab.tsx`
  - Add cleanup effect that calls `cleanup(activeOrderIds)` when `activeOrders` changes
  - Pass attempt state to `ActiveOrderCard` via props
  - _Requirements: 1.1, 8.1, 8.2, 8.3_

- [x] 5. Modify handleFailDelivery for retry and escalation logic
  - [x] 5.1 Implement attempt increment and decision logic
    - Call `incrementAttempt(orderId)` at start of `handleFailDelivery`
    - Extract `attemptCount` from returned `AttemptState`
    - Add conditional branch: if `attemptCount < MAX_DELIVERY_ATTEMPTS` → retry path, else → escalation path
    - _Requirements: 1.2, 3.1, 5.1_

  - [x] 5.2 Implement retry path (attemptCount < MAX_DELIVERY_ATTEMPTS)
    - Call existing `recordDeliveryAttempt` mutation with `status: 'FAILED'`, `failureReason`, `failureNotes`
    - Keep order in `sortedOrderIds` with retry state (no removal)
    - Show alert: "Attempt recorded. Retry available in {RETRY_BACKOFF_SECONDS} seconds"
    - Preserve auto-advance to next order (handled by `useRouteArrangement`)
    - _Requirements: 3.1, 3.2, 3.7_

  - [x] 5.3 Implement escalation path (attemptCount === MAX_DELIVERY_ATTEMPTS)
    - Call `escalateOrder` mutation with `orderId`, `reason`, `notes`, and unique `idempotencyKey: escalate:${orderId}:${Date.now()}`
    - On success: call `removeAttempt(orderId)`, show alert "Order escalated for reassignment"
    - On network error: enqueue escalation in `useActionQueue`, call `removeAttempt(orderId)`, show alert "Order escalated (will sync when online)"
    - On 4xx server error: show error alert, return early without removing order or attempt state
    - Order removal handled by `invalidatesTags: ['DeliveryOrders']`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.8, 6.1_

  - [x] 5.4 Write property tests for handleFailDelivery
    - **Property 6: Max Attempts Validation Enforces Minimum**
    - **Property 7: Invalid Config Defaults to 3**
    - **Property 8: Retry Preserves Order in Route**
    - **Property 9: Escalation Removes Order and State**
    - **Property 10: Network Error Enqueues Escalation**
    - **Property 11: Server Error Retains Order**
    - **Property 12: Idempotency Keys Are Unique**
    - **Property 13: Cleanup Removes Stale Entries**
    - **Property 20: Current Order Advances on Failure**
    - **Property 21: Offline Failure Increments Local Count**
    - **Property 22: Conflict Response Discards Silently**
    - **Property 23: Terminal State Prevents Re-Addition**
    - **Validates: Requirements 2.2, 2.3, 3.1, 3.7, 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8, 7.1, 7.4, 8.1, 8.2, 8.3**

  - [x] 5.5 Write unit tests for handleFailDelivery
    - Test handleFailDelivery increments attempt on first failure
    - Test handleFailDelivery retains order in route when attemptCount < maxAttempts
    - Test handleFailDelivery calls escalation endpoint when attemptCount === maxAttempts
    - Test handleFailDelivery enqueues escalation on network error
    - Test handleFailDelivery shows correct alerts for retry vs escalation
    - _Requirements: 1.2, 3.1, 5.1, 5.3, 6.1_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create AttemptBadge component
  - [x] 7.1 Implement AttemptBadge component with countdown timer
    - Create `AttemptBadge` component accepting `attemptCount`, `maxAttempts`, `isRetryLocked`, `remainingSeconds` props
    - Implement badge text logic: if `isRetryLocked` → "Retry in {remainingSeconds}s", else if `attemptCount === maxAttempts - 1` → "Final Attempt", else → "Attempt {attemptCount} of {maxAttempts}"
    - Implement badge color logic: if `attemptCount === maxAttempts - 1` → `DELIVERY_COLORS.danger`, else → `DELIVERY_COLORS.warning`
    - Add icon: `alert-circle` for final attempt, `refresh-circle` for others
    - Style badge with appropriate background colors (`dangerBg` or `warningBg`)
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 6.4_

  - [x] 7.2 Write property tests for AttemptBadge
    - **Property 16: Badge Text Format for Active Attempts**
    - **Property 17: Badge Text for Final Attempt**
    - **Property 18: Badge Color for Non-Final Attempts**
    - **Property 19: Badge Color for Final Attempt**
    - **Validates: Requirements 4.1, 4.5, 4.6, 6.4**

  - [x] 7.3 Write unit tests for AttemptBadge
    - Test badge shows "Attempt N of M" when not locked
    - Test badge shows "Retry in Xs" when locked
    - Test badge shows "Final Attempt" when attemptCount === maxAttempts - 1
    - Test badge uses warning color for non-final attempts
    - Test badge uses danger color for final attempt
    - _Requirements: 4.1, 4.3, 4.5, 4.6, 6.4_

- [x] 8. Integrate AttemptBadge into ActiveOrderCard
  - [x] 8.1 Add countdown timer logic to ActiveOrderCard
    - Add `currentTime` state initialized to `Date.now()`
    - Add `useEffect` with `setInterval` to update `currentTime` every `COUNTDOWN_UPDATE_INTERVAL` ms when `isRetryLocked` is true
    - Calculate `remainingSeconds = Math.max(0, Math.ceil((retryAvailableAt - currentTime) / 1000))`
    - Clean up interval on unmount or when `isRetryLocked` becomes false
    - _Requirements: 4.3, 4.4_

  - [x] 8.2 Render AttemptBadge in order card header
    - Conditionally render `AttemptBadge` when `attemptCount > 0`
    - Position badge in card header adjacent to order ID
    - Pass `attemptCount`, `maxAttempts`, `isRetryLocked`, `remainingSeconds` props
    - Ensure badge does not obscure existing status badges
    - _Requirements: 4.1, 4.2, 4.7_

  - [x] 8.3 Add retry-locked visual state to order card
    - Add `isRetryLocked` to card style conditions: `cardRetryLocked` style when locked
    - Set `pointerEvents="none"` when `isLocked || isRetryLocked`
    - Apply visual styling: reduced opacity, locked icon overlay
    - _Requirements: 3.3_

  - [x] 8.4 Write unit tests for ActiveOrderCard integration
    - Test countdown timer updates every second
    - Test AttemptBadge renders when attemptCount > 0
    - Test AttemptBadge does not render when attemptCount === 0
    - Test retry-locked card has pointerEvents="none"
    - _Requirements: 3.3, 4.1, 4.2, 4.3, 4.4_

- [x] 9. Add final attempt warning to failure modal
  - Conditionally render warning message in failure modal when `attemptCount === maxAttempts - 1`
  - Warning text: "This is your final attempt. Confirming will escalate this order for reassignment."
  - Style with danger color and warning icon
  - Position above confirm button
  - _Requirements: 6.2, 6.3_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Add escalateOrder mutation to deliveryApi
  - [x] 11.1 Create escalateOrder mutation
    - Add `escalateOrder` mutation to `deliveryApi.ts`
    - Endpoint: `POST /delivery/orders/:orderId/escalate`
    - Request body: `{ reason: string, notes?: string }`
    - Request headers: `{ 'Idempotency-Key': string }`
    - Response type: `{ success: boolean, message: string }`
    - Add `invalidatesTags: ['DeliveryOrders']` to trigger order list refresh
    - _Requirements: 5.1, 5.5, 5.6_

  - [x] 11.2 Write unit tests for escalateOrder mutation
    - Test mutation sends correct request body and headers
    - Test mutation invalidates DeliveryOrders tag on success
    - Test mutation handles network errors correctly
    - Test mutation handles 4xx errors correctly
    - _Requirements: 5.1, 5.3, 5.4, 5.6_

- [x] 12. Update VALID_TRANSITIONS in useActionQueue
  - Add `'escalated'` to valid transitions from `'arrived'` state: `arrived: ['delivered', 'failed', 'escalated']`
  - Ensure escalation actions pass transition validation during offline replay
  - _Requirements: 7.3_

- [x] 13. Implement offline escalation queueing
  - [x] 13.1 Add escalation action to offline queue
    - In `handleFailDelivery` escalation path, on network error, call `enqueue` with action type `'escalate'`
    - Queue item structure: `{ id, action: 'escalate', orderId, targetStatus: 'escalated', args: [orderId, reason, notes], fn: async escalation function, idempotencyKey, enqueuedAt }`
    - Ensure `removeAttempt(orderId)` is called before enqueuing
    - _Requirements: 5.3, 7.1, 7.2_

  - [x] 13.2 Implement conflict error handling for replayed escalations
    - In `replayQueue` logic, check if error status is 409 (conflict)
    - If 409, silently remove queued action from queue without showing error alert
    - If other error, follow existing error handling logic
    - _Requirements: 7.4_

  - [x] 13.3 Write unit tests for offline escalation
    - Test escalation enqueued on network error
    - Test queued escalation replayed when online
    - Test 409 conflict response discards action silently
    - Test attempt state removed before enqueuing
    - _Requirements: 5.3, 7.1, 7.2, 7.4_

- [x] 14. Implement stale state protection
  - In order list refresh logic, check if any incoming orders have been escalated locally
  - Maintain a local set of escalated order IDs (persisted in AsyncStorage)
  - Filter out escalated orders from incoming server updates
  - Clear escalated order IDs after 24 hours to prevent unbounded growth
  - _Requirements: 5.7_

- [x] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Implement attempt state cleanup on order transitions
  - [x] 16.1 Add cleanup on successful delivery
    - In OTP verification success handler, call `removeAttempt(orderId)`
    - Ensure cleanup happens before order transitions to `delivered` status
    - _Requirements: 8.2_

  - [x] 16.2 Add cleanup on order cancellation
    - In socket event handler for order status updates, check if status is `cancelled`
    - If cancelled, call `removeAttempt(orderId)`
    - _Requirements: 8.3_

  - [x] 16.3 Write unit tests for cleanup logic
    - Test cleanup called on successful delivery
    - Test cleanup called on order cancellation
    - Test cleanup removes correct attempt entry
    - _Requirements: 8.2, 8.3_

- [x] 17. Add visual states for retry-locked orders
  - Define `cardRetryLocked` style in `ActiveOrderCard` styles: reduced opacity (0.6), border color change, locked icon overlay
  - Apply style when `isRetryLocked` is true
  - Ensure locked state is visually distinct from normal locked state (different icon or color)
  - _Requirements: 3.3_

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Write integration tests for end-to-end flows
  - Test end-to-end retry flow: fail → backoff → unlock → retry → success
  - Test end-to-end escalation flow: fail 3 times → escalate → remove
  - Test offline retry: fail offline → increment local → sync when online
  - Test offline escalation: fail 3 times offline → enqueue → replay when online
  - Test stale state protection: server returns lower count → keep local count
  - Test cleanup: order delivered → attempt state removed
  - Test cleanup: order cancelled → attempt state removed
  - Test app restart during backoff: countdown resumes from persisted timestamp
  - _Requirements: 1.4, 3.6, 7.1, 7.2, 7.5, 8.2, 8.3_

- [x] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (23 properties total)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows across multiple components
- All property tests must run with minimum 100 iterations
- Implementation language: TypeScript (React Native)
- Critical architectural principles preserved: retry is STATE, timestamp-based backoff, single-current invariant, escalation is terminal, local attempt counts take precedence
