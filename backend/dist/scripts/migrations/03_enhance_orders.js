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
 * MIGRATION 03: Enhance Orders Collection
 * Adds timing estimates, coupons, and audit logging
 */
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../../models/Order");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function enhanceOrders() {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB\n");
        console.log("🔧 Enhancing Orders Collection...");
        const result = await Order_1.Order.updateMany({}, {
            $set: {
                // Timing
                estimatedDeliveryTime: null,
                promisedDeliveryTime: null,
                actualDeliveryTime: null,
                // Coupons & Discounts
                appliedCoupons: [],
                couponDiscount: 0,
                discountBreakdown: {
                    coupon: 0,
                    loyalty: 0,
                    seasonal: 0,
                    total: 0
                },
                // Refunds
                refundAmount: 0,
                refundStatus: null,
                refundReason: null,
                refundInitiatedAt: null,
                refundCompletedAt: null,
                // Returns
                isReturned: false,
                returnReason: null,
                returnedAt: null,
                returnApprovedBy: null,
                // Notes
                customerNotes: null,
                internalNotes: null,
                // Audit
                orderStatusLogs: []
            }
        }, { strict: false });
        console.log(`✅ Updated ${result.modifiedCount} orders`);
        // Create indexes
        console.log("\n🔧 Creating indexes...");
        await Order_1.Order.collection.createIndex({ estimatedDeliveryTime: 1 });
        await Order_1.Order.collection.createIndex({ isReturned: 1, returnedAt: -1 });
        console.log("✅ Indexes created");
    }
    catch (error) {
        console.error("❌ Error:", error);
    }
    finally {
        await mongoose_1.default.connection.close();
    }
}
enhanceOrders();
