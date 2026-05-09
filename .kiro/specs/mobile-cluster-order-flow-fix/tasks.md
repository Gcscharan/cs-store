# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - PACKED Orders Disappear from Mobile UI
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that when an order is marked as PACKED, the mobile app fetches cluster data from `/api/admin/routes/compute?mode=preview`
  - Test that the ClusterOrdersScreen exists and is accessible via navigation
  - Test that the "Cluster Orders" button exists in AdminOrdersScreen
  - Test that PACKED orders are visible in the cluster view with cluster ID, order count, distance, ETA
  - The test assertions should match the Expected Behavior Properties from design (Property 1)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - Cluster API endpoint not defined in adminApi.ts
    - ClusterOrdersScreen component does not exist
    - No "Cluster Orders" button in AdminOrdersScreen
    - onPack function does not trigger cluster data refresh
    - Socket event handler does not check for PACKED status
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-PACKED Order Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (orders with status CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, CANCELLED)
  - Observe: Orders with non-PACKED statuses display correctly in main orders list
  - Observe: Action buttons (Confirm, Pack, Assign, Cancel) work correctly for non-PACKED orders
  - Observe: Socket events for non-PACKED statuses update the order list in real-time
  - Observe: Order filtering by status works correctly for non-PACKED orders
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all orders with status NOT equal to PACKED, verify they display in AdminOrdersScreen
    - For all non-PACKED orders, verify action buttons trigger correct API calls
    - For all socket events with non-PACKED statuses, verify order list updates correctly
    - For all filter selections, verify filtering works for non-PACKED orders
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for mobile cluster order flow

  **CRITICAL IMPLEMENTATION NOTES:**
  - ✅ **Verified Endpoint**: `POST /api/admin/routes/compute?mode=preview` with body `{ vehicle: { type: "AUTO" } }`
  - ✅ **Verified Assignment**: `POST /admin/routes/assign` exists and handles bulk cluster assignment
  - ✅ **Socket Payload**: Use `data.to === 'PACKED'` (NOT `data.order.orderStatus`)
  - ⚠️ **DO NOT IMPROVISE**: Copy web admin behavior exactly from `frontend/src/pages/AdminRoutesPreviewPage.tsx`
  - ⚠️ **DO NOT MODIFY**: Existing order list logic, filters, confirm/pack flows

  - [x] 3.1 Add getClusters API endpoint to adminApi.ts
    - File: `apps/customer-app/src/api/adminApi.ts`
    - Add new endpoint to `adminApi.injectEndpoints`:
      - Endpoint name: `getClusters`
      - **Method: POST** (CRITICAL - must be POST, not GET)
      - URL: `/admin/routes/compute?mode=preview`
      - Body: `{ vehicle: { type: "AUTO" } }`
      - Provides tag: `['Clusters']`
    - **Correct RTK Query syntax**:
      ```typescript
      getClusters: builder.query({
        query: () => ({
          url: "/admin/routes/compute?mode=preview",
          method: "POST",
          body: { vehicle: { type: "AUTO" } }
        }),
        providesTags: ["Clusters"]
      })
      ```
    - Export `useGetClustersQuery` hook
    - _Bug_Condition: isBugCondition(input) where input.orderStatus === 'PACKED' AND mobileAppState.fetchesClusters === false_
    - _Expected_Behavior: Mobile app SHALL fetch cluster data from `/api/admin/routes/compute?mode=preview` when orders are PACKED_
    - _Preservation: Non-PACKED order API calls remain unchanged_
    - _Requirements: 2.1, 3.1, 3.2_

  - [x] 3.2 Create ClusterOrdersScreen component
    - File: `apps/customer-app/src/screens/admin/ClusterOrdersScreen.tsx` (NEW)
    - Define TypeScript types matching web admin structure:
      - `PreviewCluster`: `{ tempClusterId: string, orderCount: number, distanceKm: number, estimatedTimeMin: number, orders: Array<string | PreviewOrder>, routePath?: string[] }`
      - `PreviewOrder`: `{ orderId?: string, itemsQty?: number, grossAmount?: number, netAmount?: number, ... }`
    - Import `useGetClustersQuery` from adminApi
    - Fetch clusters using `useGetClustersQuery()`
    - Display loading state while fetching
    - Display empty state if no clusters found ("No packed orders")
    - Render cluster cards with:
      - Cluster ID (tempClusterId)
      - Order count
      - Distance (km)
      - ETA (minutes)
      - List of order IDs
      - "Assign Delivery Boy" button
    - Add AdminHeader with "Cluster Orders" title and back button
    - Match existing mobile admin design system (colors, card styles)
    - _Bug_Condition: isBugCondition(input) where input.orderStatus === 'PACKED' AND mobileAppState.hasClusterScreen === false_
    - _Expected_Behavior: PACKED orders SHALL be visible in ClusterOrdersScreen grouped with cluster metadata_
    - _Preservation: AdminOrdersScreen layout and functionality remain unchanged_
    - _Requirements: 2.2, 2.3, 3.1, 3.4_

  - [x] 3.3 Add cluster assignment endpoint to adminApi.ts
    - File: `apps/customer-app/src/api/adminApi.ts`
    - **VERIFIED**: Backend endpoint `/admin/routes/assign` EXISTS and is used by web admin
    - Add new endpoint to `adminApi.injectEndpoints`:
      - Endpoint name: `assignCluster`
      - Method: POST
      - URL: `/admin/routes/assign`
      - Body: `{ deliveryBoyId: string, orderIds: string[], routePath: string[] }`
      - Invalidates tags: `['Orders', 'Clusters']`
    - **Correct RTK Query syntax**:
      ```typescript
      assignCluster: builder.mutation({
        query: (body: { deliveryBoyId: string; orderIds: string[]; routePath: string[] }) => ({
          url: "/admin/routes/assign",
          method: "POST",
          body
        }),
        invalidatesTags: ["Orders", "Clusters"]
      })
      ```
    - Export `useAssignClusterMutation` hook
    - **NOTE**: This endpoint assigns ALL orders in the cluster at once (bulk assignment), matching web admin behavior
    - _Bug_Condition: isBugCondition(input) where mobile admin cannot assign delivery partner to PACKED orders_
    - _Expected_Behavior: Mobile app SHALL allow assignment of delivery partner to all orders in a cluster_
    - _Preservation: Existing individual order assignment via DeliveryPartnerSelectionModal remains unchanged_
    - _Requirements: 2.4, 2.6, 3.5_

  - [x] 3.4 Implement cluster assignment in ClusterOrdersScreen
    - File: `apps/customer-app/src/screens/admin/ClusterOrdersScreen.tsx`
    - Import `useAssignClusterMutation` from adminApi
    - Handle "Assign Delivery Boy" button click:
      - Open delivery partner selection modal (reuse existing DeliveryPartnerSelectionModal or create new)
      - On partner selection, call `assignCluster` mutation with:
        - `deliveryBoyId`: selected partner ID
        - `orderIds`: all order IDs in the cluster
        - `routePath`: cluster's routePath array
    - Display success/error toast messages
    - Navigate back to AdminOrdersScreen after successful assignment
    - _Bug_Condition: isBugCondition(input) where mobile admin cannot complete order fulfillment workflow after packing_
    - _Expected_Behavior: Mobile admin SHALL be able to assign delivery partner from cluster view and update order status to IN_TRANSIT_
    - _Preservation: Existing assignment flow for non-clustered orders remains unchanged_
    - _Requirements: 2.4, 2.6, 3.5_

  - [x] 3.5 Add "Cluster Orders" navigation button to AdminOrdersScreen
    - File: `apps/customer-app/src/screens/admin/AdminOrdersScreen.tsx`
    - Add "Cluster Orders" button below search bar or in header actions
    - Style: Match existing button design (use theme colors, consistent spacing)
    - Action: `navigation.navigate('ClusterOrders')`
    - Position: Below search bar or in header actions area
    - _Bug_Condition: isBugCondition(input) where mobileAppState.hasClusterScreen === false AND no navigation option exists_
    - _Expected_Behavior: Mobile app SHALL provide a "Cluster Orders" button that navigates to cluster view_
    - _Preservation: Existing buttons and navigation remain unchanged_
    - _Requirements: 2.2, 3.1, 3.4_

  - [x] 3.6 Update onPack function to refresh cluster data
    - File: `apps/customer-app/src/screens/admin/AdminOrdersScreen.tsx`
    - Locate `onPack` function (around line 195)
    - After successful pack operation (after updating local state), add:
      - `dispatch(adminApi.util.invalidateTags(['Clusters']))`
    - This ensures cluster data is refreshed when an order is packed
    - _Bug_Condition: isBugCondition(input) where order is PACKED but cluster data is not refreshed_
    - _Expected_Behavior: System SHALL fetch cluster data after PACK operation to display newly packed order_
    - _Preservation: Existing onPack logic for updating order status remains unchanged_
    - _Requirements: 2.1, 2.5, 3.2_

  - [x] 3.7 Update socket event handler to refresh clusters for PACKED status
    - File: `apps/customer-app/src/screens/admin/AdminOrdersScreen.tsx`
    - Locate socket event handler for `order:status:changed` (around line 91)
    - **CRITICAL**: Socket event payload structure is `{ orderId, from, to, actorRole, actorId, timestamp, order? }`
    - Add check for PACKED status using correct payload field:
      - **Correct**: `if (data.to === 'PACKED') { dispatch(adminApi.util.invalidateTags(['Clusters'])) }`
      - **NOT**: `if (data.order?.orderStatus === 'PACKED')` (order field may be undefined)
    - This ensures cluster data is refreshed when socket event indicates an order was packed
    - _Bug_Condition: isBugCondition(input) where socket event with PACKED status does not trigger cluster refresh_
    - _Expected_Behavior: System SHALL automatically refresh cluster data when receiving PACKED status via socket_
    - _Preservation: Existing socket event handling for non-PACKED statuses remains unchanged_
    - _Requirements: 2.5, 3.3_

  - [x] 3.8 Add ClusterOrdersScreen to navigation stack
    - File: `apps/customer-app/src/navigation/AdminNavigator.tsx`
    - Import ClusterOrdersScreen: `import ClusterOrdersScreen from '../screens/admin/ClusterOrdersScreen'`
    - Add Stack.Screen: `<Stack.Screen name="ClusterOrders" component={ClusterOrdersScreen} />`
    - Ensure screen is added to the admin navigation stack
    - _Bug_Condition: isBugCondition(input) where ClusterOrdersScreen is not accessible via navigation_
    - _Expected_Behavior: ClusterOrdersScreen SHALL be accessible via navigation from AdminOrdersScreen_
    - _Preservation: Existing navigation routes remain unchanged_
    - _Requirements: 2.2, 3.4_

  - [x] 3.9 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - PACKED Orders Visible in Cluster View
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - Verify that:
      - Cluster API endpoint is defined and returns cluster data
      - ClusterOrdersScreen exists and renders correctly
      - "Cluster Orders" button exists and navigates to cluster view
      - PACKED orders are visible in cluster view with all metadata
      - onPack function triggers cluster data refresh
      - Socket event handler refreshes clusters for PACKED status
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.10 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-PACKED Order Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - Verify that:
      - Orders with non-PACKED statuses still display correctly in main orders list
      - Action buttons (Confirm, Pack, Assign, Cancel) still work for non-PACKED orders
      - Socket events for non-PACKED statuses still update order list correctly
      - Order filtering still works for non-PACKED orders
      - Existing DeliveryPartnerSelectionModal still works for individual order assignment
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all unit tests for adminApi endpoints (getClusters, assignCluster)
  - Run all component tests for ClusterOrdersScreen (loading, empty state, cluster cards, assignment)
  - Run all integration tests for full flow (Confirm → Pack → Cluster View → Assign → IN_TRANSIT)
  - Run all property-based tests for preservation (non-PACKED order behavior)
  - Verify socket synchronization works (pack in web → mobile receives event → cluster refreshes)
  - Verify multi-device scenario (pack in mobile → web updates → assign in web → mobile updates)
  - Test edge cases:
    - Pack all orders → main list empty → cluster view shows all packed orders
    - Pack single order → verify it appears in cluster view
    - Pack multiple orders → verify they group into clusters correctly
  - Ensure all tests pass, ask the user if questions arise
