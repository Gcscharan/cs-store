# Design Document: Delivery Partner Dashboard Transformation

## Overview

### Purpose

This design document specifies the technical architecture for transforming the existing React web delivery partner dashboard into a production-grade React Native (Expo) mobile application. The transformation addresses critical usability challenges faced by delivery partners in real-world conditions: one-handed operation while riding, poor network connectivity, time pressure, and the need for instant action clarity.

### Goals

1. **Mobile-First Experience**: Native mobile application optimized for one-handed usage with gesture support
2. **Offline Resilience**: Offline-first architecture enabling continued operation during network disruptions
3. **Action Clarity**: Simplified UI with progressive disclosure and clear next-action indicators
4. **Real-Time Updates**: Socket.io-based real-time order updates and performance metrics
5. **Industry Benchmark Quality**: Match the UX quality of Amazon Flex, Swiggy, Zomato, and Blinkit delivery apps

### Scope

**In Scope:**
- React Native (Expo) mobile application for iOS and Android
- Offline-first data architecture with background sync
- Simplified order card UI with progressive disclosure
- Gesture-based interactions (swipe to accept/reject, pull to refresh)
- Background GPS tracking with battery optimization
- Real-time Socket.io connection management
- Enhanced earnings dashboard with trends and comparisons
- Push notification system with deep linking
- Multi-language support (7 languages)
- Accessibility compliance (WCAG AA)

**Out of Scope:**
- Web admin dashboard transformation (remains React web app)
- Backend API changes (design assumes existing API with minor additions)
- Payment gateway integration changes
- Customer-facing application changes

### Key Design Decisions

1. **Expo Framework**: Using Expo managed workflow for faster development, OTA updates, and simplified native module integration
2. **Offline-First**: AsyncStorage + queue-based sync pattern ensures app functionality during network disruptions
3. **Socket.io for Real-Time**: Maintains persistent connection with automatic reconnection and exponential backoff
4. **React Native Gesture Handler + Reanimated**: For 60 FPS gesture animations and swipe interactions
5. **Component-Based Architecture**: Feature-based folder structure with reusable UI components and custom hooks
6. **TypeScript**: Type safety across all components, hooks, and data models

---

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Application                        │
│                  (React Native + Expo)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  UI Layer    │  │ State Layer  │  │ Data Layer   │     │
│  │              │  │              │  │              │     │
│  │ - Screens    │  │ - Zustand    │  │ - API Client │     │
│  │ - Components │  │ - Context    │  │ - Socket.io  │     │
│  │ - Navigation │  │ - Hooks      │  │ - AsyncStore │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Background Services                         │  │
│  │  - GPS Tracker (TaskManager)                         │  │
│  │  - Background Sync (TaskManager)                     │  │
│  │  - Push Notifications (expo-notifications)           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / WSS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend Services                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  REST API    │  │  Socket.io   │  │  Push Notif  │     │
│  │  Server      │  │  Server      │  │  Service     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Database (PostgreSQL/MongoDB)            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Application Architecture Layers

#### 1. UI Layer
- **Screens**: Feature-based screen components (Home, OrderDetails, Earnings, Profile, Notifications)
- **Components**: Reusable UI components (OrderCard, DeliveryButton, StatusBadge, ErrorRecoveryCard)
- **Navigation**: React Navigation v6 with stack and tab navigators

#### 2. State Management Layer
- **Global State**: Zustand for orders, user profile, performance metrics
- **Local State**: React hooks (useState, useReducer) for component-specific state
- **Custom Hooks**: Business logic encapsulation (useOrderManagement, useCodCollection, useSocketConnection, useOfflineSync)

#### 3. Data Layer
- **API Client**: Axios-based HTTP client with interceptors for auth and error handling
- **Socket.io Client**: Real-time connection with automatic reconnection
- **AsyncStorage**: Local persistence for orders, user data, offline queue
- **SecureStore**: Encrypted storage for auth tokens and sensitive data

#### 4. Background Services
- **GPS Tracker**: expo-location + expo-task-manager for background location updates
- **Background Sync**: TaskManager for processing offline queue when network available
- **Push Notifications**: expo-notifications for order assignments and updates

### Data Flow Patterns

#### Online Data Flow
```
User Action → Component → Custom Hook → API Client → Backend
                                              ↓
                                        AsyncStorage (cache)
                                              ↓
                                        UI Update (optimistic)
```

#### Offline Data Flow
```
User Action → Component → Custom Hook → Offline Queue (AsyncStorage)
                                              ↓
                                        UI Update (optimistic)
                                              ↓
                                   Network Available Detection
                                              ↓
                                   Background Sync → Backend
                                              ↓
                                   Sync Success → Update UI
```

#### Real-Time Data Flow
```
Backend Event → Socket.io → useSocketConnection Hook → Zustand Store
                                                             ↓
                                                    Component Re-render
```

---

## Components and Interfaces

### Component Hierarchy

```
App
├── NavigationContainer
│   ├── AuthStack (if not authenticated)
│   │   └── LoginScreen
│   └── MainTabs (if authenticated)
│       ├── HomeTab
│       │   ├── HomeScreen
│       │   │   ├── PerformanceMetricsCard
│       │   │   ├── OrderList (FlatList)
│       │   │   │   └── OrderCard (Swipeable)
│       │   │   │       ├── OrderCardCollapsed
│       │   │   │       └── OrderCardExpanded
│       │   │   └── EmptyState
│       │   └── OrderDetailsScreen
│       │       ├── OrderHeader
│       │       ├── OrderTimeline
│       │       ├── CodCollectionFlow
│       │       ├── OtpVerificationFlow
│       │       └── ActionButtons
│       ├── EarningsTab
│       │   └── EarningsScreen
│       │       ├── EarningsSummaryCard
│       │       ├── EarningsTrendChart
│       │       ├── EarningsBreakdown
│       │       └── PayoutInformation
│       ├── NotificationsTab
│       │   └── NotificationsScreen
│       │       ├── NotificationFilters
│       │       └── NotificationList
│       │           └── NotificationCard
│       └── ProfileTab
│           └── ProfileScreen
│               ├── ProfileHeader
│               ├── PerformanceMetrics
│               ├── LanguageSelector
│               └── SettingsOptions
└── GlobalComponents
    ├── OfflineIndicator
    ├── LoadingOverlay
    └── ErrorBoundary
```

