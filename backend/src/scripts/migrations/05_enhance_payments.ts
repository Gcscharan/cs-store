/**
 * MIGRATION 05: Enhance Payments Collection
 * Adds refund tracking, status history, and reconciliation
 */
import mongoose from "mongoose";
import { Payment } from "../../models/Payment";
import * as dotenv from "dotenv";

dotenv.config();

async function enhancePayments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected to MongoDB\n");

    console.log("🔧 Enhancing Payments Collection...");
    
    const result = await Payment.updateMany(
      {},
      {
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
      },
      { strict: false }
    );

    console.log(`✅ Updated ${result.modifiedCount} payments`);
    
    // Create indexes
    console.log("\n🔧 Creating indexes...");
    await Payment.collection.createIndex({ reconciliationStatus: 1, reconciledAt: -1 });
    await Payment.collection.createIndex({ isFraudulent: 1, riskScore: -1 });
    console.log("✅ Indexes created");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

enhancePayments();
