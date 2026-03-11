import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { Order } from "../models/Order";
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
    const order = await Order.findById(orderId).select("user status address deliveryPartner").lean();
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (String((order as any).user) !== userId) {
      return res.status(403).json({ error: "Not authorized to view this order" });
    }

    // Check if order is in a trackable state
    const status = String((order as any).status || "").toUpperCase();
    if (["DELIVERED", "CANCELLED", "REFUNDED"].includes(status)) {
      return res.json({
        location: null,
        status,
        message: "Order no longer trackable",
      });
    }

    // Get live location from store
    const riderId = (order as any).deliveryPartner?._id || (order as any).deliveryPartner;
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
        console.warn("[TrackingAPI] ETA calculation failed:", e);
      }
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
      deliveryPartner: (order as any).deliveryPartner?.name 
        ? { name: (order as any).deliveryPartner.name }
        : undefined,
    });
  } catch (error: any) {
    console.error("[TrackingAPI] Error:", error);
    return res.status(500).json({ error: "Failed to get tracking info" });
  }
});

export default router;
