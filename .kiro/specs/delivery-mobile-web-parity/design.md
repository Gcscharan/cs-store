# Design Document: Delivery Mobile–Web Parity

## Overview

This is a **system-alignment task**. The mobile delivery app (`DeliveryHomeTab` and its sub-components) must be brought into full functional parity with the web dashboard (`EnhancedHomeTab`). The web dashboard is the single source of truth. No new features are introduced; every change is a correction to match existing web behaviour.

The key gaps to close are:

| Gap | Current Mobile | Web (Source of Truth) |
|-----|---------------|----------------------|
| Order bucketing | `stableActiveOrder` pattern, `newOrders` concept | `availableOrders` (created only) + `activeOrders` (full list) |
| Active order display | Single order | All active orders as a list |
| Progress bar | 5-step timeline | 3-segment bar (Assigned / Picked Up / In Transit) |
| OTP gate | Shown on `arrived` status | Shown only after `deliveryAttempted === true` |
| COD gate | Local `codCollected` state | Fetched from backend per order |
| NewOrderCard | Countdown timer, first order only | No timer, all available orders |
| IdleCard | Shows ₹0, 0 deliveries, rating, motivation | "No Active Orders" + conditional earnings only |
| ControlBar | Greeting + zone label | Online/offline toggle + conditional earnings |
| Non-web elements | PerformancePanel, MapPreview, Help/Issue buttons | None of these on home screen |

---

## Architecture

The change is confined to the delivery feature slice. No new API endpoints are needed — all required endpoints already exist in `deliveryApi.ts`.

```
DeliveryHomeTab (screen orchestrator)
├── ConnectionBanner          [unchanged]
├── ControlBar                [props change: remove name/zone, add earnings]
├── ScrollView
│   └── StateCard             [props change: activeOrders[], availableOrders[]]
│       ├── IdleCard          [rewrite: no zero stats]
│       ├── NewOrderCard      [rewrite: no timer, all orders]
│       └── ActiveOrderCard   [full rewrite: multi-order, new props]
└── Modals (COD, Fail)        [unchanged]
```

**Removed from render tree:**
- `PerformancePanel`
- standalone `MapPreview`
- `QuickActions` Help/Issue buttons (keep Go Online/Offline toggle only, or remove QuickActions entirely)

**Data flow change:**

```
useOrders (rewritten)
  → availableOrders: Order[]   (status === "created")
  → activeOrders: Order[]      (status in active set)

useDeliveryState (rewritten)
  → state: ACTIVE_DELIVERY | NEW_ORDER | IDLE
  → activeOrders: Order[]
  → availableOrders: Order[]

useDashboardData (updated)
  → removes primaryOrder / showMap (no longer needed)
  → passes through activeOrders / availableOrders
```

---

## Components and Interfaces

### 1. `useOrders` hook — rewritten bucketing

**File:** `apps/customer-app/src/hooks/delivery/useOrders.ts`

```typescript
export const AVAILABLE_STATUSES = ['created'] as const;

export const ACTIVE_STATUSES = [
  'confirmed', 'packed', 'assigned', 'picked_up',
  'in_transit', 'out_for_delivery', 'arrived', 'cancelled',
] as const;

export interface UseOrdersResult {
  orders: Order[];
  deliveryBoy: DeliveryBoy | null;
  availableOrders: Order[];   // replaces newOrders
  activeOrders: Order[];      // replaces single activeOrder
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
}
```

**Changes:**
- Remove `stableActiveOrder` state and `useEffect` that maintained it.
- Remove `newOrders` export.
- `availableOrders = orders.filter(o => o.orderStatus.toLowerCase() === 'created')`
- `activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.orderStatus.toLowerCase()))`
- Both arrays are derived directly from the query result with no stabilisation layer.

---

### 2. `useDeliveryState` hook — rewritten state machine

**File:** `apps/customer-app/src/hooks/delivery/useDeliveryState.ts`

```typescript
export type DeliveryState = 'IDLE' | 'NEW_ORDER' | 'ACTIVE_DELIVERY';
// OFFLINE removed — web has no OFFLINE state; availability toggle is in ControlBar

export interface DeliveryStateResult {
  state: DeliveryState;
  activeOrders: Order[];       // replaces activeOrder: Order | null
  availableOrders: Order[];    // replaces newOrders: Order[]
  isOnline: boolean;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
  deliveryBoy: DeliveryBoy | null;
}
```

