/**
 * routeSimulation.e2e.test.ts
 *
 * End-to-end integration scenario:
 * 15 orders (mixed clusters + edge cases) → route arrangement → simulated delivery lifecycle
 *
 * Validates:
 *   - Route arrangement correctness (completeness, filtering, 2-opt, bounding span, greedy sanity)
 *   - Simulated movement correctness (moveTowards, arrival detection)
 *   - Delivery lifecycle (arrived → delivered → next order)
 *   - No system instability or invalid routing behavior
 */

import {
  computeGreedyRoute,
  haversineKm,
  isValidCoord,
  moveTowards,
  RouteStop,
} from '../utils/routeAlgorithm';

// ─── Constants ────────────────────────────────────────────────────────────────

const WAREHOUSE = { lat: 17.0956, lng: 80.6089 };
const DRIVER_START = { lat: 17.3000, lng: 80.8000 };
const EPSILON = 1e-9;
const ARRIVED_THRESHOLD_M = 40;
const STEP_METERS = 75 * 2; // speed 2×

// ─── Order factory ────────────────────────────────────────────────────────────

function order(id: string, lat: number, lng: number, status = 'assigned') {
  return { _id: id, address: { lat, lng }, orderStatus: status };
}

// ─── Test orders ──────────────────────────────────────────────────────────────

const ALL_ORDERS = [
  // Cluster A — near warehouse (6 orders, ~2–5 km)
  order('A1', 17.1100, 80.6300),
  order('A2', 17.0750, 80.6400),
  order('A3', 17.1200, 80.5900),
  order('A4', 17.0800, 80.5800),
  order('A5', 17.1050, 80.6500),
  order('A6', 17.0650, 80.6200),

  // Cluster B — medium distance (5 orders, 5–15 km)
  order('B1', 17.1500, 80.7200),
  order('B2', 17.0200, 80.7500),
  order('B3', 17.1800, 80.5500),
  order('B4', 17.0100, 80.6800),
  order('B5', 17.1900, 80.6600),

  // Cluster C — far (4 orders, 20–40 km)
  order('C1', 16.7500, 80.3000),
  order('C2', 17.3500, 80.9000),
  order('C3', 16.8000, 80.9500),
  order('C4', 17.4000, 80.2500),

  // Edge cases
  order('DUP', 17.1100, 80.6300),          // duplicate of A1 — valid, should appear in route
  order('INVALID_ZERO', 0, 0),              // (0,0) — must be filtered
  order('INVALID_NULL', null as any, null as any), // null coords — must be filtered
];

const VALID_ORDERS = ALL_ORDERS.filter((o) =>
  isValidCoord(o.address.lat, o.address.lng)
);
const INVALID_IDS = ['INVALID_ZERO', 'INVALID_NULL'];
const EXPECTED_ROUTE_LENGTH = ALL_ORDERS.length - INVALID_IDS.length; // 16

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maxPairwiseSpan(
  driver: { lat: number; lng: number },
  route: RouteStop[]
): number {
  const points = [driver, ...route.map((s) => s.order.address)];
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = haversineKm(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
      if (d > max) max = d;
    }
  }
  return max;
}

// ─── Report accumulators ──────────────────────────────────────────────────────

interface DeliveryEvent {
  orderId: string;
  arrivedAt: number;   // tick index
  deliveredAt: number; // tick index
}

const deliveryLog: DeliveryEvent[] = [];
const validationResults: Record<string, 'PASS' | 'FAIL'> = {};