### Core Components

#### OrderCard Component
```typescript
interface OrderCardProps {
  order: Order;
  onExpand: (orderId: string) => void;
  onCollapse: (orderId: string) => void;
  onSwipeRight: (orderId: string) => void; // Accept
  onSwipeLeft: (orderId: string) => void;  // Reject
  isExpanded: boolean;
}

// Collapsed View: Order ID, Customer Name, Status, Distance, Primary Action
// Expanded View: + Full Address, Payment Details, Items List, Secondary Actions
```

#### DeliveryButton Component
```typescript
interface DeliveryButtonProps {
  variant: 'primary' | 'secondary' | 'tertiary';
  action: 'positive' | 'neutral' | 'destructive';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  icon?: string;
}

// Primary: Full-width, 56px, gradient background
// Secondary: Full-width, 48px, outlined border
// Tertiary: Inline, 36px, text-only
```

#### ErrorRecoveryCard Component
```typescript
interface ErrorRecoveryCardProps {
  error: AppError;
  onRetry: () => void;
  onContactSupport?: () => void;
  retryCount: number;
  maxRetries: number;
}

// Displays inline error with description, suggested action, retry button
```

#### StatusBadge Component
```typescript
interface StatusBadgeProps {
  status: OrderStatus | PaymentStatus;
  type: 'order' | 'payment';
}

// Color-coded badges for order and payment status
```

### Custom Hooks

#### useOrderManagement
```typescript
interface UseOrderManagementReturn {
  orders: Order[];
  activeOrders: Order[];
  loading: boolean;
  error: AppError | null;
  acceptOrder: (orderId: string) => Promise<void>;
  rejectOrder: (orderId: string, reason: string) => Promise<void>;
  startPickup: (orderId: string) => Promise<void>;
  startDelivery: (orderId: string) => Promise<void>;
  markArrived: (orderId: string) => Promise<void>;
  completeDelivery: (orderId: string, otp: string) => Promise<void>;
  cancelOrder: (orderId: string, reason: string) => Promise<void>;
  refreshOrders: () => Promise<void>;
}
```

#### useCodCollection
```typescript
interface UseCodCollectionReturn {
  paymentMode: 'cash' | 'upi' | null;
  setPaymentMode: (mode: 'cash' | 'upi') => void;
  sendOtp: (orderId: string) => Promise<void>;
  verifyOtp: (orderId: string, otp: string) => Promise<void>;
  otpSent: boolean;
  otpExpiry: Date | null;
  canResendOtp: boolean;
  resendCooldown: number;
  loading: boolean;
  error: AppError | null;
}
```

#### useSocketConnection
```typescript
interface UseSocketConnectionReturn {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler: (data: any) => void) => void;
}

// Manages Socket.io connection with automatic reconnection
// Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 attempts)
```

#### useOfflineSync
```typescript
interface UseOfflineSyncReturn {
  isOnline: boolean;
  queueSize: number;
  syncing: boolean;
  lastSyncTime: Date | null;
  queueAction: (action: OfflineAction) => Promise<void>;
  syncNow: () => Promise<void>;
}

// Queues actions when offline, syncs when online
```

#### useBackgroundLocation
```typescript
interface UseBackgroundLocationReturn {
  location: Location | null;
  tracking: boolean;
  error: Error | null;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

// Manages background GPS tracking with TaskManager
```

---

## Data Models

### Order Model
```typescript
interface Order {
  id: string;
  orderId: string; // Display ID (e.g., "ORD-12345")
  status: OrderStatus;
  customerId: string;
  customerName: string;
  customerPhone: string; // Masked: "****1234"
  pickupAddress: Address;
  deliveryAddress: Address;
  items: OrderItem[];
  payment: PaymentInfo;
  distance: number; // in kilometers
  estimatedTime: number; // in minutes
  assignedAt: Date;
  acceptedAt?: Date;
  pickedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  nextAction: NextAction;
  priority: 'normal' | 'high' | 'urgent';
}

type OrderStatus = 
  | 'assigned'
  | 'accepted'
  | 'picked'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'cancelled';

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface PaymentInfo {
  method: 'cod' | 'upi' | 'card';
  amount: number;
  currency: string;
  status: PaymentStatus;
  collectedAt?: Date;
  collectedMode?: 'cash' | 'upi';
}

type PaymentStatus = 'pending' | 'received' | 'failed';

interface NextAction {
  type: 'accept' | 'start_pickup' | 'start_delivery' | 'mark_arrived' | 'collect_payment' | 'send_otp';
  label: string;
  color: 'blue' | 'purple' | 'green';
  icon: string;
}
```

### Notification Model
```typescript
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

type NotificationType = 
  | 'order_assigned'
  | 'order_cancelled'
  | 'payment_received'
  | 'payout_completed'
  | 'system_message';

interface NotificationData {
  orderId?: string;
  payoutId?: string;
  deepLink?: string;
}
```

### Earnings Model
```typescript
interface Earnings {
  today: EarningsSummary;
  week: EarningsSummary;
  month: EarningsSummary;
  all: EarningsSummary;
  trend: EarningsTrend[];
  breakdown: EarningsBreakdown;
  payout: PayoutInfo;
}

interface EarningsSummary {
  total: number;
  ordersCompleted: number;
  averagePerOrder: number;
  comparisonPercentage: number; // vs previous period
  streak: number; // consecutive days above threshold
}

interface EarningsTrend {
  date: Date;
  amount: number;
  ordersCompleted: number;
}

interface EarningsBreakdown {
  deliveryFees: number;
  tips: number;
  bonuses: number;
}

interface PayoutInfo {
  nextPayoutDate: Date;
  pendingAmount: number;
  lastPayoutDate?: Date;
  lastPayoutAmount?: number;
  payoutStatus: 'pending' | 'processing' | 'completed';
  bankAccount: {
    accountNumber: string; // Masked: "****1234"
    ifscCode: string;
    accountHolderName: string;
  };
  history: PayoutHistory[];
}

interface PayoutHistory {
  id: string;
  amount: number;
  date: Date;
  status: 'completed' | 'failed';
  transactionId: string;
}
```

