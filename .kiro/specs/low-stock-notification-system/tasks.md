# Implementation Plan: Low Stock Notification System

## Overview

This implementation plan breaks down the Low Stock Notification System into discrete, incremental coding tasks. The system provides real-time inventory alerts through multi-channel delivery (Socket.io for web, Expo Push for mobile) with intelligent duplicate prevention and priority-based alerting.

**Key Implementation Areas:**
1. Data models and schemas (MongoDB with Mongoose)
2. Core notification service with duplicate prevention logic
3. Stock monitoring service with threshold evaluation
4. Push notification service (Expo Push Notifications)
5. REST API endpoints with admin authentication
6. Socket.io real-time broadcasting integration
7. Admin dashboard notification bell UI (React)
8. Mobile app push notification handling (React Native/Expo)
9. Property-based tests for 26 correctness properties

**Technology Stack:**
- Backend: Node.js, Express.js, TypeScript, MongoDB, Mongoose, Socket.io
- Frontend: React, TypeScript, Socket.io client, Tailwind CSS
- Mobile: React Native, Expo, Expo Notifications API
- Testing: Jest, fast-check (property-based testing)

## Tasks

- [ ] 1. Set up data models and database schemas
  - [x] 1.1 Create LowStockNotification model with Mongoose schema
    - Define schema with fields: type, productId, productName, currentStock, priority, message, isRead, createdAt, updatedAt
    - Add indexes: `{ productId: 1, isRead: 1 }`, `{ createdAt: -1 }`, `{ isRead: 1 }`, `{ priority: 1 }`
    - Add TypeScript interface `ILowStockNotification` extending Document
    - Export model and interface
    - _Requirements: 2.2, 3.3_
  
  - [x] 1.2 Write property tests for LowStockNotification model
    - **Property 2: Notification Structure Invariants**
    - **Validates: Requirements 2.2, 2.3, 2.5, 3.3**
    - Test that all required fields are present with correct types and initial values
  
  - [x] 1.3 Create DeviceToken model with Mongoose schema
    - Define schema with fields: adminId, deviceToken, platform, lastActiveAt, createdAt, updatedAt
    - Add unique compound index: `{ adminId: 1, deviceToken: 1 }`
    - Add index: `{ lastActiveAt: 1 }`
    - Add TypeScript interface `IDeviceToken` extending Document
    - Export model and interface
    - _Requirements: 16.5_
  
  - [x] 1.4 Write property tests for DeviceToken model
    - **Property 19: Device Token Registration Data Completeness**
    - **Validates: Requirements 16.4, 16.5**
    - Test that all required fields are stored correctly

