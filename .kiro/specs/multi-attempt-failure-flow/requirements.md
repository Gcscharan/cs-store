# Requirements Document

## Introduction

The Multi-Attempt Failure Flow feature replaces the current single-failure-then-remove behavior in the React Native delivery driver app. Currently, when a driver marks a delivery as failed via `onFailDelivery`, the order is immediately removed from the driver's queue. This feature introduces a configurable max-attempts policy: failed deliveries are re-queued for retry (with attempt count tracking and backoff delay) until the maximum attempt count is reached, at which point the backend is signaled for reassignment and the order is removed from the driver's queue. The driver sees clear attempt progress ("Attempt 1 of 3") on each order card throughout the process.

## Glossary

- **Attempt_Tracker**: The client-side store (AsyncStorage-backed) that persists attempt counts and retry timestamps per order ID across app restarts.
- **Attempt_Count**: The number of FAILED delivery submissions already recorded locally for a specific order. Initialised to 0 before the first failure. After the first failure, Attempt_Count becomes 1. After the second failure, Attempt_Count becomes 2, and so on.
- **Max_Attempts**: The configurable upper limit of delivery attempts before escalation. Default value is 3.
- **Retry_State**: A per-order state (not a separate queue) consisting of `attemptCount` and `retryAvailableAt` timestamp, stored within the existing `sortedOrderIds` route structure.
- **retryAvailableAt**: A Unix timestamp (milliseconds since epoch) indicating when a failed order becomes actionable again. Computed as `Date.now() + RETRY_BACKOFF_SECONDS * 1000` at the moment of failure.
- **isRetryLocked**: A derived boolean computed as `Date.now() < retryAvailableAt`, indicating whether an order is currently in backoff and should be locked.
- **Escalation**: The process of signaling the backend for reassignment when an order reaches Max_Attempts, then removing it from the driver's active queue. Escalation is terminal — once escalated, the order is never re-added from stale state.
- **Reassignment_Signal**: The API call sent to the backend when Max_Attempts is reached, indicating the order should be reassigned to another driver.
- **Failure_Modal**: The existing modal in `ActiveOrderCard` that collects a failure reason and optional notes from the driver before confirming a failed attempt.
- **Attempt_Badge**: The UI element on an order card displaying the current attempt number and max attempts (e.g., "Attempt 2 of 3"), or a countdown timer when the order is in backoff.
- **RETRY_BACKOFF_SECONDS**: A configurable constant defining the delay (in seconds) before a retried order becomes actionable again after a failed attempt. Default value is 30 seconds.
- **DeliveryHomeTab**: The main screen component (`DeliveryHomeTab.tsx`) that orchestrates all delivery actions and renders order cards.
- **recordDeliveryAttempt**: The existing RTK Query mutation that calls `POST /delivery/orders/:id/attempt` with `status: 'FAILED'`.
- **Escalation_Endpoint**: The backend endpoint called when Max_Attempts is reached, either a new endpoint or a flag on the existing attempt endpoint.

## Requirements

### Requirement 1: Attempt Count Tracking

**User Story:** As a delivery driver, I want the app to track how many times I have attempted to deliver each order, so that I know my progress and the system can enforce the retry policy correctly.

#### Acceptance Criteria

1. THE Attempt_Tracker SHALL persist the attempt count and `retryAvailableAt` timestamp for each order ID using AsyncStorage, keyed by order ID.
2. WHEN a driver confirms a failed delivery via the Failure_Modal, THE Attempt_Tracker SHALL increment the attempt count for that order by 1 and set `retryAvailableAt = Date.now() + RETRY_BACKOFF_SECONDS * 1000`.
3. WHEN an order is successfully delivered or removed from the active queue for any reason other than escalation, THE Attempt_Tracker SHALL remove the attempt count entry for that order.
4. WHEN the app is restarted, THE Attempt_Tracker SHALL restore all persisted attempt counts and `retryAvailableAt` timestamps so that in-progress retry sequences are not lost.
5. THE Attempt_Tracker SHALL initialise the attempt count for a new order to 0 before the first failure is recorded.
6. IF an attempt count entry is missing or corrupted in AsyncStorage, THEN THE Attempt_Tracker SHALL treat the attempt count as 0 and continue normally.
7. WHEN the server responds with an attempt count for an order, THE Attempt_Tracker SHALL NOT overwrite the local attempt count if the local count is higher (offline edge case protection).

