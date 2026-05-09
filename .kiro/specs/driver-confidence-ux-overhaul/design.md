# Design Document: Driver Confidence UX Overhaul

## Overview

This design focuses exclusively on **UI/UX layer improvements** for the delivery driver app. The existing production-grade queue system (`useActionQueue`, `useAttemptTracker`, `useRouteArrangement`) is mature and battle-tested. This feature adds a presentation layer on top to improve driver confidence, reduce cognitive load, and optimize for real-world delivery conditions (riding, rain, sunlight, stress).

**Core Principle**: Reuse existing state — add presentation logic only. No new abstractions, no queue rewrites, no infrastructure changes.

**Target Outcome**: Drivers always know what's happening and what to do next through state clarity, action confidence, and stress-condition optimization.

---

## Architecture

### Existing System (Unchanged)

```
DeliveryHomeTab.tsx
  ├── useActionQueue          ← queue persistence, replay, offline handling
  ├── useAttemptTracker       ← delivery attempt counts, retry locks
  ├── useRouteArrangement     ← route ordering, current order tracking
  ├── useNetworkStatus        ← network connectivity monitoring
  └── useDeliverySocket       ← real-time order updates
```

### New Presentation Layer (This Feature)

```
DeliveryHomeTab.tsx
  ├── StickyCurrentOrderPanel     ← always-visible current order info
  ├── GlobalConnectivityBanner    ← persistent network status (enhanced)
  ├── useConnectivityState        ← derive UI state from network + queue
  ├── useActionFeedback           ← button state transitions
  └── Enhanced Components:
      ├── ActionButton            ← state feedback (processing → synced → idle)
      ├── RetryLockExplanation    ← plain-language retry guidance
      ├── ActiveOrderCard         ← stress-optimized layout
      └── RouteScreen             ← quick-scan route view
```

**Data Flow**:
1. Existing hooks provide state (queue length, network status, current order, retry locks)
2. New presentation hooks derive UI state (connectivity banner text, button states)
3. New components render derived state with stress-optimized design

---

## Components and Interfaces

### 1. StickyCurrentOrderPanel

**Purpose**: Always-visible panel showing current order info, eliminating search under pressure.

**Props**:
```typescript
interface StickyCurrentOrderPanelProps {
  currentOrder: Order | null;
  isArranged: boolean;
  onCallCustomer: (phone: string) => void;
  onNavigate: (order: Order) => void;
}
```

**State Derivation**:
```typescript
// Derive from useRouteArrangement
const currentOrder = isArranged && currentOrderId
  ? activeOrders.find(o => o._id === currentOrderId)
  : null;
```

**Layout** (Requirements 1.1-1.7):
- **Position**: Fixed at top of screen, above scroll content
- **Height**: 120dp (compact but readable)
- **Content**:
  - Customer name (18sp bold)
  - Delivery address (14sp, 2 lines max with ellipsis)
  - Call button (48x48dp touch target)
  - OTP state badge (when required)
  - COD state badge (when required)
  - Next action (16sp bold, distinct background)
- **Visibility**: Hidden when no current order exists

**Design Rationale**: Drivers on bikes can't scroll to find info. Sticky panel ensures critical data is always visible.

---

### 2. GlobalConnectivityBanner

**Purpose**: Persistent network status indicator, replacing the existing `ConnectionBanner` with enhanced states.

**Props**:
```typescript
interface GlobalConnectivityBannerProps {
  connectivityState: ConnectivityState;
  queueLength: number;
  onForceSync?: () => void;
}

type ConnectivityState = 
  | { type: 'online' }
  | { type: 'offline' }
  | { type: 'syncing'; count: number }
  | { type: 'reconnected'; timestamp: number }
  | { type: 'replaying' };
```

**State Derivation** (via `useConnectivityState` hook):
```typescript
const useConnectivityState = () => {
  const { isOnline } = useNetworkStatus();
  const { queueLength, isSyncing } = useActionQueue();
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);

  const prevOnline = useRef(isOnline);
  useEffect(() => {
    if (!prevOnline.current && isOnline) {
      setReconnectedAt(Date.now());
      setTimeout(() => setReconnectedAt(null), 3000);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  if (reconnectedAt) return { type: 'reconnected', timestamp: reconnectedAt };
  if (!isOnline) return { type: 'offline' };
  if (isSyncing) return { type: 'replaying' };
  if (queueLength > 0) return { type: 'syncing', count: queueLength };
  return { type: 'online' };
};
```