- [ ] 2. Implement notification parser and serializer utilities
  - [x] 2.1 Create notification parser with validation logic
    - Implement `parseCreateNotificationData` function with field validation
    - Validate required fields: type, productId, productName, currentStock, message
    - Validate productId is valid MongoDB ObjectId
    - Validate productName is non-empty string, max 200 characters
    - Validate currentStock is non-negative integer
    - Validate priority is "LOW" or "CRITICAL"
    - Return descriptive validation errors for missing/invalid fields
    - _Requirements: 14.1, 14.3, 14.4_
  
  - [x] 2.2 Write property tests for notification parser
    - **Property 25: Parser Validation**
    - **Validates: Requirements 14.3, 14.4**
    - Test validation catches errors for missing/invalid fields
  
  - [x] 2.3 Create notification serializer for API responses
    - Implement `serializeNotification` function to convert Mongoose document to JSON
    - Format createdAt as ISO 8601 timestamp string
    - Convert ObjectIds to strings
    - Implement `serializePaginatedNotifications` for paginated responses
    - _Requirements: 14.2, 14.5_
  
  - [x] 2.4 Write property tests for serializer
    - **Property 14: Round-Trip Serialization**
    - **Validates: Requirement 14.6**
    - Test serialize → parse produces equivalent object
    - **Property 26: Timestamp Serialization Format**
    - **Validates: Requirement 14.5**
    - Test createdAt is formatted as ISO 8601

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement core notification service
  - [x] 4.1 Create notification service with CRUD operations
    - Implement `createLowStockNotification` with duplicate prevention logic
    - Check for existing unread notification before creation using `findUnreadNotificationForProduct`
    - Generate message format: "Low stock: {productName} has only {stock} left" or "🚨 CRITICAL: {productName} has only {stock} left"
    - Implement `getNotifications` with pagination and sorting (createdAt desc)
    - Implement `markAsRead` to update isRead field
    - Implement `deleteNotification` to remove notification
    - Implement `findUnreadNotificationForProduct` helper
    - _Requirements: 2.1, 2.4, 2.6, 3.4, 4.2, 5.2, 6.2_
  
  - [ ] 4.2 Write property tests for notification service
    - **Property 3: Message Format Consistency**
    - **Validates: Requirements 2.4, 3.4**
    - Test message format matches specification
    - **Property 4: Duplicate Prevention**
    - **Validates: Requirements 2.1, 2.6, 13.2**
    - Test creation is blocked when unread notification exists
    - **Property 10: Mark as Read State Transition**
    - **Validates: Requirements 5.2, 12.4**
    - Test isRead transitions from false to true and persists
    - **Property 11: Deletion Removes Notification**
    - **Validates: Requirements 6.2, 6.4**
    - Test deleted notifications are removed from database
    - **Property 13: Notification Persistence**
    - **Validates: Requirements 12.1, 12.3**
    - Test notifications persist until explicitly deleted
  
  - [ ] 4.3 Write unit tests for notification service
    - Test error handling for non-existent notification IDs (404)
    - Test pagination edge cases (page 0, negative limit)
    - Test concurrent notification creation scenarios

