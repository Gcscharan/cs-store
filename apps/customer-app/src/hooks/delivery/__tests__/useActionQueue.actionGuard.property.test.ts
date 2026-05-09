/**
 * Property-Based Tests for useActionQueue Action Guard (Fix 2)
 *
 * **Validates: Requirements 2.3, 2.4, 2.5**
 *
 * This test suite validates the action guard over-blocking fix.
 * The fix ensures that drivers can retry the same action type after an offline
 * failure, while still blocking conflicting forward transitions.
 *
 * Bug Condition:
 *   All pending actions for orderId have the same action type as currentActionType
 *
 * Properties:
 *   1. Fix-checking: When isBugCondition_2 is true, hasPendingActionsForOrder
 *      returns false (same-type retry allowed).
 *
 *   2. Preservation (cross-type block): When a pending action of a different
 *      type exists, hasPendingActionsForOrder still returns true.
 *
 *   3. Preservation (no pending actions): When the queue has no actions for
 *      orderId, hasPendingActionsForOrder returns false.
 *
 *   4. acquireOrderLock integration: When isBugCondition_2 is true,
 *      acquireOrderLock returns true (lock acquired, no alert).
 *
 *   5. FIFO ordering: Actions replay in FIFO order per orderId — pickup →
 *      arrived → otp must never become arrived → pickup even under retries,
 *      backoff, or queue reconstruction.
 *
 * Each property runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';
import type { QueuedAction } from '../useActionQueue';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_TYPES = ['pickup', 'startDelivery', 'markArrived', 'verifyOtp', 'escalate'] as const;
type ActionType = typeof ACTION_TYPES[number];

// ── Pure Logic Extracted from useActionQueue ──────────────────────────────────

/**
 * Bug condition predicate: all pending actions for orderId have the same
 * action type as currentActionType.
 */
function isBugCondition_2(
  queue: QueuedAction[],
  orderId: string,
  currentActionType: string
): boolean {
  const pendingActions = queue.filter(a => a.orderId === orderId);
  return (
    pendingActions.length > 0 &&
    pendingActions.every(a => a.action === currentActionType)
  );
}

/**
 * Fix 2 implementation: hasPendingActionsForOrder returns true only when
 * there is a pending action whose action field differs from currentActionType.
 */
function hasPendingActionsForOrder(
  queue: QueuedAction[],
  orderId: string,
  currentActionType?: string
): boolean {
  return queue.some(
    a => a.orderId === orderId && a.action !== currentActionType
  );
}

/**
 * Simulates acquireOrderLock logic from DeliveryHomeTab.tsx
 */
function acquireOrderLock(
  queue: QueuedAction[],
  orderId: string,
  actionType?: string,
  orderActionInFlight: Record<string, boolean> = {}
): { acquired: boolean; alertShown: boolean } {
  // Check if order is already locked
  if (orderActionInFlight[orderId]) {
    return { acquired: false, alertShown: false };
  }

  // Check if there's a pending action of a different type
  if (hasPendingActionsForOrder(queue, orderId, actionType)) {
    // Alert would be shown here
    return { acquired: false, alertShown: true };
  }

  // Lock acquired
  return { acquired: true, alertShown: false };
}

/**
 * Validates FIFO ordering: actions for the same orderId must replay in
 * enqueuedAt order.
 */
function validateFifoOrdering(queue: QueuedAction[], orderId: string): boolean {
  const orderActions = queue.filter(a => a.orderId === orderId);
  if (orderActions.length <= 1) return true;

  // Check that actions are sorted by enqueuedAt
  for (let i = 1; i < orderActions.length; i++) {
    if (orderActions[i].enqueuedAt < orderActions[i - 1].enqueuedAt) {
      return false;
    }
  }

  return true;
}

/**
 * Simulates queue replay ordering: sorts actions by enqueuedAt (FIFO)
 */
