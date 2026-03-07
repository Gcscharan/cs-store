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
      console.error("\n❌ CRITICAL: MONGODB_URI environment variable is not set!");
      console.error("❌ The application requires MONGODB_URI to connect to MongoDB Atlas.");
      console.error("❌ Please set MONGODB_URI in your .env file and restart the server.");
      console.error("❌ Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database\n");
      process.exit(1);
    }

    // Log the exact MongoDB URI being used (with password masked)
    console.log(`\n🔗 Connecting to MongoDB Atlas...`);
    console.log(`📍 MongoDB URI: ${maskMongoURI(mongoURI)}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
    };

    await mongoose.connect(mongoURI, options);
    
    // Clear success logging
    console.log("✅ MongoDB Atlas connected successfully");
    console.log(`🗄️  Database: ${mongoose.connection.name}`);
    console.log(`🏠 Host: ${mongoose.connection.host}`);
    console.log("[DB][Runtime] Host:", mongoose.connection.host);
    console.log("[DB][Runtime] Database Name:", mongoose.connection.name);
    console.log("[DB][Runtime] Driver URL:", getDriverUrlSafe());
    console.log("[DB][Runtime] process.env.MONGODB_URI:", process.env.MONGODB_URI ? "<set>" : "<unset>");
    console.log("[DB][Runtime] Connection String (masked):", maskMongoURI(String(process.env.MONGODB_URI || "")));
    console.log("");
  } catch (error) {
    console.error("\n❌ MongoDB Atlas connection error:");
    console.error("❌ Error details:", error);
    console.error("❌ Please check your MONGODB_URI and network connection");
    console.error("❌ Ensure MongoDB Atlas network access allows your IP address\n");
    process.exit(1);
  }
};

// Handle connection events with clear logging
mongoose.connection.on("connected", () => {
  console.log("🔗 Mongoose connected to MongoDB Atlas");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("🔌 Mongoose disconnected from MongoDB Atlas");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 SIGINT received, closing MongoDB connection...");
  await mongoose.connection.close();
  console.log("✅ MongoDB connection closed through app termination");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 SIGTERM received, closing MongoDB connection...");
  await mongoose.connection.close();
  console.log("✅ MongoDB connection closed through app termination");
  process.exit(0);
});