- [ ] 5. Implement stock monitoring service
  - [x] 5.1 Create stock monitor service with threshold evaluation
    - Implement `evaluateStockLevel` function
    - Define constants: `STOCK_THRESHOLD = 10`, `CRITICAL_THRESHOLD = 3`
    - Determine priority: CRITICAL if stock < 3, LOW if stock 3-9
    - Check for existing unread notification via notification service
    - Skip creation if unread notification exists (duplicate prevention)
    - Call notification service to create notification if threshold breached
    - Return created notification or null
    - Implement `hasUnreadNotification` helper
    - _Requirements: 1.1, 2.1, 3.1, 3.2_
  
  - [ ] 5.2 Write property tests for stock monitor service
    - **Property 1: Priority Assignment Based on Stock Level**
    - **Validates: Requirements 3.1, 3.2**
    - Test CRITICAL for stock < 3, LOW for stock 3-9
    - **Property 5: Stock Recovery Re-trigger**
    - **Validates: Requirements 13.1, 13.4**
    - Test new notification created after stock recovery and drop
    - **Property 6: Stock Change Does Not Affect Notification Status**
    - **Validates: Requirement 13.3**
    - Test isRead field remains unchanged on stock changes
  
  - [ ] 5.3 Write unit tests for stock monitor service
    - Test stock level exactly at threshold boundaries (stock = 3, stock = 10)
    - Test stock above threshold does not create notification

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement push notification service
  - [ ] 7.1 Create push notification service with Expo SDK integration
    - Install `expo-server-sdk` package
    - Initialize Expo client with access token from environment variable
    - Implement `sendLowStockAlert` function
    - Fetch active admin device tokens (lastActiveAt within 90 days)
    - Build Expo push messages with title, body, data payload
    - Title: "Low Stock Alert 🚨" for CRITICAL, "Low Stock Alert" for LOW
    - Body: "Product {productName} has only {currentStock} left"
    - Data: { type: "LOW_STOCK", productId, priority }
    - Set sound: "default", priority: "high" for CRITICAL, "normal" for LOW
    - Set channelId: "low-stock-alerts" for Android
    - Batch messages (max 100 per request per Expo guidelines)
    - Send via `sendPushNotificationsAsync`
    - Update lastActiveAt for successful deliveries
    - Handle errors gracefully (log and continue)
    - _Requirements: 15.4, 15.5, 15.6, 15.7, 15.8, 15.10, 18.1_
  
  - [ ] 7.2 Implement device token registration and management
    - Implement `registerDeviceToken` function
    - Validate platform is "ios" or "android"
    - Upsert device token (update lastActiveAt if exists, create if new)
    - Implement `unregisterDeviceToken` function to delete token
    - Implement `getActiveAdminTokens` to filter tokens by 90-day threshold
    - _Requirements: 16.2, 16.3, 16.4, 16.6, 16.7, 18.2, 18.4_
  
  - [ ] 7.3 Write property tests for push notification service
    - **Property 15: Push Notification Payload Structure**
    - **Validates: Requirements 15.4, 15.5, 15.6**
    - Test payload structure matches specification
    - **Property 16: Priority-Based Delivery Configuration**
    - **Validates: Requirements 15.7, 15.8**
    - Test delivery config matches priority level
    - **Property 17: Duplicate Prevention in Push Delivery**
    - **Validates: Requirement 15.9**
    - Test only one push sent per event
    - **Property 18: Push Failure Isolation**
    - **Validates: Requirement 15.10**
    - Test notification persists despite push failure
    - **Property 20: Device Token Upsert Behavior**
    - **Validates: Requirement 16.6**
    - Test timestamp updated on duplicate registration
    - **Property 21: Platform Validation**
    - **Validates: Requirements 16.7, 16.8**
    - Test validation and error responses for invalid platforms
    - **Property 22: Device Token Activity Timestamp Update**
    - **Validates: Requirement 18.1**
    - Test lastActiveAt updated on successful delivery
    - **Property 23: Inactive Token Filtering**
    - **Validates: Requirement 18.2**
    - Test tokens older than 90 days are filtered out
    - **Property 24: Device Token Deletion**
    - **Validates: Requirement 18.4**
    - Test tokens are deleted and don't receive notifications
  
  - [ ] 7.4 Write unit tests for push notification service
    - Test Expo SDK error handling (invalid token, rate limit, service unavailable)
    - Test batch processing for large device token sets
    - Mock Expo SDK for isolated testing

