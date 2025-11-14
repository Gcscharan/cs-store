/**
 * MIGRATION 01: Enhance Users Collection
 * Adds enterprise fields without breaking existing data
 */
import mongoose from "mongoose";
import { User } from "../../models/User";
import * as dotenv from "dotenv";

dotenv.config();

async function enhanceUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected to MongoDB\n");

    console.log("🔧 Enhancing Users Collection...");
    
    const result = await User.updateMany(
      {},
      {
        $set: {
          // Analytics
          lastLoginAt: null,
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          
          // Loyalty
          loyaltyPoints: 0,
          loyaltyTier: "bronze",
          referralCode: null,
          referredBy: null,
          
          // Verification
          isEmailVerified: false,
          isPhoneVerified: false,
          
          // Soft Delete
          isDeleted: false,
          deletedAt: null,
          
          // Security
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          accountLockedUntil: null,
          
          // Preferences
          marketingConsent: false,
          notificationPreferences: {
            email: true,
            sms: true,
            push: true,
            orderUpdates: true,
            promotions: false
          }
        }
      },
      { strict: false } // Allow fields not in schema
    );

    console.log(`✅ Updated ${result.modifiedCount} users`);
    
    // Create indexes
    console.log("\n🔧 Creating indexes...");
    await User.collection.createIndex({ lastLoginAt: -1 });
    await User.collection.createIndex({ totalOrders: -1, totalSpent: -1 });
    await User.collection.createIndex({ loyaltyPoints: -1 });
    console.log("✅ Indexes created");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

enhanceUsers();