**State machine logic (exact match to web):**
```typescript
const state: DeliveryState =
  activeOrders.length > 0  ? 'ACTIVE_DELIVERY' :
  availableOrders.length > 0 ? 'NEW_ORDER' :
  'IDLE';
```

Note: `OFFLINE` is removed. The web dashboard does not have an offline state — it simply shows the availability toggle in the header. The mobile `OfflineCard` component is no longer rendered by `StateCard`.

---

### 3. `useDashboardData` hook — updated

**File:** `apps/customer-app/src/hooks/delivery/useDashboardData.ts`

```typescript
export interface DashboardData extends DeliveryStateResult {
  motivation: string;  // kept for potential future use but not rendered on home
}
```

**Changes:**
- Remove `primaryOrder` (no standalone MapPreview needs it).
- Remove `showMap` (no standalone MapPreview).
- Pass through `activeOrders` and `availableOrders` from `useDeliveryState`.

---

### 4. `DeliveryHomeTab` — orchestrator changes

**File:** `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx`

**New state:**
```typescript
// Per-order delivery attempt tracking (replaces Set<string>)
const [deliveryAttempted, setDeliveryAttempted] =
  useState<Record<string, boolean>>({});

// Per-order COD collection cache (fetched from backend)
const [codCollectionByOrderId, setCodCollectionByOrderId] =
  useState<Record<string, CodCollection | null | undefined>>({});

// OTP inputs remain per-order
const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
```

**New functions:**
```typescript
// Fetch COD collection status from backend for a single order
const fetchCodCollection = async (orderId: string): Promise<void> => {
  try {
    const result = await getCodCollection(orderId).unwrap();
    setCodCollectionByOrderId(prev => ({ ...prev, [orderId]: result?.codCollection ?? null }));
  } catch {
    setCodCollectionByOrderId(prev => ({ ...prev, [orderId]: null }));
  }
};

// Called when "Start Delivery Attempt" is tapped
const handleStartDeliveryAttempt = async (orderId: string): Promise<void> => {
  try {
    await deliverAttempt(orderId).unwrap();
    setDeliveryAttempted(prev => ({ ...prev, [orderId]: true }));
  } catch (error: any) {
    Alert.alert('Error', error?.data?.error || 'Failed to start delivery attempt');
  }
};

// Called when COD collection is confirmed
const handleCollectCOD = async (orderId: string, mode: 'CASH' | 'UPI'): Promise<void> => {
  const idempotencyKey = `cod_collection_idem_${orderId}`;
  try {
    const result = await createCodCollection({ orderId, mode, idempotencyKey }).unwrap();
    setCodCollectionByOrderId(prev => ({
      ...prev,
      [orderId]: result?.codCollection ?? null,
    }));
  } catch (error: any) {
    Alert.alert('Error', error?.data?.error || 'Failed to record payment');
  }
};
```

**Effect to refresh COD collections when active orders change:**
```typescript
useEffect(() => {
  activeOrders.forEach(order => {
    const isCod = order.paymentMethod?.toLowerCase() === 'cod';
    const hasArrived = !!order.arrivedAt;
    if (isCod && hasArrived && !(order._id in codCollectionByOrderId)) {
      fetchCodCollection(order._id);
    }
  });
}, [activeOrders]);
```

**Removed from render:**
- `<PerformancePanel ... />`
- `{showMap && primaryOrder && <MapPreview ... />}`
- `<QuickActions ... />` Help and Issue buttons (keep only the online/offline toggle if QuickActions is retained, or remove the component entirely)

**Updated `StateCard` call:**
```typescript
<StateCard
  state={state}
  activeOrders={activeOrders}
  availableOrders={availableOrders}
  deliveryBoy={deliveryBoy}
  deliveryAttempted={deliveryAttempted}
  codCollectionByOrderId={codCollectionByOrderId}
  otpInputs={otpInputs}
  onOtpChange={(orderId, value) =>
    setOtpInputs(prev => ({ ...prev, [orderId]: value }))
  }
  onToggleOnline={handleToggleStatus}
  onAccept={handleAcceptOrder}
  onReject={handleRejectOrder}
  onPickup={handlePickup}
  onStartDelivery={handleStartDelivery}
  onMarkArrived={handleMarkArrived}
  onStartDeliveryAttempt={handleStartDeliveryAttempt}
  onVerifyOtp={handleVerifyOtp}
  onCollectCOD={handleCollectCOD}
  onFailDelivery={handleFailDelivery}
/>
```

