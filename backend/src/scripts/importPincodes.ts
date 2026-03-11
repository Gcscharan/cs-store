import { logger } from '../utils/logger';
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Pincode } from "../models/Pincode";
import pincodeData from "../../data/pincodes_ap_ts.json";

// Load environment variables
dotenv.config();

// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
  logger.error("❌ Please set MONGODB_URI in your .env file and restart.");
  process.exit(1);
}

async function importPincodes() {
  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(MONGODB_URI as string);
    logger.info("✅ Connected to MongoDB Atlas");

    // Clear existing pincodes
    await Pincode.deleteMany({});
    logger.info("🗑️ Cleared existing pincodes");

    // Insert new pincodes
    const pincodes = pincodeData.map((pincode: any) => ({
      pincode: pincode.pincode,
      state: pincode.state,
      district: pincode.district,
      taluka: pincode.taluka,
    }));

    await Pincode.insertMany(pincodes);
    logger.info(`✅ Imported ${pincodes.length} pincodes`);

    // Verify import
    const count = await Pincode.countDocuments();
    logger.info(`📊 Total pincodes in database: ${count}`);

    // Show sample data
    const samplePincodes = await Pincode.find().limit(5);
    logger.info("📋 Sample pincodes:");
    samplePincodes.forEach((pincode) => {
      logger.info(
        `  ${pincode.pincode} - ${pincode.state}, ${pincode.district}`
      );
    });
  } catch (error) {
    logger.error("❌ Error importing pincodes:", error);
  } finally {
    await mongoose.disconnect();
    logger.info("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the import
importPincodes();
