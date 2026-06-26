# Requirements Document

## Introduction

This document specifies requirements for a unified, event-driven Enterprise Notification System for the Vyapara Setu platform. The system extends the existing partial notification infrastructure (Expo Push, in-app notifications, Socket.IO events, notificationWriter) into a complete multi-channel notification framework covering all three platform surfaces: Customer App, Delivery Partner App, and Admin Web Panel.

The system ensures that every important business event automatically produces: an in-app notification record, a push notification (via Expo/Firebase), a real-time Socket.IO event, a persistent notification history entry, and a deep link for navigation. It is event-driven — controllers publish domain events to the existing event bus, and the notification system consumes them to fan out across channels based on user preferences.

**Priority Classification:**
- **P0 (Launch-Critical):** Order Notifications, Delivery Notifications, Earnings Notifications, Payment Notifications, Admin Alerts
- **P1 (Near-Launch):** Notification Center UI, Toast System, Preferences, Push Delivery, Socket Events
- **P2 (Post-Launch):** Promotional Notifications, Bulk Notifications, Analytics Dashboard

## Glossary

- **Notification_Engine**: The backend service that consumes domain events from the Event_Bus and orchestrates multi-channel notification delivery (in-app, push, socket, email/SMS)
- **Event_Bus**: The existing pub/sub system (`eventBus.ts`) using the Outbox pattern for reliable event publishing and delivery to subscribers
- **Channel_Router**: The component within the Notification_Engine responsible for determining which delivery channels to activate for a given notification based on user preferences, event priority, and channel availability
- **Notification_Center**: The frontend UI component (on mobile and web) that displays notification history, unread counts, category filters, and supports mark-as-read and infinite scroll
- **Push_Gateway**: The service layer that sends push notifications via Expo Push API (mobile) or Firebase Cloud Messaging (web)
- **Socket_Emitter**: The component that delivers real-time notification events to connected clients via Socket.IO user rooms
- **Notification_Preference_Service**: The backend service that manages per-user notification channel and category preferences
- **Deep_Link**: A URI string embedded in notifications that navigates the user directly to the relevant screen (e.g., `/orders/{orderId}`, `/earnings/{earningId}`)
- **Toast_System**: A frontend ephemeral notification UI (snackbar/toast) that appears briefly on screen for real-time event feedback
- **Notification_Template**: A predefined content template (title, body, deep link pattern) associated with a specific event type
- **Customer_App**: The React Native (Expo) mobile application used by end customers
- **Delivery_App**: The React Native (Expo) mobile application used by delivery partners
- **Admin_Panel**: The React web application used by platform administrators
- **Outbox_Event**: A persisted event record in MongoDB ensuring at-least-once delivery semantics for domain events
- **ProcessedEvent**: A deduplication record ensuring exactly-once processing per consumer per event
- **Priority_Engine**: The component that classifies notifications into priority levels (P0-P3) and determines delivery behavior accordingly
- **Retry_Engine**: The component that handles failed push notification retries with exponential backoff and dead-letter queuing
- **Dead_Letter_Queue**: A persistent store for notifications that have exhausted all retry attempts, enabling manual review and debugging
- **Delivery_Tracker**: The component that tracks notification lifecycle states (sent, delivered, opened, clicked, failed) per notification per channel
- **Dedupe_Key**: A composite key derived from event type, user ID, and contextual data that prevents duplicate notification delivery for the same logical event
- **Bulk_Dispatcher**: The service that sends notifications to large user segments (all customers, all delivery partners) with rate limiting and progress tracking
- **Audit_Log**: An immutable record of notification generation events including source, actor, reason, channel, status, and timestamp

## Requirements

### Requirement 1: Event-Driven Notification Orchestration

**User Story:** As a platform operator, I want every business event to automatically trigger appropriate notifications across all channels, so that users receive timely updates without controllers needing to know about notification logic.

#### Acceptance Criteria

