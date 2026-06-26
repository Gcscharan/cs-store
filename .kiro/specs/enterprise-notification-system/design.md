# Design Document: Enterprise Notification System

## Overview

This design document specifies the architecture for the Enterprise Notification System for Vyapara Setu. The system extends the existing partial notification infrastructure into a unified, event-driven multi-channel notification framework. It includes a forensic audit of existing infrastructure, gap analysis, event inventory, architecture review, and target design.

The core architectural decision is to replace the existing `notificationWriter` consumer with a **Notification Orchestrator** that adds template resolution, multi-channel fan-out (in-app + push + socket), preference filtering, priority classification, and audit logging — all consuming from the same OutboxEvent → EventBus pipeline that already exists and is production-proven.

## Architecture

### Existing Models

| Model | File | Purpose | Status |
|-------|------|---------|--------|
| Notification | `backend/src/models/Notification.ts` | In-app notification storage with userId, title, message, body, eventType, meta, category, priority, isRead, orderId, deepLink | ✅ Working |
| OutboxEvent | `backend/src/models/OutboxEvent.ts` | Event persistence with outbox pattern (PENDING → DISPATCHING → DISPATCHED / FAILED / DEAD_LETTER) | ✅ Working |
| ProcessedEvent | `backend/src/models/ProcessedEvent.ts` | Consumer-level deduplication with (eventId, consumerName) unique constraint, 30-day TTL | ✅ Working |
| User (notificationPreferences) | `backend/src/models/User.ts` | Per-channel (push/sms/whatsapp) per-category preferences | ✅ Partial |

### Existing Services

| Service | File | Purpose | Status |
|---------|------|---------|--------|
| EventBus (publish) | `backend/src/domains/events/eventBus.ts` | Publishes events to OutboxEvent collection | ✅ Working |
| EventBus (deliverToSubscribers) | `backend/src/domains/events/eventBus.ts` | Fan-out to registered subscriber handlers | ✅ Working |
| OutboxDispatcher | `backend/src/domains/events/outboxDispatcher.ts` | Polls OutboxEvent, claims events, delivers to subscribers with retry/dead-letter (10 attempts, exponential backoff) | ✅ Working |
| NotificationWriter | `backend/src/domains/communication/services/notificationWriter.ts` | Event consumer → creates Notification records (order/delivery/payment/account/promo categories) | ✅ Working |
| AdminAssignmentConsumer | `backend/src/domains/operations/services/adminAssignmentConsumer.ts` | Consumes ORDER_CREATED → assigns order to admin | ✅ Working |
| PushNotificationService | `backend/src/utils/PushNotificationService.ts` | Sends push via Expo Push API, checks user preferences (push.enabled, push.categories.myOrders) | ✅ Working (limited) |
| NotificationService (communication) | `backend/src/domains/communication/services/notificationService.ts` | Multi-channel dispatch: email, SMS, WhatsApp, Push per event type with preference checks | ✅ Working |
| NotificationService (notifications domain) | `backend/src/domains/notifications/services/notificationService.ts` | Simple wrapper around PushNotificationService.sendToUser() | ✅ Working |
| SocketService | `backend/src/services/socketService.ts` | Socket.IO with JWT auth, user rooms (`user_{userId}`), order/payment/delivery events | ✅ Working |
| LowStockSocketService | `backend/src/services/lowStockSocketService.ts` | Socket.IO broadcast for low-stock admin alerts | ✅ Working |
| MailService | `backend/src/domains/communication/services/mailService.ts` | Email sending service | ✅ Working |

### Existing APIs

| Endpoint | Method | Handler | Purpose |
|----------|--------|---------|---------|
| `/api/notifications` | GET | getNotifications | Fetch user notifications (limit 50) |
| `/api/notifications/v2` | GET | getNotificationsV2 | Cursor-based pagination with category filter |
| `/api/notifications/unread/count` | GET | getUnreadCount | Unread notification count |
| `/api/notifications/:id/read` | PUT | markAsRead | Mark single as read |
| `/api/notifications/read-all` | PUT | markAllAsRead | Mark all as read |
| `/api/notifications/:id` | DELETE | deleteNotification | Delete notification |
| `/api/user/notification-preferences` | GET/PUT | (identity routes) | Get/update notification preferences |

### Existing Socket Events (Backend → Client)

| Event | Service | Purpose |
|-------|---------|---------|
| `order_status_updated` | SocketService | Order state changes |
| `otp_delivered` | SocketService | OTP sent to rider |
| `otp_verification_result` | SocketService | OTP verify result |
| `payment_status_update` | SocketService | Payment updates |
| `delivery_location_updated` | SocketService | Live location tracking |
| `order:status:changed` | SocketService (admin) | Admin real-time order status |
| `order:assigned` | SocketService (admin) | Admin real-time assignment |
| Low stock alerts | LowStockSocketService | Admin inventory alerts |

### Existing Event Types (Published to Event Bus)

| Event Type | Source | Published In |
|------------|--------|-------------|
| ORDER_CREATED | operations | orderBuilder.ts |
| ORDER_CONFIRMED | orders | orderStateService.ts |
| ORDER_PACKED | orders | orderStateService.ts |
| DELIVERY_ASSIGNED | orders | orderStateService.ts |
| ORDER_PICKED_UP | orders | orderStateService.ts |
| ORDER_IN_TRANSIT | orders | orderStateService.ts |
| ORDER_DELIVERED | orders | orderStateService.ts |
| ORDER_FAILED | orders | orderStateService.ts |
| ORDER_CANCELLED | orders | orderStateService.ts |
| PAYMENT_PENDING | payments | payment.events.ts |
| PAYMENT_SUCCESS | payments | payment.events.ts |
| REFUND_INITIATED | payments | payment.events.ts |
| REFUND_COMPLETED | payments | payment.events.ts |
| ACCOUNT_PROFILE_UPDATED | identity | userController.ts |
| ACCOUNT_PASSWORD_CHANGED | identity | authController.ts |
| ACCOUNT_NEW_LOGIN | identity | authController.ts |
| PROMO_CAMPAIGN | promo | promo.events.ts |
| SYSTEM_ANNOUNCEMENT | promo | promo.events.ts |

