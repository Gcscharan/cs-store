# Design Document — Driver UX Phase 5

## Overview

Phase 5 polishes the driver-facing delivery interface so that the driver's current state, next stop, route progress, and failure flows are immediately obvious under real delivery pressure. The work is purely additive UX on top of the existing `useRouteArrangement` hook and `ActiveOrderCard` component — no backend changes, no new API endpoints.

The core design principle is **invariant-first rendering**: every visual element is derived deterministically from `sortedOrderIds` and `currentOrderId`. There is no local "selected" state in the UI layer; the hook is the single source of truth.

### Goals

- One card always looks dominant (current stop) — no ambiguity about where to go next.
- Route progress is always arithmetically consistent — `completedCount + remainingCount === totalStops`.
- Distance and ETA never jump upward while the driver is moving toward a stop.
- Failure flows are gated behind a reason-selection modal — no accidental cancellations.
- Locked future stops are visually suppressed and touch-blocked.
- A syncing skeleton replaces blank action buttons while server state is in flight.
- Route order is frozen after arrangement — the list never reshuffles under the driver's hands.

---

## Architecture

The feature is a pure React Native UI layer. No new backend services are introduced.

```
DeliveryHomeTab
├── ConnectionBanner          (existing — offline/socket status)
├── ControlBar                (existing — online toggle, earnings)
├── NewOrderCard              (existing — available orders)
└── ActiveOrderCard           (extended)
    ├── RouteProgressHeader   (new component — completedCount, remainingCount, dots)
    └── SingleOrderCard[]     (extended)
        ├── CurrentStrip      (new — shown on isCurrent card)
        ├── NextStrip         (new — shown on stopIndex === 2 card)
        ├── SyncingSkeleton   (existing — shown when allowedActions === undefined)
        └── FailureModal      (existing — extended with notes trimming)
```

Data flow:

```
useRouteArrangement(activeOrders)
  → sortedOrderIds, currentOrderId, isArranged
  → isOrderCurrent(id), isOrderLocked(id)
  → driverLocation (throttled, 1 s)

useDistanceEta(driverLocation, order.address)
  → distanceKm, etaMinutes (haversine, ±5% jitter guard, +10% ETA cap)

ActiveOrderCard
  → derives completedCount = sortedOrderIds.indexOf(currentOrderId)
  → derives remainingCount = totalStops - completedCount
  → renders RouteProgressHeader
  → renders SingleOrderCard per displayOrder
      → passes isCurrent, isLocked, stopIndex, totalStops, distanceKm
```

---

## Components and Interfaces

### `RouteProgressHeader`

Shown above the order list when `isArranged === true && totalStops > 0`.

```tsx
interface RouteProgressHeaderProps {
  completedCount: number;   // sortedOrderIds.indexOf(currentOrderId)
  remainingCount: number;   // totalStops - completedCount
  totalStops: number;
  orders: Order[];          // in sorted display order
  isOrderCurrent: (id: string) => boolean;
  currentIndex: number;     // index of current order in displayOrders
}
```

Renders:
- Left: `"{remainingCount} stop{s} remaining"` + `"{completedCount} of {totalStops} completed"`
- Right: one dot per stop — `routeDotDone` (i < currentIndex), `routeDotCurrent` (i === currentIndex), `routeDot` (i > currentIndex)

### `CurrentStrip`

Rendered at the top of the card when `isCurrent === true`.

```tsx
interface CurrentStripProps {
  stopIndex: number;
  totalStops: number;
  distanceKm: number | null;
}
```

Displays: `"DELIVERING NOW · Stop N of M"` + distance/ETA when available.

### `NextStrip`

Rendered at the top of the card when `stopIndex === 2` and `!isCurrent && !isLocked`.

```tsx
interface NextStripProps {
  distanceKm: number | null;
}
```

Displays: `"UP NEXT"` + distance when available.

### `SyncingSkeleton`

Rendered in place of action buttons when `allowedActions === undefined`.

```tsx
// No props — pure presentational
const SyncingSkeleton: React.FC = () => (
  <View style={styles.syncingContainer}>
    <ActivityIndicator size="small" color={DELIVERY_COLORS.primary} />
    <Text style={styles.syncingText}>Syncing state...</Text>
  </View>
);
```

### `useDistanceEta` hook

Encapsulates haversine calculation with jitter guard and ETA cap.

