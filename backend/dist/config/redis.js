"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("redis");
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || "redis://localhost:6379",
});
redisClient.on("connect", () => {
    console.log("⚡ Redis connected successfully");
});
redisClient.on("error", (err) => {
    console.error("❌ Redis connection error:", err);
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
    }
})();
exports.default = redisClient;
