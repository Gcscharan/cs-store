"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.ensureRedisConnection = ensureRedisConnection;
exports.getRedisConnectionState = getRedisConnectionState;
const logger_1 = require("../utils/logger");
const redis_1 = require("redis");
const resolvedRedisUrl = process.env.REDIS_URL || (process.env.NODE_ENV === "development" ? "redis://127.0.0.1:6379" : undefined);
const isTlsUrl = Boolean(resolvedRedisUrl && /^rediss:\/\//i.test(resolvedRedisUrl));
exports.redis = (0, redis_1.createClient)({
    url: resolvedRedisUrl,
    socket: {
        tls: isTlsUrl,
        keepAlive: 10000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
});
if (process.env.NODE_ENV === "test") {
    try {
        // In tests we use a mocked redis client; calling connect ensures any internal
        // connection state is initialized for consumers that expect an open client.
        if (!exports.redis.isOpen) {
            void exports.redis.connect();
        }
        // Some mocked clients don't emit events; ensure test runs see a ready client.
        exports.redis.isOpen = true;
        exports.redis.isReady = true;
    }
    catch {
        // ignore
    }
}
// Connection state tracking
let redisConnectionReady = false;
let redisConnectionError = null;
exports.redis.on("connect", () => {
    logger_1.logger.info("⚡ Redis connected successfully");
    redisConnectionReady = true;
    redisConnectionError = null;
});
exports.redis.on("ready", () => {
    redisConnectionReady = true;
});
exports.redis.on("error", (err) => {
    logger_1.logger.error("⚠️ Redis error:", err.message);
    redisConnectionError = err;
});
exports.redis.on("end", () => {
    redisConnectionReady = false;
});
const redisClient = exports.redis;
// Production Redis check - call this at startup to enforce Redis availability
async function ensureRedisConnection() {
    if (!resolvedRedisUrl) {
        logger_1.logger.error("\n" + "=".repeat(60));
        logger_1.logger.error("🚨 CRITICAL: REDIS_URL is not configured");
        logger_1.logger.error("=".repeat(60));
        logger_1.logger.error("❌ Redis is MANDATORY");
        logger_1.logger.error("❌ The application cannot start without Redis");
        logger_1.logger.error("");
        logger_1.logger.error("Please set REDIS_URL in your environment variables:");
        logger_1.logger.error("  Example: REDIS_URL=redis://user:password@host:6379");
        logger_1.logger.error("=".repeat(60) + "\n");
        return { connected: false, error: new Error("REDIS_URL is not configured") };
    }
    // Wait for connection with timeout
    if (!exports.redis.isOpen) {
        try {
            logger_1.logger.info("🔌 Connecting to Redis...");
            await exports.redis.connect();
        }
        catch (error) {
            logger_1.logger.error("\n" + "=".repeat(60));
            logger_1.logger.error("🚨 CRITICAL: Redis connection failed");
            logger_1.logger.error("=".repeat(60));
            logger_1.logger.error("❌ Error:", error?.message || error);
            logger_1.logger.error("❌ Redis is MANDATORY");
            logger_1.logger.error("❌ The application cannot start without Redis");
            logger_1.logger.error("");
            logger_1.logger.error("Please check:");
            logger_1.logger.error("  1. Redis server is running and accessible");
            logger_1.logger.error("  2. REDIS_URL is correct");
            logger_1.logger.error("  3. Network connectivity to Redis host");
            logger_1.logger.error("=".repeat(60) + "\n");
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
        logger_1.logger.error("\n" + "=".repeat(60));
        logger_1.logger.error("🚨 CRITICAL: Redis connection timeout");
        logger_1.logger.error("=".repeat(60));
        logger_1.logger.error("❌ Redis did not become ready within 5 seconds");
        logger_1.logger.error("❌ Redis is MANDATORY");
        logger_1.logger.error("❌ The application cannot start without Redis");
        logger_1.logger.error("=".repeat(60) + "\n");
        return { connected: false, error };
    }
    logger_1.logger.info("✅ Redis connection verified");
    return { connected: true };
}
// Export connection state for health checks
function getRedisConnectionState() {
    return {
        ready: redisConnectionReady,
        error: redisConnectionError?.message || null,
        isRealRedis: true,
    };
}
exports.default = redisClient;