**Display Logic** (Requirements 2.1-2.7):
- **Offline**: Red background, "Offline" text, persistent
- **Syncing**: Yellow background, "Syncing X actions" text
- **Reconnected**: Green background, "Reconnected" text, auto-hide after 3s
- **Replaying**: Yellow background, "Queue replaying" text
- **Online + empty queue**: Hidden

**Position**: Top of screen, above all content, persists across all screens.

**Design Rationale**: Drivers need unmistakable offline state. Persistent banner prevents confusion about whether actions are queued or synced.

---

### 3. ActionButton

**Purpose**: Unified button component with state feedback for all driver actions.

**Props**:
```typescript
interface ActionButtonProps {
  label: string;
  icon: string;
  onPress: () => void;
  state: ActionButtonState;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

type ActionButtonState =
  | { type: 'idle' }
  | { type: 'processing' }
  | { type: 'queued' }
  | { type: 'synced'; timestamp: number }
  | { type: 'failed' };
```

**State Management** (via `useActionFeedback` hook):
```typescript
const useActionFeedback = (orderId: string, actionType: string) => {
  const { queue } = useActionQueue();
  const [localState, setLocalState] = useState<ActionButtonState>({ type: 'idle' });

  // Check if action is in queue
  const queuedAction = queue.find(a => a.orderId === orderId && a.action === actionType);

  useEffect(() => {
    if (queuedAction) {
      setLocalState({ type: 'queued' });
    }
  }, [queuedAction]);

  const onActionStart = () => {
    setLocalState({ type: 'processing' });
  };

  const onActionSuccess = () => {
    setLocalState({ type: 'synced', timestamp: Date.now() });
    setTimeout(() => setLocalState({ type: 'idle' }), 2000);
  };

  const onActionFailure = () => {
    setLocalState({ type: 'failed' });
  };

  return { state: localState, onActionStart, onActionSuccess, onActionFailure };
};
```

**Visual States** (Requirements 3.1-3.7):
- **Idle**: Default button appearance
- **Processing**: Spinner + "Processing…" text
- **Queued**: Offline icon + "Queued Offline" text, yellow background
- **Synced**: Checkmark + "Synced" text, green background, 2s duration
- **Failed**: Error icon + "Failed — Retry" text, red background

**Touch Target**: Minimum 48x48dp (Requirement 5.1)

**Design Rationale**: Silent buttons cause driver anxiety. Explicit state feedback builds confidence that actions are registered.

---

### 4. RetryLockExplanation

**Purpose**: Plain-language explanation when actions are locked due to retry backoff.

**Props**:
```typescript
interface RetryLockExplanationProps {
  orderId: string;
  attemptCount: number;
  remainingSeconds: number;
  onRetry: () => void;
}
```

**State Derivation**:
```typescript
// Derive from useAttemptTracker
const attemptState = getAttemptState(orderId);
const isRetryLocked = isRetryLocked(orderId);
const remainingSeconds = getRemainingSeconds(orderId);
```

**Display Logic** (Requirements 4.1-4.6):
```typescript
if (isRetryLocked) {
  return (
    <View style={styles.retryLockBanner}>
      <Icon name="time" />
      <Text>Retry available in {formatTime(remainingSeconds)}</Text>
      <Text>What to do: Continue with other deliveries</Text>
    </View>
  );
} else if (attemptCount > 0) {
  return (
    <TouchableOpacity onPress={onRetry}>
      <Text>Retry Now</Text>
    </TouchableOpacity>
  );
}
```

**Design Rationale**: Technical error messages confuse drivers. Plain language ("Retry available in 5 minutes") is actionable.

---

### 5. Enhanced ActiveOrderCard

**Purpose**: Stress-optimized order card with improved visual hierarchy and touch targets.

**Changes from Existing**:
- **Font sizes**: 16sp minimum for critical info, 24sp for COD amounts (Requirements 5.3, 9.5)
- **Touch targets**: 48x48dp minimum for all buttons (Requirement 5.1)
- **High contrast**: Primary action buttons use high-contrast colors (Requirement 5.2)
- **Button positioning**: Primary action in bottom third of card (Requirement 5.4)
- **Visual states**: Distinct enabled/disabled/loading states (Requirement 5.7)
- **Edge padding**: 16dp minimum to avoid accidental touches (Requirement 5.6)

**Layout Priority** (top to bottom):
1. Order ID + Status badge
2. Customer name (18sp bold)
3. Delivery address (16sp, 2 lines)
4. COD amount (24sp bold, if applicable)
5. Next action button (48x48dp, bottom third)

