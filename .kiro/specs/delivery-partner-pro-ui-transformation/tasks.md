# Delivery Partner Pro UI - Implementation Tasks

## Task Overview

Transform `DeliveryHomeTab.tsx` from a 1253-line monolith into a clean, modular, multi-section UI matching web parity. All existing API hooks are reused — this is a pure UI transformation.

**Execution order is strict** — each layer depends on the one before it.

---

- [x] 1. Foundation — design tokens and utilities
  - [x] 1.1 Create `src/constants/deliveryTheme.ts` with DELIVERY_COLORS, DELIVERY_TYPOGRAPHY, DELIVERY_SPACING, DELIVERY_RADIUS, DELIVERY_SHADOW constants
  - [x] 1.2 Create `src/utils/deliveryUtils.ts` with: haversineDistance, estimateETA, getOrderPriority (HIGH/NORMAL badge), getMotivationMessage (zero-state fix), getStatusConfig

- [x] 2. State engine — hooks
  - [x] 2.1 Create `src/hooks/delivery/useOrders.ts` — wraps useGetDeliveryOrdersQuery, exposes orders, deliveryBoy, availableOrders[] (status === 'created'), activeOrders[] (status in active set)
  - [x] 2.2 Create `src/hooks/delivery/useDeliveryState.ts` — returns DeliveryState (IDLE/NEW_ORDER/ACTIVE_DELIVERY, no OFFLINE), activeOrders[], availableOrders[] arrays, no single-state exclusivity
  - [x] 2.3 Create `src/hooks/delivery/useDashboardData.ts` — derived data layer: passes through activeOrders, availableOrders, motivation message

- [x] 3. ControlBar component
  - [x] 3.1 Create `src/components/delivery/ControlBar/ControlBar.tsx` — online status toggle (large pressable chip), earnings display (only when > 0), no greeting/zone/battery/network, accepts `isToggling` prop to disable during API call

- [x] 4. Card components
  - [x] 4.1 Create `src/components/delivery/IdleCard/IdleCard.tsx` — "No Active Orders" message, earnings (only when > 0), refresh button, no zero stats/deliveries count/rating/motivation
  - [x] 4.2 Create `src/components/delivery/NewOrderCard/NewOrderCard.tsx` — maps over availableOrders[] array, NO countdown timer, shows all orders, Accept/Decline buttons
  - [x] 4.3 Create `src/components/delivery/ActiveOrderCard/ActiveOrderCard.tsx` — maps over activeOrders[] array, 3-step progress bar (Assigned/Picked Up/In Transit), "Navigate to Location" button inside card, payment status badge, web parity action button logic, inline COD banner, inline OTP section with 4 digit boxes and auto-focus

- [x] 5. PerformancePanel component
  - [x] 5.1 Create `src/components/delivery/PerformancePanel/PerformancePanel.tsx` — today section (earnings in gold, deliveries, rating), weekly summary row, motivation message, NOTE: for Earnings tab ONLY, not rendered on home screen

- [x] 6. Rewrite DeliveryHomeTab orchestrator
  - [x] 6.1 Rewrite `src/screens/delivery/DeliveryHomeTab.tsx` as thin orchestrator (~150 lines): multi-section render (not StateCard), uses useDashboardData, local isToggling state with guard, renders ControlBar + conditional sections (availableOrders section + activeOrders section + idle section), removes PerformancePanel/MapPreview/QuickActions from home, keeps all existing action handlers (accept/reject/pickup/startDelivery/markArrived/startDeliveryAttempt/verifyOtp/collectCOD/failDelivery), keeps COD and fail modals

- [x] 7. Update tab bar
  - [x] 7.1 Update `src/screens/delivery/DeliveryDashboardScreen.tsx` — apply dark theme colors from deliveryTheme, rename DeliveryHome tab to Orders, remove DeliveryNotifications tab, set initialRouteName="Orders", update tab bar height to 72dp, apply elevation 20, update icon set (receipt-outline/cash-outline/person-circle-outline), add focused state size animation, add active background glow

- [x] 8. Update DeliveryEarningsTab
  - [x] 8.1 Add PerformancePanel to DeliveryEarningsTab — import and render PerformancePanel component (moved from home screen)
