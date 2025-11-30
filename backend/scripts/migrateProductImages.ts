/**
 * Product Image Migration Utility
 * 
 * This script converts products with old string[] image format
 * to the new dual-resolution { full, thumb }[] format.
 * 
 * Usage: npx ts-node scripts/migrateProductImages.ts
 * 
 * IMPORTANT: This script is for manual use only. It does NOT run automatically.
 * Always backup your database before running migration scripts.
 */

import mongoose from "mongoose";
import { Product } from "../src/models/Product";
import { fileToThumbnailBase64 } from "../src/utils/base64";
import * as dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";

/**
 * Convert a single image URL to dual-resolution format
 * If the URL is a Base64 string, generates thumbnail from it
 * If the URL is external, fetches and converts it
 */
async function convertToDualResolution(imageUrl: string): Promise<{ full: string; thumb: string }> {
  try {
    // If it's already a Base64 string, use it as full image
    if (imageUrl.startsWith('data:image/')) {
      const buffer = base64ToFile(imageUrl);
      const thumb = await fileToThumbnailBase64(buffer);
      return {
        full: imageUrl,
        thumb: thumb
      };
    }
    
    // For external URLs, we'll use the same URL for both full and thumb
    // In a real production scenario, you might want to download and process these
    return {
      full: imageUrl,
      thumb: imageUrl
    };
  } catch (error) {
    console.warn(`Failed to convert image: ${imageUrl}`, error);
    // Fallback: use same URL for both
    return {
      full: imageUrl,
      thumb: imageUrl
    };
  }
}

/**
 * Convert Base64 data URL to Buffer
 */
function base64ToFile(dataUrl: string): Buffer {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = Buffer.from(arr[1], 'base64');
  
  return bstr;
}

/**
 * Migrate all products with old image format to new dual-resolution format
 */
async function migrateProductImages() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find all products that need migration
    const productsToMigrate = await Product.find({
      $or: [
        { images: { $type: "array" } }, // Has images array
        { "images.0": { $type: "string" } } // First image is a string (old format)
      ]
    });

    console.log(`📊 Found ${productsToMigrate.length} products to migrate\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const product of productsToMigrate) {
      try {
        if (!product.images || product.images.length === 0) {
          console.log(`⚠️  Product ${product._id} (${product.name}) has no images - skipping`);
          continue;
        }

        // Check if already in new format
        if (typeof product.images[0] === 'object' && product.images[0] !== null) {
          console.log(`✅ Product ${product._id} (${product.name}) already in new format - skipping`);
          successCount++;
          continue;
        }

        console.log(`🔄 Migrating product: ${product.name} (${product._id})`);
        
        // Convert old string[] to new { full, thumb }[]
        const oldImages = product.images as unknown as string[];
        const newImages: { full: string; thumb: string }[] = [];

        for (const imageUrl of oldImages) {
          const dualImage = await convertToDualResolution(imageUrl);
          newImages.push(dualImage);
        }

        // Update the product
        await Product.findByIdAndUpdate(product._id, {
          $set: { images: newImages }
        });

        console.log(`✅ Successfully migrated product: ${product.name}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Failed to migrate product ${product._id} (${product.name}):`, error);
        errorCount++;
      }
    }

    console.log("\n📋 Migration Summary:");
    console.log(`✅ Successfully migrated: ${successCount} products`);
    console.log(`❌ Failed migrations: ${errorCount} products`);
    console.log(`📊 Total processed: ${productsToMigrate.length} products`);

    if (errorCount === 0) {
      console.log("\n🎉 All products migrated successfully!");
    } else {
      console.log("\n⚠️  Some products failed to migrate. Please check the errors above.");
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

/**
 * Verify migration by checking image formats
 */
async function verifyMigration() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    const products = await Product.find({});
    
    let oldFormatCount = 0;
    let newFormatCount = 0;
    let noImagesCount = 0;

    for (const product of products) {
      if (!product.images || product.images.length === 0) {
        noImagesCount++;
      } else if (typeof product.images[0] === 'string') {
        oldFormatCount++;
        console.log(`⚠️  Still in old format: ${product.name} (${product._id})`);
      } else {
        newFormatCount++;
      }
    }

    console.log("\n📊 Verification Results:");
    console.log(`✅ New format (dual-resolution): ${newFormatCount} products`);
    console.log(`⚠️  Old format (string[]): ${oldFormatCount} products`);
    console.log(`📷 No images: ${noImagesCount} products`);
    console.log(`📊 Total products: ${products.length}`);

    if (oldFormatCount === 0) {
      console.log("\n🎉 All products are using the new dual-resolution format!");
    } else {
      console.log(`\n⚠️  ${oldFormatCount} products still need migration.`);
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log("🚀 Product Image Migration Utility");
  console.log("=====================================\n");

  switch (command) {
    case "migrate":
      console.log("🔄 Starting migration...\n");
      await migrateProductImages();
      break;
    case "verify":
      console.log("🔍 Verifying migration status...\n");
      await verifyMigration();
      break;
    default:
      console.log("Usage:");
      console.log("  npx ts-node scripts/migrateProductImages.ts migrate  # Run migration");
      console.log("  npx ts-node scripts/migrateProductImages.ts verify   # Verify migration status");
      console.log("\n⚠️  Always backup your database before running migrations!");
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}

export { migrateProductImages, verifyMigration };
