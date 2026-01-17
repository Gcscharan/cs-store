import redisClient from "../../../config/redis";

export type TrackingLatestSample = {
  riderId: string;
  orderId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  lastUpdatedAt: string;
};

const DEFAULT_TTL_SECONDS = 60 * 60;

function latestKey(orderId: string): string {
  return `tracking:latest:${orderId}`;
}

function lastSeqKey(riderId: string, orderId: string): string {
  return `tracking:lastseq:${riderId}:${orderId}`;
}

export async function getLatestSample(orderId: string): Promise<TrackingLatestSample | null> {
  const raw = await redisClient.get(latestKey(orderId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as TrackingLatestSample;
  } catch {
    return null;
  }
}

export async function writeLatestSample(params: {
  sample: TrackingLatestSample;
  ttlSeconds?: number;
}): Promise<void> {
  const ttl = Math.max(60, Math.min(24 * 60 * 60, Number(params.ttlSeconds || DEFAULT_TTL_SECONDS)));
  await redisClient.set(latestKey(params.sample.orderId), JSON.stringify(params.sample), { EX: ttl });
}

export async function getLastSeq(params: { riderId: string; orderId: string }): Promise<number | null> {
  const raw = await redisClient.get(lastSeqKey(params.riderId, params.orderId));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function setLastSeq(params: {
  riderId: string;
  orderId: string;
  seq: number;
  ttlSeconds?: number;
}): Promise<void> {
  const ttl = Math.max(60, Math.min(24 * 60 * 60, Number(params.ttlSeconds || DEFAULT_TTL_SECONDS)));
  await redisClient.set(lastSeqKey(params.riderId, params.orderId), String(params.seq), { EX: ttl });
}
