import { getTrackingKillSwitchMode } from "../services/trackingKillSwitch";
import { incCounter, incCounterWithLabels, setGauge } from "../../../ops/opsMetrics";
import { getTrackingEventStream } from "../stream/trackingEventStream";
import { validateLocationSampleV1 } from "../stream/locationSampleV1";
import { haversineMeters } from "../services/trackingValidation";
import { Order } from "../../../models/Order";
import { smoothLocationSample } from "../phase2/smoothing";
import { computeMarker } from "../phase2/privacy";
import { deriveSemanticState } from "../phase2/fsm";
import { computeEta } from "../phase3/eta";
import { computeSlaRisk } from "../phase3/slaRisk";
import {
  computeFreshnessState,
  getProjectionLastSeq,
  getTrackingProjection,
  setProjectionLastSeq,
  writeTrackingProjection,
} from "../services/trackingProjectionStore";

export async function startTrackingProjectionWorker(): Promise<{ stop: () => Promise<void> }> {
  const stream = getTrackingEventStream();

  const inFlightByRider = new Map<string, Promise<void>>();
  let seen = 0;
  let processed = 0;

  const subscription = await stream.subscribeLocationSampleV1(async (msg) => {
    seen += 1;
    setGauge("tracking_projection_consumer_lag_records", Math.max(0, seen - processed));

    const parsed = validateLocationSampleV1({ body: msg.value });
    if (!parsed.ok) {
      incCounterWithLabels("tracking_projection_dropped_total", { reason: parsed.reason });
      await stream.publishDlq({ reason: parsed.reason, raw: msg.value, receivedAt: new Date().toISOString() });
      processed += 1;
      setGauge("tracking_projection_consumer_lag_records", Math.max(0, seen - processed));
      return;
    }

    const sample = parsed.value;
    const riderKey = String(sample.riderId || "");
    const prev = inFlightByRider.get(riderKey) || Promise.resolve();

    const next = prev
      .catch(() => undefined)
      .then(async () => {
        const mode = await getTrackingKillSwitchMode();
        setGauge("tracking_kill_switch_state", mode);

        if (mode === "OFF") {
          incCounterWithLabels("tracking_projection_dropped_total", { reason: "kill_switch_off" });
          return;
        }

        const lastSeq = await getProjectionLastSeq({ riderId: sample.riderId, orderId: sample.orderId });
        if (lastSeq !== null && sample.seq <= lastSeq) {
          incCounter("tracking_projection_deduped_total");
          return;
        }

        const projectionTtlSeconds = Math.max(
          60,
          Math.min(24 * 60 * 60, Number(process.env.TRACKING_PROJECTION_TTL_SECONDS || 60 * 60))
        );

        const existing = await getTrackingProjection(sample.orderId);
        if (existing) {
          incCounter("tracking_projection_overwrites_total");
        }

        const movementThresholdM = Math.max(1, Math.min(500, Number(process.env.TRACKING_MOVEMENT_THRESHOLD_M || 15)));
        const phase1MovementState =
          existing && Number.isFinite(existing.lastLat) && Number.isFinite(existing.lastLng)
            ? haversineMeters(
                { lat: existing.lastLat, lng: existing.lastLng },
                { lat: sample.lat, lng: sample.lng }
              ) >= movementThresholdM
              ? "MOVING"
              : "STATIONARY"
            : sample.speedMps !== undefined
            ? sample.speedMps >= 1
              ? "MOVING"
              : "STATIONARY"
            : "UNKNOWN";

        const freshnessState = computeFreshnessState({
          lastUpdatedAt: sample.serverReceivedAt,
          staleAfterSeconds: Number(process.env.TRACKING_PROJECTION_STALE_SECONDS || 60),
          offlineAfterSeconds: Number(process.env.TRACKING_PROJECTION_OFFLINE_SECONDS || 5 * 60),
        });

        incCounterWithLabels("tracking_projection_freshness_total", { value: freshnessState });

        // Phase 2 enrichment (internal only; customer API remains unchanged).
        // Uses last smoothed point if available, else falls back to last raw point.
        const smoothing = smoothLocationSample({
          prev: existing
            ? {
                smoothedLat: Number(existing.smoothedLat ?? existing.lastLat),
                smoothedLng: Number(existing.smoothedLng ?? existing.lastLng),
                lastUpdatedAt: String(existing.lastUpdatedAt),
                movementState: existing.movementState,
                movementConfidence: existing.movementConfidence,
              }
            : undefined,
          raw: {
            lat: sample.lat,
            lng: sample.lng,
            accuracyM: sample.accuracyM,
            speedMps: sample.speedMps,
            serverReceivedAt: sample.serverReceivedAt,
          },
          config: {
            maxSpeedMps: Number(process.env.TRACKING_P2_MAX_SPEED_MPS || 55),
            stationaryThresholdM: Number(process.env.TRACKING_P2_STATIONARY_THRESHOLD_M || 12),
            speedMovingThresholdMps: Number(process.env.TRACKING_P2_SPEED_MOVING_THRESHOLD_MPS || 1),
            suppressLowConfidence: String(process.env.TRACKING_P2_SUPPRESS_LOW_CONFIDENCE || "true") !== "false",
          },
        });

        const smoothed = smoothing.ok ? smoothing.value : smoothing.fallback;
        if (!smoothing.ok) {
          incCounterWithLabels("tracking_phase2_dropped_samples_total", { reason: smoothing.reason });
          console.log(
            JSON.stringify({
              type: "tracking_phase2_sample_rejected",
              reason: smoothing.reason,
              orderId: sample.orderId,
              riderId: sample.riderId,
              seq: sample.seq,
              ts: new Date().toISOString(),
            })
          );
        }

        // Fetch minimal order context (source-of-truth lifecycle + destination coords).
        const order = await Order.findById(sample.orderId)
          .select("orderStatus deliveryStatus address.lat address.lng estimatedDeliveryWindow.end")
          .lean()
          .catch(() => null);

        const destination =
          order && (order as any).address && Number.isFinite(Number((order as any).address.lat)) && Number.isFinite(Number((order as any).address.lng))
            ? { lat: Number((order as any).address.lat), lng: Number((order as any).address.lng) }
            : undefined;

        const promisedWindowEnd = (order as any)?.estimatedDeliveryWindow?.end
          ? new Date((order as any).estimatedDeliveryWindow.end).toISOString()
          : undefined;

        const semantic = deriveSemanticState({
          prevInternalState: (existing as any)?.internalState,
          prevCheckpointState: (existing as any)?.checkpointState,
          lastUpdatedAt: existing ? String(existing.lastUpdatedAt) : null,
          movementState: smoothed.movementState,
          nowIso: sample.serverReceivedAt,
          smoothedLat: smoothed.lat,
          smoothedLng: smoothed.lng,
          destination,
          orderStatus: order ? String((order as any).orderStatus || "") : null,
          deliveryStatus: order ? String((order as any).deliveryStatus || "") : null,
          config: {
            nearDestinationRadiusM: Number(process.env.TRACKING_P2_NEAR_DESTINATION_RADIUS_M || 200),
            deliveredCandidateRadiusM: Number(process.env.TRACKING_P2_DELIVERED_CANDIDATE_RADIUS_M || 60),
            deliveredCandidateDwellSeconds: Number(process.env.TRACKING_P2_DELIVERED_CANDIDATE_DWELL_S || 45),
          },
        });

        if (semantic.transition) {
          incCounterWithLabels("tracking_phase2_state_transitions_total", {
            from: String(semantic.transition.from || "NONE"),
            to: semantic.transition.to,
          });
          console.log(
            JSON.stringify({
              type: "tracking_phase2_state_transition",
              orderId: sample.orderId,
              riderId: sample.riderId,
              from: semantic.transition.from,
              to: semantic.transition.to,
              reason: semantic.transition.reason,
              ts: new Date().toISOString(),
            })
          );
        }

        const marker = computeMarker({
          orderId: sample.orderId,
          baseLat: smoothed.lat,
          baseLng: smoothed.lng,
          baseAccuracyM: smoothed.accuracyRadiusM,
          nearDestination: semantic.nearDestination,
          minRadiusM: Number(process.env.TRACKING_P2_MARKER_MIN_RADIUS_M || 25),
          maxRadiusM: Number(process.env.TRACKING_P2_MARKER_MAX_RADIUS_M || 180),
        });

        incCounterWithLabels("tracking_phase2_confidence_total", { value: smoothed.movementConfidence });

        // Phase 3 ETA + SLA intelligence (internal only; no customer exposure).
        const distanceRemainingM = destination
          ? haversineMeters({ lat: smoothed.lat, lng: smoothed.lng }, destination)
          : undefined;

        const eta =
          destination && distanceRemainingM !== undefined
            ? computeEta({
                existing,
                nowIso: sample.serverReceivedAt,
                smoothedLat: smoothed.lat,
                smoothedLng: smoothed.lng,
                movementState: smoothed.movementState,
                movementConfidence: smoothed.movementConfidence,
                destination,
                distanceRemainingM,
                rawSpeedMps: sample.speedMps,
                config: {
                  recomputeMovedM: Number(process.env.TRACKING_P3_RECOMPUTE_MOVED_M || 40),
                  deviationM: Number(process.env.TRACKING_P3_ROUTE_DEVIATION_M || 250),
                  idleThresholdSeconds: Number(process.env.TRACKING_P3_IDLE_THRESHOLD_S || 5 * 60),
                  suppressSeconds: Number(process.env.TRACKING_P3_SUPPRESS_FLAP_S || 150),
                  minSpeedMps: Number(process.env.TRACKING_P3_MIN_SPEED_MPS || 1.2),
                  maxSpeedMps: Number(process.env.TRACKING_P3_MAX_SPEED_MPS || 30),
                },
              })
            : { recomputed: false, result: null };

        if (eta.recomputed) {
          incCounter("tracking_phase3_eta_recompute_total");
          console.log(
            JSON.stringify({
              type: "tracking_phase3_eta_recomputed",
              orderId: sample.orderId,
              riderId: sample.riderId,
              seq: sample.seq,
              etaConfidence: eta.result?.etaConfidence,
              ts: new Date().toISOString(),
            })
          );
        }

        if (eta.result?.etaConfidence) {
          incCounterWithLabels("tracking_phase3_eta_confidence_total", { value: eta.result.etaConfidence });
        }

        const sla = computeSlaRisk({
          existing,
          nowIso: sample.serverReceivedAt,
          internalState: semantic.internalState,
          freshnessState,
          distanceRemainingM,
          etaP90: eta.result?.etaP90,
          etaConfidence: eta.result?.etaConfidence,
          promisedWindowEnd,
          phase3LastMovingAt: eta.result?.phase3LastMovingAt,
          config: {
            idleThresholdSeconds: Number(process.env.TRACKING_P3_SLA_IDLE_THRESHOLD_S || 6 * 60),
            longDistanceThresholdM: Number(process.env.TRACKING_P3_SLA_LONG_DISTANCE_M || 1500),
          },
        });

        if (sla?.slaRiskLevel) {
          incCounterWithLabels("tracking_phase3_sla_risk_level_total", { value: sla.slaRiskLevel });
        }

        const prevRisk = (existing as any)?.slaRiskLevel;
        if (sla && String(prevRisk || "NONE") !== sla.slaRiskLevel) {
          incCounter("tracking_phase3_sla_risk_transitions_total");
          console.log(
            JSON.stringify({
              type: "tracking_phase3_sla_risk_transition",
              orderId: sample.orderId,
              riderId: sample.riderId,
              from: prevRisk || null,
              to: sla.slaRiskLevel,
              reasons: sla.slaRiskReasons,
              ts: new Date().toISOString(),
            })
          );
        }

        await writeTrackingProjection({
          orderId: sample.orderId,
          projection: {
            lastLat: sample.lat,
            lastLng: sample.lng,
            accuracyRadiusM: sample.accuracyM,
            lastUpdatedAt: sample.serverReceivedAt,
            freshnessState,
            movementState: phase1MovementState,

            smoothedLat: smoothed.lat,
            smoothedLng: smoothed.lng,
            movementConfidence: smoothed.movementConfidence,
            marker,
            checkpointState: semantic.checkpointState,
            internalState: semantic.internalState,
            nearDestination: semantic.nearDestination,

            distanceRemainingM,
            etaP50: eta.result?.etaP50,
            etaP90: eta.result?.etaP90,
            etaConfidence: eta.result?.etaConfidence,
            etaUpdatedAt: eta.result?.etaUpdatedAt,
            etaAnchorLat: eta.result?.etaAnchorLat,
            etaAnchorLng: eta.result?.etaAnchorLng,
            etaAnchorDistanceRemainingM: eta.result?.etaAnchorDistanceRemainingM,
            etaAnchorUpdatedAt: eta.result?.etaAnchorUpdatedAt,
            etaSpeedEwmaMps: eta.result?.etaSpeedEwmaMps,
            phase3LastMovingAt: eta.result?.phase3LastMovingAt,

            slaRiskLevel: sla?.slaRiskLevel,
            slaRiskReasons: sla?.slaRiskReasons,
            slaRiskDetectedAt: sla?.slaRiskDetectedAt,
          },
          ttlSeconds: projectionTtlSeconds,
        });

        await setProjectionLastSeq({
          riderId: sample.riderId,
          orderId: sample.orderId,
          seq: sample.seq,
          ttlSeconds: projectionTtlSeconds,
        });

        const now = Date.now();
        const eventTimeLagMs = now - new Date(sample.deviceTimestamp).getTime();
        const processingLagMs = now - new Date(sample.serverReceivedAt).getTime();
        setGauge("tracking_projection_event_time_lag_ms", Number.isFinite(eventTimeLagMs) ? eventTimeLagMs : 0);
        setGauge("tracking_projection_processing_time_lag_ms", Number.isFinite(processingLagMs) ? processingLagMs : 0);

        incCounter("tracking_projection_processed_total");

        console.log(
          JSON.stringify({
            type: "tracking_projection_updated",
            riderId: sample.riderId,
            orderId: sample.orderId,
            seq: sample.seq,
            ts: new Date().toISOString(),
          })
        );
      })
      .finally(() => {
        processed += 1;
        setGauge("tracking_projection_consumer_lag_records", Math.max(0, seen - processed));
      });

    inFlightByRider.set(riderKey, next);
    await next;
  });

  return {
    stop: async () => {
      await subscription.stop();
    },
  };
}