```ts
interface UseDistanceEtaOptions {
  driverLocation: { lat: number; lng: number } | null;
  address: { lat?: number; lng?: number } | null;
}

interface DistanceEtaResult {
  distanceKm: number | null;   // null when coords invalid
  etaMinutes: number | null;   // null when distanceKm is null
  formattedDistance: string | null;
  formattedEta: string | null;
}

function useDistanceEta(options: UseDistanceEtaOptions): DistanceEtaResult
```

Internal logic:
1. Validate coords — return nulls if `driverLocation` is null or address lat/lng are 0 or out of range.
2. Compute `rawKm = haversineKm(...)`.
3. Apply jitter guard: if `rawKm > prevKm * 1.05`, use `rawKm`; otherwise use `min(rawKm, prevKm)`.
4. Compute `rawEta = (distanceKm / 25) * 60`.
5. Apply ETA cap: if `rawEta > prevEta * 1.10` and `distanceKm <= prevKm * 1.05`, clamp to `prevEta * 1.10`.
6. Format using `formatDistance` and `formatEta`.

The hook does **not** throttle — throttling is handled upstream by `useRouteArrangement`'s 1 s subscription gate on `driverLocationStore`.

### `FailureModal` (extended)

Existing modal extended with:
- Notes trimming: `failNotes.trim()` before submission; if result is empty string, pass `undefined`.
- Confirm button disabled until `selectedReason !== ''`.
- `maxLength={200}` on the notes `TextInput`.

### `SingleOrderCard` (extended props)

```tsx
interface SingleOrderCardProps {
  // ... existing props ...
  stopIndex?: number;     // 1-based position in route
  totalStops?: number;
  distanceKm?: number | null;   // pre-computed by parent
}
```

Card container style: `[styles.card, isCurrent && styles.cardCurrent, isLocked && styles.cardLocked]`

Touch blocking for locked orders: wrap card in `<View pointerEvents={isLocked ? 'none' : 'auto'}>`.

### `ActiveOrderCard` (extended)

Derives progress counts before rendering:

```ts
const currentIndex = displayOrders.findIndex(o => isOrderCurrent?.(o._id));
const completedCount = currentIndex >= 0 ? currentIndex : 0;
const remainingCount = totalStops - completedCount;
// Invariant: completedCount + remainingCount === totalStops (always true by construction)
```

Ghost-order guard — `currentOrderId` is already derived in `useRouteArrangement` from the intersection of `sortedOrderIds` and live `activeOrders`. The UI does not need to re-derive this; it trusts the hook.

---

## Data Models

### Route State (persisted to AsyncStorage)

| Key | Type | Description |
|-----|------|-------------|
| `@delivery_sorted_orders` | `string[]` (JSON) | Frozen order of stop IDs after arrangement |
| `@delivery_current_order` | `string` | ID of the stop currently being delivered |
| `@delivery_route_arranged` | `"true"` / absent | Whether the route is in arranged+frozen state |

Persistence contract:
- Written atomically (all three keys in a single `Promise.all`) on `arrangeRoute` and `resetArrangement`.
- Read on mount via `Promise.all` — if any key is missing, the hook starts in unarranged state.
- `driverLocation` is **not** persisted — it is always live from `driverLocationStore`.

### Order (relevant fields for Phase 5)

```ts
interface Order {
  _id: string;
  orderStatus: string;
  allowedActions?: string[];   // undefined = server response not yet arrived
  address: {
    lat?: number;
    lng?: number;
    addressLine?: string;
    city?: string;
    pincode?: string;
  };
  // ... other fields unchanged
}
```

`allowedActions` being `undefined` (field absent) vs `[]` (empty array) is a meaningful distinction:
- `undefined` → server response not yet arrived → show `SyncingSkeleton`
- `[]` → server says no actions permitted → show nothing (no skeleton)

### Failure Reason

```ts
export const FAILURE_REASONS = [
  { key: 'CUSTOMER_NOT_AVAILABLE', label: 'Customer not reachable' },
  { key: 'ADDRESS_ISSUE',          label: 'Address incorrect' },
  { key: 'CUSTOMER_REJECTED',      label: 'Customer refused delivery' },
] as const;

export type FailureReasonKey = typeof FAILURE_REASONS[number]['key'];
```

Submission payload:

```ts
{
  orderId: string;
  status: 'FAILED';
  failureReason: FailureReasonKey;
  failureNotes?: string;   // trimmed; absent if whitespace-only
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Single-Current Invariant

*For any* arranged route with one or more active orders, exactly one order shall have `isOrderCurrent(id) === true`, and that order shall be `sortedOrderIds[0]` (after filtering for orders still present in `activeOrders`). No order that is locked (`isOrderLocked(id) === true`) shall simultaneously be current.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 6.4**

### Property 2: Progress Consistency

*For any* arranged route state with `totalStops > 0`, the values `completedCount` and `remainingCount` derived from `sortedOrderIds` and `currentOrderId` shall satisfy `completedCount + remainingCount === totalStops` on every render, where `completedCount = sortedOrderIds.indexOf(currentOrderId)` and `remainingCount = totalStops - completedCount`.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 3: ETA Monotonicity

*For any* sequence of driver location updates where the haversine distance to the current stop does not increase by more than 5% between consecutive updates, the computed ETA shall not increase by more than 10% between those same consecutive updates.

**Validates: Requirements 3.1, 9.1, 9.2**

### Property 4: Route Freeze

*For any* sequence of `driverLocation` updates or `arrangeRoute` calls that occur after `isArranged === true`, `sortedOrderIds` shall remain unchanged. The only operation that may mutate `sortedOrderIds` after arrangement is an explicit `resetArrangement` call.

**Validates: Requirements 7.1, 7.2, 7.5**

### Property 5: Failure Transition — No Zero-Current Gap

*For any* route state where `currentOrderId` is the first entry in `sortedOrderIds` that exists in `activeOrders`, removing that order from `activeOrders` (simulating a completed or failed delivery) shall cause `currentOrderId` to advance to the next surviving entry in `sortedOrderIds` without passing through a state where zero orders are current (i.e., `isOrderCurrent` returns `true` for exactly one order before and after the transition, or zero orders are current only when the route is fully complete and `resetArrangement` has been called).

**Validates: Requirements 5.3, 5.4, 5.8**

### Property 6: Distance Formatting

*For any* non-negative distance value `d` (in km), `formatDistance(d)` shall return a string containing "m" (metres) when `d < 1`, and a string containing "km" when `d >= 1`. *For any* distance `d`, `formatEta(d)` shall return `"< 1 min"` when the computed minutes round to 0, `"{N} min"` when minutes are in [1, 59], and `"{H}h {M}m"` when minutes are ≥ 60.

**Validates: Requirements 3.2, 3.3, 9.2**

### Property 7: Ghost-Order Guard

*For any* `sortedOrderIds` array and any subset of `activeOrders` (representing orders that have been delivered, failed, or removed), `currentOrderId` shall always equal the first element of `sortedOrderIds` that is also present in `activeOrders`. If no such element exists, the route shall be reset.

**Validates: Requirements 5.8, 7.1**

### Property 8: Failure Notes Sanitisation

*For any* string `s` submitted as failure notes, the value passed to `recordDeliveryAttempt` shall be `s.trim()` if `s.trim().length > 0`, or `undefined` if `s.trim().length === 0`. The submitted notes shall never exceed 200 characters.

**Validates: Requirements 5.7, 5.9**

### Property 9: Syncing Skeleton Exclusivity

*For any* order where `allowedActions` is not `undefined` (including when it is an empty array `[]`), the `SyncingSkeleton` shall not be rendered. Conversely, when `allowedActions` is `undefined`, the `SyncingSkeleton` shall be rendered and no action buttons shall be rendered simultaneously.

**Validates: Requirements 8.1, 8.2, 8.4**

---

## Error Handling

### Invalid Coordinates

`useDistanceEta` returns `null` for both `distanceKm` and `etaMinutes` when:
- `driverLocation` is `null`
- `address.lat` or `address.lng` is `undefined`, `null`, `0`, non-finite, or out of range (lat ∉ [-90, 90], lng ∉ [-180, 180])

The `CurrentStrip` and `NextStrip` components render without distance/ETA text when `distanceKm` is `null` — they do not hide entirely.

### AsyncStorage Failures

`useRouteArrangement` wraps all AsyncStorage reads in a try/catch. On failure, the hook starts in unarranged state (safe default). Write failures are logged but do not block the UI — the in-memory state is authoritative for the current session.

### arrangeRoute Errors

`arrangeRoute` is wrapped in try/catch. On error, `isArranging` is reset to `false` and the error is logged. The existing route state (if any) is preserved — no partial mutation.

### Failure Modal Submission Errors

`handleFailDelivery` (in `DeliveryHomeTab`) catches errors from `recordDeliveryAttempt` and shows an `Alert`. The modal is closed before the mutation is called, so a failed mutation leaves the order in its current state. The driver can re-open the modal and retry.

### Race Condition: Socket Ahead of HTTP Response

The existing version-guard pattern in `DeliveryHomeTab` (comparing `responseVersion` against `cached.version`) prevents HTTP responses from overwriting socket events that arrived first. This is unchanged in Phase 5.

### Ghost Current Order

If `currentOrderId` points to an order no longer in `activeOrders` (e.g., slow network, stale cache), the auto-advance `useEffect` in `useRouteArrangement` fires on the next `activeOrders` change and advances to the next surviving entry. The UI never renders a `CurrentStrip` for an order not in `displayOrders` because `displayOrders` is derived from the intersection of `sortedOrderIds` and `activeOrders`.

---

## Testing Strategy

### Unit Tests (example-based)

Focus on specific scenarios and edge cases:

- `formatDistance`: `0.35` → `"350 m"`, `1.0` → `"1.0 km"`, `2.45` → `"2.5 km"`
- `formatEta`: `0.01 km` → `"< 1 min"`, `10 km` → `"24 min"`, `100 km` → `"4h 0m"`
- `SyncingSkeleton` renders when `allowedActions === undefined`
- `SyncingSkeleton` absent when `allowedActions === []`
- `FailureModal` confirm button disabled when no reason selected
- `FailureModal` confirm button enabled after reason selected
- `IdleCard` renders when both order lists are empty
- `ConnectionBanner` renders with offline message when `isOnline === false`
- `resetArrangement` clears all three AsyncStorage keys

### Property-Based Tests

Using a property-based testing library (e.g., `fast-check` for TypeScript/React Native). Each test runs a minimum of 100 iterations.

**Property 1 — Single-Current Invariant**
Tag: `Feature: driver-ux-phase5, Property 1: single-current invariant`
Generate: random `activeOrders` (1–10 orders), call `arrangeRoute`, assert `count(isOrderCurrent) === 1` and `isOrderCurrent(sortedOrderIds[0]) === true` and `!isOrderLocked(sortedOrderIds[0])`.

**Property 2 — Progress Consistency**
Tag: `Feature: driver-ux-phase5, Property 2: progress consistency`
Generate: random `sortedOrderIds` (1–10 IDs) and a random `currentOrderId` from that list, compute `completedCount` and `remainingCount`, assert `completedCount + remainingCount === sortedOrderIds.length`.

**Property 3 — ETA Monotonicity**
Tag: `Feature: driver-ux-phase5, Property 3: ETA monotonicity`
Generate: a destination coordinate and a sequence of driver positions moving toward it (each step reduces haversine distance by a random amount within ±5%), compute ETA at each step, assert no ETA increase exceeds 10% unless distance increased by >5%.

**Property 4 — Route Freeze**
Tag: `Feature: driver-ux-phase5, Property 4: route freeze`
Generate: an arranged route (random `sortedOrderIds`), send N random `driverLocation` updates, assert `sortedOrderIds` is unchanged after each update.

**Property 5 — Failure Transition**
Tag: `Feature: driver-ux-phase5, Property 5: failure transition`
Generate: random `sortedOrderIds` (2–5 IDs) and a random subset of `activeOrders` (simulating removal of current order), assert `currentOrderId` advances to the next surviving entry without a zero-current intermediate state.

**Property 6 — Distance Formatting**
Tag: `Feature: driver-ux-phase5, Property 6: distance formatting`
Generate: random non-negative distances, assert `formatDistance(d)` contains "m" iff `d < 1` and "km" iff `d >= 1`. Assert `formatEta(d)` matches the correct format bracket.

**Property 7 — Ghost-Order Guard**
Tag: `Feature: driver-ux-phase5, Property 7: ghost-order guard`
Generate: random `sortedOrderIds` and random subsets of those IDs as `activeOrderIds`, assert `currentOrderId` always equals the first element of `sortedOrderIds` present in `activeOrderIds`, or that `resetArrangement` is called when none remain.

**Property 8 — Failure Notes Sanitisation**
Tag: `Feature: driver-ux-phase5, Property 8: failure notes sanitisation`
Generate: random strings (including whitespace-only strings and strings > 200 chars), assert submitted notes are trimmed, ≤ 200 chars, and `undefined` when whitespace-only.

**Property 9 — Syncing Skeleton Exclusivity**
Tag: `Feature: driver-ux-phase5, Property 9: syncing skeleton exclusivity`
Generate: random `allowedActions` values (including `undefined`, `[]`, and non-empty arrays), assert `SyncingSkeleton` is rendered iff `allowedActions === undefined`, and action buttons are rendered iff `allowedActions !== undefined`.

### Integration Tests

- Full route arrangement → delivery → auto-advance cycle with mocked RTK Query
- AsyncStorage persistence round-trip: arrange route, simulate app reload, verify state restored
- Network replay: queue actions offline, restore network, verify replay order