---

### Requirement 2: Configurable Max-Attempts Policy

**User Story:** As a product owner, I want the maximum number of delivery attempts to be configurable, so that the retry policy can be adjusted without a code change.

#### Acceptance Criteria

1. THE DeliveryHomeTab SHALL read Max_Attempts from a single configuration constant (`MAX_DELIVERY_ATTEMPTS`) defined in the delivery constants file.
2. THE DeliveryHomeTab SHALL default Max_Attempts to 3 when the configuration constant is absent or invalid.
3. WHEN Max_Attempts is set to a value less than 1, THE DeliveryHomeTab SHALL treat Max_Attempts as 1, preventing infinite retry loops.
4. THE DeliveryHomeTab SHALL apply the same Max_Attempts value consistently to all orders in the active queue.

---

### Requirement 3: Retry State After Failed Attempt

**User Story:** As a delivery driver, I want a failed order to reappear in my queue after a short delay when I haven't yet reached the maximum attempts, so that I can try again without losing the order.

#### Acceptance Criteria

1. WHEN a driver confirms a failed delivery and the resulting Attempt_Count is less than Max_Attempts, THE DeliveryHomeTab SHALL retain the order within the existing `sortedOrderIds` route structure rather than removing it.
2. WHEN an order is retained for retry, THE DeliveryHomeTab SHALL set `retryAvailableAt = Date.now() + RETRY_BACKOFF_SECONDS * 1000` for that order, marking it as locked until the timestamp is reached.
3. WHILE an order is in retry backoff (`Date.now() < retryAvailableAt`), THE DeliveryHomeTab SHALL display the order card in a visually distinct locked state with `pointerEvents="none"`, preventing the driver from taking actions on it.
4. WHEN `Date.now() >= retryAvailableAt`, THE DeliveryHomeTab SHALL restore the order card to its normal actionable state automatically.
5. THE DeliveryHomeTab SHALL read `RETRY_BACKOFF_SECONDS` from a single configuration constant defined in the delivery constants file, defaulting to 30 seconds.
6. IF the app is restarted while an order is in backoff, THEN THE DeliveryHomeTab SHALL restore the `retryAvailableAt` timestamp from AsyncStorage and continue the backoff countdown based on the persisted timestamp.
7. WHEN the current order fails and Attempt_Count is less than Max_Attempts, THE DeliveryHomeTab SHALL immediately advance to the next order in `sortedOrderIds` to preserve the single-current invariant, while keeping the failed order in the route with retry state.

---

### Requirement 4: Attempt Badge UI

**User Story:** As a delivery driver, I want to see the current attempt number and maximum attempts on each order card, so that I always know how many tries I have left.

#### Acceptance Criteria

1. WHEN an order has an Attempt_Count greater than 0, THE Attempt_Badge SHALL be displayed on the order card showing the format "Attempt {N} of {Max_Attempts}".
2. WHEN an order has an Attempt_Count of 0, THE Attempt_Badge SHALL NOT be displayed on the order card.
3. WHEN an order is in retry backoff (`Date.now() < retryAvailableAt`), THE Attempt_Badge SHALL display a countdown timer derived from the timestamp: `remainingSeconds = Math.ceil((retryAvailableAt - Date.now()) / 1000)`, showing "Retry in {remainingSeconds}s".
4. THE countdown timer SHALL update every second by re-computing `remainingSeconds` from the timestamp, NOT by using `setInterval` to decrement a counter.
5. THE Attempt_Badge SHALL use a warning colour (matching `DELIVERY_COLORS.warning`) when Attempt_Count is less than Max_Attempts.
6. THE Attempt_Badge SHALL use a danger colour (matching `DELIVERY_COLORS.danger`) when Attempt_Count equals Max_Attempts minus 1, indicating the next failure will trigger escalation.
7. THE Attempt_Badge SHALL be positioned in the order card header, adjacent to the order ID, and SHALL NOT obscure existing status badges.

---

### Requirement 5: Escalation on Max Attempts Reached

**User Story:** As a delivery driver, I want the app to automatically escalate an order for reassignment when I have exhausted all attempts, so that the order is handled by another driver without manual intervention.

#### Acceptance Criteria

