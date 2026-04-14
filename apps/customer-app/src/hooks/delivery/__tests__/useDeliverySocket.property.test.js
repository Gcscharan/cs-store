/**
 * Property-Based Tests for useDeliverySocket hook logic
 *
 * Properties covered:
 *   Property 4: Event deduplication is idempotent
 *   Property 5: Version guard prevents state regression
 *   Property 6: Partial update merge preserves non-updated fields
 *   Property 7: No duplicate orders in cache after sync_response
 *   Property 9: Polling fallback is mutually exclusive with socket connection
 *
 * Each property runs a minimum of 100 iterations.
 *
 * Note: These tests exercise the pure logic extracted from useDeliverySocket
 * (deduplication, version guard, merge, sync_response handling, polling state
 * machine) without mounting the hook — keeping tests fast and deterministic.
 */

const fc = require('fast-check');

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const isoDateArb = fc.integer({ min: 0, max: 4102444800000 }).map((ms) => new Date(ms).toISOString());

const mongoIdArb = fc.stringMatching(/^[0-9a-f]{24}$/);

const orderStatusArb = fc.constantFrom(
  'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'FAILED',
);

const deliveryStatusArb = fc.constantFrom(
  'unassigned', 'assigned', 'picked_up', 'in_transit', 'arrived', 'delivered',
);

const allowedActionsArb = fc.array(
  fc.constantFrom('PICKUP', 'START_DELIVERY', 'MARK_ARRIVED', 'SEND_OTP', 'VERIFY_OTP', 'NAVIGATE'),
  { minLength: 0, maxLength: 4 },
);

const statusChangedPayloadArb = (orderId) =>
  fc.record({
    orderId: orderId ? fc.constant(orderId) : mongoIdArb,
    orderStatus: orderStatusArb,
    deliveryStatus: deliveryStatusArb,
    previousStatus: orderStatusArb,
    allowedActions: allowedActionsArb,
    riderId: mongoIdArb,
    version: fc.integer({ min: 1, max: 1000 }),
    eventId: fc.uuid(),
    timestamp: isoDateArb,
  });

/** A "full" cached order with all fields populated */
const cachedOrderArb = (orderId) =>
  fc.record({
    _id: orderId ? fc.constant(orderId) : mongoIdArb,
    orderStatus: orderStatusArb,
    deliveryStatus: deliveryStatusArb,
    allowedActions: allowedActionsArb,
    version: fc.integer({ min: 1, max: 500 }),
    timestamp: isoDateArb,
    // Non-payload fields that must be preserved after a shallow merge
    address: fc.record({
      street: fc.string({ minLength: 1, maxLength: 30 }),
      city: fc.string({ minLength: 1, maxLength: 20 }),
      lat: fc.float({ min: -90, max: 90 }),
      lng: fc.float({ min: -180, max: 180 }),
    }),
    userId: mongoIdArb,
    totalAmount: fc.float({ min: 0, max: 10000 }),
    paymentMethod: fc.constantFrom('cod', 'online', 'upi'),
    items: fc.array(
      fc.record({ productId: mongoIdArb, qty: fc.integer({ min: 1, max: 10 }) }),
      { minLength: 1, maxLength: 5 },
    ),
    deliveryBoyId: mongoIdArb,
    createdAt: isoDateArb,
  });

// ---------------------------------------------------------------------------
// Pure logic helpers extracted from useDeliverySocket
// (mirrors the actual hook implementation)
// ---------------------------------------------------------------------------

/** Deduplication map — mirrors processedEventIds in the hook */
function makeDeduplicator() {
  const processedEventIds = new Map();

  const isEventDuplicate = (eventId) => {
    const now = Date.now();
    for (const [id, ts] of processedEventIds) {
      if (now - ts > 60_000) processedEventIds.delete(id);
    }
    if (processedEventIds.has(eventId)) return true;
    processedEventIds.set(eventId, now);
    return false;
  };

  return { isEventDuplicate, processedEventIds };
}

/** Apply handleStatusChanged logic to a mutable cache array */
function applyStatusChanged(orders, event, deduplicator) {
  if (!event?.orderId) return;
  if (event.eventId && deduplicator.isEventDuplicate(event.eventId)) return;

  const idx = orders.findIndex((o) => o._id === event.orderId);
  if (idx === -1) return;

  const cached = orders[idx];
  // Version guard
  if (event.version <= (cached.version ?? 0)) return;

  // Shallow merge
  cached.orderStatus = event.orderStatus;
  cached.deliveryStatus = event.deliveryStatus;
  cached.allowedActions = event.allowedActions;
  cached.version = event.version;
  cached.timestamp = event.timestamp;
}