1. WHEN a domain event is published to the Event_Bus, THE Notification_Engine SHALL consume the event and create an in-app notification record within 2 seconds
2. WHEN a domain event is published to the Event_Bus, THE Notification_Engine SHALL emit a real-time Socket.IO event to the target user room within 1 second
3. WHEN a domain event is published to the Event_Bus, THE Notification_Engine SHALL send a push notification via the Push_Gateway within 5 seconds
4. THE Notification_Engine SHALL use the ProcessedEvent model to guarantee exactly-once processing per event per consumer
5. IF a notification delivery fails on one channel, THEN THE Notification_Engine SHALL log the failure and continue delivering on remaining channels without blocking
6. THE Notification_Engine SHALL resolve the Notification_Template for the event type to generate title, body, and Deep_Link content
7. WHEN an event type has no registered Notification_Template, THE Notification_Engine SHALL skip notification generation and log a warning

### Requirement 2: Customer Order Lifecycle Notifications

**User Story:** As a customer, I want to receive notifications at every stage of my order lifecycle, so that I stay informed about my order progress.

#### Acceptance Criteria

1. WHEN an order is placed successfully, THE Notification_Engine SHALL generate a notification with title "Order Placed", order summary in body, and Deep_Link to the order detail screen
2. WHEN an order is confirmed by the store, THE Notification_Engine SHALL generate a notification with title "Order Confirmed" and estimated delivery time in body
3. WHEN an order is packed, THE Notification_Engine SHALL generate a notification with title "Order Packed" and message indicating readiness for pickup
4. WHEN a delivery partner is assigned, THE Notification_Engine SHALL generate a notification with delivery partner name and Deep_Link to tracking screen
5. WHEN an order transitions to in-transit status, THE Notification_Engine SHALL generate a notification with title "Order On The Way" and live tracking Deep_Link
6. WHEN an order is delivered successfully, THE Notification_Engine SHALL generate a notification with title "Order Delivered" and prompt for feedback
7. WHEN an order is cancelled, THE Notification_Engine SHALL generate a notification with title "Order Cancelled" and cancellation reason in body

### Requirement 3: Customer Payment Notifications

**User Story:** As a customer, I want to be notified about payment events, so that I know the status of my transactions immediately.

#### Acceptance Criteria

1. WHEN a payment is completed successfully, THE Notification_Engine SHALL generate a notification with amount, payment method, and Deep_Link to order confirmation
2. WHEN a payment fails, THE Notification_Engine SHALL generate a notification with failure reason and Deep_Link to retry payment screen
3. WHEN a refund is initiated, THE Notification_Engine SHALL generate a notification with refund amount and expected timeline
4. WHEN a refund is credited, THE Notification_Engine SHALL generate a notification confirming the credited amount and payment method

### Requirement 4: Delivery Partner Assignment and Pickup Notifications

**User Story:** As a delivery partner, I want to receive immediate notifications when orders are assigned to me and reminders for pickup, so that I can act quickly and reduce delivery times.

#### Acceptance Criteria

1. WHEN an order is assigned to a delivery partner, THE Notification_Engine SHALL generate a high-priority notification with order details, pickup address, and Deep_Link to order acceptance screen
2. WHILE a delivery partner has an assigned order pending pickup for more than 5 minutes, THE Notification_Engine SHALL send a reminder notification every 5 minutes up to a maximum of 3 reminders
3. WHEN a delivery OTP is generated, THE Notification_Engine SHALL deliver the OTP via Socket.IO event to the delivery partner in real-time
4. WHEN a delivery partner successfully delivers an order, THE Notification_Engine SHALL generate a notification confirming delivery completion with earnings summary

### Requirement 5: Delivery Partner Earnings and Performance Notifications

**User Story:** As a delivery partner, I want to be notified about my earnings and performance milestones, so that I stay motivated and informed about my income.

#### Acceptance Criteria

1. WHEN earnings are credited to a delivery partner account, THE Notification_Engine SHALL generate a notification with credited amount and updated total balance
2. WHEN a delivery partner reaches a performance milestone (10, 25, 50, 100, 250, 500 deliveries), THE Notification_Engine SHALL generate a congratulatory notification with milestone details
3. WHEN a daily earnings summary is available, THE Notification_Engine SHALL generate a notification with total deliveries completed and total earnings for the day
4. IF a delivery partner has a pending COD settlement, THEN THE Notification_Engine SHALL generate a reminder notification with outstanding COD amount

