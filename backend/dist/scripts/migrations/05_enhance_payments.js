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
 * MIGRATION 05: Enhance Payments Collection
 * Adds refund tracking, status history, and reconciliation
 */
const mongoose_1 = __importDefault(require("mongoose"));
const Payment_1 = require("../../models/Payment");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function enhancePayments() {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB\n");
        console.log("🔧 Enhancing Payments Collection...");
        const result = await Payment_1.Payment.updateMany({}, {
            $set: {
                // Refund Management
                refundLogs: [],
                refundInitiatedAt: null,
                refundInitiatedBy: null,
                refundCompletedAt: null,
                refundAmount: 0,
                refundReason: null,
                // Payment Status History
                paymentStatusHistory: [],
                // Fees & Reconciliation
                gatewayFee: 0,
                netAmount: 0,
                reconciliationStatus: "pending",
                reconciledAt: null,
                reconciledBy: null,
                // Risk Management
                riskScore: 0,
                isFraudulent: false,
                fraudCheckStatus: "passed"
            }
        }, { strict: false });
        console.log(`✅ Updated ${result.modifiedCount} payments`);
        // Create indexes
        console.log("\n🔧 Creating indexes...");
        await Payment_1.Payment.collection.createIndex({ reconciliationStatus: 1, reconciledAt: -1 });
        await Payment_1.Payment.collection.createIndex({ isFraudulent: 1, riskScore: -1 });
        console.log("✅ Indexes created");
    }
    catch (error) {
        console.error("❌ Error:", error);
    }
    finally {
        await mongoose_1.default.connection.close();
    }
}
enhancePayments();
