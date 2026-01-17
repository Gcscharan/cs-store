import { OutboxEvent } from "../models/OutboxEvent";
import { InventoryReservation } from "../models/InventoryReservation";
import { Product } from "../models/Product";

type CounterName =
  | "assignment_conflicts_total"
  | "outbox_dispatch_errors_total"
  | "outbox_dispatched_total"
  | "outbox_failed_transitions_total"
  | "tracking_ingestion_received_total"
  | "tracking_ingestion_accepted_total"
  | "tracking_ingestion_deduped_total"
  | "tracking_ingestion_rate_limited_total"
  | "tracking_hot_store_write_failures_total"
  | "tracking_ingestion_published_total"
  | "tracking_ingestion_publish_failures_total"
  | "tracking_projection_processed_total"
  | "tracking_projection_deduped_total"
  | "tracking_projection_overwrites_total"
  | "tracking_projection_write_failures_total"
  | "tracking_phase3_eta_recompute_total"
  | "tracking_phase3_sla_risk_transitions_total"
  | "tracking_phase3_eta_error_ms_sum"
  | "tracking_phase3_eta_error_count";

const counters: Record<CounterName, number> = {
  assignment_conflicts_total: 0,
  outbox_dispatch_errors_total: 0,
  outbox_dispatched_total: 0,
  outbox_failed_transitions_total: 0,
  tracking_ingestion_received_total: 0,
  tracking_ingestion_accepted_total: 0,
  tracking_ingestion_deduped_total: 0,
  tracking_ingestion_rate_limited_total: 0,
  tracking_hot_store_write_failures_total: 0,
  tracking_ingestion_published_total: 0,
  tracking_ingestion_publish_failures_total: 0,
  tracking_projection_processed_total: 0,
  tracking_projection_deduped_total: 0,
  tracking_projection_overwrites_total: 0,
  tracking_projection_write_failures_total: 0,
  tracking_phase3_eta_recompute_total: 0,
  tracking_phase3_sla_risk_transitions_total: 0,
  tracking_phase3_eta_error_ms_sum: 0,
  tracking_phase3_eta_error_count: 0,
};

const labeledCounters: Record<string, number> = {};
const gauges: Record<string, number> = {};

export function getInternalMetricsSnapshot(): {
  counters: Record<string, number>;
  labeledCounters: Record<string, number>;
  gauges: Record<string, number>;
} {
  return {
    counters: { ...(counters as any) },
    labeledCounters: { ...labeledCounters },
    gauges: { ...gauges },
  };
}

export function incCounter(name: CounterName, by: number = 1): void {
  counters[name] = Number(counters[name] || 0) + Number(by || 0);
}

export function incCounterWithLabels(name: string, labels: Record<string, string>, by: number = 1): void {
  const key = `${name}:${Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",")}`;
  labeledCounters[key] = Number(labeledCounters[key] || 0) + Number(by || 0);
}

export function setGauge(name: string, value: number | string): void {
  if (name === "tracking_kill_switch_state") {
    const raw = String(value || "OFF").toUpperCase();
    const mapped = raw === "CUSTOMER_READ_ENABLED" ? 2 : raw === "INGEST_ONLY" ? 1 : 0;
    gauges[name] = mapped;
    return;
  }
  const n = typeof value === "number" ? value : Number(value);
  gauges[name] = Number.isFinite(n) ? n : 0;
}

function formatMetricLine(name: string, value: number, labels?: Record<string, string>): string {
  const v = Number.isFinite(value) ? value : 0;
  if (!labels || Object.keys(labels).length === 0) {
    return `${name} ${v}`;
  }
  const labelStr = Object.entries(labels)
    .map(([k, val]) => `${k}="${String(val).replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}"`)
    .join(",");
  return `${name}{${labelStr}} ${v}`;
}

async function computeInventoryDrift(): Promise<{ driftProducts: number; driftQtyTotal: number }> {
  const active = await InventoryReservation.aggregate([
    { $match: { status: "ACTIVE" } },
    { $group: { _id: "$productId", qty: { $sum: "$qty" } } },
  ]);

  const activeMap = new Map<string, number>();
  for (const row of active as any[]) {
    activeMap.set(String(row._id), Number(row.qty || 0));
  }

  const activeIds = Array.from(activeMap.keys());
  const products = await Product.find({
    $or: [
      { reservedStock: { $gt: 0 } },
      ...(activeIds.length ? [{ _id: { $in: activeIds } }] : []),
    ],
  })
    .select("reservedStock")
    .lean();

  let driftProducts = 0;
  let driftQtyTotal = 0;

  for (const p of products as any[]) {
    const expected = activeMap.get(String(p._id)) || 0;
    const actual = Number(p.reservedStock || 0);
    const diff = actual - expected;
    if (diff !== 0) {
      driftProducts += 1;
      driftQtyTotal += Math.abs(diff);
    }
  }

  return { driftProducts, driftQtyTotal };
}

