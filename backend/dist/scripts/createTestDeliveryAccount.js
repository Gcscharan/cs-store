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
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const bcrypt = __importStar(require("bcryptjs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
    console.error("❌ Please set MONGODB_URI in your .env file and restart.");
    process.exit(1);
}
async function createTestDeliveryAccount() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB Atlas\n");
        // Check if test delivery user already exists
        const existingUser = await User_1.User.findOne({ email: "delivery@test.com" });
        if (existingUser) {
            console.log("⚠️ Test delivery account already exists!");
            console.log(`📧 Email: delivery@test.com`);
            console.log(`🔑 Password: delivery123`);
            // Check if linked DeliveryBoy exists
            const existingDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ userId: existingUser._id });
            if (!existingDeliveryBoy) {
                console.log("\n🔧 Creating missing DeliveryBoy document...");
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
                console.log("✅ DeliveryBoy document created and linked!");
            }
            else {
                console.log("✅ DeliveryBoy document already exists and linked!");
            }
            return;
        }
        console.log("🔧 Creating test delivery account...\n");
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
        console.log("✅ User created:");
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
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
        console.log("\n✅ DeliveryBoy document created:");
        console.log(`   ID: ${deliveryBoy._id}`);
        console.log(`   Vehicle: ${deliveryBoy.vehicleType}`);
        console.log(`   Availability: ${deliveryBoy.availability}`);
        console.log(`   Linked to User: ${deliveryBoy.userId}`);
        console.log("\n" + "=".repeat(60));
        console.log("🎉 TEST DELIVERY ACCOUNT CREATED SUCCESSFULLY!");
        console.log("=".repeat(60));
        console.log("\n📝 Login Credentials:");
        console.log("   📧 Email: delivery@test.com");
        console.log("   🔑 Password: delivery123");
        console.log("\n🔗 API Endpoint:");
        console.log("   POST http://localhost:5001/api/delivery/auth/login");
        console.log("\n📦 Request Body:");
        console.log('   { "email": "delivery@test.com", "password": "delivery123" }');
        console.log("=".repeat(60));
    }
    catch (error) {
        console.error("❌ Error:", error);
    }
    finally {
        await mongoose_1.default.connection.close();
        console.log("\n🔌 Disconnected from MongoDB");
    }
}
createTestDeliveryAccount();