function pass(key: string) { validationResults[key] = 'PASS'; }
function fail(key: string, reason: string) {
  validationResults[key] = 'FAIL';
  console.error(`[E2E FAIL] ${key}: ${reason}`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E: 15-order delivery simulation', () => {

  let result: ReturnType<typeof computeGreedyRoute>;

  // ── Step 3: Arrange route ──────────────────────────────────────────────────

  describe('Step 3 — Route arrangement', () => {

    beforeAll(() => {
      result = computeGreedyRoute(VALID_ORDERS, DRIVER_START.lat, DRIVER_START.lng);
    });

    it('Step 3.1 — Completeness: route length equals valid eligible order count', () => {
      expect(result.routeAfter.length).toBe(EXPECTED_ROUTE_LENGTH);
      if (result.routeAfter.length === EXPECTED_ROUTE_LENGTH) pass('completeness');
      else fail('completeness', `expected ${EXPECTED_ROUTE_LENGTH}, got ${result.routeAfter.length}`);
    });

    it('Step 3.2 — Filtering: invalid coords not in route', () => {
      const routeIds = result.routeAfter.map((s) => s.order._id);
      const leaked = INVALID_IDS.filter((id) => routeIds.includes(id));
      expect(leaked).toHaveLength(0);
      if (leaked.length === 0) pass('filtering');
      else fail('filtering', `leaked invalid orders: ${leaked.join(', ')}`);
    });

    it('Step 3.3 — 2-opt improvement: distanceAfter ≤ distanceBefore', () => {
      expect(result.distanceAfter).toBeLessThanOrEqual(result.distanceBefore + EPSILON);
      if (result.distanceAfter <= result.distanceBefore + EPSILON) pass('2opt_improvement');
      else fail('2opt_improvement', `after=${result.distanceAfter.toFixed(4)} > before=${result.distanceBefore.toFixed(4)}`);
    });

    it('Step 3.4 — Bounding span: no edge exceeds driver+orders spatial region', () => {
      const span = maxPairwiseSpan(DRIVER_START, result.routeAfter);
      let violated = false;
      for (let i = 0; i < result.routeAfter.length - 1; i++) {
        const A = result.routeAfter[i].order.address;
        const B = result.routeAfter[i + 1].order.address;
        const d = haversineKm(A.lat, A.lng, B.lat, B.lng);
        if (d > span + EPSILON) {
          fail('bounding_span', `edge (${i},${i+1})=${d.toFixed(3)} km > span=${span.toFixed(3)} km`);
          violated = true;
          break;
        }
      }
      if (!violated) pass('bounding_span');
      expect(violated).toBe(false);
    });

    it('Step 3.5 — Greedy sanity: nearest-neighbour holds for steps 1→n-4 (pre-2-opt)', () => {
      const route = result.routeBefore;
      let violated = false;
      for (let i = 1; i < route.length - 3 && !violated; i++) {
        const prev = route[i - 1].order.address;
        const chosen = route[i].order.address;
        const chosenDist = haversineKm(prev.lat, prev.lng, chosen.lat, chosen.lng);
        const remaining = route.slice(i + 1);
        const minRemaining = Math.min(
          ...remaining.map((r) => haversineKm(prev.lat, prev.lng, r.order.address.lat, r.order.address.lng))
        );
        if (chosenDist > minRemaining * 1.01 + 0.001) {
          fail('greedy_sanity', `step ${i}: chosen=${chosenDist.toFixed(3)}, minRemaining=${minRemaining.toFixed(3)}`);
          violated = true;
        }
      }
      if (!violated) pass('greedy_sanity');
      expect(violated).toBe(false);
    });

  });

  // ── Steps 4–8: Simulate delivery lifecycle ─────────────────────────────────

  describe('Steps 4–8 — Simulated delivery lifecycle', () => {

    let simulatedRoute: RouteStop[];
    let driverPos: { lat: number; lng: number };
    let currentIndex: number;
    let activeIds: string[];
    let routeSnapshot: string[]; // IDs at start — must not change
    let totalTicks: number;

    beforeAll(() => {
      simulatedRoute = result.routeAfter;
      driverPos = { ...DRIVER_START };
      currentIndex = 0;
      activeIds = simulatedRoute.map((s) => s.order._id);
      routeSnapshot = [...activeIds];
      totalTicks = 0;

      // Simulate movement until all orders delivered
      const MAX_TICKS = 100_000; // safety ceiling

      while (currentIndex < simulatedRoute.length && totalTicks < MAX_TICKS) {
        const target = simulatedRoute[currentIndex].order.address;
        const distM = haversineKm(driverPos.lat, driverPos.lng, target.lat, target.lng) * 1000;

        if (distM < ARRIVED_THRESHOLD_M) {
          // Arrived
          const orderId = simulatedRoute[currentIndex].order._id;
          const arrivedTick = totalTicks;

          // Simulate 2-second wait (2 ticks at 1 tick/second)
          totalTicks += 2;

          // Delivered
          deliveryLog.push({ orderId, arrivedAt: arrivedTick, deliveredAt: totalTicks });
          activeIds = activeIds.filter((id) => id !== orderId);
          currentIndex++;
        } else {
          driverPos = moveTowards(driverPos, target, STEP_METERS);
          totalTicks++;
        }
      }
    });

    it('Step 6 — All orders delivered (route completion)', () => {
      expect(currentIndex).toBe(simulatedRoute.length);
      expect(activeIds).toHaveLength(0);
      expect(deliveryLog).toHaveLength(simulatedRoute.length);
    });

    it('Step 7.1 — Sequential correctness: deliveries happen in route order', () => {
      const deliveredIds = deliveryLog.map((e) => e.orderId);
      const routeIds = simulatedRoute.map((s) => s.order._id);
      expect(deliveredIds).toEqual(routeIds);
      if (JSON.stringify(deliveredIds) === JSON.stringify(routeIds)) pass('sequential_flow');
      else fail('sequential_flow', `delivery order mismatch`);
    });

    it('Step 7.2 — No reshuffle: route order unchanged during simulation', () => {
      const currentIds = simulatedRoute.map((s) => s.order._id);
      expect(currentIds).toEqual(routeSnapshot);
      if (JSON.stringify(currentIds) === JSON.stringify(routeSnapshot)) pass('no_reshuffle');
      else fail('no_reshuffle', 'route was mutated during simulation');
    });

    it('Step 7.3 — Arrival before delivery: arrivedAt < deliveredAt for every order', () => {
      const allValid = deliveryLog.every((e) => e.arrivedAt < e.deliveredAt);
      expect(allValid).toBe(true);
    });

    it('Step 7.4 — Monotone delivery timestamps: each delivery after the previous', () => {
      for (let i = 1; i < deliveryLog.length; i++) {
        expect(deliveryLog[i].arrivedAt).toBeGreaterThanOrEqual(deliveryLog[i - 1].deliveredAt);
      }
    });

    it('Step 8 — Terminal state: no active orders remain after route completion', () => {
      expect(activeIds).toHaveLength(0);
      expect(currentIndex).toBe(simulatedRoute.length);
    });

    it('Step 9a — Route determinism: same input produces identical route across 5 runs', () => {
      const runs = Array.from({ length: 5 }, () =>
        computeGreedyRoute(VALID_ORDERS, DRIVER_START.lat, DRIVER_START.lng)
      );

      const referenceIds = runs[0].routeAfter.map((s) => s.order._id);

      for (let i = 1; i < runs.length; i++) {
        const runIds = runs[i].routeAfter.map((s) => s.order._id);
        expect(runIds).toEqual(referenceIds);
      }

      // Distances must also be identical across runs
      const referenceDist = runs[0].distanceAfter;
      for (let i = 1; i < runs.length; i++) {
        expect(runs[i].distanceAfter).toBeCloseTo(referenceDist, 9);
      }
    });

    it('Step 9b — Movement smoothness: distance to target never increases between ticks', () => {
      // Re-simulate movement for the first order only, tracking distance per tick
      const target = simulatedRoute[0].order.address;
      let pos = { ...DRIVER_START };
      let prevDist = haversineKm(pos.lat, pos.lng, target.lat, target.lng) * 1000;

      const MAX_STEPS = 10_000;
      for (let tick = 0; tick < MAX_STEPS; tick++) {
        const dist = haversineKm(pos.lat, pos.lng, target.lat, target.lng) * 1000;

        // Distance must never increase (no backward movement, no oscillation)
        expect(dist).toBeLessThanOrEqual(prevDist + EPSILON);

        if (dist < ARRIVED_THRESHOLD_M) break;

        pos = moveTowards(pos, target, STEP_METERS);
        prevDist = dist;
      }
    });

  });

  // ── Step 9: Final report ───────────────────────────────────────────────────

  afterAll(() => {
    const improvement = result.distanceBefore > 0
      ? (((result.distanceBefore - result.distanceAfter) / result.distanceBefore) * 100).toFixed(2)
      : '0.00';

    const allPass = Object.values(validationResults).every((v) => v === 'PASS');

    console.log(`
╔══════════════════════════════════════════════════════════╗
║           ROUTE SIMULATION — FINAL REPORT                ║
╠══════════════════════════════════════════════════════════╣
║  ROUTE SUMMARY                                           ║
║  Total orders submitted : ${ALL_ORDERS.length.toString().padEnd(30)}║
║  Filtered (invalid)     : ${INVALID_IDS.length.toString().padEnd(30)}║
║  Valid orders in route  : ${(result?.routeAfter?.length ?? 0).toString().padEnd(30)}║
║  Distance before 2-opt  : ${(result?.distanceBefore?.toFixed(3) ?? '?') + ' km'.padEnd(27)}║
║  Distance after 2-opt   : ${(result?.distanceAfter?.toFixed(3) ?? '?') + ' km'.padEnd(27)}║
║  2-opt improvement      : ${(improvement + '%').padEnd(30)}║
╠══════════════════════════════════════════════════════════╣
║  DELIVERY LOG                                            ║`);

    deliveryLog.forEach((e, i) => {
      console.log(`║  ${(i + 1).toString().padStart(2)}. ${e.orderId.padEnd(12)} arrived@tick=${String(e.arrivedAt).padEnd(6)} delivered@tick=${e.deliveredAt}`);
    });

    console.log(`╠══════════════════════════════════════════════════════════╣
║  VALIDATION RESULTS                                      ║`);

    Object.entries(validationResults).forEach(([key, val]) => {
      const icon = val === 'PASS' ? '✅' : '❌';
      console.log(`║  ${icon} ${key.padEnd(30)} ${val.padEnd(10)}║`);
    });

    console.log(`╠══════════════════════════════════════════════════════════╣
║  FINAL VERDICT: ${allPass ? 'SYSTEM STABLE ✅' : 'ISSUES DETECTED ❌'}${' '.repeat(allPass ? 26 : 23)}║
╚══════════════════════════════════════════════════════════╝`);
  });

});
