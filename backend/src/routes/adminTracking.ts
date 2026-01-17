import express from "express";
import crypto from "crypto";
import redisClient from "../config/redis";
import { authenticateToken } from "../middleware/auth";
import { Order } from "../models/Order";
import { getTrackingProjection } from "../domains/tracking/services/trackingProjectionStore";
import { getTrackingKillSwitchMode, setTrackingKillSwitchMode } from "../domains/tracking/services/trackingKillSwitch";
import { createRateLimit } from "../middleware/security";
import { auditLog } from "../middleware/auditLog";
import { incCounterWithLabels, setGauge, getInternalMetricsSnapshot } from "../ops/opsMetrics";
import { detectIncidents } from "../domains/tracking/phase5/incidents/detect";
import {
  ackIncident,
  closeIncident,
  getIncidentById,
  listIncidents,
  upsertDetectedIncident,
} from "../domains/tracking/phase5/incidents/store";
import { INCIDENT_PLAYBOOKS } from "../domains/tracking/phase5/incidents/playbooks";
import adminTrackingOncallRoutes from "./adminTrackingOncall";
import adminTrackingEscalationsRoutes from "./adminTrackingEscalations";
import adminTrackingLearningRoutes from "./adminTrackingLearning";
import { appendIncidentTimelineEntry } from "../domains/tracking/phase6/incidentsTimelineStore";
import { listEscalationPolicies } from "../domains/tracking/phase6/oncallPolicyStore";
import { matchPolicies } from "../domains/tracking/phase6/escalationEngine";

type OpsRole = "OPS_VIEWER" | "OPS_ADMIN";

const OPS_ROLE_KEY_PREFIX = "ops:role:";

function etagOf(body: any): string {
  const stable =
    body && typeof body === "object" && !Array.isArray(body)
      ? (() => {
          const copy: any = { ...(body as any) };
          delete copy.generatedAt;
          return copy;
        })()
      : body;
  const json = JSON.stringify(stable);
  return 'W/"' + crypto.createHash("sha1").update(json).digest("hex") + '"';
}

function sendWithEtag(req: express.Request, res: express.Response, body: any, maxAgeSeconds: number = 5): void {
  const etag = etagOf(body);
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", `private, max-age=${Math.max(0, Math.min(30, Number(maxAgeSeconds || 0)))}`);

  const ifNoneMatch = String(req.headers["if-none-match"] || "");
  if (ifNoneMatch && ifNoneMatch === etag) {
    res.status(304).end();
    return;
  }

  res.status(200).json(body);
}

async function getOpsRoleForUser(userId: string): Promise<OpsRole> {
  const raw = await redisClient.get(`${OPS_ROLE_KEY_PREFIX}${userId}`);
  const v = String(raw || "").toUpperCase();
  if (v === "OPS_ADMIN") return "OPS_ADMIN";
  if (v === "OPS_VIEWER") return "OPS_VIEWER";
  return "OPS_VIEWER";
}

