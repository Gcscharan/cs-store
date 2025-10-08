"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Pincode_1 = require("../models/Pincode");
const pincodes_ap_ts_json_1 = __importDefault(require("../../data/pincodes_ap_ts.json"));
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";
async function importPincodes() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB");
        await Pincode_1.Pincode.deleteMany({});
        console.log("🗑️ Cleared existing pincodes");
        const pincodes = pincodes_ap_ts_json_1.default.map((pincode) => ({
            pincode: pincode.pincode,
            state: pincode.state,
            district: pincode.district,
            taluka: pincode.taluka,
        }));
        await Pincode_1.Pincode.insertMany(pincodes);
        console.log(`✅ Imported ${pincodes.length} pincodes`);
        const count = await Pincode_1.Pincode.countDocuments();
        console.log(`📊 Total pincodes in database: ${count}`);
        const samplePincodes = await Pincode_1.Pincode.find().limit(5);
        console.log("📋 Sample pincodes:");
        samplePincodes.forEach((pincode) => {
            console.log(`  ${pincode.pincode} - ${pincode.state}, ${pincode.district}`);
        });
    }
    catch (error) {
        console.error("❌ Error importing pincodes:", error);
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log("🔌 Disconnected from MongoDB");
        process.exit(0);
    }
}
importPincodes();
//# sourceMappingURL=importPincodes.js.map