### Performance Metrics Model
```typescript
interface PerformanceMetrics {
  acceptanceRate: number; // percentage
  averageDeliveryTime: number; // minutes
  deliveryStreak: number; // consecutive days
  customerRating: number; // 1-5 stars
  totalDeliveries: number;
  onTimeDeliveryRate: number; // percentage
  areaAverage?: {
    acceptanceRate: number;
    averageDeliveryTime: number;
    customerRating: number;
  };
  lastUpdated: Date;
}
```

### Offline Queue Model
```typescript
interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  timestamp: Date;
  retryCount: number;
  idempotencyKey: string;
}

type OfflineActionType =
  | 'accept_order'
  | 'reject_order'
  | 'start_pickup'
  | 'start_delivery'
  | 'mark_arrived'
  | 'collect_payment'
  | 'complete_delivery'
  | 'cancel_order'
  | 'update_location';
```

### User Profile Model
```typescript
interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  profilePhoto?: string;
  deliveryPartnerId: string;
  status: 'online' | 'offline' | 'busy';
  vehicleType: 'bike' | 'scooter' | 'bicycle';
  language: Language;
  lastUpdated: Date;
}

type Language = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'bn' | 'mr';
```

---

## API Contracts and Socket Events

### REST API Endpoints

#### Authentication
```
POST /api/v1/auth/login
Request: { phone: string, otp: string }
Response: { token: string, user: UserProfile }

POST /api/v1/auth/refresh
Request: { refreshToken: string }
Response: { token: string }

POST /api/v1/auth/logout
Request: { token: string }
Response: { success: boolean }
```

#### Orders
```
GET /api/v1/orders/active
Response: { orders: Order[] }

GET /api/v1/orders/:orderId
Response: { order: Order }

POST /api/v1/orders/:orderId/accept
Request: { idempotencyKey: string }
Response: { order: Order }

POST /api/v1/orders/:orderId/reject
Request: { reason: string, idempotencyKey: string }
Response: { success: boolean }

POST /api/v1/orders/:orderId/start-pickup
Request: { location: Coordinates, idempotencyKey: string }
Response: { order: Order }

POST /api/v1/orders/:orderId/start-delivery
Request: { location: Coordinates, idempotencyKey: string }
Response: { order: Order }

POST /api/v1/orders/:orderId/mark-arrived
Request: { location: Coordinates, idempotencyKey: string }
Response: { order: Order }

POST /api/v1/orders/:orderId/send-otp
Request: { idempotencyKey: string }
Response: { otpSent: boolean, expiresAt: Date }

POST /api/v1/orders/:orderId/verify-otp
Request: { otp: string, idempotencyKey: string }
Response: { verified: boolean, order: Order }

POST /api/v1/orders/:orderId/collect-payment
Request: { mode: 'cash' | 'upi', amount: number, idempotencyKey: string }
Response: { payment: PaymentInfo }

POST /api/v1/orders/:orderId/complete
Request: { otp: string, location: Coordinates, idempotencyKey: string }
Response: { order: Order }

POST /api/v1/orders/:orderId/cancel
Request: { reason: string, idempotencyKey: string }
Response: { success: boolean }
```

#### Earnings
```
GET /api/v1/earnings/summary
Query: { period: 'today' | 'week' | 'month' | 'all' }
Response: { earnings: Earnings }

GET /api/v1/earnings/trend
Query: { startDate: Date, endDate: Date }
Response: { trend: EarningsTrend[] }

GET /api/v1/earnings/payout
Response: { payout: PayoutInfo }

GET /api/v1/earnings/payout/history
Query: { page: number, limit: number }
Response: { history: PayoutHistory[], total: number }
```

#### Performance
```
GET /api/v1/performance/metrics
Response: { metrics: PerformanceMetrics }
```

#### Profile
```
GET /api/v1/profile
Response: { profile: UserProfile }

PUT /api/v1/profile
Request: { name?: string, language?: Language }
Response: { profile: UserProfile }

POST /api/v1/profile/photo
Request: FormData { photo: File }
Response: { photoUrl: string }

PUT /api/v1/profile/status
Request: { status: 'online' | 'offline' }
Response: { success: boolean }
```

#### Location
```
POST /api/v1/location/update
Request: { location: Coordinates, timestamp: Date }
Response: { success: boolean }

POST /api/v1/location/batch
Request: { locations: Array<{ location: Coordinates, timestamp: Date }> }
Response: { success: boolean, synced: number }
```

#### Notifications
```
GET /api/v1/notifications
Query: { type?: NotificationType, page: number, limit: number }
Response: { notifications: Notification[], total: number }

PUT /api/v1/notifications/:notificationId/read
Response: { success: boolean }

PUT /api/v1/notifications/read-all
Request: { type?: NotificationType }
Response: { success: boolean }

DELETE /api/v1/notifications/clear
Request: { type?: NotificationType }
Response: { success: boolean }
```

#### Offline Sync
```
POST /api/v1/sync/batch
Request: { actions: OfflineAction[] }
Response: { 
  results: Array<{ 
    actionId: string, 
    success: boolean, 
    error?: string 
  }> 
}
```

### Socket.io Events

#### Client → Server Events
```typescript
// Connection
socket.emit('authenticate', { token: string });
socket.emit('go_online', { location: Coordinates });
socket.emit('go_offline');

// Location Updates
socket.emit('location_update', { 
  location: Coordinates, 
  timestamp: Date 
});
```

#### Server → Client Events
```typescript
// Connection
socket.on('authenticated', (data: { success: boolean, userId: string }));
socket.on('connection_error', (error: { message: string }));

// Order Events
socket.on('order_assigned', (order: Order));
socket.on('order_updated', (order: Order));
socket.on('order_cancelled', (data: { orderId: string, reason: string }));

// Performance Updates
socket.on('metrics_updated', (metrics: PerformanceMetrics));

// Earnings Updates
socket.on('payment_received', (data: { orderId: string, amount: number }));
socket.on('payout_completed', (payout: PayoutHistory));

// System Events
socket.on('system_message', (message: { title: string, body: string }));
```

