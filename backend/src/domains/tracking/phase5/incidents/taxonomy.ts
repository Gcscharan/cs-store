import { IncidentDefinition, IncidentType } from "./types";

export const INCIDENT_DEFINITIONS: Record<IncidentType, IncidentDefinition> = {
  TRACKING_STALE: { type: "TRACKING_STALE", severity: "WARN", scope: "ORDER" },
  ETA_DRIFT: { type: "ETA_DRIFT", severity: "WARN", scope: "ORDER" },
  SLA_BREACH_RISK: { type: "SLA_BREACH_RISK", severity: "CRITICAL", scope: "ORDER" },
  RIDER_OFFLINE: { type: "RIDER_OFFLINE", severity: "WARN", scope: "RIDER" },
  GPS_ANOMALY: { type: "GPS_ANOMALY", severity: "WARN", scope: "ORDER" },
  STREAM_LAG: { type: "STREAM_LAG", severity: "CRITICAL", scope: "GLOBAL" },
  HOT_STORE_DEGRADED: { type: "HOT_STORE_DEGRADED", severity: "CRITICAL", scope: "GLOBAL" },
  KILLSWITCH_TRIGGERED: { type: "KILLSWITCH_TRIGGERED", severity: "CRITICAL", scope: "GLOBAL" },
};

export function getIncidentDefinition(type: IncidentType): IncidentDefinition {
  return INCIDENT_DEFINITIONS[type];
}
