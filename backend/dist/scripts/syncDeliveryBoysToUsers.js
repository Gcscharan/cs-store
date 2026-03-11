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
const logger_1 = require("../utils/logger");
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const bcrypt = __importStar(require("bcryptjs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    logger_1.logger.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
    logger_1.logger.error("❌ Please set MONGODB_URI in your .env file and restart.");
    process.exit(1);
}
/**
 * Sync DeliveryBoy documents with User documents
 * This script ensures every DeliveryBoy has a corresponding User account
 */
async function syncDeliveryBoysToUsers() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        logger_1.logger.info("✅ Connected to MongoDB Atlas");
        // Get all delivery boys
        const deliveryBoys = await DeliveryBoy_1.DeliveryBoy.find({});
        logger_1.logger.info(`\n📊 Found ${deliveryBoys.length} delivery boy records`);
        let created = 0;
        let linked = 0;
        let alreadySynced = 0;
        for (const deliveryBoy of deliveryBoys) {
            logger_1.logger.info(`\n🔍 Processing: ${deliveryBoy.name} (${deliveryBoy.phone})`);
            // Check if this delivery boy already has a userId link
            if (deliveryBoy.userId) {
                const linkedUser = await User_1.User.findById(deliveryBoy.userId);
                if (linkedUser && linkedUser.role === "delivery") {
                    logger_1.logger.info(`  ✓ Already synced with User: ${linkedUser.email}`);
                    alreadySynced++;
                    continue;
                }
                else {
                    logger_1.logger.info(`  ⚠️ Invalid userId link, will fix...`);
                    deliveryBoy.userId = undefined;
                }
            }
            // Try to find existing user by email or phone
            let user = await User_1.User.findOne({
                $or: [
                    { email: deliveryBoy.email },
                    { phone: deliveryBoy.phone }
                ],
            });
            if (user) {
                // User exists - check if they have delivery role
                if (user.role !== "delivery") {
                    logger_1.logger.info(`  ⚠️ User exists but role is "${user.role}", updating to "delivery"...`);
                    user.role = "delivery";
                    user.status = deliveryBoy.isActive ? "active" : "pending";
                    // Add delivery profile if missing
                    if (!user.deliveryProfile) {
                        user.deliveryProfile = {
                            phone: deliveryBoy.phone,
                            vehicleType: deliveryBoy.vehicleType,
                            assignedAreas: [],
                            documents: [],
                        };
                    }
                    await user.save();
                }
                // Link delivery boy to user
                deliveryBoy.userId = user._id;
                await deliveryBoy.save();
                logger_1.logger.info(`  ✓ Linked to existing User: ${user.email}`);
                linked++;
            }
            else {
                // Create new user for this delivery boy
                const defaultEmail = deliveryBoy.email || `${deliveryBoy.phone}@delivery.csstore.com`;
                const defaultPassword = `delivery${deliveryBoy.phone.slice(-4)}`;
                const passwordHash = await bcrypt.hash(defaultPassword, 10);
                user = new User_1.User({
                    name: deliveryBoy.name,
                    email: defaultEmail,
                    phone: deliveryBoy.phone,
                    passwordHash,
                    role: "delivery",
                    status: deliveryBoy.isActive ? "active" : "pending",
                    deliveryProfile: {
                        phone: deliveryBoy.phone,
                        vehicleType: deliveryBoy.vehicleType,
                        assignedAreas: [],
                        documents: [],
                    },
                });
                await user.save();
                // Link delivery boy to new user
                deliveryBoy.userId = user._id;
                await deliveryBoy.save();
                logger_1.logger.info(`  ✓ Created new User: ${user.email}`);
                logger_1.logger.info(`  🔑 Default password: ${defaultPassword}`);
                created++;
            }
        }
        logger_1.logger.info("\n" + "=".repeat(60));
        logger_1.logger.info("📊 SYNC SUMMARY:");
        logger_1.logger.info("=".repeat(60));
        logger_1.logger.info(`Total Delivery Boys: ${deliveryBoys.length}`);
        logger_1.logger.info(`Already Synced: ${alreadySynced}`);
        logger_1.logger.info(`Linked to Existing Users: ${linked}`);
        logger_1.logger.info(`New Users Created: ${created}`);
        logger_1.logger.info("=".repeat(60));
        if (created > 0) {
            logger_1.logger.info("\n⚠️ DEFAULT PASSWORDS (Share with delivery partners):");
            logger_1.logger.info("=".repeat(60));
            const newUsers = await User_1.User.find({ role: "delivery" }).select("email phone name");
            for (const u of newUsers) {
                const phone = u.phone || "";
                if (phone) {
                    logger_1.logger.info(`📧 ${u.email} - Password: delivery${phone.slice(-4)}`);
                }
            }
        }
        logger_1.logger.info("\n✅ Sync completed successfully!");
    }
    catch (error) {
        logger_1.logger.error("❌ Sync failed:", error);
    }
    finally {
        await mongoose_1.default.connection.close();
        logger_1.logger.info("\n🔌 Disconnected from MongoDB");
    }
}
// Run the sync
syncDeliveryBoysToUsers();
