import { IncidentSeverity, IncidentType } from "../phase5/incidents/types";

export type EscalationTarget = "ONCALL_PRIMARY" | "ONCALL_SECONDARY" | "OPS_MANAGER";

export interface EscalationPolicyStep {
  afterMinutes: number;
  target: EscalationTarget;
}

export interface EscalationPolicy {
  id: string;
  appliesTo: IncidentType[];
  severity: IncidentSeverity;
  steps: EscalationPolicyStep[];
  suppressionWindowMinutes: number;
}

export interface UserRef {
  userId: string;
  email?: string;
}

export interface OnCallSchedule {
  id: string;
  team: string;
  primary: UserRef;
  secondary?: UserRef;
  timezone: string;
  effectiveFrom: string;
}

export type IncidentTimelineEventType = "detected" | "escalated" | "acknowledged" | "closed" | "note";

export interface IncidentTimelineEntry {
  id: string;
  type: IncidentTimelineEventType;
  at: string;
  actor?: { userId?: string; email?: string };
  message?: string;
  details?: Record<string, any>;
}
