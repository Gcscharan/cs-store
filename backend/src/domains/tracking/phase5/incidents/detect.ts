import { TrackingProjectionV1 } from "../../services/trackingProjectionStore";
import { getIncidentDefinition } from "./taxonomy";
import { DetectedIncident, IncidentType } from "./types";

function parseIsoMs(iso: any): number | null {
  const ms = new Date(String(iso || "")).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function nowIso(now: Date): string {
  return now.toISOString();
}

export type DetectContext = {
  now: Date;
  order?: {
    orderId: string;
    riderId?: string | null;
    promisedWindowEnd?: string | null;
    region?: string | null;
  };
  projection?: TrackingProjectionV1 | null;
  globals?: {
    killSwitchMode?: string | null;
    streamEventTimeLagMs?: number | null;
    projectionConsumerLagRecords?: number | null;
    hotStoreErrorDelta?: number | null;
  };
};

export function detectIncidents(ctx: DetectContext): DetectedIncident[] {
  const now = ctx.now;
  const out: DetectedIncident[] = [];

  const projection = ctx.projection || null;
  const orderId = ctx.order?.orderId;
  const riderId = ctx.order?.riderId || null;

  const lastUpdatedAtMs = projection ? parseIsoMs(projection.lastUpdatedAt) : null;
  const ageSeconds = lastUpdatedAtMs !== null ? (now.getTime() - lastUpdatedAtMs) / 1000 : null;

  const staleSeconds = Math.max(30, Number(process.env.TRACKING_P5_TRACKING_STALE_S || 120));
  if (orderId && projection && projection.freshnessState !== "LIVE" && ageSeconds !== null && ageSeconds >= staleSeconds) {
    const def = getIncidentDefinition("TRACKING_STALE");
    out.push({
      ...def,
      subject: { scope: "ORDER", orderId },
      evidence: {
        freshnessState: projection.freshnessState,
        lastUpdatedAt: projection.lastUpdatedAt,
        ageSeconds,
        thresholdSeconds: staleSeconds,
      },
    });
  }

  const promisedEndMs = parseIsoMs(ctx.order?.promisedWindowEnd);
  const etaP90Ms = parseIsoMs((projection as any)?.etaP90);
  const etaDriftToleranceSeconds = Math.max(0, Number(process.env.TRACKING_P5_ETA_DRIFT_TOLERANCE_S || 5 * 60));

  if (orderId && promisedEndMs !== null && etaP90Ms !== null && etaP90Ms > promisedEndMs + etaDriftToleranceSeconds * 1000) {
    const def = getIncidentDefinition("ETA_DRIFT");
    out.push({
      ...def,
      subject: { scope: "ORDER", orderId },
      evidence: {
        etaP90: (projection as any)?.etaP90,
        promisedWindowEnd: ctx.order?.promisedWindowEnd,
        toleranceSeconds: etaDriftToleranceSeconds,
      },
    });
  }

  if (orderId && String((projection as any)?.slaRiskLevel || "NONE").toUpperCase() === "HIGH") {
    const def = getIncidentDefinition("SLA_BREACH_RISK");
    out.push({
      ...def,
      subject: { scope: "ORDER", orderId },
      evidence: {
        slaRiskLevel: (projection as any)?.slaRiskLevel,
        slaRiskReasons: (projection as any)?.slaRiskReasons || [],
        slaRiskDetectedAt: (projection as any)?.slaRiskDetectedAt || null,
        etaP90: (projection as any)?.etaP90 || null,
        promisedWindowEnd: ctx.order?.promisedWindowEnd || null,
      },
    });
  }

  const riderOfflineSeconds = Math.max(30, Number(process.env.TRACKING_P5_RIDER_OFFLINE_S || 3 * 60));
  if (riderId && projection && projection.freshnessState !== "LIVE" && ageSeconds !== null && ageSeconds >= riderOfflineSeconds) {
    const def = getIncidentDefinition("RIDER_OFFLINE");
    out.push({
      ...def,
      subject: { scope: "RIDER", riderId },
      evidence: {
        orderId,
        freshnessState: projection.freshnessState,
        lastUpdatedAt: projection.lastUpdatedAt,
        ageSeconds,
        thresholdSeconds: riderOfflineSeconds,
      },
    });
  }

  const accuracy = projection ? Number(projection.accuracyRadiusM) : NaN;
  const gpsAnomalyAccuracyM = Math.max(50, Number(process.env.TRACKING_P5_GPS_ANOMALY_ACCURACY_M || 300));
  if (
    orderId &&
    projection &&
    Number.isFinite(accuracy) &&
    accuracy >= gpsAnomalyAccuracyM &&
    String((projection as any)?.movementConfidence || "").toUpperCase() === "LOW"
  ) {
    const def = getIncidentDefinition("GPS_ANOMALY");
    out.push({
      ...def,
      subject: { scope: "ORDER", orderId },
      evidence: {
        accuracyRadiusM: projection.accuracyRadiusM,
        movementConfidence: (projection as any)?.movementConfidence || null,
        thresholdAccuracyM: gpsAnomalyAccuracyM,
      },
    });
  }

  const globalKillSwitchMode = String(ctx.globals?.killSwitchMode || "");
  if (globalKillSwitchMode && globalKillSwitchMode.toUpperCase() !== "CUSTOMER_READ_ENABLED") {
    const def = getIncidentDefinition("KILLSWITCH_TRIGGERED");
    out.push({
      ...def,
      subject: { scope: "GLOBAL" },
      evidence: {
        mode: globalKillSwitchMode,
        detectedAt: nowIso(now),
      },
    });
  }

  const lagMs = Number(ctx.globals?.streamEventTimeLagMs);
  const lagThresholdMs = Math.max(0, Number(process.env.TRACKING_P5_STREAM_LAG_MS || 90_000));
  if (Number.isFinite(lagMs) && lagMs >= lagThresholdMs) {
    const def = getIncidentDefinition("STREAM_LAG");
    out.push({
      ...def,
      subject: { scope: "GLOBAL" },
      evidence: {
        streamEventTimeLagMs: lagMs,
        thresholdMs: lagThresholdMs,
      },
    });
  }

  const hotStoreDelta = Number(ctx.globals?.hotStoreErrorDelta);
  const hotStoreDeltaThreshold = Math.max(0, Number(process.env.TRACKING_P5_HOT_STORE_ERROR_DELTA || 5));
  if (Number.isFinite(hotStoreDelta) && hotStoreDelta >= hotStoreDeltaThreshold) {
    const def = getIncidentDefinition("HOT_STORE_DEGRADED");
    out.push({
      ...def,
      subject: { scope: "GLOBAL" },
      evidence: {
        hotStoreErrorDelta: hotStoreDelta,
        threshold: hotStoreDeltaThreshold,
      },
    });
  }

  return out;
}

export function incidentKeyFor(d: DetectedIncident): string {
  const type = d.type;
  const scope = d.subject.scope;
  const entity =
    scope === "ORDER"
      ? d.subject.orderId
      : scope === "RIDER"
      ? d.subject.riderId
      : scope === "REGION"
      ? d.subject.region
      : "GLOBAL";

  return `${type}:${scope}:${String(entity || "")}`;
}

export function incidentIdFor(d: DetectedIncident): string {
  // Stable ID so detection is idempotent.
  return Buffer.from(incidentKeyFor(d)).toString("base64url");
}

export function incidentTypeFromKey(key: string): IncidentType {
  return String(key || "").split(":")[0] as IncidentType;
}