function requireOpsRole(minRole: OpsRole) {
  return async (req: any, res: any, next: any) => {
    if (!req.user || String(req.user.role || "") !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const userId = String(req.user._id || "");
    const role = await getOpsRoleForUser(userId);

    if (minRole === "OPS_ADMIN" && role !== "OPS_ADMIN") {
      return res.status(403).json({ message: "OPS_ADMIN access required" });
    }

    (req as any).opsRole = role;
    next();
  };
}

function parseIsoMs(iso: any): number | null {
  const d = new Date(String(iso || ""));
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

const router = express.Router();

// Phase 6 - On-call readiness (additive)
router.use("/oncall", adminTrackingOncallRoutes);
router.use("/escalations", adminTrackingEscalationsRoutes);

// Phase 7 - Learning loop (read-only)
router.use("/learning", adminTrackingLearningRoutes);

const INCIDENT_RUNNER_STATE_KEY = "tracking:incidents:runner:last_hot_store_failures";

async function getHotStoreErrorDelta(): Promise<number> {
  const snap = getInternalMetricsSnapshot();
  const cur = Number((snap.counters as any)?.tracking_hot_store_write_failures_total || 0);
  const prevRaw = await redisClient.get(INCIDENT_RUNNER_STATE_KEY);
  const prev = Number(prevRaw || 0);
  const delta = Math.max(0, cur - (Number.isFinite(prev) ? prev : 0));
  await redisClient.set(INCIDENT_RUNNER_STATE_KEY, String(cur));
  return delta;
}

function recordToPublic(r: any) {
  return {
    ...r,
    playbook: INCIDENT_PLAYBOOKS[r.type as keyof typeof INCIDENT_PLAYBOOKS] || null,
  };
}

router.get("/overview", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const mode = await getTrackingKillSwitchMode();

  const activeOrders = await Order.find({
    deliveryStatus: { $in: ["assigned", "picked_up", "in_transit", "arrived"] },
    orderStatus: { $nin: ["delivered", "cancelled", "DELIVERED", "CANCELLED"] },
  })
    .select("_id address.city address.pincode estimatedDeliveryWindow.end deliveryBoyId updatedAt")
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  const now = Date.now();

  const riskCounts: Record<string, number> = { NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0 };
  const freshnessCounts: Record<string, number> = { LIVE: 0, STALE: 0, OFFLINE: 0 };
  const byCity: Record<string, { active: number; risk: Record<string, number> }> = {};

  for (const o of activeOrders as any[]) {
    const orderId = String(o._id);
    const projection = await getTrackingProjection(orderId);
    const city = String(o?.address?.city || "UNKNOWN");

    if (!byCity[city]) {
      byCity[city] = { active: 0, risk: { NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0 } };
    }

    byCity[city].active += 1;

    const risk = String((projection as any)?.slaRiskLevel || "NONE").toUpperCase();
    if (riskCounts[risk] === undefined) riskCounts[risk] = 0;
    riskCounts[risk] += 1;
    if (byCity[city].risk[risk] === undefined) byCity[city].risk[risk] = 0;
    byCity[city].risk[risk] += 1;

    const freshness = String(projection?.freshnessState || "OFFLINE").toUpperCase();
    if (freshnessCounts[freshness] === undefined) freshnessCounts[freshness] = 0;
    freshnessCounts[freshness] += 1;
  }

  const response = {
    killSwitchMode: mode,
    activeDeliveriesCount: activeOrders.length,
    slaRiskCounts: riskCounts,
    freshnessCounts,
    staleOrOfflinePct:
      activeOrders.length > 0
        ? (100 * (Number(freshnessCounts.STALE || 0) + Number(freshnessCounts.OFFLINE || 0))) / activeOrders.length
        : 0,
    cityHeatmap: Object.entries(byCity).map(([city, v]) => ({ city, active: v.active, slaRiskCounts: v.risk })),
    generatedAt: new Date(now).toISOString(),
  };

  sendWithEtag(req, res, response, 5);
});

router.get("/active", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const limit = Math.max(1, Math.min(200, Number((req.query as any).limit || 50)));

  const orders = await Order.find({
    deliveryStatus: { $in: ["assigned", "picked_up", "in_transit", "arrived"] },
    orderStatus: { $nin: ["delivered", "cancelled", "DELIVERED", "CANCELLED"] },
  })
    .select("_id address.city address.pincode estimatedDeliveryWindow.end deliveryBoyId updatedAt deliveryStatus orderStatus")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const now = Date.now();

  const items = [] as any[];
  for (const o of orders as any[]) {
    const orderId = String(o._id);
    const projection = await getTrackingProjection(orderId);

    const lastUpdatedAtMs = projection ? parseIsoMs(projection.lastUpdatedAt) : null;
    const lastUpdateAgeSeconds = lastUpdatedAtMs !== null ? Math.max(0, Math.floor((now - lastUpdatedAtMs) / 1000)) : null;

    items.push({
      orderId,
      city: String(o?.address?.city || "UNKNOWN"),
      zone: String(o?.address?.pincode || ""),
      riderId: o.deliveryBoyId ? String(o.deliveryBoyId) : null,
      checkpointState: (projection as any)?.checkpointState || null,
      eta: {
        p50: (projection as any)?.etaP50 || null,
        p90: (projection as any)?.etaP90 || null,
        confidence: (projection as any)?.etaConfidence || null,
        updatedAt: (projection as any)?.etaUpdatedAt || null,
      },
      promisedWindowEnd: o?.estimatedDeliveryWindow?.end ? new Date(o.estimatedDeliveryWindow.end).toISOString() : null,
      slaRisk: {
        level: (projection as any)?.slaRiskLevel || "NONE",
        reasons: (projection as any)?.slaRiskReasons || [],
        detectedAt: (projection as any)?.slaRiskDetectedAt || null,
      },
      freshnessState: projection?.freshnessState || "OFFLINE",
      lastUpdatedAt: projection?.lastUpdatedAt || null,
      lastUpdateAgeSeconds,
      movementConfidence: (projection as any)?.movementConfidence || null,
      internalState: (projection as any)?.internalState || null,
      deliveryStatus: String(o.deliveryStatus || ""),
      orderStatus: String(o.orderStatus || ""),
    });
  }

  sendWithEtag(req, res, { count: items.length, items, generatedAt: new Date(now).toISOString() }, 5);
});

