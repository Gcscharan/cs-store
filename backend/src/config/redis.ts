import { createClient, RedisClientType } from "redis";
import dotenv from "dotenv";

dotenv.config();

class RedisClient {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            console.log(`🔄 Redis reconnection attempt ${retries}`);
            return Math.min(retries * 100, 3000);
          },
        },
      });

      // Error handling
      this.client.on("error", (error) => {
        console.error("❌ Redis Client Error:", error);
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        console.log("🔌 Redis Client: Connecting...");
      });

      this.client.on("ready", () => {
        console.log("✅ Redis Client: Connected and ready");
        this.isConnected = true;
      });

      this.client.on("end", () => {
        console.log("🔌 Redis Client: Connection closed");
        this.isConnected = false;
      });

      // Connect to Redis
      // await this.client.connect(); // Temporarily disabled for demo
    } catch (error) {
      console.error("❌ Failed to initialize Redis client:", error);
      console.warn("⚠️  Continuing without Redis caching...");
      this.isConnected = false;
    }
  }

  // Get data from cache
  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) {
      console.warn("⚠️  Redis not available, cache miss for key:", key);
      return null;
    }

    try {
      const data = await this.client.get(key);
      if (data) {
        console.log("🎯 Redis Cache HIT:", key);
      } else {
        console.log("💥 Redis Cache MISS:", key);
      }
      return data;
    } catch (error) {
      console.error("❌ Redis GET error:", error);
      return null;
    }
  }

  // Set data in cache with TTL
  async set(key: string, value: string, ttlSeconds: number = 3600): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      console.warn("⚠️  Redis not available, skipping cache set for key:", key);
      return false;
    }

    try {
      await this.client.setEx(key, ttlSeconds, value);
      console.log(`💾 Redis Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.error("❌ Redis SET error:", error);
      return false;
    }
  }

  // Delete data from cache
  async del(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      console.warn("⚠️  Redis not available, skipping cache delete for key:", key);
      return false;
    }

    try {
      const result = await this.client.del(key);
      console.log(`🗑️  Redis Cache DELETE: ${key} (Deleted: ${result > 0})`);
      return result > 0;
    } catch (error) {
      console.error("❌ Redis DELETE error:", error);
      return false;
    }
  }

  // Delete multiple keys by pattern
  async delPattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      console.warn("⚠️  Redis not available, skipping pattern delete:", pattern);
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        console.log(`🗑️  Redis Pattern DELETE: ${pattern} (No keys found)`);
        return 0;
      }

      const result = await this.client.del(keys);
      console.log(`🗑️  Redis Pattern DELETE: ${pattern} (${result} keys deleted)`);
      return result;
    } catch (error) {
      console.error("❌ Redis pattern delete error:", error);
      return 0;
    }
  }

  // Check if Redis is connected
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Generate cache key for products list
  generateProductsListKey(query: any): string {
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    // Create a consistent key from query parameters
    const keyParts = [
      "products",
      `page:${page}`,
      `limit:${limit}`,
      category ? `cat:${category}` : null,
      minPrice ? `minP:${minPrice}` : null,
      maxPrice ? `maxP:${maxPrice}` : null,
      search ? `search:${search}` : null,
      `sort:${sortBy}:${sortOrder}`,
    ].filter(Boolean);

    return keyParts.join(":");
  }

  // Generate cache key for individual product
  generateProductKey(id: string): string {
    return `product:${id}`;
  }

  // Generate cache key for search suggestions
  generateSearchKey(query: string): string {
    return `search:${query.toLowerCase().trim()}`;
  }

  // Generate cache key for similar products
  generateSimilarProductsKey(id: string, limit: number): string {
    return `similar:${id}:${limit}`;
  }

  // Get raw Redis client for advanced operations (ZSET commands)
  getClient(): RedisClientType | null {
    return this.client;
  }

  // ZSET operations for delivery partner load management
  async zAdd(key: string, member: { score: number; value: string }): Promise<number | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const result = await this.client.zAdd(key, member);
      return result;
    } catch (error) {
      console.error("❌ Redis ZADD error:", error);
      return null;
    }
  }

  async zIncrBy(key: string, increment: number, member: string): Promise<number | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const result = await this.client.zIncrBy(key, increment, member);
      return result;
    } catch (error) {
      console.error("❌ Redis ZINCRBY error:", error);
      return null;
    }
  }

  async zScore(key: string, member: string): Promise<number | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const result = await this.client.zScore(key, member);
      return result;
    } catch (error) {
      console.error("❌ Redis ZSCORE error:", error);
      return null;
    }
  }

  async zRange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.isConnected || !this.client) {
      return [];
    }

    try {
      const result = await this.client.zRange(key, start, stop);
      return result;
    } catch (error) {
      console.error("❌ Redis ZRANGE error:", error);
      return [];
    }
  }

  async zRangeWithScores(key: string, start: number, stop: number): Promise<Array<{value: string, score: number}>> {
    if (!this.isConnected || !this.client) {
      return [];
    }

    try {
      const result = await this.client.zRangeWithScores(key, start, stop);
      return result.map(item => ({
        value: item.value,
        score: item.score
      }));
    } catch (error) {
      console.error("❌ Redis ZRANGE_WITHSCORES error:", error);
      return [];
    }
  }

  async zRem(key: string, member: string): Promise<number | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const result = await this.client.zRem(key, member);
      return result;
    } catch (error) {
      console.error("❌ Redis ZREM error:", error);
      return null;
    }
  }

  async zCard(key: string): Promise<number | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const result = await this.client.zCard(key);
      return result;
    } catch (error) {
      console.error("❌ Redis ZCARD error:", error);
      return null;
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        console.log("👋 Redis Client: Disconnected gracefully");
      } catch (error) {
        console.error("❌ Error disconnecting Redis:", error);
      }
    }
  }
}

// Create and export singleton instance
const redisClient = new RedisClient();

// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, closing Redis connection...");
  await redisClient.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, closing Redis connection...");
  await redisClient.disconnect();
  process.exit(0);
});

export default redisClient;
