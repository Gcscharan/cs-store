# Requirements Document

## Introduction

The delivery queue system has reached production-grade technical maturity with offline survivability, deterministic replay, and concurrency protection. The highest-value next phase is improving driver experience and operational usability. The biggest operational risk is driver hesitation and confusion under pressure, missed actions due to unclear state, uncertainty during weak network conditions, and cognitive overload while riding/driving. This feature focuses on ensuring drivers always know what's happening and what to do next through state clarity, action confidence, and stress-condition optimization.

## Glossary

- **Driver_App**: The mobile application used by delivery drivers to manage orders and routes
- **Active_Order**: The current delivery order the driver is working on
- **Connectivity_State**: The network connection status (online, offline, syncing, reconnected)
- **Action_State**: The status of a driver action (processing, queued offline, synced, failed)
- **Retry_System**: The mechanism that handles failed actions and allows drivers to retry them
- **Route_Screen**: The screen displaying the driver's delivery route and order sequence
- **Sticky_Panel**: A UI component that remains visible at all times regardless of scroll position
- **Global_Banner**: A persistent top-level UI element displaying system-wide status
- **OTP**: One-Time Password used for delivery verification
- **COD**: Cash On Delivery payment method
- **Sync_Queue**: The list of actions waiting to be synchronized with the server

## Requirements

### Requirement 1: Sticky Current Order Panel

**User Story:** As a delivery driver, I want the current order information always visible, so that I never have to search for the active order while under pressure.

#### Acceptance Criteria

1. THE Sticky_Panel SHALL display the customer name for the Active_Order
2. THE Sticky_Panel SHALL display the delivery address for the Active_Order
3. THE Sticky_Panel SHALL display a call button for contacting the customer
4. THE Sticky_Panel SHALL display the OTP state when OTP verification is required
5. THE Sticky_Panel SHALL display the COD state when cash collection is required
6. THE Sticky_Panel SHALL display the next required action for the Active_Order
7. WHILE the driver scrolls through the Route_Screen, THE Sticky_Panel SHALL remain visible at the top of the screen
8. WHEN no Active_Order exists, THE Sticky_Panel SHALL be hidden

### Requirement 2: Global Connectivity Banner

**User Story:** As a delivery driver, I want to always see my network connection status, so that I understand when actions are queued versus synced.

#### Acceptance Criteria

1. THE Global_Banner SHALL display "Offline" when the Driver_App has no network connection
2. WHEN the Driver_App is syncing queued actions, THE Global_Banner SHALL display "Syncing X actions" where X is the count of actions in the Sync_Queue
3. WHEN the Driver_App reconnects after being offline, THE Global_Banner SHALL display "Reconnected" for 3 seconds
4. WHEN the Sync_Queue is replaying after reconnection, THE Global_Banner SHALL display "Queue replaying"
5. THE Global_Banner SHALL be positioned at the top of the screen above all other content
6. WHEN the Driver_App is online and no actions are queued, THE Global_Banner SHALL be hidden
7. THE Global_Banner SHALL persist across all screens in the Driver_App

### Requirement 3: Action State Feedback

**User Story:** As a delivery driver, I want to see the status of every action I take, so that I know whether it worked, is queued, or failed.

#### Acceptance Criteria

1. WHEN a driver taps an action button, THE Driver_App SHALL display "Processing…" on that button
2. WHEN an action is queued due to offline status, THE Driver_App SHALL display "Queued Offline" on that button
3. WHEN an action successfully syncs with the server, THE Driver_App SHALL display "Synced" on that button for 2 seconds
4. WHEN an action fails to sync, THE Driver_App SHALL display "Failed — Retry" on that button
5. THE Driver_App SHALL NOT leave any action button in a silent state without status indication
6. WHEN an action transitions from "Processing…" to "Synced", THE Driver_App SHALL provide visual feedback (color change or checkmark)
7. WHEN an action transitions from "Processing…" to "Failed — Retry", THE Driver_App SHALL provide visual feedback (color change or error icon)

