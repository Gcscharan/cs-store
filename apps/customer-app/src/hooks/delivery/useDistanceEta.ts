import { useRef, useMemo } from 'react';

// ─── Haversine (fast, always works) ──────────────────────────────────────────
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Coordinate validation ────────────────────────────────────────────────────
const isValidCoord = (lat?: number, lng?: number): boolean => {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
};

// ─── Distance formatting ──────────────────────────────────────────────────────
const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
};

// ─── ETA formatting ───────────────────────────────────────────────────────────
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

// ─── Hook Interface ───────────────────────────────────────────────────────────
export interface UseDistanceEtaOptions {
  driverLocation: { lat: number; lng: number } | null;
  address: { lat?: number; lng?: number } | null;
}

export interface DistanceEtaResult {
  distanceKm: number | null;
  etaMinutes: number | null;
  formattedDistance: string | null;
  formattedEta: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useDistanceEta = (options: UseDistanceEtaOptions): DistanceEtaResult => {
  const { driverLocation, address } = options;

  // Use refs to track previous values and avoid stale closures
  const prevKmRef = useRef<number | null>(null);
  const prevEtaRef = useRef<number | null>(null);

  const result = useMemo(() => {
    // Validate coordinates
    if (!driverLocation || !isValidCoord(address?.lat, address?.lng)) {
      return {
        distanceKm: null,
        etaMinutes: null,
        formattedDistance: null,
        formattedEta: null,
      };
    }

    // Compute raw haversine distance
    const rawKm = haversineKm(
      driverLocation.lat,
      driverLocation.lng,
      address!.lat!,
      address!.lng!
    );

    // Apply jitter guard: if rawKm > prevKm * 1.05, use rawKm; otherwise use min(rawKm, prevKm)
    let distanceKm: number;
    if (prevKmRef.current === null) {
      distanceKm = rawKm;
    } else if (rawKm > prevKmRef.current * 1.05) {
      distanceKm = rawKm;
    } else {
      distanceKm = Math.min(rawKm, prevKmRef.current);
    }

    // Compute raw ETA (25 km/h average speed)
    const rawEta = (distanceKm / 25) * 60;

    // Apply ETA cap: if rawEta > prevEta * 1.10 and distanceKm <= prevKm * 1.05, clamp to prevEta * 1.10
    let etaMinutes: number;
    if (prevEtaRef.current === null) {
      etaMinutes = rawEta;
    } else if (rawEta > prevEtaRef.current * 1.10 && distanceKm <= (prevKmRef.current ?? 0) * 1.05) {
      etaMinutes = prevEtaRef.current * 1.10;
    } else {
      etaMinutes = rawEta;
    }

    // Update refs for next render
    prevKmRef.current = distanceKm;
    prevEtaRef.current = etaMinutes;

    return {
      distanceKm,
      etaMinutes,
      formattedDistance: formatDistance(distanceKm),
      formattedEta: formatEta(etaMinutes),
    };
  }, [driverLocation, address]);

  return result;
};
