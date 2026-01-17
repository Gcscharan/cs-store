import { haversineMeters } from "../services/trackingValidation";
import {
  TrackingMovementConfidence,
  TrackingMovementState,
  TrackingProjectionV1,
} from "../services/trackingProjectionStore";

export type Phase3EtaConfidence = "high" | "medium" | "low";

export type Phase3EtaResult = {
  etaP50: string;
  etaP90: string;
  etaConfidence: Phase3EtaConfidence;
  etaUpdatedAt: string;

  etaAnchorLat: number;
  etaAnchorLng: number;
  etaAnchorDistanceRemainingM: number;
  etaAnchorUpdatedAt: string;

  etaSpeedEwmaMps?: number;
  phase3LastMovingAt?: string;
};

function confidenceRank(c: Phase3EtaConfidence | undefined | null): number {
  if (c === "high") return 3;
  if (c === "medium") return 2;
  if (c === "low") return 1;
  return 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseDateMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function computeEta(params: {
  existing: TrackingProjectionV1 | null;
  nowIso: string;
  smoothedLat: number;
  smoothedLng: number;
  movementState: TrackingMovementState;
  movementConfidence?: TrackingMovementConfidence;
  destination?: { lat: number; lng: number };
  distanceRemainingM: number;
  rawSpeedMps?: number;
  config?: {
    recomputeMovedM?: number;
    deviationM?: number;
    idleThresholdSeconds?: number;
    suppressSeconds?: number;
    minSpeedMps?: number;
    maxSpeedMps?: number;
  };
}): { recomputed: boolean; result: Phase3EtaResult | null } {
  const nowMs = parseDateMs(params.nowIso);
  if (nowMs === null) return { recomputed: false, result: null };
  if (!params.destination) return { recomputed: false, result: null };

  const cfg = {
    recomputeMovedM: Number(params.config?.recomputeMovedM ?? 40),
    deviationM: Number(params.config?.deviationM ?? 250),
    idleThresholdSeconds: Number(params.config?.idleThresholdSeconds ?? 5 * 60),
    suppressSeconds: Number(params.config?.suppressSeconds ?? 150),
    minSpeedMps: Number(params.config?.minSpeedMps ?? 1.2),
    maxSpeedMps: Number(params.config?.maxSpeedMps ?? 30),
  };

  const existingEtaP50Ms = parseDateMs((params.existing as any)?.etaP50);
  const existingEtaP90Ms = parseDateMs((params.existing as any)?.etaP90);
  const existingEtaUpdatedAtMs = parseDateMs((params.existing as any)?.etaUpdatedAt);
  const existingEtaConfidence = (params.existing as any)?.etaConfidence as Phase3EtaConfidence | undefined;

  const prevLastMovingAt = (params.existing as any)?.phase3LastMovingAt as string | undefined;
  const prevLastMovingAtMs = parseDateMs(prevLastMovingAt);

  const lastMovingAtMs =
    params.movementState === "MOVING"
      ? nowMs
      : prevLastMovingAtMs !== null
      ? prevLastMovingAtMs
      : nowMs;

  const idleSeconds = Math.max(0, (nowMs - lastMovingAtMs) / 1000);

  const etaConfidence: Phase3EtaConfidence =
    params.movementConfidence === "HIGH" && params.movementState === "MOVING"
      ? "high"
      : params.movementConfidence === "MEDIUM"
      ? "medium"
      : "low";

  const prevAnchorLat = Number((params.existing as any)?.etaAnchorLat);
  const prevAnchorLng = Number((params.existing as any)?.etaAnchorLng);
  const prevAnchorDist = Number((params.existing as any)?.etaAnchorDistanceRemainingM);
  const hasPrevAnchor = Number.isFinite(prevAnchorLat) && Number.isFinite(prevAnchorLng) && Number.isFinite(prevAnchorDist);

  const movedSinceAnchorM = hasPrevAnchor
    ? haversineMeters({ lat: prevAnchorLat, lng: prevAnchorLng }, { lat: params.smoothedLat, lng: params.smoothedLng })
    : Number.POSITIVE_INFINITY;

  const deviationM = hasPrevAnchor ? params.distanceRemainingM - prevAnchorDist : 0;

  const stationaryIdleTrigger = params.movementState === "STATIONARY" && idleSeconds >= cfg.idleThresholdSeconds;
  const movedTrigger = movedSinceAnchorM >= cfg.recomputeMovedM;
  const deviationTrigger = deviationM >= cfg.deviationM;
  const ageTrigger = existingEtaUpdatedAtMs === null ? true : nowMs - existingEtaUpdatedAtMs >= 60 * 1000;

  const shouldRecompute = existingEtaP50Ms === null || movedTrigger || deviationTrigger || stationaryIdleTrigger || ageTrigger;

  const prevLat = Number(params.existing?.smoothedLat ?? params.existing?.lastLat);
  const prevLng = Number(params.existing?.smoothedLng ?? params.existing?.lastLng);
  const prevTsMs = parseDateMs(params.existing?.lastUpdatedAt);

  let observedSpeedMps: number | null = null;
  if (
    Number.isFinite(prevLat) &&
    Number.isFinite(prevLng) &&
    prevTsMs !== null &&
    nowMs > prevTsMs
  ) {
    const dM = haversineMeters({ lat: prevLat, lng: prevLng }, { lat: params.smoothedLat, lng: params.smoothedLng });
    const dtS = (nowMs - prevTsMs) / 1000;
    if (dtS > 0.5) {
      observedSpeedMps = dM / dtS;
    }
  }

  const rawSpeed =
    params.rawSpeedMps !== undefined && Number.isFinite(Number(params.rawSpeedMps)) ? Number(params.rawSpeedMps) : null;

  const prevEwma = (params.existing as any)?.etaSpeedEwmaMps;
  const prevEwmaMps = Number.isFinite(Number(prevEwma)) ? Number(prevEwma) : null;

  const speedSignal =
    params.movementState === "MOVING"
      ? observedSpeedMps ?? rawSpeed ?? prevEwmaMps
      : prevEwmaMps ?? rawSpeed;

  const defaultSpeedMps = 6;
  const speedBase = clamp(Number(speedSignal ?? defaultSpeedMps), cfg.minSpeedMps, cfg.maxSpeedMps);

  const alpha = 0.35;
  const speedEwmaMps =
    prevEwmaMps === null || !Number.isFinite(prevEwmaMps)
      ? speedBase
      : clamp(alpha * speedBase + (1 - alpha) * prevEwmaMps, cfg.minSpeedMps, cfg.maxSpeedMps);

  const travelSeconds = params.distanceRemainingM / Math.max(cfg.minSpeedMps, speedEwmaMps);

  const baseP50Seconds = Math.max(0, travelSeconds);

  const uncertaintyMultiplier = etaConfidence === "high" ? 0.25 : etaConfidence === "medium" ? 0.45 : 0.8;
  const p90BufferSeconds = Math.max(120, baseP50Seconds * uncertaintyMultiplier + (etaConfidence === "low" ? 240 : 0));

  const idlePenaltySeconds = stationaryIdleTrigger ? Math.min(10 * 60, idleSeconds * 0.5) : 0;

  const nextEtaP50Ms = nowMs + Math.round((baseP50Seconds + idlePenaltySeconds) * 1000);
  const nextEtaP90Ms = nextEtaP50Ms + Math.round(p90BufferSeconds * 1000);

  if (!shouldRecompute && existingEtaP50Ms !== null && existingEtaP90Ms !== null && existingEtaUpdatedAtMs !== null) {
    const next: Phase3EtaResult = {
      etaP50: toIso(existingEtaP50Ms),
      etaP90: toIso(existingEtaP90Ms),
      etaConfidence,
      etaUpdatedAt: toIso(existingEtaUpdatedAtMs),

      etaAnchorLat: hasPrevAnchor ? prevAnchorLat : params.smoothedLat,
      etaAnchorLng: hasPrevAnchor ? prevAnchorLng : params.smoothedLng,
      etaAnchorDistanceRemainingM: hasPrevAnchor ? prevAnchorDist : params.distanceRemainingM,
      etaAnchorUpdatedAt: (params.existing as any)?.etaAnchorUpdatedAt || toIso(existingEtaUpdatedAtMs),

      etaSpeedEwmaMps: speedEwmaMps,
      phase3LastMovingAt: toIso(lastMovingAtMs),
    };
    return { recomputed: false, result: next };
  }

  let chosenP50Ms = nextEtaP50Ms;
  let chosenP90Ms = nextEtaP90Ms;
  let chosenUpdatedAtMs = nowMs;

  if (existingEtaP50Ms !== null) {
    const deltaSeconds = Math.abs((chosenP50Ms - existingEtaP50Ms) / 1000);
    if (deltaSeconds < cfg.suppressSeconds && existingEtaP90Ms !== null && existingEtaUpdatedAtMs !== null) {
      chosenP50Ms = existingEtaP50Ms;
      chosenP90Ms = existingEtaP90Ms;
      chosenUpdatedAtMs = existingEtaUpdatedAtMs;
    }
  }

  if (existingEtaP90Ms !== null && confidenceRank(etaConfidence) < confidenceRank(existingEtaConfidence)) {
    chosenP90Ms = Math.max(chosenP90Ms, existingEtaP90Ms);
  }

  const result: Phase3EtaResult = {
    etaP50: toIso(chosenP50Ms),
    etaP90: toIso(chosenP90Ms),
    etaConfidence,
    etaUpdatedAt: toIso(chosenUpdatedAtMs),

    etaAnchorLat: params.smoothedLat,
    etaAnchorLng: params.smoothedLng,
    etaAnchorDistanceRemainingM: params.distanceRemainingM,
    etaAnchorUpdatedAt: toIso(nowMs),

    etaSpeedEwmaMps: speedEwmaMps,
    phase3LastMovingAt: toIso(lastMovingAtMs),
  };

  return { recomputed: true, result };
}
