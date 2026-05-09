# Requirements Document

## Introduction

The mobile delivery app (`DeliveryHomeTab` and its sub-components) must be brought into full functional parity with the web dashboard (`EnhancedHomeTab`). The web dashboard is the single source of truth. This is a system-alignment task — not a redesign. Every order state, action button, data field, and workflow sequence on mobile must match the web dashboard exactly.

The primary gaps identified are: incorrect order bucketing, a 45-second countdown timer that does not exist on web, a 5-step progress timeline vs the web's 3-step bar, OTP always shown on `arrived` vs web's post-attempt gate, a single active order shown vs web's full list, passive stats shown at zero vs web's conditional display, and non-web UI elements (PerformancePanel, QuickActions Help/Issue buttons, MapPreview navigate button, ControlBar greeting).

---

## Glossary

- **DeliveryHomeTab**: The mobile React Native screen that is the subject of this alignment (`apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`).
- **EnhancedHomeTab**: The web dashboard component that is the authoritative source of truth (`frontend/src/components/delivery/EnhancedHomeTab.tsx`).
- **Available_Order**: An order whose `orderStatus` equals `"created"`. These are shown with Accept / Decline buttons.
- **Active_Order**: An order whose `orderStatus` is one of: `confirmed`, `packed`, `assigned`, `picked_up`, `in_transit`, `out_for_delivery`, `arrived`, `cancelled`.
- **DeliveryState**: The mobile app's top-level UI state machine: `OFFLINE`, `IDLE`, `NEW_ORDER`, `ACTIVE_DELIVERY`.
- **DeliveryAttempted**: A per-order boolean flag set to `true` only after the delivery partner taps "Start Delivery Attempt" and the OTP API call succeeds.
- **COD_Order**: An order whose `paymentMethod` is `"cod"`.
- **COD_Collected**: A COD order for which a `CodCollection` record exists (fetched from `/delivery/orders/:id/cod-collection`).
- **arrivedAt**: The timestamp field on an order set when the delivery partner taps "Mark as Arrived".
- **Progress_Bar**: The 3-segment horizontal bar shown inside an expanded active order card, with labels: Assigned → Picked Up → In Transit.
- **ControlBar**: The top header component showing availability status and earnings.
- **PerformancePanel**: The stats panel currently rendered on the home screen showing earnings, deliveries, and rating.
- **QuickActions**: The bottom bar currently showing Go Online/Offline, Help, and Issue buttons.
- **MapPreview**: The standalone map component currently rendered below the StateCard.
- **StateCard**: The main card component that renders the appropriate sub-card based on `DeliveryState`.
- **IdleCard**: The sub-card shown when the partner is online but has no orders.
- **NewOrderCard**: The sub-card shown when `orderStatus === "created"` orders are available.
- **ActiveOrderCard**: The sub-card shown when active orders exist.

---

## Requirements

### Requirement 1: Order Bucketing — Available vs Active

**User Story:** As a delivery partner, I want the mobile app to show me the same set of orders in the same categories as the web dashboard, so that I am never confused about which orders need my attention.

#### Acceptance Criteria

1. THE DeliveryHomeTab SHALL classify an order as an Available_Order if and only if `orderStatus === "created"`.
2. THE DeliveryHomeTab SHALL classify an order as an Active_Order if `orderStatus` is one of: `confirmed`, `packed`, `assigned`, `picked_up`, `in_transit`, `out_for_delivery`, `arrived`, or `cancelled`.
3. WHEN the API returns orders, THE DeliveryHomeTab SHALL display ALL Active_Orders simultaneously, not only the first matching order.
4. THE useOrders hook SHALL NOT use a `stableActiveOrder` pattern that suppresses display of multiple concurrent active orders.
5. WHEN `orderStatus === "out_for_delivery"` is received from the API, THE DeliveryHomeTab SHALL treat it identically to `in_transit` for all display and action purposes, matching the normalization already applied by the backend.
6. THE DeliveryState machine SHALL transition to `ACTIVE_DELIVERY` when one or more Active_Orders exist, and SHALL display all of them in a list.
7. THE DeliveryState machine SHALL transition to `NEW_ORDER` when one or more Available_Orders exist and no Active_Orders exist.