### Error Response Format
```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    retryable: boolean;
  };
}

// Common Error Codes
// AUTH_001: Invalid credentials
// AUTH_002: Token expired
// AUTH_003: Unauthorized
// ORDER_001: Order not found
// ORDER_002: Order already accepted
// ORDER_003: Invalid order status
// ORDER_004: OTP expired
// ORDER_005: Invalid OTP
// PAYMENT_001: Payment already collected
// NETWORK_001: Network timeout
// NETWORK_002: Server unavailable
// VALIDATION_001: Invalid input
```

---

## Offline-First Architecture

### Offline Queue Strategy

The offline-first architecture ensures the app remains functional during network disruptions by queuing actions locally and syncing when connectivity is restored.

#### Queue Storage Structure
```typescript
// AsyncStorage Key: @offline_queue
interface OfflineQueue {
  actions: OfflineAction[];
  lastSyncAttempt: Date | null;
  syncInProgress: boolean;
}
```

#### Action Queuing Flow
```
1. User performs action (e.g., accept order)
2. Check network status
3. If offline:
   a. Generate idempotency key
   b. Create OfflineAction with payload
   c. Add to queue in AsyncStorage
   d. Update UI optimistically
   e. Show offline indicator
4. If online:
   a. Execute API call directly
   b. Update UI on success
```

#### Background Sync Process
```
1. Network status changes to online
2. Trigger background sync task
3. Load offline queue from AsyncStorage
4. Process actions in chronological order
5. For each action:
   a. Execute API call with idempotency key
   b. If success: Remove from queue
   c. If failure (retryable): Increment retry count
   d. If failure (non-retryable): Remove from queue, log error
6. Update UI with sync results
7. Show notification: "X actions synced successfully"
```

#### Idempotency Key Generation
```typescript
function generateIdempotencyKey(
  actionType: string, 
  orderId: string, 
  timestamp: Date
): string {
  return `${actionType}_${orderId}_${timestamp.getTime()}`;
}

// Ensures duplicate actions are not processed if sync retries
```

#### Retry Strategy
- Maximum 3 retry attempts per action
- Exponential backoff: 1s, 2s, 4s
- After 3 failures, mark action as failed and notify user
- User can manually retry failed actions from sync history

### Local Data Caching

#### Cache Strategy
```typescript
// Cache active orders for 5 minutes
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;
}

// AsyncStorage Keys
// @cache_orders: CacheEntry<Order[]>
// @cache_earnings: CacheEntry<Earnings>
// @cache_profile: CacheEntry<UserProfile>
// @cache_metrics: CacheEntry<PerformanceMetrics>
```

#### Cache Invalidation
- Invalidate on successful sync
- Invalidate on explicit user refresh
- Invalidate on TTL expiry
- Invalidate on Socket.io update

### Background Sync Implementation

Using Expo TaskManager for background sync:

```typescript
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const BACKGROUND_SYNC_TASK = 'background-sync-task';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const queue = await loadOfflineQueue();
    if (queue.actions.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    const results = await syncOfflineActions(queue.actions);
    await updateOfflineQueue(results);
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register background sync task
await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
  minimumInterval: 15 * 60, // 15 minutes
  stopOnTerminate: false,
  startOnBoot: true,
});
```

---

## Real-Time Connection Management

### Socket.io Configuration

```typescript
import io from 'socket.io-client';

const socketConfig = {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 16000,
  timeout: 10000,
  autoConnect: false,
};

const socket = io(SOCKET_URL, socketConfig);
```

### Connection Lifecycle

```
1. App Launch
   ↓
2. Authenticate with token
   ↓
3. Establish Socket connection
   ↓
4. Listen for events
   ↓
5. On disconnect: Attempt reconnection
   ↓
6. Exponential backoff: 1s, 2s, 4s, 8s, 16s
   ↓
7. After 5 failed attempts: Show manual reconnect option
```

### Reconnection Strategy

```typescript
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server disconnected, manual reconnection required
    socket.connect();
  }
  // Otherwise, automatic reconnection will be attempted
});

socket.on('reconnect_attempt', (attemptNumber) => {
  reconnectAttempts = attemptNumber;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    socket.disconnect();
    showManualReconnectUI();
  }
});

socket.on('reconnect', () => {
  reconnectAttempts = 0;
  // Re-authenticate and sync state
  socket.emit('authenticate', { token: getAuthToken() });
});
```

### Event Handling Pattern

```typescript
// useSocketConnection hook
export function useSocketConnection() {
  const [connected, setConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('reconnect_attempt', (attempt) => setReconnectAttempts(attempt));
    
    socket.connect();
    
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect_attempt');
    };
  }, []);
  
  const emit = useCallback((event: string, data: any) => {
    if (connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket not connected, event not sent:', event);
    }
  }, [connected]);
  
  return { connected, reconnectAttempts, emit };
}
```

---

## Background GPS Tracking

### Location Tracking Strategy

#### Foreground Tracking
- High accuracy mode (GPS)
- Update interval: 10 seconds
- Used when app is active and order is in progress

#### Background Tracking
- Balanced accuracy mode (Network + GPS)
- Update interval: 30 seconds
- Used when app is minimized with active orders
- Stops when no active orders

### Implementation with TaskManager

```typescript
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    await queueLocationUpdates(locations);
  }
});

// Start background tracking
async function startBackgroundTracking() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Background location permission not granted');
  }
  
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30000, // 30 seconds
    distanceInterval: 50, // 50 meters
    foregroundService: {
      notificationTitle: 'Delivery in Progress',
      notificationBody: 'Tracking your location for delivery',
      notificationColor: '#4F46E5',
    },
  });
}

// Stop background tracking
async function stopBackgroundTracking() {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
```

### Battery Optimization

1. **Adaptive Tracking**: Switch to balanced accuracy in background
2. **Distance-Based Updates**: Only update if moved 50+ meters
3. **Stop When Idle**: Stop tracking when no active orders
4. **Batch Updates**: Queue location updates and send in batches
5. **Foreground Service**: Use Android foreground service to prevent task killing

