# Implementation Plan

## Overview

This implementation plan covers the Enterprise Notification System for Vyapara Setu. It extends existing notification infrastructure (EventBus, NotificationWriter, PushNotificationService, SocketService) into a unified, event-driven multi-channel notification system supporting Customer App, Delivery Partner App, and Admin Web Panel.

The plan is divided into three phases:
- **Phase A (Launch-Critical):** Core orchestration engine, template registry, socket emitter, channel routing, priority engine — enabling all P0 business event notifications
- **Phase B (Near-Launch):** Push gateway enhancements, retry engine, frontend notification center upgrades, toast system, offline sync, audit logging
- **Phase C (Post-Launch):** Lifecycle tracking, analytics dashboard, bulk notifications, promotional automation, E2E tests, performance optimization

## Tasks

### Phase A: Launch-Critical Foundation (P0)

- [x] 1. Create Notification Template Registry
  - Create `backend/src/domains/communication/templates/notificationTemplates.ts`
  - Define `NotificationTemplate` interface with: eventType, role, title (with variable patterns), body (with variable patterns), deepLinkPattern, category, priority (P0-P3), channels, sound
  - Create in-memory registry `Map<eventType, Map<role, NotificationTemplate>>`
  - Register templates for all 18 existing event types + new delivery/admin events
  - Implement `resolveTemplate(eventType, role)` function that returns the appropriate template
  - Implement `interpolateTemplate(template, data)` function that replaces `{variableName}` with event data values, using empty string fallback for missing variables with a logged warning
  - Add fallback to existing `defaultTitleForEvent()` behavior for unmapped events
  - Write unit tests for template resolution and interpolation

- [x] 2. Create Socket Emitter Service
  - Create `backend/src/domains/communication/services/socketEmitter.ts`
  - Import and access the Socket.IO server instance via `app.get("io")` pattern (consistent with existing LowStockSocketService)
  - Implement `emitNotificationNew(userId, notificationDTO)` — emits `notification:new` to `user_{userId}` room
  - Implement `emitNotificationRead(userId, notificationId)` — emits `notification:read` to user room
  - Implement `emitNotificationReadAll(userId)` — emits `notification:read_all` to user room
  - Implement `emitUnreadCount(userId, count)` — emits `notification:unread_count` to user room
  - Implement `emitNotificationSync(userId, notifications[], totalUnread)` — emits `notification:sync` for reconnection
  - Initialize with Express app reference (same pattern as LowStockSocketService constructor)
  - Write unit tests mocking Socket.IO server

- [x] 3. Create Channel Router Service
  - Create `backend/src/domains/communication/services/channelRouter.ts`
  - Implement `determineChannels(userId, category, priority, templateChannels)` function
  - Load user notification preferences from User model (existing `notificationPreferences` field)
  - Apply per-channel filtering (push.enabled, push.categories[category])
  - Apply per-category filtering
  - Implement P0 priority override rule: P0 notifications always deliver via push + in-app regardless of user preferences
  - Return list of active channels: `('in_app' | 'push' | 'socket')[]`
  - Handle case where user has no preferences set (default: all channels enabled)
  - Write unit tests covering preference filtering, priority overrides, and default behavior

- [x] 4. Create Priority Engine
  - Create `backend/src/domains/communication/services/priorityEngine.ts`
  - Define priority levels: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
  - Implement `classifyPriority(eventType)` using template registry lookup
  - Implement `getDeliveryBehavior(priority)` returning: { sound, badge, retryAttempts, forceChannels }
  - P0: sound=true, badge=true, retryAttempts=5, forceChannels=['push','in_app']
  - P1: sound=true, badge=true, retryAttempts=3, forceChannels=[]
  - P2: sound=false, badge=true, retryAttempts=2, forceChannels=[]
  - P3: sound=false, badge=false, retryAttempts=0, forceChannels=[]
  - Map events: P0=[PAYMENT_FAILED, ORDER_FAILED, ADMIN_SECURITY_EVENT], P1=[ORDER_DELIVERED, DELIVERY_ASSIGNED, OTP_GENERATED], P2=[ORDER_CONFIRMED, ORDER_PACKED, EARNINGS_CREDITED], P3=[PROMO_CAMPAIGN, SYSTEM_ANNOUNCEMENT]
  - Write unit tests for all priority classifications

