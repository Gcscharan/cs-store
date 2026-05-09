# Delivery Partner Pro UI - Design Document

## Architecture Overview

The transformation replaces the monolithic `DeliveryHomeTab.tsx` (1253 lines) with a modular, multi-section system. The core principle: **show all orders simultaneously, matching web parity**.

```
apps/customer-app/src/
├── screens/delivery/
│   └── DeliveryHomeTab.tsx          ← Thin orchestrator (multi-section render)
├── components/delivery/
│   ├── ControlBar/
│   │   └── ControlBar.tsx
│   ├── IdleCard/
│   │   └── IdleCard.tsx
│   ├── NewOrderCard/
│   │   └── NewOrderCard.tsx
│   ├── ActiveOrderCard/
│   │   └── ActiveOrderCard.tsx
│   └── PerformancePanel/
│       └── PerformancePanel.tsx     ← Moved to Earnings tab
└── hooks/delivery/
    ├── useDeliveryState.ts           ← Simplified state engine
    ├── useLocation.ts
    └── useOrders.ts
```

**Key Architectural Changes**:
- No StateCard router component (multi-section render instead)
- No OfflineCard (no OFFLINE state)
- No standalone MapPreview (Navigate button inside ActiveOrderCard)
- No QuickActions Help/Issue buttons (removed or QuickActions removed entirely)
- PerformancePanel moved to Earnings tab (not on home screen)

---

## 1. Design Tokens

Single source of truth for all visual decisions. Optimized for outdoor, high-contrast usage.

**File**: `apps/customer-app/src/constants/deliveryTheme.ts`

```typescript
export const DELIVERY_COLORS = {
  // Backgrounds
  background:    '#0F172A',   // Deep navy - base
  card:          '#1E293B',   // Slate - card surface
  cardElevated:  '#263548',   // Lighter slate - elevated cards
  border:        '#334155',   // Subtle border

  // Brand
  primary:       '#0B5FFF',   // Electric blue - primary actions
  primaryDark:   '#0847CC',   // Pressed state

  // Status
  success:       '#00C853',   // Online / delivered
  successBg:     '#052E16',   // Success background
  warning:       '#F59E0B',   // In transit / caution
  warningBg:     '#1C1400',   // Warning background
  danger:        '#FF3B30',   // Offline / failed
  dangerBg:      '#2D0A08',   // Danger background
  info:          '#38BDF8',   // Info / navigation

  // Text
  textPrimary:   '#F8FAFC',   // Primary text
  textSecondary: '#94A3B8',   // Secondary text
  textMuted:     '#475569',   // Muted / disabled

  // Special
  earnings:      '#FFD700',   // Gold - earnings highlight
  highValue:     '#FF6B00',   // Orange - high value order badge
  white:         '#FFFFFF',
};

export const DELIVERY_TYPOGRAPHY = {
  // Sizes - all large for outdoor readability
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
  hero: 38,
};

export const DELIVERY_SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  section: 32,
};

export const DELIVERY_RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 999,
};

export const DELIVERY_SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
  },
};
```

---

## 2. Core State Engine

The brain of the entire UI. Simplified to match web parity requirements.

**File**: `apps/customer-app/src/hooks/delivery/useDeliveryState.ts`

```typescript
export type DeliveryState =
  | 'IDLE'
  | 'NEW_ORDER'
  | 'ACTIVE_DELIVERY';

export interface DeliveryStateResult {
  state: DeliveryState;
  activeOrders: Order[];      // All active orders (not single order)
  availableOrders: Order[];   // All available orders (not newOrders)
  isOnline: boolean;
  isLoading: boolean;
}

export const useDeliveryState = (): DeliveryStateResult => {
  const { orders, deliveryBoy, isLoading } = useOrders();
  const isOnline = deliveryBoy?.availability === 'available';

  // Simple array filtering - no stableActiveOrder pattern
  const availableOrders = orders.filter(o => 
    o.orderStatus.toLowerCase() === 'created'
  );

  const activeOrders = orders.filter(o =>
    ACTIVE_STATUSES.includes(o.orderStatus.toLowerCase())
  );

  // State machine: ACTIVE_DELIVERY > NEW_ORDER > IDLE
  const state: DeliveryState =
    activeOrders.length > 0 ? 'ACTIVE_DELIVERY' :
    availableOrders.length > 0 ? 'NEW_ORDER' :
    'IDLE';

  return { state, activeOrders, availableOrders, isOnline, isLoading };
};
```