### Permission Handling

```typescript
async function requestLocationPermissions(): Promise<boolean> {
  // Request foreground permission first
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  
  if (foregroundStatus !== 'granted') {
    showPermissionRationale('foreground');
    return false;
  }
  
  // Request background permission
  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  
  if (backgroundStatus !== 'granted') {
    showPermissionRationale('background');
    return false;
  }
  
  return true;
}

function showPermissionRationale(type: 'foreground' | 'background') {
  const message = type === 'foreground'
    ? 'Location access is required to navigate to customer locations and track deliveries.'
    : 'Background location access is required to update your location while delivering orders.';
  
  Alert.alert('Location Permission Required', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
}
```

---

## Gesture Handling

### Swipe Gesture Implementation

Using react-native-gesture-handler and react-native-reanimated for 60 FPS animations:

```typescript
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated';

function SwipeableOrderCard({ order, onAccept, onReject }) {
  const translateX = useSharedValue(0);
  const SWIPE_THRESHOLD = 0.5; // 50% of card width
  
  const renderRightActions = () => (
    <View style={styles.acceptAction}>
      <Icon name="check" size={24} color="white" />
      <Text style={styles.actionText}>Accept</Text>
    </View>
  );
  
  const renderLeftActions = () => (
    <View style={styles.rejectAction}>
      <Icon name="close" size={24} color="white" />
      <Text style={styles.actionText}>Reject</Text>
    </View>
  );
  
  const handleSwipeableOpen = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAccept(order.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onReject(order.id);
    }
  };
  
  return (
    <Swipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={handleSwipeableOpen}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      rightThreshold={SWIPE_THRESHOLD * cardWidth}
      leftThreshold={SWIPE_THRESHOLD * cardWidth}
    >
      <OrderCardContent order={order} />
    </Swipeable>
  );
}
```

### Pull-to-Refresh

```typescript
import { RefreshControl } from 'react-native';

function OrderList({ orders, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onRefresh();
    setRefreshing(false);
  };
  
  return (
    <FlatList
      data={orders}
      renderItem={({ item }) => <OrderCard order={item} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#4F46E5"
        />
      }
    />
  );
}
```

### Haptic Feedback

```typescript
import * as Haptics from 'expo-haptics';

// Light feedback for UI interactions
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Medium feedback for swipe gestures
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// Heavy feedback for important actions
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

// Success notification
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Error notification
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
```

---

## Error Handling

### Error Classification

Errors are classified into three categories based on their handling strategy:

#### 1. Retryable Errors
Errors that can be automatically retried with exponential backoff:
- Network timeouts (NETWORK_001)
- Server unavailable (NETWORK_002)
- Temporary server errors (5xx)
- Socket disconnections

**Retry Strategy:**
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 seconds delay
- After 3 attempts: Show manual retry option

#### 2. User-Actionable Errors
Errors requiring user intervention:
- Invalid OTP (ORDER_005)
- Order already accepted (ORDER_002)
- Invalid order status (ORDER_003)
- Authentication errors (AUTH_001, AUTH_002)

**Handling:**
- Display inline error message with clear description
- Provide suggested action
- Show retry button if applicable
- Log error for analytics

#### 3. Fatal Errors
Errors requiring app restart or support contact:
- Token expired (AUTH_002) → Force logout and re-login
- Unauthorized access (AUTH_003) → Force logout
- Critical app crashes → Error boundary with restart option

### Error UI Patterns

#### Inline Error Recovery
```typescript
<ErrorRecoveryCard
  error={{
    code: 'NETWORK_001',
    message: 'Network timeout while accepting order',
    retryable: true,
  }}
  onRetry={() => retryAcceptOrder(orderId)}
  retryCount={2}
  maxRetries={3}
/>
```

#### Toast Notifications
Used for non-critical errors and success messages:
```typescript
showToast({
  type: 'error',
  message: 'Failed to update location',
  duration: 3000,
});
```

#### Error Boundary
Catches unhandled React errors:
```typescript
<ErrorBoundary
  fallback={<ErrorScreen onRestart={() => restartApp()} />}
  onError={(error, errorInfo) => logError(error, errorInfo)}
>
  <App />
</ErrorBoundary>
```

### Network Error Handling

#### Offline Detection
```typescript
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener(state => {
  if (!state.isConnected) {
    showOfflineIndicator();
    pauseSocketConnection();
  } else {
    hideOfflineIndicator();
    resumeSocketConnection();
    triggerBackgroundSync();
  }
});
```

#### Request Timeout Handling
```typescript
const apiClient = axios.create({
  timeout: 10000, // 10 seconds
  timeoutErrorMessage: 'Request timed out. Please check your connection.',
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED') {
      return handleRetryableError(error);
    }
    return Promise.reject(error);
  }
);
```

### Idempotency Implementation

All state-changing operations use idempotency keys to prevent duplicate actions:

```typescript
function generateIdempotencyKey(action: string, orderId: string): string {
  return `${action}_${orderId}_${Date.now()}_${Math.random()}`;
}

// Example: Accept order with idempotency
async function acceptOrder(orderId: string) {
  const idempotencyKey = generateIdempotencyKey('accept', orderId);
  
  try {
    const response = await api.post(`/orders/${orderId}/accept`, {
      idempotencyKey,
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      // Order already accepted (idempotent response)
      return error.response.data;
    }
    throw error;
  }
}
```

### Error Logging

```typescript
interface ErrorLog {
  timestamp: Date;
  errorCode: string;
  errorMessage: string;
  screen: string;
  action: string;
  userId: string;
  deviceInfo: {
    platform: 'ios' | 'android';
    version: string;
    model: string;
  };
  stackTrace?: string;
}

function logError(error: Error, context: ErrorContext) {
  const errorLog: ErrorLog = {
    timestamp: new Date(),
    errorCode: error.code || 'UNKNOWN',
    errorMessage: error.message,
    screen: context.screen,
    action: context.action,
    userId: getUserId(),
    deviceInfo: getDeviceInfo(),
    stackTrace: error.stack,
  };
  
  // Store locally for debugging
  AsyncStorage.setItem(
    `@error_log_${Date.now()}`,
    JSON.stringify(errorLog)
  );
  
  // Send to analytics (when online)
  analytics.logError(errorLog);
}
```

