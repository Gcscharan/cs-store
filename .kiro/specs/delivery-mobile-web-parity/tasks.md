# Implementation Plan: Delivery Mobile–Web Parity

## Overview

Bring `DeliveryHomeTab` and its sub-components into full functional parity with the web dashboard (`EnhancedHomeTab`). Changes are confined to the delivery feature slice. Execution is strictly layered: hooks first, then leaf components, then the StateCard router, then the orchestrator.

## Tasks

- [x] 1. Layer 1 — Rewrite hooks (foundation)

  - [x] 1.1 Rewrite `useOrders.ts` — correct order bucketing
    - Remove `stableActiveOrder` state and the `useEffect` that maintained it
    - Remove `newOrders` export
    - Add `AVAILABLE_STATUSES = ['created']` and `ACTIVE_STATUSES` constants
    - Derive `availableOrders` as `orders.filter(o => o.orderStatus.toLowerCase() === 'created')`
    - Derive `activeOrders` as `orders.filter(o => ACTIVE_STATUSES.includes(o.orderStatus.toLowerCase()))`
    - Export updated `UseOrdersResult` interface with `availableOrders: Order[]` and `activeOrders: Order[]`
    - Both arrays are derived directly from the query result with no stabilisation layer
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [ ]* 1.2 Write property test for `useOrders` bucketing
    - **Property 1: Order bucketing is a partition**
    - Generate random order arrays with arbitrary statuses; assert `availableOrders` contains exactly `status === "created"` orders, `activeOrders` contains exactly orders in `ACTIVE_STATUSES`, and the two sets are disjoint
    - **Validates: Requirements 1.1, 1.2, 1.5**

  - [x] 1.3 Rewrite `useDeliveryState.ts` — new state machine, remove OFFLINE
    - Remove `OFFLINE` from the `DeliveryState` union type; new type is `'IDLE' | 'NEW_ORDER' | 'ACTIVE_DELIVERY'`
    - Replace `activeOrder: Order | null` and `newOrders: Order[]` with `activeOrders: Order[]` and `availableOrders: Order[]`
    - Implement state machine: `ACTIVE_DELIVERY` when `activeOrders.length > 0`; `NEW_ORDER` when `activeOrders.length === 0 && availableOrders.length > 0`; `IDLE` otherwise
    - Export updated `DeliveryStateResult` interface
    - _Requirements: 1.6, 1.7_

  - [ ]* 1.4 Write property test for `useDeliveryState` state machine
    - **Property 2: State machine correctness**
    - Generate random `(activeOrders, availableOrders)` pairs; assert derived `DeliveryState` satisfies the three-way rule exactly
    - **Validates: Requirements 1.6, 1.7**

  - [x] 1.5 Update `useDashboardData.ts` — remove primaryOrder/showMap, pass through arrays
    - Remove `primaryOrder` field (no standalone MapPreview needs it)
    - Remove `showMap` field
    - Pass through `activeOrders` and `availableOrders` from `useDeliveryState`
    - Update `DashboardData` interface accordingly
    - _Requirements: 1.3, 10.4_

- [x] 2. Checkpoint — Layer 1 complete
  - Ensure all hook unit and property tests pass; confirm TypeScript compiles with no errors before proceeding to leaf components.