### Requirement 4: Simplified Retry UX

**User Story:** As a delivery driver, I want to understand why an action is locked and when I can retry, so that I can recover from failures without confusion.

#### Acceptance Criteria

1. WHEN an action is locked due to the Retry_System, THE Driver_App SHALL display the reason for the lock
2. WHEN an action is locked due to the Retry_System, THE Driver_App SHALL display the time remaining until retry is available
3. WHEN a retry becomes available, THE Driver_App SHALL display a clear "Retry Now" button
4. WHEN an action is locked, THE Driver_App SHALL display what the driver should do in the meantime
5. THE Driver_App SHALL NOT display technical error messages in retry lock states
6. WHEN the retry lock expires, THE Driver_App SHALL automatically enable the action button without requiring a screen refresh

### Requirement 5: Stress-Optimized UI Elements

**User Story:** As a delivery driver, I want UI elements optimized for real-world delivery conditions, so that I can use the app while riding, in rain, or in sunlight.

#### Acceptance Criteria

1. THE Driver_App SHALL use touch targets of at least 48x48 density-independent pixels for all action buttons
2. THE Driver_App SHALL use high-contrast colors for critical action buttons to ensure visibility in sunlight
3. THE Driver_App SHALL use font sizes of at least 16sp for all critical information (customer name, address, next action)
4. THE Driver_App SHALL position the most critical action button within thumb reach on standard phone sizes (bottom third of screen)
5. WHEN the driver is viewing the Active_Order, THE Driver_App SHALL minimize the number of taps required to complete the next action to at most 2 taps
6. THE Driver_App SHALL avoid placing critical action buttons near screen edges where accidental touches occur
7. THE Driver_App SHALL use distinct visual states for enabled, disabled, and loading buttons to prevent confusion

### Requirement 6: Offline State Clarity

**User Story:** As a delivery driver, I want offline state to be unmistakable, so that I understand my actions are queued and will sync later.

#### Acceptance Criteria

1. WHEN the Driver_App is offline, THE Global_Banner SHALL display a persistent "Offline" indicator with a distinct background color
2. WHEN the Driver_App is offline, THE Driver_App SHALL display an offline icon next to every queued action
3. WHEN the Driver_App transitions from online to offline, THE Driver_App SHALL display a toast notification "You are now offline — actions will be queued"
4. WHEN the Driver_App is offline, THE Driver_App SHALL display the count of queued actions in the Global_Banner
5. THE Driver_App SHALL NOT hide or minimize offline indicators regardless of how long the offline state persists
6. WHEN the Driver_App is offline for more than 60 seconds, THE Driver_App SHALL display "Still offline — X actions queued" where X is the count

### Requirement 7: Recovery Without Restart

**User Story:** As a delivery driver, I want to recover from errors without restarting the app, so that I can continue deliveries without interruption.

#### Acceptance Criteria

1. WHEN an action fails, THE Driver_App SHALL provide a "Retry" button that attempts the action again without requiring app restart
2. WHEN the Sync_Queue is stuck, THE Driver_App SHALL provide a "Force Sync" button that manually triggers queue replay
3. WHEN the Driver_App detects a corrupted state, THE Driver_App SHALL provide a "Reset State" button that clears local cache and reloads from server
4. WHEN the driver taps "Reset State", THE Driver_App SHALL display a confirmation dialog explaining what will be reset
5. THE Driver_App SHALL NOT require the driver to close and reopen the app to recover from sync failures
6. WHEN the driver uses any recovery action, THE Driver_App SHALL display a progress indicator showing the recovery is in progress
7. WHEN recovery completes successfully, THE Driver_App SHALL display a confirmation message "Recovery complete — you can continue"

### Requirement 8: Next Action Clarity

