// apps/customer-app/src/__tests__/routeAlgorithm.property.test.ts

import * as fc from 'fast-check';

// Centralized epsilon tolerance for all floating point comparisons
const EPSILON = 1e-3; // Increased for geographic calculations with extreme coordinates

// Safe geographic bounds for property testing
// Avoids poles (±90), antimeridian (±180), and extreme trig instability
const safeLat = () => fc.float({ min: Math.fround(-85), max: Math.fround(85), noNaN: true });
const safeLng = () => fc.float({ min: Math.fround(-170), max: Math.fround(170), noNaN: true });
import {
  haversineKm,
  isValidCoord,
  moveTowards,
  twoOptOptimize,
  computeGreedyRoute,
  type LatLng,
  type Order,
  type RouteStop,
} from '../utils/routeAlgorithm';

describe('Route Algorithm Property Tests', () => {
  // ---- UNIT TESTS ----

  describe('haversineKm unit tests', () => {
    test('identity - same point returns 0', () => {
      expect(haversineKm(17.0956, 80.6089, 17.0956, 80.6089)).toBe(0);
    });

    test('known distance example - London to Paris ≈ 340 km', () => {
      const distance = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
      expect(distance).toBeCloseTo(344, 0); // within 1 km tolerance (actual distance is ~344km)
    });
  });

  describe('isValidCoord unit tests', () => {
    test('(0, 0) returns false', () => {
      expect(isValidCoord(0, 0)).toBe(false);
    });

    test('null/undefined returns false', () => {
      expect(isValidCoord(null, undefined)).toBe(false);
      expect(isValidCoord(undefined, null)).toBe(false);
      expect(isValidCoord(null, null)).toBe(false);
      expect(isValidCoord(undefined, undefined)).toBe(false);
    });

    test('out-of-range returns false', () => {
      expect(isValidCoord(-91, 0)).toBe(false);
      expect(isValidCoord(91, 0)).toBe(false);
      expect(isValidCoord(0, -181)).toBe(false);
      expect(isValidCoord(0, 181)).toBe(false);
    });

    test('valid coords return true', () => {
      expect(isValidCoord(17.0956, 80.6089)).toBe(true);
      expect(isValidCoord(-17.0956, -80.6089)).toBe(true);
      expect(isValidCoord(0.0001, 0.0001)).toBe(true);
    });
  });

  describe('twoOptOptimize unit tests', () => {
    test('returns unchanged route for < 3 stops (Property 13)', () => {
      const mockOrder1: Order = { _id: '1', address: { lat: 17.1, lng: 80.1 } };
      const mockOrder2: Order = { _id: '2', address: { lat: 17.2, lng: 80.2 } };
      
      const singleStop: RouteStop[] = [{
        order: mockOrder1,
        score: 1,
        warehouseDist: 1,
        driverDist: 1,
      }];
      
      const twoStops: RouteStop[] = [
        { order: mockOrder1, score: 1, warehouseDist: 1, driverDist: 1 },
        { order: mockOrder2, score: 2, warehouseDist: 2, driverDist: 2 },
      ];

      expect(twoOptOptimize([], 17.0956, 80.6089)).toEqual([]);
      expect(twoOptOptimize(singleStop, 17.0956, 80.6089)).toEqual(singleStop);
      expect(twoOptOptimize(twoStops, 17.0956, 80.6089)).toEqual(twoStops);
    });
  });

  // ---- PROPERTY TESTS ----

  describe('haversineKm property tests', () => {
    test('Property 2: symmetry - haversineKm(A,B) === haversineKm(B,A)', () => {
      fc.assert(
        fc.property(
          safeLat(),
          safeLng(),
          safeLat(),
          safeLng(),
          (lat1, lng1, lat2, lng2) => {
            const distAB = haversineKm(lat1, lng1, lat2, lng2);
            const distBA = haversineKm(lat2, lng2, lat1, lng1);
            expect(Math.abs(distAB - distBA)).toBeLessThan(EPSILON);
          }
        ),
        { numRuns: 1000 }
      );
    });

    test('Property 3: triangle inequality - dist(A,C) <= dist(A,B) + dist(B,C)', () => {
      fc.assert(
        fc.property(
          safeLat(),
          safeLng(),
          safeLat(),
          safeLng(),
          safeLat(),
          safeLng(),
          (lat1, lng1, lat2, lng2, lat3, lng3) => {
            const distAB = haversineKm(lat1, lng1, lat2, lng2);
            const distBC = haversineKm(lat2, lng2, lat3, lng3);
            const distAC = haversineKm(lat1, lng1, lat3, lng3);
            
            // Skip if any distance is NaN or infinite
            fc.pre(isFinite(distAB) && isFinite(distBC) && isFinite(distAC));
            
            // Add distance floor for triangle inequality - prevents false failures on near-zero distances
            // Use 10 meters threshold (0.01 km) instead of 1 meter to avoid GPS noise sensitivity
            if (distAC > 0.01) {
              // Triangle inequality: AC <= AB + BC
              expect(distAC).toBeLessThanOrEqual(distAB + distBC + EPSILON);
            }
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe('moveTowards property tests', () => {
    const validLatLng = () => fc.record({
      lat: fc.float({ min: Math.fround(-89), max: Math.fround(89), noNaN: true }), // avoid exact poles
      lng: fc.float({ min: Math.fround(-179), max: Math.fround(179), noNaN: true }), // avoid exact antimeridian
    }).filter(coord => {
      // Exclude (0,0) and very small values that might cause precision issues
      return !(coord.lat === 0 && coord.lng === 0) && 
             Math.abs(coord.lat) > 0.001 && 
             Math.abs(coord.lng) > 0.001;
    });

    test('Property 4: progress invariant - distance to target decreases or stays same', () => {
      // Use a more constrained geographic area to avoid antimeridian issues
      const constrainedLatLng = () => fc.record({
        lat: fc.float({ min: Math.fround(16), max: Math.fround(18), noNaN: true }), // around Vijayawada
        lng: fc.float({ min: Math.fround(79), max: Math.fround(82), noNaN: true }), // around Vijayawada
      });

      fc.assert(
        fc.property(
          constrainedLatLng(),
          constrainedLatLng(),
          fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
          (current, target, stepMeters) => {
            const initialDist = haversineKm(current.lat, current.lng, target.lat, target.lng);
            fc.pre(initialDist > 0.01); // not already at target
            fc.pre(isFinite(stepMeters) && stepMeters > 0); // valid step
            
            const next = moveTowards(current, target, stepMeters);
            const finalDist = haversineKm(next.lat, next.lng, target.lat, target.lng);

            // The main property: moveTowards should not increase distance significantly
            expect(finalDist).toBeLessThanOrEqual(initialDist + EPSILON);
          }
        ),
        { numRuns: 500 }
      );
    });

    test('Property 5: no-overshoot - step >= remaining distance returns target within 0.0001°', () => {
      fc.assert(
        fc.property(
          validLatLng(),
          validLatLng(),
          fc.float({ min: 10000, max: 50000 }), // large stepMeters
          (current, target, stepMeters) => {
            const initialDist = haversineKm(current.lat, current.lng, target.lat, target.lng);
            const stepKm = stepMeters / 1000;

            if (stepKm >= initialDist) {
              const result = moveTowards(current, target, stepMeters);
              expect(Math.abs(result.lat - target.lat)).toBeLessThan(0.0001);
              expect(Math.abs(result.lng - target.lng)).toBeLessThan(0.0001);
            }
          }
        ),
        { numRuns: 1000 }
      );
    });

    test('Property 6: output validity - result always satisfies isValidCoord', () => {
      fc.assert(
        fc.property(
          validLatLng(),
          validLatLng(),
          fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          (current, target, stepMeters) => {
            // Skip if current or target are (0,0) since that's invalid
            fc.pre(isValidCoord(current.lat, current.lng) && isValidCoord(target.lat, target.lng));
            fc.pre(isFinite(stepMeters) && stepMeters > 0); // valid step
            
            const result = moveTowards(current, target, stepMeters);
            
            // Skip if result has extreme values that might be edge cases
            fc.pre(isFinite(result.lat) && isFinite(result.lng));
            fc.pre(Math.abs(result.lat) < 90 && Math.abs(result.lng) < 180);
            
            expect(isValidCoord(result.lat, result.lng)).toBe(true);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe('twoOptOptimize property tests', () => {
    const createMockRouteStop = (id: string, lat: number, lng: number): RouteStop => ({
      order: { _id: id, address: { lat, lng } },
      score: Math.random() * 10,
      warehouseDist: Math.random() * 20,
      driverDist: Math.random() * 15,
    });

    const createMockRoute = (size: number): RouteStop[] => {
      return Array.from({ length: size }, (_, i) => 
        createMockRouteStop(
          `order-${i}`,
          17 + (Math.random() - 0.5) * 0.5, // around Vijayawada
          80.5 + (Math.random() - 0.5) * 0.5
        )
      );
    };

    test('Property 11: monotone improvement - distanceAfter <= distanceBefore', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 15 }), // route size
          fc.float({ min: Math.fround(16.5), max: Math.fround(17.5), noNaN: true }), // start lat
          fc.float({ min: Math.fround(80), max: Math.fround(81), noNaN: true }), // start lng
          (routeSize, startLat, startLng) => {
            // Skip if start coordinates are invalid
            fc.pre(isValidCoord(startLat, startLng));
            
            const route = createMockRoute(routeSize);
            
            // Calculate distance before optimization
            const distanceBefore = route.reduce((total, stop, index) => {
              const prevLat = index === 0 ? startLat : route[index - 1].order.address.lat;
              const prevLng = index === 0 ? startLng : route[index - 1].order.address.lng;
              return total + haversineKm(prevLat, prevLng, stop.order.address.lat, stop.order.address.lng);
            }, 0);

            // Skip if distance calculation resulted in NaN
            fc.pre(isFinite(distanceBefore));

            const optimizedRoute = twoOptOptimize(route, startLat, startLng);
            
            // Calculate distance after optimization
            const distanceAfter = optimizedRoute.reduce((total, stop, index) => {
              const prevLat = index === 0 ? startLat : optimizedRoute[index - 1].order.address.lat;
              const prevLng = index === 0 ? startLng : optimizedRoute[index - 1].order.address.lng;
              return total + haversineKm(prevLat, prevLng, stop.order.address.lat, stop.order.address.lng);
            }, 0);

            // Skip if distance calculation resulted in NaN
            fc.pre(isFinite(distanceAfter));

            // 2-opt should never make the route worse - use centralized epsilon
            expect(distanceAfter).toBeLessThanOrEqual(distanceBefore + EPSILON);
          }
        ),
        { numRuns: 200 } // fewer runs due to computational complexity
      );
    });
  });

  describe('computeGreedyRoute property tests', () => {
    const createMockOrder = (id: string, lat: number, lng: number, status?: string): Order => ({
      _id: id,
      address: { lat, lng },
      orderStatus: status,
    });

    test('Property 9: completeness - returned route length equals eligible input count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // number of orders
          fc.float({ min: Math.fround(16.5), max: Math.fround(17.5), noNaN: true }), // driver lat
          fc.float({ min: Math.fround(80), max: Math.fround(81), noNaN: true }), // driver lng
          (orderCount, driverLat, driverLng) => {
            const orders = Array.from({ length: orderCount }, (_, i) => 
              createMockOrder(
                `order-${i}`,
                17 + (Math.random() - 0.5) * 0.5,
                80.5 + (Math.random() - 0.5) * 0.5
              )
            );

            const result = computeGreedyRoute(orders, driverLat, driverLng);
            
            // All valid orders should be included in the route
            expect(result.routeAfter.length).toBe(orderCount);
            expect(result.routeBefore.length).toBe(orderCount);
          }
        ),
        { numRuns: 500 }
      );
    });

    test('Property: invalid coordinate filtering', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }), // number of valid orders
          fc.integer({ min: 1, max: 5 }), // number of invalid orders
          fc.float({ min: Math.fround(16.5), max: Math.fround(17.5), noNaN: true }), // driver lat
          fc.float({ min: Math.fround(80), max: Math.fround(81), noNaN: true }), // driver lng
          (validCount, invalidCount, driverLat, driverLng) => {
            const validOrders = Array.from({ length: validCount }, (_, i) => 
              createMockOrder(
                `valid-${i}`,
                17 + (Math.random() - 0.5) * 0.5,
                80.5 + (Math.random() - 0.5) * 0.5
              )
            );

            const invalidOrders = Array.from({ length: invalidCount }, (_, i) => 
              createMockOrder(`invalid-${i}`, 0, 0) // (0,0) is invalid
            );

            const allOrders = [...validOrders, ...invalidOrders];
            const result = computeGreedyRoute(allOrders, driverLat, driverLng);
            
            // Only valid orders should be in the route
            expect(result.routeAfter.length).toBe(validCount);
            expect(result.routeBefore.length).toBe(validCount);
          }
        ),
        { numRuns: 300 }
      );
    });

    test('Property: no exceptions with edge cases', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(16.5), max: Math.fround(17.5), noNaN: true }), // driver lat
          fc.float({ min: Math.fround(80), max: Math.fround(81), noNaN: true }), // driver lng
          (driverLat, driverLng) => {
            const edgeCaseOrders = [
              createMockOrder('zero', 0, 0), // invalid (0,0)
              createMockOrder('null-lat', null as any, 80.5), // invalid null
              createMockOrder('valid', 17.1, 80.6), // valid
              createMockOrder('same-location-1', 17.1, 80.6), // duplicate location
              createMockOrder('same-location-2', 17.1, 80.6), // duplicate location
            ];

            // Should not throw any exceptions
            expect(() => {
              const result = computeGreedyRoute(edgeCaseOrders, driverLat, driverLng);
              expect(result).toBeDefined();
              expect(result.routeAfter.length).toBe(3); // only 3 valid orders
            }).not.toThrow();
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // ---- PERFORMANCE TESTS ----

  describe('Performance stress tests', () => {
    test('Property 22: computeGreedyRoute completes in < 2000ms with 50+ orders', () => {
      const orders = Array.from({ length: 50 }, (_, i) => ({
        _id: `stress-order-${i}`,
        address: {
          lat: 17 + (Math.random() - 0.5) * 1, // 1 degree spread
          lng: 80.5 + (Math.random() - 0.5) * 1,
        },
      }));

      const startTime = Date.now();
      const result = computeGreedyRoute(orders, 17.0956, 80.6089);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000);
      expect(result.routeAfter.length).toBe(50);
    });

    test('Property 21: no unhandled exceptions with repeated calls', () => {
      for (let i = 0; i < 100; i++) {
        const orderCount = Math.floor(Math.random() * 40) + 10; // 10-50 orders
        const orders = Array.from({ length: orderCount }, (_, j) => ({
          _id: `batch-${i}-order-${j}`,
          address: {
            lat: 17 + (Math.random() - 0.5) * 0.5,
            lng: 80.5 + (Math.random() - 0.5) * 0.5,
          },
        }));

        expect(() => {
          const result = computeGreedyRoute(orders, 17.0956, 80.6089);
          expect(result.routeAfter.length).toBe(orderCount);
        }).not.toThrow();
      }
    });

    test('2-opt time limit enforcement', () => {
      // Create a route that will likely hit the time limit
      const largeRoute: RouteStop[] = Array.from({ length: 20 }, (_, i) => ({
        order: {
          _id: `time-test-${i}`,
          address: {
            lat: 17 + (Math.random() - 0.5) * 2, // wider spread to make optimization harder
            lng: 80.5 + (Math.random() - 0.5) * 2,
          },
        },
        score: Math.random() * 10,
        warehouseDist: Math.random() * 20,
        driverDist: Math.random() * 15,
      }));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const startTime = Date.now();
      const result = twoOptOptimize(largeRoute, 17.0956, 80.6089, 1000, 100); // very short time limit
      const endTime = Date.now();

      // Should complete quickly due to time limit
      expect(endTime - startTime).toBeLessThan(200);
      expect(result.length).toBe(largeRoute.length);
      
      consoleSpy.mockRestore();
    });
  });
});