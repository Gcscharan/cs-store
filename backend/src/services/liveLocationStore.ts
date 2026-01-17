import { EventEmitter } from "events";
import { DeliveryBoy } from "../models/DeliveryBoy";

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

class DriverRateLimiter {
  private buckets = new Map<
    string,
    {
      tokens: number;
      lastRefillAt: number;
    }
  >();

  allow(driverId: string): boolean {
    const now = Date.now();
    const capacity = 5;
    const refillPerMs = 1 / 1000;

    const bucket = this.buckets.get(driverId) || {
      tokens: capacity,
      lastRefillAt: now,
    };

    const elapsed = now - bucket.lastRefillAt;
    if (elapsed > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
      bucket.lastRefillAt = now;
    }

    if (bucket.tokens < 1) {
      this.buckets.set(driverId, bucket);
      return false;
    }

    bucket.tokens -= 1;
    this.buckets.set(driverId, bucket);
    return true;
  }

  cleanup(ttlMs: number): void {
    const now = Date.now();
    for (const [driverId, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefillAt > ttlMs) {
        this.buckets.delete(driverId);
      }
    }
  }
}

export const liveLocationEvents = new EventEmitter();

export class LiveLocationStore {
  private entries = new Map<string, Entry>();
  private flushTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  private readonly driverTtlMs = 2 * 60 * 1000;
  private readonly flushEveryMs = 30 * 1000;
  private readonly emitThrottleMs = 3 * 1000;

  private readonly rateLimiter = new DriverRateLimiter();

  start(): void {
    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => {
        void this.flushToDb();
      }, this.flushEveryMs);
    }

    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupStale();
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
    return this.rateLimiter.allow(driverId);
  }

  update(
    driverId: string,
    location: Omit<LiveLocation, "receivedAt" | "driverId">
  ): LiveLocation {
    const now = Date.now();

    const entry: Entry = this.entries.get(driverId) || {
      location: {
        driverId,
        receivedAt: now,
        ...location,
      },
      lastSeenAt: now,
      lastPersistedAt: 0,
      lastEmittedAt: 0,
      dirty: false,
    };

    entry.location = {
      driverId,
      receivedAt: now,
      ...location,
    };
    entry.lastSeenAt = now;
    entry.dirty = true;

    this.entries.set(driverId, entry);

    liveLocationEvents.emit("location", entry.location);

    return entry.location;
  }

  get(driverId: string): LiveLocation | null {
    return this.entries.get(driverId)?.location || null;
  }

  shouldEmit(driverId: string): boolean {
    const entry = this.entries.get(driverId);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.lastEmittedAt < this.emitThrottleMs) {
      return false;
    }

    entry.lastEmittedAt = now;
    this.entries.set(driverId, entry);
    return true;
  }

  getActiveDriverIds(): string[] {
    return Array.from(this.entries.keys());
  }

  private cleanupStale(): void {
    const now = Date.now();
    for (const [driverId, entry] of this.entries.entries()) {
      if (now - entry.lastSeenAt > this.driverTtlMs) {
        this.entries.delete(driverId);
      }
    }

    this.rateLimiter.cleanup(this.driverTtlMs);
  }

  async flushToDb(): Promise<void> {
    for (const [driverId, entry] of this.entries.entries()) {
      if (!entry.dirty) continue;

      const persistedAt = entry.location.receivedAt;

      try {
        await DeliveryBoy.findByIdAndUpdate(
          driverId,
          {
            $set: {
              "currentLocation.lat": entry.location.lat,
              "currentLocation.lng": entry.location.lng,
              "currentLocation.lastUpdatedAt": new Date(persistedAt),
            },
          },
          { new: false }
        );

        entry.dirty = false;
        entry.lastPersistedAt = persistedAt;
        this.entries.set(driverId, entry);
      } catch {
      }
    }
  }
}

export const liveLocationStore = new LiveLocationStore();
export default liveLocationStore;