### Derived Data Layer — `useDashboardData`

Sits between state engine and UI. Prevents logic duplication across components.

**File**: `apps/customer-app/src/hooks/delivery/useDashboardData.ts`

```typescript
export const useDashboardData = () => {
  const { state, activeOrders, availableOrders, isOnline, isLoading } = useDeliveryState();

  const motivation = getMotivationMessage(
    deliveryBoy?.earnings ?? 0,
    deliveryBoy?.completedOrdersCount ?? 0
  );

  return {
    state,
    activeOrders,
    availableOrders,
    motivation,
    isOnline,
    isLoading,
  };
};
```

---

## 3. Component Designs

### 3.1 ControlBar

Top bar with operational status. Always visible. Matches web parity.

```
┌─────────────────────────────────────────────────────┐
│  ONLINE                           ₹320 earned     │
└─────────────────────────────────────────────────────┘
```

**Props**:
```typescript
interface ControlBarProps {
  isOnline: boolean;
  earnings: number;           // show only when > 0
  onToggleOnline: () => void;
  isToggling: boolean;
}
```

**FIX 3 — Online toggle double-tap guard**:
```typescript
// In DeliveryHomeTab (orchestrator)
const [isToggling, setIsToggling] = useState(false);

const handleToggleStatus = async () => {
  if (isToggling) return;  // Guard: ignore rapid taps
  setIsToggling(true);
  try {
    const result = await toggleStatus({ isOnline: !isOnline }).unwrap();
    setIsOnDuty(result.availability === 'available');
  } finally {
    setIsToggling(false);  // Always release, even on error
  }
};
```

**Key behaviors**:
- Online toggle is a large pressable chip, not a small Switch
- Toggle is `disabled={isToggling}` — no double-tap possible
- Show earnings only when `earnings > 0`
- No greeting text, no zone label, no battery/network indicators

---

### 3.2 Multi-Section Architecture (Web Parity)

**CRITICAL**: The mobile app does NOT use a StateCard router component. Instead, it renders multiple sections simultaneously, matching the web dashboard.

**Architecture**:
```typescript
<View style={styles.container}>
  <ControlBar
    isOnline={isOnline}
    earnings={earnings}
    onToggleOnline={handleToggle}
  />
  
  <ScrollView refreshControl={<RefreshControl ... />}>
    {/* Section 1: Available Orders (if any) */}
    {availableOrders.length > 0 && (
      <NewOrderCard
        availableOrders={availableOrders}
        onAccept={handleAccept}
        onReject={handleReject}
      />
    )}
    
    {/* Section 2: Active Orders (if any) */}
    {activeOrders.length > 0 && (
      <ActiveOrderCard
        activeOrders={activeOrders}
        deliveryAttempted={deliveryAttempted}
        codCollectionByOrderId={codCollectionByOrderId}
        onPickup={handlePickup}
        onStartDelivery={handleStartDelivery}
        onMarkArrived={handleMarkArrived}
        onStartDeliveryAttempt={handleStartDeliveryAttempt}
        onVerifyOtp={handleVerifyOtp}
        onCollectCOD={handleCollectCOD}
        onFailDelivery={handleFailDelivery}
      />
    )}
    
    {/* Section 3: Idle State (if no orders) */}
    {activeOrders.length === 0 && availableOrders.length === 0 && (
      <IdleCard earnings={earnings} onRefresh={refetch} />
    )}
  </ScrollView>
</View>
```

**Key Differences from Old Design**:
- No `StateCard.tsx` router component
- No `OfflineCard.tsx` (no OFFLINE state)
- All sections render conditionally based on array lengths
- Multiple orders visible simultaneously

---

### 3.3 IdleCard — Simplified