### Existing Frontend (Customer App)

| Component | File | Purpose |
|-----------|------|---------|
| NotificationsScreen | `apps/customer-app/src/screens/notifications/NotificationsScreen.tsx` | Notification center with category icons, time-ago, grouped by date |
| NotificationPreferencesScreen | `apps/customer-app/src/screens/settings/NotificationPreferencesScreen.tsx` | Preference UI |
| notificationsApi | `apps/customer-app/src/api/notificationsApi.ts` | RTK Query hooks for notifications (getNotifications, getUnreadCount, markAsRead, markAllAsRead, delete) |
| settingsApi | `apps/customer-app/src/api/settingsApi.ts` | RTK Query hooks for preferences |
| socketClient | `apps/customer-app/src/services/socketClient.ts` | Socket.IO client with JWT, auto-reconnect, order/payment/delivery event listeners |
| Toast component | `apps/customer-app/src/components/common/Toast.tsx` | Basic toast with auto-dismiss (2.5s) |
| uiSlice (toast) | `apps/customer-app/src/store/slices/uiSlice.ts` | Toast state (showToast, hideToast, addToast, removeToast) |

### Existing Push Notification Flows (Direct Calls in orderStateService)

The `orderStateService.ts` currently calls `PushNotificationService.sendToUser()` **directly** for:
- ORDER_CONFIRMED → "Order Confirmed ✅"
- ORDER_PACKED → "Order Packed 📦"
- ORDER_IN_TRANSIT → "Order Out for Delivery 🚚"
- ORDER_DELIVERED → "Order Delivered 🎉"
- ORDER_FAILED → "Delivery Failed ❌"
- ORDER_CANCELLED → "Order Cancelled 🛑"

The `deliveryOrderController.ts` calls `PushNotificationService.sendToUser()` for:
- Delivery earnings → "Order Delivered 🎉" + earnings amount

### Existing Deduplication

- **Event level**: OutboxEvent uses `eventId` unique index — prevents duplicate event creation
- **Consumer level**: ProcessedEvent uses `(eventId, consumerName)` unique index — prevents duplicate processing per consumer
- **Outbox relay**: Worker locks prevent double-dispatch via `lockedBy` field

---

## Phase 2 — Gap Analysis

| Req | Requirement | Existing Support | Missing Pieces | Reuse % |
|-----|-------------|------------------|----------------|---------|
| R1 | Event-Driven Orchestration | EventBus + OutboxDispatcher + NotificationWriter consumer exists. Creates in-app records. | No Socket.IO emission from consumer. No push from consumer (push is called directly in controllers). Template system missing. | 50% |
| R2 | Customer Order Lifecycle | Events published for all 9 states. NotificationWriter creates records. Push sent directly in orderStateService. | Push/socket not triggered from event consumer. Titles hardcoded in orderStateService, not template-driven. | 60% |
| R3 | Payment Notifications | PAYMENT_SUCCESS, REFUND_INITIATED, REFUND_COMPLETED events exist. NotificationWriter handles PAYMENT_* prefix. | No PAYMENT_FAILED event published (only webhook processing). No push triggered from event consumer for payments. | 40% |
| R4 | Delivery Partner Notifications | DELIVERY_ASSIGNED event exists. OTP delivery via Socket. Earning notification in deliveryOrderController. | No pickup reminder system. Assignment notification goes to customer, not rider (rider userId not in event data). | 30% |
| R5 | Earnings/Performance | Earning notification exists in deliveryOrderController (direct push + in-app record). | No milestones, no daily summary, no COD reminders. Not event-driven. | 20% |
| R6 | Admin Alerts | LowStockSocketService exists. Admin sees order:status:changed socket events. | No admin notification records. No payment failure alerts. No delivery failure alerts. No security event alerts. | 15% |
| R7 | Preferences | INotificationPreferences exists with per-channel/category structure. PushNotificationService checks push.enabled/myOrders. | Channel_Router not implemented. Socket/in-app not filtered by preferences. Priority override not implemented. | 35% |
| R8 | Notification Center UI | NotificationsScreen exists with category icons, grouping. V2 API with cursor pagination exists. | No badge/unread count shown on bell icon. No real-time prepend on new notification. Category filter not wired to v2 API. | 55% |
| R9 | Toast System | Toast component exists with auto-dismiss. uiSlice manages toast state. | No queue management. No deep-link tap. No swipe dismiss. Auto-dismiss is 2.5s not 4s. No summary toast. | 25% |
| R10 | Push Delivery | PushNotificationService uses Expo Push API. Reads expoPushToken. | No batching. No token cleanup on invalid. No Android channels. No rate-limit backoff. | 30% |
| R11 | Template System | NotificationWriter uses defaultTitleForEvent (only "Order placed successfully"). orderStateService has hardcoded titles. | No template registry. No variable interpolation. No role-based overrides. All content hardcoded. | 5% |
| R12 | Socket.IO Events | SocketService emits order_status_updated, payment_status_update. User rooms exist. | No `notification:new` event. No `notification:read` event. No `notification:unread_count`. NotificationWriter doesn't emit socket. | 20% |
| R13 | Promotional | PROMO_CAMPAIGN/SYSTEM_ANNOUNCEMENT events exist. NotificationWriter handles PROMO_ prefix. | No coupon expiry reminders. No eligibility filtering. No preference respect in promo delivery. | 20% |
| R14 | Delivery Guarantee | OutboxEvent tracks status (PENDING→DISPATCHED→FAILED). | No per-notification lifecycle tracking (sent/delivered/opened/clicked). No push receipt checking. No metrics. | 10% |
| R15 | Deduplication | ProcessedEvent provides event-level dedupe. OutboxEvent prevents duplicate publish. | No notification-level dedupe (same logical event → same notification). No dedupe window/TTL at notification layer. | 40% |
| R16 | Priority Engine | Notification model has priority field (high/normal/low). NotificationWriter infers priority from event prefix. | No P0-P3 classification. No differentiated delivery behavior per priority. No sound/badge control per priority. | 20% |
| R17 | Retry Engine | OutboxDispatcher has exponential backoff (1s→10min), dead-letter after 10 attempts. | This retries event delivery, not push notification delivery. No push-specific retry with 1m/5m/15m/30m/1h schedule. | 10% (conceptual reuse) |
| R18 | Bulk Notifications | dispatchToAllUsers() exists in NotificationService (communication). | No batching with delay. No progress tracking. No cancellation. No admin API. | 15% |
| R19 | Audit Trail | OutboxEvent stores source, actor, eventType. Logger captures [EVENT_CONSUMED] entries. | No separate audit collection. No immutable log. Not queryable. No retention policy enforcement. | 10% |
| R20 | Analytics Dashboard | opsMetrics.ts counts outbox pending/failed. | No notification analytics. No delivery/open/click rates. No push token health. No admin dashboard UI. | 5% |
| R21 | Offline Support | Socket reconnection exists in socketClient. Offline queue exists in DeliveryRouteScreen. | No notification local persistence. No sync-on-reconnect protocol. No last-seen timestamp sync. | 10% |
| R22 | Security | authenticateToken middleware on all notification routes. Socket JWT auth. userId filter on queries. | No role-based isolation for delivery partner vs customer notifications. No admin-only endpoint guards for bulk/analytics. No unauthorized access logging. | 50% |
| R23 | Performance | MongoDB indexes on userId+createdAt, userId+isRead. OutboxDispatcher polls every 1s. | No Redis caching for unread count. No connection pooling config. No performance benchmarks. | 30% |
| R24 | Testing | Some unit tests for LowStockSocketService, NotificationService delivery. Socket tests exist. | No notification flow E2E tests. No template interpolation tests. No deduplication tests. No Playwright notification UI tests. | 15% |