router.get("/risk", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const limit = Math.max(1, Math.min(200, Number((req.query as any).limit || 50)));

  const orders = await Order.find({
    deliveryStatus: { $in: ["assigned", "picked_up", "in_transit", "arrived"] },
    orderStatus: { $nin: ["delivered", "cancelled", "DELIVERED", "CANCELLED"] },
  })
    .select("_id address.city address.pincode estimatedDeliveryWindow.end deliveryBoyId updatedAt")
    .sort({ updatedAt: -1 })
    .limit(300)
    .lean();

  const now = Date.now();

  const risky: any[] = [];
  for (const o of orders as any[]) {
    const orderId = String(o._id);
    const projection = await getTrackingProjection(orderId);
    const level = String((projection as any)?.slaRiskLevel || "NONE").toUpperCase();
    if (level !== "MEDIUM" && level !== "HIGH") continue;

    risky.push({
      orderId,
      city: String(o?.address?.city || "UNKNOWN"),
      zone: String(o?.address?.pincode || ""),
      riderId: o.deliveryBoyId ? String(o.deliveryBoyId) : null,
      promisedWindowEnd: o?.estimatedDeliveryWindow?.end ? new Date(o.estimatedDeliveryWindow.end).toISOString() : null,
      slaRisk: {
        level,
        reasons: (projection as any)?.slaRiskReasons || [],
        detectedAt: (projection as any)?.slaRiskDetectedAt || null,
      },
      eta: {
        p50: (projection as any)?.etaP50 || null,
        p90: (projection as any)?.etaP90 || null,
      },
      lastUpdatedAt: projection?.lastUpdatedAt || null,
      freshnessState: projection?.freshnessState || "OFFLINE",
    });

    if (risky.length >= limit) break;
  }

  sendWithEtag(req, res, { count: risky.length, items: risky, generatedAt: new Date(now).toISOString() }, 5);
});

// Phase 5 - Incidents
router.get("/incidents", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const status = (req.query as any)?.status ? String((req.query as any).status).toUpperCase() : undefined;
  const type = (req.query as any)?.type ? String((req.query as any).type) : undefined;
  const severity = (req.query as any)?.severity ? String((req.query as any).severity).toUpperCase() : undefined;
  const limit = (req.query as any)?.limit ? Number((req.query as any).limit) : 100;

  const items = await listIncidents({ status: status as any, type, severity, limit });
  sendWithEtag(
    req,
    res,
    { count: items.length, items: items.map(recordToPublic), generatedAt: new Date().toISOString() },
    5
  );
});