Shown when no orders exist. Matches web parity.

```
┌─────────────────────────────────────────────────────┐
│  No Active Orders                                   │
│  Stay online to receive delivery requests           │
│                                                     │
│  ₹320 earned                                        │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │           REFRESH                           │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Props**:
```typescript
interface IdleCardProps {
  earnings: number;
  onRefresh: () => void;
}
```

**Key behaviors**:
- Show earnings only when `earnings > 0`
- No deliveries count, no rating, no motivation text
- No "₹0" label when earnings are zero

---

### 3.4 NewOrderCard — All Available Orders

Shows ALL available orders, not just the first one. No countdown timer.

```
┌─────────────────────────────────────────────────────┐
│  🔥 NEW DELIVERY REQUEST                            │
│                                                     │
│  Order #abc123                                      │
│  💰 ₹42                                             │
│  👤 Rahul Kumar · 📞 98765 43210                    │
│  📍 Lakshmi Nagar, Tiruvuru                         │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────────┐    │
│  │   ✓  ACCEPT      │  │   ✗  DECLINE         │    │
│  └──────────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Props**:
```typescript
interface NewOrderCardProps {
  availableOrders: Order[];   // ALL available orders
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
}
```

**Key behaviors**:
- Map over `availableOrders` array
- Render one card per order
- No countdown timer
- Accept button is green, Decline is outlined

---

### 3.5 ActiveOrderCard — All Active Orders with 3-Step Progress

Shows ALL active orders simultaneously. Each order has a 3-step progress bar.

```
┌─────────────────────────────────────────────────────┐
│  📍 ACTIVE DELIVERY                                  │
│                                                     │
│  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━○   │
│  Assigned        Picked Up        In Transit        │
│                                                     │
│  Order #abc123 · ₹42 · Prepaid · Paid               │
│  👤 Rahul Kumar · 📞 98765 43210                    │
│  📍 Lakshmi Nagar, Tiruvuru                         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  🗺  Navigate to Location                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         ✓  MARK AS PICKED UP                │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Props**:
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
}
```

**Key behaviors**:
- Map over `activeOrders` array
- Render one card per order
- 3-step progress bar (Assigned / Picked Up / In Transit)
- "Navigate to Location" button inside each card
- Payment status badge (Paid / Pending / Awaiting UPI Approval)
- Action buttons match web parity logic

**Progress bar — 3 segments**:
```typescript
const PROGRESS_STEPS = ['Assigned', 'Picked Up', 'In Transit'] as const;

const isSegmentFilled = (segmentIndex: number, status: string): boolean => {
  switch (segmentIndex) {
    case 0: return ['assigned','picked_up','in_transit','out_for_delivery'].includes(status);
    case 1: return ['picked_up','in_transit','out_for_delivery'].includes(status);
    case 2: return ['in_transit','out_for_delivery'].includes(status);
    default: return false;
  }
};
```

**Navigate to Location**:
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

---

### 3.6 PerformancePanel

Moved to Earnings tab. NOT rendered on home screen.

**FIX 6 — Morning zero-state (motivating, not demotivating)**:
```typescript
export const getMotivationMessage = (earnings: number, deliveries: number): string => {
  if (deliveries === 0) return '🚀 Start your first delivery and earn today!';
  if (earnings < 100)   return `🔥 ${Math.ceil((100 - earnings) / 12)} more deliveries to reach ₹100`;
  if (earnings < 500)   return `⚡ ₹${500 - earnings} away from ₹500 today!`;
  return `🏆 Great work! ₹${earnings} earned today`;
};
```

---

### 3.7 QuickActions

Simplified to remove Help and Issue buttons. Keep only online/offline toggle if needed.

**Option 1**: Remove QuickActions entirely (toggle is in ControlBar)
**Option 2**: Keep QuickActions with only the online/offline toggle

---

### 3.8 DeliveryHomeTab (Orchestrator)

The new thin orchestrator. Multi-section render, not StateCard.