- [x] 3. Layer 2 — Rewrite leaf components (depend on Layer 1 types)

  - [x] 3.1 Rewrite `IdleCard.tsx` — remove zero stats
    - Update `IdleCardProps` to `{ earnings: number; onRefresh: () => void }`
    - Display title "No Active Orders" and subtitle "Stay online to receive delivery requests"
    - Render earnings value only when `earnings > 0`; omit the row entirely (no "₹0") when `earnings === 0`
    - Add a Refresh button wired to `onRefresh`
    - Remove: deliveries count, rating display, motivation/inspirational text, wait time estimate
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 3.2 Write property test for `IdleCard` zero-stats rule
    - **Property 6: No zero stats displayed (IdleCard)**
    - Generate random earnings values (including 0, negative, large positive); assert earnings row is rendered iff `earnings > 0`
    - **Validates: Requirements 8.3, 8.4**

  - [x] 3.3 Rewrite `NewOrderCard.tsx` — remove timer, show all available orders
    - Update `NewOrderCardProps` to `{ availableOrders: Order[]; onAccept: (orderId: string) => void; onReject: (orderId: string) => void }`
    - Remove `countdown` state, `useEffect` timer, and `timerBadge` UI element entirely
    - Map over all `availableOrders` (not just `[0]`); render one card per order
    - Each card shows: order ID (last 6 chars), total amount (`₹{amount}`), customer name, customer phone, full delivery address (`addressLine`, `city`), Accept button, Decline button
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 10.3_

  - [ ]* 3.4 Write property test for `NewOrderCard` — all orders rendered
    - **Property 10: All available orders are rendered in NewOrderCard**
    - Generate N available orders (N from 0–10); assert exactly N order cards are rendered
    - **Validates: Requirements 11.8**

  - [ ]* 3.5 Write property test for `NewOrderCard` — no countdown timer
    - **Property 11: No countdown timer in NewOrderCard**
    - For any available orders array, assert no timer or countdown element is present in the rendered output
    - **Validates: Requirements 10.3, 11.7**

  - [x] 3.6 Rewrite `ActiveOrderCard.tsx` — full rewrite for multi-order, web-parity logic
    - Update `ActiveOrderCardProps` to accept `activeOrders: Order[]` plus all per-order callback props (see design §6)
    - Render `activeOrders.map(order => <SingleActiveOrderCard key={order._id} ... />)`
    - **3-segment progress bar:** render exactly 3 segments labelled "Assigned", "Picked Up", "In Transit"; implement `isSegmentFilled` per the web mapping (segment 0: assigned/picked_up/in_transit/out_for_delivery; segment 1: picked_up/in_transit/out_for_delivery; segment 2: in_transit/out_for_delivery)
    - **Data fields per card:** order ID (last 6), `₹{totalAmount}`, customer name, customer phone (tappable `tel:` link), full address (`addressLine`, `city`, `pincode`), order status badge via `getStatusBadgeConfig`, payment status badge via `getPaymentBadge`, payment method label, next-action hint text
    - **Payment badge:** `getPaymentBadge` returns Paid/green, Awaiting UPI Approval/yellow, or Pending/grey based on `paymentStatus`
    - **Navigate button (inside card):** "Navigate to Location" opens `https://maps.google.com/?q={lat},{lng}` via `Linking.openURL`; show Alert if coordinates missing
    - **Action button logic per status** (exact match to web):
      - `assigned` + `deliveryStatus !== "unassigned"` → "Mark as Picked Up"
      - `assigned` + `deliveryStatus === "unassigned"` → warning message, no button
      - `picked_up` or `packed` → "Start Delivery"
      - `in_transit` + `!arrivedAt` → "Mark as Arrived"
      - `in_transit` + `arrivedAt` + `canSendOtp` + `!isDeliveryAttempted` → "Start Delivery Attempt"
      - `in_transit` + `arrivedAt` + `isDeliveryAttempted` → OTP input + "Verify OTP & Complete Delivery"
      - `in_transit` + `arrivedAt` (not cancelled) → "Customer Not Available" full-width warning button
      - `cancelled` → cancellation summary, no action buttons
    - **COD gate:** when `isCod && hasArrived && !codCollected` show "Collect Cash" + "Collect UPI", hide "Start Delivery Attempt"; when `codCollected` show "Payment Collected" banner with mode
    - **OTP gate:** show OTP input + verify button only when `deliveryAttempted[orderId] === true`
    - _Requirements: 1.3, 2.1–2.10, 3.1–3.6, 4.1–4.5, 5.1–5.4, 6.1–6.11, 7.1–7.5, 12.1–12.5_

  - [ ]* 3.7 Write property test for `ActiveOrderCard` — all active orders rendered
    - **Property 3: All active orders are rendered**
    - Generate N active orders (N from 1–10); assert exactly N order cards are rendered
    - **Validates: Requirements 1.3, 1.6**

  - [ ]* 3.8 Write property test for `ActiveOrderCard` — OTP gate
    - **Property 4: OTP gate — deliveryAttempted controls OTP visibility**
    - For any order and any `deliveryAttempted` map value, assert OTP input section is rendered iff `deliveryAttempted[orderId] === true`
    - **Validates: Requirements 3.3, 3.4, 3.6**

  - [ ]* 3.9 Write property test for `ActiveOrderCard` — COD gate
    - **Property 5: COD gate — no "Start Delivery Attempt" before collection**
    - For any COD order with `arrivedAt` set and `codCollectionByOrderId[orderId]` null/undefined, assert "Start Delivery Attempt" button is not rendered
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 3.10 Write property test for `ActiveOrderCard` — progress bar segment count
    - **Property 7: Progress bar always has exactly 3 segments**
    - For any order status string, assert exactly 3 segments with labels "Assigned", "Picked Up", "In Transit" are rendered
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 3.11 Write property test for `ActiveOrderCard` — progress bar fill state
    - **Property 8: Progress bar fill state matches status**
    - For each status in the known set, assert segment fill state matches the web mapping table
    - **Validates: Requirements 7.3, 7.4, 7.5**

  - [ ]* 3.12 Write property test for `ActiveOrderCard` — payment status badge
    - **Property 9: Payment status badge is a pure function of paymentStatus**
    - For any `paymentStatus` string, assert badge label is "Paid" / "Awaiting UPI Approval" / "Pending" per the mapping
    - **Validates: Requirements 12.2, 12.3, 12.4**

  - [x] 3.13 Update `ControlBar.tsx` — remove greeting/zone, conditional earnings
    - Remove `name`, `zone`, `batteryLevel`, `networkQuality` props
    - Update `ControlBarProps` to `{ isOnline: boolean; earnings: number; onToggleOnline: () => void; isToggling: boolean }`
    - Remove `getGreeting()` call and greeting text render
    - Remove zone/area label row
    - Render earnings row only when `earnings > 0`; omit entirely when `earnings === 0`
    - Keep online/offline toggle chip
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 3.14 Write property test for `ControlBar` zero-earnings rule
    - **Property 6: No zero stats displayed (ControlBar)**
    - Generate random earnings values; assert earnings row is rendered iff `earnings > 0`
    - **Validates: Requirements 9.2, 9.3**