router.get("/incidents/:id", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const id = String((req.params as any).id || "");
  const record = await getIncidentById(id);
  if (!record) return res.status(404).json({ message: "Incident not found" });
  sendWithEtag(req, res, recordToPublic(record), 5);
});

router.post(
  "/incidents/:id/ack",
  authenticateToken,
  requireOpsRole("OPS_ADMIN"),
  auditLog,
  async (req: any, res) => {
    const id = String((req.params as any).id || "");
    const now = new Date();
    const updated = await ackIncident({
      id,
      now,
      actor: { userId: String(req?.user?._id || ""), email: String(req?.user?.email || "") },
    });
    if (!updated) return res.status(404).json({ message: "Incident not found" });
    incCounterWithLabels("tracking_admin_actions_total", { action: "incident_ack" });

    if (updated.detectedAt) {
      const mttaSeconds = Math.max(0, Math.floor((now.getTime() - new Date(updated.detectedAt).getTime()) / 1000));
      setGauge("incident_mtta_seconds", mttaSeconds);
    }

    await appendIncidentTimelineEntry({
      incidentId: updated.id,
      entry: {
        type: "acknowledged",
        at: now.toISOString(),
        actor: { userId: String(req?.user?._id || ""), email: String(req?.user?.email || "") },
      },
    });

    // Suppression window (policy-aware) to prevent storms on repeated ticks
    const policies = await listEscalationPolicies({ limit: 200 });
    const matched = matchPolicies({ incident: updated as any, policies });
    for (const p of matched) {
      const ttlSeconds = Math.max(0, Math.floor(Number((p as any).suppressionWindowMinutes || 0) * 60));
      if (ttlSeconds <= 0) continue;
      await redisClient.set(`tracking:escalations:suppress:${updated.id}:${String((p as any).id)}`, "1", { EX: ttlSeconds });
    }

    res.json({ success: true, incident: recordToPublic(updated) });
  }
);

router.post(
  "/incidents/:id/close",
  authenticateToken,
  requireOpsRole("OPS_ADMIN"),
  auditLog,
  async (req: any, res) => {
    const id = String((req.params as any).id || "");
    const reason = String(req?.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "reason is required" });

    const now = new Date();
    const updated = await closeIncident({
      id,
      now,
      actor: { userId: String(req?.user?._id || ""), email: String(req?.user?.email || "") },
      reason,
    });
    if (!updated) return res.status(404).json({ message: "Incident not found" });

    incCounterWithLabels("tracking_admin_actions_total", { action: "incident_close" });

    if (updated.detectedAt && updated.closedAt) {
      const mttrSeconds = Math.max(
        0,
        Math.floor((new Date(updated.closedAt).getTime() - new Date(updated.detectedAt).getTime()) / 1000)
      );
      setGauge("tracking_incident_mttr_seconds", mttrSeconds);
      setGauge("incident_mttr_seconds", mttrSeconds);
    }

    await appendIncidentTimelineEntry({
      incidentId: updated.id,
      entry: {
        type: "closed",
        at: now.toISOString(),
        actor: { userId: String(req?.user?._id || ""), email: String(req?.user?.email || "") },
        details: { reason },
      },
    });

    if (reason.toLowerCase().startsWith("false_positive")) {
      incCounterWithLabels("tracking_false_positive_total", { type: String(updated.type || "") });
    }

    if (String(updated.type) === "SLA_BREACH_RISK" && updated.subject?.scope === "ORDER") {
      const orderId = String((updated.subject as any).orderId || "");
      const order = await Order.findById(orderId).select("estimatedDeliveryWindow.end").lean().catch(() => null);
      const endIso = (order as any)?.estimatedDeliveryWindow?.end ? new Date((order as any).estimatedDeliveryWindow.end).toISOString() : null;
      if (endIso) {
        const endMs = new Date(endIso).getTime();
        if (Number.isFinite(endMs) && now.getTime() < endMs) {
          incCounterWithLabels("sla_breach_prevented_total", { type: "SLA_BREACH_RISK" });
        }
      }
    }

    res.json({ success: true, incident: recordToPublic(updated) });
  }
);

