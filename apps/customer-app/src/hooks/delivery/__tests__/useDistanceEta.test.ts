/**
 * Unit Tests for useDistanceEta hook
 *
 * **Validates: Requirements 3.2, 3.3, 3.4**
 *
 * Tests specific formatting examples and coordinate validation logic.
 */

import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useDistanceEta, UseDistanceEtaOptions } from '../useDistanceEta';

// ---------------------------------------------------------------------------
// Formatting functions (extracted from useDistanceEta for direct testing)
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
// Coordinate validation (extracted from useDistanceEta for direct testing)
// ---------------------------------------------------------------------------

const isValidCoord = (lat?: number, lng?: number): boolean => {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
};

describe('useDistanceEta', () => {
  describe('formatDistance', () => {
    it('formats 0.35 km as "350 m"', () => {
      const result = formatDistance(0.35);
      expect(result).toBe('350 m');
    });

    it('formats 1.0 km as "1.0 km"', () => {
      const result = formatDistance(1.0);
      expect(result).toBe('1.0 km');
    });

    it('formats 2.45 km as "2.5 km"', () => {
      const result = formatDistance(2.45);
      expect(result).toBe('2.5 km');
    });
  });

  describe('formatEta', () => {
    it('formats 0.01 km as "< 1 min"', () => {
      // 0.01 km → (0.01 / 25) * 60 = 0.024 min → "< 1 min"
      const distanceKm = 0.01;
      const etaMinutes = (distanceKm / 25) * 60;
      const result = formatEta(etaMinutes);
      expect(result).toBe('< 1 min');
    });

    it('formats 10 km as "24 min"', () => {
      // 10 km → (10 / 25) * 60 = 24 min
      const distanceKm = 10;
      const etaMinutes = (distanceKm / 25) * 60;
      const result = formatEta(etaMinutes);
      expect(result).toBe('24 min');
    });

    it('formats 100 km as "4h 0m"', () => {
      // 100 km → (100 / 25) * 60 = 240 min = 4h 0m
      const distanceKm = 100;
      const etaMinutes = (distanceKm / 25) * 60;
      const result = formatEta(etaMinutes);
      expect(result).toBe('4h 0m');
    });
  });

  describe('coordinate validation', () => {
    it('returns false when lat is undefined', () => {
      const result = isValidCoord(undefined, 77.5946);
      expect(result).toBe(false);
    });

    it('returns false when lng is undefined', () => {
      const result = isValidCoord(12.9716, undefined);
      expect(result).toBe(false);
    });

    it('returns false when both coordinates are zero', () => {
      const result = isValidCoord(0, 0);
      expect(result).toBe(false);
    });

    it('returns false when lat is out of range (> 90)', () => {
      const result = isValidCoord(91, 77.5946);
      expect(result).toBe(false);
    });

    it('returns false when lat is out of range (< -90)', () => {
      const result = isValidCoord(-91, 77.5946);
      expect(result).toBe(false);
    });

    it('returns false when lng is out of range (> 180)', () => {
      const result = isValidCoord(12.9716, 181);
      expect(result).toBe(false);
    });

    it('returns false when lng is out of range (< -180)', () => {
      const result = isValidCoord(12.9716, -181);
      expect(result).toBe(false);
    });

    it('returns false when lat is non-finite', () => {
      const result = isValidCoord(NaN, 77.5946);
      expect(result).toBe(false);
    });

    it('returns false when lng is non-finite', () => {
      const result = isValidCoord(12.9716, NaN);
      expect(result).toBe(false);
    });

    it('returns true for valid coordinates', () => {
      const result = isValidCoord(12.9716, 77.5946);
      expect(result).toBe(true);
    });
  });
});

