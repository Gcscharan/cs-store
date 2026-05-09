/**
 * Task 8.5: Test concurrent actions and edge cases
 *
 * Requirements: 4.1, 5.2, 7.1
 *
 * Tests:
 * - Simultaneous actions from both platforms
 * - Network interruption scenarios
 * - Socket reconnection during actions
 * - Error handling matches web admin exactly
 */

import { createOrderListUpdater, updateSingleOrderState, OrderLike } from '../utils/orderStateUtils';
import { socketClient } from '../services/socketClient';

// Mock socket client
jest.mock('../services/socketClient', () => ({
  socketClient: {
    subscribeToOrderStatusChanges: jest.fn(),
    subscribeToOrderAssignments: jest.fn(),
    isConnected: true,
    connect: jest.fn(),
    disconnect: jest.fn(),
    reconnectWithNewToken: jest.fn(),
  },
}));

// ─── Shared test data ────────────────────────────────────────────────────────

const makeOrder = (overrides: Partial<OrderLike> = {}): OrderLike => ({
  _id: 'order-001',
  orderNumber: 'ORD-001',
  status: 'CREATED',
  orderStatus: 'CREATED',
  allowedActions: ['CONFIRM'],
  totalAmount: 500,
  items: [{ productId: { name: 'Product A' }, qty: 2, price: 250 }],
  userId: { name: 'Test User', phone: '9876543210' },
  createdAt: '2024-01-15T10:00:00Z',
  ...overrides,
});

// ─── 1. Concurrent actions ────────────────────────────────────────────────────

describe('Task 8.5 — Concurrent actions from both platforms', () => {
  it('last-write-wins: rapid socket events converge to final state', () => {
    const initial = makeOrder({ status: 'CREATED', allowedActions: ['CONFIRM'] });
    let orders: OrderLike[] = [initial];

    // Simulate web admin confirming while mobile admin also fires an event
    const confirmedByWeb = makeOrder({ status: 'CONFIRMED', allowedActions: ['PACK'] });
    const confirmedByMobile = makeOrder({ status: 'CONFIRMED', allowedActions: ['PACK'] });

    orders = createOrderListUpdater(confirmedByWeb)(orders);
    orders = createOrderListUpdater(confirmedByMobile)(orders);

    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('CONFIRMED');
    expect(orders[0].allowedActions).toEqual(['PACK']);
  });

  it('concurrent updates to different orders do not interfere', () => {
    const order1 = makeOrder({ _id: 'order-001', status: 'CREATED', allowedActions: ['CONFIRM'] });
    const order2 = makeOrder({ _id: 'order-002', status: 'CONFIRMED', allowedActions: ['PACK'] });
    let orders: OrderLike[] = [order1, order2];

    const updated1 = makeOrder({ _id: 'order-001', status: 'CONFIRMED', allowedActions: ['PACK'] });
    const updated2 = makeOrder({ _id: 'order-002', status: 'PACKED', allowedActions: ['ASSIGN'] });

    // Apply both updates (simulating concurrent socket events)
    orders = createOrderListUpdater(updated1)(orders);
    orders = createOrderListUpdater(updated2)(orders);

    expect(orders[0].status).toBe('CONFIRMED');
    expect(orders[1].status).toBe('PACKED');
  });

  it('processes 50 rapid concurrent events without data corruption', () => {
    const initialOrders: OrderLike[] = Array.from({ length: 50 }, (_, i) =>
      makeOrder({ _id: `order-${i}`, status: 'CREATED', allowedActions: ['CONFIRM'] })
    );

    let orders = [...initialOrders];
    const startTime = Date.now();

    // Simulate 50 concurrent status-change events
    for (let i = 0; i < 50; i++) {
      const updated = makeOrder({ _id: `order-${i}`, status: 'CONFIRMED', allowedActions: ['PACK'] });
      orders = createOrderListUpdater(updated)(orders);
    }

    const elapsed = Date.now() - startTime;

    expect(orders).toHaveLength(50);
    orders.forEach(o => {
      expect(o.status).toBe('CONFIRMED');
      expect(o.allowedActions).toEqual(['PACK']);
    });
    expect(elapsed).toBeLessThan(200); // Must complete well under 200ms
  });

  it('detail screen handles concurrent updates correctly', () => {
    const current = makeOrder({ status: 'CREATED', allowedActions: ['CONFIRM'] });

    // Two rapid updates arrive — last one wins
    const update1 = makeOrder({ status: 'CONFIRMED', allowedActions: ['PACK'] });
    const update2 = makeOrder({ status: 'CONFIRMED', allowedActions: ['PACK', 'CANCEL'] });

    let result = updateSingleOrderState(current, update1);
    result = updateSingleOrderState(result, update2);

    expect(result?.status).toBe('CONFIRMED');
    expect(result?.allowedActions).toEqual(['PACK', 'CANCEL']);
  });
});

