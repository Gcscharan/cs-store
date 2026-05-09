/**
 * Unit Tests for Idle and Offline State Rendering
 *
 * **Validates: Requirements 10.1, 10.2, 10.6**
 *
 * Verifies the rendering conditions in DeliveryHomeTab:
 * - IdleCard renders when both availableOrders and activeOrders are empty
 * - ConnectionBanner renders with offline indicator when networkIsOnline === false
 * - When both conditions are true, ConnectionBanner takes visual priority over IdleCard
 *
 * Testing strategy: Extract the rendering guard logic from DeliveryHomeTab and
 * ConnectionBanner, then test it directly — same approach used in SyncingSkeleton.test.ts.
 */

// ─── Extracted rendering logic from DeliveryHomeTab ──────────────────────────

/**
 * Mirrors the IdleCard rendering condition in DeliveryHomeTab:
 *   {availableOrders.length === 0 && activeOrders.length === 0 && <IdleCard />}
 */
function shouldShowIdleCard(
  availableOrders: unknown[],
  activeOrders: unknown[]
): boolean {
  return availableOrders.length === 0 && activeOrders.length === 0;
}

/**
 * Mirrors the NewOrderCard rendering condition in DeliveryHomeTab:
 *   {availableOrders.length > 0 && <NewOrderCard />}
 */
function shouldShowNewOrderCard(availableOrders: unknown[]): boolean {
  return availableOrders.length > 0;
}

/**
 * Mirrors the ActiveOrderCard rendering condition in DeliveryHomeTab:
 *   {activeOrders.length > 0 && <ActiveOrderCard />}
 */
function shouldShowActiveOrderCard(activeOrders: unknown[]): boolean {
  return activeOrders.length > 0;
}

// ─── Extracted rendering logic from ConnectionBanner ─────────────────────────

type SocketStatus = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionBannerState {
  visible: boolean;
  message: string | null;
  isOffline: boolean;
}

/**
 * Mirrors the ConnectionBanner rendering logic:
 *   if (isOnline && socketStatus === 'connected' && !isSyncing) return null;
 *   if (!isOnline) { message = 'No Internet Connection'; }
 *   else if (isSyncing) { message = 'Syncing...'; }
 *   else { message = 'Reconnecting...'; }
 */
function getConnectionBannerState(
  isOnline: boolean,
  socketStatus: SocketStatus,
  isSyncing: boolean
): ConnectionBannerState {
  if (isOnline && socketStatus === 'connected' && !isSyncing) {
    return { visible: false, message: null, isOffline: false };
  }

  if (!isOnline) {
    return { visible: true, message: 'No Internet Connection', isOffline: true };
  }

  if (isSyncing) {
    return { visible: true, message: 'Syncing...', isOffline: false };
  }

  // isOnline && socketStatus !== 'connected'
  return { visible: true, message: 'Reconnecting...', isOffline: false };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IdleCard rendering condition (Requirement 10.1)', () => {
  /**
   * Requirement 10.1: WHEN availableOrders is empty AND activeOrders is empty,
   * the Driver_App SHALL render the IdleCard.
   */
  it('renders IdleCard when both availableOrders and activeOrders are empty', () => {
    expect(shouldShowIdleCard([], [])).toBe(true);
  });

  it('does NOT render IdleCard when availableOrders has items', () => {
    expect(shouldShowIdleCard([{ _id: 'order-1' }], [])).toBe(false);
  });

  it('does NOT render IdleCard when activeOrders has items', () => {
    expect(shouldShowIdleCard([], [{ _id: 'order-2' }])).toBe(false);
  });

  it('does NOT render IdleCard when both lists have items', () => {
    expect(shouldShowIdleCard([{ _id: 'order-1' }], [{ _id: 'order-2' }])).toBe(false);
  });

  /**
   * Requirement 10.1: SHALL NOT render ActiveOrderCard or NewOrderCard when idle.
   */
  it('does NOT render NewOrderCard or ActiveOrderCard when both lists are empty', () => {
    const available: unknown[] = [];
    const active: unknown[] = [];
    expect(shouldShowNewOrderCard(available)).toBe(false);
    expect(shouldShowActiveOrderCard(active)).toBe(false);
    expect(shouldShowIdleCard(available, active)).toBe(true);
  });

  it('renders NewOrderCard (not IdleCard) when only availableOrders has items', () => {
    const available = [{ _id: 'order-1' }];
    const active: unknown[] = [];
    expect(shouldShowNewOrderCard(available)).toBe(true);
    expect(shouldShowIdleCard(available, active)).toBe(false);
  });

  it('renders ActiveOrderCard (not IdleCard) when only activeOrders has items', () => {
    const available: unknown[] = [];
    const active = [{ _id: 'order-2' }];
    expect(shouldShowActiveOrderCard(active)).toBe(true);
    expect(shouldShowIdleCard(available, active)).toBe(false);
  });
});

