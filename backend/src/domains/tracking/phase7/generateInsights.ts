import { LearningConfidence, LearningDomain, LearningInsight, LearningSnapshot, stableInsightId } from "./types";

function buildInsight(params: Omit<LearningInsight, "id">): LearningInsight {
  return { ...params, id: stableInsightId(params) };
}

function labeledCounterValue(labeledCounters: Record<string, number>, prefix: string, labels: Record<string, string>): number {
  const key = `${prefix}:${Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",")}`;
  return Number(labeledCounters[key] || 0);
}

function confidenceForSample(n: number): LearningConfidence {
  if (n >= 100) return "HIGH";
  if (n >= 20) return "MEDIUM";
  return "LOW";
}

export function generateEtaInsights(snapshot: LearningSnapshot): LearningInsight[] {
  const sum = Number(snapshot.opsMetrics.counters.tracking_phase3_eta_error_ms_sum || 0);
  const count = Number(snapshot.opsMetrics.counters.tracking_phase3_eta_error_count || 0);
  const avgMs = count > 0 ? sum / count : 0;

  const conf = confidenceForSample(count);
  const impact = avgMs > 0 ? `Reduce P90 ETA error (current avg_abs_error_ms=${Math.floor(avgMs)})` : "Establish ETA accuracy baseline";

  const recommendation =
    avgMs > 10 * 60_000
      ? "Consider calibrating speed EWMA smoothing and confidence downgrade thresholds; validate via replay + shadow ETA before any promotion."
      : "Continue monitoring ETA accuracy; consider region/time-of-day baselines once enough samples accumulate.";

  return [
    buildInsight({
      domain: "ETA",
      confidence: conf,
      evidence: { etaErrorAvgMs: avgMs, etaErrorCount: count },
      recommendation,
      expectedImpact: impact,
      riskAssessment: "Risk of overfitting if tuned on small samples; must pass replay + shadow-mode validation before promotion.",
      rollbackPlan: "No production changes in Phase 7; any future promotion must be via a new Phase with a rollback to prior deterministic parameters.",
      generatedAt: snapshot.asOf,
    }),
  ];
}

export function generateIncidentQualityInsights(snapshot: LearningSnapshot): LearningInsight[] {
  const closed = snapshot.incidents.filter((i) => String(i.status).toUpperCase() === "CLOSED");
  const falsePos = closed.filter((i) => String(i.closeReason || "").toLowerCase().startsWith("false_positive"));
  const rate = closed.length > 0 ? falsePos.length / closed.length : 0;

  const conf = confidenceForSample(closed.length);

  const recommendation =
    rate >= 0.3
      ? "High false-positive rate detected; propose threshold tuning/suppression rules, validated via replay. Detection logic must remain deterministic."
      : "False-positive rate is within expected bounds; continue collecting postmortem inputs for missed-incident analysis.";

  return [
    buildInsight({
      domain: "INCIDENT",
      confidence: conf,
      evidence: { closedIncidents: closed.length, falsePositives: falsePos.length, falsePositiveRate: rate },
      recommendation,
      expectedImpact: "Reduce ops noise while preserving true-positive detection.",
      riskAssessment: "Threshold reductions may increase missed incidents; must validate with replay datasets and explicit ops sign-off.",
      rollbackPlan: "No production changes in Phase 7; any promoted change must be reversible via config rollback/new phase gating.",
      generatedAt: snapshot.asOf,
    }),
  ];
}

export function generateEscalationFatigueInsights(snapshot: LearningSnapshot): LearningInsight[] {
  const decisions = snapshot.escalationsStatus?.decisions || [];
  const emitted = decisions.filter((d) => String(d.action).toUpperCase() === "EMITTED").length;
  const suppressed = decisions.filter((d) => String(d.action).toUpperCase() === "SUPPRESSED").length;
  const total = decisions.length;

  const conf = confidenceForSample(total);

  const recommendation =
    emitted >= 10
      ? "Escalation volume is high; consider increasing suppression windows or reordering steps (suggest-only). Validate against MTTA/MTTR impact before promotion."
      : "Escalation volume is manageable; continue tracking response delay patterns to detect fatigue early.";

  return [
    buildInsight({
      domain: "ESCALATION",
      confidence: conf,
      evidence: { decisionsTotal: total, emitted, suppressed },
      recommendation,
      expectedImpact: "Reduce alert fatigue and improve response quality.",
      riskAssessment: "Over-suppression can delay response to true incidents; proposals require ops review and replay validation.",
      rollbackPlan: "Phase 7 does not modify schedules/policies. Any future promotion must include a rollback to prior policy versions.",
      generatedAt: snapshot.asOf,
    }),
  ];
}

export function generateKillSwitchEffectivenessInsights(snapshot: LearningSnapshot): LearningInsight[] {
  const labeled = snapshot.opsMetrics.labeledCounters || {};
  const activationsOff = labeledCounterValue(labeled, "tracking_killswitch_activations_total", { mode: "OFF" });
  const activationsIngest = labeledCounterValue(labeled, "tracking_killswitch_activations_total", { mode: "INGEST_ONLY" });
  const activationsCustomer = labeledCounterValue(labeled, "tracking_killswitch_activations_total", { mode: "CUSTOMER_READ_ENABLED" });

  const total = activationsOff + activationsIngest + activationsCustomer;
  const conf = confidenceForSample(total);

  const recommendation =
    total >= 5
      ? "Kill switch activations are frequent; analyze triggers and recovery verification heuristics. Propose safer auto-trigger candidates (manual approval only)."
      : "Kill switch activations are rare; continue monitoring MTTR and blast-radius estimation accuracy.";

  return [
    buildInsight({
      domain: "KILLSWITCH",
      confidence: conf,
      evidence: {
        killswitchActivationsTotal: total,
        byMode: {
          OFF: activationsOff,
          INGEST_ONLY: activationsIngest,
          CUSTOMER_READ_ENABLED: activationsCustomer,
        },
        currentStateGauge: Number(snapshot.opsMetrics.gauges.tracking_kill_switch_state || 0),
      },
      recommendation,
      expectedImpact: "Make kill switch usage rarer, faster to recover, and more correct.",
      riskAssessment: "Over-reactive triggers can unnecessarily impact tracking visibility; all proposals must remain manual and go through promotion gates.",
      rollbackPlan: "No production changes in Phase 7; any future phase must include kill switch safe rollback and explicit ops sign-off.",
      generatedAt: snapshot.asOf,
    }),
  ];
}

export function generateAllInsights(snapshot: LearningSnapshot): LearningInsight[] {
  return [
    ...generateEtaInsights(snapshot),
    ...generateIncidentQualityInsights(snapshot),
    ...generateEscalationFatigueInsights(snapshot),
    ...generateKillSwitchEffectivenessInsights(snapshot),
  ];
}