**User Story:** As a delivery driver, I want the next required action to be obvious, so that I don't miss steps or waste time figuring out what to do.

#### Acceptance Criteria

1. THE Sticky_Panel SHALL display the next required action in bold text with a distinct background color
2. WHEN multiple actions are available, THE Driver_App SHALL highlight the primary action and dim secondary actions
3. WHEN an action is blocked (e.g., waiting for OTP), THE Driver_App SHALL display the blocking reason and what the driver should do next
4. THE Driver_App SHALL use action-oriented language (e.g., "Collect OTP", "Confirm Pickup") rather than state descriptions
5. WHEN the next action requires driver input (OTP, COD amount), THE Driver_App SHALL display an input field directly in the Sticky_Panel
6. THE Driver_App SHALL NOT require the driver to scroll or navigate to a different screen to see the next action
7. WHEN the driver completes an action, THE Driver_App SHALL immediately update the Sticky_Panel to show the new next action

### Requirement 9: COD Collection Flow

**User Story:** As a delivery driver, I want a clear COD collection flow, so that I can collect cash without confusion or errors.

#### Acceptance Criteria

1. WHEN a delivery requires COD, THE Sticky_Panel SHALL display "Collect ₹X" where X is the COD amount
2. WHEN the driver taps "Collect ₹X", THE Driver_App SHALL display a confirmation screen with the amount and a "Confirm Collection" button
3. WHEN the driver confirms COD collection, THE Driver_App SHALL mark the order as paid and advance to the next action
4. WHEN COD collection fails to sync, THE Driver_App SHALL display "COD Queued — will sync when online" and allow the driver to continue
5. THE Driver_App SHALL display the COD amount in large, bold text (at least 24sp) to prevent misreading
6. WHEN the driver is offline, THE Driver_App SHALL allow COD collection and queue the action for later sync
7. WHEN the driver completes COD collection, THE Driver_App SHALL provide visual confirmation (checkmark and "Payment Collected" message)

### Requirement 10: OTP Verification Flow

**User Story:** As a delivery driver, I want a clear OTP verification flow, so that I can verify deliveries without confusion or delays.

#### Acceptance Criteria

1. WHEN a delivery requires OTP, THE Sticky_Panel SHALL display "Enter OTP" with a 4-digit input field
2. WHEN the driver enters a 4-digit OTP, THE Driver_App SHALL automatically submit the OTP without requiring a separate "Submit" button tap
3. WHEN the OTP is correct, THE Driver_App SHALL display "OTP Verified" and advance to the next action
4. WHEN the OTP is incorrect, THE Driver_App SHALL display "Incorrect OTP — try again" and clear the input field
5. WHEN OTP verification fails to sync, THE Driver_App SHALL display "OTP Queued — will sync when online" and allow the driver to continue
6. THE Driver_App SHALL use a numeric keyboard for OTP input to prevent typing errors
7. WHEN the driver is offline, THE Driver_App SHALL allow OTP entry and queue the verification for later sync

### Requirement 11: Syncing State Transparency

**User Story:** As a delivery driver, I want to see what's happening during sync, so that I understand whether to wait or continue with other tasks.

#### Acceptance Criteria

1. WHEN the Driver_App is syncing, THE Driver_App SHALL display which specific action is currently syncing (e.g., "Syncing pickup confirmation")
2. WHEN multiple actions are syncing, THE Driver_App SHALL display "Syncing X of Y actions" where X is the current action number and Y is the total
3. WHEN a sync takes longer than 5 seconds, THE Driver_App SHALL display "Still syncing… (Xs)" where X is the elapsed time in seconds
4. WHEN a sync fails, THE Driver_App SHALL display the specific action that failed and a "Retry" button
5. THE Driver_App SHALL NOT display generic "Loading…" messages during sync — all sync states must be specific
6. WHEN sync completes successfully, THE Driver_App SHALL display "All actions synced" for 2 seconds before hiding the sync indicator
7. WHEN the driver can continue with other tasks while syncing, THE Driver_App SHALL display "Syncing in background — you can continue"

