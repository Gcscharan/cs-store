# Implementation Tasks: Mobile Admin Backend Parity

## Overview

This task list implements the exact 8-step approach to achieve complete behavioral parity between mobile admin and web admin order management systems. The mobile app will be transformed from having custom logic to being a thin client that mirrors web admin behavior exactly.

## STEP 0 — FIND REFERENCE (MANDATORY)

- [x] 0.1 Locate and analyze web admin reference files
  - Examine `frontend/src/pages/AdminOrdersPage.tsx` for order list behavior
  - Examine `frontend/src/pages/AdminOrderDetailsPage.tsx` for order detail behavior
  - Document exact API calls: PATCH `/api/admin/orders/:id/confirm`, PATCH `/api/admin/orders/:id/pack`
  - Document socket event handling: `order:status:changed`, `order:assigned`
  - Document how `allowedActions` controls UI button visibility
  - _Requirements: 1.1, 2.1, 4.1_

- [x] 0.2 Analyze current mobile admin implementation
  - Review `apps/customer-app/src/screens/admin/AdminOrdersScreen.tsx`
  - Review `apps/customer-app/src/screens/admin/AdminOrderDetailScreen.tsx`
  - Review `apps/customer-app/src/api/adminApi.ts`
  - Document current API endpoints and status-based logic
  - _Requirements: 6.1_

## STEP 1 — DELETE WRONG MOBILE LOGIC

- [x] 1.1 Remove status-based conditionals from AdminOrdersScreen.tsx
  - Delete `const canConfirm = status === 'CREATED'`
  - Delete `const canPack = status === 'CONFIRMED'`
  - Delete `const canCancel = status === 'CREATED' || status === 'CONFIRMED'`
  - Remove all `if (status === ...)` logic
  - _Requirements: 6.1_

- [x] 1.2 Remove status-based conditionals from AdminOrderDetailScreen.tsx
  - Delete `const canConfirm = status === 'CREATED'`
  - Delete `const canPack = status === 'CONFIRMED'`
  - Delete `const canCancel = status === 'CREATED' || status === 'CONFIRMED'`
  - Remove all status-based button rendering logic
  - _Requirements: 6.1_

- [x] 1.3 Remove manual status updates after API calls
  - Remove any `order.status = "PACKED"` assignments
  - Remove any `order.status = "CONFIRMED"` assignments
  - Remove any manual property updates after API responses
  - _Requirements: 5.1_

- [x] 1.4 Remove custom mobile flow logic
  - Delete `normalizeStatus` function if used for flow control
  - Remove any mobile-specific business rules
  - Remove hardcoded order state transition logic
  - _Requirements: 6.1_

## STEP 2 — USE allowedActions ONLY

- [x] 2.1 Update AdminOrdersScreen.tsx to use allowedActions
  - Replace confirm button logic with `order.allowedActions?.includes("CONFIRM")`
  - Replace pack button logic with `order.allowedActions?.includes("PACK")`
  - Replace assign button logic with `order.allowedActions?.includes("ASSIGN")`
  - Add null check: if `allowedActions` not present → show nothing
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.2 Update AdminOrderDetailScreen.tsx to use allowedActions
  - Replace all button rendering with allowedActions checks
  - Add `order.allowedActions?.includes("START_DELIVERY")` for delivery actions
  - Add `order.allowedActions?.includes("MARK_DELIVERED")` for completion
  - Ensure no buttons show when allowedActions is undefined
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.3 Add allowedActions to Order type definitions
  - Update order interfaces to include `allowedActions?: string[]`
  - Ensure TypeScript compilation passes
  - _Requirements: 2.1_

## STEP 3 — COPY WEB API CALLS EXACTLY

- [x] 3.1 Update adminApi.ts to match web admin endpoints
  - Change confirm endpoint to use PATCH method (currently POST)
  - Change pack endpoint to use PATCH method (currently POST)
  - Add assign endpoint: PATCH `/api/admin/orders/:id/assign`
  - Add start delivery endpoint: PATCH `/api/delivery/orders/:id/start`
  - Add mark delivered endpoint: PATCH `/api/delivery/orders/:id/deliver`
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3.2 Ensure identical request payloads
  - Match web admin request headers exactly
  - Use same authentication format as web admin
  - Remove any mobile-specific parameters
  - Add any missing parameters required by web admin
  - _Requirements: 1.1, 1.4_

- [x] 3.3 Verify API endpoint compatibility
  - Test all endpoints return expected response format
  - Ensure response includes complete order object
  - Validate error response format matches web admin
  - _Requirements: 1.1, 5.2_

## STEP 4 — REPLACE ORDER STATE (CRITICAL)

- [x] 4.1 Create updateOrderInState function
  - Implement function to replace entire order object in state
  - Use in AdminOrdersScreen: `setOrders(prev => prev.map(o => o._id === updated._id ? updated : o))`
  - Use in AdminOrderDetailScreen: `setOrder(updatedOrder)`
  - _Requirements: 5.1, 5.2_

- [x] 4.2 Update API success handlers
  - Replace manual status updates with complete object replacement
  - Use `response.data.order` or `response.order` from API response
  - Remove all manual property assignments after API calls
  - _Requirements: 5.1, 5.2_

