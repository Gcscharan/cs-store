import mongoose from "mongoose";
import { Product } from "../src/models/Product";
import { normalizeProductImages } from "../src/domains/catalog/controllers/productController";

// 1. Load environment variables
require("dotenv").config({ path: ".env" });

async function rebuildImages() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI missing in .env");
    process.exit(1);
  }

  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(uri);

  console.log("📦 Fetching all products...");
  const products = await Product.find({});
  console.log(`Found ${products.length} products.`);

  let fixed = 0;
  let skipped = 0;

  for (const p of products) {
    try {
      console.log(`\n🔧 Rebuilding images for: ${p._id}`);

      // Force regeneration: delete old images from memory before normalizing
      const cleanProduct = p.toObject() as any;
      delete cleanProduct.images;

      // Provide fallback image structure for normalization (old format)
      cleanProduct.images = [{ _id: "fallback-image-id" }];

      const normalized = await normalizeProductImages(cleanProduct);

      if (!normalized || !normalized.images || normalized.images.length === 0) {
        console.log(`⚠️ No images generated for product ${p._id}`);
        skipped++;
        continue;
      }

      // Save new images
      p.images = normalized.images;
      await p.save();

      console.log(`✅ Updated product ${p._id}`);
      fixed++;

    } catch (err) {
      console.error(`❌ Error rebuilding ${p._id}:`, err);
      skipped++;
    }
  }

  console.log("\n🎉 Rebuild complete!");
  console.log(`➡️ Updated: ${fixed}`);
  console.log(`➡️ Skipped/errors: ${skipped}`);

  await mongoose.disconnect();
  process.exit(0);
}

rebuildImages();