```typescript
const DeliveryHomeTab: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const { state, activeOrders, availableOrders, isOnline, isLoading } = useDeliveryState();
  const { refetch, isFetching } = useGetDeliveryOrdersQuery();
  const [toggleStatus] = useToggleStatusMutation();
  
  // Per-order state
  const [deliveryAttempted, setDeliveryAttempted] = useState<Record<string, boolean>>({});
  const [codCollectionByOrderId, setCodCollectionByOrderId] = useState<Record<string, CodCollection | null | undefined>>({});
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  
  // ... action handlers

  if (isLoading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <ControlBar
        isOnline={isOnline}
        earnings={deliveryBoy?.earnings ?? 0}
        onToggleOnline={handleToggleStatus}
        isToggling={isToggling}
      />
      
      <ScrollView
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        contentContainerStyle={styles.scroll}
      >
        {/* Section 1: Available Orders */}
        {availableOrders.length > 0 && (
          <NewOrderCard
            availableOrders={availableOrders}
            onAccept={handleAcceptOrder}
            onReject={handleRejectOrder}
          />
        )}
        
        {/* Section 2: Active Orders */}
        {activeOrders.length > 0 && (
          <ActiveOrderCard
            activeOrders={activeOrders}
            deliveryAttempted={deliveryAttempted}
            codCollectionByOrderId={codCollectionByOrderId}
            otpInputs={otpInputs}
            onOtpChange={(orderId, value) =>
              setOtpInputs(prev => ({ ...prev, [orderId]: value }))
            }
            onPickup={handlePickup}
            onStartDelivery={handleStartDelivery}
            onMarkArrived={handleMarkArrived}
            onStartDeliveryAttempt={handleStartDeliveryAttempt}
            onVerifyOtp={handleVerifyOtp}
            onCollectCOD={handleCollectCOD}
            onFailDelivery={handleFailDelivery}
          />
        )}
        
        {/* Section 3: Idle State */}
        {activeOrders.length === 0 && availableOrders.length === 0 && (
          <IdleCard
            earnings={deliveryBoy?.earnings ?? 0}
            onRefresh={refetch}
          />
        )}
      </ScrollView>
      
      {/* Modals remain here */}
    </View>
  );
};
```

---

## 4. Delivery Progress Bar

3-step progress bar, always visible in ActiveOrderCard. Matches web parity.

```typescript
const DELIVERY_STEPS = [
  { key: 'assigned',    label: 'Assigned' },
  { key: 'picked_up',  label: 'Picked Up' },
  { key: 'in_transit', label: 'In Transit' },
];

const isSegmentFilled = (segmentIndex: number, status: string): boolean => {
  switch (segmentIndex) {
    case 0: return ['assigned','picked_up','in_transit','out_for_delivery'].includes(status);
    case 1: return ['picked_up','in_transit','out_for_delivery'].includes(status);
    case 2: return ['in_transit','out_for_delivery'].includes(status);
    default: return false;
  }
};
```

Visual: horizontal bar with 3 segments, completed segments filled green, current segment pulsing.

---

## 5. COD Flow (Inline, Not Modal)

Current: Modal popup (breaks flow)
New: Inline banner inside ActiveOrderCard

```
┌─────────────────────────────────────────────────────┐
│  ⚠️  COLLECT PAYMENT BEFORE DELIVERY                │
│  Amount: ₹340                                       │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────────┐    │
│  │  💵  CASH        │  │  📱  UPI             │    │
│  └──────────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

Keeps the rider in context without a modal interruption.

---

## 6. OTP Verification (Inline)

**FIX 5 — Individual digit boxes with auto-focus**:

Current: Single TextInput buried in expanded card  
New: 4 individual digit boxes with auto-advance

```typescript
// 4 refs, one per digit box
const inputRefs = [useRef(), useRef(), useRef(), useRef()];