### Requirement 6: Admin Alert Notifications

**User Story:** As an admin, I want to receive critical operational alerts, so that I can respond quickly to issues affecting the platform.

#### Acceptance Criteria

1. WHEN a new order is placed, THE Notification_Engine SHALL generate an admin notification with order summary and customer details
2. WHEN a payment fails, THE Notification_Engine SHALL generate a high-priority admin alert with payment details and customer information
3. WHEN a delivery fails or is returned, THE Notification_Engine SHALL generate a high-priority admin alert with failure reason, order details, and delivery partner information
4. WHEN inventory for a product falls below the configured threshold, THE Notification_Engine SHALL generate an admin notification with product name, current stock level, and Deep_Link to inventory management
5. WHEN a security event occurs (failed login attempts exceeding threshold, suspicious activity), THE Notification_Engine SHALL generate a high-priority admin alert with event details and affected user information

### Requirement 7: Notification Preferences Management

**User Story:** As a user, I want to control which notifications I receive and through which channels, so that I am not overwhelmed by unwanted notifications.

#### Acceptance Criteria

1. THE Notification_Preference_Service SHALL support per-user preferences for each channel: push, in-app, socket, email, SMS, WhatsApp
2. THE Notification_Preference_Service SHALL support per-category preferences: order, delivery, payment, account, promo
3. WHEN a user updates notification preferences, THE Notification_Preference_Service SHALL persist changes and apply them to all subsequent notifications within 1 second
4. THE Channel_Router SHALL respect user preferences when determining delivery channels for each notification
5. IF a notification has P0 priority (payment failure, security alert, delivery failure), THEN THE Channel_Router SHALL deliver via push and in-app channels regardless of user category preferences
6. THE Notification_Preference_Service SHALL provide default preferences enabling all channels and categories for new users

### Requirement 8: Notification Center UI

**User Story:** As a user, I want a centralized notification center where I can view, filter, and manage all my notifications, so that I can quickly find relevant updates.

#### Acceptance Criteria

1. THE Notification_Center SHALL display a badge with the unread notification count on the notification bell icon
2. THE Notification_Center SHALL display notifications sorted by creation time in descending order (newest first)
3. THE Notification_Center SHALL support filtering notifications by category (order, delivery, payment, account, promo)
4. THE Notification_Center SHALL support cursor-based infinite scroll pagination with a page size of 20 notifications
5. WHEN a user taps a notification in the Notification_Center, THE Customer_App SHALL navigate to the screen specified by the Deep_Link
6. WHEN a user taps a notification, THE Notification_Center SHALL mark that notification as read and update the unread count
7. THE Notification_Center SHALL provide a "Mark All as Read" action that marks all unread notifications as read
8. WHEN a new notification arrives via Socket.IO while the Notification_Center is open, THE Notification_Center SHALL prepend the new notification to the list without requiring a manual refresh

### Requirement 9: Real-Time Toast and Snackbar System

**User Story:** As a user, I want to see brief on-screen alerts when important events happen in real-time, so that I am aware of updates without opening the notification center.

#### Acceptance Criteria

1. WHEN a real-time notification event is received via Socket.IO, THE Toast_System SHALL display a toast message with the notification title and a brief body excerpt
2. THE Toast_System SHALL auto-dismiss toast messages after 4 seconds
3. THE Toast_System SHALL support manual dismissal by swipe gesture (mobile) or close button (web)
4. WHEN a user taps a toast message, THE Toast_System SHALL navigate to the screen specified by the notification Deep_Link
5. WHILE multiple notifications arrive within a 2-second window, THE Toast_System SHALL queue them and display sequentially with a 1-second gap between dismissal and next appearance
6. THE Toast_System SHALL display a maximum of 3 queued toasts before collapsing additional notifications into a summary toast showing the count of remaining notifications

### Requirement 10: Push Notification Delivery

**User Story:** As a user, I want to receive push notifications on my device even when the app is closed, so that I never miss important updates.

#### Acceptance Criteria

