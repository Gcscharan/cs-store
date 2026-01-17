export type IncidentType =
  | "TRACKING_STALE"
  | "ETA_DRIFT"
  | "SLA_BREACH_RISK"
  | "RIDER_OFFLINE"
  | "GPS_ANOMALY"
  | "STREAM_LAG"
  | "HOT_STORE_DEGRADED"
  | "KILLSWITCH_TRIGGERED";

export type IncidentSeverity = "INFO" | "WARN" | "CRITICAL";

export type IncidentScope = "ORDER" | "RIDER" | "REGION" | "GLOBAL";

export type IncidentStatus = "OPEN" | "ACKED" | "CLOSED";

export type IncidentSubject =
  | { scope: "ORDER"; orderId: string }
  | { scope: "RIDER"; riderId: string }
  | { scope: "REGION"; region: string }
  | { scope: "GLOBAL" };

export type IncidentEvidence = Record<string, any>;

export interface IncidentDefinition {
  type: IncidentType;
  severity: IncidentSeverity;
  scope: IncidentScope;
}

export interface DetectedIncident {
  type: IncidentType;
  severity: IncidentSeverity;
  scope: IncidentScope;
  subject: IncidentSubject;
  evidence?: IncidentEvidence;
}

export interface IncidentRecord {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  scope: IncidentScope;
  subject: IncidentSubject;
  status: IncidentStatus;
  detectedAt: string;
  lastSeenAt: string;
  ackedAt?: string;
  ackedBy?: { userId?: string; email?: string };
  closedAt?: string;
  closedBy?: { userId?: string; email?: string };
  closeReason?: string;
  evidence?: IncidentEvidence;
}
