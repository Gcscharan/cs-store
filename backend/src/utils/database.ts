import { logger } from './logger';
import mongoose from "mongoose";

// Helper function to mask password in MongoDB URI for logging
const maskMongoURI = (uri: string): string => {
  if (!uri) return "undefined";
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
};

 const getDriverUrlSafe = (): string => {
   try {
     const anyConn = mongoose.connection as any;
     const url = anyConn?.client?.s?.url;
     return typeof url === "string" && url.trim() ? url : "unavailable";
   } catch {
     return "unavailable";
   }
 };

export const connectDB = async (): Promise<void> => {
  try {
    // CRITICAL: Only use MONGODB_URI from environment - no fallbacks
    const mongoURI = process.env.MONGODB_URI;

    // Crash with clear error if MONGODB_URI is missing
    if (!mongoURI) {
      logger.error("\n❌ CRITICAL: MONGODB_URI environment variable is not set!");
      logger.error("❌ The application requires MONGODB_URI to connect to MongoDB Atlas.");
      logger.error("❌ Please set MONGODB_URI in your .env file and restart the server.");
      logger.error("❌ Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database\n");
      process.exit(1);
    }

    // Log the exact MongoDB URI being used (with password masked)
    logger.info(`\n🔗 Connecting to MongoDB Atlas...`);
    logger.info(`📍 MongoDB URI: ${maskMongoURI(mongoURI)}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
    };

    await mongoose.connect(mongoURI, options);
    
    // Clear success logging
    logger.info("✅ MongoDB Atlas connected successfully");
    logger.info(`🗄️  Database: ${mongoose.connection.name}`);
    logger.info(`🏠 Host: ${mongoose.connection.host}`);
    logger.info("[DB][Runtime] Host:", mongoose.connection.host);
    logger.info("[DB][Runtime] Database Name:", mongoose.connection.name);
    logger.info("[DB][Runtime] Driver URL:", getDriverUrlSafe());
    logger.info("[DB][Runtime] process.env.MONGODB_URI:", process.env.MONGODB_URI ? "<set>" : "<unset>");
    logger.info("[DB][Runtime] Connection String (masked):", maskMongoURI(String(process.env.MONGODB_URI || "")));
    logger.info("");
  } catch (error) {
    logger.error("\n❌ MongoDB Atlas connection error:");
    logger.error("❌ Error details:", error);
    logger.error("❌ Please check your MONGODB_URI and network connection");
    logger.error("❌ Ensure MongoDB Atlas network access allows your IP address\n");
    process.exit(1);
  }
};

// Handle connection events with clear logging
mongoose.connection.on("connected", () => {
  logger.info("🔗 Mongoose connected to MongoDB Atlas");
});

mongoose.connection.on("error", (err) => {
  logger.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  logger.info("🔌 Mongoose disconnected from MongoDB Atlas");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("\n🛑 SIGINT received, closing MongoDB connection...");
  await mongoose.connection.close();
  logger.info("✅ MongoDB connection closed through app termination");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("\n🛑 SIGTERM received, closing MongoDB connection...");
  await mongoose.connection.close();
  logger.info("✅ MongoDB connection closed through app termination");
  process.exit(0);
});
