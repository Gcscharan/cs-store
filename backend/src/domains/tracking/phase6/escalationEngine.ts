import crypto from "crypto";
import { IncidentRecord } from "../phase5/incidents/types";
import { EscalationPolicy, EscalationTarget } from "./types";

export interface EscalationDecision {
  incidentId: string;
  policyId: string;
  stepIndex: number;
  step: { afterMinutes: number; target: EscalationTarget };
  severity: string;
  shouldEscalate: boolean;
  dedupKey: string;
  suppressionKey: string;
  reason: string;
}

function stableHash(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export function matchPolicies(params: {
  incident: IncidentRecord;
  policies: EscalationPolicy[];
}): EscalationPolicy[] {
  const type = String(params.incident.type);
  const sev = String(params.incident.severity);

  return (params.policies || []).filter((p) => {
    if (String(p.severity) !== sev) return false;
    if (!Array.isArray(p.appliesTo) || !p.appliesTo.map(String).includes(type)) return false;
    if (!Array.isArray(p.steps) || p.steps.length === 0) return false;
    return true;
  });
}

export function decideEscalations(params: {
  now: Date;
  incident: IncidentRecord;
  policy: EscalationPolicy;
}): EscalationDecision[] {
  const nowMs = params.now.getTime();
  const detectedMs = new Date(params.incident.detectedAt).getTime();
  const ageMinutes = Number.isFinite(detectedMs) ? Math.floor(Math.max(0, nowMs - detectedMs) / 60000) : 0;

  const out: EscalationDecision[] = [];
  for (let i = 0; i < params.policy.steps.length; i++) {
    const step = params.policy.steps[i];
    const after = Math.max(0, Number(step.afterMinutes || 0));
    const should = ageMinutes >= after;

    const dedupKey = `tracking:escalations:dedup:${params.incident.id}:${params.policy.id}:${i}`;
    const suppressionKey = `tracking:escalations:suppress:${params.incident.id}:${params.policy.id}`;

    out.push({
      incidentId: params.incident.id,
      policyId: params.policy.id,
      stepIndex: i,
      step: { afterMinutes: after, target: step.target },
      severity: String(params.policy.severity),
      shouldEscalate: should,
      dedupKey,
      suppressionKey,
      reason: should
        ? `age_minutes=${ageMinutes} >= after_minutes=${after}`
        : `age_minutes=${ageMinutes} < after_minutes=${after}`,
    });
  }

  // Ensure deterministic ordering by afterMinutes then target
  out.sort((a, b) => {
    if (a.step.afterMinutes !== b.step.afterMinutes) return a.step.afterMinutes - b.step.afterMinutes;
    return String(a.step.target).localeCompare(String(b.step.target));
  });

  return out;
}

export function stableAlertAttemptId(params: { incidentId: string; policyId: string; stepIndex: number }): string {
  return stableHash(`${params.incidentId}:${params.policyId}:${params.stepIndex}`).slice(0, 16);
}
