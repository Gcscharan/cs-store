"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testRedis = testRedis;
const logger_1 = require("./logger");
const redis_1 = __importDefault(require("../config/redis"));
async function testRedis() {
    logger_1.logger.info("🧪 Testing Redis Connection...");
    // Wait a bit for connection to establish
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (redis_1.default.isReady) {
        logger_1.logger.info("✅ Redis is ready!");
        // Test set/get
        const testKey = "test:key";
        const testValue = "Hello Redis!";
        await redis_1.default.set(testKey, testValue, { EX: 60 });
        const retrieved = await redis_1.default.get(testKey);
        if (retrieved === testValue) {
            logger_1.logger.info("✅ Redis SET/GET test passed!");
        }
        else {
            logger_1.logger.info("❌ Redis SET/GET test failed!");
        }
        // Test cache key generation
        const mockQuery = { page: 1, limit: 20, category: "test" };
        const cacheKey = `products:${JSON.stringify(mockQuery)}`;
        logger_1.logger.info("📋 Generated cache key:", cacheKey);
        // Clean up
        await redis_1.default.del(testKey);
        logger_1.logger.info("🧹 Test cleanup completed");
    }
    else {
        logger_1.logger.info("❌ Redis is not ready. Check if Redis server is running on localhost:6379");
    }
}