1. THE Push_Gateway SHALL send push notifications via Expo Push API for React Native mobile apps
2. THE Push_Gateway SHALL support notification channels (Android) for categorizing notifications by type (orders, payments, promotions)
3. WHEN a push notification is sent and the device token is invalid or expired, THE Push_Gateway SHALL remove the invalid token from the user record and log the removal
4. THE Push_Gateway SHALL batch multiple push notifications within a 500ms window into a single API call to Expo Push service for efficiency
5. IF the Expo Push API returns a rate-limit response, THEN THE Push_Gateway SHALL implement exponential backoff starting at 1 second with a maximum of 5 retries

### Requirement 11: Notification Template System

**User Story:** As a developer, I want notification content to be driven by templates mapped to event types, so that notification copy can be updated without code changes.

#### Acceptance Criteria

1. THE Notification_Engine SHALL maintain a registry mapping each event type to a Notification_Template containing title pattern, body pattern, Deep_Link pattern, category, and priority
2. THE Notification_Template SHALL support variable interpolation using event data fields (e.g., `{orderNumber}`, `{amount}`, `{deliveryPartnerName}`)
3. WHEN a Notification_Template references a variable not present in event data, THE Notification_Engine SHALL use an empty string as fallback and log a warning
4. THE Notification_Engine SHALL support template overrides per user role (customer, delivery_partner, admin) for the same event type

### Requirement 12: Socket.IO Real-Time Event Delivery

**User Story:** As a connected user, I want to receive real-time notification events instantly through my active connection, so that the app UI updates without polling.

#### Acceptance Criteria

1. WHEN a notification is created, THE Socket_Emitter SHALL emit a `notification:new` event to the target user Socket.IO room (`user_{userId}`)
2. THE Socket_Emitter SHALL include the complete notification DTO (id, title, body, category, priority, deepLink, createdAt) in the emitted event payload
3. WHEN a notification is marked as read, THE Socket_Emitter SHALL emit a `notification:read` event to the user room with the notification ID
4. WHEN all notifications are marked as read, THE Socket_Emitter SHALL emit a `notification:read_all` event to the user room
5. THE Socket_Emitter SHALL emit a `notification:unread_count` event to the user room whenever the unread count changes

### Requirement 13: Promotional and Offer Notifications

**User Story:** As a customer, I want to receive notifications about new offers, coupons, and promotions, so that I can take advantage of deals.

#### Acceptance Criteria

1. WHEN a new promotion or coupon is activated, THE Notification_Engine SHALL generate a notification to eligible users with offer details and Deep_Link to the offer screen
2. WHEN a coupon is about to expire within 24 hours, THE Notification_Engine SHALL send a reminder notification to users who have the coupon but have not used it
3. THE Notification_Engine SHALL respect the promo category preference — users who have disabled promo notifications SHALL NOT receive promotional notifications via push or in-app channels

### Requirement 14: Delivery Guarantee and Lifecycle Tracking

**User Story:** As a platform operator, I want to track the full lifecycle of every notification, so that I can debug delivery failures and measure notification effectiveness.

#### Acceptance Criteria

1. THE Delivery_Tracker SHALL record a lifecycle state for every notification per channel with states: sent, delivered, opened, clicked, failed
2. WHEN a push notification is acknowledged by the Expo Push API, THE Delivery_Tracker SHALL update the notification state to "sent" for the push channel
3. WHEN a push notification receipt indicates successful delivery, THE Delivery_Tracker SHALL update the notification state to "delivered"
4. WHEN a user opens or views a notification (in-app or push), THE Delivery_Tracker SHALL update the notification state to "opened"
5. WHEN a user taps a notification and navigates via Deep_Link, THE Delivery_Tracker SHALL update the notification state to "clicked"
6. IF a notification delivery fails after all retries are exhausted, THEN THE Delivery_Tracker SHALL update the notification state to "failed" with failure reason
7. THE Delivery_Tracker SHALL expose delivery rate, open rate, and click rate metrics per notification type per time period

### Requirement 15: Notification Deduplication

**User Story:** As a user, I want to receive each logical notification exactly once, so that I am not overwhelmed by duplicate messages.

#### Acceptance Criteria