- [ ] 8. Implement Socket.io integration service
  - [x] 8.1 Create socket service for real-time broadcasting
    - Access existing Socket.io instance via `app.get("io")`
    - Implement `broadcastLowStockAlert` function
    - Emit "low_stock_alert" event to "admin_room"
    - Include complete notification object in payload
    - Implement `broadcastNotificationStatusUpdate` function (optional)
    - Emit "notification:status:update" event for read status changes
    - Handle Socket.io errors gracefully (log and continue)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 8.2 Write property tests for socket service
    - **Property 12: Socket.io Event Payload Completeness**
    - **Validates: Requirements 7.2, 7.5**
    - Test event payload contains complete notification object
  
  - [ ] 8.3 Write unit tests for socket service
    - Mock Socket.io instance for isolated testing
    - Test event emission to correct room
    - Test error handling for Socket.io failures

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement REST API endpoints and controller
  - [x] 10.1 Create notification controller with admin authentication
    - Implement `getNotifications` handler
    - Parse query parameters (page, limit, isRead, priority)
    - Call notification service `getNotifications`
    - Serialize response using notification serializer
    - Return paginated response with 200 status
    - Implement `markNotificationAsRead` handler
    - Validate notification ID format
    - Call notification service `markAsRead`
    - Broadcast status update via socket service (optional)
    - Return updated notification with 200 status
    - Handle 404 for non-existent notification
    - Implement `deleteNotification` handler
    - Call notification service `deleteNotification`
    - Return 204 status on success
    - Handle 404 for non-existent notification
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.3, 5.4, 5.5, 6.1, 6.3, 6.4, 6.5_
  
  - [x] 10.2 Create device token registration endpoints
    - Implement `registerDevice` handler
    - Parse and validate request body (deviceToken, platform)
    - Call push notification service `registerDeviceToken`
    - Return registered token with 200 status
    - Handle 400 for invalid platform
    - Implement `unregisterDevice` handler
    - Extract adminId from authenticated user
    - Call push notification service `unregisterDeviceToken`
    - Return 204 status on success
    - _Requirements: 16.1, 16.2, 16.3, 16.8, 18.3, 18.5_
  
  - [x] 10.3 Create notification routes with admin middleware
    - Define routes: GET /admin/notifications, PATCH /admin/notifications/:id/read, DELETE /admin/notifications/:id
    - Define routes: POST /admin/register-device, DELETE /admin/unregister-device
    - Apply admin authentication middleware to all routes
    - Mount routes in main Express app
    - _Requirements: 4.4, 5.3, 6.3_
  
  - [ ] 10.4 Write property tests for API endpoints
    - **Property 7: Notification Sorting**
    - **Validates: Requirement 4.2**
    - Test notifications sorted by createdAt descending
    - **Property 8: Response Completeness**
    - **Validates: Requirements 4.3, 5.4**
    - Test all fields present in API response
    - **Property 9: Pagination Correctness**
    - **Validates: Requirement 4.5**
    - Test correct subset returned with accurate total count
  
  - [ ] 10.5 Write integration tests for API endpoints
    - Test authentication (valid token, invalid token, no token, non-admin user)
    - Test GET /admin/notifications with various query parameters
    - Test PATCH /admin/notifications/:id/read success and error cases
    - Test DELETE /admin/notifications/:id success and error cases
    - Test POST /admin/register-device with valid and invalid data
    - Test DELETE /admin/unregister-device

- [ ] 11. Integrate stock monitoring into product and order services
  - [x] 11.1 Add stock monitoring to product update operations
    - Import stock monitor service into product controller/service
    - Call `evaluateStockLevel` after product stock updates
    - Pass productId and updated stock level
    - Handle errors gracefully (log and continue)
    - _Requirements: 1.1, 1.4_
  
  - [x] 11.2 Add stock monitoring to order placement operations
    - Import stock monitor service into order controller/service
    - Call `evaluateStockLevel` for each order item after order creation
    - Pass productId and updated stock level for each item
    - Handle errors gracefully (log and continue)
    - _Requirements: 1.2, 1.4_
  
  - [ ] 11.3 Write integration tests for stock monitoring triggers
    - Test notification created when product stock updated below threshold
    - Test notification created when order placed reduces stock below threshold
    - Test no notification created when stock remains above threshold