**Updated `ControlBar` call:**
```typescript
<ControlBar
  isOnline={isOnline}
  earnings={deliveryBoy?.earnings ?? 0}
  onToggleOnline={handleToggleStatus}
  isToggling={isToggling}
/>
```

---

### 5. `StateCard` — updated props

**File:** `apps/customer-app/src/components/delivery/StateCard/StateCard.tsx`

```typescript
interface StateCardProps {
  state: DeliveryState;                                          // 'IDLE' | 'NEW_ORDER' | 'ACTIVE_DELIVERY'
  activeOrders: Order[];
  availableOrders: Order[];
  deliveryBoy: DeliveryBoy | null;
  deliveryAttempted: Record<string, boolean>;
  codCollectionByOrderId: Record<string, CodCollection | null | undefined>;
  otpInputs: Record<string, string>;
  onOtpChange: (orderId: string, value: string) => void;
  onToggleOnline: () => void;
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
  onPickup: (orderId: string) => void;
  onStartDelivery: (orderId: string) => void;
  onMarkArrived: (orderId: string) => void;
  onStartDeliveryAttempt: (orderId: string) => void;
  onVerifyOtp: (orderId: string, otp: string) => void;
  onCollectCOD: (orderId: string, mode: 'CASH' | 'UPI') => void;
  onFailDelivery: (orderId: string) => void;
}
```

`OFFLINE` case is removed from the switch. `OfflineCard` is no longer rendered.

---

### 6. `ActiveOrderCard` — full rewrite

**File:** `apps/customer-app/src/components/delivery/StateCard/ActiveOrderCard.tsx`

```typescript
interface ActiveOrderCardProps {
  activeOrders: Order[];
  deliveryAttempted: Record<string, boolean>;
  codCollectionByOrderId: Record<string, CodCollection | null | undefined>;
  otpInputs: Record<string, string>;
  onOtpChange: (orderId: string, value: string) => void;
  onPickup: (orderId: string) => void;
  onStartDelivery: (orderId: string) => void;
  onMarkArrived: (orderId: string) => void;
  onStartDeliveryAttempt: (orderId: string) => void;
  onVerifyOtp: (orderId: string, otp: string) => void;
  onCollectCOD: (orderId: string, mode: 'CASH' | 'UPI') => void;
  onFailDelivery: (orderId: string) => void;
  onNavigate: (order: Order) => void;
}
```

**Per-order rendering logic (exact match to web):**
```typescript
const renderOrder = (order: Order) => {
  const status = order.orderStatus.toLowerCase();
  const isCod = order.paymentMethod?.toLowerCase() === 'cod';
  const hasArrived = !!order.arrivedAt;
  const codCollection = codCollectionByOrderId[order._id];
  const codCollected = !!codCollection;
  const canSendOtp = hasArrived && (!isCod || codCollected);
  const canShowCancelButton =
    (status === 'in_transit' || status === 'out_for_delivery') &&
    hasArrived;
  const isDeliveryAttempted = deliveryAttempted[order._id] ?? false;
  const isCancelled = status === 'cancelled';
  // ...
};
```

**Progress bar — 3 segments (exact match to web):**
```typescript
const PROGRESS_STEPS = ['Assigned', 'Picked Up', 'In Transit'] as const;

// Segment fill rules (matching web EnhancedHomeTab):
// segment 0 filled: assigned, picked_up, in_transit, out_for_delivery
// segment 1 filled: picked_up, in_transit, out_for_delivery
// segment 2 filled: in_transit, out_for_delivery
const isSegmentFilled = (segmentIndex: number, status: string): boolean => {
  switch (segmentIndex) {
    case 0: return ['assigned','picked_up','in_transit','out_for_delivery'].includes(status);
    case 1: return ['picked_up','in_transit','out_for_delivery'].includes(status);
    case 2: return ['in_transit','out_for_delivery'].includes(status);
    default: return false;
  }
};
```

**Payment status badge (exact match to web `getPaymentStatusColor`):**
```typescript
const getPaymentBadge = (paymentStatus: string) => {
  const s = paymentStatus?.toLowerCase();
  if (s === 'paid')
    return { label: 'Paid', color: DELIVERY_COLORS.success, bg: DELIVERY_COLORS.successBg };
  if (s === 'awaiting_upi_approval')
    return { label: 'Awaiting UPI Approval', color: DELIVERY_COLORS.warning, bg: DELIVERY_COLORS.warningBg };
  return { label: 'Pending', color: DELIVERY_COLORS.textSecondary, bg: DELIVERY_COLORS.cardElevated };
};
```

