import { haversineMeters } from "../services/trackingValidation";

export type MovementConfidence = "HIGH" | "MEDIUM" | "LOW";

export type SmoothedPoint = {
  lat: number;
  lng: number;
  accuracyRadiusM: number;
  movementState: "MOVING" | "STATIONARY" | "UNKNOWN";
  movementConfidence: MovementConfidence;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function confidenceFromAccuracy(accuracyM: number): MovementConfidence {
  if (!Number.isFinite(accuracyM) || accuracyM <= 0) return "LOW";
  if (accuracyM <= 15) return "HIGH";
  if (accuracyM <= 40) return "MEDIUM";
  return "LOW";
}

function alphaFromAccuracy(accuracyM: number): number {
  // Higher alpha (trust new sample more) when accuracy is better.
  // Range roughly 0.15..0.75
  if (!Number.isFinite(accuracyM) || accuracyM <= 0) return 0.15;
  if (accuracyM <= 10) return 0.75;
  if (accuracyM <= 25) return 0.55;
  if (accuracyM <= 60) return 0.35;
  return 0.2;
}

export type SmoothingRejectReason = "impossible_jump" | "low_confidence_suppressed";

export type SmoothingResult =
  | { ok: true; value: SmoothedPoint }
  | {
      ok: false;
      reason: SmoothingRejectReason;
      fallback: SmoothedPoint;
    };

export function smoothLocationSample(params: {
  prev?: {
    smoothedLat: number;
    smoothedLng: number;
    lastUpdatedAt: string;
    movementState?: "MOVING" | "STATIONARY" | "UNKNOWN";
    movementConfidence?: MovementConfidence;
  };
  raw: {
    lat: number;
    lng: number;
    accuracyM: number;
    speedMps?: number;
    serverReceivedAt: string;
  };
  config?: {
    maxSpeedMps?: number;
    stationaryThresholdM?: number;
    speedMovingThresholdMps?: number;
    suppressLowConfidence?: boolean;
  };
}): SmoothingResult {
  const maxSpeedMps = clamp(Number(params.config?.maxSpeedMps ?? 55), 5, 120);
  const stationaryThresholdM = clamp(Number(params.config?.stationaryThresholdM ?? 12), 1, 200);
  const speedMovingThresholdMps = clamp(Number(params.config?.speedMovingThresholdMps ?? 1), 0.1, 10);
  const suppressLowConfidence = Boolean(params.config?.suppressLowConfidence ?? true);

  const confidence = confidenceFromAccuracy(params.raw.accuracyM);

  const prev = params.prev;
  if (!prev || !Number.isFinite(prev.smoothedLat) || !Number.isFinite(prev.smoothedLng)) {
    const movementState =
      params.raw.speedMps !== undefined
        ? params.raw.speedMps >= speedMovingThresholdMps
          ? "MOVING"
          : "STATIONARY"
        : "UNKNOWN";

    const base: SmoothedPoint = {
      lat: params.raw.lat,
      lng: params.raw.lng,
      accuracyRadiusM: Math.max(1, Number(params.raw.accuracyM || 1)),
      movementState,
      movementConfidence: confidence,
    };

    if (suppressLowConfidence && confidence === "LOW") {
      return { ok: false, reason: "low_confidence_suppressed", fallback: base };
    }

    return { ok: true, value: base };
  }

  const now = new Date(params.raw.serverReceivedAt);
  const prevAt = new Date(prev.lastUpdatedAt);
  const dtSeconds = Math.max(0.1, (now.getTime() - prevAt.getTime()) / 1000);

  const distM = haversineMeters(
    { lat: prev.smoothedLat, lng: prev.smoothedLng },
    { lat: params.raw.lat, lng: params.raw.lng }
  );

  const impliedSpeedMps = distM / dtSeconds;
  const fallback: SmoothedPoint = {
    lat: prev.smoothedLat,
    lng: prev.smoothedLng,
    accuracyRadiusM: Math.max(1, Number(params.raw.accuracyM || 1)),
    movementState: prev.movementState || "UNKNOWN",
    movementConfidence: prev.movementConfidence || confidence,
  };

  if (!Number.isFinite(impliedSpeedMps) || impliedSpeedMps > maxSpeedMps) {
    return { ok: false, reason: "impossible_jump", fallback };
  }

  // Lightweight stabilization: if sample is low-confidence and doesn't add meaningfully, suppress.
  if (suppressLowConfidence && confidence === "LOW" && distM < stationaryThresholdM * 2) {
    return { ok: false, reason: "low_confidence_suppressed", fallback };
  }

  let alpha = alphaFromAccuracy(params.raw.accuracyM);

  // If we're likely stationary, reduce alpha to avoid jitter.
  const likelyStationary = distM < stationaryThresholdM && (params.raw.speedMps ?? 0) < speedMovingThresholdMps;
  if (likelyStationary) alpha = Math.min(alpha, 0.25);

  // If we were previously STATIONARY and the new point doesn't move much, keep alpha low.
  if ((prev.movementState || "UNKNOWN") === "STATIONARY" && distM < stationaryThresholdM * 1.5) {
    alpha = Math.min(alpha, 0.2);
  }

  const lat = prev.smoothedLat + alpha * (params.raw.lat - prev.smoothedLat);
  const lng = prev.smoothedLng + alpha * (params.raw.lng - prev.smoothedLng);

  const movementState =
    distM >= stationaryThresholdM
      ? "MOVING"
      : params.raw.speedMps !== undefined
      ? params.raw.speedMps >= speedMovingThresholdMps
        ? "MOVING"
        : "STATIONARY"
      : "STATIONARY";

  const value: SmoothedPoint = {
    lat,
    lng,
    accuracyRadiusM: Math.max(1, Number(params.raw.accuracyM || 1)),
    movementState,
    movementConfidence: confidence,
  };

  return { ok: true, value };
}
