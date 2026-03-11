import { logger } from '../../utils/logger';
/**
 * MIGRATION 03: Enhance Orders Collection
 * Adds timing estimates, coupons, and audit logging
 */
import mongoose from "mongoose";
import { Order } from "../../models/Order";
import * as dotenv from "dotenv";

dotenv.config();

async function enhanceOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info("✅ Connected to MongoDB\n");

    logger.info("🔧 Enhancing Orders Collection...");
    
    const result = await Order.updateMany(
      {},
      {
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
      },
      { strict: false }
    );

    logger.info(`✅ Updated ${result.modifiedCount} orders`);
    
    // Create indexes
    logger.info("\n🔧 Creating indexes...");
    await Order.collection.createIndex({ estimatedDeliveryTime: 1 });
    await Order.collection.createIndex({ isReturned: 1, returnedAt: -1 });
    logger.info("✅ Indexes created");

  } catch (error) {
    logger.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

enhanceOrders();
