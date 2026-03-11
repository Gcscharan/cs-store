import { logger } from './logger';
import redisClient from "../config/redis";

async function testRedis() {
  logger.info("🧪 Testing Redis Connection...");
  
  // Wait a bit for connection to establish
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (redisClient.isReady) {
    logger.info("✅ Redis is ready!");
    
    // Test set/get
    const testKey = "test:key";
    const testValue = "Hello Redis!";
    
    await redisClient.set(testKey, testValue, { EX: 60 });
    const retrieved = await redisClient.get(testKey);
    
    if (retrieved === testValue) {
      logger.info("✅ Redis SET/GET test passed!");
    } else {
      logger.info("❌ Redis SET/GET test failed!");
    }
    
    // Test cache key generation
    const mockQuery = { page: 1, limit: 20, category: "test" };
    const cacheKey = `products:${JSON.stringify(mockQuery)}`;
    logger.info("📋 Generated cache key:", cacheKey);
    
    // Clean up
    await redisClient.del(testKey);
    logger.info("🧹 Test cleanup completed");
  } else {
    logger.info("❌ Redis is not ready. Check if Redis server is running on localhost:6379");
  }
}

// Export for manual testing
export { testRedis };
