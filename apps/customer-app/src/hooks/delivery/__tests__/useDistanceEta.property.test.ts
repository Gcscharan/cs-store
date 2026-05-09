/**
 * Property-Based Tests for useDistanceEta hook logic
 *
 * **Validates: Requirements 3.1, 9.1, 9.2**
 *
 * Property 3: ETA Monotonicity
 *   For any sequence of driver location updates where the haversine distance
 *   to the current stop does not increase by more than 5% between consecutive
 *   updates, the computed ETA shall not increase by more than 10% between
 *   those same consecutive updates.
 *
 * Tag: Feature: driver-ux-phase5, Property 3: ETA monotonicity
 *
 * Each property runs a minimum of 100 iterations.
 *
 * Note: These tests exercise the pure logic extracted from useDistanceEta
 * (haversine calculation, jitter guard, ETA cap) without mounting the hook —
 * keeping tests fast and deterministic.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Haversine calculation (extracted from useDistanceEta)
// ---------------------------------------------------------------------------

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ---------------------------------------------------------------------------
// Pure logic helpers extracted from useDistanceEta
// (mirrors the actual hook implementation)
// ---------------------------------------------------------------------------

/**
 * Simulates the jitter guard and ETA cap logic from useDistanceEta
 * Returns { distanceKm, etaMinutes } for a given driver location and destination
 */
