/**
 * Product Schema Migration Script
 * 
 * Normalizes all products to have consistent fields:
 * - isActive: true
 * - isSellable: true
 * - deletedAt: null
 * 
 * Run with: npm run migrate:products
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI or MONGO_URI not found in environment");
  process.exit(1);
}

interface IProduct {
  _id: mongoose.Types.ObjectId;
  name: string;
  isActive?: boolean;
  isSellable?: boolean;
  deletedAt?: Date | null;
}

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isSellable: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { strict: false }
);

const Product = mongoose.model<IProduct>("Product", ProductSchema);

async function migrateProducts() {
  console.log("🔄 Starting Product Schema Migration...\n");

  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log("✅ Connected to MongoDB\n");

    // Count products without required fields
    const missingIsActive = await Product.countDocuments({
      isActive: { $exists: false },
    });
    const missingIsSellable = await Product.countDocuments({
      isSellable: { $exists: false },
    });
    const missingDeletedAt = await Product.countDocuments({
      deletedAt: { $exists: false },
    });

    console.log("📊 Migration Summary:");
    console.log(`   - Products missing isActive: ${missingIsActive}`);
    console.log(`   - Products missing isSellable: ${missingIsSellable}`);
    console.log(`   - Products missing deletedAt: ${missingDeletedAt}\n`);

    if (missingIsActive === 0 && missingIsSellable === 0 && missingDeletedAt === 0) {
      console.log("✅ All products already have required fields. No migration needed.");
      return;
    }

    // Run migrations
    console.log("🔧 Running migrations...\n");

    if (missingIsActive > 0) {
      const result = await Product.updateMany(
        { isActive: { $exists: false } },
        { $set: { isActive: true } }
      );
      console.log(`   ✅ Set isActive=true for ${result.modifiedCount} products`);
    }

    if (missingIsSellable > 0) {
      const result = await Product.updateMany(
        { isSellable: { $exists: false } },
        { $set: { isSellable: true } }
      );
      console.log(`   ✅ Set isSellable=true for ${result.modifiedCount} products`);
    }

    if (missingDeletedAt > 0) {
      const result = await Product.updateMany(
        { deletedAt: { $exists: false } },
        { $set: { deletedAt: null } }
      );
      console.log(`   ✅ Set deletedAt=null for ${result.modifiedCount} products`);
    }

    console.log("\n✅ Migration completed successfully!");

    // Verify
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({
      isActive: true,
      isSellable: true,
      deletedAt: null,
    });
    console.log(`\n📈 Final Stats:`);
    console.log(`   - Total products: ${totalProducts}`);
    console.log(`   - Active & sellable: ${activeProducts}`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

migrateProducts();
