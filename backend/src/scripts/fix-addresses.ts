import mongoose from "mongoose";
import { User } from "../models/User";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";

async function fixAddresses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find all users with addresses
    const users = await User.find({ "addresses.0": { $exists: true } });
    console.log(`📊 Found ${users.length} users with addresses`);

    let updatedCount = 0;
    let addressesFixed = 0;

    for (const user of users) {
      let userUpdated = false;

      for (const address of user.addresses) {
        // Add name if missing
        if (!address.name) {
          address.name = user.name || "";
          userUpdated = true;
          addressesFixed++;
        }

        // Add phone if missing
        if (!address.phone) {
          address.phone = user.phone || "";
          userUpdated = true;
        }
      }

      if (userUpdated) {
        await user.save();
        updatedCount++;
        console.log(`✅ Updated user: ${user.email} (${user.addresses.length} addresses)`);
      }
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`📊 Updated ${updatedCount} users`);
    console.log(`📊 Fixed ${addressesFixed} addresses`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

fixAddresses();
