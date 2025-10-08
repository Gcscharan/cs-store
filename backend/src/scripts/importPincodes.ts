import mongoose from "mongoose";
import dotenv from "dotenv";
import { Pincode } from "../models/Pincode";
import pincodeData from "../../data/pincodes_ap_ts.json";

// Load environment variables
dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";

async function importPincodes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing pincodes
    await Pincode.deleteMany({});
    console.log("🗑️ Cleared existing pincodes");

    // Insert new pincodes
    const pincodes = pincodeData.map((pincode: any) => ({
      pincode: pincode.pincode,
      state: pincode.state,
      district: pincode.district,
      taluka: pincode.taluka,
    }));

    await Pincode.insertMany(pincodes);
    console.log(`✅ Imported ${pincodes.length} pincodes`);

    // Verify import
    const count = await Pincode.countDocuments();
    console.log(`📊 Total pincodes in database: ${count}`);

    // Show sample data
    const samplePincodes = await Pincode.find().limit(5);
    console.log("📋 Sample pincodes:");
    samplePincodes.forEach((pincode) => {
      console.log(
        `  ${pincode.pincode} - ${pincode.state}, ${pincode.district}`
      );
    });
  } catch (error) {
    console.error("❌ Error importing pincodes:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the import
importPincodes();
