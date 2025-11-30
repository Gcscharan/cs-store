"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testRedis = testRedis;
const redis_1 = __importDefault(require("../config/redis"));
async function testRedis() {
    console.log("🧪 Testing Redis Connection...");
    // Wait a bit for connection to establish
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (redis_1.default.isReady) {
        console.log("✅ Redis is ready!");
        // Test set/get
        const testKey = "test:key";
        const testValue = "Hello Redis!";
        await redis_1.default.set(testKey, testValue, { EX: 60 });
        const retrieved = await redis_1.default.get(testKey);
        if (retrieved === testValue) {
            console.log("✅ Redis SET/GET test passed!");
        }
        else {
            console.log("❌ Redis SET/GET test failed!");
        }
        // Test cache key generation
        const mockQuery = { page: 1, limit: 20, category: "test" };
        const cacheKey = `products:${JSON.stringify(mockQuery)}`;
        console.log("📋 Generated cache key:", cacheKey);
        // Clean up
        await redis_1.default.del(testKey);
        console.log("🧹 Test cleanup completed");
    }
    else {
        console.log("❌ Redis is not ready. Check if Redis server is running on localhost:6379");
    }
}