- [x] 5. Create Notification Orchestrator
  - Create `backend/src/domains/communication/services/notificationOrchestrator.ts`
  - Implement as an EventBus subscriber (same pattern as existing `notificationWriter.ts` and `adminAssignmentConsumer.ts`)
  - Step 1: Deduplicate using ProcessedEvent model (consumerName: "notificationOrchestrator")
  - Step 2: Resolve template via Template Registry (task 1)
  - Step 3: Determine target recipients (may include multiple roles: customer + admin for ORDER_FAILED)
  - Step 4: For each recipient, check preferences via Channel Router (task 3)
  - Step 5: Classify priority via Priority Engine (task 4)
  - Step 6: Fan-out to active channels:
    - In-App: Create Notification document (reuse existing Notification model)
    - Push: Queue push via PushNotificationService (upgraded to PushGateway in Phase B)
    - Socket: Emit via Socket Emitter (task 2)
  - Step 7: Create basic audit log entry via logger.info (formal audit in Phase B)
  - Handle failures per channel independently — one channel failure must not block others
  - Add feature flag `NOTIFICATION_ORCHESTRATOR_ENABLED` to control activation
  - Export `initializeNotificationOrchestrator()` function (same pattern as `initializeNotificationWriter()`)
  - Write unit tests covering full orchestration flow with mocked dependencies

- [x] 6. Integrate Socket Emitter with Notification Flow
  - In the Notification Orchestrator (task 5), after creating the Notification record, call `socketEmitter.emitNotificationNew(userId, notificationDTO)`
  - Map Notification document to DTO format: { id, title, body, category, priority, deepLink, createdAt }
  - After emitting notification:new, also emit updated unread count via `socketEmitter.emitUnreadCount(userId, newCount)`
  - Integrate `emitNotificationRead` into the existing `markAsRead` controller in notificationController.ts
  - Integrate `emitNotificationReadAll` into the existing `markAllAsRead` controller
  - Write integration test verifying socket events are emitted after notification creation

- [x] 7. Publish Payment Events from Webhook Processor
  - Modify `backend/src/domains/payments/services/webhookProcessor.ts`
  - After successful payment capture processing, call `publish(createPaymentSuccessEvent({...}))` with userId, orderId, paymentId, amount
  - Add `PAYMENT_FAILED` to PaymentEventType in `payment.events.ts` and create factory function `createPaymentFailedEvent()`
  - After payment failure processing, call `publish(createPaymentFailedEvent({...}))`
  - After refund processing (if exists in webhook flow), publish REFUND_INITIATED/REFUND_COMPLETED
  - Ensure events are published within the existing transaction context where possible
  - Write integration tests verifying events are published on payment state changes

- [x] 8. Create Delivery Partner Event Types
  - Create `backend/src/domains/events/delivery.events.ts`
  - Define `DeliveryEventType`: DELIVERY_PICKUP_REMINDER, DELIVERY_OTP_GENERATED, DELIVERY_COMPLETED, EARNINGS_CREDITED, EARNINGS_DAILY_SUMMARY, PERFORMANCE_MILESTONE, COD_SETTLEMENT_REMINDER
  - Create factory functions for each event type following the same pattern as order.events.ts
  - Include relevant data fields: userId (rider), orderId, amount, milestoneCount, etc.
  - Add event publishing in `deliveryOrderController.ts` for DELIVERY_COMPLETED and EARNINGS_CREDITED (replacing direct push/Notification.create calls)
  - Write unit tests for event factory functions