### Classification Summary

| Status | Requirements |
|--------|-------------|
| **Partially Implemented** | R1, R2, R3, R7, R8, R9, R10, R12, R13, R15, R16, R22, R23 |
| **Minimally Implemented** | R4, R5, R6, R11, R14, R17, R18, R19, R20, R21, R24 |
| **No Dead Code** | All existing code is actively used and functional |

### Key Insight: Migration Strategy

The existing system has TWO notification paths that must be unified:
1. **Event-Driven Path**: Controller → `publish()` → OutboxEvent → OutboxDispatcher → `deliverToSubscribers()` → NotificationWriter → creates Notification record
2. **Direct Path**: Controller → `PushNotificationService.sendToUser()` directly (in orderStateService, deliveryOrderController)

The enterprise system must:
- Remove direct push calls from controllers (move to event consumer)
- Add Socket.IO emission to the event consumer
- Add template resolution to the event consumer
- Add preference filtering to the event consumer
- Keep the existing OutboxEvent → NotificationWriter flow as the foundation

---

## Phase 3 — Event Inventory

### Order Events

| Event Type | Source Controller/Service | Current Notification Path | Current Channels | Missing Channels |
|------------|--------------------------|--------------------------|------------------|------------------|
| ORDER_CREATED | orderBuilder.ts | EventBus → NotificationWriter (in-app) + AdminAssignmentConsumer | In-App | Push (to customer), Socket, Admin Alert |
| ORDER_CONFIRMED | orderStateService.ts | EventBus → NotificationWriter (in-app) + Direct Push | In-App, Push | Socket |
| ORDER_PACKED | orderStateService.ts | EventBus → NotificationWriter (in-app) + Direct Push | In-App, Push | Socket |
| DELIVERY_ASSIGNED | orderStateService.ts | EventBus → NotificationWriter (in-app, to customer) | In-App | Push (customer + rider), Socket |
| ORDER_PICKED_UP | orderStateService.ts | EventBus → NotificationWriter (in-app) | In-App | Push, Socket |
| ORDER_IN_TRANSIT | orderStateService.ts | EventBus → NotificationWriter (in-app) + Direct Push | In-App, Push | Socket |
| ORDER_DELIVERED | orderStateService.ts | EventBus → NotificationWriter (in-app) + Direct Push | In-App, Push | Socket |
| ORDER_FAILED | orderStateService.ts | EventBus → NotificationWriter (in-app) + Direct Push | In-App, Push | Socket, Admin Alert |
| ORDER_CANCELLED | orderStateService.ts | EventBus → NotificationWriter (in-app) + Direct Push | In-App, Push | Socket |

### Payment Events

| Event Type | Source | Current Path | Channels | Missing |
|------------|--------|-------------|----------|---------|
| PAYMENT_PENDING | payment.events.ts (factory only) | Not published in production flow | None | All |
| PAYMENT_SUCCESS | payment.events.ts (factory only) | Not published in production flow | None | In-App, Push, Socket |
| REFUND_INITIATED | payment.events.ts (factory only) | Not published in production flow | None | In-App, Push, Socket |
| REFUND_COMPLETED | payment.events.ts (factory only) | Not published in production flow | None | In-App, Push, Socket |

**Bug Found**: Payment event factories exist but are NOT published from the webhook processor or payment controllers. The webhook processor normalizes to `PAYMENT_CAPTURED`/`PAYMENT_FAILED` but doesn't call the event bus `publish()`.

### Account Events

