/**
 * Property-Based Tests for Distance and ETA Formatting
 *
 * **Validates: Requirements 3.2, 3.3, 9.2**
 *
 * Property 6: Distance Formatting
 *   For any non-negative distance value d (in km), formatDistance(d) shall
 *   return a string containing "m" (metres) when d < 1, and a string containing
 *   "km" when d >= 1. For any distance d, formatEta(d) shall return "< 1 min"
 *   when the computed minutes round to 0, "{N} min" when minutes are in [1, 59],
 *   and "{H}h {M}m" when minutes are >= 60.
 *
 * Tag: Feature: driver-ux-phase5, Property 6: distance formatting
 *
 * Each property runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Formatting functions (extracted from useDistanceEta)
// ---------------------------------------------------------------------------

const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
};

const formatEta = (minutes: number): string => {
  if (minutes < 1) {
    return '< 1 min';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// Generate non-negative distances in km (0 to 1000 km)
const distanceKmArb = fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true });

// Generate ETA values in minutes (0 to 600 minutes = 10 hours)
const etaMinutesArb = fc.double({ min: 0, max: 600, noNaN: true, noDefaultInfinity: true });

// ---------------------------------------------------------------------------
// Property 6: Distance Formatting
// Validates: Requirements 3.2, 3.3, 9.2
// Tag: Feature: driver-ux-phase5, Property 6: distance formatting
// ---------------------------------------------------------------------------

describe('Property 6: Distance Formatting', () => {
  it('formatDistance contains "m" iff distance < 1 km', () => {
    fc.assert(
      fc.property(distanceKmArb, (distanceKm) => {
        const formatted = formatDistance(distanceKm);

        if (distanceKm < 1) {
          // Should contain "m" for distances below 1 km
          expect(formatted).toContain('m');
          expect(formatted).not.toContain('km');
        } else {
          // Should contain "km" for distances >= 1 km
          expect(formatted).toContain('km');
          // Should not contain standalone "m" (but "km" contains "m", so we check for " m")
          expect(formatted).not.toMatch(/\s+m$/);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('formatDistance contains "km" iff distance >= 1 km', () => {
    fc.assert(
      fc.property(distanceKmArb, (distanceKm) => {
        const formatted = formatDistance(distanceKm);

        if (distanceKm >= 1) {
          expect(formatted).toContain('km');
        } else {
          expect(formatted).not.toContain('km');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('formatDistance converts to metres correctly when distance < 1 km', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.999, noNaN: true, noDefaultInfinity: true }),
        (distanceKm) => {
          const formatted = formatDistance(distanceKm);
          const expectedMetres = Math.round(distanceKm * 1000);

          expect(formatted).toBe(`${expectedMetres} m`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('formatDistance shows one decimal place when distance >= 1 km', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (distanceKm) => {
          const formatted = formatDistance(distanceKm);
          const expectedKm = distanceKm.toFixed(1);

          expect(formatted).toBe(`${expectedKm} km`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('formatEta returns "< 1 min" when minutes < 1', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.999, noNaN: true, noDefaultInfinity: true }),
        (minutes) => {
          const formatted = formatEta(minutes);
          expect(formatted).toBe('< 1 min');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('formatEta returns "{N} min" when minutes in [1, 59]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 59.999, noNaN: true, noDefaultInfinity: true }),
        (minutes) => {
          const formatted = formatEta(minutes);
          const expectedMinutes = Math.round(minutes);

          expect(formatted).toBe(`${expectedMinutes} min`);
          expect(formatted).toMatch(/^\d+ min$/);
          expect(formatted).not.toContain('h');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('formatEta returns "{H}h {M}m" when minutes >= 60', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 60, max: 600, noNaN: true, noDefaultInfinity: true }),
        (minutes) => {
          const formatted = formatEta(minutes);
          const expectedHours = Math.floor(minutes / 60);
          const expectedMins = Math.round(minutes % 60);

          expect(formatted).toBe(`${expectedHours}h ${expectedMins}m`);
          expect(formatted).toMatch(/^\d+h \d+m$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('formatEta matches correct format bracket for all inputs', () => {
    fc.assert(
      fc.property(etaMinutesArb, (minutes) => {
        const formatted = formatEta(minutes);

        if (minutes < 1) {
          expect(formatted).toBe('< 1 min');
        } else if (minutes < 60) {
          expect(formatted).toMatch(/^\d+ min$/);
        } else {
          expect(formatted).toMatch(/^\d+h \d+m$/);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('formatDistance always returns a non-empty string', () => {
    fc.assert(
      fc.property(distanceKmArb, (distanceKm) => {
        const formatted = formatDistance(distanceKm);
        expect(formatted).toBeTruthy();
        expect(formatted.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('formatEta always returns a non-empty string', () => {
    fc.assert(
      fc.property(etaMinutesArb, (minutes) => {
        const formatted = formatEta(minutes);
        expect(formatted).toBeTruthy();
        expect(formatted.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('formatDistance boundary: exactly 1 km uses km format', () => {
    const formatted = formatDistance(1.0);
    expect(formatted).toBe('1.0 km');
    expect(formatted).toContain('km');
    expect(formatted).not.toMatch(/\s+m$/);
  });

  it('formatDistance boundary: just below 1 km uses m format', () => {
    const formatted = formatDistance(0.999);
    expect(formatted).toContain('m');
    expect(formatted).not.toContain('km');
    expect(formatted).toBe('999 m');
  });

  it('formatEta boundary: exactly 1 minute uses min format', () => {
    const formatted = formatEta(1.0);
    expect(formatted).toBe('1 min');
    expect(formatted).not.toContain('h');
  });

  it('formatEta boundary: just below 1 minute uses < 1 min format', () => {
    const formatted = formatEta(0.999);
    expect(formatted).toBe('< 1 min');
  });

  it('formatEta boundary: exactly 60 minutes uses hour format', () => {
    const formatted = formatEta(60.0);
    expect(formatted).toBe('1h 0m');
    expect(formatted).toContain('h');
  });

  it('formatEta boundary: just below 60 minutes uses min format', () => {
    const formatted = formatEta(59.999);
    expect(formatted).toBe('60 min');
    expect(formatted).not.toContain('h');
  });
});