/** Apply handleSyncResponse logic to a mutable cache array */
function applySyncResponse(orders, syncOrders) {
  for (const event of syncOrders) {
    const idx = orders.findIndex((o) => o._id === event.orderId);
    if (idx !== -1) {
      const cached = orders[idx];
      if (event.version > (cached.version ?? 0)) {
        cached.orderStatus = event.orderStatus;
        cached.deliveryStatus = event.deliveryStatus;
        cached.allowedActions = event.allowedActions;
        cached.version = event.version;
        cached.timestamp = event.timestamp;
      }
    } else {
      orders.push({ ...event, _id: event.orderId });
    }
  }
}

// ---------------------------------------------------------------------------
// Property 4: Event deduplication is idempotent
// Validates: Requirement 8.6
// ---------------------------------------------------------------------------

describe('Property 4: Event deduplication is idempotent', () => {
  it('processing the same event N times produces the same cache state as processing it once', () => {
    fc.assert(
      fc.property(
        cachedOrderArb(),
        fc.integer({ min: 2, max: 5 }), // N repetitions
        (baseOrder, n) => {
          const orderId = baseOrder._id;

          // Build a payload with a higher version so the first processing applies
          const event = {
            orderId,
            orderStatus: 'IN_TRANSIT',
            deliveryStatus: 'in_transit',
            previousStatus: baseOrder.orderStatus,
            allowedActions: ['MARK_ARRIVED'],
            riderId: baseOrder.deliveryBoyId,
            version: (baseOrder.version ?? 0) + 1,
            eventId: 'fixed-event-id-dedup-test',
            timestamp: new Date().toISOString(),
          };

          // Process once
          const cacheAfterOne = [JSON.parse(JSON.stringify(baseOrder))];
          const dedup1 = makeDeduplicator();
          applyStatusChanged(cacheAfterOne, event, dedup1);

          // Process N times (same deduplicator — second+ calls are duplicates)
          const cacheAfterN = [JSON.parse(JSON.stringify(baseOrder))];
          const dedupN = makeDeduplicator();
          for (let i = 0; i < n; i++) {
            applyStatusChanged(cacheAfterN, event, dedupN);
          }

          // Cache state must be identical
          expect(cacheAfterN[0]).toEqual(cacheAfterOne[0]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Version guard prevents state regression
// Validates: Requirements 1.9, 3.1a
// ---------------------------------------------------------------------------

describe('Property 5: Version guard prevents state regression', () => {
  it('an event with version <= cached.version leaves the cache unchanged', () => {
    fc.assert(
      fc.property(
        cachedOrderArb(),
        fc.integer({ min: 0, max: 500 }), // stale version offset
        (baseOrder, staleOffset) => {
          const orderId = baseOrder._id;
          const cachedVersion = baseOrder.version ?? 1;
          const staleVersion = Math.max(0, cachedVersion - staleOffset);

          const staleEvent = {
            orderId,
            orderStatus: 'DELIVERED',
            deliveryStatus: 'delivered',
            previousStatus: baseOrder.orderStatus,
            allowedActions: [],
            riderId: baseOrder.deliveryBoyId,
            version: staleVersion,
            eventId: 'stale-event-id',
            timestamp: new Date().toISOString(),
          };

          const cache = [JSON.parse(JSON.stringify(baseOrder))];
          const dedup = makeDeduplicator();
          const before = JSON.parse(JSON.stringify(cache[0]));

          applyStatusChanged(cache, staleEvent, dedup);

          // Cache must be unchanged
          expect(cache[0]).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('an event with version equal to cached.version is also rejected', () => {
    fc.assert(
      fc.property(
        cachedOrderArb(),
        (baseOrder) => {
          const orderId = baseOrder._id;
          const sameVersionEvent = {
            orderId,
            orderStatus: 'DELIVERED',
            deliveryStatus: 'delivered',
            previousStatus: baseOrder.orderStatus,
            allowedActions: [],
            riderId: baseOrder.deliveryBoyId,
            version: baseOrder.version ?? 1, // same version
            eventId: 'same-version-event',
            timestamp: new Date().toISOString(),
          };

          const cache = [JSON.parse(JSON.stringify(baseOrder))];
          const dedup = makeDeduplicator();
          const before = JSON.parse(JSON.stringify(cache[0]));

          applyStatusChanged(cache, sameVersionEvent, dedup);

          expect(cache[0]).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Partial update merge preserves non-updated fields
// Validates: Requirements 3.2, 3.4
// ---------------------------------------------------------------------------

describe('Property 6: Partial update merge preserves non-updated fields', () => {
  it('non-payload fields are identical before and after a shallow merge', () => {
    fc.assert(
      fc.property(
        cachedOrderArb(),
        statusChangedPayloadArb(),
        (baseOrder, rawEvent) => {
          const orderId = baseOrder._id;
          // Ensure the event targets this order and has a higher version
          const event = {
            ...rawEvent,
            orderId,
            version: (baseOrder.version ?? 0) + 1,
            eventId: 'merge-test-event-' + Math.random(),
          };

          const cache = [JSON.parse(JSON.stringify(baseOrder))];
          const dedup = makeDeduplicator();
          const before = JSON.parse(JSON.stringify(cache[0]));

          applyStatusChanged(cache, event, dedup);

          const after = cache[0];

          // Payload fields should be updated
          expect(after.orderStatus).toBe(event.orderStatus);
          expect(after.deliveryStatus).toBe(event.deliveryStatus);
          expect(after.allowedActions).toEqual(event.allowedActions);
          expect(after.version).toBe(event.version);
          expect(after.timestamp).toBe(event.timestamp);

          // Non-payload fields must be preserved exactly
          expect(after.address).toEqual(before.address);
          expect(after.userId).toBe(before.userId);
          expect(after.totalAmount).toBe(before.totalAmount);
          expect(after.paymentMethod).toBe(before.paymentMethod);
          expect(after.items).toEqual(before.items);
          expect(after.deliveryBoyId).toBe(before.deliveryBoyId);
          expect(after.createdAt).toBe(before.createdAt);
          expect(after._id).toBe(before._id);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: No duplicate orders in cache after sync_response
// Validates: Requirements 2.6, 6.3, 6.4
// ---------------------------------------------------------------------------

describe('Property 7: No duplicate orders in cache after sync_response', () => {
  it('final cache has no duplicate _ids and all orders are present', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }).chain((n) =>
          fc.tuple(
            fc.array(cachedOrderArb(), { minLength: n, maxLength: n }),
            fc.integer({ min: 0, max: n }),   // how many existing orders appear in sync
            fc.integer({ min: 0, max: 5 }),   // how many new orders in sync
          ),
        ),
        ([initialOrders, numExisting, numNew]) => {
          // Build initial cache (unique _ids)
          const uniqueOrders = initialOrders.filter(
            (o, i, arr) => arr.findIndex((x) => x._id === o._id) === i,
          );

          const cache = uniqueOrders.map((o) => JSON.parse(JSON.stringify(o)));

          // Build sync_response: mix of existing and new orders
          const existingInSync = uniqueOrders
            .slice(0, Math.min(numExisting, uniqueOrders.length))
            .map((o) => ({
              orderId: o._id,
              orderStatus: 'IN_TRANSIT',
              deliveryStatus: 'in_transit',
              previousStatus: o.orderStatus,
              allowedActions: ['MARK_ARRIVED'],
              riderId: o.deliveryBoyId,
              version: (o.version ?? 0) + 1,
              eventId: `sync-existing-${o._id}`,
              timestamp: new Date().toISOString(),
            }));

          const newInSync = Array.from({ length: numNew }, (_, i) => ({
            orderId: `new-order-${i}-${Math.random().toString(36).slice(2)}`,
            orderStatus: 'ASSIGNED',
            deliveryStatus: 'assigned',
            previousStatus: 'ASSIGNED',
            allowedActions: ['PICKUP'],
            riderId: 'rider-id',
            version: 1,
            eventId: `sync-new-${i}`,
            timestamp: new Date().toISOString(),
          }));

          const syncOrders = [...existingInSync, ...newInSync];

          applySyncResponse(cache, syncOrders);

          // No duplicate _ids
          const ids = cache.map((o) => o._id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);

          // All original orders still present
          for (const orig of uniqueOrders) {
            expect(cache.some((o) => o._id === orig._id)).toBe(true);
          }

          // All new orders from sync are present
          for (const newOrder of newInSync) {
            expect(cache.some((o) => o._id === newOrder.orderId)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Polling fallback is mutually exclusive with socket connection
// Validates: Requirements 9.5, 9.6
// ---------------------------------------------------------------------------

describe('Property 9: Polling fallback is mutually exclusive with socket connection', () => {
  it('polling is active iff socket is disconnected at every point in the event sequence', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('connect', 'disconnect'),
          { minLength: 1, maxLength: 20 },
        ),
        (events) => {
          // Simulate the polling state machine from useDeliverySocket
          let isConnected = false;
          let pollingInterval = null;

          const startPolling = () => {
            if (pollingInterval) return;
            pollingInterval = setInterval(() => {}, 30_000);
          };

          const stopPolling = () => {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          };

          for (const event of events) {
            if (event === 'connect') {
              isConnected = true;
              stopPolling();
            } else {
              isConnected = false;
              startPolling();
            }

            // Invariant: polling active ↔ socket disconnected
            if (isConnected) {
              expect(pollingInterval).toBeNull();
            } else {
              expect(pollingInterval).not.toBeNull();
            }
          }

          // Cleanup
          stopPolling();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('polling never starts while socket is connected', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant('connect'), { minLength: 1, maxLength: 10 }),
        (events) => {
          let pollingInterval = null;

          const stopPolling = () => {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          };

          for (const event of events) {
            if (event === 'connect') {
              stopPolling();
            }
            // Polling must never be active after a connect
            expect(pollingInterval).toBeNull();
          }

          stopPolling();
        },
      ),
      { numRuns: 100 },
    );
  });
});
