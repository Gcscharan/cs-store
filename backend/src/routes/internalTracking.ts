import express from "express";
import { authenticateToken, requireDeliveryRole } from "../middleware/auth";
import { createRateLimit } from "../middleware/security";
import { incCounter, incCounterWithLabels, setGauge } from "../ops/opsMetrics";
import { getTrackingKillSwitchMode } from "../domains/tracking/services/trackingKillSwitch";
import { getLastSeq, setLastSeq } from "../domains/tracking/services/trackingHotStore";
import { checkRiderRateLimit } from "../domains/tracking/services/trackingRateLimit";
import { validateLocationPayload } from "../domains/tracking/services/trackingValidation";
import { getTrackingEventStream } from "../domains/tracking/stream/trackingEventStream";

const router = express.Router();

const ingestRateLimit = createRateLimit(60 * 1000, 120, "Too many location updates, please slow down.");

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
        lat: v.lat,
        lng: v.lng,
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

    incCounter("tracking_ingestion_accepted_total");
    return res.status(200).json({ status: "accepted" });
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

export default router;