- [x] 9. Add Admin Alert Routing to Orchestrator
  - Extend Notification Orchestrator (task 5) to handle admin-targeted notifications
  - For events that require admin alerts (ORDER_CREATED, ORDER_FAILED, PAYMENT_FAILED, ADMIN_SECURITY_EVENT, LOW_STOCK): query admin users (role=admin) to get admin user IDs
  - Create notification records for each admin user
  - Emit socket events to admin user rooms
  - Send push notifications to admin devices
  - Add admin templates to the template registry (task 1)
  - Implement admin-specific deep links (e.g., `/admin/orders/{orderId}`, `/admin/inventory/{productId}`)
  - Write unit tests for admin routing logic

- [x] 10. Remove Direct Push Calls from Controllers (Feature-Flagged)
  - In `orderStateService.ts`: Remove all `PushNotificationService.sendToUser()` calls for order state transitions (CONFIRMED, PACKED, IN_TRANSIT, DELIVERED, FAILED, CANCELLED)
  - In `deliveryOrderController.ts`: Remove direct `PushNotificationService.sendToUser()` for earnings, remove direct `Notification.create()` for rider earning notification
  - Guard removal behind feature flag `NOTIFICATION_ORCHESTRATOR_ENABLED` — when enabled, skip direct calls (orchestrator handles them via event consumption)
  - When feature flag is disabled, keep existing direct call behavior as fallback
  - Verify no notification is lost: ensure the orchestrator templates cover all previously hardcoded titles/bodies
  - Write integration test comparing notification output with and without feature flag

- [x] 11. Unit Tests for Phase A Components
  - Create `backend/tests/unit/notification/templateRegistry.test.ts` — test all template resolutions, variable interpolation, missing variables, role overrides
  - Create `backend/tests/unit/notification/channelRouter.test.ts` — test preference filtering, P0 override, default preferences, missing preferences
  - Create `backend/tests/unit/notification/priorityEngine.test.ts` — test all event type classifications, delivery behavior per priority
  - Create `backend/tests/unit/notification/orchestrator.test.ts` — test full flow with mocked dependencies: dedupe, template, preferences, fan-out
  - Create `backend/tests/unit/notification/socketEmitter.test.ts` — test all socket event emissions with mocked IO
  - Ensure all tests pass with `npm test` in backend directory

### Phase B: Near-Launch Infrastructure (P1)