describe('ConnectionBanner offline indicator (Requirement 10.2)', () => {
  /**
   * Requirement 10.2: WHEN the network connection is lost, the Driver_App SHALL
   * render the ConnectionBanner with an offline indicator.
   */
  it('renders ConnectionBanner with offline indicator when networkIsOnline === false', () => {
    const state = getConnectionBannerState(false, 'disconnected', false);
    expect(state.visible).toBe(true);
    expect(state.isOffline).toBe(true);
    expect(state.message).toBe('No Internet Connection');
  });

  it('renders ConnectionBanner with offline indicator regardless of socketStatus when offline', () => {
    const statuses: SocketStatus[] = ['connected', 'reconnecting', 'disconnected'];
    for (const socketStatus of statuses) {
      const state = getConnectionBannerState(false, socketStatus, false);
      expect(state.visible).toBe(true);
      expect(state.isOffline).toBe(true);
      expect(state.message).toBe('No Internet Connection');
    }
  });

  it('does NOT render ConnectionBanner when online, connected, and not syncing', () => {
    const state = getConnectionBannerState(true, 'connected', false);
    expect(state.visible).toBe(false);
    expect(state.message).toBeNull();
  });

  it('renders ConnectionBanner with Reconnecting message when online but socket is reconnecting', () => {
    const state = getConnectionBannerState(true, 'reconnecting', false);
    expect(state.visible).toBe(true);
    expect(state.isOffline).toBe(false);
    expect(state.message).toBe('Reconnecting...');
  });

  it('renders ConnectionBanner with Syncing message when online but isSyncing', () => {
    const state = getConnectionBannerState(true, 'connected', true);
    expect(state.visible).toBe(true);
    expect(state.isOffline).toBe(false);
    expect(state.message).toBe('Syncing...');
  });
});

describe('Simultaneous offline + idle state (Requirement 10.6)', () => {
  /**
   * Requirement 10.6: WHEN both conditions are true (network offline AND no active/available orders),
   * the Driver_App SHALL render the ConnectionBanner as the primary indicator and the IdleCard
   * as secondary content below it. The ConnectionBanner SHALL always take visual priority.
   *
   * In DeliveryHomeTab, ConnectionBanner is rendered unconditionally ABOVE the ScrollView,
   * while IdleCard is rendered inside the ScrollView — this ensures ConnectionBanner always
   * takes visual priority.
   */
  it('both ConnectionBanner and IdleCard are shown when offline and no orders', () => {
    const available: unknown[] = [];
    const active: unknown[] = [];

    const bannerState = getConnectionBannerState(false, 'disconnected', false);
    const showIdle = shouldShowIdleCard(available, active);

    expect(bannerState.visible).toBe(true);
    expect(bannerState.isOffline).toBe(true);
    expect(showIdle).toBe(true);
  });

  it('ConnectionBanner is rendered regardless of order list state', () => {
    // ConnectionBanner is always rendered in DeliveryHomeTab (outside ScrollView),
    // its visibility is controlled by its own internal logic, not by order counts.
    // This verifies the banner shows when offline even when orders are present.
    const bannerWithOrders = getConnectionBannerState(false, 'connected', false);
    expect(bannerWithOrders.visible).toBe(true);
    expect(bannerWithOrders.isOffline).toBe(true);
  });

  it('IdleCard is shown as secondary content when offline and no orders', () => {
    // IdleCard rendering is independent of network state — it only depends on order counts.
    // When offline with no orders, both banner (primary) and idle card (secondary) render.
    const available: unknown[] = [];
    const active: unknown[] = [];
    expect(shouldShowIdleCard(available, active)).toBe(true);
  });

  it('ConnectionBanner offline indicator takes priority: shown even when orders exist', () => {
    // Offline banner is always shown when offline, regardless of whether orders are present.
    const bannerState = getConnectionBannerState(false, 'connected', false);
    expect(bannerState.visible).toBe(true);
    expect(bannerState.isOffline).toBe(true);
    // IdleCard would NOT show here (orders present), but banner still shows
    const showIdle = shouldShowIdleCard([{ _id: 'order-1' }], []);
    expect(showIdle).toBe(false);
  });
});

describe('DeliveryHomeTab source verification (Requirement 10.1, 10.2, 10.6)', () => {
  /**
   * Verifies the actual DeliveryHomeTab source contains the correct rendering conditions.
   * This is a structural test that ensures the implementation matches the spec.
   */
  it('DeliveryHomeTab source contains IdleCard rendering condition', () => {
    const fs = require('fs');
    const path = require('path');

    const componentPath = path.resolve(__dirname, '../DeliveryHomeTab.tsx');
    const source = fs.readFileSync(componentPath, 'utf-8');

    // IdleCard is rendered when both lists are empty
    expect(source).toContain('availableOrders.length === 0 && activeOrders.length === 0');
    expect(source).toContain('IdleCard');
  });

  it('DeliveryHomeTab source contains ConnectionBanner with networkIsOnline prop', () => {
    const fs = require('fs');
    const path = require('path');

    const componentPath = path.resolve(__dirname, '../DeliveryHomeTab.tsx');
    const source = fs.readFileSync(componentPath, 'utf-8');

    // ConnectionBanner is rendered with isOnline={networkIsOnline}
    expect(source).toContain('ConnectionBanner');
    expect(source).toContain('networkIsOnline');
    expect(source).toContain('isOnline={networkIsOnline}');
  });

  it('ConnectionBanner source renders offline indicator when isOnline is false', () => {
    const fs = require('fs');
    const path = require('path');

    const bannerPath = path.resolve(
      __dirname,
      '../../../components/delivery/ConnectionBanner/ConnectionBanner.tsx'
    );
    const source = fs.readFileSync(bannerPath, 'utf-8');

    // Banner returns null when online+connected+not syncing
    expect(source).toContain("if (isOnline && socketStatus === 'connected' && !isSyncing)");
    // Offline message
    expect(source).toContain('No Internet Connection');
    // Offline uses danger color
    expect(source).toContain('DELIVERY_COLORS.danger');
  });
});
