/**
 * DANGER: Delete All Users Script
 * 
 * This script safely removes all users from the database.
 * It performs soft deletion (sets isDeleted: true) to maintain data integrity.
 * 
 * Related collections that will be cleaned up:
 * - Carts
 * - Notifications
 * - UserPreferences
 * - UserCategoryPreferences
 * - UserSessions
 * - DeliveryBoys (only if user is delivery role)
 * 
 * Collections that will NOT be deleted (for audit/analytics):
 * - Orders (historical data)
 * - Payments (financial records)
 * - Reviews (product feedback)
 * 
 * Usage:
 *   npm run ts-node src/scripts/deleteAllUsers.ts
 */

import { logger } from '../utils/logger';
import mongoose from "mongoose";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { Cart } from "../models/Cart";
import Notification from "../models/Notification";
import UserPreference from "../models/UserPreference";
import UserCategoryPreference from "../models/UserCategoryPreference";
import UserSession from "../models/UserSession";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

async function deleteAllUsers() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI or MONGO_URI not found in environment variables");
    }

    logger.info("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    logger.info("✅ Connected to MongoDB");

    // Count users before deletion
    const totalUsers = await User.countDocuments({});
    const activeUsers = await User.countDocuments({ 
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }] 
    });
    const deletedUsers = await User.countDocuments({ isDeleted: true });

    logger.info("\n📊 Current User Statistics:");
    logger.info(`   Total Users: ${totalUsers}`);
    logger.info(`   Active Users: ${activeUsers}`);
    logger.info(`   Already Deleted: ${deletedUsers}`);

    if (activeUsers === 0) {
      logger.info("\n✅ No active users to delete. Exiting.");
      await mongoose.disconnect();
      rl.close();
      return;
    }

    // Get user breakdown by role
    const customerCount = await User.countDocuments({ 
      role: "customer",
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }]
    });
    const adminCount = await User.countDocuments({ 
      role: "admin",
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }]
    });
    const deliveryCount = await User.countDocuments({ 
      role: "delivery",
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }]
    });

    logger.info("\n👥 User Breakdown:");
    logger.info(`   Customers: ${customerCount}`);
    logger.info(`   Admins: ${adminCount}`);
    logger.info(`   Delivery Partners: ${deliveryCount}`);

    // Count related data
    const cartCount = await Cart.countDocuments({});
    const notificationCount = await Notification.countDocuments({});
    const preferenceCount = await UserPreference.countDocuments({});
    const categoryPrefCount = await UserCategoryPreference.countDocuments({});
    const sessionCount = await UserSession.countDocuments({});

    logger.info("\n🗂️  Related Data to Clean:");
    logger.info(`   Carts: ${cartCount}`);
    logger.info(`   Notifications: ${notificationCount}`);
    logger.info(`   User Preferences: ${preferenceCount}`);
    logger.info(`   Category Preferences: ${categoryPrefCount}`);
    logger.info(`   Active Sessions: ${sessionCount}`);

    // Warning
    logger.warn("\n⚠️  WARNING: This action will:");
    logger.warn("   1. Soft delete all active users (set isDeleted: true)");
    logger.warn("   2. Delete all carts");
    logger.warn("   3. Delete all notifications");
    logger.warn("   4. Delete all user preferences");
    logger.warn("   5. Delete all user sessions");
    logger.warn("   6. Mark delivery boys as inactive");
    logger.warn("\n   Orders, Payments, and Reviews will be PRESERVED for audit.");

    // Confirmation
    const answer1 = await askQuestion("\n❓ Are you sure you want to delete ALL users? (yes/no): ");
    if (answer1.toLowerCase() !== "yes") {
      logger.info("❌ Operation cancelled by user");
      await mongoose.disconnect();
      rl.close();
      return;
    }

    const answer2 = await askQuestion("❓ Type 'DELETE ALL USERS' to confirm: ");
    if (answer2 !== "DELETE ALL USERS") {
      logger.info("❌ Confirmation failed. Operation cancelled.");
      await mongoose.disconnect();
      rl.close();
      return;
    }

    logger.info("\n🚀 Starting deletion process...\n");

    // Step 1: Soft delete all users
    logger.info("1️⃣  Soft deleting all users...");
    const userUpdateResult = await User.updateMany(
      { $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }] },
      { 
        $set: { 
          isDeleted: true, 
          deletedAt: new Date() 
        } 
      }
    );
    logger.info(`   ✅ Soft deleted ${userUpdateResult.modifiedCount} users`);

    // Step 2: Mark all delivery boys as inactive
    logger.info("2️⃣  Marking delivery boys as inactive...");
    const deliveryBoyResult = await DeliveryBoy.updateMany(
      { isActive: true },
      { $set: { isActive: false } }
    );
    logger.info(`   ✅ Deactivated ${deliveryBoyResult.modifiedCount} delivery boys`);

    // Step 3: Delete all carts
    logger.info("3️⃣  Deleting all carts...");
    const cartDeleteResult = await Cart.deleteMany({});
    logger.info(`   ✅ Deleted ${cartDeleteResult.deletedCount} carts`);

    // Step 4: Delete all notifications
    logger.info("4️⃣  Deleting all notifications...");
    const notificationDeleteResult = await Notification.deleteMany({});
    logger.info(`   ✅ Deleted ${notificationDeleteResult.deletedCount} notifications`);

    // Step 5: Delete all user preferences
    logger.info("5️⃣  Deleting all user preferences...");
    const preferenceDeleteResult = await UserPreference.deleteMany({});
    logger.info(`   ✅ Deleted ${preferenceDeleteResult.deletedCount} user preferences`);

    // Step 6: Delete all category preferences
    logger.info("6️⃣  Deleting all category preferences...");
    const categoryPrefDeleteResult = await UserCategoryPreference.deleteMany({});
    logger.info(`   ✅ Deleted ${categoryPrefDeleteResult.deletedCount} category preferences`);

    // Step 7: Delete all user sessions
    logger.info("7️⃣  Deleting all user sessions...");
    const sessionDeleteResult = await UserSession.deleteMany({});
    logger.info(`   ✅ Deleted ${sessionDeleteResult.deletedCount} user sessions`);

    // Final verification
    logger.info("\n📊 Final Statistics:");
    const remainingActiveUsers = await User.countDocuments({ 
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }] 
    });
    const totalDeletedUsers = await User.countDocuments({ isDeleted: true });
    
    logger.info(`   Active Users: ${remainingActiveUsers}`);
    logger.info(`   Deleted Users: ${totalDeletedUsers}`);
    logger.info(`   Remaining Carts: ${await Cart.countDocuments({})}`);
    logger.info(`   Remaining Notifications: ${await Notification.countDocuments({})}`);
    logger.info(`   Remaining Preferences: ${await UserPreference.countDocuments({})}`);
    logger.info(`   Remaining Sessions: ${await UserSession.countDocuments({})}`);

    logger.info("\n✅ All users deleted successfully!");
    logger.info("\n💡 Note: Orders, Payments, and Reviews have been preserved for audit purposes.");
    logger.info("   To permanently delete user records, run a hard delete script (not recommended).");

    await mongoose.disconnect();
    logger.info("\n🔌 Disconnected from MongoDB");
    rl.close();
  } catch (error) {
    logger.error("❌ Error deleting users:", error);
    await mongoose.disconnect();
    rl.close();
    process.exit(1);
  }
}

// Run the script
deleteAllUsers();
