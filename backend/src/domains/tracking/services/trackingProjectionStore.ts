import redisClient from "../../../config/redis";

export type TrackingFreshnessState = "LIVE" | "STALE" | "OFFLINE";

export type TrackingMovementState = "MOVING" | "STATIONARY" | "UNKNOWN";

export type TrackingMovementConfidence = "HIGH" | "MEDIUM" | "LOW";

export type TrackingCustomerCheckpointState = "PICKED_UP" | "ON_THE_WAY" | "NEARBY" | "DELIVERED";

export type TrackingInternalSemanticState =
  | "AT_PICKUP"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "NEAR_DESTINATION"
  | "DELIVERED_CANDIDATE";

export type TrackingEtaConfidence = "high" | "medium" | "low";

export type TrackingSlaRiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export type TrackingSlaRiskReason =
  | "ETA_P90_AFTER_PROMISED_WINDOW"
  | "RIDER_IDLE_IN_TRANSIT"
  | "LOW_CONFIDENCE_LONG_DISTANCE"
  | "STALE_OR_OFFLINE";

export type TrackingMarkerV1 = {
  lat: number;
  lng: number;
  radiusM: number;
};

export type TrackingProjectionV1 = {
  lastLat: number;
  lastLng: number;
  accuracyRadiusM: number;
  lastUpdatedAt: string;
  freshnessState: TrackingFreshnessState;
  movementState: TrackingMovementState;

  // Phase 2 (optional enrichment; do not assume present)
  smoothedLat?: number;
  smoothedLng?: number;
  movementConfidence?: TrackingMovementConfidence;
  marker?: TrackingMarkerV1;
  checkpointState?: TrackingCustomerCheckpointState;
  internalState?: TrackingInternalSemanticState;
  nearDestination?: boolean;

  // Phase 3 (optional intelligence; admin/ops only; do not expose via customer API)
  etaP50?: string;
  etaP90?: string;
  etaConfidence?: TrackingEtaConfidence;
  etaUpdatedAt?: string;

  slaRiskLevel?: TrackingSlaRiskLevel;
  slaRiskReasons?: TrackingSlaRiskReason[];
  slaRiskDetectedAt?: string;

  distanceRemainingM?: number;
  etaAnchorLat?: number;
  etaAnchorLng?: number;
  etaAnchorDistanceRemainingM?: number;
  etaAnchorUpdatedAt?: string;
  etaSpeedEwmaMps?: number;
  phase3LastMovingAt?: string;
};

const DEFAULT_TTL_SECONDS = 60 * 60;

function projectionKey(orderId: string): string {
  return `tracking:projection:${orderId}`;
}

function projectionLastSeqKey(riderId: string, orderId: string): string {
  return `tracking:projection:lastseq:${riderId}:${orderId}`;
}

export async function getTrackingProjection(orderId: string): Promise<TrackingProjectionV1 | null> {
  const key = projectionKey(orderId);
  const raw = await redisClient.get(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const base = parsed as TrackingProjectionV1;
    const freshnessState = computeFreshnessState({
      lastUpdatedAt: String(base.lastUpdatedAt || ""),
      staleAfterSeconds: Number(process.env.TRACKING_PROJECTION_STALE_SECONDS || 60),
      offlineAfterSeconds: Number(process.env.TRACKING_PROJECTION_OFFLINE_SECONDS || 5 * 60),
    });
    return { ...base, freshnessState };
  } catch {
    return null;
  }
}

export async function getProjectionLastSeq(params: { riderId: string; orderId: string }): Promise<number | null> {
  const raw = await redisClient.get(projectionLastSeqKey(params.riderId, params.orderId));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function setProjectionLastSeq(params: {
  riderId: string;
  orderId: string;
  seq: number;
  ttlSeconds?: number;
}): Promise<void> {
  const ttl = Math.max(60, Math.min(24 * 60 * 60, Number(params.ttlSeconds || DEFAULT_TTL_SECONDS)));
  await redisClient.set(projectionLastSeqKey(params.riderId, params.orderId), String(params.seq), { EX: ttl });
}

export async function writeTrackingProjection(params: {
  orderId: string;
  projection: TrackingProjectionV1;
  ttlSeconds?: number;
}): Promise<void> {
  const ttl = Math.max(60, Math.min(24 * 60 * 60, Number(params.ttlSeconds || DEFAULT_TTL_SECONDS)));
  await redisClient.set(projectionKey(params.orderId), JSON.stringify(params.projection), { EX: ttl });
}

export function computeFreshnessState(params: {
  lastUpdatedAt: string;
  now?: Date;
  staleAfterSeconds?: number;
  offlineAfterSeconds?: number;
}): TrackingFreshnessState {
  const now = params.now ?? new Date();
  const staleAfterSeconds = Math.max(1, Math.min(24 * 60 * 60, Number(params.staleAfterSeconds || 60)));
  const offlineAfterSeconds = Math.max(staleAfterSeconds, Math.min(24 * 60 * 60, Number(params.offlineAfterSeconds || 5 * 60)));

  const d = new Date(params.lastUpdatedAt);
  if (!Number.isFinite(d.getTime())) return "OFFLINE";

  const ageSeconds = (now.getTime() - d.getTime()) / 1000;
  if (ageSeconds <= staleAfterSeconds) return "LIVE";
  if (ageSeconds <= offlineAfterSeconds) return "STALE";
  return "OFFLINE";
}
