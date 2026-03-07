/**
 * Fix delivery boy availability
 * Run: npm run fix:delivery-availability
 * 
 * Updates all active delivery boys to availability: "available"
 * so they appear in the assignment dropdown.
 */

import mongoose from "mongoose";
import "dotenv/config";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error(" MONGODB_URI environment variable is required");
  process.exit(1);
}

async function fixAvailability() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log(" Connected to MongoDB\n");

    const DeliveryBoy = mongoose.model("DeliveryBoy", new mongoose.Schema({}, { strict: false }));
    
    const result = await DeliveryBoy.updateMany(
      { isActive: true, availability: { $in: ["offline", "busy"] } },
      { $set: { availability: "available" } }
    );
    
    console.log(`Updated ${result.modifiedCount} delivery boys to availability: "available"`);
    console.log(`Matched ${result.matchedCount} documents`);
    
    await mongoose.connection.close();
    console.log("\n Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Failed to fix availability:", error);
    process.exit(1);
  }
}

fixAvailability();
