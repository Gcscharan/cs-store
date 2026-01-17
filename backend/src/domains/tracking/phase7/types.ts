import crypto from "crypto";

export type LearningDomain = "ETA" | "INCIDENT" | "ESCALATION" | "KILLSWITCH";

export type LearningConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface LearningInsight {
  id: string;
  domain: LearningDomain;
  confidence: LearningConfidence;
  evidence: Record<string, any>;
  recommendation: string;
  expectedImpact: string;
  riskAssessment: string;
  rollbackPlan: string;
  generatedAt: string;
}

export interface LearningSnapshot {
  asOf: string;
  opsMetrics: {
    counters: Record<string, number>;
    labeledCounters: Record<string, number>;
    gauges: Record<string, number>;
  };
  incidents: Array<{
    id: string;
    type: string;
    severity: string;
    scope: string;
    status: string;
    detectedAt: string;
    ackedAt?: string;
    closedAt?: string;
    closeReason?: string;
  }>;
  escalationsStatus?: {
    lastRunAt?: string;
    scannedIncidents?: number;
    decisions?: Array<{ action: string; severity?: string; stepIndex?: number }>;
  };
  sloSnapshot?: {
    bucketStartIso: string;
    freshnessLivePct: number;
    etaErrorAvgMs: number;
    slaBreachPreventedTotal: number;
    generatedAt: string;
  };
}

export function stableInsightId(input: Omit<LearningInsight, "id">): string {
  const stable = {
    ...input,
    generatedAt: String(input.generatedAt || ""),
  };
  const json = JSON.stringify(stable);
  return crypto.createHash("sha1").update(json).digest("hex").slice(0, 24);
}