---

## Testing Strategy

### Testing Approach

This mobile transformation requires a comprehensive testing strategy combining unit tests, integration tests, end-to-end tests, and manual testing. **Property-based testing is not applicable** for this feature as it primarily involves UI rendering, external service integrations, and side-effect-heavy operations.

### Unit Testing

#### Scope
- Custom hooks (useOrderManagement, useCodCollection, useSocketConnection, useOfflineSync)
- Utility functions (idempotency key generation, date formatting, distance calculation)
- Data transformation functions
- Validation logic

#### Tools
- **Jest**: Test runner and assertion library
- **React Native Testing Library**: Component testing
- **Mock Service Worker (MSW)**: API mocking

#### Coverage Target
- Minimum 80% code coverage for custom hooks
- 100% coverage for critical business logic (COD collection, offline sync)

#### Example Tests
```typescript
describe('useOrderManagement', () => {
  it('should accept order and update state', async () => {
    const { result } = renderHook(() => useOrderManagement());
    
    await act(async () => {
      await result.current.acceptOrder('order-123');
    });
    
    expect(result.current.orders[0].status).toBe('accepted');
  });
  
  it('should queue action when offline', async () => {
    mockNetworkStatus('offline');
    const { result } = renderHook(() => useOrderManagement());
    
    await act(async () => {
      await result.current.acceptOrder('order-123');
    });
    
    const queue = await getOfflineQueue();
    expect(queue.actions).toHaveLength(1);
    expect(queue.actions[0].type).toBe('accept_order');
  });
});

describe('useCodCollection', () => {
  it('should send OTP and start countdown', async () => {
    const { result } = renderHook(() => useCodCollection());
    
    await act(async () => {
      result.current.setPaymentMode('cash');
      await result.current.sendOtp('order-123');
    });
    
    expect(result.current.otpSent).toBe(true);
    expect(result.current.otpExpiry).toBeDefined();
  });
  
  it('should verify OTP and complete delivery', async () => {
    const { result } = renderHook(() => useCodCollection());
    
    await act(async () => {
      await result.current.verifyOtp('order-123', '1234');
    });
    
    expect(mockApi.post).toHaveBeenCalledWith(
      '/orders/order-123/verify-otp',
      expect.objectContaining({ otp: '1234' })
    );
  });
});

describe('generateIdempotencyKey', () => {
  it('should generate unique keys for same action', () => {
    const key1 = generateIdempotencyKey('accept', 'order-123');
    const key2 = generateIdempotencyKey('accept', 'order-123');
    
    expect(key1).not.toBe(key2);
  });
  
  it('should include action type and order ID', () => {
    const key = generateIdempotencyKey('accept', 'order-123');
    
    expect(key).toContain('accept');
    expect(key).toContain('order-123');
  });
});
```

### Integration Testing

#### Scope
- API integration with backend
- Socket.io connection and event handling
- Background sync process
- Location tracking integration
- Push notification handling

#### Tools
- **Jest**: Test runner
- **Mock Server**: Local API mock server
- **Socket.io Mock**: Socket event simulation

#### Example Tests
```typescript
describe('Order Acceptance Flow', () => {
  it('should accept order, update UI, and sync with backend', async () => {
    const { getByText, getByTestId } = render(<HomeScreen />);
    
    // Wait for orders to load
    await waitFor(() => {
      expect(getByText('ORD-12345')).toBeTruthy();
    });
    
    // Accept order
    fireEvent.press(getByText('Accept Order'));
    
    // Verify optimistic UI update
    expect(getByTestId('order-status')).toHaveTextContent('Accepted');
    
    // Verify API call
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/orders/order-123/accept',
        expect.any(Object)
      );
    });
  });
});

describe('Offline Sync', () => {
  it('should queue actions offline and sync when online', async () => {
    // Set offline
    mockNetworkStatus('offline');
    
    const { getByText } = render(<HomeScreen />);
    
    // Perform action while offline
    fireEvent.press(getByText('Accept Order'));
    
    // Verify action queued
    const queue = await getOfflineQueue();
    expect(queue.actions).toHaveLength(1);
    
    // Go online
    mockNetworkStatus('online');
    
    // Wait for sync
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalled();
    });
    
    // Verify queue cleared
    const updatedQueue = await getOfflineQueue();
    expect(updatedQueue.actions).toHaveLength(0);
  });
});
```

### End-to-End Testing

#### Scope
- Complete user flows (order acceptance to delivery completion)
- COD collection flow
- Navigation between screens
- Push notification handling

#### Tools
- **Detox**: E2E testing framework for React Native
- **Maestro**: Alternative E2E testing tool

#### Example Tests
```typescript
describe('Complete Delivery Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });
  
  it('should complete full delivery flow', async () => {
    // Login
    await element(by.id('phone-input')).typeText('9876543210');
    await element(by.id('otp-input')).typeText('1234');
    await element(by.id('login-button')).tap();
    
    // Accept order
    await waitFor(element(by.id('order-card-1')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('accept-button')).tap();
    
    // Start pickup
    await element(by.id('start-pickup-button')).tap();
    
    // Start delivery
    await element(by.id('start-delivery-button')).tap();
    
    // Mark arrived
    await element(by.id('mark-arrived-button')).tap();
    
    // Collect payment
    await element(by.id('payment-mode-cash')).tap();
    await element(by.id('send-otp-button')).tap();
    
    // Enter OTP
    await element(by.id('otp-input')).typeText('1234');
    
    // Verify delivery completed
    await waitFor(element(by.text('Delivery Completed')))
      .toBeVisible()
      .withTimeout(3000);
  });
});
```

### Performance Testing

#### Metrics to Monitor
- App launch time: < 2 seconds
- Screen transition time: < 300ms
- FlatList scroll performance: 60 FPS
- Gesture response time: < 100ms
- API response time: < 1 second
- Background sync time: < 5 seconds for 10 actions