const handleOtpChange = (index: number, val: string) => {
  const digits = [...otpDigits];
  digits[index] = val.replace(/\D/g, '');
  setOtpDigits(digits);
  // Auto-advance to next box
  if (val && index < 3) inputRefs[index + 1].current?.focus();
  // Auto-backspace to previous box
  if (!val && index > 0) inputRefs[index - 1].current?.focus();
};
```

Visual layout:
```
┌─────────────────────────────────────────────────────┐
│  📲 OTP sent to customer                            │
│                                                     │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐                   │
│  │ 4  │  │ 2  │  │ 1  │  │ _  │                   │
│  └────┘  └────┘  └────┘  └────┘                   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         ✓  VERIFY & COMPLETE                │   │
│  └─────────────────────────────────────────────┘   │
│  Resend in 28s                                      │
└─────────────────────────────────────────────────────┘
```

---

## 7. Bottom Tab Bar

Replaces current tabs with operational-focused navigation.

| Tab | Icon | Label |
|-----|------|-------|
| Home | `home` | Home |
| Earnings | `wallet` | Earnings |
| Orders | `list` | Orders |
| Profile | `person` | Profile |

Tab bar style: dark background (`#1E293B`), active tint `#0B5FFF`, height 64dp.

---

## 7.5 Tab Bar Professional Upgrade

### Mental Model Fix

**Current Problem**: The tab structure is architecturally confused:
- "DeliveryHome" tab labeled as "Home" (meaningless for delivery apps)
- "DeliveryNotifications" screen used as "Orders" tab (wrong component)
- Riders land on "Home" instead of their work screen

**Solution**: Align tab names with delivery partner mental model:
- **Orders** (not "Home") — This is the primary work screen where riders see deliveries
- **Earnings** — Track money earned
- **Profile** — Account settings and preferences

**Architecture Change**:
```typescript
// BEFORE (confusing)
<Tab.Screen name="DeliveryHome" component={DeliveryHomeTab} options={{ tabBarLabel: 'Home' }} />
<Tab.Screen name="DeliveryNotifications" component={NotificationsScreen} options={{ tabBarLabel: 'Orders' }} />

// AFTER (clear)
<Tab.Screen name="Orders" component={DeliveryHomeTab} options={{ tabBarLabel: 'Orders' }} />
// DeliveryNotifications tab removed entirely
```

**Rationale**: 
- Delivery partners think in terms of "Orders" (their work), not "Home" (generic)
- NotificationsScreen is not an orders list — it's a notifications feed
- Removing the Notifications tab simplifies navigation (notifications can be accessed via bell icon in ControlBar)
- Setting `initialRouteName="Orders"` ensures riders land directly on their work screen

---

### Visual Upgrade Specifications

#### Problem: Current Tab Bar Feels Generic

The existing tab bar lacks professional polish:
- No elevation/depth (looks flat and cheap)
- Weak active state feedback (hard to see which tab is selected)
- Generic icons without delivery context optimization
- Small labels and icons (poor outdoor readability)

#### Solution: Premium Tab Bar Design

**Enhanced Tab Bar Style**:
```typescript
tabBarStyle: {
  backgroundColor: '#0F172A',    // Deeper navy (matches app background)
  borderTopWidth: 0,             // Remove default border (we use shadow instead)
  height: 72,                    // Increased from 64dp for better touch targets
  paddingBottom: 10,
  paddingTop: 10,
  elevation: 20,                 // Android shadow (strong depth)
  shadowColor: '#000',           // iOS shadow
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: -4 },
  shadowRadius: 10,
}
```

**Key Improvements**:
- **Elevation 20**: Creates strong depth separation from content
- **Height 72dp**: Larger touch targets for outdoor use with gloves
- **No border**: Shadow provides cleaner visual separation
- **Deep navy background**: Matches app theme, reduces eye strain

---

**Active State Indicator**:
```typescript
tabBarItemStyle: {
  borderRadius: 12,
  marginHorizontal: 6,
}
tabBarActiveBackgroundColor: 'rgba(11,95,255,0.15)'  // Subtle blue glow
```

**Key Improvements**:
- **Background glow**: Active tab has subtle blue background (not just icon color)
- **Rounded corners**: Modern, polished appearance
- **Horizontal margin**: Creates visual separation between tabs

---

**Label Improvements**:
```typescript
tabBarLabelStyle: {
  fontSize: 13,        // Increased from 12 (better readability)
  fontWeight: '700',   // Bold (was '600') — stronger hierarchy
}
```

