import { Request, Response, NextFunction } from "express";
import redisClient from "../config/redis";

export interface CacheOptions {
  ttl?: number; // TTL in seconds
  keyGenerator?: (req: Request) => string;
}

// Cache middleware for GET requests (Cache-Aside Pattern)
export const cacheMiddleware = (options: CacheOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Skip caching if Redis is not available
    if (!redisClient.isReady) {
      console.warn("⚠️  Redis not ready, skipping cache for:", req.path);
      return next();
    }

    try {
      // Generate cache key
      let cacheKey: string;
      if (options.keyGenerator) {
        cacheKey = options.keyGenerator(req);
      } else {
        // Default key generation based on path and query
        const queryString = Object.keys(req.query)
          .sort()
          .map(key => `${key}:${req.query[key]}`)
          .join(":");
        cacheKey = `${req.path}${queryString ? `:${queryString}` : ""}`;
      }

      // Try to get data from cache
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        // Cache hit - return cached data
        console.log(`🎯 Cache HIT: ${req.method} ${req.path}`);
        return res.json(JSON.parse(cachedData));
      }

      // Cache miss - continue to controller and cache the response
      console.log(`💥 Cache MISS: ${req.method} ${req.path}`);
      
      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        // Cache the response data
        const ttl = options.ttl || 3600; // Default 1 hour
        redisClient.set(cacheKey, JSON.stringify(data), { EX: ttl }).catch((error: any) => {
          console.error("❌ Failed to cache response:", error);
        });
        
        // Return the response
        return originalJson(data);
      };

      // Continue to the next middleware/controller
      next();
    } catch (error) {
      console.error("❌ Cache middleware error:", error);
      // Continue without caching on error
      next();
    }
  };
};

// Cache invalidation helper
export const invalidateCache = {
  // Helper function to delete keys by pattern
  deleteByPattern: async (pattern: string): Promise<void> => {
    try {
      const keys = [];
      for await (const key of redisClient.scanIterator({
        MATCH: pattern,
      })) {
        keys.push(key);
      }
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error(`❌ Failed to delete pattern ${pattern}:`, error);
    }
  },

  // Invalidate all product-related cache
  products: async (): Promise<void> => {
    try {
      await invalidateCache.deleteByPattern("products:*");
      await invalidateCache.deleteByPattern("product:*");
      await invalidateCache.deleteByPattern("search:*");
      await invalidateCache.deleteByPattern("similar:*");
      console.log("🗑️  Invalidated all product caches");
    } catch (error) {
      console.error("❌ Failed to invalidate product caches:", error);
    }
  },

  // Invalidate specific product cache
  product: async (id: string): Promise<void> => {
    try {
      await redisClient.del(`product:${id}`);
      await invalidateCache.deleteByPattern(`similar:${id}:*`);
      await invalidateCache.deleteByPattern("products:*"); // Invalidate product lists
      console.log(`🗑️  Invalidated cache for product: ${id}`);
    } catch (error) {
      console.error(`❌ Failed to invalidate cache for product ${id}:`, error);
    }
  },

  // Invalidate search cache
  search: async (): Promise<void> => {
    try {
      await invalidateCache.deleteByPattern("search:*");
      console.log("🗑️  Invalidated all search caches");
    } catch (error) {
      console.error("❌ Failed to invalidate search caches:", error);
    }
  },
};

export default cacheMiddleware;
