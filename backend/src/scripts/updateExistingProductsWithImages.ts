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

// Update existing products with images
const updateExistingProductsWithImages = async () => {
  try {
    console.log("🚀 Updating existing products with images...");

    // Get all products that don't have images or have empty images array
    const productsWithoutImages = await Product.find({
      $or: [
        { images: { $exists: false } },
        { images: { $size: 0 } },
        { images: null },
      ],
    });

    console.log(
      `📦 Found ${productsWithoutImages.length} products without images`
    );

    // Image mapping based on product names and categories
    const imageMapping: { [key: string]: string[] } = {
      // Chocolate products
      Toblerone: [
        "https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&h=600&fit=crop",
      ],
      KitKat: [
        "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=600&fit=crop",
      ],
      "Dry Fruit Laddu": [
        "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
      ],
      // Generic category images
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

    for (const product of productsWithoutImages) {
      let imagesToAdd: string[] = [];

      // Try to find specific images for the product name
      if (imageMapping[product.name]) {
        imagesToAdd = imageMapping[product.name];
      }
      // Fall back to category images
      else if (imageMapping[product.category]) {
        imagesToAdd = imageMapping[product.category];
      }
      // Default fallback images
      else {
        imagesToAdd = [
          "https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&h=600&fit=crop",
        ];
      }

      // Update the product with images
      await Product.findByIdAndUpdate(product._id, {
        $set: { images: imagesToAdd },
      });

      console.log(
        `  ✅ Updated: ${product.name} (${product.category}) with ${imagesToAdd.length} image(s)`
      );
      updatedCount++;
    }

    console.log(
      `\n🎉 Successfully updated ${updatedCount} products with images!`
    );
  } catch (error) {
    console.error("❌ Error updating products:", error);
  }
};

const main = async () => {
  await connectDB();
  await updateExistingProductsWithImages();
  await mongoose.disconnect();
  console.log("👋 Disconnected from MongoDB");
};

main().catch(console.error);
