import redisClient from "../../../config/redis";

export async function checkRiderRateLimit(params: {
  riderId: string;
  windowSeconds?: number;
  max?: number;
  nowMs?: number;
}): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
  const riderId = String(params.riderId || "");
  const windowSeconds = Math.max(1, Math.min(60 * 60, Number(params.windowSeconds || 60)));
  const max = Math.max(1, Math.min(5000, Number(params.max || 120)));

  const nowMs = Number.isFinite(params.nowMs) ? Number(params.nowMs) : Date.now();
  const windowId = Math.floor(nowMs / (windowSeconds * 1000));
  const key = `tracking:rl:${riderId}:${windowId}`;

  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.expire(key, windowSeconds + 5);
  }

  const remaining = Math.max(0, max - Number(count || 0));
  const resetInSeconds = Math.max(1, windowSeconds - Math.floor((nowMs % (windowSeconds * 1000)) / 1000));
  return { allowed: Number(count || 0) <= max, remaining, resetInSeconds };
}