router.post(
  "/incidents/run-detection",
  authenticateToken,
  requireOpsRole("OPS_ADMIN"),
  auditLog,
  async (req: any, res) => {
    const limit = Math.max(1, Math.min(300, Number(req?.body?.limit || 100)));

    const orders = await Order.find({
      deliveryStatus: { $in: ["assigned", "picked_up", "in_transit", "arrived"] },
      orderStatus: { $nin: ["delivered", "cancelled", "DELIVERED", "CANCELLED"] },
    })
      .select("_id address.city address.pincode estimatedDeliveryWindow.end deliveryBoyId updatedAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const now = new Date();
    const killSwitchMode = await getTrackingKillSwitchMode();
    const snap = getInternalMetricsSnapshot();
    const hotStoreErrorDelta = await getHotStoreErrorDelta();

    const globalDetections = detectIncidents({
      now,
      globals: {
        killSwitchMode,
        streamEventTimeLagMs: Number(snap.gauges?.tracking_projection_event_time_lag_ms || 0),
        projectionConsumerLagRecords: Number(snap.gauges?.tracking_projection_consumer_lag_records || 0),
        hotStoreErrorDelta,
      },
    });

    const allDetections: any[] = [];
    for (const d of globalDetections) {
      const { record, created } = await upsertDetectedIncident({ detected: d, now });
      if (created) {
        incCounterWithLabels("tracking_incidents_total", { type: d.type, severity: d.severity });

        await redisClient.set(`tracking:oncall:incidents:detected:${record.id}`, "1", { EX: 60 * 60 * 24 * 365 });
        await appendIncidentTimelineEntry({
          incidentId: record.id,
          entry: {
            type: "detected",
            at: record.detectedAt,
            details: { type: record.type, severity: record.severity, scope: record.scope },
          },
        });
      }
      allDetections.push({ id: record.id, created, incident: recordToPublic(record) });
    }

    for (const o of orders as any[]) {
      const orderId = String(o._id);
      const projection = await getTrackingProjection(orderId);
      const detections = detectIncidents({
        now,
        order: {
          orderId,
          riderId: o.deliveryBoyId ? String(o.deliveryBoyId) : null,
          promisedWindowEnd: o?.estimatedDeliveryWindow?.end ? new Date(o.estimatedDeliveryWindow.end).toISOString() : null,
          region: String(o?.address?.city || o?.address?.pincode || "") || null,
        },
        projection,
        globals: {
          // Do not include global incidents per order.
          killSwitchMode: null,
          streamEventTimeLagMs: null,
          projectionConsumerLagRecords: null,
          hotStoreErrorDelta: null,
        },
      });

      for (const d of detections) {
        const { record, created } = await upsertDetectedIncident({ detected: d, now });
        if (created) {
          incCounterWithLabels("tracking_incidents_total", { type: d.type, severity: d.severity });

          await redisClient.set(`tracking:oncall:incidents:detected:${record.id}`, "1", { EX: 60 * 60 * 24 * 365 });
          await appendIncidentTimelineEntry({
            incidentId: record.id,
            entry: {
              type: "detected",
              at: record.detectedAt,
              details: { type: record.type, severity: record.severity, scope: record.scope },
            },
          });
        }
        allDetections.push({ id: record.id, created, incident: recordToPublic(record) });
      }
    }

    sendWithEtag(
      req,
      res,
      {
        scannedOrders: orders.length,
        detections: allDetections,
        generatedAt: now.toISOString(),
      },
      5
    );
  }
);

router.get("/orders/:orderId", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const orderId = String((req.params as any).orderId || "");

  const order = await Order.findById(orderId)
    .select(
      "_id userId orderStatus deliveryStatus deliveryBoyId address.city address.pincode address.lat address.lng estimatedDeliveryWindow"
    )
    .lean();

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  const projection = await getTrackingProjection(orderId);

  const response = {
    order: {
      orderId: String((order as any)._id),
      userId: String((order as any).userId || ""),
      orderStatus: String((order as any).orderStatus || ""),
      deliveryStatus: String((order as any).deliveryStatus || ""),
      riderId: (order as any).deliveryBoyId ? String((order as any).deliveryBoyId) : null,
      city: String((order as any)?.address?.city || "UNKNOWN"),
      zone: String((order as any)?.address?.pincode || ""),
      destination: {
        lat: Number((order as any)?.address?.lat),
        lng: Number((order as any)?.address?.lng),
      },
      promisedWindow: (order as any)?.estimatedDeliveryWindow || null,
    },
    trackingProjection: projection,
    generatedAt: new Date().toISOString(),
  };

  sendWithEtag(req, res, response, 5);
});