**Navigate to Location (inside card, not standalone MapPreview):**
```typescript
const openNavigation = (order: Order) => {
  const lat = order.address?.lat;
  const lng = order.address?.lng;
  if (lat && lng) {
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  } else {
    Alert.alert('Error', 'Location not available for this order');
  }
};
```

**Action button logic per status (exact match to web):**

| Status | `deliveryStatus` | Button shown |
|--------|-----------------|--------------|
| `assigned` | not `unassigned` | "Mark as Picked Up" |
| `assigned` | `unassigned` | Warning message, no button |
| `picked_up` | any | "Start Delivery" |
| `packed` | any | "Start Delivery" |
| `in_transit` | any | `!arrivedAt` → "Mark as Arrived" |
| `in_transit` | any | `canSendOtp && !isDeliveryAttempted` → "Start Delivery Attempt" |
| `in_transit` | any | `isDeliveryAttempted` → OTP input + "Verify OTP & Complete" |
| `in_transit` | any | `canShowCancelButton` → "Customer Not Available" (full-width warning button) |
| `cancelled` | any | Cancellation summary, no action buttons |

**COD gate (exact match to web):**
- When `isCod && hasArrived && !codCollected`: show "Collect Cash" + "Collect UPI" buttons; hide "Start Delivery Attempt"
- When `isCod && hasArrived && codCollected`: show "Payment Collected" banner with mode; show "Start Delivery Attempt"

**Render structure:**
```typescript
export const ActiveOrderCard: React.FC<ActiveOrderCardProps> = ({ activeOrders, ... }) => (
  <View>
    {activeOrders.map(order => (
      <SingleActiveOrderCard key={order._id} order={order} {...perOrderProps} />
    ))}
  </View>
);
```

---

### 7. `NewOrderCard` — rewrite

**File:** `apps/customer-app/src/components/delivery/StateCard/NewOrderCard.tsx`

```typescript
interface NewOrderCardProps {
  availableOrders: Order[];   // renamed from newOrders; shows ALL orders
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
}
```

**Changes:**
- Remove `countdown` state and `useEffect` timer entirely.
- Remove `timerBadge` UI element.
- Map over all `availableOrders` (not just `[0]`).
- Per-order card shows: order ID (last 6), amount, customer name, phone, address, Accept + Decline buttons.
- Matches web's "New Requests" section exactly.

---

### 8. `IdleCard` — rewrite

**File:** `apps/customer-app/src/components/delivery/StateCard/IdleCard.tsx`

```typescript
interface IdleCardProps {
  earnings: number;
  onRefresh: () => void;
}
```

**Changes (exact match to web idle state):**
- Title: "No Active Orders"
- Subtitle: "Stay online to receive delivery requests"
- Show `earnings` value only when `earnings > 0`
- Show Refresh button
- Remove: deliveries count, rating, motivation text, "₹0" label, wait time estimate

---

### 9. `ControlBar` — updated props

**File:** `apps/customer-app/src/components/delivery/ControlBar/ControlBar.tsx`

```typescript
interface ControlBarProps {
  isOnline: boolean;
  earnings: number;           // show only when > 0
  onToggleOnline: () => void;
  isToggling: boolean;
  // Removed: name, zone, batteryLevel, networkQuality
}
```

**Changes:**
- Remove greeting text (`getGreeting()` function and display).
- Remove zone/area label row.
- Remove `name` prop.
- Show earnings row only when `earnings > 0`.
- Keep online/offline toggle chip.

---

## Data Models

### `CodCollection` (mobile, matching web)

```typescript
type CodCollection = {
  _id: string;
  orderId: string;
  mode: 'CASH' | 'UPI';
  amount: number;
  currency: string;
  collectedAt: string;
  idempotencyKey: string;
};
```

### `Order` (existing, no changes to type)

The existing `Order` type in `apps/customer-app/src/utils/deliveryUtils.ts` already has all required fields. Key fields used in parity logic:

