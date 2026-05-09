# Requirements Document

## Introduction

The mobile admin order management system must achieve complete behavioral parity with the web admin system by using identical backend APIs, flow control mechanisms, and real-time update systems. This ensures consistent order management behavior across all admin interfaces while maintaining a single source of truth in the backend.

## Glossary

- **Mobile_Admin**: The mobile application interface for order management
- **Web_Admin**: The web application interface for order management (reference implementation)
- **Backend_API**: The server-side API that handles order management logic
- **Order_Management_System**: The complete system handling order lifecycle from confirmation to delivery
- **AllowedActions**: Backend-provided array indicating which actions are permitted for an order
- **Socket_Events**: Real-time notifications sent from backend to connected clients
- **Delivery_Boy**: A delivery partner assigned to fulfill orders

## Requirements

### Requirement 1: API Endpoint Parity

**User Story:** As a mobile admin user, I want the mobile app to use the same backend APIs as the web admin, so that order management behavior is identical across platforms.

#### Acceptance Criteria

1. WHEN confirming an order, THE Mobile_Admin SHALL call PATCH /api/admin/orders/:id/confirm
2. WHEN packing an order, THE Mobile_Admin SHALL call PATCH /api/admin/orders/:id/pack
3. WHEN assigning an order, THE Mobile_Admin SHALL call PATCH /api/admin/orders/:id/assign
4. WHEN starting delivery, THE Mobile_Admin SHALL call PATCH /api/delivery/orders/:id/start
5. WHEN marking delivered, THE Mobile_Admin SHALL call PATCH /api/delivery/orders/:id/deliver
6. THE Mobile_Admin SHALL use identical request payloads as Web_Admin for all API calls
7. THE Mobile_Admin SHALL handle identical response formats as Web_Admin for all API calls

### Requirement 2: Flow Control via Backend State

**User Story:** As a system administrator, I want the backend to control order flow logic, so that mobile and web admin cannot perform invalid state transitions.

#### Acceptance Criteria

1. THE Mobile_Admin SHALL render action buttons ONLY when corresponding actions exist in order.allowedActions
2. WHEN order.allowedActions includes "CONFIRM", THE Mobile_Admin SHALL display the Confirm Order button
3. WHEN order.allowedActions includes "PACK", THE Mobile_Admin SHALL display the Pack Order button
4. WHEN order.allowedActions includes "ASSIGN", THE Mobile_Admin SHALL display the Assign Delivery Partner button
5. WHEN order.allowedActions includes "START_DELIVERY", THE Mobile_Admin SHALL display the Start Delivery button
6. WHEN order.allowedActions includes "MARK_DELIVERED", THE Mobile_Admin SHALL display the Mark Delivered button
7. THE Mobile_Admin SHALL NOT implement custom flow logic based on order status

### Requirement 3: Assignment Flow Parity

**User Story:** As a mobile admin user, I want to assign delivery partners using the same process as web admin, so that assignment behavior is consistent.

#### Acceptance Criteria

1. WHEN assignment is triggered, THE Mobile_Admin SHALL fetch delivery partners using the same API endpoint as Web_Admin
2. THE Mobile_Admin SHALL display delivery partners in the same format as Web_Admin
3. WHEN a delivery partner is selected, THE Mobile_Admin SHALL call the assign API with identical parameters as Web_Admin
4. THE Mobile_Admin SHALL handle assignment responses identically to Web_Admin
5. THE Mobile_Admin SHALL NOT implement custom assignment logic different from Web_Admin

### Requirement 4: Real-time Update Synchronization

**User Story:** As an admin user, I want real-time updates to work identically between mobile and web, so that all admins see the same order state simultaneously.

#### Acceptance Criteria

1. THE Mobile_Admin SHALL subscribe to the same Socket_Events as Web_Admin
2. WHEN "order:status:changed" event is received, THE Mobile_Admin SHALL update the order in local cache
3. WHEN "order:assigned" event is received, THE Mobile_Admin SHALL update the assigned delivery partner information
4. THE Mobile_Admin SHALL trigger UI updates automatically when order data changes in cache
5. WHEN Web_Admin performs an action, THE Mobile_Admin SHALL reflect the change within 1 second
6. WHEN Mobile_Admin performs an action, THE Web_Admin SHALL reflect the change within 1 second

### Requirement 5: Response Handling Standardization

**User Story:** As a developer, I want consistent response handling between mobile and web admin, so that order state remains synchronized.

#### Acceptance Criteria

1. WHEN an API call succeeds, THE Mobile_Admin SHALL replace the order object in state with the complete response object
2. THE Mobile_Admin SHALL NOT manually modify order status or properties after API calls
3. THE Mobile_Admin SHALL use the updated allowedActions from API responses to control available actions
4. WHEN an API call fails, THE Mobile_Admin SHALL handle errors identically to Web_Admin
5. THE Mobile_Admin SHALL preserve all order properties returned by the Backend_API

### Requirement 6: Legacy Logic Removal

**User Story:** As a system maintainer, I want hardcoded mobile logic removed, so that the backend remains the single source of truth for order management.

#### Acceptance Criteria

1. THE Mobile_Admin SHALL NOT use hardcoded status-based conditionals for action availability
2. THE Mobile_Admin SHALL remove all instances of "if (status === 'PACKED') show assign" logic
3. THE Mobile_Admin SHALL remove all custom mobile-specific order flow logic
4. THE Mobile_Admin SHALL rely exclusively on Backend_API responses for order state management
5. THE Mobile_Admin SHALL use allowedActions array instead of status-based logic for all action controls

### Requirement 7: Behavioral Verification

**User Story:** As a quality assurance tester, I want to verify identical behavior between mobile and web admin, so that users have a consistent experience.

#### Acceptance Criteria

1. WHEN Web_Admin confirms an order, THE Mobile_Admin SHALL show the updated status without refresh
2. WHEN Mobile_Admin packs an order, THE Web_Admin SHALL show the updated status without refresh
3. WHEN either interface assigns a delivery partner, THE other interface SHALL show the assignment without refresh
4. THE Mobile_Admin SHALL complete the full order lifecycle identically to Web_Admin
5. FOR ALL order management actions, both interfaces SHALL produce identical backend state changes