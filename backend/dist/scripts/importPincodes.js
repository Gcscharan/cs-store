"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Pincode_1 = require("../models/Pincode");
const pincodes_ap_ts_json_1 = __importDefault(require("../../data/pincodes_ap_ts.json"));
// Load environment variables
dotenv_1.default.config();
// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    logger_1.logger.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
    logger_1.logger.error("❌ Please set MONGODB_URI in your .env file and restart.");
    process.exit(1);
}
async function importPincodes() {
    try {
        // Connect to MongoDB Atlas
        await mongoose_1.default.connect(MONGODB_URI);
        logger_1.logger.info("✅ Connected to MongoDB Atlas");
        // Clear existing pincodes
        await Pincode_1.Pincode.deleteMany({});
        logger_1.logger.info("🗑️ Cleared existing pincodes");
        // Insert new pincodes
        const pincodes = pincodes_ap_ts_json_1.default.map((pincode) => ({
            pincode: pincode.pincode,
            state: pincode.state,
            district: pincode.district,
            taluka: pincode.taluka,
        }));
        await Pincode_1.Pincode.insertMany(pincodes);
        logger_1.logger.info(`✅ Imported ${pincodes.length} pincodes`);
        // Verify import
        const count = await Pincode_1.Pincode.countDocuments();
        logger_1.logger.info(`📊 Total pincodes in database: ${count}`);
        // Show sample data
        const samplePincodes = await Pincode_1.Pincode.find().limit(5);
        logger_1.logger.info("📋 Sample pincodes:");
        samplePincodes.forEach((pincode) => {
            logger_1.logger.info(`  ${pincode.pincode} - ${pincode.state}, ${pincode.district}`);
        });
    }
    catch (error) {
        logger_1.logger.error("❌ Error importing pincodes:", error);
    }
    finally {
        await mongoose_1.default.disconnect();
        logger_1.logger.info("🔌 Disconnected from MongoDB");
        process.exit(0);
    }
}
// Run the import
importPincodes();
