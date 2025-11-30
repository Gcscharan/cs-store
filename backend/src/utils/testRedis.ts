import redisClient from "../config/redis";

async function testRedis() {
  console.log("🧪 Testing Redis Connection...");
  
  // Wait a bit for connection to establish
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (redisClient.isReady) {
    console.log("✅ Redis is ready!");
    
    // Test set/get
    const testKey = "test:key";
    const testValue = "Hello Redis!";
    
    await redisClient.set(testKey, testValue, { EX: 60 });
    const retrieved = await redisClient.get(testKey);
    
    if (retrieved === testValue) {
      console.log("✅ Redis SET/GET test passed!");
    } else {
      console.log("❌ Redis SET/GET test failed!");
    }
    
    // Test cache key generation
    const mockQuery = { page: 1, limit: 20, category: "test" };
    const cacheKey = `products:${JSON.stringify(mockQuery)}`;
    console.log("📋 Generated cache key:", cacheKey);
    
    // Clean up
    await redisClient.del(testKey);
    console.log("🧹 Test cleanup completed");
  } else {
    console.log("❌ Redis is not ready. Check if Redis server is running on localhost:6379");
  }
}

// Export for manual testing
export { testRedis };