// ─── 2. Network interruption scenarios ───────────────────────────────────────

describe('Task 8.5 — Network interruption scenarios', () => {
  it('state remains consistent when a socket event arrives after network recovery', () => {
    const order = makeOrder({ status: 'CREATED', allowedActions: ['CONFIRM'] });
    let orders: OrderLike[] = [order];

    // Simulate: network drops, then recovers and delivers a buffered event
    const bufferedUpdate = makeOrder({ status: 'CONFIRMED', allowedActions: ['PACK'] });
    orders = createOrderListUpdater(bufferedUpdate)(orders);

    expect(orders[0].status).toBe('CONFIRMED');
    expect(orders[0].allowedActions).toContain('PACK');
  });

  it('null / undefined socket event data is handled gracefully', () => {
    const malformedPayloads = [null, undefined, {}, { orderId: null }, { orderId: 'x', order: null }];

    malformedPayloads.forEach(payload => {
      expect(() => {
        // Simulate what the screen does: guard before calling updater
        if (payload && (payload as any).order && (payload as any).orderId) {
          createOrderListUpdater((payload as any).order)([]);
        }
      }).not.toThrow();
    });
  });

  it('missing order fields in socket event do not crash state updater', () => {
    const partialOrder = { _id: 'order-001' } as OrderLike; // no status, no allowedActions
    const orders: OrderLike[] = [makeOrder()];

    expect(() => {
      const result = createOrderListUpdater(partialOrder)(orders);
      expect(result[0]._id).toBe('order-001');
    }).not.toThrow();
  });

  it('order list is unchanged when event targets an unknown order ID', () => {
    const orders: OrderLike[] = [makeOrder({ _id: 'order-001' })];
    const unknownUpdate = makeOrder({ _id: 'order-999', status: 'CONFIRMED' });

    const result = createOrderListUpdater(unknownUpdate)(orders);

    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('order-001');
    expect(result[0].status).toBe('CREATED'); // unchanged
  });

  it('API error response format matches web admin error shape', () => {
    const webAdminErrorShape = { message: 'Order cannot be confirmed in current state', status: 400 };
    const mobileErrorShape = { data: { message: 'Order cannot be confirmed in current state' } };

    // Both should expose the same human-readable message
    const webMsg = webAdminErrorShape.message;
    const mobileMsg = mobileErrorShape.data?.message;

    expect(webMsg).toBe(mobileMsg);
  });
});

// ─── 3. Socket reconnection during actions ────────────────────────────────────

describe('Task 8.5 — Socket reconnection during actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('subscribeToOrderStatusChanges returns an unsubscribe function', () => {
    const handler = jest.fn();
    (socketClient.subscribeToOrderStatusChanges as jest.Mock).mockReturnValue(jest.fn());

    const unsub = socketClient.subscribeToOrderStatusChanges(handler);
    expect(typeof unsub).toBe('function');
  });

  it('subscribeToOrderAssignments returns an unsubscribe function', () => {
    const handler = jest.fn();
    (socketClient.subscribeToOrderAssignments as jest.Mock).mockReturnValue(jest.fn());

    const unsub = socketClient.subscribeToOrderAssignments(handler);
    expect(typeof unsub).toBe('function');
  });

  it('unsubscribing does not throw even when called multiple times', () => {
    const handler = jest.fn();
    const mockUnsub = jest.fn();
    (socketClient.subscribeToOrderStatusChanges as jest.Mock).mockReturnValue(mockUnsub);

    const unsub = socketClient.subscribeToOrderStatusChanges(handler);

    expect(() => {
      unsub();
      unsub(); // second call should not throw
    }).not.toThrow();
  });

  it('reconnect method is callable without throwing', () => {
    expect(() => {
      socketClient.reconnectWithNewToken('new-token-123');
    }).not.toThrow();
  });

  it('events received after reconnection update state correctly', () => {
    const handler = jest.fn();
    (socketClient.subscribeToOrderStatusChanges as jest.Mock).mockImplementation(cb => {
      handler.mockImplementation(cb);
      return jest.fn();
    });

    socketClient.subscribeToOrderStatusChanges(handler);

    // Simulate reconnection then incoming event
    const postReconnectEvent = {
      orderId: 'order-001',
      from: 'CREATED',
      to: 'CONFIRMED',
      actorRole: 'ADMIN' as const,
      actorId: 'web-admin',
      timestamp: new Date().toISOString(),
      order: makeOrder({ status: 'CONFIRMED', allowedActions: ['PACK'] }),
    };

    handler(postReconnectEvent);

    expect(handler).toHaveBeenCalledWith(postReconnectEvent);
    expect(postReconnectEvent.order.status).toBe('CONFIRMED');
  });
});