export async function renderPrometheusMetrics(): Promise<string> {
  const [
    outboxPending,
    outboxFailed,
    outboxAttemptsAgg,
    resActive,
    resCommitted,
    resExpired,
    resReleased,
    drift,
  ] = await Promise.all([
    OutboxEvent.countDocuments({ status: "PENDING" }),
    OutboxEvent.countDocuments({ status: "FAILED" }),
    OutboxEvent.aggregate([
      { $match: { status: { $in: ["PENDING", "FAILED"] } } },
      { $group: { _id: null, attempts: { $sum: "$attempts" } } },
    ]),
    InventoryReservation.countDocuments({ status: "ACTIVE" }),
    InventoryReservation.countDocuments({ status: "COMMITTED" }),
    InventoryReservation.countDocuments({ status: "EXPIRED" }),
    InventoryReservation.countDocuments({ status: "RELEASED" }),
    computeInventoryDrift(),
  ]);

  const outboxAttempts = outboxAttemptsAgg?.length ? Number(outboxAttemptsAgg[0]?.attempts || 0) : 0;

  const lines: string[] = [];

  lines.push("# HELP ops_outbox_backlog_size Number of pending outbox events.");
  lines.push("# TYPE ops_outbox_backlog_size gauge");
  lines.push(formatMetricLine("ops_outbox_backlog_size", Number(outboxPending || 0)));

  lines.push("# HELP ops_outbox_failed_events Number of failed outbox events.");
  lines.push("# TYPE ops_outbox_failed_events gauge");
  lines.push(formatMetricLine("ops_outbox_failed_events", Number(outboxFailed || 0)));

  lines.push("# HELP ops_outbox_retry_attempts_sum Sum of attempts across pending/failed outbox rows.");
  lines.push("# TYPE ops_outbox_retry_attempts_sum gauge");
  lines.push(formatMetricLine("ops_outbox_retry_attempts_sum", outboxAttempts));

  lines.push("# HELP ops_outbox_dispatched_total Total outbox events dispatched successfully since process start.");
  lines.push("# TYPE ops_outbox_dispatched_total counter");
  lines.push(formatMetricLine("ops_outbox_dispatched_total", counters.outbox_dispatched_total));

  lines.push("# HELP ops_outbox_dispatch_errors_total Total outbox dispatch errors since process start.");
  lines.push("# TYPE ops_outbox_dispatch_errors_total counter");
  lines.push(formatMetricLine("ops_outbox_dispatch_errors_total", counters.outbox_dispatch_errors_total));

  lines.push("# HELP ops_outbox_failed_transitions_total Total times an outbox event transitioned to FAILED since process start.");
  lines.push("# TYPE ops_outbox_failed_transitions_total counter");
  lines.push(formatMetricLine("ops_outbox_failed_transitions_total", counters.outbox_failed_transitions_total));

  lines.push("# HELP ops_inventory_reservations Inventory reservation counts by status.");
  lines.push("# TYPE ops_inventory_reservations gauge");
  lines.push(formatMetricLine("ops_inventory_reservations", Number(resActive || 0), { status: "ACTIVE" }));
  lines.push(formatMetricLine("ops_inventory_reservations", Number(resCommitted || 0), { status: "COMMITTED" }));
  lines.push(formatMetricLine("ops_inventory_reservations", Number(resExpired || 0), { status: "EXPIRED" }));
  lines.push(formatMetricLine("ops_inventory_reservations", Number(resReleased || 0), { status: "RELEASED" }));

  lines.push("# HELP ops_inventory_reserved_stock_drift_products Number of products with reservedStock drift vs ACTIVE reservations.");
  lines.push("# TYPE ops_inventory_reserved_stock_drift_products gauge");
  lines.push(formatMetricLine("ops_inventory_reserved_stock_drift_products", drift.driftProducts));

  lines.push("# HELP ops_inventory_reserved_stock_drift_qty_total Total absolute drift qty across all drifted products.");
  lines.push("# TYPE ops_inventory_reserved_stock_drift_qty_total gauge");
  lines.push(formatMetricLine("ops_inventory_reserved_stock_drift_qty_total", drift.driftQtyTotal));

  lines.push("# HELP ops_assignment_conflicts_total Total assignment conflicts since process start.");
  lines.push("# TYPE ops_assignment_conflicts_total counter");
  lines.push(formatMetricLine("ops_assignment_conflicts_total", counters.assignment_conflicts_total));

  lines.push("# HELP process_uptime_seconds Process uptime in seconds.");
  lines.push("# TYPE process_uptime_seconds gauge");
  lines.push(formatMetricLine("process_uptime_seconds", Number(process.uptime())));

  lines.push("# HELP tracking_ingestion_received_total Total location ingestion requests received.");
  lines.push("# TYPE tracking_ingestion_received_total counter");
  lines.push(formatMetricLine("tracking_ingestion_received_total", counters.tracking_ingestion_received_total));

  lines.push("# HELP tracking_ingestion_accepted_total Total location samples accepted.");
  lines.push("# TYPE tracking_ingestion_accepted_total counter");
  lines.push(formatMetricLine("tracking_ingestion_accepted_total", counters.tracking_ingestion_accepted_total));

  lines.push("# HELP tracking_ingestion_deduped_total Total location samples deduped by seq.");
  lines.push("# TYPE tracking_ingestion_deduped_total counter");
  lines.push(formatMetricLine("tracking_ingestion_deduped_total", counters.tracking_ingestion_deduped_total));

  lines.push("# HELP tracking_ingestion_rate_limited_total Total ingestion requests blocked by per-rider rate limiting.");
  lines.push("# TYPE tracking_ingestion_rate_limited_total counter");
  lines.push(formatMetricLine("tracking_ingestion_rate_limited_total", counters.tracking_ingestion_rate_limited_total));

  lines.push("# HELP tracking_hot_store_write_failures_total Total failures writing tracking hot state.");
  lines.push("# TYPE tracking_hot_store_write_failures_total counter");
  lines.push(formatMetricLine("tracking_hot_store_write_failures_total", counters.tracking_hot_store_write_failures_total));

  lines.push("# HELP tracking_ingestion_published_total Total LocationSampleV1 events published to the stream.");
  lines.push("# TYPE tracking_ingestion_published_total counter");
  lines.push(formatMetricLine("tracking_ingestion_published_total", counters.tracking_ingestion_published_total));

  lines.push("# HELP tracking_ingestion_publish_failures_total Total failures publishing LocationSampleV1 events to the stream.");
  lines.push("# TYPE tracking_ingestion_publish_failures_total counter");
  lines.push(formatMetricLine("tracking_ingestion_publish_failures_total", counters.tracking_ingestion_publish_failures_total));

  lines.push("# HELP tracking_projection_processed_total Total LocationSampleV1 events processed by the projection worker.");
  lines.push("# TYPE tracking_projection_processed_total counter");
  lines.push(formatMetricLine("tracking_projection_processed_total", counters.tracking_projection_processed_total));

  lines.push("# HELP tracking_projection_deduped_total Total LocationSampleV1 events deduped by seq in the projection worker.");
  lines.push("# TYPE tracking_projection_deduped_total counter");
  lines.push(formatMetricLine("tracking_projection_deduped_total", counters.tracking_projection_deduped_total));

  lines.push("# HELP tracking_projection_overwrites_total Total times projection updates overwrote an existing projection.");
  lines.push("# TYPE tracking_projection_overwrites_total counter");
  lines.push(formatMetricLine("tracking_projection_overwrites_total", counters.tracking_projection_overwrites_total));

  lines.push("# HELP tracking_projection_write_failures_total Total failures writing projections to Redis.");
  lines.push("# TYPE tracking_projection_write_failures_total counter");
  lines.push(formatMetricLine("tracking_projection_write_failures_total", counters.tracking_projection_write_failures_total));

  lines.push("# HELP tracking_phase3_eta_recompute_total Total times the Phase 3 ETA engine recomputed ETA (best-effort; since process start).");
  lines.push("# TYPE tracking_phase3_eta_recompute_total counter");
  lines.push(formatMetricLine("tracking_phase3_eta_recompute_total", counters.tracking_phase3_eta_recompute_total));

  lines.push("# HELP tracking_phase3_sla_risk_transitions_total Total times Phase 3 SLA risk level changed (since process start).");
  lines.push("# TYPE tracking_phase3_sla_risk_transitions_total counter");
  lines.push(
    formatMetricLine("tracking_phase3_sla_risk_transitions_total", counters.tracking_phase3_sla_risk_transitions_total)
  );

  lines.push("# HELP tracking_phase3_eta_error_ms_sum Sum of absolute ETA P50 error in ms for delivered orders (best-effort; since process start).");
  lines.push("# TYPE tracking_phase3_eta_error_ms_sum counter");
  lines.push(formatMetricLine("tracking_phase3_eta_error_ms_sum", counters.tracking_phase3_eta_error_ms_sum));

  lines.push("# HELP tracking_phase3_eta_error_count Count of delivered orders with computed ETA error (best-effort; since process start).");
  lines.push("# TYPE tracking_phase3_eta_error_count counter");
  lines.push(formatMetricLine("tracking_phase3_eta_error_count", counters.tracking_phase3_eta_error_count));

  lines.push("# HELP tracking_ingestion_rejected_total Total rejected ingestion requests by reason.");
  lines.push("# TYPE tracking_ingestion_rejected_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_ingestion_rejected_total:")) continue;
    const labelStr = k.replace("tracking_ingestion_rejected_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_ingestion_rejected_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_ingestion_rate_limited_by_rider_total Total ingestion requests blocked by per-rider rate limiting (high-cardinality; Phase 0 only).");
  lines.push("# TYPE tracking_ingestion_rate_limited_by_rider_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_ingestion_rate_limited_by_rider_total:")) continue;
    const labelStr = k.replace("tracking_ingestion_rate_limited_by_rider_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_ingestion_rate_limited_by_rider_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_projection_dropped_total Total LocationSampleV1 events dropped by reason in the projection worker.");
  lines.push("# TYPE tracking_projection_dropped_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_projection_dropped_total:")) continue;
    const labelStr = k.replace("tracking_projection_dropped_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_projection_dropped_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_projection_freshness_total Total projection freshness observations by value (LIVE/STALE/OFFLINE).");
  lines.push("# TYPE tracking_projection_freshness_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_projection_freshness_total:")) continue;
    const labelStr = k.replace("tracking_projection_freshness_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_projection_freshness_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_phase3_eta_confidence_total Total ETA confidence samples by value (high/medium/low).");
  lines.push("# TYPE tracking_phase3_eta_confidence_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_phase3_eta_confidence_total:")) continue;
    const labelStr = k.replace("tracking_phase3_eta_confidence_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_phase3_eta_confidence_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_phase3_sla_risk_level_total Total SLA risk level observations by value (NONE/LOW/MEDIUM/HIGH).");
  lines.push("# TYPE tracking_phase3_sla_risk_level_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_phase3_sla_risk_level_total:")) continue;
    const labelStr = k.replace("tracking_phase3_sla_risk_level_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_phase3_sla_risk_level_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_admin_actions_total Total admin tracking actions by action label.");
  lines.push("# TYPE tracking_admin_actions_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_admin_actions_total:")) continue;
    const labelStr = k.replace("tracking_admin_actions_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_admin_actions_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_incidents_total Total tracking incidents detected by type and severity.");
  lines.push("# TYPE tracking_incidents_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_incidents_total:")) continue;
    const labelStr = k.replace("tracking_incidents_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_incidents_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_false_positive_total Total incidents closed as false positives.");
  lines.push("# TYPE tracking_false_positive_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_false_positive_total:")) continue;
    const labelStr = k.replace("tracking_false_positive_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_false_positive_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_killswitch_activations_total Total kill switch activations by mode.");
  lines.push("# TYPE tracking_killswitch_activations_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_killswitch_activations_total:")) continue;
    const labelStr = k.replace("tracking_killswitch_activations_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_killswitch_activations_total", Number(v || 0), labels));
  }

  lines.push("# HELP sla_breach_prevented_total Total SLA breaches prevented (best-effort; based on incident closure timing).");
  lines.push("# TYPE sla_breach_prevented_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("sla_breach_prevented_total:")) continue;
    const labelStr = k.replace("sla_breach_prevented_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("sla_breach_prevented_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_kill_switch_state Current kill switch state: OFF=0, INGEST_ONLY=1, CUSTOMER_READ_ENABLED=2.");
  lines.push("# TYPE tracking_kill_switch_state gauge");
  lines.push(formatMetricLine("tracking_kill_switch_state", Number(gauges.tracking_kill_switch_state || 0)));

  lines.push("# HELP tracking_projection_consumer_lag_records Approx consumer lag in records (best-effort; depends on stream driver).");
  lines.push("# TYPE tracking_projection_consumer_lag_records gauge");
  lines.push(formatMetricLine("tracking_projection_consumer_lag_records", Number(gauges.tracking_projection_consumer_lag_records || 0)));

  lines.push("# HELP tracking_projection_event_time_lag_ms Event-time lag (now - deviceTimestamp) for latest processed event.");
  lines.push("# TYPE tracking_projection_event_time_lag_ms gauge");
  lines.push(formatMetricLine("tracking_projection_event_time_lag_ms", Number(gauges.tracking_projection_event_time_lag_ms || 0)));

  lines.push("# HELP tracking_projection_processing_time_lag_ms Processing-time lag (now - serverReceivedAt) for latest processed event.");
  lines.push("# TYPE tracking_projection_processing_time_lag_ms gauge");
  lines.push(formatMetricLine("tracking_projection_processing_time_lag_ms", Number(gauges.tracking_projection_processing_time_lag_ms || 0)));

  lines.push("# HELP tracking_incident_mttr_seconds MTTR in seconds for the most recently closed incident (best-effort).");
  lines.push("# TYPE tracking_incident_mttr_seconds gauge");
  lines.push(formatMetricLine("tracking_incident_mttr_seconds", Number(gauges.tracking_incident_mttr_seconds || 0)));

  lines.push("# HELP incident_mttr_seconds MTTR in seconds for the most recently closed incident (best-effort).");
  lines.push("# TYPE incident_mttr_seconds gauge");
  lines.push(formatMetricLine("incident_mttr_seconds", Number(gauges.incident_mttr_seconds || 0)));

  lines.push("# HELP incident_mtta_seconds MTTA in seconds for the most recently acknowledged incident (best-effort).");
  lines.push("# TYPE incident_mtta_seconds gauge");
  lines.push(formatMetricLine("incident_mtta_seconds", Number(gauges.incident_mtta_seconds || 0)));

  lines.push("# HELP tracking_escalations_total Total escalation emissions by severity and step.");
  lines.push("# TYPE tracking_escalations_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_escalations_total:")) continue;
    const labelStr = k.replace("tracking_escalations_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_escalations_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_alerts_suppressed_total Total alerts suppressed by reason.");
  lines.push("# TYPE tracking_alerts_suppressed_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_alerts_suppressed_total:")) continue;
    const labelStr = k.replace("tracking_alerts_suppressed_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_alerts_suppressed_total", Number(v || 0), labels));
  }

  lines.push("# HELP tracking_oncall_pages_total Total on-call page emissions by step.");
  lines.push("# TYPE tracking_oncall_pages_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("tracking_oncall_pages_total:")) continue;
    const labelStr = k.replace("tracking_oncall_pages_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("tracking_oncall_pages_total", Number(v || 0), labels));
  }

  lines.push("# HELP learning_insights_total Total learning insights generated by domain.");
  lines.push("# TYPE learning_insights_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("learning_insights_total:")) continue;
    const labelStr = k.replace("learning_insights_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("learning_insights_total", Number(v || 0), labels));
  }

  lines.push("# HELP learning_analysis_runs_total Total offline learning analysis runs by result.");
  lines.push("# TYPE learning_analysis_runs_total counter");
  for (const [k, v] of Object.entries(labeledCounters)) {
    if (!k.startsWith("learning_analysis_runs_total:")) continue;
    const labelStr = k.replace("learning_analysis_runs_total:", "");
    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",").filter(Boolean)) {
      const [lk, lv] = pair.split("=");
      if (lk) labels[lk] = String(lv || "");
    }
    lines.push(formatMetricLine("learning_analysis_runs_total", Number(v || 0), labels));
  }

  lines.push("# HELP learning_false_positive_rate Latest computed incident false-positive rate from learning snapshots (0-1).");
  lines.push("# TYPE learning_false_positive_rate gauge");
  lines.push(formatMetricLine("learning_false_positive_rate", Number(gauges.learning_false_positive_rate || 0)));

  lines.push("# HELP learning_insights_generated_last_run Number of insights generated in the latest offline learning run.");
  lines.push("# TYPE learning_insights_generated_last_run gauge");
  lines.push(formatMetricLine("learning_insights_generated_last_run", Number(gauges.learning_insights_generated_last_run || 0)));

  return lines.join("\n") + "\n";
}

export async function getOpsSnapshot(): Promise<any> {
  const metrics = await renderPrometheusMetrics();
  return { metrics };
}
