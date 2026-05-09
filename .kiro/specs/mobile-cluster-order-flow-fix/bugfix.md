# Bugfix Requirements Document

## Introduction

The mobile admin app is missing the cluster order flow that exists in the web admin app. After an order is marked as PACKED, it disappears from the mobile admin interface and cannot be assigned to a delivery partner. The web admin correctly shows packed orders in a "Cluster Orders" view where they can be grouped and assigned to delivery partners. This bugfix will implement the missing cluster order flow in the mobile admin app to achieve feature parity with the web admin.

**Impact:** Mobile admin users cannot complete the order fulfillment workflow after packing orders, forcing them to switch to the web admin to assign delivery partners.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an order is marked as PACKED in the mobile admin app THEN the order disappears from the orders list and is not visible in any view

1.2 WHEN the mobile admin app fetches orders THEN it only calls the `/api/admin/orders` endpoint and does not fetch cluster data from `/api/admin/routes/preview`

1.3 WHEN a packed order exists in the system THEN the mobile admin app provides no interface to view or assign delivery partners to clustered orders

1.4 WHEN the mobile admin app receives a socket event `order:status:changed` with status PACKED THEN it does not trigger a refresh of cluster data

1.5 WHEN the mobile admin user needs to assign a delivery partner to a packed order THEN there is no "Cluster Orders" button or navigation option available

### Expected Behavior (Correct)

2.1 WHEN an order is marked as PACKED in the mobile admin app THEN the system SHALL fetch cluster data from `/api/admin/routes/preview` to display grouped packed orders

2.2 WHEN the mobile admin app loads THEN it SHALL provide a "Cluster Orders" button that navigates to a cluster view showing packed orders grouped by delivery routes

2.3 WHEN the mobile admin user views the cluster orders screen THEN the system SHALL display packed orders grouped into clusters with route optimization information

2.4 WHEN the mobile admin user selects a cluster THEN the system SHALL allow assignment of a delivery partner to all orders in that cluster

2.5 WHEN the mobile admin app receives a socket event `order:status:changed` with status PACKED THEN it SHALL automatically refresh the cluster data to include the newly packed order

2.6 WHEN the mobile admin user assigns a delivery partner from the cluster view THEN the system SHALL call the appropriate assignment API endpoint and update the order status to IN_TRANSIT

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an order has status CREATED, CONFIRMED, IN_TRANSIT, DELIVERED, or CANCELLED THEN the system SHALL CONTINUE TO display it in the main orders list with existing functionality

3.2 WHEN the mobile admin user confirms or packs an order from the main orders list THEN the system SHALL CONTINUE TO update the order status and trigger socket events as currently implemented

3.3 WHEN the mobile admin app receives socket events for order status changes (non-PACKED statuses) THEN it SHALL CONTINUE TO update the orders list in real-time as currently implemented

3.4 WHEN the mobile admin user views order details THEN the system SHALL CONTINUE TO display all order information and available actions as currently implemented

3.5 WHEN the mobile admin user assigns a delivery partner to an individual order (non-clustered) THEN the system SHALL CONTINUE TO use the existing assignment flow via the DeliveryPartnerSelectionModal

3.6 WHEN the mobile admin app filters orders by status THEN the system SHALL CONTINUE TO filter the main orders list without affecting cluster view functionality