1. THE Notification_Engine SHALL compute a Dedupe_Key for each notification based on event type, target user ID, and contextual identifier (e.g., orderId for order events)
2. WHEN a notification with an existing Dedupe_Key is generated within a 5-minute deduplication window, THE Notification_Engine SHALL discard the duplicate and log it
3. THE Notification_Engine SHALL store deduplication history with TTL-based expiration to prevent unbounded storage growth
4. THE Notification_Engine SHALL use the existing ProcessedEvent model (eventId + consumerName unique constraint) as the first layer of deduplication at the event level

### Requirement 16: Priority Engine

**User Story:** As a platform operator, I want notifications classified by urgency level, so that critical alerts receive immediate delivery with enhanced visibility while low-priority messages are delivered without disruption.

#### Acceptance Criteria

1. THE Priority_Engine SHALL classify notifications into four levels: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
2. WHEN a notification is classified as P0, THE Notification_Engine SHALL deliver with sound enabled, badge update, immediate push delivery, and maximum retry attempts
3. WHEN a notification is classified as P1, THE Notification_Engine SHALL deliver with sound enabled, badge update, and standard push delivery
4. WHEN a notification is classified as P2, THE Notification_Engine SHALL deliver with badge update and standard push delivery without sound
5. WHEN a notification is classified as P3, THE Notification_Engine SHALL deliver via in-app and socket channels only, with push delivery subject to user preference
6. THE Priority_Engine SHALL assign priority based on the Notification_Template configuration for the event type
7. P0 events SHALL include: payment failure, delivery failure, security events; P1 events SHALL include: order delivered, OTP generated, order assigned; P2 events SHALL include: earnings credited, order confirmed, order packed; P3 events SHALL include: promotions, recommendations, reminders

### Requirement 17: Retry Engine

**User Story:** As a platform operator, I want failed push notifications to retry automatically with increasing delays, so that transient failures are resolved without manual intervention.

#### Acceptance Criteria

1. WHEN a push notification delivery fails, THE Retry_Engine SHALL schedule a retry with exponential backoff intervals: 1 minute, 5 minutes, 15 minutes, 30 minutes, 1 hour
2. THE Retry_Engine SHALL store the retry count for each failed notification attempt
3. IF a notification exhausts all 5 retry attempts, THEN THE Retry_Engine SHALL move the notification to the Dead_Letter_Queue with failure metadata
4. THE Retry_Engine SHALL process retries using a scheduled job that polls for pending retries every 30 seconds
5. WHEN a retry succeeds, THE Retry_Engine SHALL update the Delivery_Tracker state to "delivered" and clear remaining retry schedule

### Requirement 18: Bulk Notification System

**User Story:** As an admin, I want to send notifications to large user segments (all customers, all delivery partners), so that I can communicate platform-wide announcements and marketing campaigns.

#### Acceptance Criteria

1. THE Bulk_Dispatcher SHALL support targeting user segments: all customers, all delivery partners, all admins, and custom filters (by location, by activity status)
2. WHEN a bulk notification is initiated, THE Bulk_Dispatcher SHALL process users in batches of 100 with a 1-second delay between batches to prevent system overload
3. THE Bulk_Dispatcher SHALL track progress (total users, sent count, failed count) and expose progress status via an admin API endpoint
4. IF a bulk notification is cancelled mid-execution, THEN THE Bulk_Dispatcher SHALL stop processing remaining batches within 5 seconds
5. THE Bulk_Dispatcher SHALL respect individual user notification preferences — users who have disabled the relevant category SHALL be skipped

### Requirement 19: Audit Trail

**User Story:** As a platform operator, I want a complete audit trail for every notification generated, so that I can debug issues, investigate complaints, and ensure compliance.

#### Acceptance Criteria

1. THE Audit_Log SHALL record for every notification: generating actor (system/user/admin), source event ID, source event type, reason for generation, target user ID, timestamp, channels attempted, and delivery status per channel
2. THE Audit_Log SHALL be immutable — records SHALL NOT be modified or deleted after creation
3. THE Audit_Log SHALL be queryable by user ID, event type, time range, and delivery status
4. THE Audit_Log SHALL retain records for a minimum of 90 days
5. THE Audit_Log SHALL be separate from the Notification collection to avoid performance impact on notification queries

