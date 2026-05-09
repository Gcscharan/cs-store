# Mobile Cluster Order Flow Fix - Bugfix Design

## Overview

The mobile admin app is missing the cluster order flow that exists in the web admin app. After an order is marked as PACKED, it disappears from the mobile admin interface because the app only fetches data from `/api/admin/orders` and does not fetch cluster data from `/api/admin/routes/preview`. This bugfix implements the missing cluster order flow by:

1. Adding a `fetchClusters()` API function to retrieve cluster data from `/api/admin/routes/compute?mode=preview`
2. Creating a new `ClusterOrdersScreen` to display packed orders grouped into delivery clusters
3. Adding navigation from the main orders screen to the cluster view
4. Updating the data flow after PACK operations to refresh cluster data
5. Enhancing socket event handlers to refresh clusters when orders are packed
6. Preserving existing order list functionality for non-PACKED orders

This ensures mobile admin users can complete the full order fulfillment workflow: CREATED → CONFIRMED → PACKED → CLUSTER → ASSIGN → IN_TRANSIT → DELIVERED.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when an order is marked as PACKED, it disappears from the mobile admin interface and cannot be viewed or assigned
- **Property (P)**: The desired behavior - PACKED orders should be visible in a cluster view where they can be assigned to delivery partners
- **Preservation**: Existing order list behavior for non-PACKED orders (CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, CANCELLED) must remain unchanged
- **Cluster**: A group of PACKED orders optimized for delivery route assignment, containing order IDs, distance, ETA, and route path
- **AdminOrdersScreen**: The main mobile admin screen at `apps/customer-app/src/screens/admin/AdminOrdersScreen.tsx` that displays orders
- **ClusterOrdersScreen**: The new screen to be created that displays cluster data for PACKED orders
- **adminApi**: The RTK Query API service at `apps/customer-app/src/api/adminApi.ts` that defines all admin endpoints
- **socketClient**: The socket service at `apps/customer-app/src/services/socketClient.ts` that handles real-time order updates

## Bug Details

### Bug Condition

The bug manifests when an order is marked as PACKED in the mobile admin app. The `AdminOrdersScreen` only fetches data from `/api/admin/orders`, which returns orders with statuses CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, and CANCELLED. PACKED orders are excluded from this endpoint because they are meant to be displayed in a cluster view (as implemented in the web admin). Since the mobile app does not fetch cluster data or provide a cluster view, PACKED orders become invisible and cannot be assigned to delivery partners.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { orderStatus: string, mobileAppState: AppState }
  OUTPUT: boolean
  
  RETURN input.orderStatus === 'PACKED'
         AND mobileAppState.hasClusterScreen === false
         AND mobileAppState.fetchesClusters === false
         AND orderNotVisibleInUI(input.orderId)