---

### Requirement 2: Action Button Parity per Order Status

**User Story:** As a delivery partner, I want the mobile app to show me exactly the same action buttons as the web dashboard for each order status, so that I can progress orders without confusion.

#### Acceptance Criteria

1. WHEN `orderStatus === "assigned"` AND `deliveryStatus !== "unassigned"`, THE ActiveOrderCard SHALL display a "Mark as Picked Up" button and no other primary action button.
2. WHEN `orderStatus === "assigned"` AND `deliveryStatus === "unassigned"`, THE ActiveOrderCard SHALL display a waiting message ("Order not yet assigned to you") and SHALL NOT display a "Mark as Picked Up" button.
3. WHEN `orderStatus === "picked_up"`, THE ActiveOrderCard SHALL display a "Start Delivery" button.
4. WHEN `orderStatus === "packed"`, THE ActiveOrderCard SHALL display a "Start Delivery" button.
5. WHEN `orderStatus === "in_transit"` AND `arrivedAt` is not set, THE ActiveOrderCard SHALL display a "Mark as Arrived" button.
6. WHEN `orderStatus === "in_transit"` AND `arrivedAt` is set AND the order is not a COD_Order (or is COD_Collected), THE ActiveOrderCard SHALL display a "Start Delivery Attempt" button that triggers the OTP send API call.
7. WHEN `orderStatus === "in_transit"` AND `arrivedAt` is set AND the order is a COD_Order AND COD is not yet collected, THE ActiveOrderCard SHALL display "Collect Cash" and "Collect UPI" buttons and SHALL NOT display the "Start Delivery Attempt" button.
8. WHEN `DeliveryAttempted` is true for an order, THE ActiveOrderCard SHALL display an OTP input field and a "Verify OTP & Complete Delivery" button.
9. WHEN `orderStatus === "in_transit"` AND `arrivedAt` is set AND `DeliveryAttempted` is true AND the order is not cancelled, THE ActiveOrderCard SHALL display a "Customer Not Available" button.
10. WHEN `orderStatus === "cancelled"`, THE ActiveOrderCard SHALL display a cancellation summary and SHALL NOT display any action buttons.

---

### Requirement 3: OTP Flow Parity — Gated by Delivery Attempt

**User Story:** As a delivery partner, I want the OTP input to appear only after I tap "Start Delivery Attempt", matching the web dashboard, so that I do not accidentally see or enter an OTP before I am ready.

#### Acceptance Criteria

1. THE ActiveOrderCard SHALL maintain a per-order `deliveryAttempted` boolean flag, initialised to `false`.
2. WHEN the delivery partner taps "Start Delivery Attempt" and the API call succeeds, THE ActiveOrderCard SHALL set `deliveryAttempted` to `true` for that order.
3. WHILE `deliveryAttempted` is `false` for an order, THE ActiveOrderCard SHALL NOT display the OTP input field or the "Verify OTP & Complete Delivery" button for that order, regardless of `orderStatus`.
4. WHILE `deliveryAttempted` is `true` for an order, THE ActiveOrderCard SHALL display the OTP input field and the "Verify OTP & Complete Delivery" button.
5. WHEN OTP verification succeeds, THE ActiveOrderCard SHALL reset `deliveryAttempted` to `false` for that order and clear the OTP input.
6. THE ActiveOrderCard SHALL NOT show the OTP section solely because `orderStatus === "arrived"`, matching the web dashboard behaviour.

---

### Requirement 4: COD Gate Parity — Collection Before OTP

**User Story:** As a delivery partner, I want the mobile app to require COD collection before I can send an OTP, matching the web dashboard, so that payment is never skipped.

#### Acceptance Criteria

1. WHEN an order is a COD_Order AND `arrivedAt` is set AND COD has not been collected, THE ActiveOrderCard SHALL display "Collect Cash" and "Collect UPI" buttons.
2. WHEN an order is a COD_Order AND `arrivedAt` is set AND COD has not been collected, THE ActiveOrderCard SHALL NOT display the "Start Delivery Attempt" button.
3. WHEN the delivery partner confirms COD collection and the API call succeeds, THE ActiveOrderCard SHALL mark the order as COD_Collected and display the "Start Delivery Attempt" button.
4. WHEN an order is a COD_Order AND COD_Collected is true, THE ActiveOrderCard SHALL display a "Payment Collected" confirmation banner showing the collection mode (Cash or UPI).
5. THE ActiveOrderCard SHALL fetch the COD collection status from the backend for each COD order that has `arrivedAt` set, to ensure the gate is enforced even after app restart.