```typescript
interface Order {
  _id: string;
  orderStatus: string;
  deliveryStatus: string;
  paymentMethod: string;       // 'cod' | 'prepaid' | ...
  paymentStatus: string;       // 'paid' | 'awaiting_upi_approval' | 'pending' | ...
  totalAmount: number;
  arrivedAt?: string;          // set when Mark as Arrived is called
  cancelledAt?: string;
  cancelReason?: string;
  failureReasonCode?: string;
  userId: { name: string; phone: string; };
  address: {
    addressLine: string;
    city: string;
    pincode: string;
    lat?: number;
    lng?: number;
  };
}
```

### State machine transitions

```
API response
    │
    ├─ orders where status === "created"  ──→  availableOrders[]
    └─ orders where status in ACTIVE_SET  ──→  activeOrders[]

activeOrders.length > 0          → DeliveryState = ACTIVE_DELIVERY
activeOrders.length === 0
  && availableOrders.length > 0  → DeliveryState = NEW_ORDER
else                             → DeliveryState = IDLE
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Order bucketing is a partition

*For any* array of orders with arbitrary statuses, the `availableOrders` bucket contains exactly those orders where `orderStatus === "created"`, and the `activeOrders` bucket contains exactly those orders where `orderStatus` is in the active set. The two buckets are disjoint and together cover all non-delivered, non-rejected orders.

**Validates: Requirements 1.1, 1.2, 1.5**

---

### Property 2: State machine correctness

*For any* combination of `activeOrders` and `availableOrders` arrays, the derived `DeliveryState` satisfies: `ACTIVE_DELIVERY` iff `activeOrders.length > 0`; `NEW_ORDER` iff `activeOrders.length === 0 && availableOrders.length > 0`; `IDLE` iff both arrays are empty.

**Validates: Requirements 1.6, 1.7**

---

### Property 3: All active orders are rendered

*For any* array of N active orders passed to `ActiveOrderCard`, exactly N order cards are rendered in the output.

**Validates: Requirements 1.3, 1.6**

---

### Property 4: OTP gate — deliveryAttempted controls OTP visibility

*For any* order and any value of `deliveryAttempted[orderId]`, the OTP input section is rendered if and only if `deliveryAttempted[orderId] === true`.

**Validates: Requirements 3.3, 3.4, 3.6**

---

### Property 5: COD gate — no "Start Delivery Attempt" before collection

*For any* COD order where `arrivedAt` is set and `codCollectionByOrderId[orderId]` is `null` or `undefined`, the "Start Delivery Attempt" button is not rendered.

**Validates: Requirements 4.1, 4.2**

---

### Property 6: No zero stats displayed

*For any* earnings value, the earnings display is rendered if and only if `earnings > 0`. This holds in both `IdleCard` and `ControlBar`.

**Validates: Requirements 8.3, 8.4, 9.2, 9.3**

---

### Property 7: Progress bar always has exactly 3 segments

*For any* order status value, the progress bar rendered inside an active order card contains exactly 3 segments with labels "Assigned", "Picked Up", "In Transit".

**Validates: Requirements 7.1, 7.2**

---

### Property 8: Progress bar fill state matches status

*For any* order status, the fill state of each of the 3 progress segments matches the web mapping: segment 0 filled for `{assigned, picked_up, in_transit, out_for_delivery}`; segment 1 filled for `{picked_up, in_transit, out_for_delivery}`; segment 2 filled for `{in_transit, out_for_delivery}`.

**Validates: Requirements 7.3, 7.4, 7.5**

---

### Property 9: Payment status badge is a pure function of paymentStatus

*For any* `paymentStatus` string, the rendered badge label is: `"Paid"` when `paymentStatus === "paid"`, `"Awaiting UPI Approval"` when `paymentStatus === "awaiting_upi_approval"`, and `"Pending"` for all other values.

**Validates: Requirements 12.2, 12.3, 12.4**

---

### Property 10: All available orders are rendered in NewOrderCard

*For any* array of N available orders passed to `NewOrderCard`, exactly N order cards are rendered.

**Validates: Requirements 11.8**

---

### Property 11: No countdown timer in NewOrderCard

*For any* render of `NewOrderCard` with any available orders array, no timer or countdown element is present in the rendered output.

**Validates: Requirements 10.3, 11.7**

---

### Property 12: No standalone MapPreview in DeliveryHomeTab

*For any* render of `DeliveryHomeTab` with any state, the standalone `MapPreview` component is not present in the rendered output.

**Validates: Requirements 10.4, 10.5**

---

## Error Handling

### API failures

- `fetchCodCollection` failure: set `codCollectionByOrderId[orderId] = null` (treat as not collected). This is the safe default — it prevents the OTP gate from being bypassed.
- `handleStartDeliveryAttempt` failure: do not set `deliveryAttempted[orderId] = true`. Show `Alert` with error message.
- `handleCollectCOD` failure: do not update `codCollectionByOrderId`. Show `Alert` with error message.
- All existing action handlers (`handleAcceptOrder`, `handlePickup`, etc.) retain their current error handling and offline queue logic.

### Navigation failure

```typescript
const openNavigation = (order: Order) => {
  const lat = order.address?.lat;
  const lng = order.address?.lng;
  if (lat && lng) {
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  } else {
    Alert.alert('Error', 'Location not available for this order');
  }
};
```

### State consistency after OTP verification

When `handleVerifyOtp` succeeds:
1. Reset `deliveryAttempted[orderId] = false`
2. Clear `otpInputs[orderId] = ''`
3. Call `refetch()` to update order list

---

## Testing Strategy

### Unit tests (example-based)

Each action button condition is tested with concrete status values:

- `status === "assigned"` + `deliveryStatus !== "unassigned"` → "Mark as Picked Up" shown
- `status === "assigned"` + `deliveryStatus === "unassigned"` → warning shown, no button
- `status === "picked_up"` → "Start Delivery" shown
- `status === "packed"` → "Start Delivery" shown
- `status === "in_transit"` + `!arrivedAt` → "Mark as Arrived" shown
- `status === "in_transit"` + `arrivedAt` + `!isCod` + `!isDeliveryAttempted` → "Start Delivery Attempt" shown
- `status === "in_transit"` + `arrivedAt` + `isCod` + `!codCollected` → COD buttons shown, no "Start Delivery Attempt"
- `status === "cancelled"` → cancellation summary, no action buttons

### Property-based tests

Using a property-based testing library (e.g., `fast-check` for TypeScript/Jest):

Each property test runs a minimum of 100 iterations.

**Tag format:** `Feature: delivery-mobile-web-parity, Property {N}: {property_text}`

- **Property 1** — Generate random order arrays with arbitrary statuses; assert bucketing invariant holds.
- **Property 2** — Generate random `(activeOrders, availableOrders)` pairs; assert state machine output.
- **Property 3** — Generate N active orders (N from 1–10); assert rendered card count === N.
- **Property 4** — Generate random `(order, deliveryAttempted)` pairs; assert OTP section visibility.
- **Property 5** — Generate random COD orders with `arrivedAt` set and no codCollection; assert "Start Delivery Attempt" absent.
- **Property 6** — Generate random earnings values (including 0, negative, large); assert display conditional on `> 0`.
- **Property 7** — Generate random order status strings; assert exactly 3 segments rendered.
- **Property 8** — Generate random status from the known set; assert fill state matches mapping table.
- **Property 9** — Generate random `paymentStatus` strings; assert badge label matches mapping.
- **Property 10** — Generate N available orders; assert N cards rendered in `NewOrderCard`.
- **Property 11** — Generate random available orders; assert no timer element present.
- **Property 12** — Generate random `DeliveryHomeTab` state; assert no standalone `MapPreview` present.

### Integration tests

- COD collection fetch: verify `GET /delivery/orders/:id/cod-collection` is called for each COD order with `arrivedAt` set when active orders change.
- Delivery attempt: verify `POST /delivery/orders/:id/deliver` is called when "Start Delivery Attempt" is tapped, and `deliveryAttempted` is set to `true` on success.

### Files modified

| File | Change type |
|------|-------------|
| `apps/customer-app/src/hooks/delivery/useOrders.ts` | Rewrite bucketing logic |
| `apps/customer-app/src/hooks/delivery/useDeliveryState.ts` | Rewrite state machine, remove OFFLINE |
| `apps/customer-app/src/hooks/delivery/useDashboardData.ts` | Remove primaryOrder/showMap |
| `apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx` | Remove non-web elements, add new state |
| `apps/customer-app/src/components/delivery/StateCard/StateCard.tsx` | Update props interface |
| `apps/customer-app/src/components/delivery/StateCard/ActiveOrderCard.tsx` | Full rewrite |
| `apps/customer-app/src/components/delivery/StateCard/NewOrderCard.tsx` | Remove timer, show all orders |
| `apps/customer-app/src/components/delivery/StateCard/IdleCard.tsx` | Remove zero stats |
| `apps/customer-app/src/components/delivery/ControlBar/ControlBar.tsx` | Remove greeting/zone |