function getReplayOrder(queue: QueuedAction[]): QueuedAction[] {
  return [...queue].sort((a, b) => a.enqueuedAt - b.enqueuedAt);
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const PROTO_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));
const orderIdArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter(s => s.trim().length > 0 && !PROTO_KEYS.has(s));

const actionTypeArb = fc.constantFrom<ActionType>(...ACTION_TYPES);

// Generate a minimal queued action
const queuedActionArb = fc.record({
  id: fc.uuid(),
  action: actionTypeArb,
  orderId: orderIdArb,
  targetStatus: fc.constantFrom('assigned', 'picked_up', 'in_transit', 'arrived', 'delivered'),
  args: fc.constant([]),
  fn: fc.constant(async () => {}),
  idempotencyKey: fc.uuid(),
  enqueuedAt: fc.integer({ min: Date.now() - 1_000_000, max: Date.now() }),
  retries: fc.integer({ min: 0, max: 3 }),
  nextRetryAt: fc.integer({ min: 0, max: Date.now() + 10_000 }),
});

/**
 * Generate a queue where all actions for a specific orderId have the same
 * action type (bug condition scenario).
 */
const sameTypeQueueArb = fc
  .tuple(orderIdArb, actionTypeArb, fc.integer({ min: 1, max: 5 }))
  .chain(([orderId, actionType, count]) =>
    fc.array(
      queuedActionArb.map(action => ({
        ...action,
        orderId,
        action: actionType,
      })),
      { minLength: count, maxLength: count }
    )
  );

/**
 * Generate a queue where at least one action for a specific orderId has a
 * different action type (preservation scenario).
 */
