/**
 * restoreDeletedDeliveryUsers.ts
 *
 * Fixes delivery partner accounts that were soft-deleted (isDeleted: true / deletedAt set).
 * Restores them so they can log in via /api/delivery/auth/login.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/restoreDeletedDeliveryUsers.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  if (!MONGO_URI) {
    console.error("❌ No MONGODB_URI found in environment");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  // ── 1. Find all soft-deleted delivery users ──────────────────────────────
  const deletedDeliveryUsers = await User.find({
    role: "delivery",
    $or: [{ isDeleted: true }, { deletedAt: { $ne: null } }],
  }).select("_id name email phone status isDeleted deletedAt");

  if (deletedDeliveryUsers.length === 0) {
    console.log("ℹ️  No soft-deleted delivery users found.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${deletedDeliveryUsers.length} soft-deleted delivery user(s):\n`);
  deletedDeliveryUsers.forEach((u) => {
    console.log(`  • ${u.name} | phone: ${u.phone} | email: ${u.email} | status: ${u.status}`);
  });

  // ── 2. Restore each user ──────────────────────────────────────────────────
  let restoredUsers = 0;
  let restoredDeliveryBoys = 0;

  for (const user of deletedDeliveryUsers) {
    // Restore User document
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
          status: "active",
        },
      }
    );
    restoredUsers++;
    console.log(`\n✅ Restored user: ${user.name} (${user.phone})`);

    // Restore + activate corresponding DeliveryBoy record
    const deliveryBoy = await DeliveryBoy.findOne({
      $or: [{ userId: user._id }, { phone: user.phone }],
    });

    if (deliveryBoy) {
      deliveryBoy.isActive = true;
      deliveryBoy.availability = "available";
      if (!deliveryBoy.userId) {
        deliveryBoy.userId = user._id;
      }
      await deliveryBoy.save();
      restoredDeliveryBoys++;
      console.log(`   ↳ DeliveryBoy profile activated: ${deliveryBoy._id}`);
    } else {
      console.log(`   ⚠️  No DeliveryBoy profile found for ${user.phone} — creating one`);

      const newDeliveryBoy = new DeliveryBoy({
        name: user.name,
        phone: user.phone,
        email: (user as any).email,
        userId: user._id,
        vehicleType: (user as any).deliveryProfile?.vehicleType || "bike",
        isActive: true,
        availability: "available",
        currentLocation: { lat: 0, lng: 0, lastUpdatedAt: new Date() },
        earnings: 0,
        completedOrdersCount: 0,
        assignedOrders: [],
      });
      await newDeliveryBoy.save();
      restoredDeliveryBoys++;
      console.log(`   ↳ New DeliveryBoy profile created: ${newDeliveryBoy._id}`);
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`✅ Done. Restored ${restoredUsers} user(s), ${restoredDeliveryBoys} delivery profile(s).`);
  console.log(`\nDelivery partners can now log in at: POST /api/delivery/auth/login`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