### Requirement 12: Route Screen Optimization

**User Story:** As a delivery driver, I want the route screen optimized for quick scanning, so that I can see my next stops at a glance.

#### Acceptance Criteria

1. THE Route_Screen SHALL display the current stop with a distinct background color and "CURRENT" label
2. THE Route_Screen SHALL display the next 3 stops with addresses and customer names visible without tapping
3. THE Route_Screen SHALL display completed stops with a checkmark and dimmed appearance
4. WHEN the driver completes a stop, THE Route_Screen SHALL automatically scroll to show the new current stop
5. THE Route_Screen SHALL display the total number of remaining stops at the top (e.g., "5 stops remaining")
6. THE Route_Screen SHALL use visual hierarchy (size, color, weight) to distinguish current, next, and completed stops
7. WHEN the driver taps a stop, THE Route_Screen SHALL expand to show full details without navigating to a new screen

### Requirement 13: Error Message Clarity

**User Story:** As a delivery driver, I want error messages in plain language, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. THE Driver_App SHALL NOT display technical error messages (e.g., "HTTP 500", "Network timeout") to drivers
2. WHEN a network error occurs, THE Driver_App SHALL display "Connection issue — action queued for retry"
3. WHEN a server error occurs, THE Driver_App SHALL display "Server issue — we'll retry automatically"
4. WHEN an action is blocked by business logic, THE Driver_App SHALL display the specific reason (e.g., "Cannot mark delivered — OTP required")
5. THE Driver_App SHALL provide actionable guidance in every error message (e.g., "Check your connection" or "Contact support if this persists")
6. WHEN an error requires driver action, THE Driver_App SHALL display the required action as a button (e.g., "Retry Now", "Enter OTP")
7. THE Driver_App SHALL NOT use jargon or technical terms in error messages (e.g., avoid "sync", "queue", "API")

### Requirement 14: Performance Under Load

**User Story:** As a delivery driver, I want the app to remain responsive even with many queued actions, so that I can continue working without lag.

#### Acceptance Criteria

1. WHEN the Sync_Queue contains more than 10 actions, THE Driver_App SHALL maintain UI responsiveness with no more than 100ms delay for button taps
2. WHEN the Driver_App is syncing actions, THE Driver_App SHALL allow the driver to continue queuing new actions without blocking the UI
3. WHEN the Route_Screen displays more than 20 stops, THE Driver_App SHALL use virtualization to maintain smooth scrolling
4. THE Driver_App SHALL NOT freeze or become unresponsive during background sync operations
5. WHEN the driver switches between screens, THE Driver_App SHALL complete screen transitions in less than 300ms
6. THE Driver_App SHALL limit the number of simultaneous sync operations to prevent network congestion
7. WHEN the Sync_Queue exceeds 50 actions, THE Driver_App SHALL display a warning "Large sync queue — may take several minutes"

### Requirement 15: Accessibility Compliance

**User Story:** As a delivery driver with accessibility needs, I want the app to support screen readers and high contrast modes, so that I can use the app effectively.

#### Acceptance Criteria

1. THE Driver_App SHALL provide accessibility labels for all interactive elements (buttons, inputs, icons)
2. THE Driver_App SHALL support dynamic font sizing for drivers who need larger text
3. THE Driver_App SHALL maintain a minimum contrast ratio of 4.5:1 for all text elements
4. THE Driver_App SHALL support screen reader announcements for state changes (e.g., "Action synced", "You are now offline")
5. THE Driver_App SHALL ensure all interactive elements are reachable via keyboard navigation for external keyboard users
6. THE Driver_App SHALL provide haptic feedback for critical actions (pickup, delivery, COD collection)
7. THE Driver_App SHALL support high contrast mode for drivers with visual impairments
