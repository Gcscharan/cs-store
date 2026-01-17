import redisClient from "../../../config/redis";
import { listIncidents } from "../phase5/incidents/store";
import { IncidentRecord } from "../phase5/incidents/types";
import { listEscalationPolicies } from "./oncallPolicyStore";
import { listOnCallSchedules } from "./oncallScheduleStore";
import { appendIncidentTimelineEntry } from "./incidentsTimelineStore";
import { decideEscalations, matchPolicies, stableAlertAttemptId } from "./escalationEngine";

export interface EscalationRunResult {
  scannedIncidents: number;
  decisions: Array<{
    incidentId: string;
    policyId: string;
    severity: string;
    stepIndex: number;
    action: "SUPPRESSED" | "DEDUPED" | "EMITTED" | "SKIPPED";
    target?: string;
    reason: string;
  }>;
}

const SUPPRESS_TTL_PREFIX = "tracking:escalations:suppress:";
const DEDUP_PREFIX = "tracking:escalations:dedup:";

function suppressKey(incidentId: string, policyId: string): string {
  return `${SUPPRESS_TTL_PREFIX}${incidentId}:${policyId}`;
}

function dedupKey(incidentId: string, policyId: string, stepIndex: number): string {
  return `${DEDUP_PREFIX}${incidentId}:${policyId}:${stepIndex}`;
}

export async function runEscalationTick(params: {
  now: Date;
  limitIncidents?: number;
}): Promise<EscalationRunResult> {
  const limit = Math.max(1, Math.min(500, Number(params.limitIncidents || 200)));
  const incidents = await listIncidents({ status: "OPEN", limit });
  const policies = await listEscalationPolicies({ limit: 200 });
  const schedules = await listOnCallSchedules({ limit: 200 });

  const decisions: EscalationRunResult["decisions"] = [];

  const scheduleByTeam = new Map<string, any>();
  for (const s of schedules) {
    scheduleByTeam.set(String(s.team || s.id), s);
  }

  for (const incident of incidents) {
    await ensureDetectedTimeline(incident);

    if (incident.status !== "OPEN") continue;

    // If incident is ACKED we should suppress; but OPEN only in query
    const matched = matchPolicies({ incident, policies });
    for (const policy of matched) {
      const suppressK = suppressKey(incident.id, policy.id);

      const suppressed = await redisClient.exists(suppressK);
      if (suppressed) {
        decisions.push({
          incidentId: incident.id,
          policyId: policy.id,
          severity: String(policy.severity),
          stepIndex: -1,
          action: "SUPPRESSED",
          reason: "suppression_window_active",
        });
        continue;
      }

      const ds = decideEscalations({ now: params.now, incident, policy });

      let emittedThisPolicy = false;
      for (const d of ds) {
        if (!d.shouldEscalate) {
          decisions.push({
            incidentId: incident.id,
            policyId: policy.id,
            severity: String(policy.severity),
            stepIndex: d.stepIndex,
            action: "SKIPPED",
            target: d.step.target,
            reason: d.reason,
          });
          continue;
        }

        if (emittedThisPolicy) {
          decisions.push({
            incidentId: incident.id,
            policyId: policy.id,
            severity: String(policy.severity),
            stepIndex: d.stepIndex,
            action: "SUPPRESSED",
            target: d.step.target,
            reason: "post_emit_suppression_same_tick",
          });
          continue;
        }

        const dedupK = dedupKey(incident.id, policy.id, d.stepIndex);
        const already = await redisClient.exists(dedupK);
        if (already) {
          decisions.push({
            incidentId: incident.id,
            policyId: policy.id,
            severity: String(policy.severity),
            stepIndex: d.stepIndex,
            action: "DEDUPED",
            target: d.step.target,
            reason: "dedup_key_exists",
          });
          continue;
        }

        await redisClient.set(dedupK, "1", { EX: 60 * 60 * 24 * 7 });

        const ttlSeconds = Math.max(0, Math.floor(Number(policy.suppressionWindowMinutes || 0) * 60));
        if (ttlSeconds > 0) {
          await redisClient.set(suppressK, "1", { EX: ttlSeconds });
        }

        const attemptId = stableAlertAttemptId({ incidentId: incident.id, policyId: policy.id, stepIndex: d.stepIndex });

        const schedule =
          scheduleByTeam.get(String((incident as any)?.subject?.region || "")) || scheduleByTeam.get(String(policy.id)) || null;

        const resolvedTarget = resolveTarget(d.step.target, schedule);

        await appendIncidentTimelineEntry({
          incidentId: incident.id,
          entry: {
            type: "escalated",
            at: params.now.toISOString(),
            details: {
              attemptId,
              policyId: policy.id,
              stepIndex: d.stepIndex,
              severity: String(policy.severity),
              target: d.step.target,
              resolvedTarget,
              reason: d.reason,
            },
          },
        });

        decisions.push({
          incidentId: incident.id,
          policyId: policy.id,
          severity: String(policy.severity),
          stepIndex: d.stepIndex,
          action: "EMITTED",
          target: d.step.target,
          reason: d.reason,
        });

        emittedThisPolicy = true;
      }
    }
  }

  return { scannedIncidents: incidents.length, decisions };
}

async function ensureDetectedTimeline(incident: IncidentRecord): Promise<void> {
  // Best-effort: write detected entry once
  const key = `tracking:oncall:incidents:detected:${incident.id}`;
  const exists = await redisClient.exists(key);
  if (exists) return;
  await redisClient.set(key, "1", { EX: 60 * 60 * 24 * 365 });
  await appendIncidentTimelineEntry({
    incidentId: incident.id,
    entry: {
      type: "detected",
      at: incident.detectedAt,
      details: {
        type: incident.type,
        severity: incident.severity,
        scope: incident.scope,
      },
    },
  });
}

function resolveTarget(target: string, schedule: any): any {
  if (!schedule) return { target, user: null };
  if (target === "ONCALL_PRIMARY") return { target, user: schedule.primary || null };
  if (target === "ONCALL_SECONDARY") return { target, user: schedule.secondary || null };
  if (target === "OPS_MANAGER") return { target, user: null };
  return { target, user: null };
}