| Event Type | Source | Current Path | Channels | Missing |
|------------|--------|-------------|----------|---------|
| ACCOUNT_PROFILE_UPDATED | userController.ts | EventBus → NotificationWriter (in-app) | In-App | None (low priority) |
| ACCOUNT_PASSWORD_CHANGED | authController.ts | EventBus → NotificationWriter (in-app) | In-App | Push (security alert) |
| ACCOUNT_NEW_LOGIN | authController.ts | EventBus → NotificationWriter (in-app) | In-App | Push (security alert) |

### Delivery Partner Events (MISSING — Need New Events)

| Event Type (Proposed) | Trigger | Current Handling | Needed |
|-----------------------|---------|-----------------|--------|
| DELIVERY_PICKUP_REMINDER | Scheduled job (new) | Does not exist | Push to rider |
| DELIVERY_OTP_GENERATED | deliveryOrderController | Direct socket only | Socket + In-App |
| DELIVERY_COMPLETED | deliveryOrderController | Direct push + direct Notification.create() | EventBus integration |
| EARNINGS_CREDITED | deliveryOrderController | Direct push + direct Notification.create() | EventBus integration |
| EARNINGS_DAILY_SUMMARY | Scheduled job (new) | Does not exist | Push + In-App |
| PERFORMANCE_MILESTONE | Delivery service (new) | Does not exist | Push + In-App |
| COD_SETTLEMENT_REMINDER | Scheduled job (new) | Does not exist | Push + In-App |

### Admin Events (MISSING — Need New Events)

| Event Type (Proposed) | Trigger | Current Handling | Needed |
|-----------------------|---------|-----------------|--------|
| ADMIN_NEW_ORDER | orderBuilder (reuse ORDER_CREATED) | Socket only (order:status:changed) | In-App, Socket, Push |
| ADMIN_PAYMENT_FAILED | webhook processor | Not handled | In-App, Socket, Push |
| ADMIN_DELIVERY_FAILED | orderStateService (reuse ORDER_FAILED) | Socket only | In-App, Socket, Push |
| ADMIN_LOW_STOCK | LowStockSocketService | Socket only (broadcastLowStockAlert) | In-App + Socket (exists) |
| ADMIN_SECURITY_EVENT | Auth controller (new) | Does not exist | In-App, Socket, Push |

---

## Phase 4 — Architecture Review

### Current Architecture Assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Scalability** | ⚠️ Medium | Single-threaded OutboxDispatcher polls every 1s. Fine for current volume (~1000 orders/day) but needs tuning for 100K notifications/day |
| **Reliability** | ✅ Good | Outbox pattern with atomic publish (session), dead-letter after 10 attempts, exponential backoff |
| **Maintainability** | ⚠️ Medium | Dual notification paths (event-driven + direct calls) create confusion. Hardcoded notification content. |
| **Security** | ✅ Good | JWT auth on routes, socket auth, userId filtering on queries |
| **Performance** | ✅ Good | MongoDB indexes exist on key fields. Cursor pagination implemented. |
| **Observability** | ⚠️ Low | Logger entries only. No metrics dashboard. No delivery tracking. |
| **Fault Tolerance** | ✅ Good | Outbox retry handles subscriber failures. ProcessedEvent prevents duplicates. |

### Scalability Analysis (Target: 100,000 notifications/day)

Current capacity estimate:
- OutboxDispatcher polls every 1000ms → ~86,400 events/day maximum throughput (single worker)
- With warm-start (5 immediate ticks) and fast processing, effective capacity is higher
- For 100K notifications/day: Need to reduce poll interval to 250ms OR add concurrent claim (batch claim)

Recommendation: Reduce `pollIntervalMs` to 250ms and add a `batchSize` parameter to claim multiple events per tick.

### Migration Risk Assessment

| Change | Risk | Mitigation |
|--------|------|-----------|
| Remove direct push calls from orderStateService | HIGH — breaks notifications if consumer fails | Feature flag: run both paths during transition, then remove direct calls |
| Add Socket.IO emission to NotificationWriter | LOW — additive change, no existing behavior modified | Direct addition to existing consumer |
| Add template system | LOW — additive, can fall back to existing hardcoded titles | Template registry with fallback to current defaultTitleForEvent |
| Payment event publishing | MEDIUM — must ensure webhook processor publishes events correctly | Add alongside existing flow, test thoroughly |
| New delivery partner events | LOW — new functionality, no existing code affected | New event types, new consumer logic |

---