**Design Rationale**: Drivers use the app while riding in rain/sunlight. Large fonts, high contrast, and thumb-reach positioning are critical.

---

### 6. Optimized RouteScreen

**Purpose**: Quick-scan route view with visual hierarchy for current/next/completed stops.

**State Derivation**:
```typescript
// Derive from useRouteArrangement
const { sortedOrderIds, currentOrderId, isArranged } = useRouteArrangement(activeOrders);

const displayOrders = isArranged
  ? sortedOrderIds.map(id => activeOrders.find(o => o._id === id)).filter(Boolean)
  : activeOrders;

const currentIndex = displayOrders.findIndex(o => o._id === currentOrderId);
```

**Visual Hierarchy** (Requirements 12.1-12.7):
- **Current stop**: Bold background, "CURRENT" label, 20sp text
- **Next 3 stops**: Visible without tapping, 16sp text
- **Completed stops**: Checkmark, dimmed (50% opacity)
- **Remaining count**: "5 stops remaining" at top

**Auto-scroll**: When current stop changes, scroll to show new current stop (Requirement 12.4)

**Expand on tap**: Tapping a stop expands details inline (no navigation) (Requirement 12.7)

**Design Rationale**: Drivers need to scan their route at a glance. Visual hierarchy (size, color, weight) makes current/next/completed stops obvious.

---

## Data Models

### ConnectivityState

```typescript
type ConnectivityState = 
  | { type: 'online' }
  | { type: 'offline' }
  | { type: 'syncing'; count: number }
  | { type: 'reconnected'; timestamp: number }
  | { type: 'replaying' };
```

**Derivation**: Computed from `useNetworkStatus` + `useActionQueue` state.

---

### ActionButtonState

```typescript
type ActionButtonState =
  | { type: 'idle' }
  | { type: 'processing' }
  | { type: 'queued' }
  | { type: 'synced'; timestamp: number }
  | { type: 'failed' };
```

**Derivation**: Managed by `useActionFeedback` hook, transitions based on action lifecycle.

---

### RetryLockState

```typescript
interface RetryLockState {
  isLocked: boolean;
  remainingSeconds: number;
  attemptCount: number;
  maxAttempts: number;
}
```

**Derivation**: Computed from `useAttemptTracker` state.

---

## Error Handling

### Plain-Language Error Messages (Requirements 13.1-13.7)

**Mapping**:
```typescript
const ERROR_MESSAGES: Record<string, string> = {
  'NETWORK_ERROR': 'Connection issue — action queued for retry',
  'SERVER_ERROR': 'Server issue — we'll retry automatically',
  'OTP_INVALID': 'Incorrect OTP — try again',
  'OTP_REQUIRED': 'Cannot mark delivered — OTP required',
  'COD_REQUIRED': 'Cannot mark delivered — collect payment first',
  'ALREADY_DELIVERED': 'Order already delivered by another driver',
};
```

**Implementation**:
```typescript
const getDriverFriendlyError = (error: any): string => {
  if (!error?.status) return ERROR_MESSAGES.NETWORK_ERROR;
  if (error.status >= 500) return ERROR_MESSAGES.SERVER_ERROR;
  if (error.data?.code) return ERROR_MESSAGES[error.data.code] || error.data.error;
  return error.data?.error || 'Something went wrong';
};
```

**Design Rationale**: Technical jargon ("HTTP 500", "Network timeout") confuses drivers. Plain language with actionable guidance reduces support calls.

---

### Recovery Actions (Requirements 7.1-7.7)

**Force Sync Button**:
- Displayed in `GlobalConnectivityBanner` when queue is stuck
- Triggers `replayQueue()` manually
- Shows progress indicator during sync

**Reset State Button**:
- Displayed in error states after multiple failures
- Clears local cache and reloads from server
- Shows confirmation dialog before executing

**Design Rationale**: Drivers shouldn't need to restart the app to recover from errors. In-app recovery actions reduce downtime.

---

## Testing Strategy

### Unit Tests

**Component Tests**:
1. `StickyCurrentOrderPanel` renders correct info for current order
2. `GlobalConnectivityBanner` displays correct state for each connectivity type
3. `ActionButton` transitions through states correctly
4. `RetryLockExplanation` shows correct countdown and guidance
5. `ActiveOrderCard` uses correct font sizes and touch targets
6. `RouteScreen` displays correct visual hierarchy

