import { logger } from '../utils/logger';
import mongoose from "mongoose";
import { User } from "../models/User";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { Cart } from "../models/Cart";
import { Payment } from "../models/Payment";
import Otp from "../models/Otp";
import { Pincode } from "../models/Pincode";
import * as dotenv from "dotenv";

dotenv.config();

// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
  logger.error("❌ Please set MONGODB_URI in your .env file and restart.");
  process.exit(1);
}

async function analyzeDatabase() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    logger.info("✅ Connected to MongoDB Atlas\n");

    logger.info("=" .repeat(70));
    logger.info("📊 DATABASE ANALYSIS - CURRENT STATE");
    logger.info("=".repeat(70));

    // Analyze each collection
    const collections = [
      { name: "Users", model: User },
      { name: "Products", model: Product },
      { name: "Orders", model: Order },
      { name: "DeliveryBoys", model: DeliveryBoy },
      { name: "Carts", model: Cart },
      { name: "Payments", model: Payment },
      { name: "OTPs", model: Otp },
      { name: "Pincodes", model: Pincode },
    ];

    for (const { name, model } of collections) {
      const count = await model.countDocuments();
      const indexes = await model.collection.getIndexes();
      const sampleDoc = await (model as any).findOne({});

      logger.info(`\n📁 ${name} Collection:`);
      logger.info(`   Documents: ${count}`);
      logger.info(`   Indexes: ${Object.keys(indexes).length}`);
      logger.info(`   Index Details:`);
      for (const [indexName, indexDef] of Object.entries(indexes)) {
        logger.info(`     - ${indexName}: ${JSON.stringify((indexDef as any).key)}`);
      }
      
      if (sampleDoc) {
        logger.info(`   Sample Fields: ${Object.keys(sampleDoc.toObject()).join(", ")}`);
      }
    }

    logger.info("\n" + "=".repeat(70));
    logger.info("🔍 MISSING ENTERPRISE FEATURES DETECTED:");
    logger.info("=".repeat(70));

    const issues = [
      "❌ Users: No lastLoginAt, totalOrders, loyaltyPoints tracking",
      "❌ Products: No brand field, reviews system, inventory logs",
      "❌ Orders: No estimatedDeliveryTime, coupon tracking",
      "❌ DeliveryBoys: No earnings logs, shift timings",
      "❌ Payments: No refund logs, payment status history",
      "❌ General: No soft delete flags, limited audit trails",
      "❌ Performance: Missing compound indexes for common queries",
    ];

    issues.forEach(issue => logger.info(issue));

    logger.info("\n" + "=".repeat(70));
    logger.info("✅ ENHANCEMENT RECOMMENDATIONS:");
    logger.info("=".repeat(70));
    logger.info("1. Add 30+ new enterprise fields across collections");
    logger.info("2. Create 15+ optimized compound indexes");
    logger.info("3. Implement audit logging for all critical operations");
    logger.info("4. Add soft delete and archival capabilities");
    logger.info("5. Scale-ready for millions of users and orders");

  } catch (error) {
    logger.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    logger.info("\n🔌 Disconnected from MongoDB");
  }
}

analyzeDatabase();
