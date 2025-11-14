import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { Pincode } from "../src/models/Pincode";

/**
 * Import Pincodes Script
 * Imports pincode data from data/pincodes_ap_ts.json into MongoDB
 */

interface PincodeData {
  pincode: string;
  city: string;
  state: string;
  district: string;
  area: string;
}

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

const importPincodes = async () => {
  try {
    console.log("🚀 Starting pincode import...");

    // Read pincode data from JSON file
    const dataPath = path.join(__dirname, "../../data/pincodes_ap_ts.json");
    const pincodeData: PincodeData[] = JSON.parse(
      fs.readFileSync(dataPath, "utf8")
    );

    console.log(`📊 Found ${pincodeData.length} pincodes to import`);

    // Clear existing pincodes
    await Pincode.deleteMany({});
    console.log("🗑️  Cleared existing pincodes");

    // Insert new pincodes
    const pincodes = pincodeData.map((pincode) => ({
      pincode: pincode.pincode,
      city: pincode.city,
      state: pincode.state,
      district: pincode.district,
      area: pincode.area,
      isServiceable: true, // All imported pincodes are serviceable
      deliveryTime: "1-2 days", // Default delivery time
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await Pincode.insertMany(pincodes);
    console.log(`✅ Successfully imported ${pincodes.length} pincodes`);

    // Create indexes for better performance
    await Pincode.createIndexes();
    console.log("📈 Created database indexes");

    // Display summary
    const stateCounts = pincodes.reduce((acc, pincode) => {
      acc[pincode.state] = (acc[pincode.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("\n📋 Import Summary:");
    Object.entries(stateCounts).forEach(([state, count]) => {
      console.log(`  ${state}: ${count} pincodes`);
    });

    console.log("\n🎉 Pincode import completed successfully!");
  } catch (error) {
    console.error("❌ Error importing pincodes:", error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await importPincodes();
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
    process.exit(0);
  }
};

// Run the script
if (require.main === module) {
  main();
}

export { importPincodes };
