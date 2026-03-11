import { logger } from '../utils/logger';
import { createClient } from "redis";
import { incCounterWithLabels } from "../ops/opsMetrics";

const resolvedRedisUrl =
  process.env.REDIS_URL || (process.env.NODE_ENV === "development" ? "redis://127.0.0.1:6379" : undefined);
const isTlsUrl = Boolean(resolvedRedisUrl && /^rediss:\/\//i.test(resolvedRedisUrl));

export const redis = createClient({
  url: resolvedRedisUrl,
  socket: {
    tls: isTlsUrl,
    keepAlive: 10_000,
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

if (process.env.NODE_ENV === "test") {
  try {
    // In tests we use a mocked redis client; calling connect ensures any internal
    // connection state is initialized for consumers that expect an open client.
    if (!redis.isOpen) {
      void redis.connect();
    }

    // Some mocked clients don't emit events; ensure test runs see a ready client.
    (redis as any).isOpen = true;
    (redis as any).isReady = true;
  } catch {
    // ignore
  }
}

// Connection state tracking
let redisConnectionReady = false;
let redisConnectionError: Error | null = null;

redis.on("connect", () => {
  logger.info("⚡ Redis connected successfully");
  redisConnectionReady = true;
  redisConnectionError = null;
});

redis.on("ready", () => {
  redisConnectionReady = true;
});

redis.on("error", (err) => {
  logger.error("⚠️ Redis error:", err.message);
  redisConnectionError = err;
});

redis.on("end", () => {
  redisConnectionReady = false;
});

const redisClient = redis;

// Production Redis check - call this at startup to enforce Redis availability
export async function ensureRedisConnection(): Promise<{ connected: boolean; error?: Error }> {
  if (!resolvedRedisUrl) {
    logger.error("\n" + "=".repeat(60));
    logger.error("🚨 CRITICAL: REDIS_URL is not configured");
    logger.error("=".repeat(60));
    logger.error("❌ Redis is MANDATORY");
    logger.error("❌ The application cannot start without Redis");
    logger.error("");
    logger.error("Please set REDIS_URL in your environment variables:");
    logger.error("  Example: REDIS_URL=redis://user:password@host:6379");
    logger.error("=".repeat(60) + "\n");
    return { connected: false, error: new Error("REDIS_URL is not configured") };
  }

  // Wait for connection with timeout
  if (!redis.isOpen) {
    try {
      logger.info("🔌 Connecting to Redis...");
      await redis.connect();
    } catch (error: any) {
      logger.error("\n" + "=".repeat(60));
      logger.error("🚨 CRITICAL: Redis connection failed");
      logger.error("=".repeat(60));
      logger.error("❌ Error:", error?.message || error);
      logger.error("❌ Redis is MANDATORY");
      logger.error("❌ The application cannot start without Redis");
      logger.error("");
      logger.error("Please check:");
      logger.error("  1. Redis server is running and accessible");
      logger.error("  2. REDIS_URL is correct");
      logger.error("  3. Network connectivity to Redis host");
      logger.error("=".repeat(60) + "\n");
      return { connected: false, error };
    }
  }

  // Wait for ready state with timeout
  const maxWaitMs = 5000;
  const start = Date.now();
  while (!redisConnectionReady && Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!redisConnectionReady) {
    const error = redisConnectionError || new Error("Redis connection timeout");
    logger.error("\n" + "=".repeat(60));
    logger.error("🚨 CRITICAL: Redis connection timeout");
    logger.error("=".repeat(60));
    logger.error("❌ Redis did not become ready within 5 seconds");
    logger.error("❌ Redis is MANDATORY");
    logger.error("❌ The application cannot start without Redis");
    logger.error("=".repeat(60) + "\n");
    return { connected: false, error };
  }

  logger.info("✅ Redis connection verified");
  return { connected: true };
}

// Export connection state for health checks
export function getRedisConnectionState() {
  return {
    ready: redisConnectionReady,
    error: redisConnectionError?.message || null,
    isRealRedis: true,
  };
}

export default redisClient;
