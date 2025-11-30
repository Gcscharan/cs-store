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
/**
 * MIGRATION 01: Enhance Users Collection
 * Adds enterprise fields without breaking existing data
 */
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../../models/User");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function enhanceUsers() {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB\n");
        console.log("🔧 Enhancing Users Collection...");
        const result = await User_1.User.updateMany({}, {
            $set: {
                // Analytics
                lastLoginAt: null,
                totalOrders: 0,
                completedOrders: 0,
                cancelledOrders: 0,
                totalSpent: 0,
                averageOrderValue: 0,
                // Loyalty
                loyaltyPoints: 0,
                loyaltyTier: "bronze",
                referralCode: null,
                referredBy: null,
                // Verification
                isEmailVerified: false,
                isPhoneVerified: false,
                // Soft Delete
                isDeleted: false,
                deletedAt: null,
                // Security
                failedLoginAttempts: 0,
                lastFailedLoginAt: null,
                accountLockedUntil: null,
                // Preferences
                marketingConsent: false,
                notificationPreferences: {
                    email: true,
                    sms: true,
                    push: true,
                    orderUpdates: true,
                    promotions: false
                }
            }
        }, { strict: false } // Allow fields not in schema
        );
        console.log(`✅ Updated ${result.modifiedCount} users`);
        // Create indexes
        console.log("\n🔧 Creating indexes...");
        await User_1.User.collection.createIndex({ lastLoginAt: -1 });
        await User_1.User.collection.createIndex({ totalOrders: -1, totalSpent: -1 });
        await User_1.User.collection.createIndex({ loyaltyPoints: -1 });
        console.log("✅ Indexes created");
    }
    catch (error) {
        console.error("❌ Error:", error);
    }
    finally {
        await mongoose_1.default.connection.close();
    }
}
enhanceUsers();
