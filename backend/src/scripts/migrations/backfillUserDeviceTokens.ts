/**
 * backfillUserDeviceTokens.ts
 *
 * One-time migration: copies each user's legacy single `expoPushToken` field
 * into the multi-device `UserDeviceToken` registry, so multi-device push works
 * for existing users immediately (without waiting for them to re-login).
 *
 * Safe to run multiple times (idempotent): the upsert is keyed on the unique
 * `token`, so re-running won't create duplicates. A token already owned by the
 * same user is just refreshed.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/migrations/backfillUserDeviceTokens.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { User } from "../../models/User";
import UserDeviceToken from "../../models/UserDeviceToken";

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  if (!MONGO_URI) {
    console.error("❌ No MONGODB_URI found in environment");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  // Find all users that have a legacy expoPushToken set.
  const users = await User.find({
    expoPushToken: { $exists: true, $nin: [null, ""] },
  })
    .select("_id expoPushToken")
    .lean();

  console.log(`Found ${users.length} user(s) with a legacy expoPushToken.\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const token = String((user as any).expoPushToken || "").trim();
    if (!token) {
      skipped++;
      continue;
    }

    // Infer platform from the token shape (best-effort; defaults to unknown).
    const platform = token.includes("ExponentPushToken") ? "unknown" : "unknown";

    try {
      const existing = await UserDeviceToken.findOne({ token }).select("_id userId").lean();
      if (existing) {
        skipped++;
        continue;
      }

      await UserDeviceToken.create({
        userId: user._id,
        token,
        platform,
        lastActiveAt: new Date(),
      });
      migrated++;
    } catch (e: any) {
      if (e?.code === 11000 || String(e?.message || "").includes("E11000")) {
        // Concurrent/duplicate — already present, treat as skipped.
        skipped++;
      } else {
        failed++;
        console.error(`  ❌ Failed for user ${String(user._id)}: ${e?.message || e}`);
      }
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`✅ Backfill complete.`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped (already present / empty): ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log(`${"─".repeat(50)}\n`);

  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