#### Tools
- **React Native Performance Monitor**: Built-in performance overlay
- **Flipper**: Performance profiling
- **Firebase Performance Monitoring**: Production monitoring

#### Example Performance Tests
```typescript
describe('Performance', () => {
  it('should render order list with 100 items at 60 FPS', async () => {
    const orders = generateMockOrders(100);
    
    const { getByTestId } = render(<OrderList orders={orders} />);
    
    const startTime = performance.now();
    
    // Scroll to bottom
    await scrollTo(getByTestId('order-list'), { y: 5000 });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete in < 1 second
    expect(duration).toBeLessThan(1000);
  });
});
```

### Manual Testing Checklist

#### Functional Testing
- [ ] Order acceptance flow
- [ ] Order rejection flow
- [ ] COD collection flow
- [ ] OTP verification flow
- [ ] Order cancellation flow
- [ ] Navigation to customer location
- [ ] Customer communication (call/message)
- [ ] Earnings dashboard accuracy
- [ ] Performance metrics updates
- [ ] Profile management
- [ ] Language switching
- [ ] Push notification handling
- [ ] Deep linking from notifications

#### Offline Testing
- [ ] Accept order while offline
- [ ] Reject order while offline
- [ ] Update location while offline
- [ ] Background sync when online
- [ ] Offline indicator display
- [ ] Cached data access while offline

#### Gesture Testing
- [ ] Swipe right to accept order
- [ ] Swipe left to reject order
- [ ] Pull to refresh order list
- [ ] Haptic feedback on gestures
- [ ] Gesture threshold (50% swipe)
- [ ] Gesture cancellation

#### Background Services Testing
- [ ] GPS tracking in background
- [ ] Location updates every 30 seconds
- [ ] Background sync task execution
- [ ] Push notifications when app closed
- [ ] Foreground service notification (Android)

#### Accessibility Testing
- [ ] Screen reader navigation
- [ ] Touch target sizes (44x44 minimum)
- [ ] Color contrast (WCAG AA)
- [ ] Dynamic text sizing
- [ ] Voice-over announcements
- [ ] Haptic feedback

#### Device Testing
- [ ] iOS (iPhone 12, 13, 14, 15)
- [ ] Android (Samsung, OnePlus, Xiaomi)
- [ ] Different screen sizes (small, medium, large)
- [ ] Different OS versions (iOS 14+, Android 10+)
- [ ] Low-end devices (performance)
- [ ] Poor network conditions (2G, 3G)

### Test Data Management

#### Mock Data
```typescript
// Mock orders for testing
export const mockOrders: Order[] = [
  {
    id: '1',
    orderId: 'ORD-12345',
    status: 'assigned',
    customerName: 'John Doe',
    customerPhone: '****1234',
    deliveryAddress: {
      line1: '123 Main St',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
      coordinates: { latitude: 12.9716, longitude: 77.5946 },
    },
    payment: {
      method: 'cod',
      amount: 450,
      currency: 'INR',
      status: 'pending',
    },
    distance: 2.5,
    estimatedTime: 15,
    nextAction: {
      type: 'accept',
      label: 'ACCEPT ORDER',
      color: 'blue',
      icon: 'check-circle',
    },
  },
  // ... more mock orders
];
```

### Continuous Integration

#### CI Pipeline
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
      - run: npm run test:integration
      - name: Upload coverage
        uses: codecov/codecov-action@v2
  
  e2e:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npx detox build --configuration ios.sim.release
      - run: npx detox test --configuration ios.sim.release
```

---

## Security Considerations

### Authentication and Authorization

#### Token Management
```typescript
import * as SecureStore from 'expo-secure-store';

// Store auth token securely
async function storeAuthToken(token: string) {
  await SecureStore.setItemAsync('auth_token', token);
}

// Retrieve auth token
async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync('auth_token');
}