### Requirement 20: Analytics Dashboard

**User Story:** As an admin, I want to view notification performance metrics in the admin panel, so that I can monitor system health and optimize notification effectiveness.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a notifications analytics dashboard showing: total sent, total delivered, total opened, total failed, grouped by time period (hourly, daily, weekly)
2. THE Admin_Panel SHALL display top notification types by volume and top failure reasons
3. THE Admin_Panel SHALL display push token health metrics: total active tokens, tokens invalidated in last 24 hours, percentage of users with valid tokens
4. THE Admin_Panel SHALL support filtering analytics by notification category, priority level, and target user segment
5. WHEN the delivery rate for any notification type drops below 80%, THE Admin_Panel SHALL highlight the metric with a warning indicator

### Requirement 21: Offline Support and Sync

**User Story:** As a user with unreliable connectivity, I want notifications to be stored locally and synced when I reconnect, so that I never miss any notification.

#### Acceptance Criteria

1. THE Customer_App and Delivery_App SHALL persist received notifications in local storage (AsyncStorage or equivalent)
2. WHEN the device regains network connectivity, THE Customer_App and Delivery_App SHALL sync unread count and latest notifications from the server
3. WHEN the app reconnects to Socket.IO, THE Socket_Emitter SHALL emit a `notification:sync` event containing notifications created since the client last disconnected (based on last-seen timestamp)
4. THE Notification_Center SHALL display locally cached notifications immediately on open, then update with server data when sync completes
5. IF a conflict exists between local and server notification read state, THEN the server state SHALL take precedence

### Requirement 22: Security and Role Isolation

**User Story:** As a platform operator, I want strict access controls on notification data, so that users can only access their own notifications and unauthorized access is prevented.

#### Acceptance Criteria

1. THE Notification_Engine SHALL verify that all notification API requests include a valid authenticated user token
2. THE Notification_Engine SHALL filter notification queries by the authenticated user ID — users SHALL NOT access notifications belonging to other users
3. THE Notification_Preference_Service SHALL verify that preference update requests target the authenticated user only
4. THE Admin_Panel notification APIs SHALL require admin role authorization — delivery partners and customers SHALL NOT access admin notification endpoints
5. THE Socket_Emitter SHALL verify Socket.IO room membership before emitting events — users SHALL only receive events for their own user room
6. IF an unauthorized access attempt is detected, THEN THE Notification_Engine SHALL log the attempt with actor details and return a 403 response

### Requirement 23: Performance and Scalability

**User Story:** As a platform operator, I want the notification system to handle production load without degrading platform performance, so that notifications scale with business growth.

#### Acceptance Criteria

1. THE Notification_Engine SHALL support processing a minimum of 100,000 notifications per day
2. THE Notification_Engine SHALL create notification records within 500 milliseconds of event consumption
3. THE Push_Gateway SHALL dispatch push notifications within 2 seconds of notification record creation
4. THE Notification_Center unread count API SHALL respond within 100 milliseconds at the 95th percentile
5. THE Notification_Center list API SHALL respond within 300 milliseconds at the 95th percentile for the first page
6. THE Notification_Engine SHALL use database indexes on userId, createdAt, isRead, and category fields to support query performance
7. THE Notification_Engine SHALL implement connection pooling for MongoDB and Redis to support concurrent notification processing

### Requirement 24: Automated Testing and Testability

**User Story:** As a developer, I want every notification flow to be covered by automated tests, so that regressions are caught before production deployment.

#### Acceptance Criteria

1. THE notification system SHALL have unit tests covering: event generation per event type, template interpolation, priority classification, deduplication logic, and preference filtering
2. THE notification system SHALL have integration tests covering: end-to-end notification flow from event publish to in-app record creation, push dispatch, and Socket.IO emission
3. THE notification system SHALL have E2E tests (Playwright) covering: notification center UI rendering, unread badge updates, mark-as-read interaction, deep link navigation, and toast display
4. WHEN a new event type is added to the template registry, THE system SHALL require a corresponding test covering notification generation for that event type
5. THE test suite SHALL include negative test cases: invalid event data handling, missing push token handling, preference-blocked notifications, and duplicate event processing

