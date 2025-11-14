import mongoose from "mongoose";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";
import * as bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";

/**
 * Sync DeliveryBoy documents with User documents
 * This script ensures every DeliveryBoy has a corresponding User account
 */
async function syncDeliveryBoysToUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB Atlas");

    // Get all delivery boys
    const deliveryBoys = await DeliveryBoy.find({});
    console.log(`\n📊 Found ${deliveryBoys.length} delivery boy records`);

    let created = 0;
    let linked = 0;
    let alreadySynced = 0;

    for (const deliveryBoy of deliveryBoys) {
      console.log(`\n🔍 Processing: ${deliveryBoy.name} (${deliveryBoy.phone})`);

      // Check if this delivery boy already has a userId link
      if (deliveryBoy.userId) {
        const linkedUser = await User.findById(deliveryBoy.userId);
        if (linkedUser && linkedUser.role === "delivery") {
          console.log(`  ✓ Already synced with User: ${linkedUser.email}`);
          alreadySynced++;
          continue;
        } else {
          console.log(`  ⚠️ Invalid userId link, will fix...`);
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
          console.log(`  ⚠️ User exists but role is "${user.role}", updating to "delivery"...`);
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
        
        console.log(`  ✓ Linked to existing User: ${user.email}`);
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

        console.log(`  ✓ Created new User: ${user.email}`);
        console.log(`  🔑 Default password: ${defaultPassword}`);
        created++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SYNC SUMMARY:");
    console.log("=".repeat(60));
    console.log(`Total Delivery Boys: ${deliveryBoys.length}`);
    console.log(`Already Synced: ${alreadySynced}`);
    console.log(`Linked to Existing Users: ${linked}`);
    console.log(`New Users Created: ${created}`);
    console.log("=".repeat(60));

    if (created > 0) {
      console.log("\n⚠️ DEFAULT PASSWORDS (Share with delivery partners):");
      console.log("=".repeat(60));
      const newUsers = await User.find({ role: "delivery" }).select("email phone name");
      for (const u of newUsers) {
        const phone = u.phone || "";
        if (phone) {
          console.log(`📧 ${u.email} - Password: delivery${phone.slice(-4)}`);
        }
      }
    }

    console.log("\n✅ Sync completed successfully!");
    
  } catch (error) {
    console.error("❌ Sync failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the sync
syncDeliveryBoysToUsers();
