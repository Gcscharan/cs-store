import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import { OutboxEvent } from "../models/OutboxEvent";
import { InventoryReservation } from "../models/InventoryReservation";
import { Product } from "../models/Product";
import { renderPrometheusMetrics } from "../ops/opsMetrics";
import { getTrackingKillSwitchMode, setTrackingKillSwitchMode } from "../domains/tracking/services/trackingKillSwitch";
import { auditLog } from "../middleware/auditLog";

const router = express.Router();

router.get("/metrics", authenticateToken, requireRole(["admin"]), async (req, res) => {
  const body = await renderPrometheusMetrics();
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(200).send(body);
});

router.get("/tracking/killswitch", authenticateToken, requireRole(["admin"]), auditLog, async (req, res) => {
  const mode = await getTrackingKillSwitchMode();
  res.json({ success: true, mode });
});

router.post("/tracking/killswitch", authenticateToken, requireRole(["admin"]), auditLog, async (req, res) => {
  const mode = String((req as any)?.body?.mode || "").toUpperCase();
  await setTrackingKillSwitchMode({
    mode: mode as any,
    actor: {
      userId: String((req as any)?.user?._id || ""),
      email: String((req as any)?.user?.email || ""),
      ip: String(req.ip || ""),
    },
  });
  res.json({ success: true, mode: await getTrackingKillSwitchMode() });
});

router.get("/outbox/failures", authenticateToken, requireRole(["admin"]), async (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 50)));
  const rows = await OutboxEvent.find({ status: "FAILED" })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    count: rows.length,
    items: rows.map((r: any) => ({
      eventId: String(r.eventId),
      eventType: String(r.eventType),
      attempts: Number(r.attempts || 0),
      lastError: r.lastError,
      occurredAt: r.occurredAt,
      updatedAt: r.updatedAt,
    })),
  });
});

router.get("/reservations/stuck", authenticateToken, requireRole(["admin"]), async (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 50)));
  const now = new Date();

  const rows = await InventoryReservation.find({
    status: "ACTIVE",
    expiresAt: { $lte: now },
  })
    .sort({ expiresAt: 1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    count: rows.length,
    items: rows.map((r: any) => ({
      orderId: String(r.orderId),
      productId: String(r.productId),
      qty: Number(r.qty || 0),
      expiresAt: r.expiresAt,
      updatedAt: r.updatedAt,
    })),
  });
});

router.get("/inventory/drift", authenticateToken, requireRole(["admin"]), async (req, res) => {
  const active = await InventoryReservation.aggregate([
    { $match: { status: "ACTIVE" } },
    { $group: { _id: "$productId", qty: { $sum: "$qty" } } },
  ]);

  const activeMap = new Map<string, number>();
  for (const row of active as any[]) {
    activeMap.set(String(row._id), Number(row.qty || 0));
  }

  const activeIds = activeMap.size ? Array.from(activeMap.keys()) : [];
  const products = await Product.find({
    $or: [
      { reservedStock: { $gt: 0 } },
      ...(activeIds.length ? [{ _id: { $in: activeIds } }] : []),
    ],
  })
    .select("name reservedStock")
    .lean();

  const drifted = (products as any[])
    .map((p) => {
      const expected = activeMap.get(String(p._id)) || 0;
      const actual = Number(p.reservedStock || 0);
      const diff = actual - expected;
      return {
        productId: String(p._id),
        name: String(p.name || ""),
        reservedStock: actual,
        expectedActiveQty: expected,
        drift: diff,
      };
    })
    .filter((d) => d.drift !== 0);

  res.json({
    success: true,
    driftedCount: drifted.length,
    drifted,
  });
});

export default router;