- [x] 4. Checkpoint — Layer 2 complete
  - Ensure all leaf component tests pass and TypeScript compiles cleanly before proceeding to StateCard.

- [x] 5. Layer 3 — Update `StateCard.tsx` router (depends on Layer 2)

  - [x] 5.1 Update `StateCard.tsx` — new props interface, remove OFFLINE case
    - Replace `StateCardProps` with the full interface from design §5 (`activeOrders`, `availableOrders`, `deliveryAttempted`, `codCollectionByOrderId`, `otpInputs`, all callbacks)
    - Remove the `OFFLINE` case from the switch/render logic; remove `OfflineCard` import and render
    - Pass `availableOrders` to `NewOrderCard` (replacing `newOrders`)
    - Pass `activeOrders` and all per-order props to `ActiveOrderCard`
    - Pass `earnings` and `onRefresh` to `IdleCard`
    - _Requirements: 1.6, 1.7, 10.1_

- [x] 6. Layer 4 — Update `DeliveryHomeTab.tsx` orchestrator (depends on all layers)

  - [x] 6.1 Update `DeliveryHomeTab.tsx` — remove non-web elements and add new state
    - Remove `<PerformancePanel ... />` from render tree
    - Remove `{showMap && primaryOrder && <MapPreview ... />}` from render tree
    - Remove Help and Issue buttons from `<QuickActions>` (keep only the online/offline toggle, or remove `QuickActions` entirely if it has no remaining items)
    - Add `deliveryAttempted` state: `useState<Record<string, boolean>>({})`
    - Add `codCollectionByOrderId` state: `useState<Record<string, CodCollection | null | undefined>>({})`
    - Add `otpInputs` state: `useState<Record<string, string>>({})`
    - Implement `fetchCodCollection(orderId)` — calls `getCodCollection(orderId).unwrap()`, stores result in `codCollectionByOrderId`; on failure stores `null`
    - Implement `handleStartDeliveryAttempt(orderId)` — calls `deliverAttempt(orderId).unwrap()`, sets `deliveryAttempted[orderId] = true`; on failure shows Alert
    - Implement `handleCollectCOD(orderId, mode)` — calls `createCodCollection(...)`, updates `codCollectionByOrderId`; on failure shows Alert
    - Add `useEffect` to fetch COD collection for each COD order with `arrivedAt` set when `activeOrders` changes (skip if already fetched)
    - Update `<StateCard>` call with all new props per design §4
    - Update `<ControlBar>` call with new props per design §9 (remove `name`/`zone`, add `earnings`)
    - _Requirements: 1.3, 3.1–3.5, 4.3–4.5, 5.3, 10.1, 10.2, 10.4_

  - [ ]* 6.2 Write property test for `DeliveryHomeTab` — no standalone MapPreview
    - **Property 12: No standalone MapPreview in DeliveryHomeTab**
    - For any render of `DeliveryHomeTab` with any state, assert the standalone `MapPreview` component is not present in the rendered output
    - **Validates: Requirements 10.4, 10.5**

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all unit tests, property tests, and integration tests pass. Verify TypeScript compiles with no errors across all modified files. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Execution order is strict: Layer 1 (hooks) → Layer 2 (leaf components) → Layer 3 (StateCard) → Layer 4 (orchestrator)
- Each task references specific requirements for traceability
- Property tests use `fast-check` and run a minimum of 100 iterations each
- All property tests are tagged: `Feature: delivery-mobile-web-parity, Property {N}: {property_text}`
- The `OFFLINE` state and `OfflineCard` are removed entirely — the web dashboard has no offline state
- No new API endpoints are needed; all required endpoints already exist in `deliveryApi.ts`
