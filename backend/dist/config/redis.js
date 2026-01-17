"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("redis");
const g = globalThis;
function createInMemoryRedisClient() {
    if (!g.__redisKv)
        g.__redisKv = new Map();
    if (!g.__redisExpiries)
        g.__redisExpiries = new Map();
    const kv = g.__redisKv;
    const expiries = g.__redisExpiries;
    const isExpired = (key) => {
        const exp = expiries.get(key);
        if (!exp)
            return false;
        if (Date.now() <= exp)
            return false;
        kv.delete(key);
        expiries.delete(key);
        return true;
    };
    const client = {
        connect: async () => true,
        disconnect: async () => true,
        get: async (key) => {
            const k = String(key);
            isExpired(k);
            return kv.has(k) ? kv.get(k) : null;
        },
        set: async (key, value, opts) => {
            const k = String(key);
            kv.set(k, String(value));
            if (opts && typeof opts === "object" && Number.isFinite(Number(opts.EX))) {
                expiries.set(k, Date.now() + Number(opts.EX) * 1000);
            }
            else {
                expiries.delete(k);
            }
            return true;
        },
        del: async (key) => {
            const k = String(key);
            const existed = kv.delete(k);
            expiries.delete(k);
            return existed ? 1 : 0;
        },
        exists: async (key) => {
            const k = String(key);
            isExpired(k);
            return kv.has(k) ? 1 : 0;
        },
        incr: async (key) => {
            const k = String(key);
            isExpired(k);
            const cur = Number(kv.get(k) || 0);
            const next = Number.isFinite(cur) ? cur + 1 : 1;
            kv.set(k, String(next));
            return next;
        },
        incrBy: async (key, by) => {
            const k = String(key);
            isExpired(k);
            const cur = Number(kv.get(k) || 0);
            const inc = Number(by || 0);
            const next = (Number.isFinite(cur) ? cur : 0) + inc;
            kv.set(k, String(next));
            return next;
        },
        expire: async (key, seconds) => {
            const k = String(key);
            if (!kv.has(k))
                return false;
            const s = Math.max(1, Number(seconds || 1));
            expiries.set(k, Date.now() + s * 1000);
            return true;
        },
        ttl: async (key) => {
            const k = String(key);
            isExpired(k);
            const exp = expiries.get(k);
            if (!kv.has(k))
                return -2;
            if (!exp)
                return -1;
            return Math.max(0, Math.floor((exp - Date.now()) / 1000));
        },
        on: () => undefined,
        once: () => undefined,
        emit: () => undefined,
        quit: async () => true,
        isOpen: true,
        isReady: true,
        __kv: kv,
        __expiries: expiries,
    };
    return client;
}
const redisClient = process.env.NODE_ENV === "test"
    ? createInMemoryRedisClient()
    : !process.env.REDIS_URL && process.env.NODE_ENV !== "production"
        ? createInMemoryRedisClient()
        : (0, redis_1.createClient)({
            url: process.env.REDIS_URL || "",
        });
if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) {
    console.error("\n❌ CRITICAL: REDIS_URL environment variable is not set in production!");
    console.error("❌ Redis is required for token blacklisting and caching.");
    console.error("❌ Please provision a Redis instance on Railway and set REDIS_URL.\n");
    process.exit(1);
}
redisClient.on("connect", () => {
    console.log("⚡ Redis connected successfully");
});
redisClient.on("error", (err) => {
    console.error("❌ Redis connection error:", err);
    console.error("❌ Redis is required for token blacklisting and caching");
    console.error("❌ Please ensure Redis is running or check REDIS_URL configuration");
    process.exit(1);
});
// Auto-connect without top-level await
(async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    }
    catch (error) {
        console.error("❌ Redis auto-connect failed:", error);
        console.error("❌ Redis is required for proper operation");
        process.exit(1);
    }
})();
exports.default = redisClient;