- [ ] 12. Orchestrate multi-channel notification delivery
  - [x] 12.1 Update notification service to orchestrate delivery
    - After creating notification in `createLowStockNotification`, trigger parallel delivery
    - Call socket service `broadcastLowStockAlert` (non-blocking)
    - Call push notification service `sendLowStockAlert` (non-blocking)
    - Use `Promise.allSettled` to handle failures gracefully
    - Log errors but don't block notification creation
    - _Requirements: 15.1, 15.2, 15.3, 15.9_
  
  - [ ] 12.2 Write integration tests for multi-channel delivery
    - Test both Socket.io and push notifications triggered on notification creation
    - Test notification persists even if Socket.io fails
    - Test notification persists even if push notification fails
    - Mock both delivery channels for isolated testing

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement admin dashboard notification bell UI
  - [ ] 14.1 Create NotificationBell component
    - Display bell icon (Ionicons: `notifications-outline`) in top right corner
    - Display badge with unread count (background: #FF6A00)
    - Hide badge when count is 0
    - Toggle dropdown on bell click
    - Close dropdown on outside click
    - Fetch notifications on component mount via GET /admin/notifications
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 12.2_
  
  - [ ] 14.2 Create NotificationDropdown component
    - Display notification list with max height 400px and scroll
    - Width 350px, right-aligned below bell icon
    - Display each notification with product name, stock count, timestamp
    - Style unread notifications: bold text, highlighted background (#FFF4E6)
    - Style read notifications: normal text, white background
    - Display priority indicator: red dot (#EF4444) for CRITICAL, orange dot (#F59E0B) for LOW
    - Sort notifications by createdAt descending
    - Display "No notifications" message when empty
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ] 14.3 Implement notification interaction handlers
    - On notification click: navigate to product detail page
    - On notification click: call PATCH /admin/notifications/:id/read
    - Update notification display to show read status
    - Update unread badge count after marking as read
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ] 14.4 Integrate Socket.io real-time updates
    - Connect to Socket.io server with admin JWT token
    - Join "admin_room" on connection
    - Listen for "low_stock_alert" events
    - On event: display toast notification
    - On event: add notification to list
    - On event: increment unread badge count
    - Disconnect on component unmount
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [ ] 14.5 Write unit tests for notification bell components
    - Test bell icon displays correctly
    - Test badge shows/hides based on unread count
    - Test dropdown opens/closes on click
    - Test notification list renders correctly
    - Test notification click handlers
    - Mock Socket.io for isolated testing

- [ ] 15. Implement mobile app push notification handling
  - [ ] 15.1 Set up Expo Notifications in mobile app
    - Request notification permissions on app launch
    - Get Expo push token via `Notifications.getExpoPushTokenAsync()`
    - Send token to backend via POST /admin/register-device
    - Include platform (Platform.OS) in request
    - Handle permission denial gracefully
    - _Requirements: 17.5, 17.6_
  
  - [ ] 15.2 Configure Android notification channel
    - Create "low-stock-alerts" notification channel
    - Set importance to HIGH
    - Set sound to "default"
    - Set vibration pattern: [0, 250, 250, 250]
    - Set light color to #FF6A00
    - _Requirements: 15.6_
  
  - [ ] 15.3 Implement notification response handlers
    - Register notification response listener on app startup
    - Extract productId from notification data payload
    - Navigate to product detail screen with productId
    - Highlight low stock status on product detail screen
    - _Requirements: 17.1, 17.2, 17.3, 17.4_
  
  - [ ] 15.4 Implement foreground notification handler
    - Register notification received listener
    - Display in-app alert with notification title and body
    - _Requirements: 17.1_
  
  - [ ] 15.5 Write integration tests for mobile push notifications
    - Test device token registration flow
    - Test notification response navigation
    - Mock Expo Notifications API for isolated testing

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Add environment variables and configuration
  - [x] 17.1 Add environment variables to .env file
    - Add STOCK_THRESHOLD=10
    - Add CRITICAL_THRESHOLD=3
    - Add EXPO_ACCESS_TOKEN=<expo_token>
    - Add DEVICE_TOKEN_INACTIVE_DAYS=90
    - Document variables in README or .env.example
  
  - [ ] 17.2 Update environment validation
    - Add validation for EXPO_ACCESS_TOKEN in validateEnv.ts
    - Ensure required variables are present on startup

- [ ] 18. Add error handling and logging
  - [ ] 18.1 Add structured error logging
    - Add error logs with context (operation, productId, error message, stack trace)
    - Use existing Winston logger
    - Log Socket.io broadcast failures
    - Log push notification delivery failures
    - Log database operation failures
  
  - [ ] 18.2 Add monitoring metrics (optional)
    - Track notification creation rate
    - Track duplicate prevention hit rate
    - Track Socket.io broadcast success rate
    - Track push notification delivery success rate

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (26 properties total)
- Unit tests validate specific examples and edge cases
- Integration tests validate multi-service interactions
- All code should use TypeScript with strict type checking
- Follow existing project structure and coding conventions
- Use existing authentication middleware for admin routes
- Leverage existing Socket.io instance via `app.get("io")`
- Handle all errors gracefully with appropriate logging
