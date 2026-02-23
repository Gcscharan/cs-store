/**
 * MIGRATION 06: Enforce Unique Phone Index (Users)
 * Creates a partial unique index on phone to enforce DB-level uniqueness
 * while remaining backward compatible with legacy docs (phone: "").
 *
 * SAFETY:
 * - Does NOT delete or mutate any documents
 * - If duplicate phones exist, index creation is skipped and migration exits successfully
 */
import mongoose from "mongoose";
import { User } from "../../models/User";
import * as dotenv from "dotenv";

dotenv.config();

async function enforceUniqueUserPhoneIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected to MongoDB\n");

    console.log("🔧 Enforcing unique phone index on Users (partial)...");

    const duplicates = await User.aggregate([
      {
        $match: {
          phone: { $type: "string", $ne: "" },
        },
      },
      {
        $group: {
          _id: "$phone",
          count: { $sum: 1 },
          ids: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    if (Array.isArray(duplicates) && duplicates.length > 0) {
      console.warn("⚠️  Duplicate phone values detected; skipping index creation.");
      console.warn(
        "⚠️  Examples:",
        duplicates.map((d: any) => ({ phone: d._id, count: d.count }))
      );
      console.warn(
        "⚠️  Resolve duplicates before enabling DB-level uniqueness (no changes were made)."
      );
      return;
    }

    console.log("✅ No duplicate phones detected. Creating partial unique index...");

    await User.collection.createIndex(
      { phone: 1 },
      {
        unique: true,
        partialFilterExpression: {
          phone: { $type: "string", $ne: "" },
        },
      }
    );

    console.log("✅ Unique phone index created successfully");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

enforceUniqueUserPhoneIndex();