1. WHEN a driver confirms a failed delivery and the resulting Attempt_Count equals Max_Attempts, THE DeliveryHomeTab SHALL call the Escalation_Endpoint before removing the order from the active queue.
2. WHEN the Escalation_Endpoint call succeeds, THE DeliveryHomeTab SHALL remove the order from the active orders list and clear its entry from the Attempt_Tracker.
3. WHEN the Escalation_Endpoint call fails due to a network error, THE DeliveryHomeTab SHALL enqueue the escalation call in the existing offline queue using the `useActionQueue` hook, then remove the order from the active list.
4. WHEN the Escalation_Endpoint call fails with a 4xx server error, THE DeliveryHomeTab SHALL display an error alert to the driver and retain the order in the active list without removing it.
5. THE Escalation_Endpoint SHALL be called with the order ID, the failure reason, optional notes, and a flag or field indicating this is a final escalation (e.g., `escalate: true` on the existing attempt endpoint body, or a dedicated `/escalate` endpoint).
6. THE DeliveryHomeTab SHALL use an idempotency key for the Escalation_Endpoint call to prevent duplicate escalation signals on retry.
7. ESCALATION IS TERMINAL: Once an order is escalated and removed from the active queue, THE DeliveryHomeTab SHALL NEVER re-add that order from stale state, even if it appears in a server refresh or socket event.
8. WHEN an order is escalated, THE Attempt_Tracker SHALL immediately remove the attempt count entry for that order to prevent any future retry logic from applying.

---

### Requirement 6: Escalation UI Feedback

**User Story:** As a delivery driver, I want clear messaging when an order has been escalated, so that I understand the order has been handed off and I should not attempt it again.

#### Acceptance Criteria

1. WHEN Max_Attempts is reached and escalation is triggered, THE DeliveryHomeTab SHALL display an alert to the driver with the message "Order escalated for reassignment" before removing the order from the queue.
2. WHEN the driver opens the Failure_Modal on an order where Attempt_Count equals Max_Attempts minus 1, THE Failure_Modal SHALL display a warning message indicating that confirming will escalate the order.
3. THE Failure_Modal warning message SHALL read "This is your final attempt. Confirming will escalate this order for reassignment."
4. WHEN an order is in its final attempt (Attempt_Count equals Max_Attempts minus 1), THE Attempt_Badge SHALL display "Final Attempt" instead of "Attempt {N} of {Max_Attempts}".

---

### Requirement 7: Offline Resilience for Retry State

**User Story:** As a delivery driver, I want the retry and escalation actions to work correctly even when I temporarily lose network connectivity, so that no attempt data is lost.

#### Acceptance Criteria

1. WHEN a failed attempt is recorded while the device is offline, THE DeliveryHomeTab SHALL increment the local Attempt_Count and apply retry or escalation logic based on the local count, without waiting for a server response.
2. WHEN the device comes back online, THE DeliveryHomeTab SHALL replay any queued escalation calls via the existing `useActionQueue` `replayQueue` mechanism.
3. THE `useActionQueue` VALID_TRANSITIONS map SHALL include a transition entry for the escalation action so that replayed escalation calls pass the transition validation check.
4. WHEN a queued escalation call is replayed and the server returns a 409 conflict (order already reassigned), THE DeliveryHomeTab SHALL silently discard the queued action without showing an error alert.
5. WHEN the server responds with an attempt count for an order, THE DeliveryHomeTab SHALL NOT overwrite the local attempt count if the local count is higher, protecting against offline edge cases where multiple failures were recorded locally before sync.

---

### Requirement 8: Attempt State Cleanup

**User Story:** As a delivery driver, I want stale attempt data to be cleaned up automatically, so that the app does not accumulate orphaned attempt records over time.

#### Acceptance Criteria

1. WHEN the active orders list is refreshed from the server, THE Attempt_Tracker SHALL remove attempt count entries for any order IDs that are no longer present in the active orders list.
2. WHEN an order transitions to `delivered` status via OTP verification, THE Attempt_Tracker SHALL immediately remove the attempt count entry for that order.
3. WHEN an order transitions to `cancelled` status (received via socket event or server refresh), THE Attempt_Tracker SHALL immediately remove the attempt count entry for that order.
4. THE Attempt_Tracker SHALL perform cleanup at most once per active orders list update to avoid redundant AsyncStorage writes.