## Phase 5 — Target Architecture Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTROLLERS / SERVICES                         │
│  (orderStateService, orderBuilder, webhookProcessor, etc.)           │
│                                                                       │
│  publish(event) ──────────────────────────────────────────────────►  │
└────────────────────────────────────────────┬──────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         OUTBOX EVENT (MongoDB)                        │
│  Atomic write with business transaction (session)                    │
│  Status: PENDING → DISPATCHING → DISPATCHED | FAILED | DEAD_LETTER  │
└────────────────────────────────────────────┬──────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       OUTBOX DISPATCHER (Poller)                      │
│  Claims events, delivers to subscribers, retry with backoff          │
│  Poll: 250ms | Dead-letter: 10 attempts | Backoff: 1s→10min         │
└────────────────────────────────────────────┬──────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EVENT SUBSCRIBERS (Consumers)                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────┐                             │
│  │  NOTIFICATION ORCHESTRATOR (NEW)     │                             │
│  │  Replaces notificationWriter         │                             │
│  │                                       │                             │
│  │  1. Deduplicate (ProcessedEvent)     │                             │
│  │  2. Resolve Template (title/body/dl) │                             │
│  │  3. Determine recipients (multi-role)│                             │
│  │  4. Check Preferences (Channel Router)│                            │
│  │  5. Classify Priority (P0-P3)        │                             │
│  │  6. Fan-out to channels:             │                             │
│  │     ├── In-App (Notification.create) │                             │
│  │     ├── Push (PushGateway)           │                             │
│  │     ├── Socket (SocketEmitter)       │                             │
│  │     └── Audit (AuditLog.create)      │                             │
│  │  7. Track delivery lifecycle          │                             │
│  └─────────────────────────────────────┘                             │
│                                                                       │
│  ┌─────────────────────────────────────┐                             │
│  │  ADMIN ASSIGNMENT CONSUMER (existing)│                             │
│  └─────────────────────────────────────┘                             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
         │              │               │              │
         ▼              ▼               ▼              ▼
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  MongoDB   │  │ Expo Push  │  │ Socket.IO  │  │ Audit Log  │
│ Notification│  │    API     │  │  Rooms     │  │ Collection │
│ Collection │  │            │  │            │  │            │
└────────────┘  └────────────┘  └────────────┘  └────────────┘
```

### Data Flow

1. **Business Action** → Controller/Service calls `publish(event, { session })`
2. **Outbox Persistence** → OutboxEvent created atomically with business data
3. **Outbox Relay** → OutboxDispatcher claims PENDING events, calls `deliverToSubscribers()`
4. **Notification Orchestrator** → Consumes event, resolves template, fans out to channels
5. **Channel Delivery** → Each channel delivers independently (failures don't block others)
6. **Audit + Tracking** → Every notification creation logged with lifecycle state

### New Models

#### NotificationTemplate (Configuration, not DB — in-memory registry)

```typescript
interface NotificationTemplate {
  eventType: string;
  role: 'customer' | 'delivery_partner' | 'admin' | 'all';
  title: string;        // e.g., "Order Confirmed"
  body: string;         // e.g., "Your order #{orderNumber} has been confirmed"
  deepLinkPattern: string; // e.g., "/orders/{orderId}"
  category: NotificationCategory;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  channels: ('in_app' | 'push' | 'socket')[];
  sound: boolean;
}
```

#### NotificationAudit (New MongoDB Collection)

```typescript
interface INotificationAudit {
  notificationId: ObjectId;
  eventId: string;
  eventType: string;
  userId: ObjectId;
  actor: { type: string; id?: string };
  source: string;
  channels: { channel: string; status: string; sentAt?: Date; error?: string }[];
  priority: string;
  category: string;
  createdAt: Date;
}
```

#### NotificationDelivery (Lifecycle Tracking — extends Notification or new field)

```typescript
// Add to existing Notification model
interface NotificationLifecycle {
  push?: { status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed'; updatedAt: Date; error?: string };
  socket?: { status: 'sent' | 'delivered'; updatedAt: Date };
  inApp?: { status: 'delivered' | 'opened' | 'clicked'; updatedAt: Date };
}
```

#### PushRetryQueue (New MongoDB Collection)

```typescript
interface IPushRetry {
  notificationId: ObjectId;
  userId: ObjectId;
  title: string;
  body: string;
  data: any;
  attempts: number;
  nextAttemptAt: Date;
  lastError?: string;
  status: 'pending' | 'succeeded' | 'dead_letter';
  createdAt: Date;
}
```

### Component Architecture

#### 1. Notification Orchestrator (`notificationOrchestrator.ts`)
- Replaces `notificationWriter.ts` (superset of functionality)
- Subscribes to EventBus
- Executes: Dedupe → Template → Recipients → Preferences → Priority → Channel Fan-out → Audit

#### 2. Template Registry (`notificationTemplates.ts`)
- In-memory map: `Map<eventType, Map<role, NotificationTemplate>>`
- Variable interpolation: `{varName}` → event.data[varName]
- Fallback to legacy `defaultTitleForEvent()` for unmapped events

#### 3. Channel Router (`channelRouter.ts`)
- Input: user preferences, notification priority, notification category
- Output: list of channels to deliver on
- Rule: P0 notifications always push + in-app regardless of preferences

#### 4. Push Gateway (`pushGateway.ts`)
- Extends existing `PushNotificationService`
- Adds: batching (500ms window), token cleanup, rate-limit backoff, retry scheduling
- Expo Push API for mobile, Firebase for web (future)

#### 5. Socket Emitter (`socketEmitter.ts`)
- New module that integrates with existing SocketService
- Emits: `notification:new`, `notification:read`, `notification:read_all`, `notification:unread_count`
- Accesses SocketService IO instance via app.get("io")

#### 6. Priority Engine (`priorityEngine.ts`)
- Maps event type → priority level (from template registry)
- Determines delivery behavior per priority (sound, badge, retry aggressiveness)

#### 7. Retry Engine (`pushRetryWorker.ts`)
- Scheduled job polling PushRetryQueue
- Backoff: 1m, 5m, 15m, 30m, 1h
- Dead-letter after 5 attempts

#### 8. Bulk Dispatcher (`bulkDispatcher.ts`)
- Admin API to send to segments
- Processes in batches of 100 with 1s delay
- Progress tracking in Redis (or MongoDB doc)
- Cancellation via flag check between batches

#### 9. Audit Logger (`auditLogger.ts`)
- Creates NotificationAudit record for every notification
- Immutable (no updates, only inserts)
- Queryable by userId, eventType, time range

### Socket Event Protocol (New)

```typescript
// Server → Client
'notification:new' → { id, title, body, category, priority, deepLink, createdAt }
'notification:read' → { notificationId }
'notification:read_all' → {}
'notification:unread_count' → { count }
'notification:sync' → { notifications: NotificationDTO[], totalUnread: number }
```

### Migration Strategy

**Phase A: Foundation (Non-Breaking)**
1. Create template registry with all event types
2. Create Socket Emitter module
3. Create Notification Orchestrator (initially delegates to existing notificationWriter for in-app)
4. Add `notification:new` socket emission after Notification.create in orchestrator
5. Feature-flag the new orchestrator alongside existing notificationWriter

**Phase B: Unification (Gradual Migration)**
1. Move push delivery from orderStateService direct calls INTO the orchestrator (behind feature flag)
2. Add payment event publishing to webhook processor
3. Add new delivery partner events
4. Add admin notification records for admin alerts
5. Remove feature flag — orchestrator becomes sole consumer

**Phase C: Enterprise Features**
1. Push retry engine
2. Delivery lifecycle tracking
3. Audit logging
4. Analytics dashboard
5. Bulk notification system
6. Offline sync protocol

### Security Architecture

- All notification APIs behind `authenticateToken` middleware (existing)
- userId filter enforced at query level — no cross-user access possible
- Admin endpoints behind `requireRole(["admin"])` middleware
- Socket rooms scoped to `user_{userId}` — server-side join only after JWT verification
- Audit log records all notification generations for compliance

### Testing Strategy

| Level | Scope | Framework |
|-------|-------|-----------|
| Unit | Template interpolation, priority classification, deduplication logic, preference filtering | Jest |
| Integration | Event publish → Notification record created + Socket emitted + Push dispatched | Jest + MongoDB in-memory |
| E2E | Notification center UI, unread badge, mark-read, deep link navigation, toast display | Playwright (web), Detox or manual (mobile) |
| Property-Based | Template interpolation round-trip, deduplication idempotency, preference filtering completeness | fast-check |

---

## Phase 6 — Implementation Plan

### Phase A: Launch-Critical (P0)

| Task | Files | Est. LOC | Dependencies | Risk | Complexity |
|------|-------|----------|--------------|------|------------|
| A1: Create template registry | `backend/src/domains/communication/templates/notificationTemplates.ts` | 250 | None | Low | Medium |
| A2: Create Socket Emitter | `backend/src/domains/communication/services/socketEmitter.ts` | 100 | SocketService | Low | Low |
| A3: Create Channel Router | `backend/src/domains/communication/services/channelRouter.ts` | 150 | User model (preferences) | Low | Medium |
| A4: Create Priority Engine | `backend/src/domains/communication/services/priorityEngine.ts` | 80 | Template registry | Low | Low |
| A5: Create Notification Orchestrator | `backend/src/domains/communication/services/notificationOrchestrator.ts` | 300 | A1-A4, existing NotificationWriter | Medium | High |
| A6: Add `notification:new` socket event | A2 + A5 integration | 50 | A2, A5 | Low | Low |
| A7: Publish payment events from webhook | `backend/src/domains/payments/services/webhookProcessor.ts` | 40 | payment.events.ts | Medium | Low |
| A8: Add delivery partner events | `backend/src/domains/events/delivery.events.ts` (new) | 150 | BaseEvent | Low | Low |
| A9: Add admin alert routing in orchestrator | A5 extension | 80 | A5, admin user query | Low | Medium |
| A10: Remove direct push calls from orderStateService | `orderStateService.ts` modification | -60 | A5 verified working | HIGH | Low |
| A11: Unit tests for A1-A5 | `backend/tests/unit/notification/` | 400 | A1-A5 | Low | Medium |

### Phase B: Near-Launch (P1)

| Task | Files | Est. LOC | Dependencies | Risk | Complexity |
|------|-------|----------|--------------|------|------------|
| B1: Enhanced Push Gateway (batching, cleanup) | `backend/src/domains/communication/services/pushGateway.ts` | 200 | PushNotificationService | Medium | Medium |
| B2: Push Retry Engine | `backend/src/domains/communication/services/pushRetryWorker.ts` + model | 250 | B1 | Medium | High |
| B3: Notification Center badge (frontend) | `apps/customer-app/src/components/` | 80 | Unread count API | Low | Low |
| B4: Real-time notification prepend (frontend) | Socket listener + state update | 100 | A6 | Low | Medium |
| B5: Toast system upgrade (queue, deep-link, swipe) | `apps/customer-app/src/components/common/Toast.tsx` | 200 | uiSlice | Low | Medium |
| B6: Notification preferences UI enhancement | Preferences screen | 150 | Preference API | Low | Medium |
| B7: Audit Log model + logger | `backend/src/models/NotificationAudit.ts` + service | 200 | A5 | Low | Medium |
| B8: Socket read/read-all events | A2 extension + controller integration | 60 | A2 | Low | Low |
| B9: Offline sync protocol | Socket handler + client-side storage | 250 | B4 | Medium | High |
| B10: Integration tests | `backend/tests/integration/notification/` | 350 | A1-A11, B1-B2 | Low | Medium |

### Phase C: Post-Launch (P2)

| Task | Files | Est. LOC | Dependencies | Risk | Complexity |
|------|-------|----------|--------------|------|------------|
| C1: Delivery lifecycle tracking | Notification model extension + tracking service | 200 | A5, B1 | Low | Medium |
| C2: Analytics dashboard (backend) | API endpoints + aggregation queries | 300 | C1, B7 | Low | High |
| C3: Analytics dashboard (frontend) | Admin panel React components | 400 | C2 | Low | High |
| C4: Bulk notification system | Service + admin API + progress tracking | 350 | A5 | Medium | High |
| C5: Promotional notification automation | Scheduled jobs + eligibility filtering | 200 | A5, A1 | Low | Medium |
| C6: Playwright E2E tests | `tests/e2e/notifications/` | 300 | B3-B5 | Low | Medium |
| C7: Performance optimization (Redis caching) | Unread count caching + invalidation | 150 | Redis | Medium | Medium |

### Total Estimated Effort

| Phase | Tasks | Est. LOC | Timeline |
|-------|-------|----------|----------|
| Phase A | 11 tasks | ~1,660 LOC | 1-2 weeks |
| Phase B | 10 tasks | ~1,840 LOC | 1-2 weeks |
| Phase C | 7 tasks | ~1,900 LOC | 2-3 weeks |
| **Total** | **28 tasks** | **~5,400 LOC** | **4-7 weeks** |


## Components and Interfaces

### Notification Orchestrator

```typescript
// backend/src/domains/communication/services/notificationOrchestrator.ts
interface NotificationOrchestrator {
  /** Initialize the orchestrator by subscribing to the EventBus */
  initializeNotificationOrchestrator(): void;
}

// Internal pipeline steps (not exported)
// 1. deduplicate(event: BaseEvent): Promise<boolean>
// 2. resolveTemplate(eventType: string, role: string): NotificationTemplate | null
// 3. determineRecipients(event: BaseEvent): Promise<Recipient[]>
// 4. checkPreferences(userId: string, category: string, priority: string): Promise<Channel[]>
// 5. fanOutToChannels(notification: NotificationPayload, channels: Channel[]): Promise<void>
```

### Template Registry

```typescript
// backend/src/domains/communication/templates/notificationTemplates.ts
interface NotificationTemplate {
  eventType: string;
  role: 'customer' | 'delivery_partner' | 'admin' | 'all';
  title: string;             // Pattern with {variables}
  body: string;              // Pattern with {variables}
  deepLinkPattern: string;   // Pattern like "/orders/{orderId}"
  category: 'order' | 'delivery' | 'payment' | 'account' | 'promo';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  channels: ('in_app' | 'push' | 'socket')[];
  sound: boolean;
}

function resolveTemplate(eventType: string, role: string): NotificationTemplate | null;
function interpolateTemplate(template: NotificationTemplate, data: Record<string, any>): { title: string; body: string; deepLink: string };
```

### Socket Emitter

```typescript
// backend/src/domains/communication/services/socketEmitter.ts
class SocketEmitter {
  constructor(app: Express.Application);
  emitNotificationNew(userId: string, dto: NotificationDTO): void;
  emitNotificationRead(userId: string, notificationId: string): void;
  emitNotificationReadAll(userId: string): void;
  emitUnreadCount(userId: string, count: number): void;
  emitNotificationSync(userId: string, notifications: NotificationDTO[], totalUnread: number): void;
}
```

### Channel Router

```typescript
// backend/src/domains/communication/services/channelRouter.ts
type Channel = 'in_app' | 'push' | 'socket';

function determineChannels(
  userId: string,
  category: string,
  priority: string,
  templateChannels: Channel[]
): Promise<Channel[]>;
```

### Priority Engine

```typescript
// backend/src/domains/communication/services/priorityEngine.ts
type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3';

interface DeliveryBehavior {
  sound: boolean;
  badge: boolean;
  retryAttempts: number;
  forceChannels: Channel[];
}

function classifyPriority(eventType: string): PriorityLevel;
function getDeliveryBehavior(priority: PriorityLevel): DeliveryBehavior;
```

### Push Gateway

```typescript
// backend/src/domains/communication/services/pushGateway.ts
class PushGateway {
  /** Queue a push notification (batched internally) */
  queuePush(userId: string, title: string, body: string, data?: any): Promise<void>;
  /** Flush pending batch immediately */
  flush(): Promise<void>;
}
```

### Push Retry Worker

```typescript
// backend/src/domains/communication/services/pushRetryWorker.ts
function initializePushRetryWorker(params?: { pollIntervalMs?: number }): void;
```

### Bulk Dispatcher

```typescript
// backend/src/domains/communication/services/bulkDispatcher.ts
interface BulkJobParams {
  title: string;
  body: string;
  category: string;
  deepLink?: string;
  targetSegment: 'all_customers' | 'all_delivery_partners' | 'all_admins' | string;
  createdBy: string;
}

function startBulkJob(params: BulkJobParams): Promise<string>; // returns jobId
function cancelBulkJob(jobId: string): Promise<void>;
function getBulkJobProgress(jobId: string): Promise<{ total: number; sent: number; failed: number; status: string }>;
```

### Audit Logger

```typescript
// backend/src/domains/communication/services/auditLogger.ts
interface AuditEntry {
  notificationId: string;
  eventId: string;
  eventType: string;
  userId: string;
  actor: { type: string; id?: string };
  source: string;
  channels: { channel: string; status: string; sentAt?: Date; error?: string }[];
  priority: string;
  category: string;
}

function logNotificationAudit(entry: AuditEntry): Promise<void>;
```

## Data Models

### Notification (Existing — Extended)

```typescript
// backend/src/models/Notification.ts (existing, add lifecycle field)
interface INotification extends Document {
  userId: ObjectId;
  title: string;
  message: string;
  body?: string;
  eventType?: string;
  meta?: Record<string, any>;
  type?: 'info' | 'delivery_otp' | 'order_update' | 'general';
  category?: 'order' | 'delivery' | 'payment' | 'account' | 'promo';
  priority?: 'high' | 'normal' | 'low';
  isRead: boolean;
  orderId?: ObjectId;
  deepLink?: string;
  // NEW: Lifecycle tracking (Phase C)
  lifecycle?: {
    push?: { status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed'; updatedAt: Date; error?: string };
    socket?: { status: 'sent' | 'delivered'; updatedAt: Date };
    inApp?: { status: 'delivered' | 'opened' | 'clicked'; updatedAt: Date };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### NotificationAudit (New)

```typescript
// backend/src/models/NotificationAudit.ts
interface INotificationAudit extends Document {
  notificationId: ObjectId;
  eventId: string;
  eventType: string;
  userId: ObjectId;
  actor: { type: string; id?: string };
  source: string;
  channels: { channel: string; status: string; sentAt?: Date; error?: string }[];
  priority: string;
  category: string;
  createdAt: Date;
}
// Indexes: { userId: 1, createdAt: -1 }, { eventType: 1 }, TTL on createdAt (90 days)
```

### PushRetry (New)

```typescript
// backend/src/models/PushRetry.ts
interface IPushRetry extends Document {
  notificationId: ObjectId;
  userId: ObjectId;
  title: string;
  body: string;
  data: any;
  attempts: number;
  nextAttemptAt: Date;
  lastError?: string;
  status: 'pending' | 'succeeded' | 'dead_letter';
  createdAt: Date;
}
// Indexes: { status: 1, nextAttemptAt: 1 }, { userId: 1 }
```

### BulkNotificationJob (New)

```typescript
// backend/src/models/BulkNotificationJob.ts
interface IBulkNotificationJob extends Document {
  title: string;
  body: string;
  category: string;
  deepLink?: string;
  targetSegment: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  progress: { total: number; sent: number; failed: number };
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

### OutboxEvent (Existing — No Changes)

Reused as-is. The OutboxDispatcher already provides event reliability, retry, and dead-letter.

### ProcessedEvent (Existing — No Changes)

Reused as-is. The Notification Orchestrator uses consumerName `"notificationOrchestrator"` for deduplication.

## Error Handling

### Channel Isolation
Each delivery channel (in-app, push, socket) executes independently. A failure in one channel MUST NOT prevent delivery on other channels. Each channel call is wrapped in try/catch:

```typescript
// Pseudocode in Notification Orchestrator
for (const channel of activeChannels) {
  try {
    await deliverToChannel(channel, notification);
    auditChannelStatus(channel, 'sent');
  } catch (err) {
    logger.error(`[ORCHESTRATOR] Channel ${channel} failed`, { err, notificationId });
    auditChannelStatus(channel, 'failed', err.message);
    // Continue to next channel — no rethrow
  }
}
```

### Push Notification Failures
- **Invalid token (DeviceNotRegistered)**: Remove token from user, log removal, do not retry
- **Rate limited (429)**: Schedule retry via PushRetryQueue with exponential backoff
- **Server error (5xx)**: Schedule retry via PushRetryQueue
- **Network error**: Schedule retry via PushRetryQueue
- **Dead-letter**: After 5 failed retry attempts, move to dead_letter status for manual review

### Event Processing Failures
- **Subscriber throws**: OutboxDispatcher catches, increments attempts, schedules retry with backoff
- **Dead-letter threshold (10 attempts)**: OutboxEvent moved to DEAD_LETTER status
- **Duplicate event**: ProcessedEvent unique constraint catches it silently (skip, log info)

### Socket Emission Failures
- **User not connected**: Socket emit to room succeeds silently (no connected sockets = no delivery)
- **IO instance unavailable**: Log warning, continue (socket is best-effort delivery)

### Template Resolution Failures
- **Unknown event type**: Skip notification generation, log warning — this is expected for events that don't need notifications
- **Missing variable in interpolation**: Use empty string fallback, log warning for developer debugging

## Testing Strategy

### Unit Tests (Jest)
- **Template Registry**: Resolution for all event types, variable interpolation (valid, missing, special characters), role-based overrides, fallback behavior
- **Channel Router**: All preference combinations, P0 override, default preferences, missing preferences, disabled channels
- **Priority Engine**: Classification for all event types, delivery behavior per priority level
- **Notification Orchestrator**: Full pipeline with mocked dependencies (ProcessedEvent, Template, Preferences, Channel delivery)
- **Socket Emitter**: All event emissions with mocked Socket.IO server

### Integration Tests (Jest + MongoDB in-memory)
- **End-to-End Flow**: Publish event → verify Notification record created, socket event emitted, push queued
- **Deduplication**: Same event published twice → only one notification created
- **Preference Filtering**: User with disabled category → notification not delivered on that channel
- **Push Gateway**: Batching behavior, token cleanup on error, rate-limit backoff
- **Retry Engine**: Failed push → retry scheduled → dead-letter after exhaustion
- **Audit Log**: Verify audit record created with correct channel statuses

### E2E Tests (Playwright)
- Notification center rendering and badge count
- Category filtering
- Mark as read / Mark all as read
- Deep link navigation from notification tap
- Toast display and auto-dismiss
- Real-time notification prepend

### Property-Based Tests (fast-check)
- Template interpolation: for any valid template and data object, interpolation produces a string with no unresolved `{var}` markers
- Deduplication idempotency: processing same event N times produces exactly 1 notification
- Preference filtering: P0 notifications always delivered regardless of random preference configurations

## Correctness Properties

### Property 1: Exactly-Once Delivery (per consumer)
For any event processed by the Notification Orchestrator, exactly one notification record is created per target user, guaranteed by the ProcessedEvent (eventId, consumerName) unique constraint.

**Validates: Requirements 1.4, 15.1, 15.4**

### Property 2: Channel Isolation
A failure in push delivery does not prevent in-app record creation or socket emission. Each channel operates independently.

**Validates: Requirements 1.5**

### Property 3: Priority Override Invariant
For all P0 notifications, push and in-app channels are always active regardless of user preference configuration.

**Validates: Requirements 7.5, 16.2**

### Property 4: Template Interpolation Completeness
For any template and any data object, the interpolated output contains no unresolved `{variableName}` patterns (missing variables resolve to empty string).

**Validates: Requirements 11.3**

### Property 5: Deduplication Idempotency
Processing the same event N times (N ≥ 1) produces exactly 1 notification record and exactly 1 audit log entry.

**Validates: Requirements 15.1, 15.2**

### Property 6: Retry Convergence
Every push notification in the retry queue either succeeds or reaches dead-letter status within a bounded time (max 5 attempts over ~51 minutes).

**Validates: Requirements 17.1, 17.3**

### Property 7: Preference Monotonicity
Disabling a notification category prevents all future notifications in that category (except P0 overrides). Enabling a category permits future notifications immediately.

**Validates: Requirements 7.3, 7.4**

### Property 8: Audit Completeness
Every notification generated by the Orchestrator has a corresponding NotificationAudit record with all channel delivery statuses.

**Validates: Requirements 19.1**