END FUNCTION
```

### Examples

- **Example 1**: Admin confirms order #12345 → order visible in mobile orders list with status CONFIRMED → Admin packs order #12345 → order disappears from mobile orders list → Admin cannot assign delivery partner from mobile app
  - **Expected**: After packing, order should be visible in "Cluster Orders" screen
  - **Actual**: Order disappears completely from mobile UI

- **Example 2**: Web admin packs order #67890 → mobile admin receives socket event `order:status:changed` with status PACKED → mobile app updates local state but order disappears from list → mobile admin cannot see or assign the order
  - **Expected**: Socket event should trigger cluster data refresh, order visible in cluster view
  - **Actual**: Order removed from list, no cluster data fetched

- **Example 3**: Mobile admin opens orders screen → sees 5 CONFIRMED orders → packs 3 orders → only 2 orders remain visible → mobile admin must switch to web admin to assign the 3 packed orders
  - **Expected**: "Cluster Orders" button available, clicking shows 3 packed orders grouped into clusters
  - **Actual**: No cluster button, no way to view packed orders

- **Edge Case**: Mobile admin packs the last order in the list → orders list becomes empty → no indication that packed orders exist or where to find them
  - **Expected**: Empty state message with "View Cluster Orders" button or automatic navigation to cluster view

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Orders with status CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, or CANCELLED must continue to display in the main orders list with existing functionality
- Mouse/touch interactions on action buttons (Confirm, Pack, Assign, Cancel) must continue to work exactly as before
- Order status updates via socket events for non-PACKED statuses must continue to update the orders list in real-time
- The existing `DeliveryPartnerSelectionModal` must continue to work for individual order assignment (non-clustered)
- Order filtering by status in the main orders screen must continue to work without affecting cluster view functionality
- The existing `onPack`, `onConfirm`, `onCancel`, `onAssign` functions must continue to work as currently implemented

**Scope:**
All inputs that do NOT involve PACKED orders should be completely unaffected by this fix. This includes:
- Viewing, filtering, and searching orders in the main orders list
- Confirming orders (CREATED → CONFIRMED transition)
- Cancelling orders
- Assigning individual orders that are not in clusters
- Viewing order details
- Real-time updates for non-PACKED order status changes

## Hypothesized Root Cause

Based on the bug description and codebase analysis, the root causes are:

1. **Missing Cluster API Endpoint**: The mobile app's `adminApi.ts` does not define a `getClusters` or `getRoutesPreview` endpoint. The web admin uses `POST /api/admin/routes/compute?mode=preview` to fetch cluster data, but this endpoint is not available in the mobile API service.

2. **Missing Cluster Screen**: The mobile app does not have a `ClusterOrdersScreen` component. The web admin has `AdminRoutesPreviewPage.tsx` that displays clusters with order count, distance, ETA, and assignment functionality.

3. **Missing Navigation**: The `AdminOrdersScreen` does not have a "Cluster Orders" button or navigation option to access cluster data.

4. **Incomplete Data Flow After Pack**: The `onPack` function in `AdminOrdersScreen.tsx` (line 195) updates local state with the packed order but does not trigger a cluster data refresh. The order is removed from the list (because the API no longer returns it), but no cluster data is fetched to show where it went.

5. **Incomplete Socket Event Handling**: The socket event handler for `order:status:changed` (line 91) updates the order list but does not check if the new status is PACKED and trigger a cluster data refresh.

6. **Missing Cluster State Management**: The mobile app does not have state variables to store cluster data (`clusters[]`) or loading states for cluster operations.

## Correctness Properties

Property 1: Bug Condition - PACKED Orders Visible in Cluster View

_For any_ order that is marked as PACKED (either by the mobile admin or via socket event from web admin), the mobile app SHALL fetch cluster data from `/api/admin/routes/compute?mode=preview` and display the order in the ClusterOrdersScreen grouped with other PACKED orders, showing cluster ID, order count, distance, ETA, and order IDs.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-PACKED Order Behavior

_For any_ order with status NOT equal to PACKED (CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, CANCELLED), the mobile app SHALL continue to display the order in the main AdminOrdersScreen with all existing functionality (filtering, searching, action buttons, real-time updates) exactly as implemented before this fix.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `apps/customer-app/src/api/adminApi.ts`

**Function**: Add new endpoint to `adminApi.injectEndpoints`

**Specific Changes**:
1. **Add getClusters endpoint**: Define a new RTK Query endpoint that calls `POST /api/admin/routes/compute?mode=preview` with body `{ vehicle: { type: "AUTO" } }` and returns cluster data
   - Endpoint name: `getClusters`
   - Method: POST
   - URL: `/admin/routes/compute?mode=preview`
   - Body: `{ vehicle: { type: "AUTO" } }`
   - Provides tag: `['Clusters']`

2. **Export hook**: Export `useGetClustersQuery` hook for use in components

**File 2**: `apps/customer-app/src/screens/admin/ClusterOrdersScreen.tsx` (NEW FILE)

**Function**: Create new screen component

**Specific Changes**:
1. **Create ClusterOrdersScreen component**: New React component that displays cluster data
   - Import `useGetClustersQuery` from adminApi
   - Define TypeScript types for cluster data (matching web admin structure):
     - `PreviewCluster`: `{ tempClusterId: string, orderCount: number, distanceKm: number, estimatedTimeMin: number, orders: Array<string | PreviewOrder>, routePath?: string[] }`
     - `PreviewOrder`: `{ orderId?: string, itemsQty?: number, grossAmount?: number, netAmount?: number, ... }`
   - Fetch clusters using `useGetClustersQuery()`
   - Display loading state while fetching
   - Display empty state if no clusters found ("No packed orders")
   - Render cluster cards with:
     - Cluster ID
     - Order count
     - Distance (km)
     - ETA (minutes)
     - List of order IDs
     - "Assign Delivery Boy" button
   - Handle "Assign Delivery Boy" click: open `DeliveryPartnerSelectionModal` and call assign API for all orders in cluster

2. **Add AdminHeader**: Include header with "Cluster Orders" title and back button

3. **Add styling**: Match existing mobile admin design system (Colors, card styles, etc.)

**File 3**: `apps/customer-app/src/screens/admin/AdminOrdersScreen.tsx`

**Function**: Add navigation button and update data flow

**Specific Changes**:
1. **Add "Cluster Orders" button**: Insert button in header or below filter bar that navigates to `ClusterOrdersScreen`
   - Position: Below search bar or in header actions
   - Style: Match existing button design
   - Action: `navigation.navigate('ClusterOrders')`

2. **Update onPack function** (line 195): After successful pack operation, call `fetchClusters()` to refresh cluster data
   - Add: `dispatch(adminApi.util.invalidateTags(['Clusters']))` after updating local state
   - This ensures cluster data is refreshed when an order is packed

3. **Update socket event handler** (line 91): Add check for PACKED status and trigger cluster refresh
   - In `socketClient.subscribeToOrderStatusChanges` callback:
   - Add: `if (data.to === 'PACKED') { dispatch(adminApi.util.invalidateTags(['Clusters'])) }`

**File 4**: `apps/customer-app/src/navigation/AdminNavigator.tsx`

**Function**: Add ClusterOrdersScreen to navigation stack

**Specific Changes**:
1. **Import ClusterOrdersScreen**: Add import statement for new screen
2. **Add Stack.Screen**: Add `<Stack.Screen name="ClusterOrders" component={ClusterOrdersScreen} />` to navigation stack

**File 5**: `apps/customer-app/src/api/adminApi.ts` (additional endpoint)

**Function**: Add cluster assignment endpoint (if not already present)

**Specific Changes**:
1. **Add assignCluster endpoint**: Define endpoint for assigning delivery partner to multiple orders
   - Endpoint name: `assignCluster`
   - Method: POST
   - URL: `/admin/routes/assign`
   - Body: `{ deliveryBoyId: string, orderIds: string[], routePath: string[] }`
   - Invalidates tags: `['Orders', 'Clusters']`

2. **Export hook**: Export `useAssignClusterMutation` hook

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate packing an order and assert that cluster data is fetched and the order is visible in the cluster view. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Pack Order Test**: Simulate packing an order in AdminOrdersScreen → assert that order disappears from main list (will pass on unfixed code) → assert that cluster data is fetched (will fail on unfixed code - no cluster API call)
2. **Socket Event Test**: Simulate receiving `order:status:changed` socket event with status PACKED → assert that cluster data is refreshed (will fail on unfixed code - no cluster refresh logic)
3. **Navigation Test**: Render AdminOrdersScreen → assert that "Cluster Orders" button exists (will fail on unfixed code - button does not exist)
4. **Cluster Screen Test**: Attempt to navigate to ClusterOrdersScreen → assert that screen renders (will fail on unfixed code - screen does not exist)

**Expected Counterexamples**:
- Cluster API endpoint is not defined in adminApi.ts
- ClusterOrdersScreen component does not exist
- No "Cluster Orders" button in AdminOrdersScreen
- onPack function does not trigger cluster data refresh
- Socket event handler does not check for PACKED status or refresh clusters

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := mobileApp_fixed.packOrder(input.orderId)
  ASSERT result.clusterDataFetched === true
  ASSERT result.orderVisibleInClusterView === true
  ASSERT result.clusterScreenAccessible === true
END FOR
```