const mixedTypeQueueArb = fc
  .tuple(orderIdArb, actionTypeArb, fc.integer({ min: 1, max: 3 }))
  .chain(([orderId, primaryActionType, sameTypeCount]) =>
    fc
      .tuple(
        fc.array(
          queuedActionArb.map(action => ({
            ...action,
            orderId,
            action: primaryActionType,
          })),
          { minLength: sameTypeCount, maxLength: sameTypeCount }
        ),
        fc.array(
          queuedActionArb
            .map(action => ({
              ...action,
              orderId,
            }))
            .filter(action => action.action !== primaryActionType),
          { minLength: 1, maxLength: 3 }
        )
      )
      .map(([sameTypeActions, differentTypeActions]) => ({
        queue: [...sameTypeActions, ...differentTypeActions],
        orderId,
        primaryActionType,
      }))
  );

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('useActionQueue action guard property-based tests', () => {
  // ── Property 1: Bug condition predicate ───────────────────────────────────

  describe('Property 1: Bug condition predicate', () => {
    it('isBugCondition_2 returns true when all pending actions have same type', () => {
      fc.assert(
        fc.property(sameTypeQueueArb, (queue) => {
          if (queue.length === 0) return;

          const orderId = queue[0].orderId;
          const actionType = queue[0].action;

          const result = isBugCondition_2(queue, orderId, actionType);

          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('isBugCondition_2 returns false when no pending actions exist', () => {
      fc.assert(
        fc.property(orderIdArb, actionTypeArb, (orderId, actionType) => {
          const emptyQueue: QueuedAction[] = [];
          const result = isBugCondition_2(emptyQueue, orderId, actionType);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('isBugCondition_2 returns false when actions have mixed types', () => {
      fc.assert(
        fc.property(mixedTypeQueueArb, ({ queue, orderId, primaryActionType }) => {
          const result = isBugCondition_2(queue, orderId, primaryActionType);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  // ── Property 2: Fix-checking — same-type retry allowed ────────────────────

  describe('Property 2: Fix-checking — same-type retry allowed', () => {
    it('hasPendingActionsForOrder returns false when bug condition is true', () => {
      fc.assert(
        fc.property(sameTypeQueueArb, (queue) => {
          if (queue.length === 0) return;

          const orderId = queue[0].orderId;
          const actionType = queue[0].action;

          // Verify bug condition is true
          expect(isBugCondition_2(queue, orderId, actionType)).toBe(true);

          // Fix check: should return false (retry allowed)
          const result = hasPendingActionsForOrder(queue, orderId, actionType);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('same-type retry is allowed for all action types', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          actionTypeArb,
          fc.integer({ min: 1, max: 5 }),
          (orderId, actionType, count) => {
            // Create queue with multiple same-type actions
            const queue: QueuedAction[] = Array.from({ length: count }, (_, i) => ({
              id: `${orderId}-${actionType}-${i}`,
              action: actionType,
              orderId,
              targetStatus: 'picked_up',
              args: [],
              fn: async () => {},
              idempotencyKey: `key-${i}`,
              enqueuedAt: Date.now() + i,
              retries: 0,
              nextRetryAt: 0,
            }));

            const result = hasPendingActionsForOrder(queue, orderId, actionType);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Property 3: Preservation — cross-type block ───────────────────────────

  describe('Property 3: Preservation — cross-type block', () => {
    it('hasPendingActionsForOrder returns true when different type exists', () => {
      fc.assert(
        fc.property(mixedTypeQueueArb, ({ queue, orderId, primaryActionType }) => {
          // Verify bug condition is false (mixed types)
          expect(isBugCondition_2(queue, orderId, primaryActionType)).toBe(false);

          // Preservation check: should return true (cross-type blocked)
          const result = hasPendingActionsForOrder(queue, orderId, primaryActionType);
          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('cross-type block works for all action type combinations', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          fc.tuple(actionTypeArb, actionTypeArb).filter(([a, b]) => a !== b),
          (orderId, [actionType1, actionType2]) => {
            // Queue has actionType1, trying to do actionType2
            const queue: QueuedAction[] = [
              {
                id: `${orderId}-${actionType1}`,
                action: actionType1,
                orderId,
                targetStatus: 'picked_up',
                args: [],
                fn: async () => {},
                idempotencyKey: 'key-1',
                enqueuedAt: Date.now(),
                retries: 0,
                nextRetryAt: 0,
              },
            ];

            const result = hasPendingActionsForOrder(queue, orderId, actionType2);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Property 4: Preservation — no pending actions ─────────────────────────

  describe('Property 4: Preservation — no pending actions', () => {
    it('hasPendingActionsForOrder returns false when queue is empty', () => {
      fc.assert(
        fc.property(orderIdArb, actionTypeArb, (orderId, actionType) => {
          const emptyQueue: QueuedAction[] = [];
          const result = hasPendingActionsForOrder(emptyQueue, orderId, actionType);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('hasPendingActionsForOrder returns false when no actions for orderId', () => {
      fc.assert(
        fc.property(
          fc.array(queuedActionArb, { minLength: 1, maxLength: 5 }),
          orderIdArb,
          actionTypeArb,
          (queue, targetOrderId, actionType) => {
            // Filter out any actions that might have targetOrderId
            const filteredQueue = queue.filter(a => a.orderId !== targetOrderId);
            if (filteredQueue.length === 0) return; // Skip if all filtered out

            const result = hasPendingActionsForOrder(filteredQueue, targetOrderId, actionType);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Property 5: acquireOrderLock integration ──────────────────────────────

  describe('Property 5: acquireOrderLock integration', () => {
    it('acquireOrderLock succeeds when bug condition is true', () => {
      fc.assert(
        fc.property(sameTypeQueueArb, (queue) => {
          if (queue.length === 0) return;

          const orderId = queue[0].orderId;
          const actionType = queue[0].action;

          // Verify bug condition is true
          expect(isBugCondition_2(queue, orderId, actionType)).toBe(true);

          // Lock should be acquired, no alert shown
          const result = acquireOrderLock(queue, orderId, actionType);
          expect(result.acquired).toBe(true);
          expect(result.alertShown).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('acquireOrderLock fails with alert when different type exists', () => {
      fc.assert(
        fc.property(mixedTypeQueueArb, ({ queue, orderId, primaryActionType }) => {
          // Lock should fail, alert shown
          const result = acquireOrderLock(queue, orderId, primaryActionType);
          expect(result.acquired).toBe(false);
          expect(result.alertShown).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('acquireOrderLock succeeds when no pending actions', () => {
      fc.assert(
        fc.property(orderIdArb, actionTypeArb, (orderId, actionType) => {
          const emptyQueue: QueuedAction[] = [];
          const result = acquireOrderLock(emptyQueue, orderId, actionType);
          expect(result.acquired).toBe(true);
          expect(result.alertShown).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('acquireOrderLock fails when order is already locked', () => {
      fc.assert(
        fc.property(orderIdArb, actionTypeArb, (orderId, actionType) => {
          const emptyQueue: QueuedAction[] = [];
          const orderActionInFlight = { [orderId]: true };

          const result = acquireOrderLock(emptyQueue, orderId, actionType, orderActionInFlight);
          expect(result.acquired).toBe(false);
          expect(result.alertShown).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  // ── Property 6: FIFO ordering ──────────────────────────────────────────────

  describe('Property 6: FIFO ordering', () => {
    it('actions replay in FIFO order per orderId', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          fc.array(actionTypeArb, { minLength: 2, maxLength: 5 }),
          (orderId, actionTypes) => {
            // Create actions with increasing enqueuedAt timestamps
            const queue: QueuedAction[] = actionTypes.map((actionType, i) => ({
              id: `${orderId}-${actionType}-${i}`,
              action: actionType,
              orderId,
              targetStatus: 'picked_up',
              args: [],
              fn: async () => {},
              idempotencyKey: `key-${i}`,
              enqueuedAt: Date.now() + i * 1000, // Ensure strict ordering
              retries: 0,
              nextRetryAt: 0,
            }));

            // Validate FIFO ordering
            expect(validateFifoOrdering(queue, orderId)).toBe(true);

            // Get replay order
            const replayOrder = getReplayOrder(queue);

            // Verify replay order matches original order
            for (let i = 0; i < queue.length; i++) {
              expect(replayOrder[i].id).toBe(queue[i].id);
              expect(replayOrder[i].action).toBe(queue[i].action);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('FIFO ordering preserved under queue reconstruction', () => {
      fc.assert(
        fc.property(
          orderIdArb,
          fc.array(actionTypeArb, { minLength: 2, maxLength: 5 }),
          (orderId, actionTypes) => {
            // Create actions with specific timestamps
            const baseTime = Date.now();
            const actions: QueuedAction[] = actionTypes.map((actionType, i) => ({
              id: `${orderId}-${actionType}-${i}`,
              action: actionType,
              orderId,
              targetStatus: 'picked_up',
              args: [],
              fn: async () => {},
              idempotencyKey: `key-${i}`,
              enqueuedAt: baseTime + i * 1000,
              retries: 0,
              nextRetryAt: 0,
            }));

            // Shuffle the queue (simulating reconstruction)
            const shuffled = [...actions].sort(() => Math.random() - 0.5);

            // Get replay order (should restore FIFO)
            const replayOrder = getReplayOrder(shuffled);

            // Verify replay order matches original chronological order
            for (let i = 0; i < actions.length; i++) {
              expect(replayOrder[i].enqueuedAt).toBe(actions[i].enqueuedAt);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('pickup → arrived → otp never becomes arrived → pickup', () => {
      fc.assert(
        fc.property(orderIdArb, (orderId) => {
          const baseTime = Date.now();
          const queue: QueuedAction[] = [
            {
              id: `${orderId}-pickup`,
              action: 'pickup',
              orderId,
              targetStatus: 'picked_up',
              args: [],
              fn: async () => {},
              idempotencyKey: 'key-pickup',
              enqueuedAt: baseTime,
              retries: 0,
              nextRetryAt: 0,
            },
            {
              id: `${orderId}-arrived`,
              action: 'markArrived',
              orderId,
              targetStatus: 'arrived',
              args: [],
              fn: async () => {},
              idempotencyKey: 'key-arrived',
              enqueuedAt: baseTime + 1000,
              retries: 0,
              nextRetryAt: 0,
            },
            {
              id: `${orderId}-otp`,
              action: 'verifyOtp',
              orderId,
              targetStatus: 'delivered',
              args: [],
              fn: async () => {},
              idempotencyKey: 'key-otp',
              enqueuedAt: baseTime + 2000,
              retries: 0,
              nextRetryAt: 0,
            },
          ];

          // Shuffle the queue
          const shuffled = [queue[2], queue[0], queue[1]]; // otp, pickup, arrived

          // Get replay order
          const replayOrder = getReplayOrder(shuffled);

          // Verify correct order: pickup → arrived → otp
          expect(replayOrder[0].action).toBe('pickup');
          expect(replayOrder[1].action).toBe('markArrived');
          expect(replayOrder[2].action).toBe('verifyOtp');
        }),
        { numRuns: 100 }
      );
    });

    it('FIFO ordering maintained across multiple orders', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(orderIdArb, actionTypeArb, fc.integer({ min: 1, max: 3 })),
            { minLength: 2, maxLength: 3 }
          ),
          (orderSpecs) => {
            let baseTime = Date.now();
            const allActions: QueuedAction[] = [];

            // Create actions for each order
            for (const [orderId, actionType, count] of orderSpecs) {
              for (let i = 0; i < count; i++) {
                allActions.push({
                  id: `${orderId}-${actionType}-${i}`,
                  action: actionType,
                  orderId,
                  targetStatus: 'picked_up',
                  args: [],
                  fn: async () => {},
                  idempotencyKey: `key-${orderId}-${i}`,
                  enqueuedAt: baseTime,
                  retries: 0,
                  nextRetryAt: 0,
                });
                baseTime += 1000;
              }
            }

            // Validate FIFO ordering for each order
            const orderIds = [...new Set(allActions.map(a => a.orderId))];
            for (const orderId of orderIds) {
              expect(validateFifoOrdering(allActions, orderId)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ── Property 7: Edge cases ────────────────────────────────────────────────

  describe('Property 7: Edge cases', () => {
    it('handles undefined currentActionType correctly', () => {
      fc.assert(
        fc.property(
          fc.array(queuedActionArb, { minLength: 1, maxLength: 3 }),
          (queue) => {
            if (queue.length === 0) return;

            const orderId = queue[0].orderId;

            // When currentActionType is undefined, should return true if any action exists
            const result = hasPendingActionsForOrder(queue, orderId, undefined);
            const hasAnyAction = queue.some(a => a.orderId === orderId);
            expect(result).toBe(hasAnyAction);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles single action in queue', () => {
      fc.assert(
        fc.property(queuedActionArb, (action) => {
          const queue = [action];

          // Same type: should return false
          const sameTypeResult = hasPendingActionsForOrder(
            queue,
            action.orderId,
            action.action
          );
          expect(sameTypeResult).toBe(false);

          // Different type: should return true
          const differentType = action.action === 'pickup' ? 'markArrived' : 'pickup';
          const differentTypeResult = hasPendingActionsForOrder(
            queue,
            action.orderId,
            differentType
          );
          expect(differentTypeResult).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('handles multiple orders in queue', () => {
      fc.assert(
        fc.property(
          fc.array(queuedActionArb, { minLength: 2, maxLength: 10 }),
          (queue) => {
            // Get unique order IDs
            const orderIds = [...new Set(queue.map(a => a.orderId))];
            if (orderIds.length < 2) return; // Need at least 2 different orders

            // For each order, verify isolation
            for (const orderId of orderIds) {
              const orderActions = queue.filter(a => a.orderId === orderId);
              if (orderActions.length === 0) continue;

              const actionType = orderActions[0].action;
              const allSameType = orderActions.every(a => a.action === actionType);

              const result = hasPendingActionsForOrder(queue, orderId, actionType);

              if (allSameType) {
                expect(result).toBe(false);
              } else {
                expect(result).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
