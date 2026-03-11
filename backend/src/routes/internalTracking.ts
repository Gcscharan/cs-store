import express from "express";
import { authenticateToken, requireDeliveryRole } from "../middleware/auth";
import { createRateLimit } from "../middleware/security";
import { incCounter, incCounterWithLabels, setGauge } from "../ops/opsMetrics";
import { getTrackingKillSwitchMode } from "../domains/tracking/services/trackingKillSwitch";
import { getLastSeq, setLastSeq } from "../domains/tracking/services/trackingHotStore";
import { checkRiderRateLimit } from "../domains/tracking/services/trackingRateLimit";
import { validateLocationPayload } from "../domains/tracking/services/trackingValidation";
import { getTrackingEventStream } from "../domains/tracking/stream/trackingEventStream";
import { kalmanFilterManager } from "../utils/kalmanFilter";
import { checkAllGeofences, getGeofenceEventMessage } from "../services/geofenceService";
import { Order } from "../models/Order";
import { getAdminAddress } from "../utils/deliveryFeeCalculator";

const router = express.Router();

const ingestRateLimit = createRateLimit(60 * 1000, 120, "Too many location updates, please slow down.");

// Maximum acceptable GPS accuracy in meters
const MAX_ACCURACY_M = 500;

// Maximum plausible speed in m/s (120 km/h = 33.33 m/s)
const MAX_PLAUSIBLE_SPEED_MPS = 33.33;

// Store last location for speed validation
const lastLocationStore = new Map<string, { lat: number; lng: number; timestamp: number }>();

/**
 * Validate GPS accuracy
 */
function validateAccuracy(accuracyM?: number): { valid: boolean; reason?: string } {
  if (accuracyM === undefined || accuracyM === null) {
    return { valid: true }; // Allow missing accuracy
  }
  if (accuracyM > MAX_ACCURACY_M) {
    return { 
      valid: false, 
      reason: `GPS accuracy too low: ${accuracyM}m > ${MAX_ACCURACY_M}m threshold` 
    };
  }
  return { valid: true };
}

/**
 * Validate speed between location updates (detect impossible jumps)
 */
function validateSpeed(
  riderId: string,
  newLat: number,
  newLng: number,
  newTimestamp: number
): { valid: boolean; reason?: string; speedMps?: number } {
  const last = lastLocationStore.get(riderId);
  if (!last) {
    return { valid: true };
  }

  const timeDiffSeconds = (newTimestamp - last.timestamp) / 1000;
  if (timeDiffSeconds <= 0) {
    return { valid: true }; // Same or earlier timestamp, skip check
  }

  // Calculate distance using Haversine
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(newLat - last.lat);
  const dLng = toRadians(newLng - last.lng);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(last.lat)) * 
    Math.cos(toRadians(newLat)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceM = R * c;

  const speedMps = distanceM / timeDiffSeconds;

  if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) {
    return {
      valid: false,
      reason: `Impossible speed detected: ${(speedMps * 3.6).toFixed(1)} km/h > ${(MAX_PLAUSIBLE_SPEED_MPS * 3.6).toFixed(1)} km/h threshold`,
      speedMps,
    };
  }

  return { valid: true, speedMps };
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

