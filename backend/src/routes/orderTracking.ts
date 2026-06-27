import { logger } from '../utils/logger';
import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { liveLocationStore } from "../services/liveLocationStore";
import { calculateETA } from "../domains/tracking/services/etaCalculator";

const router = express.Router();

/**
 * GET /api/orders/:orderId/tracking
 * Returns current tracking info for customer polling fallback
 * Privacy-safe: coordinates rounded to 3 decimal places
 */
router.get("/:orderId/tracking", authenticateToken, async (req: Request, res: Response) => {
  const orderId = String(req.params.orderId || "").trim();
  const userId = String((req as any)?.user?._id || "");

  if (!orderId) {
    return res.status(400).json({ error: "Order ID required" });
  }

  try {
    // Verify user owns this order
    const order = await Order.findById(orderId)
      .select("userId orderStatus address deliveryBoyId deliveryPartnerId")
      .lean();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (String((order as any).userId) !== userId) {
      return res.status(403).json({ error: "Not authorized to view this order" });
    }

    // Check if order is in a trackable state
    const status = String((order as any).orderStatus || "").toUpperCase();
    if (["DELIVERED", "CANCELLED", "REFUNDED", "FAILED", "RETURNED"].includes(status)) {
      return res.json({
        location: null,
        status,
        message: "Order no longer trackable",
      });
    }

    // Resolve the order's CURRENT delivery partner. liveLocationStore is keyed by
    // DeliveryBoy._id (see deliveryOrderController.updateLocation), and reassignment
    // updates deliveryBoyId — so reading it here always reflects the current rider
    // (Rider B after an A→B reassignment), never a stale one.
    const riderId = (order as any).deliveryBoyId;
    if (!riderId) {
      return res.json({
        location: null,
        status,
        message: "No delivery partner assigned yet",
      });
    }

    const liveLocation = liveLocationStore.get(String(riderId));
    
    if (!liveLocation) {
      return res.json({
        location: null,
        status,
        message: "Location not available",
      });
    }

    // Check if stale (>20 seconds old)
    const ageMs = Date.now() - liveLocation.timestamp;
    const isStale = ageMs > 20_000;

    // Round coordinates for privacy (3 decimal places = ~111m)
    const roundedLat = Math.round(liveLocation.lat * 1000) / 1000;
    const roundedLng = Math.round(liveLocation.lng * 1000) / 1000;

    // Calculate ETA
    let etaMinutes = 0;
    let distanceRemainingM = 0;

    if ((order as any).address?.lat && (order as any).address?.lng) {
      try {
        const etaResult = await calculateETA({
          riderLat: liveLocation.lat,
          riderLng: liveLocation.lng,
          destLat: (order as any).address.lat,
          destLng: (order as any).address.lng,
          orderId,
          accuracyM: liveLocation.accuracy || undefined,
        });
        etaMinutes = etaResult.etaMinutes;
        distanceRemainingM = etaResult.distanceRemainingM;
      } catch (e) {
        logger.warn("[TrackingAPI] ETA calculation failed:", e);
      }
    }

    // Resolve rider display name (best-effort; never blocks tracking).
    let riderName: string | undefined;
    try {
      const boy = await DeliveryBoy.findById(String(riderId)).select("name").lean();
      riderName = (boy as any)?.name || undefined;
    } catch {
      riderName = undefined;
    }

    return res.json({
      location: {
        riderLat: roundedLat,
        riderLng: roundedLng,
        etaMinutes,
        distanceRemainingM,
        lastUpdated: new Date(liveLocation.timestamp).toISOString(),
        stale: isStale,
      },
      status,
      deliveryPartner: riderName ? { name: riderName } : undefined,
    });
  } catch (error: any) {
    logger.error("[TrackingAPI] Error:", error);
    return res.status(500).json({ error: "Failed to get tracking info" });
  }
});

export default router;
