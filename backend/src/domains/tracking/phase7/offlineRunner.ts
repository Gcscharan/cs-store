import redisClient from "../../../config/redis";
import { getInternalMetricsSnapshot, setGauge, incCounterWithLabels } from "../../../ops/opsMetrics";
import { listIncidents } from "../phase5/incidents/store";
import { getLatestSloSnapshot } from "../phase6/sloSnapshots";
import { generateAllInsights } from "./generateInsights";
import { LearningSnapshot } from "./types";
import { appendLearningInsight } from "./store";

const LAST_SNAPSHOT_KEY = "tracking:learning:last_snapshot";

export async function buildLearningSnapshot(now: Date): Promise<LearningSnapshot> {
  const opsMetrics = getInternalMetricsSnapshot();
  const incidents = await listIncidents({ limit: 500 });

  const rawEsc = await redisClient.get("tracking:escalations:last_status");
  const escalationsStatus = rawEsc
    ? (() => {
        try {
          return JSON.parse(rawEsc);
        } catch {
          return undefined;
        }
      })()
    : undefined;

  const sloSnapshot = await getLatestSloSnapshot();

  return {
    asOf: now.toISOString(),
    opsMetrics,
    incidents: (incidents as any[]).map((i) => ({
      id: String(i.id),
      type: String(i.type),
      severity: String(i.severity),
      scope: String(i.scope),
      status: String(i.status),
      detectedAt: String(i.detectedAt),
      ackedAt: i.ackedAt,
      closedAt: i.closedAt,
      closeReason: (i as any).closeReason,
    })),
    escalationsStatus: escalationsStatus
      ? {
          lastRunAt: String(escalationsStatus.lastRunAt || ""),
          scannedIncidents: Number(escalationsStatus.scannedIncidents || 0),
          decisions: Array.isArray(escalationsStatus.decisions)
            ? escalationsStatus.decisions.map((d: any) => ({
                action: String(d.action || ""),
                severity: d.severity ? String(d.severity) : undefined,
                stepIndex: Number.isFinite(Number(d.stepIndex)) ? Number(d.stepIndex) : undefined,
              }))
            : [],
        }
      : undefined,
    sloSnapshot: sloSnapshot || undefined,
  };
}

export async function runOfflineLearningAnalysis(params: { now: Date }): Promise<{ snapshot: LearningSnapshot; insightsCreated: number }> {
  const snapshot = await buildLearningSnapshot(params.now);
  await redisClient.set(LAST_SNAPSHOT_KEY, JSON.stringify(snapshot));

  const insights = generateAllInsights(snapshot);

  let created = 0;
  for (const i of insights) {
    const r = await appendLearningInsight({ insight: i });
    if (r.created) created += 1;
  }

  incCounterWithLabels("learning_analysis_runs_total", { result: "ok" });
  setGauge("learning_insights_generated_last_run", insights.length);

  return { snapshot, insightsCreated: created };
}

export async function getLastLearningSnapshot(): Promise<LearningSnapshot | null> {
  const raw = await redisClient.get(LAST_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LearningSnapshot;
  } catch {
    return null;
  }
}
