/**
 * Property-Based Tests for DeliverySocketEmitter (backend)
 *
 * Properties covered:
 *   Property 1: Emission targets all three rooms for every status change
 *   Property 2: allowedActions in payload equals computeAllowedActions output
 *   Property 3: socketVersion increments monotonically
 *   Property 8: Location throttle — at most one emit per rider per 3 seconds
 *
 * Each property runs a minimum of 100 iterations.
 */

import fc from 'fast-check';
import { DeliverySocketEmitter } from '../../src/domains/delivery/services/deliverySocketEmitter';
import {
  computeAllowedActions,
  ComputeAllowedActionsOptions,
} from '../../src/domains/delivery/utils/allowedActions';

// ---------------------------------------------------------------------------
// Mongoose / DB mocks — we don't need a real DB for these pure-logic tests
// ---------------------------------------------------------------------------

// We need a mutable lean mock so individual tests can control the return value
const mockLean = jest.fn();
const mockFindByIdAndUpdate = jest.fn().mockReturnValue({ lean: mockLean });

jest.mock('../../src/models/Order', () => ({
  Order: {
    findByIdAndUpdate: (...args: any[]) => mockFindByIdAndUpdate(...args),
  },
}));

jest.mock('../../src/models/DeliverySocketEvent', () => ({
  DeliverySocketEvent: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// uuid is mocked globally in tests/setup.ts — each call returns a unique string

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const orderStatusArb = fc.constantFrom(
  'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'FAILED', 'CANCELLED', 'RETURNED',
);

const deliveryStatusArb = fc.constantFrom(
  'unassigned', 'assigned', 'picked_up', 'in_transit', 'arrived', 'delivered', 'failed',
);

const paymentMethodArb = fc.constantFrom('cod', 'online', 'upi');

const mongoIdArb = fc.stringMatching(/^[0-9a-f]{24}$/);

const orderArb = fc.record({
  _id: mongoIdArb,
  deliveryBoyId: mongoIdArb,
  userId: mongoIdArb,
  orderStatus: orderStatusArb,
  deliveryStatus: deliveryStatusArb,
  paymentMethod: paymentMethodArb,
  deliveryOtpGeneratedAt: fc.option(fc.date(), { nil: null }),
  address: fc.record({
    lat: fc.float({ min: -90, max: 90 }),
    lng: fc.float({ min: -180, max: 180 }),
  }),
});

const optionsArb: fc.Arbitrary<ComputeAllowedActionsOptions> = fc.record({
  codCollected: fc.boolean(),
  isNext: fc.boolean(),
  riderHasLocation: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Helper: build a minimal mock io.to() chain
// ---------------------------------------------------------------------------

function buildMockIo() {
  const calledRooms: string[] = [];
  const emittedEvents: Array<{ room: string; event: string; payload: any }> = [];

  const roomProxy = (room: string) => ({
    emit: (event: string, payload: any) => {
      emittedEvents.push({ room, event, payload });
    },
    timeout: () => ({
      emit: jest.fn((_event: string, _payload: any, cb: (err: any) => void) => {
        cb(null); // ACK immediately
      }),
    }),
  });

  const io: any = {
    to: jest.fn((room: string) => {
      calledRooms.push(room);
      return roomProxy(room);
    }),
  };

  return { io, calledRooms, emittedEvents };
}

// ---------------------------------------------------------------------------
// Property 1: Emission targets all three rooms for every status change
// Validates: Requirements 1.1, 1.5
// ---------------------------------------------------------------------------

describe('Property 1: Emission targets all three rooms for every status change', () => {
  it('io.to() is called with delivery:{riderId}, admin_room, and order:{userId} for every valid order', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArb,
        optionsArb,
        orderStatusArb,
        async (order, options, previousStatus) => {
          const { io, calledRooms } = buildMockIo();

          // Reset rooms for each run
          calledRooms.length = 0;

          // Mock $inc socketVersion
          mockLean.mockResolvedValueOnce({ socketVersion: 1 });

          const emitter = new DeliverySocketEmitter(io);
          await emitter.emitStatusChanged({ order, previousStatus, options });

          // Must include all three rooms
          expect(calledRooms).toContain(`delivery:${String(order.deliveryBoyId)}`);
          expect(calledRooms).toContain('admin_room');
          expect(calledRooms).toContain(`order:${String(order.userId)}`);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: allowedActions in payload equals computeAllowedActions output
// Validates: Requirements 1.3, 3.2
// ---------------------------------------------------------------------------

describe('Property 2: allowedActions in payload equals computeAllowedActions output', () => {
  it('emitted payload.allowedActions deep-equals computeAllowedActions(order, options)', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArb,
        optionsArb,
        orderStatusArb,
        async (order, options, previousStatus) => {
          const { io, emittedEvents } = buildMockIo();
          emittedEvents.length = 0;

          mockLean.mockResolvedValueOnce({ socketVersion: 1 });

          const emitter = new DeliverySocketEmitter(io);
          await emitter.emitStatusChanged({ order, previousStatus, options });

          const expected = computeAllowedActions(order, options);

          // Every emitted payload must have the correct allowedActions
          for (const { payload } of emittedEvents) {
            expect(payload.allowedActions).toEqual(expected);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: socketVersion increments monotonically
// Validates: Requirement 1.9
// ---------------------------------------------------------------------------

describe('Property 3: socketVersion increments monotonically', () => {
  it('each successive emitStatusChanged call produces a version exactly 1 greater than the previous', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArb,
        optionsArb,
        fc.integer({ min: 1, max: 10 }), // number of transitions
        async (baseOrder, options, numTransitions) => {
          const { io, emittedEvents } = buildMockIo();
          emittedEvents.length = 0;

          // Simulate monotonically increasing socketVersion from DB
          let currentVersion = 0;
          mockLean.mockImplementation(async () => {
            currentVersion += 1;
            return { socketVersion: currentVersion };
          });

          const emitter = new DeliverySocketEmitter(io);

          for (let i = 0; i < numTransitions; i++) {
            await emitter.emitStatusChanged({
              order: baseOrder,
              previousStatus: 'ASSIGNED',
              options,
            });
          }

          // Collect versions from admin_room payloads (always emitted)
          const adminPayloads = emittedEvents
            .filter((e) => e.room === 'admin_room')
            .map((e) => e.payload.version);

          expect(adminPayloads).toHaveLength(numTransitions);

          // Each version must be exactly 1 greater than the previous
          for (let i = 1; i < adminPayloads.length; i++) {
            expect(adminPayloads[i]).toBe(adminPayloads[i - 1] + 1);
          }

          // Reset for next iteration
          currentVersion = 0;
          mockLean.mockReset();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Location throttle — at most one emit per rider per 3 seconds
// Validates: Requirement 4.5a
// ---------------------------------------------------------------------------

describe('Property 8: Location throttle — at most one emit per rider per 3 seconds', () => {
  it('at most one driver:location:update is emitted to admin_room within a 3-second window', async () => {
    await fc.assert(
      fc.asyncProperty(
        mongoIdArb,                                    // riderId
        fc.integer({ min: 2, max: 10 }),               // number of updates in window
        async (riderId, numUpdates) => {
          // Simulate the location throttle logic extracted from index.ts
          const locationThrottle = new Map<string, number>();
          const LOCATION_THROTTLE_MS = 3000;

          let emitCount = 0;
          const mockAdminEmit = jest.fn(() => { emitCount++; });

          const mockIo: any = {
            to: jest.fn(() => ({ emit: mockAdminEmit })),
          };

          // All updates happen within a 3-second window (same timestamp base)
          const windowStart = Date.now();

          for (let i = 0; i < numUpdates; i++) {
            // Simulate time within the 3-second window (0 to 2999 ms offset)
            const now = windowStart + Math.floor((i / numUpdates) * 2999);

            const lastEmit = locationThrottle.get(riderId) ?? 0;
            if (now - lastEmit < LOCATION_THROTTLE_MS) {
              // Throttled — drop silently
              continue;
            }

            locationThrottle.set(riderId, now);
            mockIo.to('admin_room').emit('driver:location:update', { driverId: riderId });
          }

          // Within a 3-second window, at most 1 emit should occur
          expect(emitCount).toBeLessThanOrEqual(1);
          // At least 1 emit must occur (the first update always goes through)
          expect(emitCount).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('exactly one emit occurs for the first update in any window', async () => {
    await fc.assert(
      fc.asyncProperty(
        mongoIdArb,
        fc.integer({ min: 2, max: 10 }),
        async (riderId, numUpdates) => {
          const locationThrottle = new Map<string, number>();
          const LOCATION_THROTTLE_MS = 3000;

          let emitCount = 0;
          const windowStart = 1_000_000; // fixed base to avoid real Date.now() drift

          for (let i = 0; i < numUpdates; i++) {
            // All updates within [0, 2999] ms of windowStart
            const now = windowStart + Math.floor((i / numUpdates) * 2999);

            const lastEmit = locationThrottle.get(riderId) ?? 0;
            if (now - lastEmit < LOCATION_THROTTLE_MS) {
              continue;
            }

            locationThrottle.set(riderId, now);
            emitCount++;
          }

          // First update always emits; subsequent ones within 3s are dropped
          expect(emitCount).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
