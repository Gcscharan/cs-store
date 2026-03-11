import { logger } from '../utils/logger';
import mongoose from "mongoose";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
  logger.error("❌ Please set MONGODB_URI in your .env file and restart.");
  process.exit(1);
}

/**
 * Sync DeliveryBoy documents with User documents
 * This script ensures every DeliveryBoy has a corresponding User account
 */
async function syncDeliveryBoysToUsers() {
  try {
    await mongoose.connect(MONGODB_URI as string);
    logger.info("✅ Connected to MongoDB Atlas");

    // Get all delivery boys
    const deliveryBoys = await DeliveryBoy.find({});
    logger.info(`\n📊 Found ${deliveryBoys.length} delivery boy records`);

    let created = 0;
    let linked = 0;
    let alreadySynced = 0;

    for (const deliveryBoy of deliveryBoys) {
      logger.info(`\n🔍 Processing: ${deliveryBoy.name} (${deliveryBoy.phone})`);

      // Check if this delivery boy already has a userId link
      if (deliveryBoy.userId) {
        const linkedUser = await User.findById(deliveryBoy.userId);
        if (linkedUser && linkedUser.role === "delivery") {
          logger.info(`  ✓ Already synced with User: ${linkedUser.email}`);
          alreadySynced++;
          continue;
        } else {
          logger.info(`  ⚠️ Invalid userId link, will fix...`);
          deliveryBoy.userId = undefined;
        }
      }

      // Try to find existing user by email or phone
      let user = await User.findOne({
        $or: [
          { email: deliveryBoy.email },
          { phone: deliveryBoy.phone }
        ],
      });

      if (user) {
        // User exists - check if they have delivery role
        if (user.role !== "delivery") {
          logger.info(`  ⚠️ User exists but role is "${user.role}", updating to "delivery"...`);
          user.role = "delivery";
          user.status = deliveryBoy.isActive ? "active" : "pending";
          
          // Add delivery profile if missing
          if (!user.deliveryProfile) {
            user.deliveryProfile = {
              phone: deliveryBoy.phone,
              vehicleType: deliveryBoy.vehicleType,
              assignedAreas: [],
              documents: [],
            } as any;
          }
          
          await user.save();
        }

        // Link delivery boy to user
        deliveryBoy.userId = user._id;
        await deliveryBoy.save();
        
        logger.info(`  ✓ Linked to existing User: ${user.email}`);
        linked++;
      } else {
        // Create new user for this delivery boy
        const defaultEmail = deliveryBoy.email || `${deliveryBoy.phone}@delivery.csstore.com`;
        const defaultPassword = `delivery${deliveryBoy.phone.slice(-4)}`;
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        user = new User({
          name: deliveryBoy.name,
          email: defaultEmail,
          phone: deliveryBoy.phone,
          passwordHash,
          role: "delivery",
          status: deliveryBoy.isActive ? "active" : "pending",
          deliveryProfile: {
            phone: deliveryBoy.phone,
            vehicleType: deliveryBoy.vehicleType,
            assignedAreas: [],
            documents: [],
          },
        });

        await user.save();

        // Link delivery boy to new user
        deliveryBoy.userId = user._id;
        await deliveryBoy.save();

        logger.info(`  ✓ Created new User: ${user.email}`);
        logger.info(`  🔑 Default password: ${defaultPassword}`);
        created++;
      }
    }

    logger.info("\n" + "=".repeat(60));
    logger.info("📊 SYNC SUMMARY:");
    logger.info("=".repeat(60));
    logger.info(`Total Delivery Boys: ${deliveryBoys.length}`);
    logger.info(`Already Synced: ${alreadySynced}`);
    logger.info(`Linked to Existing Users: ${linked}`);
    logger.info(`New Users Created: ${created}`);
    logger.info("=".repeat(60));

    if (created > 0) {
      logger.info("\n⚠️ DEFAULT PASSWORDS (Share with delivery partners):");
      logger.info("=".repeat(60));
      const newUsers = await User.find({ role: "delivery" }).select("email phone name");
      for (const u of newUsers) {
        const phone = u.phone || "";
        if (phone) {
          logger.info(`📧 ${u.email} - Password: delivery${phone.slice(-4)}`);
        }
      }
    }

    logger.info("\n✅ Sync completed successfully!");
    
  } catch (error) {
    logger.error("❌ Sync failed:", error);
  } finally {
    await mongoose.connection.close();
    logger.info("\n🔌 Disconnected from MongoDB");
  }
}

// Run the sync
syncDeliveryBoysToUsers();
