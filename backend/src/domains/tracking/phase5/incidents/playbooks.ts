import { IncidentType } from "./types";

export const INCIDENT_PLAYBOOKS: Record<IncidentType, {
  whatHappened: string;
  customerImpact: string;
  howToConfirm: string[];
  whatNotToDo: string[];
  immediateActions: string[];
  escalateIf: string[];
  recoveryVerification: string[];
  postIncidentChecklist: string[];
}> = {
  TRACKING_STALE: {
    whatHappened: "Tracking updates are stale/offline for an active delivery.",
    customerImpact: "Customers may see delayed or frozen tracking; ETA confidence can degrade.",
    howToConfirm: [
      "Check /admin/tracking/active for freshnessState and lastUpdatedAt age",
      "Check /admin/tracking/orders/:orderId projection.freshnessState",
      "Check /api/admin/ops/metrics for tracking_projection_freshness_total and tracking_projection_event_time_lag_ms",
    ],
    whatNotToDo: ["Do not change order lifecycle states", "Do not contact the customer automatically"],
    immediateActions: [
      "Confirm rider connectivity and device health via /admin/tracking/riders/:riderId",
      "Check stream lag and ingestion health via /api/admin/ops/metrics",
      "If widespread, consider kill switch mitigation per policy (OPS_ADMIN only)",
    ],
    escalateIf: [">5% active orders are STALE/OFFLINE", "Duration > 10 minutes"],
    recoveryVerification: ["freshnessState returns to LIVE", "projection lastUpdatedAt resumes advancing"],
    postIncidentChecklist: ["Capture incident evidence", "Identify root cause category (rider/network/stream/hot-store)", "Add prevention action item"],
  },
  ETA_DRIFT: {
    whatHappened: "ETA P90 exceeds the promised delivery window beyond tolerance.",
    customerImpact: "Higher risk of late delivery; support load may increase.",
    howToConfirm: [
      "Check /admin/tracking/risk and /admin/tracking/orders/:orderId eta + promisedWindowEnd",
      "Check projection etaP90 vs Order.estimatedDeliveryWindow.end",
    ],
    whatNotToDo: ["Do not recompute ETA outside the Phase 3 pipeline", "Do not alter payment or order completion"],
    immediateActions: ["Validate rider movement confidence and freshness", "Escalate to ops for manual intervention on the order"],
    escalateIf: ["Multiple orders in same city show ETA_DRIFT", "ETA confidence is low across many orders"],
    recoveryVerification: ["ETA confidence improves and etaP90 falls within tolerance"],
    postIncidentChecklist: ["Record drift reasons", "Check for upstream GPS/stream lag", "Tune tolerance thresholds only with data"],
  },
  SLA_BREACH_RISK: {
    whatHappened: "SLA risk escalated to HIGH for an active order.",
    customerImpact: "High probability of late delivery; may breach promised window.",
    howToConfirm: ["Check /admin/tracking/risk for HIGH items", "Inspect slaRiskReasons in /admin/tracking/orders/:orderId"],
    whatNotToDo: ["Do not auto-cancel/refund", "Do not notify customers automatically"],
    immediateActions: ["Assign ops attention to the order", "Check freshness + ETA confidence", "Coordinate with delivery team if needed"],
    escalateIf: ["SLA_BREACH_RISK affects many active orders", "LastUpdatedAt is OFFLINE for multiple riders"],
    recoveryVerification: ["Risk stabilizes and order progresses", "Projection freshness remains LIVE"],
    postIncidentChecklist: ["Capture SLA risk reasons distribution", "Review routing/partner capacity"],
  },
  RIDER_OFFLINE: {
    whatHappened: "Rider signal appears offline during an active delivery.",
    customerImpact: "Tracking may stall; ETA confidence may degrade; SLA risk may rise.",
    howToConfirm: ["Check /admin/tracking/riders/:riderId", "Check associated order projection freshnessState"],
    whatNotToDo: ["Do not change order lifecycle states"],
    immediateActions: ["Contact delivery operations to verify rider status", "Validate if issue is isolated or systemic"],
    escalateIf: ["Multiple riders offline simultaneously", "Duration > 10 minutes"],
    recoveryVerification: ["Rider returns to LIVE freshness", "Events resume in projection"],
    postIncidentChecklist: ["Capture rider/device/network evidence", "Add reliability follow-ups"],
  },
  GPS_ANOMALY: {
    whatHappened: "GPS signal quality is anomalous (e.g., very large accuracy radius with low confidence).",
    customerImpact: "Tracking accuracy degraded; ETA confidence may reduce; SLA risk can rise if prolonged.",
    howToConfirm: [
      "Inspect /admin/tracking/orders/:orderId projection.accuracyRadiusM and movementConfidence",
      "Check /admin/tracking/active for low movementConfidence clusters",
    ],
    whatNotToDo: ["Do not expose raw rider GPS to customers", "Do not change order lifecycle"],
    immediateActions: [
      "Treat as degraded signal; rely on privacy marker (not raw GPS) for internal debugging",
      "Check if this correlates with STREAM_LAG or HOT_STORE_DEGRADED",
    ],
    escalateIf: ["High volume of anomalies in a single city/region", "Anomalies persist > 10 minutes"],
    recoveryVerification: ["accuracyRadiusM decreases", "movementConfidence improves"],
    postIncidentChecklist: ["Collect sample projections and device metadata", "Review threshold suitability with real data"],
  },
  STREAM_LAG: {
    whatHappened: "Tracking stream consumption is lagging (event-time lag above threshold).",
    customerImpact: "Tracking and ETA updates can be delayed across many orders.",
    howToConfirm: [
      "Check /api/admin/ops/metrics: tracking_projection_event_time_lag_ms and tracking_projection_consumer_lag_records",
      "Check if tracking_projection_processed_total is increasing",
    ],
    whatNotToDo: ["Do not restart services blindly", "Do not toggle kill switch without confirming scope"],
    immediateActions: [
      "Confirm whether lag is local to a single consumer or systemic",
      "Inspect stream infrastructure health and ingestion publish failures",
    ],
    escalateIf: ["Lag exceeds threshold for > 5 minutes", "Customer tracking impact is observed"],
    recoveryVerification: ["Lag metrics return below threshold", "Projections resume timely updates"],
    postIncidentChecklist: ["Capture lag timeline", "Identify bottleneck (stream/consumer/DB/Redis)"],
  },
  HOT_STORE_DEGRADED: {
    whatHappened: "Redis hot store is degraded (errors/latency) impacting tracking projection reads/writes.",
    customerImpact: "Tracking reads may fail or become stale; admin diagnostics may degrade.",
    howToConfirm: [
      "Check /api/admin/ops/metrics for tracking_hot_store_write_failures_total",
      "Check error logs from projection worker and API servers",
    ],
    whatNotToDo: ["Do not purge Redis keys", "Do not change projection schema/keys"],
    immediateActions: [
      "Validate Redis connectivity and resource saturation",
      "Confirm whether failures are isolated or widespread",
    ],
    escalateIf: ["Write failures are sustained", "Multiple services show Redis errors"],
    recoveryVerification: ["Write failures stop increasing", "Freshness distribution recovers to LIVE"],
    postIncidentChecklist: ["Collect Redis error rates/latency", "Review capacity planning and alerts"],
  },
  KILLSWITCH_TRIGGERED: {
    whatHappened: "Tracking kill switch is not in CUSTOMER_READ_ENABLED mode.",
    customerImpact: "Depending on mode, customer tracking may be disabled or degraded.",
    howToConfirm: [
      "Check /admin/tracking/killswitch",
      "Check /api/admin/ops/metrics tracking_kill_switch_state",
      "Review audit logs for recent toggles",
    ],
    whatNotToDo: ["Do not flip kill switch without a reason and audit trail"],
    immediateActions: [
      "Confirm why kill switch was activated (incident, maintenance, systemic failure)",
      "Validate system health before re-enabling CUSTOMER_READ_ENABLED",
    ],
    escalateIf: ["Kill switch remains active > 10 minutes without mitigation plan"],
    recoveryVerification: ["Kill switch returns to CUSTOMER_READ_ENABLED", "Tracking projections are updating normally"],
    postIncidentChecklist: ["Capture actor + reason", "Review whether activation was necessary", "Add prevention actions"],
  },
};