**Key Improvements**:
- **Larger font**: Better outdoor readability
- **Bolder weight**: Clearer visual hierarchy

---

**Icon Upgrades**:

| Tab | Old Icon | New Icon | Rationale |
|-----|----------|----------|-----------|
| Orders | `home` | `receipt-outline` | Receipt = orders/deliveries (contextual) |
| Earnings | `wallet` | `cash-outline` | Cash = money earned (more direct) |
| Profile | `person` | `person-circle-outline` | Circle variant = better visual weight |

**Focused State Enhancement**:
```typescript
tabBarIcon: ({ color, size, focused }) => (
  <Ionicons
    name="receipt-outline"
    size={focused ? size + 2 : size}  // Active tab icon grows slightly
    color={color}
  />
)
```

**Key Improvements**:
- **Context-aware icons**: Receipt/cash are delivery-specific (not generic)
- **Size animation**: Active tab icon grows 2dp (subtle but noticeable)
- **Outline style**: Consistent visual weight across all icons

---

### Complete Upgraded Tab Navigator

```typescript
<Tab.Navigator
  initialRouteName="Orders"  // Riders land on work screen, not "Home"
  screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: '#0B5FFF',
    tabBarInactiveTintColor: '#64748B',
    tabBarStyle: {
      backgroundColor: '#0F172A',
      borderTopWidth: 0,
      height: 72,
      paddingBottom: 10,
      paddingTop: 10,
      elevation: 20,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: -4 },
      shadowRadius: 10,
    },
    tabBarLabelStyle: {
      fontSize: 13,
      fontWeight: '700',
    },
    tabBarActiveBackgroundColor: 'rgba(11,95,255,0.15)',
    tabBarItemStyle: {
      borderRadius: 12,
      marginHorizontal: 6,
    },
  }}
>
  <Tab.Screen
    name="Orders"
    component={DeliveryHomeTab}
    options={{
      tabBarLabel: 'Orders',
      tabBarIcon: ({ color, size, focused }) => (
        <Ionicons
          name="receipt-outline"
          size={focused ? size + 2 : size}
          color={color}
        />
      ),
    }}
  />
  <Tab.Screen
    name="Earnings"
    component={DeliveryEarningsTab}
    options={{
      tabBarLabel: 'Earnings',
      tabBarIcon: ({ color, size, focused }) => (
        <Ionicons
          name="cash-outline"
          size={focused ? size + 2 : size}
          color={color}
        />
      ),
    }}
  />
  <Tab.Screen
    name="Profile"
    component={DeliveryMoreTab}
    options={{
      tabBarLabel: 'Profile',
      tabBarIcon: ({ color, size, focused }) => (
        <Ionicons
          name="person-circle-outline"
          size={focused ? size + 2 : size}
          color={color}
        />
      ),
    }}
  />
</Tab.Navigator>
```

---

### Tab Bar Correctness Properties

These properties must hold after the upgrade:

1. **Initial Route Correctness**: `initialRouteName="Orders"` — riders always land on work screen
2. **Tab Count**: Exactly 3 tabs (Orders, Earnings, Profile) — no Notifications tab
3. **Component Mapping**: "Orders" tab renders `DeliveryHomeTab` (not NotificationsScreen)
4. **Active State Visibility**: Active tab has both color change AND background glow
5. **Touch Target Size**: All tabs have minimum 48dp touch target (height 72dp ensures this)
6. **Icon Consistency**: All icons use `-outline` variant for visual consistency
7. **No Border Artifact**: `borderTopWidth: 0` — shadow provides separation, not border
8. **Elevation Hierarchy**: Tab bar elevation (20) > card elevation (8) — proper z-index
9. **Label Readability**: Font size 13 + weight 700 ensures outdoor readability
10. **Focus Animation**: Active tab icon grows by 2dp — provides subtle feedback

---

## 8. Correctness Properties

These must hold at all times:

