/**
 * MIGRATION 02: Enhance Products Collection
 * Adds enterprise fields for inventory, ratings, and analytics
 */
import mongoose from "mongoose";
import { Product } from "../../models/Product";
import * as dotenv from "dotenv";

dotenv.config();

async function enhanceProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected to MongoDB\n");

    console.log("🔧 Enhancing Products Collection...");
    
    const result = await Product.updateMany(
      {},
      {
        $set: {
          // Brand & SKU
          brand: "Unknown",
          manufacturer: "Unknown",
          barcode: null,
          
          // Ratings
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: {
            five: 0,
            four: 0,
            three: 0,
            two: 0,
            one: 0
          },
          
          // Inventory
          lowStockThreshold: 10,
          reorderLevel: 20,
          lastRestockedAt: null,
          inventoryLogs: [],
          
          // Pricing
          costPrice: 0,
          profitMargin: 0,
          discountPercentage: 0,
          taxRate: 0,
          
          // Status
          isActive: true,
          isFeatured: false,
          isOnSale: false,
          isDeleted: false,
          deletedAt: null,
          
          // SEO
          slug: null,
          metaTitle: null,
          metaDescription: null,
          searchKeywords: [],
          
          // Analytics
          viewCount: 0,
          purchaseCount: 0,
          lastViewedAt: null,
          lastPurchasedAt: null
        }
      },
      { strict: false }
    );

    console.log(`✅ Updated ${result.modifiedCount} products`);
    
    // Create indexes
    console.log("\n🔧 Creating indexes...");
    await Product.collection.createIndex({ brand: 1, isActive: 1, isDeleted: 1 });
    await Product.collection.createIndex({ averageRating: -1 });
    await Product.collection.createIndex({ viewCount: -1, purchaseCount: -1 });
    await Product.collection.createIndex({ isActive: 1, isFeatured: 1 });
    console.log("✅ Indexes created");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

enhanceProducts();
