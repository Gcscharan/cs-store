export type TrackingLocationIngestV1 = {
  schemaVersion: 1;
  riderId: string;
  orderId: string;
  seq: number;
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps?: number;
  headingDeg?: number;
  deviceTs: string;
};

export type TrackingRejectReason =
  | "schema_version"
  | "auth_mismatch"
  | "bad_coords"
  | "bad_accuracy"
  | "bad_seq"
  | "bad_timestamp"
  | "timestamp_skew"
  | "impossible_speed"
  | "impossible_jump";

export function validateLocationPayload(params: {
  body: any;
  authRiderId: string;
  now?: Date;
}): { ok: true; value: TrackingLocationIngestV1 } | { ok: false; reason: TrackingRejectReason } {
  const now = params.now ?? new Date();
  const b = params.body as any;

  if (!b || typeof b !== "object") return { ok: false, reason: "schema_version" };
  if (Number(b.schemaVersion) !== 1) return { ok: false, reason: "schema_version" };

  const riderId = String(b.riderId || "");
  const orderId = String(b.orderId || "");
  if (!riderId || riderId !== params.authRiderId) return { ok: false, reason: "auth_mismatch" };
  if (!orderId) return { ok: false, reason: "bad_seq" };

  const seq = Number(b.seq);
  if (!Number.isInteger(seq) || seq < 0) return { ok: false, reason: "bad_seq" };

  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: "bad_coords" };
  }

  const accuracyM = Number(b.accuracyM);
  if (!Number.isFinite(accuracyM) || accuracyM <= 0 || accuracyM > 5000) {
    return { ok: false, reason: "bad_accuracy" };
  }

  const deviceTs = String(b.deviceTs || "");
  const deviceDate = new Date(deviceTs);
  if (!deviceTs || !Number.isFinite(deviceDate.getTime())) {
    return { ok: false, reason: "bad_timestamp" };
  }

  const skewMs = Math.abs(deviceDate.getTime() - now.getTime());
  if (skewMs > 10 * 60 * 1000) {
    return { ok: false, reason: "timestamp_skew" };
  }

  const speedMps = b.speedMps === undefined ? undefined : Number(b.speedMps);
  if (speedMps !== undefined && (!Number.isFinite(speedMps) || speedMps < 0 || speedMps > 80)) {
    return { ok: false, reason: "impossible_speed" };
  }

  const headingDeg = b.headingDeg === undefined ? undefined : Number(b.headingDeg);
  if (headingDeg !== undefined && (!Number.isFinite(headingDeg) || headingDeg < 0 || headingDeg >= 360)) {
    return { ok: false, reason: "bad_timestamp" };
  }

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      riderId,
      orderId,
      seq,
      lat,
      lng,
      accuracyM,
      speedMps,
      headingDeg,
      deviceTs: deviceDate.toISOString(),
    },
  };
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371e3;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export function detectImpossibleJump(params: {
  prev?: { lat: number; lng: number; deviceTs: string } | null;
  next: { lat: number; lng: number; deviceTs: string };
}): { ok: true } | { ok: false; reason: "impossible_jump" | "impossible_speed" } {
  if (!params.prev) return { ok: true };

  const prevTs = new Date(params.prev.deviceTs).getTime();
  const nextTs = new Date(params.next.deviceTs).getTime();
  if (!Number.isFinite(prevTs) || !Number.isFinite(nextTs)) return { ok: false, reason: "impossible_jump" };

  const dtSec = Math.max(1, Math.round((nextTs - prevTs) / 1000));
  const distM = haversineMeters({ lat: params.prev.lat, lng: params.prev.lng }, { lat: params.next.lat, lng: params.next.lng });
  const speed = distM / dtSec;

  if (speed > 80) return { ok: false, reason: "impossible_speed" };
  if (distM > 5000 && dtSec <= 60) return { ok: false, reason: "impossible_jump" };

  return { ok: true };
}
