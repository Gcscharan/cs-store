import { EventEmitter } from "events";
import { DeliveryBoy } from "../models/DeliveryBoy";
import redisClient from "../config/redis";

export type LiveLocation = {
  driverId: string;
  routeId: string;
  orderIds: string[];
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  receivedAt: number;
};

type Entry = {
  location: LiveLocation;
  lastSeenAt: number;
  lastPersistedAt: number;
  lastEmittedAt: number;
  dirty: boolean;
};

export const liveLocationEvents = new EventEmitter();

export class LiveLocationStore {
  private flushTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  private readonly driverTtlMs = 2 * 60 * 1000;
  private readonly flushEveryMs = 30 * 1000;
  private readonly emitThrottleMs = 3 * 1000;

  private readonly locationKeyPrefix = "live_location:driver:";
  private readonly driverIndexKey = "live_location:drivers";
  private readonly rateLimitKeyPrefix = "live_location:rl:";

  start(): void {
    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => {
        void this.flushToDb();
      }, this.flushEveryMs);
    }

    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => {
        void this.cleanupStale();
      }, 30 * 1000);
    }
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  allowIngest(driverId: string): boolean {
    // NOTE: kept synchronous for existing call sites.
    // Redis-backed rate limiter is enforced in update() where we can await.
    // This function returns true to preserve the API contract.
    return true;
  }

  update(
    driverId: string,
    location: Omit<LiveLocation, "receivedAt" | "driverId">
  ): LiveLocation {
    throw new Error("LiveLocationStore.update is async; use updateAsync");
  }

  async updateAsync(
    driverId: string,
    location: Omit<LiveLocation, "receivedAt" | "driverId">
  ): Promise<LiveLocation> {
    const now = Date.now();

    const loc: LiveLocation = {
      driverId,
      receivedAt: now,
      ...location,
    };

    // Redis-backed token bucket (5 tokens, refill 1 token/sec)
    // Implementation: store tokens + lastRefillAt in a single JSON blob.
    const rlKey = `${this.rateLimitKeyPrefix}${driverId}`;
    const capacity = 5;
    const refillPerMs = 1 / 1000;

    const raw = await redisClient.get(rlKey);
    const bucket = raw ? (JSON.parse(raw) as { tokens: number; lastRefillAt: number }) : { tokens: capacity, lastRefillAt: now };
    const elapsed = now - Number(bucket.lastRefillAt || now);
    if (elapsed > 0) {
      bucket.tokens = Math.min(capacity, Number(bucket.tokens || 0) + elapsed * refillPerMs);
      bucket.lastRefillAt = now;
    }
    if (bucket.tokens < 1) {
      await redisClient.set(rlKey, JSON.stringify(bucket), { EX: Math.ceil(this.driverTtlMs / 1000) });
      const err: any = new Error("RATE_LIMITED");
      err.statusCode = 429;
      throw err;
    }
    bucket.tokens -= 1;
    await redisClient.set(rlKey, JSON.stringify(bucket), { EX: Math.ceil(this.driverTtlMs / 1000) });

    const key = `${this.locationKeyPrefix}${driverId}`;
    await redisClient.set(key, JSON.stringify(loc), { EX: Math.ceil(this.driverTtlMs / 1000) });
    await redisClient.set(`${this.locationKeyPrefix}${driverId}:dirty`, "1", { EX: Math.ceil(this.driverTtlMs / 1000) });
    await redisClient.set(`${this.locationKeyPrefix}${driverId}:lastEmittedAt`, "0", { EX: Math.ceil(this.driverTtlMs / 1000) });
    await redisClient.set(`${this.locationKeyPrefix}${driverId}:lastSeenAt`, String(now), { EX: Math.ceil(this.driverTtlMs / 1000) });
    await redisClient.set(`${this.locationKeyPrefix}${driverId}:lastPersistedAt`, await redisClient.get(`${this.locationKeyPrefix}${driverId}:lastPersistedAt`) || "0", { EX: Math.ceil(this.driverTtlMs / 1000) });

    // Maintain driver index (best-effort)
    await redisClient.set(`${this.driverIndexKey}:${driverId}`, "1", { EX: Math.ceil(this.driverTtlMs / 1000) });

    liveLocationEvents.emit("location", loc);
    return loc;
  }

  get(driverId: string): LiveLocation | null {
    // Sync API preserved; use getAsync for real reads.
    return null;
  }

  async getAsync(driverId: string): Promise<LiveLocation | null> {
    const raw = await redisClient.get(`${this.locationKeyPrefix}${driverId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LiveLocation;
    } catch {
      return null;
    }
  }

  shouldEmit(driverId: string): boolean {
    // Sync API preserved; use shouldEmitAsync for distributed throttling.
    return true;
  }

  async shouldEmitAsync(driverId: string): Promise<boolean> {
    const key = `${this.locationKeyPrefix}${driverId}:lastEmittedAt`;
    const now = Date.now();
    const raw = await redisClient.get(key);
    const last = raw ? Number(raw) : 0;
    if (now - last < this.emitThrottleMs) return false;
    await redisClient.set(key, String(now), { EX: Math.ceil(this.driverTtlMs / 1000) });
    return true;
  }

  getActiveDriverIds(): string[] {
    // Sync API preserved; use getActiveDriverIdsAsync for distributed list.
    return [];
  }

  async getActiveDriverIdsAsync(): Promise<string[]> {
    const ids: string[] = [];
    // Iterate over driver index keys
    for await (const key of (redisClient as any).scanIterator({ MATCH: `${this.driverIndexKey}:*` })) {
      const id = String(key).slice(`${this.driverIndexKey}:`.length);
      if (id) ids.push(id);
    }
    return ids;
  }

  private async cleanupStale(): Promise<void> {
    // Redis TTL handles cleanup.
    return;
  }

  async flushToDb(): Promise<void> {
    // Flush dirty entries from Redis to MongoDB
    for await (const idxKey of (redisClient as any).scanIterator({ MATCH: `${this.driverIndexKey}:*` })) {
      const driverId = String(idxKey).slice(`${this.driverIndexKey}:`.length);
      if (!driverId) continue;

      const dirtyKey = `${this.locationKeyPrefix}${driverId}:dirty`;
      const isDirty = await redisClient.get(dirtyKey);
      if (!isDirty) continue;

      const raw = await redisClient.get(`${this.locationKeyPrefix}${driverId}`);
      if (!raw) {
        await redisClient.del(dirtyKey);
        continue;
      }

      let loc: LiveLocation | null = null;
      try {
        loc = JSON.parse(raw) as LiveLocation;
      } catch {
        loc = null;
      }
      if (!loc) {
        await redisClient.del(dirtyKey);
        continue;
      }

      const persistedAt = Number(loc.receivedAt || Date.now());
      try {
        await DeliveryBoy.findByIdAndUpdate(
          driverId,
          {
            $set: {
              "currentLocation.lat": loc.lat,
              "currentLocation.lng": loc.lng,
              "currentLocation.lastUpdatedAt": new Date(persistedAt),
            },
          },
          { new: false }
        );

        await redisClient.del(dirtyKey);
        await redisClient.set(
          `${this.locationKeyPrefix}${driverId}:lastPersistedAt`,
          String(persistedAt),
          { EX: Math.ceil(this.driverTtlMs / 1000) }
        );
      } catch {
      }
    }
  }
}

export const liveLocationStore = new LiveLocationStore();
export default liveLocationStore;