---

### Requirement 5: "Customer Not Available" Button Parity

**User Story:** As a delivery partner, I want the "Customer Not Available" button to appear as a prominent button only when the conditions match the web dashboard, so that I do not accidentally fail a delivery.

#### Acceptance Criteria

1. THE ActiveOrderCard SHALL display a prominent "Customer Not Available" button WHEN `orderStatus` is `in_transit` AND `arrivedAt` is set AND the order is not cancelled.
2. THE ActiveOrderCard SHALL NOT display the "Customer Not Available" button as a small link or footnote; it SHALL be rendered as a full-width button with a warning colour, matching the web dashboard.
3. WHEN the delivery partner taps "Customer Not Available", THE DeliveryHomeTab SHALL open a modal to select a failure reason before submitting.
4. THE ActiveOrderCard SHALL NOT display the "Customer Not Available" button when `orderStatus` is not `in_transit`, or when `arrivedAt` is not set.

---

### Requirement 6: Data Fields Parity per Order Card

**User Story:** As a delivery partner, I want every active order card on mobile to show the same data fields as the web dashboard, so that I have all the information I need without switching screens.

#### Acceptance Criteria

1. THE ActiveOrderCard SHALL display the last 6 characters of the order ID as the order reference.
2. THE ActiveOrderCard SHALL display the total order amount formatted as `₹{amount}`.
3. THE ActiveOrderCard SHALL display the customer's full name.
4. THE ActiveOrderCard SHALL display the customer's phone number as a tappable link that initiates a phone call.
5. THE ActiveOrderCard SHALL display the full delivery address including `addressLine`, `city`, and `pincode`.
6. THE ActiveOrderCard SHALL display an order status badge with a human-readable label derived from `getStatusBadgeConfig` (or an equivalent mobile mapping).
7. THE ActiveOrderCard SHALL display a payment status badge showing one of: "Paid", "Pending", or "Awaiting UPI Approval", derived from `paymentStatus`.
8. THE ActiveOrderCard SHALL display the payment method (COD or Prepaid).
9. THE ActiveOrderCard SHALL display a next-action hint text when one is defined for the current status (e.g., "Navigate to Pickup", "Start Delivery").
10. THE ActiveOrderCard SHALL display a "Navigate to Location" button that opens Google Maps with the delivery address coordinates, placed inside the order card (not in a separate MapPreview component).
11. THE ActiveOrderCard SHALL display the 3-step Progress_Bar with labels: "Assigned", "Picked Up", "In Transit", matching the web dashboard exactly.

---

### Requirement 7: Progress Bar Parity — 3 Steps

**User Story:** As a delivery partner, I want the progress bar to show the same 3 steps as the web dashboard, so that I have a consistent mental model of the delivery workflow.

#### Acceptance Criteria

1. THE ActiveOrderCard SHALL render a progress bar with exactly 3 steps: "Assigned", "Picked Up", "In Transit".
2. THE ActiveOrderCard SHALL NOT render a 5-step timeline (Assigned, Picked Up, On Route, Arrived, Delivered).
3. WHEN `orderStatus === "assigned"`, THE Progress_Bar SHALL highlight the first segment (Assigned) as active.
4. WHEN `orderStatus === "picked_up"`, THE Progress_Bar SHALL highlight the first segment as complete and the second segment (Picked Up) as active.
5. WHEN `orderStatus` is `in_transit` or `out_for_delivery`, THE Progress_Bar SHALL highlight the first two segments as complete and the third segment (In Transit) as active.

---

### Requirement 8: Idle State Parity — No Zero Stats

**User Story:** As a delivery partner, I want the idle screen to show only the "waiting" message and a refresh button when I have no orders, matching the web dashboard, so that I am not distracted by zero-value stats.