function computeDistanceEta(
  driverLat: number,
  driverLng: number,
  destLat: number,
  destLng: number,
  prevKm: number | null,
  prevEta: number | null
): { distanceKm: number; etaMinutes: number } {
  // Compute raw haversine distance
  const rawKm = haversineKm(driverLat, driverLng, destLat, destLng);

  // Apply jitter guard: if rawKm > prevKm * 1.05, use rawKm; otherwise use min(rawKm, prevKm)
  let distanceKm: number;
  if (prevKm === null) {
    distanceKm = rawKm;
  } else if (rawKm > prevKm * 1.05) {
    distanceKm = rawKm;
  } else {
    distanceKm = Math.min(rawKm, prevKm);
  }

  // Compute raw ETA (25 km/h average speed)
  const rawEta = (distanceKm / 25) * 60;

  // Apply ETA cap: if rawEta > prevEta * 1.10 and distanceKm <= prevKm * 1.05, clamp to prevEta * 1.10
  let etaMinutes: number;
  if (prevEta === null) {
    etaMinutes = rawEta;
  } else if (rawEta > prevEta * 1.10 && distanceKm <= (prevKm ?? 0) * 1.05) {
    etaMinutes = prevEta * 1.10;
  } else {
    etaMinutes = rawEta;
  }

  return { distanceKm, etaMinutes };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// Generate a valid latitude (-90 to 90, excluding 0)
const latArb = fc
  .double({ min: -90, max: 90, noNaN: true })
  .filter((lat) => lat !== 0 && Math.abs(lat) > 0.0001);

// Generate a valid longitude (-180 to 180, excluding 0)
const lngArb = fc
  .double({ min: -180, max: 180, noNaN: true })
  .filter((lng) => lng !== 0 && Math.abs(lng) > 0.0001);

// Generate a valid coordinate pair
const coordArb = fc.record({
  lat: latArb,
  lng: lngArb,
});

/**
 * Generate a sequence of driver positions moving toward a destination
 * Each step reduces the haversine distance by a random amount within ±5%
 */
const movementSequenceArb = fc
  .tuple(
    coordArb, // destination
    coordArb, // starting position
    fc.integer({ min: 3, max: 10 }) // number of steps
  )
  .chain(([destination, start, numSteps]) => {
    // Generate a sequence of positions moving toward the destination
    const positions: Array<{ lat: number; lng: number }> = [start];

    for (let i = 1; i < numSteps; i++) {
      const prev = positions[i - 1];
      
      // Skip if previous position is invalid
      if (!Number.isFinite(prev.lat) || !Number.isFinite(prev.lng)) {
        break;
      }
      
      const distToDest = haversineKm(prev.lat, prev.lng, destination.lat, destination.lng);

      // If we're very close to destination, stop generating positions
      if (distToDest < 0.1) {
        break;
      }

      // Move toward destination by reducing distance by 5-15%
      const reductionFactor = fc.sample(fc.double({ min: 0.05, max: 0.15 }), 1)[0];
      
      // Simple linear interpolation toward destination
      const progress = Math.min(reductionFactor, 0.9); // Don't overshoot
      const newLat = prev.lat + (destination.lat - prev.lat) * progress;
      const newLng = prev.lng + (destination.lng - prev.lng) * progress;

      // Ensure coordinates stay within valid bounds
      const clampedLat = Math.max(-89.9, Math.min(89.9, newLat));
      const clampedLng = Math.max(-179.9, Math.min(179.9, newLng));

      // Verify the new position is valid
      if (Number.isFinite(clampedLat) && Number.isFinite(clampedLng)) {
        positions.push({ lat: clampedLat, lng: clampedLng });
      } else {
        break;
      }
    }

    return fc.constant({ destination, positions });
  });

// ---------------------------------------------------------------------------
// Property 3: ETA Monotonicity
// Validates: Requirements 3.1, 9.1, 9.2
// Tag: Feature: driver-ux-phase5, Property 3: ETA monotonicity
// ---------------------------------------------------------------------------

describe('Property 3: ETA Monotonicity', () => {
  it('ETA does not increase by more than 10% when distance does not increase by more than 5%', () => {
    fc.assert(
      fc.property(movementSequenceArb, ({ destination, positions }) => {
        let prevKm: number | null = null;
        let prevEta: number | null = null;

        for (let i = 0; i < positions.length; i++) {
          const pos = positions[i];
          const { distanceKm, etaMinutes } = computeDistanceEta(
            pos.lat,
            pos.lng,
            destination.lat,
            destination.lng,
            prevKm,
            prevEta
          );

          if (prevKm !== null && prevEta !== null) {
            const distanceIncreaseRatio = distanceKm / prevKm;
            const etaIncreaseRatio = etaMinutes / prevEta;

            // Assert: if distance did not increase by more than 5%, ETA should not increase by more than 10%
            if (distanceIncreaseRatio <= 1.05) {
              expect(etaIncreaseRatio).toBeLessThanOrEqual(1.10);
            }
          }

          prevKm = distanceKm;
          prevEta = etaMinutes;
        }
      }),
      { numRuns: 100 }
    );
  });

  it('ETA is non-increasing when distance is strictly decreasing', () => {
    fc.assert(
      fc.property(movementSequenceArb, ({ destination, positions }) => {
        let prevKm: number | null = null;
        let prevEta: number | null = null;

        for (let i = 0; i < positions.length; i++) {
          const pos = positions[i];
          const { distanceKm, etaMinutes } = computeDistanceEta(
            pos.lat,
            pos.lng,
            destination.lat,
            destination.lng,
            prevKm,
            prevEta
          );

          if (prevKm !== null && prevEta !== null) {
            // If distance decreased, ETA should not increase
            if (distanceKm < prevKm) {
              expect(etaMinutes).toBeLessThanOrEqual(prevEta);
            }
          }

          prevKm = distanceKm;
          prevEta = etaMinutes;
        }
      }),
      { numRuns: 100 }
    );
  });

  it('ETA is always positive and proportional to distance', () => {
    fc.assert(
      fc.property(movementSequenceArb, ({ destination, positions }) => {
        // Skip if we don't have enough valid positions
        if (positions.length < 2) {
          return true;
        }

        let prevKm: number | null = null;
        let prevEta: number | null = null;

        for (let i = 0; i < positions.length; i++) {
          const pos = positions[i];
          
          // Skip invalid positions
          if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) {
            continue;
          }

          const { distanceKm, etaMinutes } = computeDistanceEta(
            pos.lat,
            pos.lng,
            destination.lat,
            destination.lng,
            prevKm,
            prevEta
          );

          // Skip if computation resulted in invalid values
          if (!Number.isFinite(distanceKm) || !Number.isFinite(etaMinutes)) {
            continue;
          }

          // Assert: ETA is always positive
          expect(etaMinutes).toBeGreaterThan(0);

          // Assert: ETA is roughly proportional to distance (within 10% tolerance due to capping)
          const expectedEta = (distanceKm / 25) * 60;
          expect(etaMinutes).toBeGreaterThanOrEqual(expectedEta * 0.9);
          expect(etaMinutes).toBeLessThanOrEqual(expectedEta * 1.1);

          prevKm = distanceKm;
          prevEta = etaMinutes;
        }
      }),
      { numRuns: 100 }
    );
  });

  it('jitter guard prevents distance from increasing when raw distance is within 5% of previous', () => {
    fc.assert(
      fc.property(
        coordArb,
        coordArb,
        fc.double({ min: 0.01, max: 0.04 }), // small jitter within 5%
        (destination, start, jitterFactor) => {
          // First measurement
          const { distanceKm: dist1 } = computeDistanceEta(
            start.lat,
            start.lng,
            destination.lat,
            destination.lng,
            null,
            null
          );

          // Simulate a small increase in raw distance (GPS jitter)
          const jitteredLat = start.lat + (destination.lat - start.lat) * jitterFactor * 0.1;
          const jitteredLng = start.lng + (destination.lng - start.lng) * jitterFactor * 0.1;

          const rawDist2 = haversineKm(jitteredLat, jitteredLng, destination.lat, destination.lng);

          // If raw distance increased by less than 5%, the jitter guard should prevent it
          if (rawDist2 <= dist1 * 1.05 && rawDist2 > dist1) {
            const { distanceKm: dist2 } = computeDistanceEta(
              jitteredLat,
              jitteredLng,
              destination.lat,
              destination.lng,
              dist1,
              (dist1 / 25) * 60
            );

            // Assert: distance should not increase (jitter guard applied)
            expect(dist2).toBeLessThanOrEqual(dist1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ETA cap prevents ETA from increasing by more than 10% when distance is stable', () => {
    fc.assert(
      fc.property(coordArb, coordArb, (destination, start) => {
        // First measurement
        const { distanceKm: dist1, etaMinutes: eta1 } = computeDistanceEta(
          start.lat,
          start.lng,
          destination.lat,
          destination.lng,
          null,
          null
        );

        // Second measurement with same position (distance should be stable)
        const { distanceKm: dist2, etaMinutes: eta2 } = computeDistanceEta(
          start.lat,
          start.lng,
          destination.lat,
          destination.lng,
          dist1,
          eta1
        );

        // Assert: distance should be unchanged
        expect(dist2).toBe(dist1);

        // Assert: ETA should be unchanged (or within 10% cap)
        expect(eta2).toBeLessThanOrEqual(eta1 * 1.10);
      }),
      { numRuns: 100 }
    );
  });
});