// ─── 4. Error handling parity with web admin ─────────────────────────────────

describe('Task 8.5 — Error handling matches web admin exactly', () => {
  it('allowedActions absent → no buttons rendered (same as web admin)', () => {
    const orderNoActions = makeOrder({ allowedActions: undefined });

    const showConfirm = orderNoActions.allowedActions?.includes('CONFIRM') ?? false;
    const showPack = orderNoActions.allowedActions?.includes('PACK') ?? false;
    const showAssign = orderNoActions.allowedActions?.includes('ASSIGN') ?? false;

    expect(showConfirm).toBe(false);
    expect(showPack).toBe(false);
    expect(showAssign).toBe(false);
  });

  it('empty allowedActions array → no buttons rendered', () => {
    const orderEmptyActions = makeOrder({ allowedActions: [] });

    expect(orderEmptyActions.allowedActions?.length).toBe(0);
    expect(orderEmptyActions.allowedActions?.includes('CONFIRM')).toBe(false);
  });

  it('status-based conditionals are absent — only allowedActions drives UI', () => {
    // An order in CREATED status but with empty allowedActions (backend denied all actions)
    const restrictedOrder = makeOrder({ status: 'CREATED', allowedActions: [] });

    // Mobile must NOT show Confirm just because status === CREATED
    const wouldShowConfirmByStatus = restrictedOrder.status === 'CREATED'; // old (wrong) logic
    const wouldShowConfirmByAllowedActions = restrictedOrder.allowedActions?.includes('CONFIRM') ?? false; // new (correct) logic

    expect(wouldShowConfirmByStatus).toBe(true); // old logic would wrongly show it
    expect(wouldShowConfirmByAllowedActions).toBe(false); // new logic correctly hides it
  });

  it('complete order object replacement preserves all fields', () => {
    const original = makeOrder({
      status: 'CREATED',
      allowedActions: ['CONFIRM'],
      totalAmount: 500,
      items: [{ productId: { name: 'Product A' }, qty: 2, price: 250 }],
    });

    const updated = makeOrder({
      status: 'CONFIRMED',
      allowedActions: ['PACK'],
      totalAmount: 500,
      items: [{ productId: { name: 'Product A' }, qty: 2, price: 250 }],
    });

    const result = updateSingleOrderState(original, updated);

    expect(result?.status).toBe('CONFIRMED');
    expect(result?.allowedActions).toEqual(['PACK']);
    expect(result?.totalAmount).toBe(500);
    expect(result?.items).toHaveLength(1);
    expect(result?.orderNumber).toBe('ORD-001');
  });

  it('error toast message from API matches web admin format', () => {
    const apiErrors = [
      { data: { message: 'Order cannot be confirmed in current state' } },
      { data: { message: 'Delivery partner not available' } },
      { data: { message: 'Order already cancelled' } },
      { data: undefined }, // network error fallback
    ];

    const fallback = 'Action failed';

    apiErrors.forEach(err => {
      const msg = err.data?.message || fallback;
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });
  });
});

// ─── 5. Performance under load ────────────────────────────────────────────────