- [x] 12. Enhanced Push Gateway with Batching and Token Cleanup
  - Create `backend/src/domains/communication/services/pushGateway.ts`
  - Extend existing PushNotificationService logic (don't modify original — create new wrapper)
  - Implement 500ms batching window: collect push notifications, send in single Expo API call (max 100 per batch per Expo docs)
  - Implement token cleanup: when Expo returns `DeviceNotRegistered` error, remove the invalid `expoPushToken` from the User document
  - Implement rate-limit detection: on 429 response, apply exponential backoff (1s, 2s, 4s, 8s, 16s) up to 5 retries
  - Support Android notification channels: include `channelId` based on notification category (orders, payments, promotions)
  - Integrate PushGateway into Notification Orchestrator (replace direct PushNotificationService usage)
  - Write unit tests for batching logic, token cleanup, and rate-limit backoff

- [x] 13. Push Retry Engine
  - Create `backend/src/models/PushRetry.ts` — schema with: notificationId, userId, title, body, data, attempts, nextAttemptAt, lastError, status (pending/succeeded/dead_letter)
  - Create `backend/src/domains/communication/services/pushRetryWorker.ts`
  - When PushGateway fails to deliver (non-token-invalid errors), insert into PushRetry collection
  - Implement retry schedule: 1 minute, 5 minutes, 15 minutes, 30 minutes, 1 hour (5 attempts total)
  - Implement polling worker (similar pattern to OutboxDispatcher) polling every 30 seconds for retries due
  - After 5 failed attempts, set status to `dead_letter`
  - On success, update notification delivery lifecycle status
  - Add indexes on (status, nextAttemptAt) for efficient polling
  - Write unit tests for retry scheduling and dead-letter transition

- [x] 14. Notification Center Badge (Frontend)
  - In `apps/customer-app/src/components/` — create or update notification bell icon component
  - Use existing `useGetUnreadCountQuery()` hook from `notificationsApi.ts`
  - Display red badge with unread count on the bell icon (hide badge when count = 0)
  - Listen for `notification:unread_count` socket event to update badge in real-time without polling
  - Add badge to the main tab navigator or header component where the bell icon lives
  - Ensure badge updates when notifications are marked as read

- [x] 15. Real-Time Notification Prepend (Frontend)
  - In `apps/customer-app/src/screens/notifications/NotificationsScreen.tsx`
  - Add Socket.IO listener for `notification:new` event using existing socketClient
  - When new notification received via socket, prepend to the local notification list state
  - Optimistically increment unread count
  - Animate new notification entry (fade-in or slide-down)
  - Handle edge case: if notification center is scrolled down, show "New notification" pill at top

- [x] 16. Toast System Upgrade (Queue, Deep Link, Swipe)
  - Upgrade `apps/customer-app/src/components/common/Toast.tsx`
  - Change auto-dismiss timeout from 2.5s to 4s
  - Add swipe-to-dismiss gesture using PanResponder or react-native-gesture-handler
  - Add tap-to-navigate: on tap, extract deepLink from notification data and navigate using navigation ref
  - Implement toast queue: store pending toasts in array, display one at a time with 1s gap
  - Implement max queue: after 3 queued toasts, show summary toast ("X more notifications")
  - Listen for `notification:new` socket events as the toast trigger source
  - Update `uiSlice.ts` to support queue state management

- [x] 17. Notification Preferences UI Enhancement
  - Update `apps/customer-app/src/screens/settings/NotificationPreferencesScreen.tsx`
  - Display per-channel toggles: Push, In-App, Socket (real-time)
  - Display per-category toggles: Orders, Delivery, Payments, Account, Promotions
  - Add explanation text for each category
  - Use existing `useUpdateNotificationPreferencesMutation` hook
  - Add visual feedback on save (success toast)
  - Ensure toggle state reflects current server-side preferences on load

- [x] 18. Audit Log Model and Service
  - Create `backend/src/models/NotificationAudit.ts` with schema: notificationId, eventId, eventType, userId, actor, source, channels (array of {channel, status, sentAt, error}), priority, category, createdAt
  - Add TTL index for 90-day auto-expiration
  - Add indexes on: userId, eventType, createdAt
  - Create `backend/src/domains/communication/services/auditLogger.ts`
  - Implement `logNotificationAudit(params)` — creates audit record
  - Integrate into Notification Orchestrator: after channel fan-out, log audit with all channel statuses
  - Ensure audit creation never throws or blocks notification delivery (wrap in try/catch)
  - Write unit tests

- [x] 19. Socket Read/ReadAll Events Integration
  - In `backend/src/domains/communication/controllers/notificationController.ts`: after `markAsRead` succeeds, call `socketEmitter.emitNotificationRead(userId, notificationId)` and `socketEmitter.emitUnreadCount(userId, newCount)`
  - After `markAllAsRead` succeeds, call `socketEmitter.emitNotificationReadAll(userId)` and `socketEmitter.emitUnreadCount(userId, 0)`
  - In frontend socket listener, handle `notification:read` — update local state to mark specific notification as read
  - Handle `notification:read_all` — update all local notifications to read state
  - This enables multi-device sync (read on phone, badge updates on tablet)

- [x] 20. Offline Sync Protocol
  - In `apps/customer-app/src/services/socketClient.ts`: track `lastSeenTimestamp` (timestamp of most recent notification received)
  - On socket reconnect, emit `notification:request_sync` with `lastSeenTimestamp` to server
  - In backend SocketService: listen for `notification:request_sync` event from client, query notifications created after the provided timestamp for that user (limit 50), emit `notification:sync` with missed notifications + current unread count
  - In frontend NotificationsScreen: on app foreground (AppState change), check socket connection and trigger reconnect if needed
  - Store latest notifications in AsyncStorage for immediate display on app open
  - Merge server sync data with local cache, preferring server state for read/unread status

- [x] 21. Integration Tests for Phase B
  - Create `backend/tests/integration/notification/pushGateway.test.ts` — test batching, token cleanup, rate-limit handling
  - Create `backend/tests/integration/notification/retryEngine.test.ts` — test retry scheduling, dead-letter transition
  - Create `backend/tests/integration/notification/orchestratorFlow.test.ts` — end-to-end: publish event → notification created + socket emitted + push queued
  - Create `backend/tests/integration/notification/auditLog.test.ts` — verify audit records created correctly
  - All tests use MongoDB in-memory server for isolation

### Phase C: Post-Launch Features (P2)

- [x] 22. Delivery Lifecycle Tracking
  - Extend Notification model: add `lifecycle` field with per-channel status tracking: `{ push: { status, updatedAt, error }, socket: { status, updatedAt }, inApp: { status, updatedAt } }`
  - Create `backend/src/domains/communication/services/deliveryTracker.ts`
  - Implement `updateLifecycleStatus(notificationId, channel, status, error?)` function
  - Integrate with PushGateway: update to 'sent' after Expo accepts, 'delivered' on receipt confirmation
  - Integrate with Socket Emitter: update to 'sent' after IO emit
  - Add API endpoint `POST /api/notifications/:id/track` for client-side event tracking (opened, clicked)
  - Implement metrics aggregation: delivery rate, open rate, click rate per event type per time period
  - Write unit tests

- [x] 23. Analytics Dashboard Backend
  - Create `backend/src/domains/communication/controllers/notificationAnalyticsController.ts`
  - Implement `GET /api/admin/notifications/analytics` — returns aggregated metrics: total sent/delivered/opened/failed by time period, top notification types by volume, top failure reasons, push token health
  - Use MongoDB aggregation pipeline on NotificationAudit collection
  - Add category and priority filters
  - Implement delivery rate warning threshold (highlight if <80%)
  - Require admin role authentication
  - Write tests for aggregation queries

- [x] 24. Analytics Dashboard Frontend (Admin Panel)
  - Create notification analytics page in the admin web panel
  - Display charts: notifications sent over time (line chart), delivery success rate (gauge), failure breakdown (pie chart)
  - Display tables: top notification types, recent failures, push token health
  - Add time range selector (today, 7 days, 30 days)
  - Add category and priority filters
  - Use the analytics API from task 23
  - Implement auto-refresh every 60 seconds

- [x] 25. Bulk Notification System
  - Create `backend/src/domains/communication/services/bulkDispatcher.ts`
  - Create `backend/src/models/BulkNotificationJob.ts` — schema: id, title, body, category, deepLink, targetSegment, status (pending/processing/completed/cancelled), progress (total, sent, failed), createdBy, createdAt
  - Implement `POST /api/admin/notifications/bulk` — create and start bulk job
  - Process users in batches of 100 with 1-second delay between batches
  - Check individual user preferences before sending (skip if category disabled)
  - Implement `GET /api/admin/notifications/bulk/:jobId` — get progress status
  - Implement `POST /api/admin/notifications/bulk/:jobId/cancel` — cancel mid-execution
  - Write integration tests for batch processing, cancellation, and preference filtering

- [x] 26. Promotional Notification Automation
  - Create scheduled job for coupon expiry reminders (24h before expiration)
  - Query users with unused coupons expiring within 24 hours
  - Publish PROMO_CAMPAIGN events for eligible users
  - Respect promo category preference — skip users who disabled promo notifications
  - Add eligibility filtering for new promotions (target by user segment, location, activity)
  - Write unit tests for eligibility logic

- [x] 27. Playwright E2E Tests
  - Create `tests/e2e/notifications/notificationCenter.spec.ts`
  - Test: notification bell badge shows correct unread count
  - Test: notification center lists notifications sorted by time
  - Test: category filter shows only matching notifications
  - Test: tapping notification marks it as read and updates badge
  - Test: "Mark All as Read" clears all unread indicators
  - Test: deep link navigation from notification tap
  - Test: toast appears on new real-time notification
  - Test: toast auto-dismisses after 4 seconds
  - Requires seeded test data and authenticated test user

- [x] 28. Performance Optimization (Redis Caching)
  - Add Redis cache for unread notification count per user
  - Cache key: `notification:unread:{userId}`, invalidate on read/new notification
  - Set cache TTL to 5 minutes as safety net
  - Fall back to MongoDB count query on cache miss
  - Integrate cache invalidation into Notification Orchestrator (increment on create) and markAsRead/markAllAsRead controllers (decrement/zero)
  - Benchmark: verify <100ms response time for unread count at 95th percentile
  - Write integration tests for cache hit/miss/invalidation scenarios

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3", "4", "7", "8"] },
    { "id": 1, "tasks": ["5"] },
    { "id": 2, "tasks": ["6", "9", "10"] },
    { "id": 3, "tasks": ["11", "12", "14", "15", "16", "17", "18", "19"] },
    { "id": 4, "tasks": ["13", "20", "21"] },
    { "id": 5, "tasks": ["22", "23", "25", "26", "28"] },
    { "id": 6, "tasks": ["24", "27"] }
  ]
}
```

**Wave 1** (No dependencies): Tasks 1 (Template Registry), 2 (Socket Emitter), 3 (Channel Router), 4 (Priority Engine), 7 (Payment Events), 8 (Delivery Events) — all independent foundation components.

**Wave 2** (Depends on Wave 1): Task 5 (Orchestrator) — depends on tasks 1, 2, 3, 4.

**Wave 3** (Depends on Wave 2): Tasks 6 (Socket Integration), 9 (Admin Alerts), 10 (Remove Direct Calls) — all depend on task 5.

**Wave 4** (Depends on Waves 1-3): Tasks 11 (Unit Tests), 12 (Push Gateway), 14 (Badge), 15 (Prepend), 16 (Toast), 17 (Preferences UI), 18 (Audit Log), 19 (Socket Read Events) — depend on orchestrator and socket integration.

**Wave 5** (Depends on Wave 4): Tasks 13 (Retry Engine depends on 12), 20 (Offline Sync depends on 6), 21 (Integration Tests depend on 12-20).

**Wave 6** (Depends on Waves 4-5): Tasks 22 (Lifecycle Tracking depends on 12), 23 (Analytics Backend depends on 18), 25 (Bulk depends on 5), 26 (Promo depends on 1), 28 (Redis depends on 5).

**Wave 7** (Depends on Wave 6): Tasks 24 (Analytics Frontend depends on 23), 27 (E2E Tests depend on 14-16).

## Notes

- **Feature Flag**: The `NOTIFICATION_ORCHESTRATOR_ENABLED` environment variable controls the transition. During migration, both the existing `notificationWriter` and the new orchestrator can run side-by-side. The orchestrator uses a different `consumerName` in ProcessedEvent, so both can process events independently without conflict.
- **Backward Compatibility**: The existing Notification model, notification APIs (v1 and v2), and frontend NotificationsScreen continue to work unchanged. The orchestrator writes to the same Notification collection.
- **Bug Fix (Task 7)**: Payment events are currently not published from the webhook processor. This is a bug that causes payment notifications to not flow through the event bus. Task 7 fixes this.
- **Migration Safety (Task 10)**: Removing direct push calls is the highest-risk change. It must only happen after Task 5 is verified working in production with the feature flag enabled.
- **Existing Code Reuse**: Template Registry fallbacks to existing `defaultTitleForEvent()`. Channel Router reads existing `notificationPreferences` on User model. Socket Emitter uses existing SocketService IO instance. Orchestrator uses existing ProcessedEvent deduplication.