**Hook Tests**:
1. `useConnectivityState` derives correct state from network + queue
2. `useActionFeedback` transitions button states correctly
3. State derivation logic matches existing hook outputs

### Integration Tests

1. Sticky panel updates when current order changes
2. Connectivity banner updates when network status changes
3. Action buttons show "Queued Offline" when offline
4. Retry lock explanation shows correct countdown
5. Route screen auto-scrolls when current stop changes

### Accessibility Tests

1. All interactive elements have accessibility labels (Requirement 15.1)
2. Screen reader announces state changes (Requirement 15.4)
3. Minimum contrast ratio 4.5:1 for all text (Requirement 15.3)
4. Touch targets meet 48x48dp minimum (Requirement 15.5)
5. Haptic feedback fires for critical actions (Requirement 15.6)

### Performance Tests

1. UI remains responsive with 50+ queued actions (Requirement 14.1)
2. Screen transitions complete in <300ms (Requirement 14.5)
3. Route screen scrolls smoothly with 20+ stops (Requirement 14.3)
4. No UI freezes during background sync (Requirement 14.4)

---

## Visual Design System

### Color Palette

```typescript
export const UX_COLORS = {
  // State colors
  offline: '#E53E3E',        // Red
  offlineBg: '#FED7D7',      // Light red
  syncing: '#D69E2E',        // Yellow
  syncingBg: '#FEEBC8',      // Light yellow
  success: '#38A169',        // Green
  successBg: '#C6F6D5',      // Light green
  error: '#E53E3E',          // Red
  errorBg: '#FED7D7',        // Light red
  locked: '#718096',         // Gray
  lockedBg: '#EDF2F7',       // Light gray

  // Action button states
  processing: '#3182CE',     // Blue
  queued: '#D69E2E',         // Yellow
  synced: '#38A169',         // Green
  failed: '#E53E3E',         // Red

  // High contrast (sunlight visibility)
  primaryAction: '#2B6CB0',  // Dark blue
  dangerAction: '#C53030',   // Dark red
  textHighContrast: '#1A202C', // Near black
};
```

### Typography Scale

```typescript
export const UX_TYPOGRAPHY = {
  // Critical info (customer name, address, next action)
  critical: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  // COD amounts
  codAmount: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  // Order ID, status badges
  secondary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  // Helper text, timestamps
  tertiary: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
};
```

### Spacing and Layout

```typescript
export const UX_SPACING = {
  // Touch target minimum
  touchTarget: 48,
  // Edge padding (avoid accidental touches)
  edgePadding: 16,
  // Component spacing
  componentGap: 12,
  // Section spacing
  sectionGap: 24,
};
```

### Animation Timings

```typescript
export const UX_ANIMATIONS = {
  // Button state transitions
  buttonTransition: 200,
  // Banner auto-hide (reconnected)
  bannerAutoHide: 3000,
  // Synced state display duration
  syncedDuration: 2000,
  // Screen transitions
  screenTransition: 300,
};
```

---

## Accessibility Compliance

### Screen Reader Support (Requirements 15.1, 15.4)

**Accessibility Labels**:
```typescript
<TouchableOpacity
  accessibilityLabel="Mark as picked up"
  accessibilityHint="Confirms you have collected the order from the warehouse"
  accessibilityRole="button"
  onPress={onPickup}
>
  <Text>Mark as Picked Up</Text>
</TouchableOpacity>
```

**State Announcements**:
```typescript
// Announce when action syncs
AccessibilityInfo.announceForAccessibility('Action synced successfully');

// Announce when offline
AccessibilityInfo.announceForAccessibility('You are now offline. Actions will be queued.');
```

### Dynamic Font Sizing (Requirement 15.2)

```typescript
import { useWindowDimensions, PixelRatio } from 'react-native';

const useDynamicFontSize = (baseSize: number) => {
  const { fontScale } = useWindowDimensions();
  return baseSize * Math.min(fontScale, 1.3); // Cap at 1.3x
};
```

### High Contrast Mode (Requirement 15.7)

```typescript
import { AccessibilityInfo } from 'react-native';

const [isHighContrast, setIsHighContrast] = useState(false);

useEffect(() => {
  AccessibilityInfo.isHighContrastEnabled().then(setIsHighContrast);
}, []);

const textColor = isHighContrast ? UX_COLORS.textHighContrast : DELIVERY_COLORS.text;
```

### Haptic Feedback (Requirement 15.6)

