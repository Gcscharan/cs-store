"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const logger_1 = require("./logger");
const mongoose_1 = __importDefault(require("mongoose"));
// Helper function to mask password in MongoDB URI for logging
const maskMongoURI = (uri) => {
    if (!uri)
        return "undefined";
    return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
};
const getDriverUrlSafe = () => {
    try {
        const anyConn = mongoose_1.default.connection;
        const url = anyConn?.client?.s?.url;
        return typeof url === "string" && url.trim() ? url : "unavailable";
    }
    catch {
        return "unavailable";
    }
};
const connectDB = async () => {
    try {
        // CRITICAL: Only use MONGODB_URI from environment - no fallbacks
        const mongoURI = process.env.MONGODB_URI;
        // Crash with clear error if MONGODB_URI is missing
        if (!mongoURI) {
            logger_1.logger.error("\n❌ CRITICAL: MONGODB_URI environment variable is not set!");
            logger_1.logger.error("❌ The application requires MONGODB_URI to connect to MongoDB Atlas.");
            logger_1.logger.error("❌ Please set MONGODB_URI in your .env file and restart the server.");
            logger_1.logger.error("❌ Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database\n");
            process.exit(1);
        }
        // Log the exact MongoDB URI being used (with password masked)
        logger_1.logger.info(`\n🔗 Connecting to MongoDB Atlas...`);
        logger_1.logger.info(`📍 MongoDB URI: ${maskMongoURI(mongoURI)}`);
        logger_1.logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
        const options = {
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            bufferCommands: false, // Disable mongoose buffering
        };
        await mongoose_1.default.connect(mongoURI, options);
        // Clear success logging
        logger_1.logger.info("✅ MongoDB Atlas connected successfully");
        logger_1.logger.info(`🗄️  Database: ${mongoose_1.default.connection.name}`);
        logger_1.logger.info(`🏠 Host: ${mongoose_1.default.connection.host}`);
        logger_1.logger.info("[DB][Runtime] Host:", mongoose_1.default.connection.host);
        logger_1.logger.info("[DB][Runtime] Database Name:", mongoose_1.default.connection.name);
        logger_1.logger.info("[DB][Runtime] Driver URL:", getDriverUrlSafe());
        logger_1.logger.info("[DB][Runtime] process.env.MONGODB_URI:", process.env.MONGODB_URI ? "<set>" : "<unset>");
        logger_1.logger.info("[DB][Runtime] Connection String (masked):", maskMongoURI(String(process.env.MONGODB_URI || "")));
        logger_1.logger.info("");
    }
    catch (error) {
        logger_1.logger.error("\n❌ MongoDB Atlas connection error:");
        logger_1.logger.error("❌ Error details:", error);
        logger_1.logger.error("❌ Please check your MONGODB_URI and network connection");
        logger_1.logger.error("❌ Ensure MongoDB Atlas network access allows your IP address\n");
        process.exit(1);
    }
};
exports.connectDB = connectDB;
// Handle connection events with clear logging
mongoose_1.default.connection.on("connected", () => {
    logger_1.logger.info("🔗 Mongoose connected to MongoDB Atlas");
});
mongoose_1.default.connection.on("error", (err) => {
    logger_1.logger.error("❌ Mongoose connection error:", err);
});
mongoose_1.default.connection.on("disconnected", () => {
    logger_1.logger.info("🔌 Mongoose disconnected from MongoDB Atlas");
});
// Graceful shutdown
process.on("SIGINT", async () => {
    logger_1.logger.info("\n🛑 SIGINT received, closing MongoDB connection...");
    await mongoose_1.default.connection.close();
    logger_1.logger.info("✅ MongoDB connection closed through app termination");
    process.exit(0);
});
process.on("SIGTERM", async () => {
    logger_1.logger.info("\n🛑 SIGTERM received, closing MongoDB connection...");
    await mongoose_1.default.connection.close();
    logger_1.logger.info("✅ MongoDB connection closed through app termination");
    process.exit(0);
});