router.post("/location", authenticateToken, requireDeliveryRole, ingestRateLimit as any, async (req, res) => {
  incCounter("tracking_ingestion_received_total");

  const mode = await getTrackingKillSwitchMode();
  setGauge("tracking_kill_switch_state", mode);

  if (mode === "OFF") {
    incCounterWithLabels("tracking_ingestion_rejected_total", { reason: "kill_switch_off" });
    return res.status(403).json({ error: "tracking_disabled" });
  }

  const authRiderId = String((req as any)?.user?._id || "");
  const parsed = validateLocationPayload({ body: req.body, authRiderId });
  if (!parsed.ok) {
    incCounterWithLabels("tracking_ingestion_rejected_total", { reason: parsed.reason });
    console.log(
      JSON.stringify({
        type: "tracking_ingestion_rejected",
        reason: parsed.reason,
        riderId: authRiderId || null,
        ts: new Date().toISOString(),
      })
    );
    return res.status(400).json({ error: "invalid_payload", reason: parsed.reason });
  }

  const v = parsed.value;

  // Validate GPS accuracy
  const accuracyValidation = validateAccuracy(v.accuracyM);
  if (!accuracyValidation.valid) {
    incCounterWithLabels("tracking_ingestion_rejected_total", { reason: "accuracy_too_low" });
    console.log(
      JSON.stringify({
        type: "tracking_ingestion_accuracy_rejected",
        reason: accuracyValidation.reason,
        riderId: v.riderId,
        accuracyM: v.accuracyM,
        ts: new Date().toISOString(),
      })
    );
    return res.status(400).json({ error: "accuracy_too_low", reason: accuracyValidation.reason });
  }

  // Validate speed (detect impossible jumps)
  const deviceTs = v.deviceTs ? new Date(v.deviceTs).getTime() : Date.now();
  const speedValidation = validateSpeed(v.riderId, v.lat, v.lng, deviceTs);
  if (!speedValidation.valid) {
    incCounterWithLabels("tracking_ingestion_rejected_total", { reason: "impossible_speed" });
    console.log(
      JSON.stringify({
        type: "tracking_ingestion_speed_rejected",
        reason: speedValidation.reason,
        riderId: v.riderId,
        speedKmh: speedValidation.speedMps ? speedValidation.speedMps * 3.6 : null,
        ts: new Date().toISOString(),
      })
    );
    return res.status(400).json({ error: "impossible_speed", reason: speedValidation.reason });
  }

  // Apply Kalman filter for GPS smoothing
  const smoothed = kalmanFilterManager.update(
    v.riderId,
    v.lat,
    v.lng,
    v.accuracyM
  );

  // Use smoothed coordinates for processing
  const processedLat = smoothed.lat;
  const processedLng = smoothed.lng;

  const rl = await checkRiderRateLimit({
    riderId: v.riderId,
    windowSeconds: Number(process.env.TRACKING_RL_WINDOW_SECONDS || 60),
    max: Number(process.env.TRACKING_RL_MAX || 120),
  });
  if (!rl.allowed) {
    incCounter("tracking_ingestion_rate_limited_total");
    incCounterWithLabels("tracking_ingestion_rate_limited_by_rider_total", { riderId: v.riderId });
    console.log(
      JSON.stringify({
        type: "tracking_ingestion_rate_limited",
        riderId: v.riderId,
        orderId: v.orderId,
        ts: new Date().toISOString(),
      })
    );
    res.setHeader("Retry-After", String(rl.resetInSeconds));
    return res.status(429).json({ error: "rate_limited" });
  }

  try {
    const lastSeq = await getLastSeq({ riderId: v.riderId, orderId: v.orderId });
    if (lastSeq !== null && v.seq <= lastSeq) {
      incCounter("tracking_ingestion_deduped_total");
      return res.status(200).json({ status: "deduped" });
    }

    const stream = getTrackingEventStream();
    try {
      await stream.publishLocationSampleV1({
        schemaVersion: 1,
        riderId: v.riderId,
        orderId: v.orderId,
        lat: processedLat,
        lng: processedLng,
        accuracyM: v.accuracyM,
        speedMps: v.speedMps,
        headingDeg: v.headingDeg,
        deviceTimestamp: v.deviceTs,
        serverReceivedAt: new Date().toISOString(),
        seq: v.seq,
      });
      incCounter("tracking_ingestion_published_total");
    } catch (e: any) {
      incCounter("tracking_ingestion_publish_failures_total");
      console.log(
        JSON.stringify({
          type: "tracking_ingestion_publish_failure",
          riderId: v.riderId,
          orderId: v.orderId,
          seq: v.seq,
          error: String(e?.message || e),
          ts: new Date().toISOString(),
        })
      );
      return res.status(500).json({ error: "stream_publish_failed" });
    }

    await setLastSeq({
      riderId: v.riderId,
      orderId: v.orderId,
      seq: v.seq,
      ttlSeconds: Number(process.env.TRACKING_SAMPLE_TTL_SECONDS || 60 * 60),
    });

    // Update last location store for speed validation
    lastLocationStore.set(v.riderId, {
      lat: processedLat,
      lng: processedLng,
      timestamp: deviceTs,
    });

    // Check geofences for auto status updates (async, non-blocking)
    checkGeofencesAsync(v.riderId, v.orderId, processedLat, processedLng).catch((e) => {
      console.error("[Geofence] Check failed:", e);
    });

    incCounter("tracking_ingestion_accepted_total");
    return res.status(200).json({ 
      status: "accepted",
      smoothed: { lat: processedLat, lng: processedLng },
    });
  } catch (e) {
    incCounter("tracking_hot_store_write_failures_total");
    console.log(
      JSON.stringify({
        type: "tracking_ingestion_failure",
        riderId: v.riderId,
        orderId: v.orderId,
        ts: new Date().toISOString(),
      })
    );
    return res.status(500).json({ error: "store_failure" });
  }
});

/**
 * Check geofences asynchronously for auto status updates
 */
async function checkGeofencesAsync(
  riderId: string,
  orderId: string,
  riderLat: number,
  riderLng: number
): Promise<void> {
  try {
    // Get order with address
    const order = await Order.findById(orderId).select("address status").lean();
    if (!order || !order.address) return;

    const adminAddress = getAdminAddress();
    
    const results = await checkAllGeofences({
      riderId,
      orderId,
      riderLat,
      riderLng,
      warehouseLat: adminAddress.lat,
      warehouseLng: adminAddress.lng,
      destinationLat: order.address.lat,
      destinationLng: order.address.lng,
    });

    // Process geofence events
    for (const result of results) {
      if (result.event) {
        const message = getGeofenceEventMessage(result.event);
        console.log(JSON.stringify({
          type: "geofence_event",
          event: result.event,
          riderId,
          orderId,
          region: result.region,
          distanceMeters: result.distanceMeters,
          message: message.title,
          ts: new Date().toISOString(),
        }));

        // TODO: Emit notification to customer via socket
        // TODO: Update order status if needed
      }
    }
  } catch (error) {
    console.error("[Geofence] Async check error:", error);
  }
}

export default router;