// Clear auth token on logout
async function clearAuthToken() {
  await SecureStore.deleteItemAsync('auth_token');
}
```

#### Token Refresh
```typescript
// Automatic token refresh before expiry
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const refreshToken = await getRefreshToken();
      
      try {
        const response = await api.post('/auth/refresh', { refreshToken });
        const newToken = response.data.token;
        
        await storeAuthToken(newToken);
        
        // Retry original request with new token
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(error.config);
      } catch (refreshError) {
        // Refresh failed, force logout
        await logout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

### Data Encryption

#### Sensitive Data Storage
```typescript
import * as Crypto from 'expo-crypto';

// Encrypt sensitive data before storing in AsyncStorage
async function encryptData(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const encrypted = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data + key
  );
  return encrypted;
}

// Store encrypted data
async function storeSecureData(key: string, value: string) {
  const encrypted = await encryptData(value);
  await AsyncStorage.setItem(key, encrypted);
}
```

#### Certificate Pinning
```typescript
// Prevent man-in-the-middle attacks
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Certificate pinning configuration
  httpsAgent: new https.Agent({
    rejectUnauthorized: true,
    ca: [CERTIFICATE_AUTHORITY],
  }),
});
```

### Data Privacy

#### PII Handling
- Customer phone numbers are masked (show last 4 digits only)
- Customer addresses are only shown when needed for delivery
- No PII is logged in analytics events
- No PII is stored in error logs

#### Data Retention
```typescript
// Clear cached data older than 30 days
async function clearOldCache() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const keys = await AsyncStorage.getAllKeys();
  
  for (const key of keys) {
    if (key.startsWith('@cache_')) {
      const data = await AsyncStorage.getItem(key);
      const cache = JSON.parse(data);
      
      if (new Date(cache.timestamp) < thirtyDaysAgo) {
        await AsyncStorage.removeItem(key);
      }
    }
  }
}
```

### Input Validation

```typescript
// Validate OTP input
function validateOtp(otp: string): boolean {
  return /^\d{4}$/.test(otp);
}

// Validate phone number
function validatePhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

// Sanitize user input
function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
```

---

## Performance Optimization

### FlatList Optimization

```typescript
<FlatList
  data={orders}
  renderItem={({ item }) => <OrderCard order={item} />}
  keyExtractor={item => item.id}
  // Performance optimizations
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  initialNumToRender={10}
  windowSize={21}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  // Memoize render item
  renderItem={renderOrderCard}
/>

// Memoized render function
const renderOrderCard = React.memo(({ item }: { item: Order }) => (
  <OrderCard order={item} />
));
```

### Image Optimization

```typescript
import { Image } from 'expo-image';

// Use expo-image for better performance
<Image
  source={{ uri: profilePhotoUrl }}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
/>

// Compress images before upload
async function compressImage(uri: string): Promise<string> {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return manipResult.uri;
}
```

### API Request Optimization

```typescript
// Debounce search input
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    searchOrders(query);
  }, 300),
  []
);

// Cache API responses
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function cachedApiCall(endpoint: string) {
  const cached = cache.get(endpoint);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const response = await api.get(endpoint);
  cache.set(endpoint, { data: response.data, timestamp: Date.now() });
  
  return response.data;
}

// Batch location updates
let locationBatch: Location[] = [];

function queueLocationUpdate(location: Location) {
  locationBatch.push(location);
  
  if (locationBatch.length >= 10) {
    flushLocationBatch();
  }
}

async function flushLocationBatch() {
  if (locationBatch.length === 0) return;
  
  await api.post('/location/batch', { locations: locationBatch });
  locationBatch = [];
}
```

### Memory Management

```typescript
// Clean up listeners on unmount
useEffect(() => {
  const subscription = NetInfo.addEventListener(handleNetworkChange);
  
  return () => {
    subscription();
  };
}, []);

// Unsubscribe from Socket events
useEffect(() => {
  socket.on('order_assigned', handleOrderAssigned);
  
  return () => {
    socket.off('order_assigned', handleOrderAssigned);
  };
}, []);

// Clear intervals and timeouts
useEffect(() => {
  const interval = setInterval(updateTimer, 1000);
  
  return () => {
    clearInterval(interval);
  };
}, []);
```

---

## Deployment and Monitoring

### Build Configuration

#### EAS Build
```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./service-account.json"
      },
      "ios": {
        "appleId": "developer@example.com",
        "ascAppId": "1234567890"
      }
    }
  }
}
```

### Over-The-Air (OTA) Updates

```typescript
import * as Updates from 'expo-updates';

// Check for updates on app launch
async function checkForUpdates() {
  try {
    const update = await Updates.checkForUpdateAsync();
    
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      
      Alert.alert(
        'Update Available',
        'A new version is available. Restart to apply?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart', onPress: () => Updates.reloadAsync() },
        ]
      );
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}
```

### Analytics Integration

```typescript
import * as Analytics from 'expo-firebase-analytics';

// Track screen views
function trackScreenView(screenName: string) {
  Analytics.logEvent('screen_view', {
    screen_name: screenName,
    screen_class: screenName,
  });
}

// Track button clicks
function trackButtonClick(buttonName: string, screen: string) {
  Analytics.logEvent('button_click', {
    button_name: buttonName,
    screen: screen,
  });
}

// Track order events
function trackOrderEvent(eventName: string, orderId: string) {
  Analytics.logEvent(eventName, {
    order_id: orderId,
    timestamp: new Date().toISOString(),
  });
}
```

### Crash Reporting

```typescript
import * as Sentry from 'sentry-expo';

// Initialize Sentry
Sentry.init({
  dsn: SENTRY_DSN,
  enableInExpoDevelopment: false,
  debug: __DEV__,
});

// Capture errors
try {
  await acceptOrder(orderId);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      screen: 'HomeScreen',
      action: 'accept_order',
    },
    extra: {
      orderId: orderId,
    },
  });
}
```

### Performance Monitoring

```typescript
import * as FirebasePerformance from '@react-native-firebase/perf';

// Track API call performance
async function trackApiCall(endpoint: string, method: string) {
  const trace = await FirebasePerformance().startTrace(`api_${method}_${endpoint}`);
  
  try {
    const response = await api[method](endpoint);
    trace.putAttribute('status', response.status.toString());
    return response;
  } catch (error) {
    trace.putAttribute('error', error.message);
    throw error;
  } finally {
    await trace.stop();
  }
}

// Track screen load time
async function trackScreenLoad(screenName: string) {
  const trace = await FirebasePerformance().startTrace(`screen_${screenName}`);
  
  // Screen rendering logic
  
  await trace.stop();
}
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
- Set up React Native (Expo) project
- Configure navigation structure
- Implement authentication flow
- Set up state management (Zustand)
- Configure API client and Socket.io

### Phase 2: Core Features (Week 3-4)
- Implement order list and order card components
- Build order management hooks
- Implement offline queue and background sync
- Add gesture handling (swipe, pull-to-refresh)
- Implement background GPS tracking

### Phase 3: Advanced Features (Week 5-6)
- Build COD collection flow
- Implement OTP verification
- Add earnings dashboard
- Implement performance metrics
- Add push notifications

### Phase 4: Polish and Testing (Week 7-8)
- Implement error handling and recovery UI
- Add loading states and skeleton loaders
- Implement multi-language support
- Accessibility improvements
- Comprehensive testing (unit, integration, E2E)

### Phase 5: Deployment (Week 9-10)
- Beta testing with delivery partners
- Bug fixes and performance optimization
- Production deployment (iOS and Android)
- Monitor analytics and crash reports
- Iterate based on feedback

---

## Conclusion

This design document provides a comprehensive technical blueprint for transforming the delivery partner dashboard into a production-grade React Native mobile application. The architecture prioritizes offline resilience, action clarity, and mobile-first UX while maintaining industry benchmark quality standards.

Key architectural decisions include:
- **Offline-first architecture** with queue-based sync for network resilience
- **Socket.io real-time updates** with automatic reconnection
- **Background GPS tracking** with battery optimization
- **Gesture-based interactions** for one-handed operation
- **Component-based architecture** with custom hooks for business logic
- **Comprehensive error handling** with inline recovery UI

The testing strategy combines unit tests, integration tests, and E2E tests to ensure reliability, while performance optimizations ensure smooth 60 FPS animations and fast app launch times.

This transformation will significantly improve the delivery partner experience, enabling efficient order management even in challenging real-world conditions.