#### Acceptance Criteria

1. WHEN the DeliveryState is `IDLE`, THE IdleCard SHALL display the message "No Active Orders" and the sub-message "Stay online to receive delivery requests".
2. WHEN the DeliveryState is `IDLE`, THE IdleCard SHALL display a Refresh button.
3. WHEN the DeliveryState is `IDLE` AND `earnings > 0`, THE IdleCard SHALL display the earnings value.
4. WHEN the DeliveryState is `IDLE` AND `earnings === 0`, THE IdleCard SHALL NOT display an earnings value or a "₹0" label.
5. WHEN the DeliveryState is `IDLE`, THE IdleCard SHALL NOT display a deliveries count of 0.
6. WHEN the DeliveryState is `IDLE`, THE IdleCard SHALL NOT display a rating value.
7. WHEN the DeliveryState is `IDLE`, THE IdleCard SHALL NOT display motivation messages or inspirational text.

---

### Requirement 9: ControlBar Parity — Operational Status, Not Greeting

**User Story:** As a delivery partner, I want the top bar to show my operational status and earnings (when non-zero), matching the web dashboard, so that I can see what matters at a glance.

#### Acceptance Criteria

1. THE ControlBar SHALL display the delivery partner's online/offline availability status.
2. WHEN `earnings > 0`, THE ControlBar SHALL display the earnings value.
3. WHEN `earnings === 0`, THE ControlBar SHALL NOT display an earnings value or a "₹0" label.
4. THE ControlBar SHALL NOT display a time-of-day greeting (e.g., "Good Morning, {name}").
5. THE ControlBar SHALL NOT display a zone or area label as a primary element.

---

### Requirement 10: Remove Non-Web UI Elements from Home Screen

**User Story:** As a delivery partner, I want the mobile home screen to contain only the elements present on the web dashboard, so that the experience is consistent and uncluttered.

#### Acceptance Criteria

1. THE DeliveryHomeTab SHALL NOT render the PerformancePanel component on the home screen.
2. THE DeliveryHomeTab SHALL NOT render Help or Issue buttons in the QuickActions bar on the home screen.
3. THE NewOrderCard SHALL NOT display a countdown timer.
4. THE DeliveryHomeTab SHALL NOT render a standalone MapPreview component below the StateCard.
5. THE ActiveOrderCard SHALL contain the "Navigate to Location" button inside the order card itself, replacing the standalone MapPreview.
6. WHERE an earnings tab or summary screen exists, THE DeliveryHomeTab SHALL make the PerformancePanel available there instead of on the home screen.

---

### Requirement 11: Available Order Card (NewOrderCard) Parity

**User Story:** As a delivery partner, I want the new order card to show the same information and actions as the web dashboard, so that I can make an informed accept/decline decision.

#### Acceptance Criteria

1. THE NewOrderCard SHALL display the order ID (last 6 characters).
2. THE NewOrderCard SHALL display the total amount formatted as `₹{amount}`.
3. THE NewOrderCard SHALL display the customer name.
4. THE NewOrderCard SHALL display the customer phone number.
5. THE NewOrderCard SHALL display the full delivery address (`addressLine`, `city`).
6. THE NewOrderCard SHALL display an "Accept" button and a "Decline" button.
7. THE NewOrderCard SHALL NOT display a countdown timer.
8. WHEN multiple Available_Orders exist, THE DeliveryHomeTab SHALL display all of them, not only the first one.

---

### Requirement 12: Payment Status Badge Parity

**User Story:** As a delivery partner, I want each active order card to show a payment status badge, matching the web dashboard, so that I know whether payment has been received before completing the delivery.

#### Acceptance Criteria

1. THE ActiveOrderCard SHALL display a payment status badge for each active order.
2. WHEN `paymentStatus === "paid"`, THE payment status badge SHALL display "Paid" with a green colour.
3. WHEN `paymentStatus === "awaiting_upi_approval"`, THE payment status badge SHALL display "Awaiting UPI Approval" with a yellow colour.
4. WHEN `paymentStatus` is any other value, THE payment status badge SHALL display "Pending" with a grey colour.
5. THE payment status badge SHALL display the payment method (COD or Prepaid) alongside the status.
