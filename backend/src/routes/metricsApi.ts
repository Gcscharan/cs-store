/**
 * Metrics API — Production Dashboard Data
 * 
 * GET /internal/metrics → payment success rate, checkout conversion, socket connections
 */

import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { logger } from "../utils/logger";

const router = Router();

// Cache metrics for 60s to avoid DB load
let cachedMetrics: any = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000;

async function computeMetrics() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const db = mongoose.connection.db;
  if (!db) {
    return { error: "Database not connected" };
  }

  const ordersCollection = db.collection("orders");
  const paymentIntentsCollection = db.collection("paymentintents");

  // Payment success rate (last 24h)
  const [totalPayments, successfulPayments] = await Promise.all([
    ordersCollection.countDocuments({
      createdAt: { $gte: last24h },
      paymentMethod: "upi",
    }),
    ordersCollection.countDocuments({
      createdAt: { $gte: last24h },
      paymentMethod: "upi",
      paymentStatus: "PAID",
    }),
  ]);

  const paymentSuccessRate = totalPayments > 0
    ? ((successfulPayments / totalPayments) * 100).toFixed(1)
    : "N/A";

  // Checkout conversion (orders created / orders paid in last 24h)
  const [totalOrders, paidOrders] = await Promise.all([
    ordersCollection.countDocuments({ createdAt: { $gte: last24h } }),
    ordersCollection.countDocuments({
      createdAt: { $gte: last24h },
      paymentStatus: { $in: ["PAID", "COD"] },
    }),
  ]);

  const checkoutConversion = totalOrders > 0
    ? ((paidOrders / totalOrders) * 100).toFixed(1)
    : "N/A";

  // Pending reconciliation (stuck payments)
  const pendingReconciliation = await paymentIntentsCollection.countDocuments({
    status: { $in: ["GATEWAY_ORDER_CREATED", "PAYMENT_PROCESSING", "VERIFYING"] },
  });

  // Order status breakdown (last 24h)
  const statusBreakdown = await ordersCollection.aggregate([
    { $match: { createdAt: { $gte: last24h } } },
    { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
  ]).toArray();

  return {
    timestamp: now.toISOString(),
    period: "last_24h",
    payment: {
      total: totalPayments,
      successful: successfulPayments,
      successRate: `${paymentSuccessRate}%`,
    },
    checkout: {
      total: totalOrders,
      completed: paidOrders,
      conversionRate: `${checkoutConversion}%`,
    },
    reconciliation: {
      pendingIntents: pendingReconciliation,
    },
    orderStatus: Object.fromEntries(
      statusBreakdown.map(s => [s._id, s.count])
    ),
  };
}

router.get("/metrics", async (req: Request, res: Response) => {
  try {
    if (cachedMetrics && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return res.json({ ...cachedMetrics, cached: true });
    }

    const metrics = await computeMetrics();
    cachedMetrics = metrics;
    cacheTimestamp = Date.now();

    res.json({ ...metrics, cached: false });
  } catch (error) {
    logger.error("Failed to compute metrics", error as Error);
    res.status(500).json({ error: "Failed to compute metrics" });
  }
});

export default router;