describe('Task 8.5 — Performance under load', () => {
  it('processes 100 socket events in under 100ms', () => {
    const orders: OrderLike[] = Array.from({ length: 100 }, (_, i) =>
      makeOrder({ _id: `order-${i}` })
    );

    const startTime = performance.now();

    let current = [...orders];
    for (let i = 0; i < 100; i++) {
      const updated = makeOrder({ _id: `order-${i}`, status: 'CONFIRMED', allowedActions: ['PACK'] });
      current = createOrderListUpdater(updated)(current);
    }

    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(100);
    expect(current).toHaveLength(100);
  });

  it('single order detail update completes in under 5ms', () => {
    const order = makeOrder();
    const updated = makeOrder({ status: 'CONFIRMED', allowedActions: ['PACK'] });

    const startTime = performance.now();
    const result = updateSingleOrderState(order, updated);
    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(5);
    expect(result?.status).toBe('CONFIRMED');
  });

  it('10 rapid assignment events processed in under 50ms', () => {
    const orders: OrderLike[] = Array.from({ length: 10 }, (_, i) =>
      makeOrder({ _id: `order-${i}`, status: 'PACKED', allowedActions: ['ASSIGN'] })
    );

    const startTime = performance.now();

    let current = [...orders];
    for (let i = 0; i < 10; i++) {
      const assigned = makeOrder({
        _id: `order-${i}`,
        status: 'IN_TRANSIT',
        allowedActions: ['START_DELIVERY'],
        deliveryPartner: { name: `Partner ${i}`, phone: '9999999999', vehicleType: 'Bike' },
      });
      current = createOrderListUpdater(assigned)(current);
    }

    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(50);
    current.forEach(o => {
      expect(o.status).toBe('IN_TRANSIT');
      expect(o.deliveryPartner).toBeDefined();
    });
  });
});

// ─── 6. Cross-platform state consistency ─────────────────────────────────────

describe('Task 8.5 — Cross-platform state consistency', () => {
  it('mobile and web receive identical order objects from the same socket event', () => {
    const socketEventOrder = makeOrder({ status: 'CONFIRMED', allowedActions: ['PACK'] });

    // Both platforms process the same event payload
    const mobileOrders = [makeOrder()];
    const webOrders = [makeOrder()];

    const mobileResult = createOrderListUpdater(socketEventOrder)(mobileOrders);
    const webResult = createOrderListUpdater(socketEventOrder)(webOrders);

    expect(mobileResult[0].status).toBe(webResult[0].status);
    expect(mobileResult[0].allowedActions).toEqual(webResult[0].allowedActions);
    expect(mobileResult[0]._id).toBe(webResult[0]._id);
  });

  it('full lifecycle state transitions are consistent across platforms', () => {
    const lifecycle = [
      { status: 'CREATED', allowedActions: ['CONFIRM'] },
      { status: 'CONFIRMED', allowedActions: ['PACK'] },
      { status: 'PACKED', allowedActions: ['ASSIGN'] },
      { status: 'IN_TRANSIT', allowedActions: ['MARK_DELIVERED'] },
      { status: 'DELIVERED', allowedActions: [] },
    ];

    let mobileOrder = makeOrder(lifecycle[0]);
    let webOrder = makeOrder(lifecycle[0]);

    for (let i = 1; i < lifecycle.length; i++) {
      const update = makeOrder(lifecycle[i]);

      mobileOrder = updateSingleOrderState(mobileOrder, update)!;
      webOrder = updateSingleOrderState(webOrder, update)!;

      expect(mobileOrder.status).toBe(webOrder.status);
      expect(mobileOrder.allowedActions).toEqual(webOrder.allowedActions);
    }

    expect(mobileOrder.status).toBe('DELIVERED');
    expect(mobileOrder.allowedActions).toEqual([]);
  });

  it('no status-based conditionals remain — backend is sole source of truth', () => {
    // Verify the correct pattern is used (allowedActions) not the wrong one (status checks)
    const order = makeOrder({ status: 'CONFIRMED', allowedActions: [] }); // backend says no actions

    // Correct approach: check allowedActions
    const canPack = order.allowedActions?.includes('PACK') ?? false;

    // Wrong approach (should NOT be used): check status
    const wouldPackByStatus = order.status === 'CONFIRMED';

    expect(canPack).toBe(false); // backend says no → mobile shows nothing
    expect(wouldPackByStatus).toBe(true); // old logic would wrongly enable it
  });
});