```typescript
import * as Haptics from 'expo-haptics';

const onCriticalAction = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  // ... action logic
};
```

---

## Implementation Notes

### Integration with Existing System

**No Breaking Changes**:
- All existing hooks remain unchanged
- Existing components continue to work
- New components are additive, not replacements

**Gradual Rollout**:
1. Add `useConnectivityState` and `useActionFeedback` hooks
2. Replace `ConnectionBanner` with `GlobalConnectivityBanner`
3. Add `StickyCurrentOrderPanel` to `DeliveryHomeTab`
4. Enhance `ActionButton` with state feedback
5. Add `RetryLockExplanation` to `ActiveOrderCard`
6. Apply stress-optimized styles to `ActiveOrderCard`
7. Optimize `RouteScreen` visual hierarchy

**Rollback Plan**:
- Each component can be feature-flagged
- Revert to existing components if issues arise
- No data migration required (presentation layer only)

### Performance Considerations

**Memoization**:
```typescript
const connectivityState = useMemo(() => 
  deriveConnectivityState(isOnline, queueLength, isSyncing),
  [isOnline, queueLength, isSyncing]
);
```

**Virtualization** (Requirement 14.3):
```typescript
import { FlatList } from 'react-native';

<FlatList
  data={displayOrders}
  renderItem={({ item }) => <OrderCard order={item} />}
  keyExtractor={item => item._id}
  windowSize={10}
/>
```

**Debouncing**:
```typescript
// Debounce countdown updates to 1s intervals
const [remainingSeconds, setRemainingSeconds] = useState(0);

useEffect(() => {
  const interval = setInterval(() => {
    setRemainingSeconds(getRemainingSeconds(orderId));
  }, 1000);
  return () => clearInterval(interval);
}, [orderId]);
```

---

## Success Metrics

### Operational Metrics

1. **Driver Confidence**: Reduction in support calls about "Did my action work?"
2. **Error Recovery**: Reduction in app restarts due to stuck states
3. **Action Completion Time**: Reduction in time from action tap to next action
4. **Offline Usability**: Increase in actions completed while offline

### Technical Metrics

1. **UI Responsiveness**: <100ms button tap delay with 50+ queued actions
2. **Screen Transitions**: <300ms transition time
3. **Scroll Performance**: 60fps scrolling with 20+ route stops
4. **Accessibility Compliance**: 100% of interactive elements have labels

### User Feedback Metrics

1. **Driver Satisfaction**: Survey score for "I always know what's happening"
2. **Stress Reduction**: Survey score for "The app is easy to use under pressure"
3. **Clarity**: Survey score for "Error messages are clear and helpful"

---

## Future Enhancements (Out of Scope)

1. **Voice Feedback**: Audio announcements for state changes (hands-free operation)
2. **Gesture Navigation**: Swipe gestures for common actions (one-handed use)
3. **Predictive Actions**: Suggest next action based on context (reduce taps)
4. **Offline Maps**: Cache map tiles for offline navigation
5. **Smart Notifications**: Context-aware push notifications (e.g., "Customer called")

These enhancements require additional infrastructure and are deferred to future iterations.

---

## Appendix: Requirements Traceability

| Requirement | Design Component | Implementation |
|-------------|------------------|----------------|
| 1.1-1.8 | StickyCurrentOrderPanel | New component |
| 2.1-2.7 | GlobalConnectivityBanner | Enhanced component |
| 3.1-3.7 | ActionButton + useActionFeedback | New component + hook |
| 4.1-4.6 | RetryLockExplanation | New component |
| 5.1-5.7 | Enhanced ActiveOrderCard | Style updates |
| 6.1-6.6 | GlobalConnectivityBanner | State derivation |
| 7.1-7.7 | Recovery actions in banner | New buttons |
| 8.1-8.7 | StickyCurrentOrderPanel | Next action display |
| 9.1-9.7 | COD section in ActiveOrderCard | Enhanced layout |
| 10.1-10.7 | OTP section in ActiveOrderCard | Enhanced layout |
| 11.1-11.7 | GlobalConnectivityBanner | Detailed sync states |
| 12.1-12.7 | Optimized RouteScreen | Visual hierarchy |
| 13.1-13.7 | Error message mapping | Utility function |
| 14.1-14.7 | Performance optimizations | Memoization, virtualization |
| 15.1-15.7 | Accessibility features | Labels, haptics, contrast |

All 15 requirements are addressed through presentation layer improvements without modifying existing infrastructure.
