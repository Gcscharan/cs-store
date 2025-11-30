"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateCache = exports.cacheMiddleware = void 0;
const redis_1 = __importDefault(require("../config/redis"));
// Cache middleware for GET requests (Cache-Aside Pattern)
const cacheMiddleware = (options = {}) => {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== "GET") {
            return next();
        }
        // Skip caching if Redis is not available
        if (!redis_1.default.isReady) {
            console.warn("⚠️  Redis not ready, skipping cache for:", req.path);
            return next();
        }
        try {
            // Generate cache key
            let cacheKey;
            if (options.keyGenerator) {
                cacheKey = options.keyGenerator(req);
            }
            else {
                // Default key generation based on path and query
                const queryString = Object.keys(req.query)
                    .sort()
                    .map(key => `${key}:${req.query[key]}`)
                    .join(":");
                cacheKey = `${req.path}${queryString ? `:${queryString}` : ""}`;
            }
            // Try to get data from cache
            const cachedData = await redis_1.default.get(cacheKey);
            if (cachedData) {
                // Cache hit - return cached data
                console.log(`🎯 Cache HIT: ${req.method} ${req.path}`);
                return res.json(JSON.parse(cachedData));
            }
            // Cache miss - continue to controller and cache the response
            console.log(`💥 Cache MISS: ${req.method} ${req.path}`);
            // Override res.json to cache the response
            const originalJson = res.json.bind(res);
            res.json = function (data) {
                // Cache the response data
                const ttl = options.ttl || 3600; // Default 1 hour
                redis_1.default.set(cacheKey, JSON.stringify(data), { EX: ttl }).catch((error) => {
                    console.error("❌ Failed to cache response:", error);
                });
                // Return the response
                return originalJson(data);
            };
            // Continue to the next middleware/controller
            next();
        }
        catch (error) {
            console.error("❌ Cache middleware error:", error);
            // Continue without caching on error
            next();
        }
    };
};
exports.cacheMiddleware = cacheMiddleware;
// Cache invalidation helper
exports.invalidateCache = {
    // Helper function to delete keys by pattern
    deleteByPattern: async (pattern) => {
        try {
            const keys = [];
            for await (const key of redis_1.default.scanIterator({
                MATCH: pattern,
            })) {
                keys.push(key);
            }
            if (keys.length > 0) {
                await redis_1.default.del(keys);
            }
        }
        catch (error) {
            console.error(`❌ Failed to delete pattern ${pattern}:`, error);
        }
    },
    // Invalidate all product-related cache
    products: async () => {
        try {
            await exports.invalidateCache.deleteByPattern("products:*");
            await exports.invalidateCache.deleteByPattern("product:*");
            await exports.invalidateCache.deleteByPattern("search:*");
            await exports.invalidateCache.deleteByPattern("similar:*");
            console.log("🗑️  Invalidated all product caches");
        }
        catch (error) {
            console.error("❌ Failed to invalidate product caches:", error);
        }
    },
    // Invalidate specific product cache
    product: async (id) => {
        try {
            await redis_1.default.del(`product:${id}`);
            await exports.invalidateCache.deleteByPattern(`similar:${id}:*`);
            await exports.invalidateCache.deleteByPattern("products:*"); // Invalidate product lists
            console.log(`🗑️  Invalidated cache for product: ${id}`);
        }
        catch (error) {
            console.error(`❌ Failed to invalidate cache for product ${id}:`, error);
        }
    },
    // Invalidate search cache
    search: async () => {
        try {
            await exports.invalidateCache.deleteByPattern("search:*");
            console.log("🗑️  Invalidated all search caches");
        }
        catch (error) {
            console.error("❌ Failed to invalidate search caches:", error);
        }
    },
};
exports.default = exports.cacheMiddleware;
