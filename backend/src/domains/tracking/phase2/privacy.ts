export type Marker = {
  lat: number;
  lng: number;
  radiusM: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Simple deterministic 32-bit hash; stable across runtimes.
function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function metersToLatDelta(m: number): number {
  // ~111,111 meters per degree latitude
  return m / 111111;
}

function metersToLngDelta(m: number, latDeg: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  const denom = 111111 * Math.cos(latRad);
  if (!Number.isFinite(denom) || denom === 0) return 0;
  return m / denom;
}

export function computeMarker(params: {
  orderId: string;
  baseLat: number;
  baseLng: number;
  baseAccuracyM: number;
  // Larger radius => more obfuscation (less precision).
  minRadiusM?: number;
  maxRadiusM?: number;
  nearDestination?: boolean;
}): Marker {
  const minRadiusM = clamp(Number(params.minRadiusM ?? 25), 10, 500);
  const maxRadiusM = clamp(Number(params.maxRadiusM ?? 180), minRadiusM, 1500);

  // Expand fuzzing near destination.
  const nearDestMultiplier = params.nearDestination ? 2 : 1;

  const accuracy = clamp(Number(params.baseAccuracyM || 50), 5, 5000);

  // Radius is driven by accuracy, bounded, and expanded near destination.
  const radiusM = clamp(accuracy * 1.5 * nearDestMultiplier, minRadiusM, maxRadiusM);

  // Stable pseudo-random offset based on orderId only.
  const h = hash32(params.orderId);
  const angle = ((h % 360) * Math.PI) / 180;
  const r = ((h >>> 8) % 1000) / 1000; // 0..1
  const offsetM = r * radiusM;

  const dLat = metersToLatDelta(Math.cos(angle) * offsetM);
  const dLng = metersToLngDelta(Math.sin(angle) * offsetM, params.baseLat);

  // Quantize to reduce precision.
  const lat = Number((params.baseLat + dLat).toFixed(5));
  const lng = Number((params.baseLng + dLng).toFixed(5));

  return { lat, lng, radiusM: Math.round(radiusM) };
}
