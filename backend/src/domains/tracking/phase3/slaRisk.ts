import {
  TrackingFreshnessState,
  TrackingInternalSemanticState,
  TrackingProjectionV1,
} from "../services/trackingProjectionStore";
import { Phase3EtaConfidence } from "./eta";

export type Phase3SlaRiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export type Phase3SlaRiskReason =
  | "ETA_P90_AFTER_PROMISED_WINDOW"
  | "RIDER_IDLE_IN_TRANSIT"
  | "LOW_CONFIDENCE_LONG_DISTANCE"
  | "STALE_OR_OFFLINE";

export type Phase3SlaRiskResult = {
  slaRiskLevel: Phase3SlaRiskLevel;
  slaRiskReasons: Phase3SlaRiskReason[];
  slaRiskDetectedAt: string;
};

function parseDateMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function rank(level: Phase3SlaRiskLevel | null | undefined): number {
  if (level === "HIGH") return 4;
  if (level === "MEDIUM") return 3;
  if (level === "LOW") return 2;
  if (level === "NONE") return 1;
  return 0;
}

export function computeSlaRisk(params: {
  existing: TrackingProjectionV1 | null;
  nowIso: string;
  internalState?: TrackingInternalSemanticState;
  freshnessState: TrackingFreshnessState;
  distanceRemainingM?: number;
  etaP90?: string;
  etaConfidence?: Phase3EtaConfidence;
  promisedWindowEnd?: string;
  phase3LastMovingAt?: string;
  config?: {
    idleThresholdSeconds?: number;
    longDistanceThresholdM?: number;
  };
}): Phase3SlaRiskResult | null {
  const nowMs = parseDateMs(params.nowIso);
  if (nowMs === null) return null;

  const cfg = {
    idleThresholdSeconds: Number(params.config?.idleThresholdSeconds ?? 6 * 60),
    longDistanceThresholdM: Number(params.config?.longDistanceThresholdM ?? 1500),
  };

  const reasons: Phase3SlaRiskReason[] = [];

  const etaP90Ms = parseDateMs(params.etaP90);
  const promisedEndMs = parseDateMs(params.promisedWindowEnd);
  if (etaP90Ms !== null && promisedEndMs !== null && etaP90Ms > promisedEndMs) {
    reasons.push("ETA_P90_AFTER_PROMISED_WINDOW");
  }

  const lastMovingMs = parseDateMs(params.phase3LastMovingAt);
  const idleSeconds = lastMovingMs !== null ? Math.max(0, (nowMs - lastMovingMs) / 1000) : 0;
  const inTransit = params.internalState === "IN_TRANSIT" || params.internalState === "NEAR_DESTINATION";
  if (inTransit && idleSeconds >= cfg.idleThresholdSeconds) {
    reasons.push("RIDER_IDLE_IN_TRANSIT");
  }

  const dist = Number(params.distanceRemainingM);
  const distM = Number.isFinite(dist) ? dist : null;
  const etaConf = params.etaConfidence;
  if (etaConf === "low" && distM !== null && distM >= cfg.longDistanceThresholdM) {
    reasons.push("LOW_CONFIDENCE_LONG_DISTANCE");
  }

  if (params.freshnessState !== "LIVE") {
    reasons.push("STALE_OR_OFFLINE");
  }

  let level: Phase3SlaRiskLevel = "NONE";
  if (reasons.includes("ETA_P90_AFTER_PROMISED_WINDOW")) {
    level = "HIGH";
  } else if (reasons.includes("RIDER_IDLE_IN_TRANSIT") && reasons.includes("LOW_CONFIDENCE_LONG_DISTANCE")) {
    level = "MEDIUM";
  } else if (reasons.includes("RIDER_IDLE_IN_TRANSIT")) {
    level = "MEDIUM";
  } else if (reasons.includes("LOW_CONFIDENCE_LONG_DISTANCE")) {
    level = "LOW";
  } else if (reasons.includes("STALE_OR_OFFLINE")) {
    level = "LOW";
  }

  const prevLevel = (params.existing as any)?.slaRiskLevel as Phase3SlaRiskLevel | undefined;
  const prevReasons = ((params.existing as any)?.slaRiskReasons as Phase3SlaRiskReason[] | undefined) || [];
  const prevDetectedAt = (params.existing as any)?.slaRiskDetectedAt as string | undefined;

  const mergedReasons = Array.from(new Set([...prevReasons, ...reasons]));
  const nextLevel = rank(level) >= rank(prevLevel) ? level : (prevLevel || "NONE");
  const detectedAt = prevDetectedAt || new Date(nowMs).toISOString();

  return {
    slaRiskLevel: nextLevel,
    slaRiskReasons: mergedReasons,
    slaRiskDetectedAt: detectedAt,
  };
}