- [x] 4.3 Remove refetch() calls after API actions
  - Delete `refetch()` calls in AdminOrderDetailScreen after confirm/pack
  - Replace with order state updates from API response
  - Rely on socket events for real-time updates
  - _Requirements: 4.1, 4.2_

## STEP 5 — FIX ASSIGN FLOW (THIS IS YOUR BUG)

- [x] 5.1 Add delivery partner fetching API
  - Create `getDeliveryPartners` endpoint in adminApi.ts
  - Use same endpoint as web admin: GET `/api/admin/delivery-partners/available`
  - Return list of available delivery partners
  - _Requirements: 3.1, 3.2_

- [x] 5.2 Create delivery partner selection modal
  - Build modal component matching web admin design
  - Display list of available delivery partners
  - Add partner selection functionality
  - Include loading and error states
  - _Requirements: 3.1, 3.2_

- [x] 5.3 Implement assign API call
  - Add `assignOrder` mutation to adminApi.ts
  - Use PATCH `/api/admin/orders/:id/assign` with `{ deliveryBoyId }`
  - Handle assignment response with complete order object
  - Update order state after successful assignment
  - _Requirements: 3.1, 3.2_

- [x] 5.4 Integrate assignment flow in screens
  - Add assign button when `order.allowedActions?.includes("ASSIGN")`
  - Show delivery partner modal on assign button press
  - Call assign API when partner selected
  - Update UI after successful assignment
  - _Requirements: 3.1, 3.2_

## STEP 6 — SOCKET = REALTIME SYNC

- [x] 6.1 Update socketClient.ts for admin events
  - Add listener for `order:status:changed` event
  - Add listener for `order:assigned` event
  - Ensure events include complete order object
  - _Requirements: 4.1, 4.2_

- [x] 6.2 Connect socket events to order state
  - Update AdminOrdersScreen to listen for socket events
  - Update AdminOrderDetailScreen to listen for socket events
  - Use `updateOrderInState` function when events received
  - Trigger UI re-renders automatically
  - _Requirements: 4.1, 4.2_

- [x] 6.3 Implement socket event handlers
  - Handle `order:status:changed`: update order in local state
  - Handle `order:assigned`: update delivery partner info
  - Show toast notifications for status changes
  - Ensure events only update relevant orders
  - _Requirements: 4.1, 4.2_

- [x] 6.4 Test real-time synchronization
  - Verify web admin actions update mobile within 1 second
  - Verify mobile admin actions update web within 1 second
  - Test socket reconnection scenarios
  - _Requirements: 4.1, 4.2_

## STEP 7 — REMOVE REFRESH / POLLING

- [x] 7.1 Remove manual refresh dependencies
  - Delete `refetch()` calls after API actions
  - Remove manual refresh buttons where socket updates suffice
  - Remove any polling mechanisms
  - _Requirements: 4.1, 4.2_

- [x] 7.2 Rely on API response + socket events
  - Use API response for immediate state update
  - Use socket events for cross-platform synchronization
  - Remove `setInterval` or similar polling code
  - _Requirements: 4.1, 4.2_

- [x] 7.3 Implement proper cleanup
  - Add socket event cleanup on component unmount
  - Remove event listeners when screens unmount
  - Prevent memory leaks from socket subscriptions
  - _Requirements: 4.1, 4.2_

## STEP 8 — FINAL TEST (MANDATORY)

- [x] 8.1 Test web confirm → mobile updates instantly
  - Perform confirm action on web admin
  - Verify mobile admin shows updated status within 1 second
  - Verify allowedActions updated correctly on mobile
  - _Requirements: 4.1, 7.1_

- [x] 8.2 Test mobile pack → web updates instantly
  - Perform pack action on mobile admin
  - Verify web admin shows updated status within 1 second
  - Verify UI buttons updated correctly on web
  - _Requirements: 4.1, 7.1_

- [x] 8.3 Test mobile assign → web updates instantly
  - Perform assign action on mobile admin
  - Verify web admin shows delivery partner within 1 second
  - Verify assignment reflected in both interfaces
  - _Requirements: 4.1, 7.1_

- [x] 8.4 Test full lifecycle without refresh
  - Complete entire order flow: confirm → pack → assign → deliver
  - Verify each step updates both platforms instantly
  - Ensure no manual refresh needed at any point
  - _Requirements: 7.1, 7.2_

- [x] 8.5 Test concurrent actions and edge cases
  - Test simultaneous actions from both platforms
  - Test network interruption scenarios
  - Test socket reconnection during actions
  - Verify error handling matches web admin exactly
  - _Requirements: 4.1, 5.2, 7.1_

## Validation Checkpoints

### Critical Success Criteria
- [x] Zero status-based conditionals remain in mobile code
- [x] All API endpoints match web admin exactly (PATCH methods, same paths)
- [x] allowedActions is the ONLY control system for UI buttons
- [x] Socket events provide real-time sync within 1 second
- [x] Assignment flow works identically to web admin
- [x] No manual refresh needed anywhere

### Testing Requirements
- [x] Cross-platform parity verified in all scenarios
- [x] Real-time updates work bidirectionally
- [x] Error handling identical between platforms
- [x] Performance meets < 1 second update requirement
- [x] No regressions in existing functionality

### Final Validation
- [x] Backend is the ONLY source of truth
- [x] Mobile app is a dumb UI with no business logic
- [x] Complete behavioral parity with web admin achieved
- [x] All 8 steps implemented without shortcuts