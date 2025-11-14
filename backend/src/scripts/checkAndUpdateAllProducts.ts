import mongoose from "mongoose";
import { Product } from "../models/Product";
import dotenv from "dotenv";

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store"
    );
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Check and update all products with images
const checkAndUpdateAllProducts = async () => {
  try {
    console.log("🚀 Checking and updating all products with images...");

    // Get all products
    const allProducts = await Product.find({});
    console.log(`📦 Found ${allProducts.length} total products`);

    // Image mapping for specific products and categories
    const imageMapping: { [key: string]: string[] } = {
      // Specific product names
      Toblerone: [
        "https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&h=600&fit=crop",
      ],
      "KitKat 4 Finger": [
        "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=600&fit=crop",
      ],
      "Dry Fruit Laddu": [
        "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
      ],
      "Premium Chocolate Box": [
        "https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&h=600&fit=crop",
      ],
      "Fresh Strawberry Cake": [
        "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
      ],
      "Crispy Biscuits Pack": [
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
      ],
      // Category-based images
      chocolates: [
        "https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&h=600&fit=crop",
      ],
      biscuits: [
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
      ],
      ladoos: [
        "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
      ],
      cakes: [
        "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&h=600&fit=crop",
      ],
      hot_snacks: [
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&h=600&fit=crop",
      ],
      groceries: [
        "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=600&fit=crop",
      ],
      vegetables: [
        "https://images.unsplash.com/photo-1546470427-5a1a3b5b5b5b?w=800&h=600&fit=crop",
      ],
      fruits: [
        "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&h=600&fit=crop",
      ],
      dairy: [
        "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop",
      ],
      beverages: [
        "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=600&fit=crop",
      ],
    };

    let updatedCount = 0;
    let alreadyHasImages = 0;

    for (const product of allProducts) {
      console.log(`\n🔍 Checking: ${product.name} (${product.category})`);
      console.log(`   Current images: ${product.images?.length || 0} images`);

      // Check if product already has good images
      if (
        product.images &&
        product.images.length > 0 &&
        product.images.some(
          (img) => img.includes("unsplash.com") || img.includes("http")
        )
      ) {
        console.log(`   ✅ Already has images`);
        alreadyHasImages++;
        continue;
      }

      let imagesToAdd: string[] = [];

      // Try to find specific images for the product name
      if (imageMapping[product.name]) {
        imagesToAdd = imageMapping[product.name];
        console.log(`   📸 Using specific images for: ${product.name}`);
      }
      // Fall back to category images
      else if (imageMapping[product.category]) {
        imagesToAdd = imageMapping[product.category];
        console.log(`   📸 Using category images for: ${product.category}`);
      }
      // Default fallback images
      else {
        imagesToAdd = [
          "https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&h=600&fit=crop",
        ];
        console.log(`   📸 Using default images`);
      }

      // Update the product with images
      await Product.findByIdAndUpdate(product._id, {
        $set: { images: imagesToAdd },
      });

      console.log(`   ✅ Updated with ${imagesToAdd.length} image(s)`);
      updatedCount++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   📦 Total products: ${allProducts.length}`);
    console.log(`   ✅ Already had images: ${alreadyHasImages}`);
    console.log(`   🔄 Updated with images: ${updatedCount}`);
    console.log(`\n🎉 Image update process completed!`);
  } catch (error) {
    console.error("❌ Error updating products:", error);
  }
};

const main = async () => {
  await connectDB();
  await checkAndUpdateAllProducts();
  await mongoose.disconnect();
  console.log("👋 Disconnected from MongoDB");
};

main().catch(console.error);
