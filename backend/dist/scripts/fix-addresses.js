"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
    console.error("❌ Please set MONGODB_URI in your .env file and restart.");
    process.exit(1);
}
async function fixAddresses() {
    try {
        // Connect to MongoDB Atlas
        await mongoose_1.default.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB Atlas");
        // Find all users with addresses
        const users = await User_1.User.find({ "addresses.0": { $exists: true } });
        console.log(`📊 Found ${users.length} users with addresses`);
        let updatedCount = 0;
        let addressesFixed = 0;
        for (const user of users) {
            let userUpdated = false;
            for (const address of user.addresses) {
                // Add name if missing
                if (!address.name) {
                    address.name = user.name || "";
                    userUpdated = true;
                    addressesFixed++;
                }
                // Add phone if missing
                if (!address.phone) {
                    address.phone = user.phone || "";
                    userUpdated = true;
                }
            }
            if (userUpdated) {
                await user.save();
                updatedCount++;
                console.log(`✅ Updated user: ${user.email} (${user.addresses.length} addresses)`);
            }
        }
        console.log(`\n🎉 Migration complete!`);
        console.log(`📊 Updated ${updatedCount} users`);
        console.log(`📊 Fixed ${addressesFixed} addresses`);
        process.exit(0);
    }
    catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}
fixAddresses();
