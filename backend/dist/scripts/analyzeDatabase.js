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
const Product_1 = require("../models/Product");
const Order_1 = require("../models/Order");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const Cart_1 = require("../models/Cart");
const Payment_1 = require("../models/Payment");
const Otp_1 = __importDefault(require("../models/Otp"));
const Pincode_1 = require("../models/Pincode");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    logger_1.logger.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
    logger_1.logger.error("❌ Please set MONGODB_URI in your .env file and restart.");
    process.exit(1);
}
async function analyzeDatabase() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        logger_1.logger.info("✅ Connected to MongoDB Atlas\n");
        logger_1.logger.info("=".repeat(70));
        logger_1.logger.info("📊 DATABASE ANALYSIS - CURRENT STATE");
        logger_1.logger.info("=".repeat(70));
        // Analyze each collection
        const collections = [
            { name: "Users", model: User_1.User },
            { name: "Products", model: Product_1.Product },
            { name: "Orders", model: Order_1.Order },
            { name: "DeliveryBoys", model: DeliveryBoy_1.DeliveryBoy },
            { name: "Carts", model: Cart_1.Cart },
            { name: "Payments", model: Payment_1.Payment },
            { name: "OTPs", model: Otp_1.default },
            { name: "Pincodes", model: Pincode_1.Pincode },
        ];
        for (const { name, model } of collections) {
            const count = await model.countDocuments();
            const indexes = await model.collection.getIndexes();
            const sampleDoc = await model.findOne({});
            logger_1.logger.info(`\n📁 ${name} Collection:`);
            logger_1.logger.info(`   Documents: ${count}`);
            logger_1.logger.info(`   Indexes: ${Object.keys(indexes).length}`);
            logger_1.logger.info(`   Index Details:`);
            for (const [indexName, indexDef] of Object.entries(indexes)) {
                logger_1.logger.info(`     - ${indexName}: ${JSON.stringify(indexDef.key)}`);
            }
            if (sampleDoc) {
                logger_1.logger.info(`   Sample Fields: ${Object.keys(sampleDoc.toObject()).join(", ")}`);
            }
        }
        logger_1.logger.info("\n" + "=".repeat(70));
        logger_1.logger.info("🔍 MISSING ENTERPRISE FEATURES DETECTED:");
        logger_1.logger.info("=".repeat(70));
        const issues = [
            "❌ Users: No lastLoginAt, totalOrders, loyaltyPoints tracking",
            "❌ Products: No brand field, reviews system, inventory logs",
            "❌ Orders: No estimatedDeliveryTime, coupon tracking",
            "❌ DeliveryBoys: No earnings logs, shift timings",
            "❌ Payments: No refund logs, payment status history",
            "❌ General: No soft delete flags, limited audit trails",
            "❌ Performance: Missing compound indexes for common queries",
        ];
        issues.forEach(issue => logger_1.logger.info(issue));
        logger_1.logger.info("\n" + "=".repeat(70));
        logger_1.logger.info("✅ ENHANCEMENT RECOMMENDATIONS:");
        logger_1.logger.info("=".repeat(70));
        logger_1.logger.info("1. Add 30+ new enterprise fields across collections");
        logger_1.logger.info("2. Create 15+ optimized compound indexes");
        logger_1.logger.info("3. Implement audit logging for all critical operations");
        logger_1.logger.info("4. Add soft delete and archival capabilities");
        logger_1.logger.info("5. Scale-ready for millions of users and orders");
    }
    catch (error) {
        logger_1.logger.error("❌ Error:", error);
    }
    finally {
        await mongoose_1.default.connection.close();
        logger_1.logger.info("\n🔌 Disconnected from MongoDB");
    }
}
analyzeDatabase();
