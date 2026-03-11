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
async function createTestDeliveryAccount() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        logger_1.logger.info("✅ Connected to MongoDB Atlas\n");
        // Check if test delivery user already exists
        const existingUser = await User_1.User.findOne({ email: "delivery@test.com" });
        if (existingUser) {
            logger_1.logger.info("⚠️ Test delivery account already exists!");
            logger_1.logger.info(`📧 Email: delivery@test.com`);
            logger_1.logger.info(`🔑 Password: delivery123`);
            // Check if linked DeliveryBoy exists
            const existingDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: existingUser._id });
            if (!existingDeliveryBoy) {
                logger_1.logger.info("\n🔧 Creating missing DeliveryBoy document...");
                const deliveryBoy = new DeliveryBoy_1.DeliveryBoy({
                    name: existingUser.name,
                    phone: existingUser.phone,
                    email: existingUser.email,
                    userId: existingUser._id,
                    vehicleType: existingUser.deliveryProfile?.vehicleType || "bike",
                    isActive: existingUser.status === "active",
                    availability: "offline",
                    currentLocation: {
                        lat: 17.385044,
                        lng: 78.486671,
                        lastUpdatedAt: new Date(),
                    },
                    earnings: 0,
                    completedOrdersCount: 0,
                    assignedOrders: [],
                    currentLoad: 0,
                });
                await deliveryBoy.save();
                logger_1.logger.info("✅ DeliveryBoy document created and linked!");
            }
            else {
                logger_1.logger.info("✅ DeliveryBoy document already exists and linked!");
            }
            return;
        }
        logger_1.logger.info("🔧 Creating test delivery account...\n");
        // Create User with delivery role
        const passwordHash = await bcrypt.hash("delivery123", 10);
        const user = new User_1.User({
            name: "Test Delivery Boy",
            email: "delivery@test.com",
            phone: "9876543210",
            passwordHash,
            role: "delivery",
            status: "active", // Active by default for testing
            deliveryProfile: {
                phone: "9876543210",
                vehicleType: "bike",
                assignedAreas: ["500001", "500002", "500003"],
                documents: [],
            },
        });
        await user.save();
        logger_1.logger.info("✅ User created:");
        logger_1.logger.info(`   Name: ${user.name}`);
        logger_1.logger.info(`   Email: ${user.email}`);
        logger_1.logger.info(`   Phone: ${user.phone}`);
        logger_1.logger.info(`   Role: ${user.role}`);
        logger_1.logger.info(`   Status: ${user.status}`);
        // Create DeliveryBoy document
        const deliveryBoy = new DeliveryBoy_1.DeliveryBoy({
            name: user.name,
            phone: user.phone,
            email: user.email,
            userId: user._id,
            vehicleType: "bike",
            isActive: true,
            availability: "offline",
            currentLocation: {
                lat: 17.385044, // Default: Hyderabad
                lng: 78.486671,
                lastUpdatedAt: new Date(),
            },
            earnings: 0,
            completedOrdersCount: 0,
            assignedOrders: [],
            currentLoad: 0,
        });
        await deliveryBoy.save();
        logger_1.logger.info("\n✅ DeliveryBoy document created:");
        logger_1.logger.info(`   ID: ${deliveryBoy._id}`);
        logger_1.logger.info(`   Vehicle: ${deliveryBoy.vehicleType}`);
        logger_1.logger.info(`   Availability: ${deliveryBoy.availability}`);
        logger_1.logger.info(`   Linked to User: ${deliveryBoy.userId}`);
        logger_1.logger.info("\n" + "=".repeat(60));
        logger_1.logger.info("🎉 TEST DELIVERY ACCOUNT CREATED SUCCESSFULLY!");
        logger_1.logger.info("=".repeat(60));
        logger_1.logger.info("\n📝 Login Credentials:");
        logger_1.logger.info("   📧 Email: delivery@test.com");
        logger_1.logger.info("   🔑 Password: delivery123");
        logger_1.logger.info("\n🔗 API Endpoint:");
        logger_1.logger.info("   POST http://localhost:5001/api/delivery/auth/login");
        logger_1.logger.info("\n📦 Request Body:");
        logger_1.logger.info('   { "email": "delivery@test.com", "password": "delivery123" }');
        logger_1.logger.info("=".repeat(60));
    }
    catch (error) {
        logger_1.logger.error("❌ Error:", error);
    }
    finally {
        await mongoose_1.default.connection.close();
        logger_1.logger.info("\n🔌 Disconnected from MongoDB");
    }
}
createTestDeliveryAccount();