1. **Multi-Section Render**: All active orders + all available orders rendered simultaneously (no single-state exclusivity)
2. **No StateCard Router**: No StateCard.tsx component exists (multi-section render instead)
3. **No OFFLINE State**: DeliveryState is one of IDLE / NEW_ORDER / ACTIVE_DELIVERY (no OFFLINE)
4. **Action Safety**: Accept/Reject/Toggle buttons disabled while API call in flight (no double-tap)
5. **OTP Auto-Focus**: Each digit box auto-advances focus — no manual tap between boxes
6. **Earnings Non-Negative**: PerformancePanel never shows negative values
7. **Morning Zero-State**: Zero deliveries shows motivating message, never blank stats
8. **OTP Length Guard**: Verify button disabled until exactly 4 digits entered
9. **Toggle Debounce**: `isToggling` local state prevents double API call on rapid taps
10. **COD Gate**: OTP section only shown after COD collected (if COD order)
11. **Empty State Guidance**: No state ever shows a blank screen without a next action
12. **Tab Bar Initial Route**: `initialRouteName="Orders"` — riders always land on work screen
13. **Tab Bar Structure**: Exactly 3 tabs (Orders, Earnings, Profile) — no Notifications tab
14. **Tab Bar Component Mapping**: "Orders" tab renders `DeliveryHomeTab` component
15. **Tab Bar Active State**: Active tab has both color change AND background glow
16. **Tab Bar Elevation**: Tab bar elevation (20) > card elevation (8) — proper z-index
17. **All Active Orders Rendered**: ActiveOrderCard maps over `activeOrders` array (not single order)
18. **All Available Orders Rendered**: NewOrderCard maps over `availableOrders` array (not single order)
19. **No Countdown Timer**: NewOrderCard has no countdown timer
20. **No Standalone MapPreview**: No standalone MapPreview component (Navigate button inside ActiveOrderCard)
21. **3-Step Progress Bar**: Progress bar has exactly 3 steps (Assigned / Picked Up / In Transit)
22. **No PerformancePanel on Home**: PerformancePanel not rendered on DeliveryHomeTab (moved to Earnings tab)
23. **No Help/Issue Buttons**: QuickActions does not have Help or Issue buttons (removed or QuickActions removed entirely)

---

## 9. Files to Create / Modify

### New Files
```
apps/customer-app/src/constants/deliveryTheme.ts
apps/customer-app/src/hooks/delivery/useDeliveryState.ts
apps/customer-app/src/hooks/delivery/useOrders.ts
apps/customer-app/src/components/delivery/ControlBar/ControlBar.tsx
apps/customer-app/src/components/delivery/IdleCard/IdleCard.tsx
apps/customer-app/src/components/delivery/NewOrderCard/NewOrderCard.tsx
apps/customer-app/src/components/delivery/ActiveOrderCard/ActiveOrderCard.tsx
apps/customer-app/src/components/delivery/PerformancePanel/PerformancePanel.tsx
apps/customer-app/src/utils/deliveryUtils.ts
```

### Modified Files
```
apps/customer-app/src/screens/delivery/DeliveryHomeTab.tsx   ← Full rewrite (multi-section render)
apps/customer-app/src/screens/delivery/DeliveryDashboardScreen.tsx  ← Tab bar upgrade (structure + visual improvements)
apps/customer-app/src/screens/delivery/DeliveryEarningsTab.tsx  ← Add PerformancePanel here
```

### Removed Components (Do NOT Create)
```
apps/customer-app/src/components/delivery/StateCard/StateCard.tsx  ← REMOVED (no router)
apps/customer-app/src/components/delivery/StateCard/OfflineCard.tsx  ← REMOVED (no OFFLINE state)
apps/customer-app/src/components/delivery/MapPreview/MapPreview.tsx  ← REMOVED (Navigate button inside ActiveOrderCard)
apps/customer-app/src/components/delivery/QuickActions/QuickActions.tsx  ← REMOVED or modified (no Help/Issue buttons)
```

### Preserved (No Changes)
```
apps/customer-app/src/api/deliveryApi.ts        ← All existing API hooks reused
apps/customer-app/src/screens/delivery/DeliveryMoreTab.tsx
```