**Test Cases**:
1. **Pack Order Flow**: Confirm order → Pack order → Verify cluster data is fetched → Navigate to Cluster Orders → Verify order appears in cluster
2. **Socket Event Flow**: Simulate socket event with PACKED status → Verify cluster data is refreshed → Navigate to Cluster Orders → Verify order appears
3. **Cluster Assignment Flow**: Navigate to Cluster Orders → Select cluster → Click "Assign Delivery Boy" → Select partner → Verify assignment API is called with all order IDs in cluster
4. **Multi-Order Cluster**: Pack 3 orders → Navigate to Cluster Orders → Verify all 3 orders appear in same cluster (if clustered together) or separate clusters

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT AdminOrdersScreen_original(input) = AdminOrdersScreen_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-PACKED orders, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Order List Preservation**: Observe that CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, CANCELLED orders display correctly on unfixed code → Write test to verify this continues after fix
2. **Action Button Preservation**: Observe that Confirm, Pack, Assign, Cancel buttons work correctly on unfixed code → Write test to verify this continues after fix
3. **Socket Event Preservation**: Observe that socket events for non-PACKED statuses update the list correctly on unfixed code → Write test to verify this continues after fix
4. **Filter Preservation**: Observe that status filtering works correctly on unfixed code → Write test to verify this continues after fix

### Unit Tests

- Test `getClusters` API endpoint returns correct data structure
- Test ClusterOrdersScreen renders loading state while fetching
- Test ClusterOrdersScreen renders empty state when no clusters
- Test ClusterOrdersScreen renders cluster cards with correct data
- Test "Cluster Orders" button navigation in AdminOrdersScreen
- Test onPack function triggers cluster data refresh
- Test socket event handler triggers cluster refresh for PACKED status
- Test cluster assignment calls correct API endpoint with all order IDs

### Property-Based Tests

- Generate random order states (CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, CANCELLED) and verify they continue to display in main orders list after fix
- Generate random socket events with non-PACKED statuses and verify order list updates correctly
- Generate random filter selections and verify filtering works correctly for non-PACKED orders
- Generate random order data and verify action buttons (Confirm, Cancel, Assign) continue to work for non-PACKED orders

### Integration Tests

- Test full flow: Create order → Confirm → Pack → Navigate to Cluster Orders → Verify order in cluster → Assign delivery partner → Verify order status changes to IN_TRANSIT
- Test socket synchronization: Pack order in web admin → Verify mobile receives socket event → Verify cluster data refreshes → Verify order appears in mobile cluster view
- Test multi-device scenario: Pack order in mobile → Verify web admin cluster view updates → Assign in web → Verify mobile receives update
- Test edge case: Pack all orders → Verify main orders list is empty → Verify cluster view shows all packed orders → Assign all clusters → Verify orders move to IN_TRANSIT status
