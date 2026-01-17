export type LocationSampleV1 = {
  schemaVersion: 1;
  riderId: string;
  orderId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps?: number;
  headingDeg?: number;
  deviceTimestamp: string;
  serverReceivedAt: string;
  seq: number;
};

export type LocationSampleRejectReason =
  | "schema_version"
  | "bad_ids"
  | "bad_coords"
  | "bad_accuracy"
  | "bad_seq"
  | "bad_timestamp"
  | "impossible_speed"
  | "bad_heading";

export function validateLocationSampleV1(params: { body: any }):
  | { ok: true; value: LocationSampleV1 }
  | { ok: false; reason: LocationSampleRejectReason } {
  const b = params.body as any;
  if (!b || typeof b !== "object") return { ok: false, reason: "schema_version" };
  if (Number(b.schemaVersion) !== 1) return { ok: false, reason: "schema_version" };

  const riderId = String(b.riderId || "");
  const orderId = String(b.orderId || "");
  if (!riderId || !orderId) return { ok: false, reason: "bad_ids" };

  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: "bad_coords" };
  }

  const accuracyM = Number(b.accuracyM);
  if (!Number.isFinite(accuracyM) || accuracyM <= 0 || accuracyM > 5000) {
    return { ok: false, reason: "bad_accuracy" };
  }

  const seq = Number(b.seq);
  if (!Number.isInteger(seq) || seq < 0) return { ok: false, reason: "bad_seq" };

  const deviceTimestamp = String(b.deviceTimestamp || "");
  const serverReceivedAt = String(b.serverReceivedAt || "");
  const d1 = new Date(deviceTimestamp);
  const d2 = new Date(serverReceivedAt);
  if (!deviceTimestamp || !Number.isFinite(d1.getTime()) || !serverReceivedAt || !Number.isFinite(d2.getTime())) {
    return { ok: false, reason: "bad_timestamp" };
  }

  const speedMps = b.speedMps === undefined ? undefined : Number(b.speedMps);
  if (speedMps !== undefined && (!Number.isFinite(speedMps) || speedMps < 0 || speedMps > 80)) {
    return { ok: false, reason: "impossible_speed" };
  }

  const headingDeg = b.headingDeg === undefined ? undefined : Number(b.headingDeg);
  if (headingDeg !== undefined && (!Number.isFinite(headingDeg) || headingDeg < 0 || headingDeg >= 360)) {
    return { ok: false, reason: "bad_heading" };
  }

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      riderId,
      orderId,
      lat,
      lng,
      accuracyM,
      speedMps,
      headingDeg,
      deviceTimestamp: d1.toISOString(),
      serverReceivedAt: d2.toISOString(),
      seq,
    },
  };
}