router.get("/riders/:riderId", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const riderId = String((req.params as any).riderId || "");
  const limit = Math.max(1, Math.min(200, Number((req.query as any).limit || 100)));

  const orders = await Order.find({
    deliveryBoyId: riderId,
    deliveryStatus: { $in: ["assigned", "picked_up", "in_transit", "arrived"] },
  })
    .select("_id updatedAt")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const movementConfidenceCounts: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const freshnessCounts: Record<string, number> = { LIVE: 0, STALE: 0, OFFLINE: 0 };

  for (const o of orders as any[]) {
    const projection = await getTrackingProjection(String(o._id));
    const mc = String((projection as any)?.movementConfidence || "").toUpperCase();
    if (movementConfidenceCounts[mc] === undefined) movementConfidenceCounts[mc] = 0;
    if (mc) movementConfidenceCounts[mc] += 1;

    const fs = String(projection?.freshnessState || "OFFLINE").toUpperCase();
    if (freshnessCounts[fs] === undefined) freshnessCounts[fs] = 0;
    freshnessCounts[fs] += 1;
  }

  sendWithEtag(
    req,
    res,
    {
      riderId,
      activeOrdersCount: orders.length,
      movementConfidenceCounts,
      freshnessCounts,
      generatedAt: new Date().toISOString(),
    },
    10
  );
});

const killSwitchLimiter = createRateLimit(15 * 60 * 1000, 10, "Too many kill switch changes, please try again later.");

router.get("/killswitch", authenticateToken, requireOpsRole("OPS_VIEWER"), async (req, res) => {
  const mode = await getTrackingKillSwitchMode();
  sendWithEtag(req, res, { mode }, 5);
});

router.post(
  "/killswitch",
  killSwitchLimiter as any,
  authenticateToken,
  requireOpsRole("OPS_ADMIN"),
  auditLog,
  async (req: any, res) => {
  const mode = String(req?.body?.mode || "").toUpperCase();
  const reason = String(req?.body?.reason || "").trim();

  if (!reason) {
    return res.status(400).json({ message: "reason is required" });
  }

  incCounterWithLabels("tracking_admin_actions_total", { action: "killswitch_toggle" });
  incCounterWithLabels("tracking_killswitch_activations_total", { mode });

  await setTrackingKillSwitchMode({
    mode: mode as any,
    actor: {
      userId: String(req?.user?._id || ""),
      email: String(req?.user?.email || ""),
      ip: String(req.ip || ""),
    },
  });

  console.log(
    JSON.stringify({
      type: "tracking_admin_killswitch_requested",
      actor: { userId: String(req?.user?._id || ""), email: String(req?.user?.email || "") },
      requestedMode: mode,
      reason,
      ts: new Date().toISOString(),
    })
  );

  res.json({ success: true, mode: await getTrackingKillSwitchMode() });
  }
);

export default router;
