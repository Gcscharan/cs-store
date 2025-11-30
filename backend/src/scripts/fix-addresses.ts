import mongoose from "mongoose";
import { User } from "../models/User";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
  console.error("❌ Please set MONGODB_URI in your .env file and restart.");
  process.exit(1);
}

async function fixAddresses() {
  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(MONGODB_URI as string);
    console.log("✅ Connected to MongoDB Atlas");

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
