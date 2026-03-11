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
const logger_1 = require("../../utils/logger");
/**
 * MIGRATION 04: Enhance DeliveryBoys Collection
 * Adds shift management, earnings logs, and capacity tracking
 */
const mongoose_1 = __importDefault(require("mongoose"));
const DeliveryBoy_1 = require("../../models/DeliveryBoy");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function enhanceDeliveryBoys() {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        logger_1.logger.info("✅ Connected to MongoDB\n");
        logger_1.logger.info("🔧 Enhancing DeliveryBoys Collection...");
        const result = await DeliveryBoy_1.DeliveryBoy.updateMany({}, {
            $set: {
                // Shift Management
                shiftStartTime: null,
                shiftEndTime: null,
                onDuty: false,
                shiftDuration: 0,
                // Earnings Tracking
                dailyEarnings: 0,
                weeklyEarnings: 0,
                monthlyEarnings: 0,
                earningsLogs: [],
                // Capacity
                activeOrdersCount: 0,
                maxOrdersCapacity: 5,
                // Performance
                averageDeliveryTime: 0,
                successRate: 100,
                customerRating: 0,
                totalRatings: 0,
                // Location Tracking
                lastLocationUpdate: null,
                batteryLevel: 100,
                isOnline: false
            }
        }, { strict: false });
        logger_1.logger.info(`✅ Updated ${result.modifiedCount} delivery boys`);
        // Create geospatial index
        logger_1.logger.info("\n🔧 Creating geospatial index...");
        await DeliveryBoy_1.DeliveryBoy.collection.createIndex({
            "currentLocation.lat": 1,
            "currentLocation.lng": 1
        });
        logger_1.logger.info("✅ Indexes created");
    }
    catch (error) {
        logger_1.logger.error("❌ Error:", error);
    }
    finally {
        await mongoose_1.default.connection.close();
    }
}
enhanceDeliveryBoys();
